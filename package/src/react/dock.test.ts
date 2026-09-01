import { beforeEach, describe, expect, it } from "vitest"

import {
  MIN_HEIGHT,
  MIN_WIDTH,
  clampWidth,
  defaultWidth,
  edgeTarget,
  floatHeight,
  readDock,
  writeDock,
} from "./dock"

beforeEach(() => window.localStorage.clear())

describe("dock width", () => {
  it("never shrinks below the point where a figure is unreadable", () => {
    expect(clampWidth(10, 1400)).toBe(MIN_WIDTH)
    expect(clampWidth(-500, 1400)).toBe(MIN_WIDTH)
  })

  it("always leaves some of the app visible", () => {
    /* Docking that covers the viewport is just the overlay again. */
    expect(clampWidth(99999, 1000)).toBe(920)
  })

  it("falls back to the minimum on a viewport too small to honour the ratio", () => {
    expect(clampWidth(400, 200)).toBe(MIN_WIDTH)
  })

  it("opens at 560 where there is room, and narrower where there is not", () => {
    expect(defaultWidth(1440)).toBe(560)
    expect(defaultWidth(500)).toBe(460)
  })
})

describe("floatHeight", () => {
  it("caps a pane pulled off an edge so it can actually float", () => {
    /* Keeping the full docked height leaves it pinned to the top, because
       clamping has nowhere else to put it. */
    expect(floatHeight(900, 900)).toBe(648)
  })

  it("leaves an already-short pane alone", () => {
    expect(floatHeight(400, 900)).toBe(400)
  })

  it("never goes below the minimum", () => {
    expect(floatHeight(50, 200)).toBe(MIN_HEIGHT)
  })
})

describe("edgeTarget", () => {
  const size = { width: 560, height: 600 }
  const viewport = { width: 1440, height: 900 }

  it("docks to whichever side the pane was dropped against", () => {
    expect(edgeTarget({ x: 10, y: 200 }, size, viewport)).toBe("left")
    expect(edgeTarget({ x: 1440 - 560 - 10, y: 200 }, size, viewport)).toBe("right")
  })

  it("leaves a pane dropped in open space floating", () => {
    expect(edgeTarget({ x: 400, y: 200 }, size, viewport)).toBe(null)
  })

  it("ignores the vertical position entirely", () => {
    /* A full-height pane has no top or bottom to speak of — its edge is its
       anchor, which is why edges beat corners here. */
    expect(edgeTarget({ x: 4, y: 0 }, size, viewport)).toBe("left")
    expect(edgeTarget({ x: 4, y: 880 }, size, viewport)).toBe("left")
  })
})

describe("stored dock state", () => {
  it("round-trips a docked pane", () => {
    writeDock("k", { mode: "right", width: 640 })
    expect(readDock("k")).toEqual({ mode: "right", width: 640 })
  })

  it("round-trips a floating pane, position and size together", () => {
    const free = { mode: "free", x: 40, y: 60, width: 500, height: 420 } as const
    writeDock("k", free)
    expect(readDock("k")).toEqual(free)
  })

  it("forgets on null", () => {
    writeDock("k", { mode: "left", width: 400 })
    writeDock("k", null)
    expect(readDock("k")).toBe(null)
  })

  it("drops anything it does not recognise", () => {
    for (const bad of [
      "not json",
      '{"mode":"right"}',
      '{"mode":"middle","width":400}',
      '{"mode":"free","x":1,"y":2,"width":3}',
      '{"mode":"right","width":"wide"}',
    ]) {
      window.localStorage.setItem("k:pm-diagram", bad)
      expect(readDock("k")).toBe(null)
    }
  })
})
