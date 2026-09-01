import { describe, expect, it, vi } from "vitest"

import {
  DRAG_THRESHOLD,
  blockNextClick,
  clampToViewport,
  dragOffset,
  dragStart,
  hasMoved,
  cornerPosition,
  isDragTarget,
  readPlacement,
  snapTarget,
  writePlacement,
} from "./drag"

const rect = { left: 100, top: 200 }

describe("drag arithmetic", () => {
  it("computes position from the rect captured at pointerdown, not from deltas", () => {
    const start = dragStart({ x: 150, y: 250 }, rect)
    expect(dragOffset(start, { x: 160, y: 250 })).toEqual({ x: 110, y: 200 })
    /* The same pointer twice must give the same answer — the whole point of
       not accumulating. */
    expect(dragOffset(start, { x: 160, y: 250 })).toEqual({ x: 110, y: 200 })
    expect(dragOffset(start, { x: 150, y: 250 })).toEqual({ x: 100, y: 200 })
  })

  it("treats movement under the threshold as a click", () => {
    const start = dragStart({ x: 150, y: 250 }, rect)
    expect(hasMoved(start, { x: 150 + DRAG_THRESHOLD - 1, y: 250 })).toBe(false)
    expect(hasMoved(start, { x: 150 + DRAG_THRESHOLD, y: 250 })).toBe(true)
    /* Diagonal counts, so a slow curve does not sneak under the bar. */
    expect(hasMoved(start, { x: 156, y: 256 })).toBe(true)
  })
})

describe("clampToViewport", () => {
  const size = { width: 288, height: 400 }
  const viewport = { width: 1000, height: 800 }

  it("keeps the panel inside the viewport", () => {
    expect(clampToViewport({ x: -50, y: -50 }, size, viewport, 8)).toEqual({ x: 8, y: 8 })
    expect(clampToViewport({ x: 9999, y: 9999 }, size, viewport, 8)).toEqual({ x: 704, y: 392 })
  })

  it("leaves a position that already fits alone", () => {
    expect(clampToViewport({ x: 120, y: 120 }, size, viewport, 8)).toEqual({ x: 120, y: 120 })
  })

  it("pins to the top-left when the panel is bigger than the viewport", () => {
    /* Not to a negative maximum, which would push it off the other way. */
    const tall = { width: 288, height: 2000 }
    expect(clampToViewport({ x: 0, y: 0 }, tall, viewport, 8)).toEqual({ x: 8, y: 8 })
  })

  it("rescues a position restored from a bigger monitor", () => {
    expect(clampToViewport({ x: 2400, y: 1300 }, size, { width: 800, height: 600 }, 8)).toEqual({
      x: 504,
      y: 192,
    })
  })
})

describe("isDragTarget", () => {
  it("refuses interactive descendants, so a button click is not a drag", () => {
    const root = document.createElement("div")
    const button = document.createElement("button")
    const label = document.createElement("span")
    root.append(label, button)

    expect(isDragTarget(label, root)).toBe(true)
    expect(isDragTarget(button, root)).toBe(false)
  })

  it("never excludes the handle itself, even when the handle is a button", () => {
    /* The collapsed launcher IS a button, and the pointer lands on the icon
       inside it. Excluding it would make the one fully-draggable surface the
       only undraggable one. */
    const launcher = document.createElement("button")
    const icon = document.createElement("span")
    launcher.append(icon)

    expect(isDragTarget(launcher, launcher)).toBe(true)
    expect(isDragTarget(icon, launcher)).toBe(true)
  })

  it("is bounded by the root, so it cannot match the host page", () => {
    const outside = document.createElement("div")
    const root = document.createElement("div")
    expect(isDragTarget(outside, root)).toBe(false)
    expect(isDragTarget(null, root)).toBe(false)
  })
})

describe("blockNextClick", () => {
  it("swallows exactly one click, in the capture phase", () => {
    const el = document.createElement("button")
    const handler = vi.fn()
    el.addEventListener("click", handler)
    document.body.append(el)

    blockNextClick(el)
    el.click()
    expect(handler).not.toHaveBeenCalled()

    /* One shot: a genuine click a moment later still lands. */
    el.click()
    expect(handler).toHaveBeenCalledTimes(1)
    el.remove()
  })
})

describe("snapping to a corner", () => {
  const size = { width: 40, height: 40 }
  const viewport = { width: 1000, height: 800 }

  it("anchors each corner where the CSS classes put it", () => {
    expect(cornerPosition("top-left", size, viewport)).toEqual({ x: 16, y: 16 })
    expect(cornerPosition("top-right", size, viewport)).toEqual({ x: 944, y: 16 })
    expect(cornerPosition("bottom-left", size, viewport)).toEqual({ x: 16, y: 744 })
    expect(cornerPosition("bottom-right", size, viewport)).toEqual({ x: 944, y: 744 })
  })

  it("takes the nearest corner when released close to one", () => {
    expect(snapTarget({ x: 40, y: 40 }, size, viewport)).toBe("top-left")
    expect(snapTarget({ x: 900, y: 40 }, size, viewport)).toBe("top-right")
    expect(snapTarget({ x: 40, y: 700 }, size, viewport)).toBe("bottom-left")
    expect(snapTarget({ x: 900, y: 700 }, size, viewport)).toBe("bottom-right")
  })

  it("leaves a drop in open space alone", () => {
    /* Free placement has to survive, or the panel can never sit beside the
       thing being reviewed. */
    expect(snapTarget({ x: 480, y: 380 }, size, viewport)).toBe(null)
  })

  it("respects the threshold exactly", () => {
    const anchor = cornerPosition("top-left", size, viewport)
    const just = { x: anchor.x + 139, y: anchor.y }
    const past = { x: anchor.x + 141, y: anchor.y }
    expect(snapTarget(just, size, viewport)).toBe("top-left")
    expect(snapTarget(past, size, viewport)).toBe(null)
  })

  it("measures diagonally, so a corner pulls from both axes at once", () => {
    /* 100 + 100 is 141 away, past the 140 threshold, even though neither axis
       is. Without hypot this would snap and feel grabby. */
    expect(snapTarget({ x: 116, y: 116 }, size, viewport)).toBe(null)
  })
})

describe("stored placement", () => {
  it("round-trips a free placement, and forgets on null", () => {
    writePlacement("k", { kind: "free", x: 12, y: 34 })
    expect(readPlacement("k")).toEqual({ kind: "free", x: 12, y: 34 })
    writePlacement("k", null)
    expect(readPlacement("k")).toBe(null)
  })

  it("round-trips a corner, which is what keeps it glued through a resize", () => {
    writePlacement("k", { kind: "corner", corner: "bottom-left" })
    expect(readPlacement("k")).toEqual({ kind: "corner", corner: "bottom-left" })
  })

  it("migrates the bare {x, y} written before snapping existed", () => {
    /* Somebody has the panel exactly where they want it; do not throw that away. */
    window.localStorage.setItem("k:pm-panel-position", '{"x":120,"y":240}')
    expect(readPlacement("k")).toEqual({ kind: "free", x: 120, y: 240 })
  })

  it("drops a shape it no longer recognises rather than trusting it", () => {
    /* Storage outlives code, and this value ends up in a style attribute. */
    for (const bad of [
      '{"x":"left","y":3}',
      "not json",
      '{"x":null,"y":null}',
      '{"x":1e999,"y":0}',
      '{"kind":"corner","corner":"middle"}',
      '{"kind":"corner"}',
      '{"kind":"free"}',
    ]) {
      window.localStorage.setItem("k:pm-panel-position", bad)
      expect(readPlacement("k")).toBe(null)
    }
  })
})
