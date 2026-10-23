"use client"

import * as React from "react"

import { type Camera, clampZoom, panBy, wheelPixels, wheelZoom, zoomAt } from "./camera"

/* How a canvas is moved: wheel and trackpad, a pinch on a trackpad or a
 * touch screen, and a drag on empty space. Native listeners, because a wheel
 * or a gesture event has to be cancelled to keep the browser from zooming
 * the page, and React attaches wheel listeners as passive.
 *
 * A drag that starts on a frame belongs to the component in it, so a button
 * still clicks and text still selects. The middle button pans from anywhere.
 * Every gesture ends cleanly on a lost pointer, a blurred window or a hidden
 * tab, so the cursor is never left saying "grabbing". */

const useClientLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

/** What a gesture needs from the canvas: take the camera, redraw, remember. */
export interface GestureApi {
  take(): void
  paint(): void
  save(): void
  moving(on: boolean): void
}

export function useCanvasGestures({
  viewportRef,
  worldRef,
  camera,
  api,
  onWheelRef,
}: {
  viewportRef: React.RefObject<HTMLDivElement | null>
  worldRef: React.RefObject<HTMLDivElement | null>
  camera: React.MutableRefObject<Camera>
  api: GestureApi
  /** Set to the wheel handler, so a wheel over the canvas's own labels can move it too. */
  onWheelRef: React.MutableRefObject<((event: WheelEvent) => void) | null>
}) {
  useClientLayoutEffect(() => {
    const viewport = viewportRef.current
    const world = worldRef.current
    if (!viewport || !world) return

    const local = (event: { clientX: number; clientY: number }) => {
      const box = viewport.getBoundingClientRect()
      return { x: event.clientX - box.left, y: event.clientY - box.top }
    }

    let safariPinch: number | null = null

    const onWheel = (event: WheelEvent) => {
      const { dx, dy } = wheelPixels(event, viewport.clientHeight)
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        if (safariPinch !== null) return
        api.take()
        camera.current = zoomAt(camera.current, local(event), camera.current.z * wheelZoom(dy))
        api.paint()
        api.save()
        return
      }
      if (scrollsInside(event.target, dx, dy, world)) return
      event.preventDefault()
      api.take()
      camera.current = panBy(camera.current, -dx, -dy)
      api.paint()
      api.save()
    }

    /* Safari reports a trackpad pinch as gesture events, with the total scale
       since the pinch began. */
    const onGestureStart = (event: Event) => {
      event.preventDefault()
      api.take()
      safariPinch = camera.current.z
    }
    const onGestureChange = (event: Event) => {
      event.preventDefault()
      if (safariPinch === null) return
      const e = event as Event & { scale: number; clientX: number; clientY: number }
      camera.current = zoomAt(camera.current, local(e), safariPinch * e.scale)
      api.paint()
    }
    const onGestureEnd = (event: Event) => {
      event.preventDefault()
      safariPinch = null
      api.save()
    }

    const touches = new Map<number, { x: number; y: number }>()
    let pan: { id: number; x: number; y: number } | null = null
    let pinch: { distance: number; z: number; world: { x: number; y: number } } | null = null

    const grabbing = (on: boolean) => {
      viewport.style.cursor = on ? "grabbing" : "grab"
      world.style.cursor = on ? "grabbing" : "grab"
      api.moving(on)
    }

    const startPinch = () => {
      const [a, b] = [...touches.values()]
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const cam = camera.current
      api.take()
      pinch = {
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        z: cam.z,
        world: { x: (mid.x - cam.x) / cam.z, y: (mid.y - cam.y) / cam.z },
      }
      pan = null
      grabbing(true)
    }

    const end = () => {
      if (!pan && !pinch) return
      pan = null
      pinch = null
      grabbing(false)
      api.save()
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        touches.set(event.pointerId, local(event))
        if (touches.size === 2) {
          startPinch()
          return
        }
      }
      if (pinch) return
      const inFrame = !!(event.target as Element | null)?.closest?.("[data-state-canvas-frame]")
      const panning = event.button === 1 || (event.button === 0 && !inFrame)
      if (!panning) return
      if (event.button === 1) event.preventDefault()
      api.take()
      pan = { id: event.pointerId, x: event.clientX, y: event.clientY }
      try {
        viewport.setPointerCapture(event.pointerId)
      } catch {
        /* A pointer that is already gone. */
      }
      grabbing(true)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (touches.has(event.pointerId)) touches.set(event.pointerId, local(event))
      if (pinch && touches.size >= 2) {
        const [a, b] = [...touches.values()]
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const z = clampZoom((pinch.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.distance)
        camera.current = { x: mid.x - pinch.world.x * z, y: mid.y - pinch.world.y * z, z }
        api.paint()
        return
      }
      if (!pan || event.pointerId !== pan.id) return
      camera.current = panBy(camera.current, event.clientX - pan.x, event.clientY - pan.y)
      pan.x = event.clientX
      pan.y = event.clientY
      api.paint()
    }

    const onPointerEnd = (event: PointerEvent) => {
      touches.delete(event.pointerId)
      if (pinch && touches.size < 2) end()
      else if (pan && event.pointerId === pan.id) {
        try {
          viewport.releasePointerCapture(event.pointerId)
        } catch {
          /* Already released. */
        }
        end()
      }
    }

    const onLostCapture = (event: PointerEvent) => {
      if (pan && event.pointerId === pan.id) end()
    }

    /* Middle-button autoscroll starts on mousedown, not pointerdown. */
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault()
    }

    const onAbandon = () => {
      touches.clear()
      end()
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onAbandon()
    }

    viewport.addEventListener("wheel", onWheel, { passive: false })
    viewport.addEventListener("gesturestart", onGestureStart)
    viewport.addEventListener("gesturechange", onGestureChange)
    viewport.addEventListener("gestureend", onGestureEnd)
    viewport.addEventListener("pointerdown", onPointerDown)
    viewport.addEventListener("pointermove", onPointerMove)
    viewport.addEventListener("pointerup", onPointerEnd)
    viewport.addEventListener("pointercancel", onPointerEnd)
    viewport.addEventListener("lostpointercapture", onLostCapture)
    viewport.addEventListener("mousedown", onMouseDown)
    window.addEventListener("blur", onAbandon)
    document.addEventListener("visibilitychange", onVisibility)
    onWheelRef.current = onWheel
    return () => {
      viewport.removeEventListener("wheel", onWheel)
      viewport.removeEventListener("gesturestart", onGestureStart)
      viewport.removeEventListener("gesturechange", onGestureChange)
      viewport.removeEventListener("gestureend", onGestureEnd)
      viewport.removeEventListener("pointerdown", onPointerDown)
      viewport.removeEventListener("pointermove", onPointerMove)
      viewport.removeEventListener("pointerup", onPointerEnd)
      viewport.removeEventListener("pointercancel", onPointerEnd)
      viewport.removeEventListener("lostpointercapture", onLostCapture)
      viewport.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("blur", onAbandon)
      document.removeEventListener("visibilitychange", onVisibility)
      onWheelRef.current = null
    }
  }, [viewportRef, worldRef, camera, api, onWheelRef])
}

/* Is there something inside a frame that will scroll this wheel itself? Then
   it gets it: a table that scrolls sideways keeps scrolling sideways. */
function scrollsInside(target: EventTarget | null, dx: number, dy: number, world: Element): boolean {
  let el = target instanceof Element ? target : null
  if (!el?.closest("[data-state-canvas-frame]")) return false
  const vertical = Math.abs(dy) >= Math.abs(dx)
  const delta = vertical ? dy : dx
  if (delta === 0) return false
  while (el && el !== world) {
    if (el.hasAttribute("data-state-canvas-frame")) return false
    const style = getComputedStyle(el)
    const overflow = vertical ? style.overflowY : style.overflowX
    if (overflow === "auto" || overflow === "scroll") {
      const max = vertical ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth
      if (max > 1) {
        /* Right-to-left boxes count scrollLeft down from zero. */
        if (!vertical && style.direction === "rtl") return true
        const at = vertical ? el.scrollTop : el.scrollLeft
        if ((delta > 0 && at < max - 1) || (delta < 0 && at > 0)) return true
      }
    }
    el = el.parentElement
  }
  return false
}
