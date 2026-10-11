"use client"

import * as React from "react"

/* Page tools: stress the host page as a whole, whatever the scenario says.
 *
 * Every layout has three questions it is rarely asked until it ships — does it
 * survive right-to-left, does it survive someone's enlarged text, and what
 * does it look like mid-animation — and none of them belongs in a scenario
 * config, because they are not states of the product. They are states of the
 * person looking at it.
 *
 * Each tool records what the page had before it touched anything and puts it
 * back when it is switched off or the panel unmounts. The panel's own UI is in
 * a shadow root with pixel sizes and a stated direction, so none of this moves
 * the controls you are using to apply it. */

export type Direction = "auto" | "ltr" | "rtl"
export type TextScale = 1 | 1.25 | 1.5 | 2
export type Motion = "normal" | "slow" | "paused"

export interface PageTools {
  dir: Direction
  text: TextScale
  motion: Motion
}

export const DEFAULT_TOOLS: PageTools = { dir: "auto", text: 1, motion: "normal" }

export const TEXT_SCALES: ReadonlyArray<TextScale> = [1, 1.25, 1.5, 2]
export const SLOW_RATE = 0.1

export function sanitizeTools(input: unknown): PageTools {
  const raw = (input && typeof input === "object" ? input : {}) as Partial<PageTools>
  return {
    dir: raw.dir === "ltr" || raw.dir === "rtl" ? raw.dir : "auto",
    text: TEXT_SCALES.includes(raw.text as TextScale) ? (raw.text as TextScale) : 1,
    motion: raw.motion === "slow" || raw.motion === "paused" ? raw.motion : "normal",
  }
}

export function toolsChanged(tools: PageTools): number {
  return (
    (tools.dir !== DEFAULT_TOOLS.dir ? 1 : 0) +
    (tools.text !== DEFAULT_TOOLS.text ? 1 : 0) +
    (tools.motion !== DEFAULT_TOOLS.motion ? 1 : 0)
  )
}

/** `dir` on <html>, restoring whatever attribute was there before. */
function useDirection(dir: Direction) {
  React.useEffect(() => {
    if (dir === "auto" || typeof document === "undefined") return
    const html = document.documentElement
    const before = html.getAttribute("dir")
    html.setAttribute("dir", dir)
    return () => {
      if (before === null) html.removeAttribute("dir")
      else html.setAttribute("dir", before)
    }
  }, [dir])
}

/**
 * The root font size, scaled from whatever the page computes it as — so a
 * product that sets `html { font-size: 62.5% }` is scaled from its own base,
 * the way a browser's text-size setting would, instead of being reset to 16px.
 * Layouts in rem and em respond; layouts in px do not, which is the finding.
 */
function useTextScale(scale: TextScale) {
  React.useEffect(() => {
    if (scale === 1 || typeof document === "undefined") return
    const html = document.documentElement
    const inline = html.style.getPropertyValue("font-size")
    const priority = html.style.getPropertyPriority("font-size")
    const base = parseFloat(getComputedStyle(html).fontSize) || 16
    html.style.setProperty("font-size", `${base * scale}px`, "important")
    return () => {
      if (inline) html.style.setProperty("font-size", inline, priority)
      else html.style.removeProperty("font-size")
    }
  }, [scale])
}

const FREEZE_CSS = `*, *::before, *::after {
  animation-play-state: paused !important;
  transition-property: none !important;
  caret-color: transparent !important;
}`

/**
 * Slow or stop the page's CSS and Web Animations.
 *
 * Animations are found with `document.getAnimations()` and re-checked on an
 * interval, because the page keeps starting new ones; each is put back to the
 * rate or play state it had when it was first touched. JavaScript-driven
 * motion (a requestAnimationFrame loop) is out of reach and is left alone.
 * The panel's own animations are skipped, so the controls stay responsive.
 */
function useMotion(motion: Motion, own: Element | null) {
  React.useEffect(() => {
    if (motion === "normal" || typeof document === "undefined") return
    const touched = new Map<Animation, { rate: number; playing: boolean }>()
    let style: HTMLStyleElement | null = null
    if (motion === "paused") {
      style = document.createElement("style")
      style.setAttribute("data-prototype-machine-motion", "")
      style.textContent = FREEZE_CSS
      document.head.appendChild(style)
    }
    const isOwn = (animation: Animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target
      if (!target || !own) return false
      const root = target.getRootNode()
      return own.contains(target) || (root instanceof ShadowRoot && root.host === own)
    }
    const apply = () => {
      if (typeof document.getAnimations !== "function") return
      for (const animation of document.getAnimations()) {
        if (isOwn(animation)) continue
        if (!touched.has(animation)) {
          touched.set(animation, { rate: animation.playbackRate, playing: animation.playState === "running" })
        }
        try {
          if (motion === "paused") {
            if (animation.playState === "running") animation.pause()
          } else if (animation.playbackRate !== SLOW_RATE) {
            animation.updatePlaybackRate(SLOW_RATE)
          }
        } catch {
          /* An animation that finished between the read and the write. */
        }
      }
    }
    apply()
    const timer = window.setInterval(apply, 200)
    return () => {
      window.clearInterval(timer)
      style?.remove()
      for (const [animation, was] of touched) {
        try {
          animation.updatePlaybackRate(was.rate)
          if (motion === "paused" && was.playing && animation.playState === "paused") animation.play()
        } catch {
          /* Gone. */
        }
      }
    }
  }, [motion, own])
}

/** Apply every page tool for as long as the panel is mounted and active. */
export function usePageTools(tools: PageTools, active: boolean, own: Element | null) {
  useDirection(active ? tools.dir : "auto")
  useTextScale(active ? tools.text : 1)
  useMotion(active ? tools.motion : "normal", own)
}
