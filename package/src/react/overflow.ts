/* Overflow, measured. A canvas frame is the container its component would
 * sit in, so two things are worth knowing about each one without having to
 * spot them by eye:
 *
 *   SPILL. The component is wider than its container. On the canvas the
 *   extra is drawn past the frame's edge, over the dark surface, where dark
 *   text disappears: exactly where the break is, it is hardest to see.
 *
 *   CLIP. Something inside hides content without saying so: `overflow:
 *   hidden` on a box whose content does not fit. A table that loses its last
 *   three columns at 320px looks tidy, which is why it ships.
 *
 * Both are observations of the rendered page, never predictions. Boxes that
 * show their cut are left alone: a scroll container can be scrolled, and an
 * ellipsis or a line clamp says that text continues. */

export interface Overflow {
  /** How many pixels wider than its container the component is. 0 when it fits. */
  spill: number
  /** How many boxes inside cut off content without an ellipsis or a scrollbar. */
  clipped: number
}

/** A pixel of slack for subpixel layout. */
const SLACK = 1

function hides(value: string): boolean {
  return value === "hidden" || value === "clip"
}

/** What the frame's content does to its container. Reads layout; writes nothing. */
export function inspectOverflow(frame: HTMLElement): Overflow {
  const spill = Math.max(0, frame.scrollWidth - frame.clientWidth)
  let clipped = 0
  for (const el of frame.querySelectorAll<HTMLElement>("*")) {
    /* Cheap reads first: almost nothing overflows, so most elements never
       reach getComputedStyle. Inline boxes report zero for both. */
    const wide = el.scrollWidth > el.clientWidth + SLACK && el.clientWidth > 0
    const tall = el.scrollHeight > el.clientHeight + SLACK && el.clientHeight > 0
    if (!wide && !tall) continue
    const style = getComputedStyle(el)
    /* The longhands, or the shorthand where an engine leaves them empty. */
    const cutX = wide && hides(style.overflowX || style.overflow) && style.textOverflow !== "ellipsis"
    const clamp = style.getPropertyValue("-webkit-line-clamp")
    const cutY = tall && hides(style.overflowY || style.overflow) && (!clamp || clamp === "none")
    if (cutX || cutY) clipped++
  }
  return { spill: spill > SLACK ? Math.round(spill) : 0, clipped }
}

/** The finding in a few words, for the note above a frame. Empty when it fits. */
export function describeOverflow({ spill, clipped }: Overflow): string {
  const parts: string[] = []
  if (spill) parts.push(`${spill}px too wide`)
  if (clipped) parts.push(clipped === 1 ? "cuts off content" : `cuts off content in ${clipped} places`)
  const text = parts.join(", ")
  return text ? text[0].toUpperCase() + text.slice(1) : ""
}
