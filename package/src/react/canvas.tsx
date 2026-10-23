"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { isDev } from "../core/index"
import { type BenchStates, STATE_PARAM, subscribeUrl, writeSearchParams } from "./bench-state"
import {
  between,
  type Camera,
  fit,
  panBy,
  type Rect,
  reveal,
  sanitizeCamera,
  stepZoom,
  toScreen,
  union,
  zoomAt,
} from "./camera"
import { CanvasBar, CanvasOverlay, createFindingsStore, createZoomStore, type Item } from "./canvas-chrome"
import { useCanvasGestures } from "./canvas-gestures"
import {
  CanvasGrid,
  type CanvasFrames,
  cellKey,
  COLUMN_GAP,
  FlatCanvas,
  FRAME_PARAM,
  ROW_GAP,
  type StateCanvasProps,
  useCanvasConfig,
  usePageBackground,
} from "./canvas-state"
import { describeOverflow, inspectOverflow, type Overflow } from "./overflow"
import { TOP_Z_INDEX, useShadowLayer } from "./shadow"

/* The canvas surface: the grid of real components under a camera, with crop
 * marks for every frame, the names of its rows and columns, and a bar.
 *
 * The frames are the product's. They render in the page's light DOM, inherit
 * the page's fonts and colours, and are moved only by a transform on the
 * world that holds them. Everything the canvas adds is in its own shadow
 * root (canvas-chrome.tsx), drawn in screen space so it stays the same size
 * at any zoom. Gestures are in canvas-gestures.ts.
 *
 * A camera move never re-renders a component. The camera lives in a ref, and
 * one animation frame applies it: the world's transform, then a transform for
 * each frame's marks. React renders the frames when their props change, and
 * at no other time. */

/** Room the fit leaves at each edge: the frame names above, the bar below.
 *  The left edge also makes room for the widest state name. */
const FIT_INSETS = { top: 72, right: 48, bottom: 104, left: 48 }
/** Room kept clear when focus moves to something off screen. */
const REVEAL_INSETS = { top: 56, right: 32, bottom: 96, left: 32 }
const FLIGHT_MS = 280
const PAN_STEP = 80
/* The axes: state names down the left, frame names along the top, like the
   headers of a spreadsheet, and frozen the same way. Zoomed into one frame,
   its state and frame are still named at the edges of the screen. */
const AXIS_EDGE = 12
const AXIS_HEIGHT = 24
const AXIS_GAP = 12
/** Row names stop here, below the band the frame names stick to. */
const COLUMN_BAND = AXIS_EDGE + AXIS_HEIGHT + 8
/** Until the overlay has measured them, row names are assumed this wide. */
const ROW_AXIS_GUESS = 120
const SURFACE = "#0e0e0e"
const HINT =
  "Drag empty space or scroll to move. Pinch, or hold Control or Command and scroll, to zoom. With the canvas focused, arrow keys move, plus and minus zoom, 1 fits every frame and 0 is 100%."

const SR_ONLY: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
}

const useClientLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

/**
 * Every state of one component at once: a row per state, a column per frame,
 * on a surface you pan and zoom. The same `states`, `missing` and fixtures a
 * `StateBench` takes, so one folder can hold both.
 *
 * ```tsx
 * <StateCanvas states={STATES} missing={MISSING} width={880} frames="stress" label="Request log">
 *   {(state) => <RequestLog {...FIXTURES[state]} />}
 * </StateCanvas>
 * ```
 *
 * `?__state=empty` opens it on that row; `&__frame=narrow` on one frame.
 */
export function StateCanvas<T extends BenchStates, F extends CanvasFrames = CanvasFrames>(props: StateCanvasProps<T, F>) {
  return (props.enabled ?? isDev) ? <CanvasSurface {...props} /> : <FlatCanvas {...props} />
}

function setAttr(el: Element, name: string, value: string | null) {
  if (value === null) {
    if (el.hasAttribute(name)) el.removeAttribute(name)
  } else if (el.getAttribute(name) !== value) {
    el.setAttribute(name, value)
  }
}


function CanvasSurface<T extends BenchStates, F extends CanvasFrames>(props: StateCanvasProps<T, F>) {
  const {
    label = "States",
    param = STATE_PARAM,
    frameParam = FRAME_PARAM,
    zIndex = TOP_Z_INDEX,
    nonce,
    children,
  } = props
  const { rows, frames } = useCanvasConfig(props)
  const background = usePageBackground()
  const layer = useShadowLayer(true, zIndex, nonce, "canvas")
  const hintId = React.useId()

  const viewportRef = React.useRef<HTMLDivElement>(null)
  const worldRef = React.useRef<HTMLDivElement>(null)
  const ringRef = React.useRef<HTMLDivElement>(null)
  const camera = React.useRef<Camera>({ x: 0, y: 0, z: 1 })
  const zoom = React.useState(createZoomStore)[0]
  const findings = React.useState(createFindingsStore)[0]
  const inspecting = React.useRef(0)
  /* "fit" and "focus" follow the content as it settles (fonts, images, a text
     size change); "user" stays where it was put. */
  const mode = React.useRef<"fit" | "focus" | "user">("fit")
  const rects = React.useRef(new Map<string, Rect>())
  const cells = React.useRef(new Map<string, HTMLElement>())
  const marks = React.useRef(new Map<string, HTMLElement>())
  const axes = React.useRef(new Map<string, HTMLElement>())
  const axisWidths = React.useRef(new Map<string, number>())
  /* Where each column and row is in the world, from the cells' rects. */
  const layout = React.useRef({
    columns: new Map<string, { x: number; width: number }>(),
    rows: new Map<string, { y: number; height: number }>(),
    box: null as Rect | null,
  })
  const observer = React.useRef<ResizeObserver | null>(null)
  const painting = React.useRef(0)
  const flight = React.useRef(0)
  const saving = React.useRef(0)
  const storageKey = React.useRef("")
  const focused = React.useRef("")

  /* The api below is made once; it reads the latest props through this. */
  const latest = React.useRef({ rows, frames, param, frameParam })
  latest.current = { rows, frames, param, frameParam }
  /* Set by the gesture effect, so a wheel over a name in the overlay moves
     the canvas too. */
  const wheelTarget = React.useRef<((event: WheelEvent) => void) | null>(null)

  const items = React.useMemo<Item[]>(
    () =>
      rows.flatMap((row) =>
        row.missing
          ? [{ key: cellKey(row.id), row }]
          : frames.map((frame) => ({ key: cellKey(row.id, frame.id), row, frame })),
      ),
    [rows, frames],
  )

  /* Everything below reads refs, so these are made once and never go stale. */
  const api = React.useMemo(() => {
    const size = () => ({
      width: viewportRef.current?.clientWidth ?? 0,
      height: viewportRef.current?.clientHeight ?? 0,
    })

    const measure = () => {
      const next = new Map<string, Rect>()
      for (const [key, el] of cells.current) {
        next.set(key, { x: el.offsetLeft, y: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight })
      }
      rects.current = next
      const { rows, frames } = latest.current
      const columns = new Map<string, { x: number; width: number }>()
      for (const frame of frames) {
        const cell = rows.find((row) => !row.missing && next.has(cellKey(row.id, frame.id)))
        const rect = cell && next.get(cellKey(cell.id, frame.id))
        if (rect) columns.set(frame.id, { x: rect.x, width: rect.width })
      }
      const rowBoxes = new Map<string, { y: number; height: number }>()
      for (const row of rows) {
        const box = union(rowRects(row.id))
        if (box) rowBoxes.set(row.id, { y: box.y, height: box.height })
      }
      layout.current = { columns, rows: rowBoxes, box: union([...next.values()]) }
      inspectSoon()
    }

    /* Look for overflow once the layout has settled, not on every resize
       callback. Every read comes before any write, so it costs one layout. */
    function inspectSoon() {
      window.clearTimeout(inspecting.current)
      inspecting.current = window.setTimeout(inspect, 200)
    }

    function inspect() {
      inspecting.current = 0
      const { rows, frames } = latest.current
      const results: Array<[string, HTMLElement, Overflow]> = []
      for (const row of rows) {
        if (row.missing) continue
        for (const frame of frames) {
          const key = cellKey(row.id, frame.id)
          const el = cells.current.get(key)
          if (el) results.push([key, el, inspectOverflow(el)])
        }
      }
      const flagged: string[] = []
      for (const [key, el, found] of results) {
        setAttr(el, "data-overflow", found.spill ? String(found.spill) : null)
        setAttr(el, "data-clipped", found.clipped ? String(found.clipped) : null)
        const text = describeOverflow(found)
        if (text) flagged.push(key)
        const mark = marks.current.get(key)
        if (mark) {
          setAttr(mark, "data-overflow", text ? "true" : null)
          const flag = mark.lastElementChild as HTMLElement | null
          if (flag && flag.textContent !== text) flag.textContent = text
        }
      }
      findings.set(flagged)
      paint()
    }

    const rowRects = (state: string): Rect[] => {
      const { rows, frames } = latest.current
      const row = rows.find((r) => r.id === state)
      if (!row) return []
      const keys = row.missing ? [cellKey(row.id)] : frames.map((f) => cellKey(row.id, f.id))
      return keys.map((key) => rects.current.get(key)).filter((r): r is Rect => !!r)
    }

    const columnRects = (frame: string): Rect[] =>
      latest.current.rows
        .filter((row) => !row.missing)
        .map((row) => rects.current.get(cellKey(row.id, frame)))
        .filter((r): r is Rect => !!r)

    /* The widest state name, so a fit leaves room for the names to its left,
       but never more than a third of a narrow screen: past that, the names
       are frozen over the frames, which their slabs are drawn for. */
    const insets = () => {
      let widest = 0
      for (const [key, width] of axisWidths.current) if (key.startsWith("row:")) widest = Math.max(widest, width)
      const wanted = (widest || ROW_AXIS_GUESS) + AXIS_EDGE + AXIS_GAP
      return { ...FIT_INSETS, left: Math.max(FIT_INSETS.left, Math.min(wanted, size().width * 0.3)) }
    }

    const paintNow = () => {
      painting.current = 0
      const world = worldRef.current
      if (!world) return
      const cam = camera.current
      /* Whole pixels at 100%, so text is not resampled at rest. */
      const x = cam.z === 1 ? Math.round(cam.x) : cam.x
      const y = cam.z === 1 ? Math.round(cam.y) : cam.y
      world.style.transform = `translate(${x}px, ${y}px) scale(${cam.z})`
      const view = { x, y, z: cam.z }
      const { width, height } = size()
      const show = (el: HTMLElement, on: boolean) => {
        if (el.hidden === on) el.hidden = !on
        return on
      }

      /* Crop marks shrink with the gaps between frames, so at an overview
         they mark corners instead of hatching the whole surface. */
      const k = Math.min(1, Math.max(0.3, (Math.min(ROW_GAP, COLUMN_GAP) * cam.z) / 40))
      for (const [key, el] of marks.current) {
        const rect = rects.current.get(key)
        if (!rect) continue
        const s = toScreen(view, rect)
        const onScreen = s.width >= 4 && s.x + s.width > -32 && s.x < width + 32 && s.y + s.height > -32 && s.y < height + 32
        if (!show(el, onScreen)) continue
        el.style.transform = `translate(${s.x}px, ${s.y}px)`
        const [tl, tr, bl, br, flag] = Array.from(el.children) as HTMLElement[]
        /* A finding keeps its marks big enough to see from the overview. */
        const m = flag?.textContent ? Math.max(k, 0.75) : k
        tl.style.transform = `translate(-16px, -16px) scale(${m})`
        tr.style.transform = `translate(${s.width}px, -16px) scale(${m})`
        bl.style.transform = `translate(-16px, ${s.height}px) scale(${m})`
        br.style.transform = `translate(${s.width}px, ${s.height}px) scale(${m})`
        /* The finding sits under the frame's right edge, in the gap, when
           the gap has room for it. The amber marks say it at any zoom. */
        if (flag && show(flag, !!flag.textContent && ROW_GAP * cam.z >= 32 && s.width >= 64)) {
          flag.style.transform = `translate(${s.width}px, ${s.height + 8}px) translateX(-100%)`
        }
      }

      /* The axes. A name is measured once, the first time it is drawn. Names
         that would land on the one before give way, in reading order, so a
         far-out overview shows every other row rather than a pile; a name
         that is the focus always shows. */
      const box = layout.current.box && toScreen(view, layout.current.box)
      let measured = false
      const widthOf = (key: string, el: HTMLElement) => {
        let w = axisWidths.current.get(key)
        if (w === undefined || w === 0) {
          w = el.offsetWidth
          axisWidths.current.set(key, w)
          if (w) measured = true
        }
        return w
      }
      const pressed = (el: HTMLElement) => el.getAttribute("aria-pressed") === "true"
      const { rows, frames } = latest.current

      let lastRight = -Infinity
      for (const frame of frames) {
        const el = axes.current.get(`col:${frame.id}`)
        if (!el) continue
        const column = layout.current.columns.get(frame.id)
        if (!box || !column) {
          show(el, false)
          continue
        }
        const left = column.x * cam.z + x
        const right = left + column.width * cam.z
        if (!show(el, right > 0 && left < width && box.y + box.height > COLUMN_BAND && box.y < height)) continue
        const room = Math.max(56, Math.round(column.width * cam.z + COLUMN_GAP * cam.z - 8))
        const w = Math.min(widthOf(`col:${frame.id}`, el), room)
        /* Frozen to the top, and slid along its column while the column's
           start is off the left edge. */
        const ax = Math.max(left, Math.min(AXIS_EDGE, right - w))
        const ay = Math.max(AXIS_EDGE, box.y - AXIS_HEIGHT - AXIS_GAP)
        if (!show(el, ax >= lastRight + 2 || pressed(el))) continue
        lastRight = ax + w
        el.style.maxWidth = `${room}px`
        el.style.transform = `translate(${ax}px, ${ay}px)`
      }

      let lastBottom = -Infinity
      for (const row of rows) {
        const el = axes.current.get(`row:${row.id}`)
        if (!el) continue
        const extent = layout.current.rows.get(row.id)
        if (!box || !extent) {
          show(el, false)
          continue
        }
        const top = extent.y * cam.z + y
        const bottom = top + extent.height * cam.z
        if (!show(el, bottom > COLUMN_BAND + 8 && top < height && box.x + box.width > 0 && box.x < width)) continue
        const w = widthOf(`row:${row.id}`, el)
        /* Frozen to the left edge, and to the top of its row while the row's
           top is above the screen. */
        const ax = Math.max(AXIS_EDGE, box.x - w - AXIS_GAP)
        const ay = Math.min(Math.max(top, COLUMN_BAND), Math.max(COLUMN_BAND, bottom - AXIS_HEIGHT))
        if (!show(el, ay >= lastBottom + 2 || pressed(el))) continue
        lastBottom = ay + AXIS_HEIGHT
        el.style.transform = `translate(${ax}px, ${ay}px)`
      }
      zoom.set(cam.z)
      /* The names were just measured for the first time: a fit made with a
         guess at their width makes room for the real one. */
      if (measured && (mode.current === "fit" || mode.current === "focus")) {
        camera.current = mode.current === "fit" ? fitAll() : (fitFocus() ?? camera.current)
        paint()
      }
    }

    const paint = () => {
      if (!painting.current) painting.current = requestAnimationFrame(paintNow)
    }

    const save = () => {
      window.clearTimeout(saving.current)
      saving.current = window.setTimeout(() => {
        if (mode.current !== "user" || !storageKey.current) return
        try {
          window.localStorage.setItem(storageKey.current, JSON.stringify({ v: 1, ...camera.current }))
        } catch {
          /* Private browsing or a full quota. The camera is a convenience. */
        }
      }, 250)
    }

    const load = (): Camera | null => {
      try {
        const raw = window.localStorage.getItem(storageKey.current)
        const parsed = raw ? (JSON.parse(raw) as { v?: unknown }) : null
        return parsed && parsed.v === 1 ? sanitizeCamera(parsed) : null
      } catch {
        return null
      }
    }

    /* Movement and pinch rasterise faster as one composited layer; at rest
       the layer goes, so text is redrawn sharp at the new scale. */
    const moving = (on: boolean) => {
      const world = worldRef.current
      if (world) world.style.willChange = on ? "transform" : ""
    }

    const land = () => {
      cancelAnimationFrame(flight.current)
      flight.current = 0
    }

    const jump = (next: Camera) => {
      land()
      camera.current = next
      paint()
    }

    const fly = (next: Camera) => {
      land()
      const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
      if (reduce || typeof performance === "undefined") {
        jump(next)
        save()
        return
      }
      const from = camera.current
      const start = performance.now()
      const viewport = size()
      moving(true)
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / FLIGHT_MS)
        const eased = 1 - Math.pow(1 - t, 3)
        camera.current = t === 1 ? next : between(from, next, eased, viewport)
        paintNow()
        if (t < 1) {
          flight.current = requestAnimationFrame(step)
        } else {
          flight.current = 0
          moving(false)
          save()
        }
      }
      flight.current = requestAnimationFrame(step)
    }

    const everything = () => union([...rects.current.values()])

    /* A state is a row, a frame is a column, and both are one cell. */
    const focusRect = (state: string | null, frame: string | null): Rect | null => {
      const { rows, frames } = latest.current
      const row = state === null ? undefined : rows.find((r) => r.id === state)
      const column = frame === null ? undefined : frames.find((f) => f.id === frame)
      if (row && column && !row.missing) return rects.current.get(cellKey(row.id, column.id)) ?? null
      if (row) return union(rowRects(row.id))
      if (column) return union(columnRects(column.id))
      return null
    }

    const urlFocus = () => {
      const search = new URLSearchParams(window.location.search)
      return { state: search.get(latest.current.param), frame: search.get(latest.current.frameParam) }
    }

    function fitAll() {
      const all = everything()
      return all ? fit(all, size(), insets()) : camera.current
    }

    function fitFocus() {
      const { state, frame } = urlFocus()
      const rect = focusRect(state, frame)
      return rect ? fit(rect, size(), insets()) : null
    }

    /* The user took the camera: stop following the content, and stop flying. */
    const take = () => {
      land()
      mode.current = "user"
    }

    const zoomBy = (direction: 1 | -1) => {
      take()
      const { width, height } = size()
      fly(zoomAt(camera.current, { x: width / 2, y: height / 2 }, stepZoom(camera.current.z, direction)))
    }

    const actualSize = () => {
      take()
      const { width, height } = size()
      fly(zoomAt(camera.current, { x: width / 2, y: height / 2 }, 1))
    }

    /* Everything, and nothing in particular: the URL stops naming a focus. */
    const showEverything = () => {
      focused.current = "null\u0000null"
      writeSearchParams({ [latest.current.param]: null, [latest.current.frameParam]: null })
      mode.current = "fit"
      fly(fitAll())
    }

    /* A name was clicked: make it the focus, or stop it being one, keeping the
       other axis. A state and a frame together are one frame. */
    const toggle = (axis: "state" | "frame", id: string) => {
      const current = urlFocus()
      const next = { ...current, [axis]: current[axis] === id ? null : id }
      focused.current = `${next.state}\u0000${next.frame}`
      writeSearchParams({ [latest.current.param]: next.state, [latest.current.frameParam]: next.frame })
      const target = fitFocus()
      if (target) {
        mode.current = "focus"
        fly(target)
      } else {
        mode.current = "fit"
        fly(fitAll())
      }
    }

    /* The bar's count, clicked: the next frame that overflows, as a link. */
    const nextFinding = () => {
      const keys = findings.get()
      if (!keys?.length) return
      const { state, frame } = urlFocus()
      const at = state !== null && frame !== null ? keys.indexOf(cellKey(state, frame)) : -1
      const [nextState, nextFrame] = keys[(at + 1) % keys.length].split("\u0000")
      focused.current = `${nextState}\u0000${nextFrame}`
      writeSearchParams({ [latest.current.param]: nextState, [latest.current.frameParam]: nextFrame })
      const target = fitFocus()
      if (target) {
        mode.current = "focus"
        fly(target)
      }
    }

    return {
      size, measure, paint, paintNow, save, load, moving, land, jump, fly, take,
      fitAll, fitFocus, focusRect, urlFocus, zoomBy, actualSize, showEverything, toggle, nextFinding,
      cancelInspect: () => window.clearTimeout(inspecting.current),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Refs that register a cell or a frame's marks, one stable callback per key. */
  const cellRefs = React.useRef(new Map<string, (el: HTMLDivElement | null) => void>())
  const cellRef = React.useCallback((key: string) => {
    let ref = cellRefs.current.get(key)
    if (!ref) {
      ref = (el: HTMLDivElement | null) => {
        const before = cells.current.get(key)
        if (before && before !== el) observer.current?.unobserve(before)
        if (el) {
          cells.current.set(key, el)
          observer.current?.observe(el)
        } else {
          cells.current.delete(key)
        }
      }
      cellRefs.current.set(key, ref)
    }
    return ref
  }, [])

  const markRefs = React.useRef(new Map<string, (el: HTMLDivElement | null) => void>())
  const markRef = React.useCallback(
    (key: string) => {
      let ref = markRefs.current.get(key)
      if (!ref) {
        ref = (el: HTMLDivElement | null) => {
          if (el) {
            el.hidden = true
            marks.current.set(key, el)
            api.paint()
          } else {
            marks.current.delete(key)
          }
        }
        markRefs.current.set(key, ref)
      }
      return ref
    },
    [api],
  )

  const axisRefs = React.useRef(new Map<string, (el: HTMLButtonElement | null) => void>())
  const axisRef = React.useCallback(
    (key: string) => {
      let ref = axisRefs.current.get(key)
      if (!ref) {
        ref = (el: HTMLButtonElement | null) => {
          axisWidths.current.delete(key)
          if (el) {
            el.hidden = true
            axes.current.set(key, el)
            api.paint()
          } else {
            axes.current.delete(key)
          }
        }
        axisRefs.current.set(key, ref)
      }
      return ref
    },
    [api],
  )

  /* The first view: the frame a link names, else where this canvas was left,
     else everything. Measured before paint, so nothing flashes at 100%. */
  useClientLayoutEffect(() => {
    const viewport = viewportRef.current
    const world = worldRef.current
    if (!viewport || !world) return
    storageKey.current = `prototype-machine:canvas:${window.location.pathname}:${label}`
    api.measure()
    const { state, frame } = api.urlFocus()
    focused.current = `${state}\u0000${frame}`
    const toFocus = api.fitFocus()
    const stored = toFocus ? null : api.load()
    if (toFocus) mode.current = "focus"
    else if (stored) mode.current = "user"
    else mode.current = "fit"
    camera.current = toFocus ?? stored ?? api.fitAll()
    api.paintNow()
    world.style.visibility = "visible"

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        api.measure()
        if (mode.current === "fit") api.jump(api.fitAll())
        else if (mode.current === "focus") api.jump(api.fitFocus() ?? camera.current)
        else api.paint()
      })
      observer.current = ro
      ro.observe(viewport)
      ro.observe(world)
      for (const el of cells.current.values()) ro.observe(el)
    }
    return () => {
      observer.current?.disconnect()
      observer.current = null
      cancelAnimationFrame(painting.current)
      painting.current = 0
      api.land()
      api.cancelInspect()
      window.clearTimeout(saving.current)
    }
  }, [api, label])

  /* Rows or frames changed: measure the new layout. */
  useClientLayoutEffect(() => {
    api.measure()
    api.paint()
  }, [api, items])

  /* A link, back or forward: fly to what the URL names. */
  React.useEffect(() => {
    const onChange = () => {
      const { state, frame } = api.urlFocus()
      const key = `${state}\u0000${frame}`
      if (key === focused.current) return
      focused.current = key
      const next = api.fitFocus()
      if (next) {
        mode.current = "focus"
        api.fly(next)
      }
    }
    return subscribeUrl(onChange)
  }, [api])

  useCanvasGestures({ viewportRef, worldRef, camera, api, onWheelRef: wheelTarget })


  const forwardWheel = React.useCallback((event: WheelEvent) => wheelTarget.current?.(event), [])

  /* Keys belong to the canvas only while the canvas itself has focus. Inside a
     frame they belong to the component. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const step = event.shiftKey ? PAN_STEP * 4 : PAN_STEP
    const pans: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    if (pans[event.key]) {
      api.take()
      api.fly(panBy(camera.current, ...pans[event.key]))
    } else if (event.key === "+" || event.key === "=") api.zoomBy(1)
    else if (event.key === "-" || event.key === "_") api.zoomBy(-1)
    else if (event.key === "0" || event.code === "Digit0") api.actualSize()
    else if (event.key === "1" || event.code === "Digit1") api.showEverything()
    else return
    event.preventDefault()
  }

  /* Focus moving to something off screen moves the camera, not the page. */
  const onFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget
    if (event.target === viewport) {
      if (ringRef.current) ringRef.current.hidden = !viewport.matches?.(":focus-visible")
      return
    }
    viewport.scrollTop = 0
    viewport.scrollLeft = 0
    const box = viewport.getBoundingClientRect()
    const target = (event.target as Element).getBoundingClientRect()
    const next = reveal(
      camera.current,
      { x: target.left - box.left, y: target.top - box.top, width: target.width, height: target.height },
      api.size(),
      REVEAL_INSETS,
    )
    if (next) {
      api.take()
      api.fly(next)
    }
  }

  const onBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && ringRef.current) ringRef.current.hidden = true
  }

  /* A browser scrolls even an overflow:hidden box to show what gets focus.
     The camera does that job here. */
  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    event.currentTarget.scrollTop = 0
    event.currentTarget.scrollLeft = 0
  }

  /* Rendered once per change of rows, frames or the render function, never
     because the camera moved or the URL changed. */
  const grid = React.useMemo(
    () => (
      <CanvasGrid
        rows={rows}
        frames={frames}
        background={background}
        tone="canvas"
        render={children}
        gridRef={worldRef}
        cellRef={cellRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transformOrigin: "0 0",
          visibility: "hidden",
          cursor: "grab",
        }}
      />
    ),
    [rows, frames, background, children, cellRef],
  )

  return (
    <>
      <div
        ref={viewportRef}
        data-state-canvas-viewport=""
        tabIndex={0}
        role="region"
        aria-roledescription="canvas"
        aria-label={label}
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        onScroll={onScroll}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: zIndex - 1000,
          overflow: "hidden",
          overscrollBehavior: "none",
          background: SURFACE,
          touchAction: "none",
          outline: "none",
          cursor: "grab",
        }}
      >
        <span id={hintId} style={SR_ONLY}>
          {HINT}
        </span>
        {grid}
      </div>
      {layer
        ? createPortal(
            <>
              <CanvasOverlay
                items={items}
                rows={rows}
                frames={frames}
                markRef={markRef}
                axisRef={axisRef}
                ringRef={ringRef}
                param={param}
                frameParam={frameParam}
                onAxis={api.toggle}
                onWheel={forwardWheel}
              />
              <CanvasBar
                label={label}
                zoom={zoom}
                findings={findings}
                onFinding={api.nextFinding}
                own={layer.host}
                onZoomOut={() => api.zoomBy(-1)}
                onZoomIn={() => api.zoomBy(1)}
                onActualSize={api.actualSize}
                onFit={api.showEverything}
              />
            </>,
            layer.mount,
          )
        : null}
    </>
  )
}
