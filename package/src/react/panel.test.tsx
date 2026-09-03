import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { aim } from "../core/machine.test"
import { ScenarioPanel } from "./panel"
import { ScenarioProvider } from "./provider"
import { useScenario } from "./use-scenario"

function Readout() {
  const p = useScenario(aim)
  return (
    <div>
      <span data-testid="journey">{p.journey}</span>
      <span data-testid="step">{String(p.step)}</span>
      <span data-testid="keyIssued">{String(p.keyIssued)}</span>
      <span data-testid="hasTraffic">{String(p.hasTraffic)}</span>
    </div>
  )
}

function mount(props: Partial<React.ComponentProps<typeof ScenarioProvider>> = {}) {
  return render(
    <ScenarioProvider machine={aim} storageKey="panel-test-v1" enabled {...props}>
      <Readout />
      <ScenarioPanel />
    </ScenarioProvider>
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, "", "/")
})

describe("the panel", () => {
  it("starts collapsed and opens", async () => {
    const user = userEvent.setup()
    mount()
    const launcher = screen.getByRole("button", { name: /open prototype controls/i })
    await user.click(launcher)
    expect(screen.getByRole("dialog", { name: "Prototype controls" })).toBeTruthy()
  })

  it("does not render at all when disabled", () => {
    mount({ enabled: false })
    expect(screen.queryByRole("button", { name: /open prototype controls/i })).toBe(null)
  })

  it("still provides context when the controls are off", () => {
    mount({ enabled: false })
    expect(screen.getByTestId("journey").textContent).toBe("firstRun")
  })

  it("moves a machine and writes its whole tuple", async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole("button", { name: /open prototype controls/i }))
    await user.click(screen.getByRole("button", { name: "Key made" }))

    expect(screen.getByTestId("journey").textContent).toBe("keyMade")
    expect(screen.getByTestId("step").textContent).toBe("2")
    expect(screen.getByTestId("keyIssued").textContent).toBe("true")
  })

  it("disables a pill for a move the journey does not allow", async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole("button", { name: /open prototype controls/i }))
    // firstRun -> active is not declared.
    expect(screen.getByRole("button", { name: "Active" }).hasAttribute("disabled")).toBe(true)
    expect(screen.getByRole("button", { name: "Key made" }).hasAttribute("disabled")).toBe(false)
  })

  it("closes on Escape", async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole("button", { name: /open prototype controls/i }))
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null))
  })

  it("lets a URL beat what this browser had stored", () => {
    window.localStorage.setItem(
      "panel-test-v1",
      JSON.stringify({ machines: { journey: "parked" }, fields: {} })
    )
    window.history.replaceState({}, "", "/?journey=keyMade")
    mount()
    expect(screen.getByTestId("journey").textContent).toBe("keyMade")
  })

  it("persists across a remount", async () => {
    const user = userEvent.setup()
    const first = mount()
    await user.click(screen.getByRole("button", { name: /open prototype controls/i }))
    await user.click(screen.getByRole("button", { name: "Key made" }))
    first.unmount()

    mount()
    expect(screen.getByTestId("journey").textContent).toBe("keyMade")
  })

  it("refuses a direct write to a key a machine owns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    function Rogue() {
      const p = useScenario(aim)
      return (
        <button type="button" onClick={() => p.set({ keyIssued: true } as never)}>
          cheat
        </button>
      )
    }
    const user = userEvent.setup()
    render(
      <ScenarioProvider machine={aim} storageKey="panel-test-v1" enabled>
        <Readout />
        <Rogue />
      </ScenarioProvider>
    )
    await user.click(screen.getByRole("button", { name: "cheat" }))

    expect(screen.getByTestId("keyIssued").textContent).toBe("false")
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('written by the "journey" machine'))
    warn.mockRestore()
  })
})
