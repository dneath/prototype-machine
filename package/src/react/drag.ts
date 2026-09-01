"use client"

import * as React from "react"

/* Dragging the panel out of the way, which a control panel pinned to a corner
 * eventually needs: the thing it is meant to help you review is underneath it.
 *
 * The pure half of this file is deliberately separable from the hook — it is
 * arithmetic over rects and pointers, and it is where the two bugs that make
 * hand-rolled dragging feel broken actually live:
 *
 *   1. Accumulating deltas drifts. Capture the rect ONCE at pointerdown and
 *      compute an absolute position from it every move.
 *   2. A drag that ends over the handle fires a click, so the panel you just
 *      moved also opens. A `justDragged` boolean does not fix this when the
 *      click lands on a descendant with its own handler; a capture-phase
 *      blocker does.
 */

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface DragStart {
  pointerX: number
  pointerY: number
  elX: number
  elY: number
}

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right"

export const CORNERS: ReadonlyArray<Corner> = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
]

/**
 * Where the panel is anchored, which is not the same as where its pixels are.
 *
 * A corner placement stores the CORNER, so the panel can be positioned by the
 * existing `pm-<corner>` CSS class and stays glued through a window resize with
 * no JavaScript involved. A free placement is pixels, and has to be clamped.
 */
export type Placement =
  | { kind: "corner"; corner: Corner }
  | { kind: "free"; x: number; y: number }

/** Below this, a pointer sequence was a click and not a drag. */
export const DRAG_THRESHOLD = 8

/** Release this close to a corner and the panel takes the corner. */
export const SNAP_DISTANCE = 140

/** How far an arrow key moves the panel, and how far with shift held. */
export const NUDGE_STEP = 8
export const NUDGE_STEP_LARGE = 32

/** Distance kept between the panel and the edge of the viewport. */
export const VIEWPORT_PADDING = 8

/* Matches the inset the `pm-<corner>` CSS classes use, so a snapped panel lands
   exactly where the class would have put it. */
export const CORNER_INSET = 16

export function dragStart(pointer: Point, rect: { left: number; top: number }): DragStart {
  return { pointerX: pointer.x, pointerY: pointer.y, elX: rect.left, elY: rect.top }
}

/** Absolute position, from the rect captured at pointerdown. Never a delta sum. */
export function dragOffset(start: DragStart, pointer: Point): Point {
  return {
    x: start.elX + pointer.x - start.pointerX,
    y: start.elY + pointer.y - start.pointerY,
  }
}

export function hasMoved(start: DragStart, pointer: Point): boolean {
  return Math.hypot(pointer.x - start.pointerX, pointer.y - start.pointerY) >= DRAG_THRESHOLD
}

/**
 * Keep the panel on screen.
 *
 * Called from the move handler, from a resize listener, on mount, and whenever
 * the panel's own size changes — a position restored from a wider monitor is
 * off-screen, and a panel dragged to the bottom edge while collapsed would hang
 * off it once expanded.
 */
export function clampToViewport(
  pos: Point,
  size: Size,
  viewport: Size,
  padding = VIEWPORT_PADDING
): Point {
  /* max before min, so a panel taller than the viewport pins to the top edge
     rather than to a negative maximum. */
  const maxX = Math.max(padding, viewport.width - size.width - padding)
  const maxY = Math.max(padding, viewport.height - size.height - padding)
  return {
    x: Math.min(Math.max(pos.x, padding), maxX),
    y: Math.min(Math.max(pos.y, padding), maxY),
  }
}

/** Where a corner-anchored element sits, in the same coordinates as a drag. */
export function cornerPosition(
  corner: Corner,
  size: Size,
  viewport: Size,
  padding = CORNER_INSET
): Point {
  const right = viewport.width - size.width - padding
  const bottom = viewport.height - size.height - padding
  switch (corner) {
    case "top-left":     return { x: padding, y: padding }
    case "top-right":    return { x: right,   y: padding }
    case "bottom-left":  return { x: padding, y: bottom }
    case "bottom-right": return { x: right,   y: bottom }
  }
}

/**
 * The corner this position should stick to, if any.
 *
 * Straight-line distance to each corner's anchored position, nearest wins, and
 * nothing wins beyond `distance`. Keeping the whole snap rule in one pure
 * function is what lets it be tested without a DOM — and the rule is the part
 * that decides whether the gesture feels right.
 */
export function snapTarget(
  pos: Point,
  size: Size,
  viewport: Size,
  distance = SNAP_DISTANCE
): Corner | null {
  let best: Corner | null = null
  let bestGap = Infinity
  for (const corner of CORNERS) {
    const anchor = cornerPosition(corner, size, viewport)
    const gap = Math.hypot(pos.x - anchor.x, pos.y - anchor.y)
    if (gap < bestGap) {
      bestGap = gap
      best = corner
    }
  }
  return bestGap <= distance ? best : null
}

/**
 * Swallow the click that a finished drag is about to fire.
 *
 * Capture phase and `stopImmediatePropagation`, so it lands before React's
 * delegated listener and before any handler on a descendant. One shot, removed
 * on the next tick so a genuine click a moment later still works.
 */
export function blockNextClick(el: Element): void {
  const blocker = (event: Event) => {
    event.preventDefault()
    event.stopImmediatePropagation()
    event.stopPropagation()
  }
  el.addEventListener("click", blocker, { capture: true, once: true })
  setTimeout(() => el.removeEventListener("click", blocker, true), 0)
}

const POSITION_SUFFIX = ":pm-panel-position"

export function positionKey(storageKey: string): string {
  return `${storageKey}${POSITION_SUFFIX}`
}

function isPoint(v: unknown): v is Point {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Point).x === "number" &&
    typeof (v as Point).y === "number" &&
    Number.isFinite((v as Point).x) &&
    Number.isFinite((v as Point).y)
  )
}

export function readPlacement(storageKey: string): Placement | null {
  try {
    const raw = window.localStorage.getItem(positionKey(storageKey))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null

    const kind = (parsed as { kind?: unknown }).kind
    if (kind === "corner") {
      const corner = (parsed as { corner?: unknown }).corner
      return CORNERS.includes(corner as Corner)
        ? { kind: "corner", corner: corner as Corner }
        : null
    }
    if (kind === "free" && isPoint(parsed)) {
      return { kind: "free", x: (parsed as Point).x, y: (parsed as Point).y }
    }
    /* A bare {x, y} is what versions before snapping wrote. Migrate it rather
       than dropping it — somebody has the panel where they want it. */
    if (kind === undefined && isPoint(parsed)) {
      return { kind: "free", x: (parsed as Point).x, y: (parsed as Point).y }
    }
    /* Storage outlives code. Anything else is dropped rather than trusted into
       a style attribute. */
    return null
  } catch {
    return null
  }
}

export function writePlacement(storageKey: string, placement: Placement | null): void {
  try {
    if (placement) {
      window.localStorage.setItem(positionKey(storageKey), JSON.stringify(placement))
    } else {
      window.localStorage.removeItem(positionKey(storageKey))
    }
  } catch {
    /* Private browsing, or a full quota. Losing the position is not worth a throw. */
  }
}

/** Interactive descendants that own their own pointer gestures. */
const NOT_A_HANDLE = [
  "button",
  "input",
  "select",
  "textarea",
  "a",
  "[role=\"button\"]",
  "[contenteditable=\"true\"]",
].join(",")

/**
 * Whether this pointerdown should start a drag.
 *
 * `root` bounds the walk, so a `closest()` that escapes the panel cannot match
 * something in the host page.
 */
export function isDragTarget(target: EventTarget | null, root: Element | null): boolean {
  if (!(target instanceof Element) || !root || !root.contains(target)) return false
  /* The handle never excludes ITSELF. When the panel is collapsed the handle
     is the launcher, which is a <button> — and the icon inside it is what the
     pointer actually lands on, so a bare closest() test would reject the one
     surface that is entirely meant to be draggable. */
  const blocked = target.closest(NOT_A_HANDLE)
  return !(blocked && blocked !== root && root.contains(blocked))
}

/* jsdom implements no part of the Pointer Capture API, and a consumer running
   their own tests should not get a TypeError on every click of the panel. The
   drag degrades to plain synthetic events, which is fine in a test and never
   happens in a browser. */
export function capturePointer(el: Element, pointerId: number) {
  if (typeof (el as HTMLElement).setPointerCapture !== "function") return
  try {
    ;(el as HTMLElement).setPointerCapture(pointerId)
  } catch {
    /* An id that is no longer active. Not worth a throw. */
  }
}

export function releasePointer(el: Element, pointerId: number) {
  if (typeof (el as HTMLElement).hasPointerCapture !== "function") return
  try {
    if ((el as HTMLElement).hasPointerCapture(pointerId)) {
      ;(el as HTMLElement).releasePointerCapture(pointerId)
    }
  } catch {
    /* Same. */
  }
}

export interface UseDragOptions {
  /** Namespaces the stored placement. Usually the provider's storageKey. */
  storageKey: string
  enabled: boolean
  /** Ref to the element being moved — measured for clamping and snapping. */
  elementRef: React.RefObject<HTMLElement | null>
}

export interface UseDragResult {
  /** Null until the panel has been moved; it is in its default corner. */
  placement: Placement | null
  dragging: boolean
  /** The corner a release right now would take. Drives the preview outline. */
  snapPreview: Corner | null
  /** True on the render after a release, so the settle can be animated. */
  settling: boolean
  /** Spread onto whichever element is the handle. */
  handleProps: {
    onPointerDown(event: React.PointerEvent): void
    onPointerMove(event: React.PointerEvent): void
    onPointerUp(event: React.PointerEvent): void
    onPointerCancel(event: React.PointerEvent): void
    onKeyDown(event: React.KeyboardEvent): void
    onDoubleClick(): void
  }
  /** Back to the configured corner, and forget what was stored. */
  reset(): void
}

export function useDrag({ storageKey, enabled, elementRef }: UseDragOptions): UseDragResult {
  const [placement, setPlacement] = React.useState<Placement | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const [snapPreview, setSnapPreview] = React.useState<Corner | null>(null)
  const [settling, setSettling] = React.useState(false)

  const startRef = React.useRef<DragStart | null>(null)
  const movedRef = React.useRef(false)

  const measure = React.useCallback((): Size => {
    const rect = elementRef.current?.getBoundingClientRect()
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 }
  }, [elementRef])

  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight })

  /* Restore after mount rather than during render: localStorage is not
     available on the server, and the first client render has to match it. */
  React.useEffect(() => {
    if (!enabled) return
    const stored = readPlacement(storageKey)
    if (!stored) return
    setPlacement(
      stored.kind === "free"
        ? { ...stored, ...clampToViewport(stored, measure(), viewport()) }
        : stored
    )
  }, [enabled, storageKey, measure])

  /* Only a FREE placement needs clamping. A corner placement is rendered by its
     CSS class, so the browser keeps it anchored through a resize for free —
     which is most of the reason placements are stored as corners at all.

     Two triggers: the window changed, or the panel did. The panel's own size
     matters because one dragged to the bottom edge while collapsed would hang
     off it once expanded — hence the ResizeObserver rather than a measurement
     taken during render. */
  React.useEffect(() => {
    if (!enabled) return
    const clamp = () =>
      setPlacement((current) =>
        current && current.kind === "free"
          ? { kind: "free", ...clampToViewport(current, measure(), viewport()) }
          : current
      )
    clamp()
    window.addEventListener("resize", clamp)

    const el = elementRef.current
    const observer =
      el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(clamp) : null
    if (el && observer) observer.observe(el)

    return () => {
      window.removeEventListener("resize", clamp)
      observer?.disconnect()
    }
  }, [enabled, measure, elementRef])

  /* The settle transition lives for exactly one animation, then gets out of the
     way — leaving it on would animate a resize-driven clamp too. */
  React.useEffect(() => {
    if (!settling) return
    const id = window.setTimeout(() => setSettling(false), 220)
    return () => window.clearTimeout(id)
  }, [settling])

  const commit = (next: Placement | null) => {
    setPlacement(next)
    writePlacement(storageKey, next)
  }

  const handleProps = {
    onPointerDown(event: React.PointerEvent) {
      if (!enabled) return
      /* Primary button only. A right-click drag that moves the panel and then
         leaves it stuck to the cursor is the classic version of this bug. */
      if (event.button !== 0 || event.ctrlKey) return
      if (!isDragTarget(event.target, event.currentTarget as Element)) return

      const rect = elementRef.current?.getBoundingClientRect()
      if (!rect) return

      startRef.current = dragStart({ x: event.clientX, y: event.clientY }, rect)
      movedRef.current = false
      setSettling(false)
      /* Capture means no document-level listeners, and the pointer cannot be
         lost by leaving the window. */
      capturePointer(event.currentTarget as Element, event.pointerId)
    },

    onPointerMove(event: React.PointerEvent) {
      const start = startRef.current
      if (!start) return
      const pointer = { x: event.clientX, y: event.clientY }
      if (!movedRef.current) {
        if (!hasMoved(start, pointer)) return
        movedRef.current = true
        setDragging(true)
      }
      const size = measure()
      const view = viewport()
      const next = clampToViewport(dragOffset(start, pointer), size, view)
      setPlacement({ kind: "free", ...next })
      /* Predicted, not sprung on you: the corner lights up before you let go. */
      setSnapPreview(snapTarget(next, size, view))
    },

    onPointerUp(event: React.PointerEvent) {
      const el = event.currentTarget as Element
      releasePointer(el, event.pointerId)
      if (!startRef.current) return
      startRef.current = null
      if (!movedRef.current) return

      movedRef.current = false
      setDragging(false)
      setSnapPreview(null)
      blockNextClick(el)

      /* Written once, at the end of the gesture, rather than on every move —
         and this is where a near-miss becomes a corner. */
      const size = measure()
      const view = viewport()
      setPlacement((current) => {
        if (!current || current.kind !== "free") return current
        const corner = snapTarget(current, size, view)
        const next: Placement = corner ? { kind: "corner", corner } : current
        writePlacement(storageKey, next)
        return next
      })
      setSettling(true)
    },

    onPointerCancel(event: React.PointerEvent) {
      releasePointer(event.currentTarget as Element, event.pointerId)
      startRef.current = null
      movedRef.current = false
      setDragging(false)
      setSnapPreview(null)
    },

    onKeyDown(event: React.KeyboardEvent) {
      if (!enabled) return
      const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP
      const delta =
        event.key === "ArrowLeft" ? { x: -step, y: 0 }
        : event.key === "ArrowRight" ? { x: step, y: 0 }
        : event.key === "ArrowUp" ? { x: 0, y: -step }
        : event.key === "ArrowDown" ? { x: 0, y: step }
        : null
      if (!delta) return
      event.preventDefault()

      const rect = elementRef.current?.getBoundingClientRect()
      if (!rect) return
      /* Nudging always produces a FREE placement, even out of a corner: someone
         pressing an arrow key is aiming, and snapping back would fight them. */
      const from = { x: rect.left, y: rect.top }
      commit({
        kind: "free",
        ...clampToViewport(
          { x: from.x + delta.x, y: from.y + delta.y },
          measure(),
          viewport()
        ),
      })
    },

    onDoubleClick() {
      if (!enabled) return
      commit(null)
    },
  }

  return {
    placement,
    dragging,
    snapPreview,
    settling,
    handleProps,
    reset: () => commit(null),
  }
}
