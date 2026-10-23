/* The canvas camera, as plain arithmetic.
 *
 * A camera is where the world sits on screen: `screen = world * z + (x, y)`.
 * Everything here is pure, so the gestures in canvas.tsx are a thin layer of
 * event plumbing over functions a test can call without a DOM. */

export interface Camera {
  x: number
  y: number
  z: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

/** Room to leave at each edge when fitting, in screen pixels. */
export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 4

/* The stops the zoom buttons and keys move between, so a few presses land on
   a number someone can say out loud ("half size") rather than 0.4096. */
export const ZOOM_STOPS: ReadonlyArray<number> = [0.05, 0.1, 0.25, 0.33, 0.5, 0.67, 1, 1.5, 2, 3, 4]

export const HOME: Camera = { x: 0, y: 0, z: 1 }

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

/** Zoom to `z`, keeping the world point under `at` (screen pixels) where it is. */
export function zoomAt(camera: Camera, at: { x: number; y: number }, z: number): Camera {
  const next = clampZoom(z)
  const ratio = next / camera.z
  return {
    x: at.x - (at.x - camera.x) * ratio,
    y: at.y - (at.y - camera.y) * ratio,
    z: next,
  }
}

/** The next stop in `direction` from `z`. Past the last stop it stays there. */
export function stepZoom(z: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_STOPS.find((stop) => stop > z * 1.001) ?? MAX_ZOOM
  for (let i = ZOOM_STOPS.length - 1; i >= 0; i--) if (ZOOM_STOPS[i] < z * 0.999) return ZOOM_STOPS[i]
  return MIN_ZOOM
}

export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { x: camera.x + dx, y: camera.y + dy, z: camera.z }
}

/** A world rect, where it lands on screen. */
export function toScreen(camera: Camera, rect: Rect): Rect {
  return {
    x: rect.x * camera.z + camera.x,
    y: rect.y * camera.z + camera.y,
    width: rect.width * camera.z,
    height: rect.height * camera.z,
  }
}

/** The smallest rect holding all of `rects`, or null for none. */
export function union(rects: ReadonlyArray<Rect>): Rect | null {
  if (!rects.length) return null
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const r of rects) {
    left = Math.min(left, r.x)
    top = Math.min(top, r.y)
    right = Math.max(right, r.x + r.width)
    bottom = Math.max(bottom, r.y + r.height)
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * The camera that shows all of `rect`, centred in the space `insets` leave.
 * It never zooms in past `maxZoom`, so fitting one small component shows it
 * at its real size rather than blown up.
 */
export function fit(rect: Rect, viewport: Size, insets: Insets, maxZoom = 1): Camera {
  const room = {
    width: Math.max(1, viewport.width - insets.left - insets.right),
    height: Math.max(1, viewport.height - insets.top - insets.bottom),
  }
  const z = clampZoom(
    Math.min(maxZoom, room.width / Math.max(1, rect.width), room.height / Math.max(1, rect.height)),
  )
  return {
    x: insets.left + (room.width - rect.width * z) / 2 - rect.x * z,
    y: insets.top + (room.height - rect.height * z) / 2 - rect.y * z,
    z,
  }
}

/**
 * The smallest pan that brings a screen rect inside the viewport's insets, or
 * null when it is already there. A rect bigger than the room is aligned by its
 * top-left corner, which is where reading starts.
 */
export function reveal(camera: Camera, rect: Rect, viewport: Size, insets: Insets): Camera | null {
  const axis = (start: number, size: number, min: number, max: number) => {
    if (size > max - min) return min - start
    if (start < min) return min - start
    if (start + size > max) return max - (start + size)
    return 0
  }
  const dx = axis(rect.x, rect.width, insets.left, viewport.width - insets.right)
  const dy = axis(rect.y, rect.height, insets.top, viewport.height - insets.bottom)
  if (!dx && !dy) return null
  return panBy(camera, dx, dy)
}

/**
 * Part of the way from `a` to `b`, for a flight between two views. Zoom moves
 * in log space and the view's centre moves in the world, so a zoom-out-and-
 * across reads as one motion instead of a swing.
 */
export function between(a: Camera, b: Camera, t: number, viewport: Size): Camera {
  const cx = viewport.width / 2
  const cy = viewport.height / 2
  const centre = (c: Camera) => ({ x: (cx - c.x) / c.z, y: (cy - c.y) / c.z })
  const from = centre(a)
  const to = centre(b)
  const z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t)
  const wx = from.x + (to.x - from.x) * t
  const wy = from.y + (to.y - from.y) * t
  return { x: cx - wx * z, y: cy - wy * z, z }
}

/** A wheel event's movement in pixels, whatever unit the browser reported. */
export function wheelPixels(
  event: { deltaX: number; deltaY: number; deltaMode: number; shiftKey?: boolean },
  pageHeight: number,
): { dx: number; dy: number } {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pageHeight : 1
  let dx = event.deltaX * unit
  let dy = event.deltaY * unit
  /* A mouse wheel with Shift scrolls sideways on Windows and Linux, but some
     browsers still report it as vertical. */
  if (event.shiftKey && dx === 0) {
    dx = dy
    dy = 0
  }
  return { dx, dy }
}

/**
 * How much one wheel event with Control or Command held zooms. A trackpad
 * pinch arrives as a stream of small deltas and should track the fingers; a
 * mouse wheel notch arrives as one large delta and is capped to a step.
 */
export function wheelZoom(dy: number): number {
  return Math.exp(-Math.max(-10, Math.min(10, dy)) * 0.01)
}

/** A stored camera, or null if it is not one. Storage outlives code. */
export function sanitizeCamera(input: unknown): Camera | null {
  if (!input || typeof input !== "object") return null
  const { x, y, z } = input as Record<string, unknown>
  if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") return null
  if (![x, y, z].every(Number.isFinite) || z < MIN_ZOOM || z > MAX_ZOOM) return null
  /* A camera a million pixels off is a view of nothing; start over. */
  if (Math.abs(x) > 1e6 || Math.abs(y) > 1e6) return null
  return { x, y, z }
}
