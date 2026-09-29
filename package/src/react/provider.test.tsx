import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { compile, defineMachine, ScenarioError } from "../core/machine"
import { aim } from "../core/machine.test"
import { ScenarioPanel } from "./panel"
import { ScenarioProvider, type Scenario } from "./provider"
import { useScenario, useScenarioValue } from "./use-scenario"

const counted = defineMachine({
  machines: aim.config.machines,
  fields: {
    seats: { type: "number", label: "Seats", default: 1, min: 0, max: 10 },
    name: { type: "string", label: "Name", default: "x" },
  },
})

let handle: Scenario | null = null

function Grab() {
  handle = useScenario()
  return <span data-testid="journey">{String((handle as unknown as { journey: string }).journey)}</span>
}

function mount(machine: typeof counted | typeof aim = aim, children: React.ReactNode = null) {
  return render(
    <ScenarioProvider machine={machine} storageKey="provider-test-v1" enabled>
      <Grab />
      {children}
    </ScenarioProvider>
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, "", "/")
  handle = null
})

describe("the provider", () => {
  it("applies two moves made in one handler", () => {
    mount()
    act(() => {
      handle!.go("journey", "keyMade")
      handle!.go("journey", "requestIn")
    })
    expect(screen.getByTestId("journey").textContent).toBe("requestIn")
  })

  it("keeps both of two sets made in one handler", () => {
    mount(counted)
    act(() => {
      handle!.set({ seats: 7 })
      handle!.set({ name: "y" })
    })
    expect(handle!.snapshot.fields).toMatchObject({ seats: 7, name: "y" })
  })

  it("applies a move made right after reset", () => {
    mount()
    act(() => handle!.go("journey", "keyMade"))
    act(() => {
      handle!.reset()
      handle!.go("journey", "keyMade")
    })
    expect(screen.getByTestId("journey").textContent).toBe("keyMade")
  })

  it("refuses an out-of-range value and warns", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    mount(counted)
    act(() => handle!.set({ seats: 999 }))
    expect(handle!.snapshot.fields.seats).toBe(1)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("useScenarioValue skips renders for unrelated changes", () => {
    let renders = 0
    function Seats() {
      renders++
      const seats = useScenarioValue(counted, "seats")
      return <span data-testid="seats">{String(seats)}</span>
    }
    mount(counted, <Seats />)
    const before = renders
    act(() => handle!.set({ name: "y" }))
    expect(renders).toBe(before)
    act(() => handle!.set({ seats: 4 }))
    expect(screen.getByTestId("seats").textContent).toBe("4")
  })
})

describe("the number input", () => {
  it("does not commit 0 while the input is cleared", async () => {
    const user = userEvent.setup()
    mount(counted, <ScenarioPanel />)
    await user.click(screen.getByRole("button", { name: /open prototype controls/i }))
    act(() => handle!.set({ seats: 5 }))
    const input = screen.getByRole("spinbutton") as HTMLInputElement
    await user.clear(input)
    expect(handle!.snapshot.fields.seats).toBe(5)
    await user.type(input, "3")
    expect(handle!.snapshot.fields.seats).toBe(3)
  })
})

describe("Escape", () => {
  it("does not close the panel when pressed in the host's own input", async () => {
    const user = userEvent.setup()
    mount(aim, (
      <>
        <input aria-label="host" />
        <ScenarioPanel />
      </>
    ))
    await user.click(screen.getByRole("button", { name: /open prototype controls/i }))
    const host = screen.getByLabelText("host")
    host.focus()
    fireEvent.keyDown(host, { key: "Escape" })
    expect(screen.getByRole("dialog")).toBeTruthy()
  })
})

describe("inherited names", () => {
  it("accepts a field called toString", () => {
    expect(() => compile({ machines: {}, fields: { toString: { type: "boolean", default: false } } } as never)).not.toThrow(ScenarioError)
  })
})

describe("the URL", () => {
  it("is authoritative: storage does not leak into a linked scenario", () => {
    window.localStorage.setItem("provider-test-v1", JSON.stringify({ machines: { data: "error" } }))
    window.history.replaceState({}, "", "/p?journey=keyMade")
    mount()
    expect(handle!.snapshot.machines).toMatchObject({ journey: "keyMade", data: "real" })
  })

  it("is read once and stripped by default, keeping the host's params", () => {
    window.history.replaceState({}, "", "/p?id=42&journey=keyMade#h")
    mount()
    expect(window.location.search).toBe("?id=42")
    expect(window.location.hash).toBe("#h")
    expect(handle!.snapshot.machines.journey).toBe("keyMade")
  })

  it("follows the scenario with syncUrl", async () => {
    window.history.replaceState({}, "", "/p?id=42")
    render(
      <ScenarioProvider machine={aim} storageKey="provider-test-v1" enabled syncUrl>
        <Grab />
      </ScenarioProvider>
    )
    act(() => handle!.go("journey", "keyMade"))
    await act(() => new Promise((r) => requestAnimationFrame(() => r(null))))
    expect(new URLSearchParams(window.location.search).get("journey")).toBe("keyMade")
    expect(new URLSearchParams(window.location.search).get("id")).toBe("42")
  })
})

describe("several providers and tabs", () => {
  it("warns when two providers share a storageKey", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <>
        <ScenarioProvider machine={aim} storageKey="dup-v1" enabled />
        <ScenarioProvider machine={aim} storageKey="dup-v1" enabled />
      </>
    )
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('share the storageKey "dup-v1"'))
    spy.mockRestore()
  })

  it("follows another tab with syncTabs", () => {
    render(
      <ScenarioProvider machine={aim} storageKey="tabs-v1" enabled syncTabs>
        <Grab />
      </ScenarioProvider>
    )
    expect(screen.getByTestId("journey").textContent).toBe("firstRun")
    act(() => {
      window.localStorage.setItem("tabs-v1", JSON.stringify({ machines: { journey: "keyMade" } }))
      window.dispatchEvent(new StorageEvent("storage", { key: "tabs-v1" }))
    })
    expect(screen.getByTestId("journey").textContent).toBe("keyMade")
  })
})
