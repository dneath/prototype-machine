import { describe, expect, it } from "vitest"

import { describeOverflow, inspectOverflow } from "./overflow"

/* jsdom has no layout, so each box is given the sizes a browser would
   measure. */
function box(el: HTMLElement, sizes: { scrollWidth?: number; clientWidth?: number; scrollHeight?: number; clientHeight?: number }) {
  for (const [key, value] of Object.entries(sizes)) Object.defineProperty(el, key, { configurable: true, value })
  return el
}

function frame(html: string, width = 320) {
  const el = document.createElement("div")
  el.innerHTML = html
  box(el, { scrollWidth: width, clientWidth: width })
  return el
}

describe("inspectOverflow", () => {
  it("finds nothing when everything fits", () => {
    expect(inspectOverflow(frame("<p>Fits</p>"))).toEqual({ spill: 0, clipped: 0 })
  })

  it("measures a component wider than its container", () => {
    const el = frame("<table></table>")
    box(el, { scrollWidth: 454, clientWidth: 320 })
    expect(inspectOverflow(el).spill).toBe(134)
  })

  it("ignores a subpixel of slack", () => {
    const el = frame("<p></p>")
    box(el, { scrollWidth: 320.6, clientWidth: 320 })
    expect(inspectOverflow(el).spill).toBe(0)
  })

  it("counts a box that hides content it cannot fit", () => {
    const el = frame('<section style="overflow: hidden"><table></table></section>')
    box(el.querySelector("section")!, { scrollWidth: 900, clientWidth: 320 })
    expect(inspectOverflow(el).clipped).toBe(1)
  })

  it("counts a box that cuts off text at the bottom", () => {
    const el = frame('<div style="overflow-y: hidden; height: 40px"><p>Long</p></div>')
    box(el.querySelector("div")!, { scrollHeight: 120, clientHeight: 40, scrollWidth: 320, clientWidth: 320 })
    expect(inspectOverflow(el).clipped).toBe(1)
  })

  it("leaves alone a box that shows its cut: a scroller, an ellipsis, a line clamp", () => {
    const el = frame(`
      <div class="a" style="overflow-x: auto"></div>
      <div class="b" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap"></div>
      <div class="c" style="overflow: hidden; -webkit-line-clamp: 2; display: -webkit-box"></div>
      <div class="d" style="overflow: hidden"></div>
    `)
    box(el.querySelector(".a")!, { scrollWidth: 900, clientWidth: 320 })
    box(el.querySelector(".b")!, { scrollWidth: 900, clientWidth: 320 })
    box(el.querySelector(".c")!, { scrollHeight: 200, clientHeight: 40, scrollWidth: 320, clientWidth: 320 })
    /* Hidden, but its content fits: rounding corners, not cutting. */
    box(el.querySelector(".d")!, { scrollWidth: 320, clientWidth: 320 })
    expect(inspectOverflow(el).clipped).toBe(0)
  })
})

describe("describeOverflow", () => {
  it("says what was measured, in a few words", () => {
    expect(describeOverflow({ spill: 0, clipped: 0 })).toBe("")
    expect(describeOverflow({ spill: 134, clipped: 0 })).toBe("134px too wide")
    expect(describeOverflow({ spill: 0, clipped: 1 })).toBe("Cuts off content")
    expect(describeOverflow({ spill: 12, clipped: 3 })).toBe("12px too wide, cuts off content in 3 places")
  })
})
