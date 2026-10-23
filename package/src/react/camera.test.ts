import { describe, expect, it } from "vitest"

import {
  between,
  clampZoom,
  fit,
  MAX_ZOOM,
  MIN_ZOOM,
  reveal,
  sanitizeCamera,
  stepZoom,
  toScreen,
  union,
  wheelPixels,
  wheelZoom,
  zoomAt,
} from "./camera"

const none = { top: 0, right: 0, bottom: 0, left: 0 }

describe("the camera", () => {
  it("zooms around the pointer, keeping the world point under it still", () => {
    const camera = { x: 100, y: 50, z: 1 }
    const at = { x: 400, y: 300 }
    const before = { x: (at.x - camera.x) / camera.z, y: (at.y - camera.y) / camera.z }
    const next = zoomAt(camera, at, 2)
    expect(next.z).toBe(2)
    expect((at.x - next.x) / next.z).toBeCloseTo(before.x)
    expect((at.y - next.y) / next.z).toBeCloseTo(before.y)
  })

  it("keeps zoom inside its limits", () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM)
    expect(clampZoom(0)).toBe(MIN_ZOOM)
    expect(clampZoom(Number.NaN)).toBe(1)
    expect(zoomAt({ x: 0, y: 0, z: 1 }, { x: 0, y: 0 }, 99).z).toBe(MAX_ZOOM)
  })

  it("steps between round stops", () => {
    expect(stepZoom(1, 1)).toBe(1.5)
    expect(stepZoom(1, -1)).toBe(0.67)
    expect(stepZoom(0.42, 1)).toBe(0.5)
    expect(stepZoom(0.42, -1)).toBe(0.33)
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM)
    expect(stepZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM)
  })

  it("maps world rects to the screen", () => {
    expect(toScreen({ x: 10, y: 20, z: 0.5 }, { x: 100, y: 100, width: 200, height: 40 })).toEqual({
      x: 60,
      y: 70,
      width: 100,
      height: 20,
    })
  })

  it("unions rects, and has nothing to say about none", () => {
    expect(union([])).toBe(null)
    expect(
      union([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 20, y: -5, width: 10, height: 10 },
      ]),
    ).toEqual({ x: 0, y: -5, width: 30, height: 15 })
  })
})

describe("fit", () => {
  it("shows the whole rect, centred in the room the insets leave", () => {
    const camera = fit({ x: 0, y: 0, width: 2000, height: 1000 }, { width: 1000, height: 800 }, none)
    expect(camera.z).toBe(0.5)
    const screen = toScreen(camera, { x: 0, y: 0, width: 2000, height: 1000 })
    expect(screen.x).toBeCloseTo(0)
    expect(screen.y).toBeCloseTo(150)
  })

  it("leaves the insets clear, for the frame names above and the bar below", () => {
    const insets = { top: 72, right: 48, bottom: 96, left: 48 }
    const camera = fit({ x: 0, y: 0, width: 5000, height: 5000 }, { width: 1200, height: 800 }, insets)
    const screen = toScreen(camera, { x: 0, y: 0, width: 5000, height: 5000 })
    expect(screen.y).toBeGreaterThanOrEqual(72 - 0.01)
    expect(screen.y + screen.height).toBeLessThanOrEqual(800 - 96 + 0.01)
  })

  it("never blows a small component up past its real size", () => {
    expect(fit({ x: 0, y: 0, width: 120, height: 40 }, { width: 1200, height: 800 }, none).z).toBe(1)
  })
})

describe("reveal", () => {
  const viewport = { width: 1000, height: 800 }
  const insets = { top: 40, right: 40, bottom: 40, left: 40 }

  it("leaves a rect alone when it is already in view", () => {
    expect(reveal({ x: 0, y: 0, z: 1 }, { x: 100, y: 100, width: 50, height: 20 }, viewport, insets)).toBe(null)
  })

  it("pans the least it can to bring a rect into view", () => {
    const next = reveal({ x: 0, y: 0, z: 1 }, { x: 1200, y: 100, width: 50, height: 20 }, viewport, insets)!
    expect(next.x).toBe(1000 - 40 - 1250)
    expect(next.y).toBe(0)
  })

  it("aligns a rect bigger than the view by its top-left corner", () => {
    const next = reveal({ x: 0, y: 0, z: 1 }, { x: -500, y: 900, width: 3000, height: 50 }, viewport, insets)!
    expect(next.x).toBe(540)
    expect(next.y).toBe(800 - 40 - 950)
  })
})

describe("between", () => {
  it("starts at a and ends at b", () => {
    const a = { x: 0, y: 0, z: 1 }
    const b = { x: -400, y: -200, z: 0.25 }
    const viewport = { width: 800, height: 600 }
    const start = between(a, b, 0, viewport)
    const end = between(a, b, 1, viewport)
    expect(start.x).toBeCloseTo(a.x)
    expect(start.z).toBeCloseTo(a.z)
    expect(end.x).toBeCloseTo(b.x)
    expect(end.y).toBeCloseTo(b.y)
    expect(end.z).toBeCloseTo(b.z)
  })

  it("moves zoom in log space, so halfway between 1 and 0.25 is 0.5", () => {
    expect(between({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0.25 }, 0.5, { width: 800, height: 600 }).z).toBeCloseTo(0.5)
  })
})

describe("wheel input", () => {
  it("reads lines and pages as pixels", () => {
    expect(wheelPixels({ deltaX: 0, deltaY: 3, deltaMode: 1 }, 800)).toEqual({ dx: 0, dy: 48 })
    expect(wheelPixels({ deltaX: 0, deltaY: 1, deltaMode: 2 }, 800)).toEqual({ dx: 0, dy: 800 })
  })

  it("turns Shift with a vertical wheel into sideways movement", () => {
    expect(wheelPixels({ deltaX: 0, deltaY: 40, deltaMode: 0, shiftKey: true }, 800)).toEqual({ dx: 40, dy: 0 })
  })

  it("follows a pinch closely and caps a wheel notch to a step", () => {
    expect(wheelZoom(-2)).toBeCloseTo(Math.exp(0.02))
    expect(wheelZoom(100)).toBeCloseTo(wheelZoom(10))
    expect(wheelZoom(100)).toBeGreaterThan(0.9)
  })
})

describe("a stored camera", () => {
  it("comes back when it is one", () => {
    expect(sanitizeCamera({ x: 10, y: -20, z: 0.5 })).toEqual({ x: 10, y: -20, z: 0.5 })
  })

  it("is dropped when it is not", () => {
    for (const bad of [null, "x", {}, { x: 1, y: 2 }, { x: 1, y: 2, z: 0 }, { x: Infinity, y: 0, z: 1 }, { x: 1e9, y: 0, z: 1 }]) {
      expect(sanitizeCamera(bad)).toBe(null)
    }
  })
})
