"use client"

import * as React from "react"

import { visible } from "../core/machine"
import { type ActionApi } from "../core/schema"
import { FieldRow, MachineRow } from "./controls"
import { CheckIcon, CloseIcon, CopyIcon, GearIcon, RedoIcon, UndoIcon } from "./icons"
import { formatBinding, isTypingTarget, matches, parseBinding, useHotkey } from "./hotkeys"
import { ScenarioPalette } from "./palette"
import { useScenario } from "./use-scenario"
import { injectStyles } from "./styles"

export type PanelPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left"

export interface ScenarioPanelProps {
  /** Which corner. Default bottom-right. */
  position?: PanelPosition
  /** Heading. Default "Prototype controls". */
  title?: string
  /**
   * Stacking order. Default 690 — high enough to clear an app's overlays, low
   * enough to sit under anything that must never be covered (a classification
   * banner, a cookie wall you are legally obliged to show).
   */
  zIndex?: number
  /** Toggle the panel. Default "mod+.". Pass null to unbind. */
  hotkey?: string | null
  /** Open the scenario palette. Default "mod+shift+p". Pass null to unbind. */
  paletteHotkey?: string | null
  /**
   * A CSS custom property to set on the document element while the controls are
   * mounted, so the host can push its own corner UI clear of them.
   * `{ name: "--toast-inset-bottom", value: "4.5rem" }`.
   */
  inset?: { name: string; value: string }
  /** Show the session's undo history. Default true. */
  showHistory?: boolean
  /** Called with the markdown whenever the copy button is used. */
  onCopy?: (markdown: string) => void
  /** Override the dev-only default. */
  enabled?: boolean
  /** Rendered at the foot of the panel — a theme switch, a link, whatever. */
  children?: React.ReactNode
}

/**
 * The controls.
 *
 * Mount it once, as a sibling of your app inside <ScenarioProvider>. It
 * collapses to a single button so it does not photobomb a review, and it
 * disappears entirely in production builds.
 */
export function ScenarioPanel({
  position = "bottom-right",
  title = "Prototype controls",
  zIndex = 690,
  hotkey = "mod+.",
  paletteHotkey = "mod+shift+p",
  inset,
  showHistory = true,
  onCopy,
  enabled,
  children,
}: ScenarioPanelProps) {
  const p = useScenario()
  const active = enabled ?? p.enabled

  const [copied, setCopied] = React.useState(false)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const launcherRef = React.useRef<HTMLButtonElement>(null)
  /* So closing returns focus where it came from rather than to <body>, which
     is where a keyboard user would otherwise have to start over. */
  const restoreFocus = React.useRef(false)

  injectStyles()

  useHotkey(hotkey, () => p.setOpen(!p.open), active)
  useHotkey(paletteHotkey, () => p.setPaletteOpen(true), active)

  React.useEffect(() => {
    if (!active || !inset || typeof document === "undefined") return
    const root = document.documentElement
    root.style.setProperty(inset.name, inset.value)
    return () => {
      root.style.removeProperty(inset.name)
    }
  }, [active, inset])

  React.useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(id)
  }, [copied])

  /* Escape and click-outside, which the hand-rolled version of this panel
     always forgets. Escape only closes the panel when the palette is not up —
     the palette owns Escape while it is open. */
  React.useEffect(() => {
    if (!active || !p.open || p.paletteOpen || typeof document === "undefined") return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault()
        restoreFocus.current = true
        p.setOpen(false)
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!panelRef.current) return
      if (event.target instanceof Node && panelRef.current.contains(event.target)) return
      p.setOpen(false)
    }

    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointerdown", onPointerDown, true)
    }
  }, [active, p, p.open, p.paletteOpen])

  React.useEffect(() => {
    if (p.open || !restoreFocus.current) return
    restoreFocus.current = false
    launcherRef.current?.focus()
  }, [p.open])

  /* Production builds drop it entirely. A prototype gets deployed for review,
     and a reviewer who finds a role switcher assumes it is a feature. */
  if (!active) return null

  if (!p.open) {
    return (
      <>
        <button
          ref={launcherRef}
          type="button"
          className={`pm-root pm-${position} pm-launcher`}
          style={{ zIndex }}
          onClick={() => p.setOpen(true)}
          aria-label={`Open ${title.toLowerCase()}${hotkey ? ` (${formatBinding(hotkey)})` : ""}`}
        >
          <GearIcon size={20} />
        </button>
        {p.paletteOpen ? <ScenarioPalette zIndex={zIndex + 1} /> : null}
      </>
    )
  }

  const { machines, fields, actions } = p.machine.config
  const actionApi: ActionApi = {
    set: p.set,
    go: p.go,
    reset: p.reset,
    navigate: p.navigate,
    get: () => p.machine.contextOf(p.snapshot),
  }

  const recent = showHistory ? p.history.entries.slice(-6).reverse() : []

  return (
    <>
      <div
        ref={panelRef}
        className={`pm-root pm-${position} pm-panel`}
        style={{ zIndex }}
        role="dialog"
        aria-label={title}
        onKeyDown={(event) => {
          /* Undo lives here rather than on `window` on purpose: mod+z belongs
             to whatever the host is doing, and the panel only gets it while
             the panel has focus. */
          if (isTypingTarget(event.target)) return
          if (matches(event.nativeEvent, parseBinding("mod+z"))) {
            event.preventDefault()
            p.undo()
          } else if (matches(event.nativeEvent, parseBinding("mod+shift+z"))) {
            event.preventDefault()
            p.redo()
          }
        }}
      >
        <div className="pm-head">
          <span className="pm-title">{title}</span>
          <div className="pm-head-actions">
            <button
              type="button"
              className="pm-icon-button"
              onClick={p.undo}
              disabled={!p.canUndo}
              aria-label="Undo"
              title="Undo (⌘Z inside this panel)"
            >
              <UndoIcon size={14} />
            </button>
            <button
              type="button"
              className="pm-icon-button"
              onClick={p.redo}
              disabled={!p.canRedo}
              aria-label="Redo"
              title="Redo"
            >
              <RedoIcon size={14} />
            </button>
            <button
              type="button"
              className="pm-icon-button"
              onClick={() => {
                const markdown = p.markdown()
                void p.copy().then((ok) => setCopied(ok))
                onCopy?.(markdown)
              }}
              aria-label="Copy scenario for an agent"
              title="Copy this scenario as markdown, for pasting to a coding agent"
            >
              {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            </button>
            <button
              type="button"
              className="pm-icon-button"
              onClick={() => {
                restoreFocus.current = true
                p.setOpen(false)
              }}
              aria-label={`Close ${title.toLowerCase()}`}
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </div>

        <div className="pm-rows">
          {Object.entries(machines).map(([id, def]) =>
            visible(def, p.env) ? (
              <MachineRow key={id} id={id} def={def} scenario={p} />
            ) : null
          )}

          {Object.entries(fields).map(([id, def]) =>
            visible(def, p.env) ? <FieldRow key={id} id={id} def={def} scenario={p} /> : null
          )}

          {children}

          {actions.length ? (
            <div className="pm-actions">
              {actions.map((action) =>
                visible(action, p.env) ? (
                  <button
                    key={action.id}
                    type="button"
                    className="pm-action"
                    title={action.title}
                    onClick={() => action.run(actionApi)}
                  >
                    {action.label}
                  </button>
                ) : null
              )}
            </div>
          ) : null}
        </div>

        <div className="pm-foot">
          {showHistory && recent.length > 1 ? (
            <div>
              <span className="pm-label">History</span>
              <div className="pm-history">
                {recent.map((entry) => {
                  const index = p.history.entries.indexOf(entry)
                  return (
                    <button
                      key={`${entry.at}-${index}`}
                      type="button"
                      className="pm-history-item"
                      aria-current={index === p.history.index}
                      onClick={() => p.jump(index)}
                      title={entry.label ?? "Where this session started"}
                    >
                      {entry.label ?? "Session start"}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {paletteHotkey ? (
            <span className="pm-hint">
              <kbd>{formatBinding(paletteHotkey)}</kbd> for the scenario palette
            </span>
          ) : null}
        </div>
      </div>

      {p.paletteOpen ? <ScenarioPalette zIndex={zIndex + 1} /> : null}
    </>
  )
}
