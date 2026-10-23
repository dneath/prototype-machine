"use client"

import * as React from "react"

import { ScenarioError } from "../core/index"
import { type BenchStateDef, type BenchStates, checkStates, cssLength, labelOf, noteOf } from "./bench-state"

/* A state canvas: one component in every state at once, each state in every
 * frame, on one surface.
 *
 * A row is a state of the component. A column is a FRAME: a condition the
 * component is put in from outside, without touching it. A width, a sibling
 * that squeezes it, a text direction, an attribute a stylesheet reads. Frames
 * are how one config shows the 320px phone, the sidebar that steals 40% and
 * the Arabic locale beside the layout as designed.
 *
 * This file is the part the production build keeps: validation, frames, and
 * the grid of real components. The camera, the labels and the bar are in
 * canvas.tsx, which the production entry does not import. */

/** The search parameter naming the frame to focus. The state uses `__state`. */
export const FRAME_PARAM = "__frame"

/** How wide frames are when the canvas is given no `width`: a laptop screen. */
export const DEFAULT_CANVAS_WIDTH = 1280

export interface CanvasFrameDef extends BenchStateDef {
  /** The container's width. A number is pixels; a string is any CSS length but a percentage. Defaults to the canvas `width`. */
  width?: number | string
  /** The frame is at least this tall: for a whole screen, the viewport height it is designed for. */
  minHeight?: number | string
  /** Text direction inside the frame, as a locale would set it. */
  dir?: "ltr" | "rtl"
  /**
   * Attributes set on the frame's container, for CSS that reads them:
   * `{ "data-theme": "dark" }`, or `{ class: "dark" }` for Tailwind's class strategy.
   * Selectors that start at `:root` or `html` cannot see them.
   */
  attrs?: Record<string, string>
  /** The frame's background. Defaults to the page's own. A dark-theme frame usually needs the theme's background here. */
  background?: string
  /**
   * Room a sibling takes from the container, as a sidebar beside it in a flex
   * row would. A number is pixels. The component gets the rest, unless its
   * content refuses to shrink, which is the finding.
   */
  squeeze?: number | string
}

export type CanvasFrames = Record<string, string | CanvasFrameDef>

export interface StateCanvasProps<T extends BenchStates, F extends CanvasFrames = CanvasFrames> {
  /** Every state the component can be in, one row each, in this order. The same shape `StateBench` takes. */
  states: T
  /** States the design shows but the code cannot reach. Each gets a row with a placeholder, never a render. */
  missing?: BenchStates
  /**
   * The columns: conditions every state is shown in. `"stress"` is the built-in
   * set: as wide as production, 320px, squeezed by a sibling, very wide, and
   * right to left. Default: one frame, as wide as `width`.
   */
  frames?: F | "stress"
  /** As wide as the component is in production. The width of any frame that names none. Default 1280. */
  width?: number | string
  /** The accessible name of the canvas and its controls. Default `"States"`. */
  label?: string
  /** The search parameter naming the state to focus. Default `"__state"`. */
  param?: string
  /** The search parameter naming the frame to focus. Default `"__frame"`. */
  frameParam?: string
  /** Stacking order of the canvas's labels and bar. The surface sits just below. Default 2147483000. */
  zIndex?: number
  /** Nonce for the injected <style>, for a strict Content-Security-Policy. */
  nonce?: string
  /** Whether the canvas mounts. Off, every frame renders in a plain grid with no camera or labels. Defaults to "not a production build". */
  enabled?: boolean
  /** Renders the real component in one state, in one frame. Called once for each pair. */
  children: (state: keyof T & string, frame: keyof F & string) => React.ReactNode
}

export interface ResolvedFrame {
  id: string
  label: string
  note?: string
  /** A CSS length. */
  width: string
  minHeight?: string
  dir?: "ltr" | "rtl"
  attrs?: Record<string, string>
  background?: string
  /** A CSS length. */
  squeeze?: string
}

export interface CanvasRow {
  id: string
  label: string
  note?: string
  missing: boolean
}

/**
 * The built-in stress frames for a component as wide as `width`. Each is
 * something real layouts do to a component it did not plan for.
 */
export function stressFrames(width: number | string = DEFAULT_CANVAS_WIDTH): Record<string, CanvasFrameDef> {
  const css = cssLength(width)!
  const numeric = typeof width === "number"
  const wide = numeric ? Math.max(1440, Math.round(width * 1.5)) : `max(1440px, calc(${css} * 1.5))`
  const frames: Record<string, CanvasFrameDef> = {
    shipped: { label: numeric ? `${width}px` : css, note: "As wide as it is in production" },
  }
  /* A component designed narrower than a phone has no phone frame to fail. */
  if (!numeric || width > 320) {
    frames.narrow = { label: "320px", width: 320, note: "The narrowest phone in common use" }
  }
  frames.squeezed = {
    label: "Squeezed",
    squeeze: numeric ? Math.round(width * 0.4) : `calc(${css} * 0.4)`,
    note: "A sibling takes 40% of the row, as a sidebar would. The component gets the rest, unless its content will not shrink.",
  }
  frames.wide = { label: numeric ? `${wide}px` : "Wide", width: wide, note: "A container much wider than designed" }
  frames.rtl = { label: "Right to left", dir: "rtl", note: 'dir="rtl" on the container, as an Arabic or Hebrew locale sets it' }
  return frames
}

function length(where: string, value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined
  if (typeof value === "string" && value.trim().endsWith("%")) {
    throw new ScenarioError(
      `${where} is "${value}". A frame's sizes are lengths, such as 880 or "48rem": on a canvas, a percentage has nothing to be a percentage of.`,
    )
  }
  if (typeof value === "number" && !(value > 0)) {
    throw new ScenarioError(`${where} is ${value}. Use a length above zero.`)
  }
  return cssLength(value)
}

/** The canvas's frames, resolved to CSS and checked. */
export function resolveFrames(frames: CanvasFrames | "stress" | undefined, width?: number | string): ResolvedFrame[] {
  const base = width ?? DEFAULT_CANVAS_WIDTH
  const baseCss = length("The canvas's width", base)!
  const defs: CanvasFrames = frames === "stress" ? stressFrames(base) : (frames ?? { default: { label: labelForWidth(base) } })
  const entries = Object.entries(defs)
  if (!entries.length) {
    throw new ScenarioError(`<StateCanvas> was given no frames. Leave \`frames\` out for one frame, or pass "stress".`)
  }
  return entries.map(([id, raw]) => {
    const def: CanvasFrameDef = typeof raw === "string" ? { label: raw } : raw
    const label = labelOf(id, def)
    if (label.trim() === "") throw new ScenarioError(`<StateCanvas> frame "${id}" has an empty label.`)
    const where = `Frame "${id}"`
    return {
      id,
      label,
      note: noteOf(def),
      width: length(`${where}'s width`, def.width) ?? baseCss,
      minHeight: length(`${where}'s minHeight`, def.minHeight),
      dir: def.dir,
      attrs: def.attrs,
      background: def.background,
      squeeze: length(`${where}'s squeeze`, def.squeeze),
    }
  })
}

function labelForWidth(width: number | string): string {
  return typeof width === "number" ? `${width}px` : width
}

/** Validate a canvas's config: the rows, then the frames. Shared by the
 *  development and production canvases. */
export function useCanvasConfig<T extends BenchStates, F extends CanvasFrames>(props: StateCanvasProps<T, F>) {
  checkStates("StateCanvas", props.states, props.missing)
  /* Keyed on what the config says rather than on its objects, so states and
     frames written inline do not rebuild the grid, and re-render every
     component on it, on every render. */
  const rowSignature = JSON.stringify([props.states, props.missing ?? {}])
  const rows = React.useMemo<CanvasRow[]>(
    () => [
      ...Object.entries(props.states).map(([id, def]) => ({ id, label: labelOf(id, def), note: noteOf(def), missing: false })),
      ...Object.entries(props.missing ?? {}).map(([id, def]) => ({ id, label: labelOf(id, def), note: noteOf(def), missing: true })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowSignature],
  )
  const frameSignature = props.frames === "stress" || props.frames === undefined ? String(props.frames) : JSON.stringify(props.frames)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const frames = React.useMemo(() => resolveFrames(props.frames, props.width), [frameSignature, props.width])
  return { rows, frames }
}

/* A plain effect on the server, where React 18 warns about layout effects. */
const useClientLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

/* Mirror a frame's `attrs` onto its container, putting back whatever was
   there before when they change. Done by hand rather than as JSX props, so a
   name React has opinions about (`class`) means exactly what it says. */
function useAttributes(el: React.RefObject<HTMLElement | null>, attrs: Record<string, string> | undefined) {
  const signature = attrs ? JSON.stringify(attrs) : ""
  useClientLayoutEffect(() => {
    const node = el.current
    if (!node || !attrs) return
    const before: Array<[string, string | null]> = []
    for (const [name, value] of Object.entries(attrs)) {
      try {
        before.push([name, node.getAttribute(name)])
        node.setAttribute(name, value)
      } catch {
        throw new ScenarioError(`A frame's attrs include "${name}", which is not a valid attribute name.`)
      }
    }
    return () => {
      for (const [name, value] of before.reverse()) {
        if (value === null) node.removeAttribute(name)
        else node.setAttribute(name, value)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el, signature])
}

/* The sibling a squeezed frame gets: scaffolding, so it is hatched in the
   tools' accent and plainly not part of the product. */
const SQUEEZE_STYLE: React.CSSProperties = {
  flex: "none",
  alignSelf: "stretch",
  minHeight: 48,
  background:
    "repeating-linear-gradient(-45deg, rgba(139, 61, 255, 0.22) 0 2px, transparent 2px 9px)",
  boxShadow: "inset 0 0 0 1px rgba(139, 61, 255, 0.45)",
}

const ISOLATE: React.CSSProperties = { all: "initial" } as React.CSSProperties
const SYSTEM_FONT = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`

/**
 * One state in one frame: a container as the frame describes, and the real
 * component in it. The container sets its size, its direction, its
 * attributes and the page's background. Nothing else, so the component looks
 * the way the app makes it look.
 *
 * `contain: layout` makes it the containing block for anything the component
 * fixes in place, so a modal's backdrop covers its own frame rather than the
 * whole canvas. It does not clip: content that overflows the frame is shown
 * overflowing, because that is a finding.
 */
export function CanvasCell({
  row,
  frame,
  background,
  children,
  cellRef,
}: {
  row: CanvasRow
  frame: ResolvedFrame
  background: string
  children: React.ReactNode
  cellRef?: (el: HTMLDivElement | null) => void
}) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  useAttributes(ref, frame.attrs)
  const setRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el
      cellRef?.(el)
    },
    [cellRef],
  )
  const style: React.CSSProperties = {
    position: "relative",
    boxSizing: "border-box",
    width: frame.width,
    minHeight: frame.minHeight,
    background: frame.background ?? background,
    contain: "layout",
  }
  if (frame.squeeze) {
    style.display = "flex"
    style.alignItems = "flex-start"
  }
  return (
    <div
      ref={setRef}
      data-state-canvas-frame=""
      data-state={row.id}
      data-frame={frame.id}
      role="group"
      aria-label={`${row.label}, ${frame.label}`}
      dir={frame.dir}
      style={style}
    >
      {frame.squeeze ? (
        <>
          {/* A flex item keeps its content's minimum width, as it would in
              the app: a long unbroken string pushes past the squeeze. */}
          <div data-state-canvas-squeezed="" style={{ flex: "1 1 0%" }}>
            {children}
          </div>
          <div aria-hidden="true" data-state-canvas-sibling="" style={{ ...SQUEEZE_STYLE, width: frame.squeeze }} />
        </>
      ) : (
        children
      )}
    </div>
  )
}

/**
 * A state the code cannot reach: a row with a placeholder that says so and
 * never renders the component. `tone` is the canvas's dark surface or the
 * page's own, in the plain grid.
 */
export function MissingCell({
  row,
  width,
  tone,
  cellRef,
}: {
  row: CanvasRow
  width: string
  tone: "canvas" | "page"
  cellRef?: (el: HTMLDivElement | null) => void
}) {
  const ink = tone === "canvas" ? "rgba(255, 255, 255, 0.72)" : "currentColor"
  return (
    <div
      ref={cellRef}
      data-state-canvas-missing=""
      data-state={row.id}
      role="group"
      aria-label={`${row.label}, not in the code yet`}
      style={{
        ...ISOLATE,
        gridColumn: "1 / -1",
        justifySelf: "start",
        display: "grid",
        alignContent: "center",
        gap: 6,
        boxSizing: "border-box",
        width,
        minHeight: 180,
        padding: 32,
        border: `1px dashed ${tone === "canvas" ? "rgba(255, 255, 255, 0.35)" : "currentColor"}`,
        color: ink,
        opacity: tone === "canvas" ? 1 : 0.7,
        font: `400 15px/1.45 ${SYSTEM_FONT}`,
        textAlign: "center",
      }}
    >
      <span style={{ ...ISOLATE, color: ink, font: `600 15px/1.45 ${SYSTEM_FONT}` }}>Not in the code yet</span>
      {row.note ? <span style={{ ...ISOLATE, color: ink, font: `400 14px/1.45 ${SYSTEM_FONT}` }}>{row.note}</span> : null}
    </div>
  )
}

/** Space between frames, in world pixels: room above each for its label. */
export const ROW_GAP = 144
export const COLUMN_GAP = 96

/** The grid: a row per state, a column per frame, missing rows last. */
export function CanvasGrid<T extends BenchStates, F extends CanvasFrames>({
  rows,
  frames,
  background,
  tone,
  render,
  gridRef,
  cellRef,
  style,
}: {
  rows: ReadonlyArray<CanvasRow>
  frames: ReadonlyArray<ResolvedFrame>
  background: string
  tone: "canvas" | "page"
  render: StateCanvasProps<T, F>["children"]
  gridRef?: React.Ref<HTMLDivElement>
  cellRef?: (key: string) => (el: HTMLDivElement | null) => void
  style?: React.CSSProperties
}) {
  return (
    <div
      ref={gridRef}
      data-state-canvas=""
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${frames.length}, max-content)`,
        gap: `${ROW_GAP}px ${COLUMN_GAP}px`,
        alignItems: "start",
        width: "max-content",
        ...style,
      }}
    >
      {rows.map((row) =>
        row.missing ? (
          <MissingCell key={row.id} row={row} width={frames[0].width} tone={tone} cellRef={cellRef?.(cellKey(row.id))} />
        ) : (
          frames.map((frame) => (
            <CanvasCell
              key={cellKey(row.id, frame.id)}
              row={row}
              frame={frame}
              background={background}
              cellRef={cellRef?.(cellKey(row.id, frame.id))}
            >
              {render(row.id as keyof T & string, frame.id as keyof F & string)}
            </CanvasCell>
          ))
        ),
      )}
    </div>
  )
}

/** The key a cell is known by: its state, and its frame unless it is a missing row. */
export function cellKey(state: string, frame?: string): string {
  return frame === undefined ? state : `${state}\u0000${frame}`
}

/* The page's own background, so a frame looks like the page the component
   lives on. Read after mount: the server cannot know it. */
export function usePageBackground(): string {
  const [background, setBackground] = React.useState("Canvas")
  React.useEffect(() => {
    for (const el of [document.body, document.documentElement]) {
      if (!el) continue
      const color = getComputedStyle(el).backgroundColor
      if (color && color !== "transparent" && !/^rgba\(.*,\s*0\)$/.test(color)) {
        setBackground(color)
        return
      }
    }
  }, [])
  return background
}

/**
 * Every frame in a plain grid, unscaled, with no camera, labels or bar: what
 * the canvas renders when it is not enabled, and what the production build
 * renders. Each frame still carries its `aria-label` and data attributes.
 */
export function FlatCanvas<T extends BenchStates, F extends CanvasFrames>(props: StateCanvasProps<T, F>) {
  const { rows, frames } = useCanvasConfig(props)
  const background = usePageBackground()
  return (
    <CanvasGrid
      rows={rows}
      frames={frames}
      background={background}
      tone="page"
      render={props.children}
      style={{ gap: "48px 32px" }}
    />
  )
}
