"use client"

import * as React from "react"

import { HOST_TAG } from "./shadow"

/* Keep clear of bars fixed to the top or bottom edge of the page.
 *
 * A header, a footer or a notice bar pinned to an edge is part of the page
 * someone is reviewing, and some of them must never be covered. The panel's
 * corners and the switcher move inward by the height of any such bar, so by
 * default the tools touch none of them.
 *
 * A bar is found by hit-testing a few points on each edge and walking up to
 * the nearest `fixed` or `sticky` ancestor. It counts when it touches the
 * edge, spans at least half the viewport's width, and is no taller than
 * MAX_BAR_SHARE of its height (a modal backdrop or a sidebar is not a bar). */

export interface EdgeInsets {
  /** Height of the bars on the top edge, in px. */
  top: number
  /** Height of the bars on the bottom edge, in px. */
  bottom: number
}

export const NO_EDGES: EdgeInsets = Object.freeze({ top: 0, bottom: 0 })

/** The tallest a bar can be, as a share of the viewport's height. */
export const MAX_BAR_SHARE = 0.3

/** The narrowest a bar can be, as a share of the viewport's width. */
export const MIN_BAR_WIDTH = 0.5

interface Box {
  top: number
  bottom: number
  left: number
  right: number
}

/** The insets that a set of fixed or sticky boxes make. Pure, for tests. */
export function edgeInsetsFrom(boxes: Iterable<Box>, viewport: { width: number; height: number }): EdgeInsets {
  let top = 0
  let bottom = 0
  for (const b of boxes) {
    const width = b.right - b.left
    const height = b.bottom - b.top
    if (height <= 0 || width < viewport.width * MIN_BAR_WIDTH || height > viewport.height * MAX_BAR_SHARE) continue
    if (b.top <= 1 && b.bottom > 0) top = Math.max(top, Math.ceil(b.bottom))
    else if (b.bottom >= viewport.height - 1 && b.top < viewport.height) {
      bottom = Math.max(bottom, Math.ceil(viewport.height - b.top))
    }
  }
  return top === 0 && bottom === 0 ? NO_EDGES : { top, bottom }
}

const SAMPLE_X = [0.25, 0.5, 0.75]

/** Hit-tests the page's top and bottom edges for fixed or sticky bars. */
export function measureEdges(): EdgeInsets {
  if (typeof document === "undefined" || typeof document.elementsFromPoint !== "function") return NO_EDGES
  const width = window.innerWidth
  const height = window.innerHeight
  if (!width || !height) return NO_EDGES
  const seen = new Set<Element>()
  const boxes: Box[] = []
  for (const y of [0, height - 1]) {
    for (const share of SAMPLE_X) {
      for (const hit of document.elementsFromPoint(width * share, y)) {
        for (let node: Element | null = hit; node; node = node.parentElement) {
          if (node === document.body || node === document.documentElement || seen.has(node)) break
          seen.add(node)
          /* Our own tools are never a bar. */
          if (node.localName === HOST_TAG) break
          const position = getComputedStyle(node).position
          if (position === "fixed" || position === "sticky") {
            boxes.push(node.getBoundingClientRect())
            break
          }
        }
      }
    }
  }
  return edgeInsetsFrom(boxes, { width, height })
}

/* Short enough to feel immediate, long enough that a scroll or a burst of
   DOM changes costs one measurement. */
const SETTLE_MS = 80

/**
 * The page's edge bars, kept current through resizes, scrolls (a sticky bar
 * only touches the edge once stuck) and DOM changes. `NO_EDGES` while
 * inactive, on the server, and in browsers without `elementsFromPoint`.
 */
export function useEdgeInsets(active: boolean): EdgeInsets {
  const [edges, setEdges] = React.useState<EdgeInsets>(NO_EDGES)

  React.useEffect(() => {
    if (!active || typeof window === "undefined") return
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      timer = undefined
      const next = measureEdges()
      setEdges((prev) => (prev.top === next.top && prev.bottom === next.bottom ? prev : next))
    }
    const schedule = () => {
      if (timer === undefined) timer = setTimeout(update, SETTLE_MS)
    }
    update()
    window.addEventListener("resize", schedule)
    window.addEventListener("scroll", schedule, { capture: true, passive: true })
    /* Not `style`: animation libraries rewrite it every frame. A bar appears
       by mounting, or by a class or `hidden` changing. */
    const observer =
      typeof MutationObserver !== "undefined" && document.body ? new MutationObserver(schedule) : null
    observer?.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] })
    return () => {
      if (timer !== undefined) clearTimeout(timer)
      window.removeEventListener("resize", schedule)
      window.removeEventListener("scroll", schedule, { capture: true })
      observer?.disconnect()
    }
  }, [active])

  return active ? edges : NO_EDGES
}

/** The insets as the custom properties the corner classes read. */
export function edgeVars(edges: EdgeInsets): React.CSSProperties | null {
  if (edges.top === 0 && edges.bottom === 0) return null
  return { "--pm-edge-top": `${edges.top}px`, "--pm-edge-bottom": `${edges.bottom}px` } as React.CSSProperties
}
