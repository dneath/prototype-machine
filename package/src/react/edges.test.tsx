import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { sample } from "../core/machine.test"
import { MAX_BAR_SHARE, NO_EDGES, edgeInsetsFrom, measureEdges } from "./edges"
import { ScenarioPanel } from "./panel"
import { ScenarioProvider } from "./provider"
import { StateBench } from "./switcher"
import { panelRoot, switcherRoot } from "./test-utils"

const VIEW = { width: 1280, height: 800 }
const box = (top: number, bottom: number, left = 0, right = 1280) => ({ top, bottom, left, right })

describe("edgeInsetsFrom()", () => {
  it("measures a bar on each edge", () => {
    expect(edgeInsetsFrom([box(0, 28), box(772, 800)], VIEW)).toEqual({ top: 28, bottom: 28 })
  })
  it("takes the tallest bar on an edge, rounded up", () => {
    expect(edgeInsetsFrom([box(0, 24), box(0, 64.2)], VIEW)).toEqual({ top: 65, bottom: 0 })
  })
  it("ignores what is not a bar", () => {
    expect(
      edgeInsetsFrom(
        [
          box(0, 800), // a modal backdrop
          box(0, 800, 0, 240), // a sidebar
          box(740, 790, 900, 1260), // a toast: narrow and off the edge
          box(300, 360), // a full-width strip in the middle
          box(0, VIEW.height * MAX_BAR_SHARE + 1), // too tall to be a bar
          box(-40, 0), // scrolled off the top
        ],
        VIEW,
      ),
    ).toBe(NO_EDGES)
  })
})

/* jsdom has no layout. Give one element a fixed position and a box, and make
   the hit test find it. */
let bar: HTMLElement | null = null
function fixedBar(edge: "top" | "bottom", height: number) {
  bar = document.createElement("div")
  bar.style.position = "fixed"
  document.body.appendChild(bar)
  const top = edge === "top" ? 0 : window.innerHeight - height
  bar.getBoundingClientRect = () =>
    ({ top, bottom: top + height, left: 0, right: window.innerWidth, width: window.innerWidth, height }) as DOMRect
  const child = document.createElement("span")
  bar.appendChild(child)
  document.elementsFromPoint = (_x: number, y: number) =>
    (edge === "top" ? y < height : y >= window.innerHeight - height) ? [child, bar!, document.body] : [document.body]
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, "", "/")
})
afterEach(() => {
  bar?.remove()
  bar = null
  delete (document as { elementsFromPoint?: unknown }).elementsFromPoint
})

describe("measureEdges()", () => {
  it("finds a fixed ancestor of what the hit test returns", () => {
    fixedBar("bottom", 30)
    expect(measureEdges()).toEqual({ top: 0, bottom: 30 })
  })
  it("returns nothing where the browser cannot hit-test", () => {
    expect(measureEdges()).toBe(NO_EDGES)
  })
  it("never counts its own tools", () => {
    const host = document.createElement("prototype-machine")
    host.style.position = "fixed"
    host.getBoundingClientRect = () => ({ top: 770, bottom: 800, left: 0, right: 1024 }) as DOMRect
    document.body.appendChild(host)
    document.elementsFromPoint = () => [host, document.body]
    expect(measureEdges()).toBe(NO_EDGES)
    host.remove()
  })
})

const STATES = { empty: "Empty", typical: "Typical" }
const nav = () => switcherRoot().querySelector("nav") as HTMLElement
const spacer = () => document.querySelector("[data-state-bench-spacer]") as HTMLElement

describe("keeping clear of edge bars", () => {
  it("lifts the switcher above a bar on its edge, and grows the spacer", () => {
    fixedBar("bottom", 30)
    render(<StateBench states={STATES} enabled>{(s) => <p>{s}</p>}</StateBench>)
    expect(nav().style.bottom).toBe("38px")
    expect(spacer().style.height).toBe("118px")
  })

  it("moves a top switcher below a top bar", () => {
    fixedBar("top", 48)
    render(<StateBench states={STATES} placement="top" enabled>{(s) => <p>{s}</p>}</StateBench>)
    expect(nav().style.top).toBe("56px")
  })

  it("keeps the default distance when there is no bar", () => {
    render(<StateBench states={STATES} enabled>{(s) => <p>{s}</p>}</StateBench>)
    expect(nav().style.bottom).toBe("")
    expect(spacer().style.height).toBe("88px")
  })

  it("lets an explicit offset win", () => {
    fixedBar("bottom", 30)
    render(<StateBench states={STATES} offset={12} enabled>{(s) => <p>{s}</p>}</StateBench>)
    expect(nav().style.bottom).toBe("12px")
  })

  it("can be turned off", () => {
    fixedBar("bottom", 30)
    render(<StateBench states={STATES} avoidBars={false} enabled>{(s) => <p>{s}</p>}</StateBench>)
    expect(nav().style.bottom).toBe("")
  })

  it("follows a bar that appears later", async () => {
    render(<StateBench states={STATES} enabled>{(s) => <p>{s}</p>}</StateBench>)
    expect(nav().style.bottom).toBe("")
    fixedBar("bottom", 40)
    await act(() => new Promise((r) => setTimeout(r, 150)))
    expect(nav().style.bottom).toBe("48px")
  })

  it("moves the panel's corner by the bar's height", () => {
    fixedBar("bottom", 30)
    render(
      <ScenarioProvider machine={sample} storageKey="edges-test-v1" enabled>
        <ScenarioPanel tools={false} />
      </ScenarioProvider>,
    )
    const launcher = panelRoot().querySelector(".pm-launcher") as HTMLElement
    expect(launcher.style.getPropertyValue("--pm-edge-bottom")).toBe("30px")
  })

  it("leaves the panel alone with avoidBars={false}", () => {
    fixedBar("bottom", 30)
    render(
      <ScenarioProvider machine={sample} storageKey="edges-test-v1" enabled>
        <ScenarioPanel tools={false} avoidBars={false} />
      </ScenarioProvider>,
    )
    const launcher = panelRoot().querySelector(".pm-launcher") as HTMLElement
    expect(launcher.style.getPropertyValue("--pm-edge-bottom")).toBe("")
  })
})
