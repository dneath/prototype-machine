"use client"

import * as React from "react"

/* Keyboard bindings, written as "mod+.", "mod+shift+p", "alt+s".
 *
 * `mod` is Command on Apple platforms and Control everywhere else, which is the
 * only portable way to spell "the modifier this user's muscle memory expects".
 *
 * Two rules this file exists to enforce:
 *
 *   1. Never fire while someone is typing. A prototype is full of inputs, and a
 *      panel that opens because a reviewer typed a full stop in a search box is
 *      worse than no shortcut.
 *   2. Never bind undo globally. `mod+z` belongs to whatever the host is doing;
 *      the panel gets it only while the panel has focus, which is why the undo
 *      binding lives on the panel element and not on `window`.
 */

export interface Binding {
  key: string
  mod: boolean
  shift: boolean
  alt: boolean
}

const isApple = () =>
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent || "")

export function parseBinding(spec: string): Binding {
  const parts = spec.toLowerCase().split("+").map((p) => p.trim()).filter(Boolean)
  const binding: Binding = { key: "", mod: false, shift: false, alt: false }
  for (const part of parts) {
    if (part === "mod" || part === "cmd" || part === "ctrl" || part === "control") binding.mod = true
    else if (part === "shift") binding.shift = true
    else if (part === "alt" || part === "option") binding.alt = true
    else binding.key = part
  }
  return binding
}

export function matches(event: KeyboardEvent, binding: Binding): boolean {
  const mod = isApple() ? event.metaKey : event.ctrlKey
  if (mod !== binding.mod) return false
  if (event.shiftKey !== binding.shift) return false
  if (event.altKey !== binding.alt) return false
  /* The other modifier must NOT be held, so ctrl+z on a Mac does not also fire
     a cmd+z binding. */
  if (isApple() ? event.ctrlKey : event.metaKey) return false

  const key = event.key.toLowerCase()
  if (key === binding.key) return true
  /* Shifted punctuation reports the shifted character, so a "mod+shift+p"
     binding still matches when the layout produces "P". `code` covers layouts
     where the key is somewhere else entirely. */
  return event.code.toLowerCase() === `key${binding.key}`
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined") return false
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

/** A global binding. Skipped while typing, and while `enabled` is false. */
export function useHotkey(
  spec: string | null | undefined,
  handler: () => void,
  enabled = true
): void {
  const saved = React.useRef(handler)
  saved.current = handler

  React.useEffect(() => {
    if (!spec || !enabled || typeof window === "undefined") return
    const binding = parseBinding(spec)

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return
      if (isTypingTarget(event.target)) return
      if (!matches(event, binding)) return
      event.preventDefault()
      saved.current()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [spec, enabled])
}

/** Format a binding for display: "⌘." on Apple, "Ctrl+." elsewhere. */
export function formatBinding(spec: string): string {
  const binding = parseBinding(spec)
  const apple = isApple()
  const parts: string[] = []
  if (binding.mod) parts.push(apple ? "⌘" : "Ctrl")
  if (binding.shift) parts.push(apple ? "⇧" : "Shift")
  if (binding.alt) parts.push(apple ? "⌥" : "Alt")
  parts.push(binding.key.length === 1 ? binding.key.toUpperCase() : binding.key)
  return apple ? parts.join("") : parts.join("+")
}
