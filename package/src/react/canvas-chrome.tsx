"use client"

import * as React from "react"

import { suggest, warn } from "../core/index"
import { subscribeUrl } from "./bench-state"
import { type CanvasRow, type ResolvedFrame } from "./canvas-state"
import { MinusIcon, PlusIcon } from "./icons"
import { DEFAULT_TOOLS, type PageTools, usePageTools } from "./tools"

/* What the canvas draws over the product, in its own shadow root: the crop
 * marks and findings of every frame, the names of the rows and columns, and
 * the bar. The surface (canvas.tsx) positions all of it every frame; these
 * components only render it, and re-render when the URL or a store changes,
 * never when the camera moves. */

export interface Item {
  key: string
  row: CanvasRow
  frame?: ResolvedFrame
}

/* The zoom level, for the readout in the bar, outside React so a pinch does
   not re-render the frames. */
export function createZoomStore() {
  let z = 1
  const listeners = new Set<() => void>()
  return {
    get: () => z,
    set(next: number) {
      if (next === z) return
      z = next
      for (const listener of listeners) listener()
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
export type ZoomStore = ReturnType<typeof createZoomStore>

/* The frames that overflow, in reading order, for the bar's count. `null`
   until the first look, so the bar does not say "no overflow" before it has
   checked. */
export function createFindingsStore() {
  let keys: ReadonlyArray<string> | null = null
  const listeners = new Set<() => void>()
  return {
    get: () => keys,
    set(next: ReadonlyArray<string>) {
      if (keys && keys.length === next.length && keys.every((key, i) => key === next[i])) return
      keys = next
      for (const listener of listeners) listener()
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
export type FindingsStore = ReturnType<typeof createFindingsStore>

const readSearch = () => window.location.search
const noSearch = () => ""

export function CanvasOverlay({
  items,
  rows,
  frames,
  markRef,
  axisRef,
  ringRef,
  param,
  frameParam,
  onAxis,
  onWheel,
}: {
  items: ReadonlyArray<Item>
  rows: ReadonlyArray<CanvasRow>
  frames: ReadonlyArray<ResolvedFrame>
  markRef: (key: string) => (el: HTMLDivElement | null) => void
  axisRef: (key: string) => (el: HTMLButtonElement | null) => void
  ringRef: React.RefObject<HTMLDivElement | null>
  param: string
  frameParam: string
  onAxis: (axis: "state" | "frame", id: string) => void
  onWheel: (event: WheelEvent) => void
}) {
  const search = React.useSyncExternalStore(subscribeUrl, readSearch, noSearch)
  const params = new URLSearchParams(search)
  const state = params.get(param)
  const frame = params.get(frameParam)

  /* Say so when a link names a state or frame this canvas does not have. It
     lives here, not on the surface, so reading the URL never re-renders the
     frames. */
  React.useEffect(() => {
    const stateIds = rows.map((row) => row.id)
    const frameIds = frames.map((f) => f.id)
    if (state !== null && !stateIds.includes(state)) {
      warn(`?${param}=${state} is not a state of this canvas.${suggest(state, stateIds)} Known: ${stateIds.join(", ")}.`)
    }
    if (frame !== null && !frameIds.includes(frame)) {
      warn(`?${frameParam}=${frame} is not a frame of this canvas.${suggest(frame, frameIds)} Known: ${frameIds.join(", ")}.`)
    }
  }, [rows, frames, state, frame, param, frameParam])

  const rootRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.addEventListener("wheel", onWheel, { passive: false })
    return () => root.removeEventListener("wheel", onWheel)
  }, [onWheel])

  const isCurrent = (item: Item) =>
    (state === item.row.id && (frame === null || !item.frame || frame === item.frame.id)) ||
    (state === null && !!item.frame && frame === item.frame.id)

  return (
    <div ref={rootRef} className="pm-root pm-canvas-overlay">
      <div ref={ringRef} className="pm-canvas-ring" hidden />
      {items.map((item) => (
        <div
          key={item.key}
          ref={markRef(item.key)}
          className="pm-frame-marks"
          data-current={isCurrent(item) ? "true" : undefined}
          data-missing={item.row.missing ? "true" : undefined}
        >
          <span className="pm-crop pm-crop-tl" />
          <span className="pm-crop pm-crop-tr" />
          <span className="pm-crop pm-crop-bl" />
          <span className="pm-crop pm-crop-br" />
          <span className="pm-flag" hidden />
        </div>
      ))}
      <div role="group" aria-label="Frames">
        {frames.map((f) => (
          <button
            key={f.id}
            ref={axisRef(`col:${f.id}`)}
            type="button"
            className="pm-axis pm-axis-col"
            data-frame={f.id}
            aria-pressed={frame === f.id}
            title={f.note}
            onClick={() => onAxis("frame", f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div role="group" aria-label="States">
        {rows.map((row) => (
          <button
            key={row.id}
            ref={axisRef(`row:${row.id}`)}
            type="button"
            className="pm-axis pm-axis-row"
            data-state={row.id}
            data-missing={row.missing ? "true" : undefined}
            aria-pressed={state === row.id}
            title={row.note}
            onClick={() => onAxis("state", row.id)}
          >
            <span className="pm-axis-label">{row.label}</span>
            {row.missing ? <span className="pm-axis-note">Not in the code yet</span> : null}
          </button>
        ))}
      </div>
    </div>
  )
}

function ZoomReadout({ zoom, onClick }: { zoom: ZoomStore; onClick(): void }) {
  const percent = React.useSyncExternalStore(
    zoom.subscribe,
    () => Math.round(zoom.get() * 100),
    () => 100,
  )
  return (
    <button
      type="button"
      className="pm-switch pm-canvas-zoom"
      aria-label={`Zoom ${percent}%. Show at 100%`}
      title="Show at 100%"
      onClick={onClick}
    >
      {percent}%
    </button>
  )
}

/* The bar: the camera's controls, and two page tools that apply to every
   frame at once. It owns the tools' state, so toggling one re-renders the
   bar, not the frames. */
function FindingsCount({ findings, onClick }: { findings: FindingsStore; onClick(): void }) {
  const keys = React.useSyncExternalStore(findings.subscribe, findings.get, () => null)
  if (keys === null) return null
  const n = keys.length
  return (
    <>
      <span className="pm-switch-sep" aria-hidden="true" />
      <button
        type="button"
        className="pm-switch pm-canvas-findings"
        data-count={n}
        aria-label={
          n
            ? `${n} ${n === 1 ? "frame overflows or cuts off" : "frames overflow or cut off"} content. Show the next.`
            : "No frame overflows or cuts off content."
        }
        title={n ? "Show the next frame that overflows its container or cuts off content" : "Every frame fits its container"}
        aria-disabled={n ? undefined : true}
        onClick={() => {
          if (n) onClick()
        }}
      >
        {n ? `${n} overflowing` : "No overflow"}
      </button>
    </>
  )
}

export function CanvasBar({
  label,
  zoom,
  findings,
  onFinding,
  own,
  onZoomOut,
  onZoomIn,
  onActualSize,
  onFit,
}: {
  label: string
  zoom: ZoomStore
  findings: FindingsStore
  onFinding(): void
  own: Element | null
  onZoomOut(): void
  onZoomIn(): void
  onActualSize(): void
  onFit(): void
}) {
  const [tools, setTools] = React.useState<PageTools>(DEFAULT_TOOLS)
  usePageTools(tools, true, own)
  return (
    <div role="group" aria-label={`${label} canvas`} className="pm-root pm-switcher pm-switcher-bottom pm-canvas-bar" style={{ zIndex: 1 }}>
      <button type="button" className="pm-switch-icon" aria-label="Zoom out" title="Zoom out" onClick={onZoomOut}>
        <MinusIcon size={14} />
      </button>
      <ZoomReadout zoom={zoom} onClick={onActualSize} />
      <button type="button" className="pm-switch-icon" aria-label="Zoom in" title="Zoom in" onClick={onZoomIn}>
        <PlusIcon size={14} />
      </button>
      <button type="button" className="pm-switch" title="Show every frame" onClick={onFit}>
        Fit
      </button>
      <span className="pm-switch-sep" aria-hidden="true" />
      <button
        type="button"
        className="pm-switch"
        aria-pressed={tools.text === 2}
        title="Scale the page's root font size, as a browser text-size setting does"
        onClick={() => setTools((t) => ({ ...t, text: t.text === 2 ? 1 : 2 }))}
      >
        Text 200%
      </button>
      <button
        type="button"
        className="pm-switch"
        aria-pressed={tools.motion === "paused"}
        title="Stop CSS and Web Animations, so a skeleton holds still"
        onClick={() => setTools((t) => ({ ...t, motion: t.motion === "paused" ? "normal" : "paused" }))}
      >
        Pause motion
      </button>
      <FindingsCount findings={findings} onClick={onFinding} />
    </div>
  )
}
