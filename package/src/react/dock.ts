"use client"

import * as React from "react"

import {
  type Corner,
  type Point,
  type Size,
  blockNextClick,
  capturePointer,
  clampToViewport,
  dragOffset,
  dragStart,
  hasMoved,
  isDragTarget,
  releasePointer,
  snapTarget,
  type DragStart,
} from "./drag"

/* Where the state diagram lives.
 *
 * It used to be a modal overlay with a dimming backdrop, which was exactly
 * backwards: a diagram explaining a component cannot also be the thing hiding
 * it. It now docks to an edge by default, so the component stays visible AND
 * clickable, and can be pulled free when it is in the way.
 *
 * A full-height pane has no meaningful "corner" — its edge IS its anchor — so
 * an edge dock is what corner snapping means here. Free-floating panes still
 * snap to corners using the panel's own rule. */

export type DockMode = "left" | "right" | "free"

export type DockState =
  | { mode: "left" | "right"; width: number }
  | { mode: "free"; x: number; y: number; width: number; height: number }

/** Release this close to a side and the pane docks to it. */
export const EDGE_DISTANCE = 64

export const MIN_WIDTH = 320
export const MIN_HEIGHT = 240
/* A pane pulled off an edge keeps its width but NOT its full height: one that
   is still as tall as the viewport can only ever sit at the top, which makes
   floating pointless. */
export const FLOAT_HEIGHT_RATIO = 0.72
/** Leave enough of the app visible that docking is not just an overlay. */
export const MAX_WIDTH_RATIO = 0.92

const DOCK_SUFFIX = ":pm-diagram"

export function dockKey(storageKey: string): string {
  return `${storageKey}${DOCK_SUFFIX}`
}

export function clampWidth(width: number, viewportWidth: number): number {
  const max = Math.max(MIN_WIDTH, Math.floor(viewportWidth * MAX_WIDTH_RATIO))
  return Math.min(Math.max(Math.round(width), MIN_WIDTH), max)
}

export function floatHeight(currentHeight: number, viewportHeight: number): number {
  return Math.max(
    MIN_HEIGHT,
    Math.min(currentHeight, Math.round(viewportHeight * FLOAT_HEIGHT_RATIO))
  )
}

export function defaultWidth(viewportWidth: number): number {
  return clampWidth(Math.min(560, Math.floor(viewportWidth * 0.92)), viewportWidth)
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

export function readDock(storageKey: string): DockState | null {
  try {
    const raw = window.localStorage.getItem(dockKey(storageKey))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null
    const o = parsed as Record<string, unknown>

    if ((o.mode === "left" || o.mode === "right") && isNum(o.width)) {
      return { mode: o.mode, width: o.width }
    }
    if (
      o.mode === "free" &&
      isNum(o.x) && isNum(o.y) && isNum(o.width) && isNum(o.height)
    ) {
      return { mode: "free", x: o.x, y: o.y, width: o.width, height: o.height }
    }
    /* Storage outlives code. Anything else is dropped rather than trusted. */
    return null
  } catch {
    return null
  }
}

export function writeDock(storageKey: string, state: DockState | null): void {
  try {
    if (state) window.localStorage.setItem(dockKey(storageKey), JSON.stringify(state))
    else window.localStorage.removeItem(dockKey(storageKey))
  } catch {
    /* Private browsing, or a full quota. */
  }
}

/**
 * Which side a released pane should dock to, if any.
 *
 * Edge beats corner for a pane, so this is checked first: dropping a full-height
 * diagram in the "top-right corner" almost always means "put it down the right
 * side".
 */
export function edgeTarget(
  pos: Point,
  size: Size,
  viewport: Size,
  distance = EDGE_DISTANCE
): "left" | "right" | null {
  if (pos.x <= distance) return "left"
  if (viewport.width - (pos.x + size.width) <= distance) return "right"
  return null
}

export interface UseDockOptions {
  storageKey: string
  enabled: boolean
  defaultMode: DockMode
  elementRef: React.RefObject<HTMLElement | null>
}

export interface UseDockResult {
  state: DockState
  dragging: boolean
  resizing: boolean
  /** The edge a release right now would dock to. */
  edgePreview: "left" | "right" | null
  /** The corner a release right now would snap a FREE pane to. */
  snapPreview: Corner | null
  style: React.CSSProperties
  headerProps: {
    onPointerDown(event: React.PointerEvent): void
    onPointerMove(event: React.PointerEvent): void
    onPointerUp(event: React.PointerEvent): void
    onPointerCancel(event: React.PointerEvent): void
    onDoubleClick(): void
  }
  resizeProps: {
    onPointerDown(event: React.PointerEvent): void
    onPointerMove(event: React.PointerEvent): void
    onPointerUp(event: React.PointerEvent): void
    onPointerCancel(event: React.PointerEvent): void
  }
  dock(mode: "left" | "right"): void
}

const viewportOf = (): Size => ({ width: window.innerWidth, height: window.innerHeight })

export function useDock({
  storageKey,
  enabled,
  defaultMode,
  elementRef,
}: UseDockOptions): UseDockResult {
  const initial = (): DockState =>
    defaultMode === "free"
      ? { mode: "free", x: 48, y: 48, width: 560, height: 520 }
      : { mode: defaultMode, width: 560 }

  const [state, setState] = React.useState<DockState>(initial)
  const [dragging, setDragging] = React.useState(false)
  const [resizing, setResizing] = React.useState(false)
  const [edgePreview, setEdgePreview] = React.useState<"left" | "right" | null>(null)
  const [snapPreview, setSnapPreview] = React.useState<Corner | null>(null)

  const startRef = React.useRef<DragStart | null>(null)
  const movedRef = React.useRef(false)
  const resizeRef = React.useRef<{ pointerX: number; width: number } | null>(null)

  /* Restore after mount, never during render — localStorage does not exist on
     the server and the first client render has to match it. */
  React.useEffect(() => {
    if (!enabled) return
    const stored = readDock(storageKey)
    const view = viewportOf()
    if (stored) {
      setState(
        stored.mode === "free"
          ? { ...stored, width: clampWidth(stored.width, view.width) }
          : { ...stored, width: clampWidth(stored.width, view.width) }
      )
    } else if (defaultMode !== "free") {
      setState({ mode: defaultMode, width: defaultWidth(view.width) })
    }
  }, [enabled, storageKey, defaultMode])

  React.useEffect(() => {
    if (!enabled) return
    const onResize = () => {
      const view = viewportOf()
      setState((current) =>
        current.mode === "free"
          ? {
              ...current,
              ...clampToViewport(
                current,
                { width: current.width, height: current.height },
                view
              ),
              width: clampWidth(current.width, view.width),
            }
          : { ...current, width: clampWidth(current.width, view.width) }
      )
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [enabled])

  /* A docked pane publishes its width so a host that wants to reflow its own
     content clear of it can, rather than being overlaid. Opt-in on their side;
     the property simply exists while the pane is docked. */
  React.useEffect(() => {
    if (typeof document === "undefined" || state.mode === "free") return
    const name = state.mode === "left" ? "--pm-diagram-inset-left" : "--pm-diagram-inset-right"
    const root = document.documentElement
    root.style.setProperty(name, `${state.width}px`)
    return () => {
      root.style.removeProperty(name)
    }
  }, [state])

  const commit = (next: DockState) => {
    setState(next)
    writeDock(storageKey, next)
  }

  const measure = (): Size => {
    const rect = elementRef.current?.getBoundingClientRect()
    return { width: rect?.width ?? state.width, height: rect?.height ?? 0 }
  }

  const headerProps = {
    onPointerDown(event: React.PointerEvent) {
      if (!enabled) return
      if (event.button !== 0 || event.ctrlKey) return
      if (!isDragTarget(event.target, event.currentTarget as Element)) return
      const rect = elementRef.current?.getBoundingClientRect()
      if (!rect) return
      startRef.current = dragStart({ x: event.clientX, y: event.clientY }, rect)
      movedRef.current = false
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
        /* The first real movement undocks it. Until then a stray pointerdown on
           the header is just a click on the header. */
        const rect = elementRef.current?.getBoundingClientRect()
        setState((current) =>
          current.mode === "free"
            ? current
            : {
                mode: "free",
                x: rect?.left ?? 0,
                y: rect?.top ?? 0,
                width: current.width,
                height: floatHeight(rect?.height ?? 520, window.innerHeight),
              }
        )
      }

      const view = viewportOf()
      const size = measure()
      const next = clampToViewport(dragOffset(start, pointer), size, view)
      setState((current) =>
        current.mode === "free" ? { ...current, ...next } : current
      )
      const edge = edgeTarget(next, size, view)
      setEdgePreview(edge)
      setSnapPreview(edge ? null : snapTarget(next, size, view))
    },

    onPointerUp(event: React.PointerEvent) {
      const el = event.currentTarget as Element
      releasePointer(el, event.pointerId)
      if (!startRef.current) return
      startRef.current = null
      if (!movedRef.current) return

      movedRef.current = false
      setDragging(false)
      setEdgePreview(null)
      setSnapPreview(null)
      blockNextClick(el)

      const view = viewportOf()
      const size = measure()
      setState((current) => {
        if (current.mode !== "free") return current
        const edge = edgeTarget(current, size, view)
        if (edge) {
          const next: DockState = { mode: edge, width: clampWidth(current.width, view.width) }
          writeDock(storageKey, next)
          return next
        }
        const corner = snapTarget(current, size, view)
        const next: DockState = corner
          ? {
              ...current,
              ...cornerFor(corner, size, view),
            }
          : current
        writeDock(storageKey, next)
        return next
      })
    },

    onPointerCancel(event: React.PointerEvent) {
      releasePointer(event.currentTarget as Element, event.pointerId)
      startRef.current = null
      movedRef.current = false
      setDragging(false)
      setEdgePreview(null)
      setSnapPreview(null)
    },

    onDoubleClick() {
      if (!enabled) return
      const view = viewportOf()
      commit(
        defaultMode === "free"
          ? { mode: "free", x: 48, y: 48, width: defaultWidth(view.width), height: 520 }
          : { mode: defaultMode, width: defaultWidth(view.width) }
      )
    },
  }

  const resizeProps = {
    onPointerDown(event: React.PointerEvent) {
      if (!enabled) return
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      resizeRef.current = { pointerX: event.clientX, width: state.width }
      setResizing(true)
      capturePointer(event.currentTarget as Element, event.pointerId)
    },

    onPointerMove(event: React.PointerEvent) {
      const start = resizeRef.current
      if (!start) return
      /* A right-hand dock grows as the pointer moves LEFT, which is why the
         delta is signed by the side rather than taken as an absolute. */
      const delta =
        state.mode === "left" ? event.clientX - start.pointerX : start.pointerX - event.clientX
      setState((current) => ({
        ...current,
        width: clampWidth(start.width + delta, window.innerWidth),
      }))
    },

    onPointerUp(event: React.PointerEvent) {
      releasePointer(event.currentTarget as Element, event.pointerId)
      if (!resizeRef.current) return
      resizeRef.current = null
      setResizing(false)
      setState((current) => {
        writeDock(storageKey, current)
        return current
      })
    },

    onPointerCancel(event: React.PointerEvent) {
      releasePointer(event.currentTarget as Element, event.pointerId)
      resizeRef.current = null
      setResizing(false)
    },
  }

  const style: React.CSSProperties =
    state.mode === "free"
      ? {
          top: state.y,
          left: state.x,
          right: "auto",
          bottom: "auto",
          width: state.width,
          height: state.height,
        }
      : {
          top: 0,
          bottom: 0,
          height: "auto",
          width: state.width,
          ...(state.mode === "left" ? { left: 0, right: "auto" } : { right: 0, left: "auto" }),
        }

  return {
    state,
    dragging,
    resizing,
    edgePreview,
    snapPreview,
    style,
    headerProps,
    resizeProps,
    dock: (mode) => commit({ mode, width: clampWidth(state.width, window.innerWidth) }),
  }
}

/* Local rather than imported: the panel's cornerPosition uses the 16px inset the
   `pm-<corner>` classes use, and a pane that size wants the same treatment. */
function cornerFor(corner: Corner, size: Size, viewport: Size): Point {
  const pad = 16
  const right = viewport.width - size.width - pad
  const bottom = viewport.height - size.height - pad
  switch (corner) {
    case "top-left":     return { x: pad,   y: pad }
    case "top-right":    return { x: right, y: pad }
    case "bottom-left":  return { x: pad,   y: bottom }
    case "bottom-right": return { x: right, y: bottom }
  }
}
