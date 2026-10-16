"use client"

import * as React from "react"

/* A number field with `control: "range"`.
 *
 * The browser's own range input takes its look from the OS, gives no sense of
 * where the steps are, and can't be typed into. This one is a track you can
 * press anywhere and drag, with a tick for each step when there are few of
 * them, and the exact value in a box beside it that you can type into. The
 * shape follows Josh Puckett's DialKit slider; the label stays above, like
 * every other row in the panel. */

/** Past this many steps, ticks are noise rather than a guide. */
export const MAX_TICKS = 10

/** Decimal places in a step, so 0.1 + 0.2 lands on 0.3 and not 0.30000000000000004. */
function decimalsOf(step: number): number {
  const text = String(step)
  if (text.includes("e-")) return Number(text.split("e-")[1])
  const dot = text.indexOf(".")
  return dot === -1 ? 0 : text.length - dot - 1
}

/** The nearest step to `raw`, inside `min` and `max`. */
export function snap(raw: number, min: number, max: number, step: number): number {
  const stepped = min + Math.round((raw - min) / step) * step
  const clamped = Math.min(max, Math.max(min, stepped))
  return Number(clamped.toFixed(decimalsOf(step)))
}

/** The value under a pointer at `clientX`, for a track at `left` that is `width` wide. */
export function valueAt(clientX: number, left: number, width: number, min: number, max: number, step: number): number {
  if (width <= 0) return min
  const ratio = Math.min(1, Math.max(0, (clientX - left) / width))
  return snap(min + ratio * (max - min), min, max, step)
}

/**
 * Where a key moves the value, or `undefined` for a key the slider ignores.
 * Arrows move one step, with Shift ten. Page Up and Page Down move ten. Home
 * and End go to the ends.
 */
export function keyValue(key: string, shift: boolean, value: number, min: number, max: number, step: number): number | undefined {
  const by = shift ? step * 10 : step
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return snap(value + by, min, max, step)
    case "ArrowLeft":
    case "ArrowDown":
      return snap(value - by, min, max, step)
    case "PageUp":
      return snap(value + step * 10, min, max, step)
    case "PageDown":
      return snap(value - step * 10, min, max, step)
    case "Home":
      return min
    case "End":
      return max
    default:
      return undefined
  }
}

export function Slider({
  value,
  min,
  max,
  step,
  label,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  label: string
  onChange: (next: number) => void
}) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  /* The track's box at pointerdown. Reading it once keeps a drag steady if
     the panel scrolls under the pointer. */
  const rect = React.useRef<{ left: number; width: number } | null>(null)
  /* A press jumps, and the jump animates. A drag follows the pointer exactly,
     and an animation behind it would read as lag. */
  const [jumping, setJumping] = React.useState(false)

  const span = max - min
  const ratio = span > 0 ? Math.min(1, Math.max(0, (value - min) / span)) : 0
  /* A tick between each pair of steps, only when the steps divide the range
     evenly and there are few enough to count at a glance. */
  const steps = Math.round(span / step)
  const even = Math.abs(span / step - steps) < 1e-9
  const ticks =
    even && steps >= 2 && steps <= MAX_TICKS
      ? Array.from({ length: steps - 1 }, (_, i) => ((i + 1) / steps) * 100)
      : []

  const release = (event: React.PointerEvent<HTMLDivElement>) => {
    rect.current = null
    const el = event.currentTarget
    if (typeof el.releasePointerCapture === "function") {
      try {
        el.releasePointerCapture(event.pointerId)
      } catch {
        /* Already released. */
      }
    }
  }

  return (
    <div
      ref={trackRef}
      className={`pm-slider${jumping ? " pm-slider-jump" : ""}`}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={String(value)}
      aria-orientation="horizontal"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        const el = event.currentTarget
        el.focus()
        const box = el.getBoundingClientRect()
        rect.current = { left: box.left, width: box.width }
        if (typeof el.setPointerCapture === "function") {
          try {
            el.setPointerCapture(event.pointerId)
          } catch {
            /* A synthetic pointer has nothing to capture. */
          }
        }
        setJumping(true)
        onChange(valueAt(event.clientX, box.left, box.width, min, max, step))
      }}
      onPointerMove={(event) => {
        if (!rect.current) return
        setJumping(false)
        onChange(valueAt(event.clientX, rect.current.left, rect.current.width, min, max, step))
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={(event) => {
        if (event.altKey || event.metaKey || event.ctrlKey) return
        const next = keyValue(event.key, event.shiftKey, value, min, max, step)
        if (next === undefined) return
        event.preventDefault()
        setJumping(false)
        onChange(next)
      }}
    >
      <span className="pm-slider-fill" style={{ transform: `scaleX(${ratio})` }} aria-hidden="true" />
      {ticks.map((at) => (
        <span key={at} className="pm-slider-tick" style={{ left: `${at}%` }} aria-hidden="true" />
      ))}
      <span className="pm-slider-thumb" style={{ transform: `translateX(${ratio * 100}%)` }} aria-hidden="true" />
    </div>
  )
}
