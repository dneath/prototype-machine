import { act, fireEvent, render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { defineMachine } from "../core/machine"
import { ScenarioPanel } from "./panel"
import { ScenarioProvider, type Scenario } from "./provider"
import { keyValue, snap, valueAt } from "./slider"
import { ui } from "./test-utils"
import { useScenario } from "./use-scenario"

describe("slider maths", () => {
  it("snaps to the nearest step without floating point drift", () => {
    expect(snap(0.30000000000000004, 0, 1, 0.1)).toBe(0.3)
    expect(snap(0.74, 0, 1, 0.25)).toBe(0.75)
    expect(snap(7, 0, 10, 5)).toBe(5)
    expect(snap(8, 0, 10, 5)).toBe(10)
  })

  it("clamps to the bounds", () => {
    expect(snap(-4, 0, 10, 1)).toBe(0)
    expect(snap(40, 0, 10, 1)).toBe(10)
  })

  it("steps from the minimum, not from zero", () => {
    expect(snap(4, 1, 11, 2)).toBe(5)
  })

  it("reads a pointer position against the track's box", () => {
    expect(valueAt(150, 100, 200, 0, 100, 1)).toBe(25)
    expect(valueAt(50, 100, 200, 0, 100, 1)).toBe(0)
    expect(valueAt(900, 100, 200, 0, 100, 1)).toBe(100)
    expect(valueAt(150, 100, 0, 0, 100, 1)).toBe(0)
  })

  it("moves one step on an arrow, ten with Shift or Page keys, and to the ends on Home and End", () => {
    expect(keyValue("ArrowRight", false, 5, 0, 100, 1)).toBe(6)
    expect(keyValue("ArrowDown", false, 5, 0, 100, 1)).toBe(4)
    expect(keyValue("ArrowUp", true, 5, 0, 100, 1)).toBe(15)
    expect(keyValue("PageDown", false, 5, 0, 100, 1)).toBe(0)
    expect(keyValue("Home", false, 5, 0, 100, 1)).toBe(0)
    expect(keyValue("End", false, 5, 0, 100, 1)).toBe(100)
    expect(keyValue("a", false, 5, 0, 100, 1)).toBeUndefined()
  })
})

const tuned = defineMachine({
  fields: {
    radius: { type: "number", label: "Radius", default: 8, min: 0, max: 40, step: 2, control: "range" },
    level: { type: "number", label: "Level", default: 2, min: 0, max: 4, control: "range" },
  },
})

let handle: Scenario | null = null
function Grab() {
  handle = useScenario()
  return null
}

async function open() {
  const user = userEvent.setup()
  render(
    <ScenarioProvider machine={tuned} storageKey="slider-test-v1" enabled>
      <Grab />
      <ScenarioPanel />
    </ScenarioProvider>,
  )
  await user.click(ui.getByRole("button", { name: /open prototype controls/i }))
  return user
}

/* jsdom has no PointerEvent, so fireEvent would drop clientX and button. A
   MouseEvent carries both, plus the pointerId the slider captures. */
if (typeof window.PointerEvent === "undefined") {
  class PointerEventShim extends MouseEvent {
    pointerId: number
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
    }
  }
  ;(window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventShim
}

beforeEach(() => {
  window.localStorage.clear()
  handle = null
})

describe("the slider in the panel", () => {
  it("is a labelled slider that reports its value and bounds", async () => {
    await open()
    const slider = ui.getByRole("slider", { name: "Radius" })
    expect(slider.getAttribute("aria-valuenow")).toBe("8")
    expect(slider.getAttribute("aria-valuemin")).toBe("0")
    expect(slider.getAttribute("aria-valuemax")).toBe("40")
  })

  it("steps with the keyboard", async () => {
    const user = await open()
    ui.getByRole("slider", { name: "Radius" }).focus()
    await user.keyboard("{ArrowRight}")
    expect(handle!.snapshot.fields.radius).toBe(10)
    await user.keyboard("{Shift>}{ArrowLeft}{/Shift}")
    expect(handle!.snapshot.fields.radius).toBe(0)
    await user.keyboard("{End}")
    expect(handle!.snapshot.fields.radius).toBe(40)
  })

  it("jumps to a press and follows a drag", async () => {
    await open()
    const slider = ui.getByRole("slider", { name: "Radius" })
    slider.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, right: 200, bottom: 28, height: 28, x: 0, y: 0, toJSON() {} })
    act(() => {
      fireEvent.pointerDown(slider, { button: 0, clientX: 50, pointerId: 1 })
    })
    expect(handle!.snapshot.fields.radius).toBe(10)
    act(() => {
      fireEvent.pointerMove(slider, { clientX: 150, pointerId: 1 })
    })
    expect(handle!.snapshot.fields.radius).toBe(30)
    act(() => {
      fireEvent.pointerUp(slider, { clientX: 150, pointerId: 1 })
      fireEvent.pointerMove(slider, { clientX: 0, pointerId: 1 })
    })
    expect(handle!.snapshot.fields.radius).toBe(30)
  })

  it("takes a typed value in the box beside it", async () => {
    await open()
    const box = ui.getByRole("spinbutton", { name: "Radius, exact value" })
    fireEvent.change(box, { target: { value: "24" } })
    expect(handle!.snapshot.fields.radius).toBe(24)
    expect(ui.getByRole("slider", { name: "Radius" }).getAttribute("aria-valuenow")).toBe("24")
  })

  it("draws a tick between steps only when there are few of them", async () => {
    await open()
    const ticks = (name: string) => ui.getByRole("slider", { name }).querySelectorAll(".pm-slider-tick").length
    expect(ticks("Level")).toBe(3)
    expect(ticks("Radius")).toBe(0)
  })
})
