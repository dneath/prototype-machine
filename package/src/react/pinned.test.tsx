import { act, render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { defineMachine } from "../core/machine"
import { sample } from "../core/machine.test"
import { ScenarioPanel } from "./panel"
import { PinnedScenario, ScenarioProvider } from "./provider"
import { panelMounted } from "./test-utils"
import { useScenario } from "./use-scenario"

/* A screen that reads the scenario the way a real one does, and offers the
   product's own button for moving the journey on. */
function Overview({ id }: { id: string }) {
  const p = useScenario(sample)
  return (
    <section data-testid={id}>
      <span data-part="journey">{p.journey}</span>
      <span data-part="data">{p.data}</span>
      <span data-part="step">{p.step}</span>
      <button type="button" onClick={() => p.go("journey", "keyMade")}>
        Create key
      </button>
      <button type="button" onClick={() => p.reset()}>
        Start over
      </button>
    </section>
  )
}

const part = (id: string, name: string) => screen.getByTestId(id).querySelector(`[data-part="${name}"]`)!.textContent

const looks = defineMachine({
  machines: { data: { initial: "real", states: { real: {}, empty: {} } } },
  fields: {
    density: {
      type: "enum",
      default: "comfortable",
      options: ["comfortable", "compact"],
      dom: { attribute: "data-density" },
    },
  },
})

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, "", "/canvas")
  document.documentElement.removeAttribute("data-density")
})

describe("PinnedScenario", () => {
  it("shows a screen in the pinned state, with the machine's tuple", () => {
    render(
      <PinnedScenario machine={sample} values={{ journey: "keyMade", data: "empty" }}>
        <Overview id="a" />
      </PinnedScenario>,
    )
    expect(part("a", "journey")).toBe("keyMade")
    expect(part("a", "data")).toBe("empty")
    expect(part("a", "step")).toBe("2")
  })

  it("puts several on one page, each in its own state", () => {
    render(
      <>
        <PinnedScenario machine={sample} values={{ data: "loading" }}>
          <Overview id="a" />
        </PinnedScenario>
        <PinnedScenario machine={sample} values={{ data: "error" }}>
          <Overview id="b" />
        </PinnedScenario>
      </>,
    )
    expect(part("a", "data")).toBe("loading")
    expect(part("b", "data")).toBe("error")
  })

  it("ignores storage and the URL, and writes neither", () => {
    window.localStorage.setItem("anything", JSON.stringify({ machines: { data: "error" } }))
    window.history.replaceState({}, "", "/canvas?state=error&journey=active")
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    const replace = vi.spyOn(window.history, "replaceState")
    render(
      <PinnedScenario machine={sample} values={{ data: "empty" }}>
        <Overview id="a" />
      </PinnedScenario>,
    )
    act(() => screen.getByRole("button", { name: "Create key" }).click())
    expect(part("a", "data")).toBe("empty")
    expect(part("a", "journey")).toBe("keyMade")
    expect(window.location.search).toBe("?state=error&journey=active")
    expect(setItem).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it("lets the product move the journey inside one, and reset goes back to the pin", () => {
    render(
      <>
        <PinnedScenario machine={sample} values={{ journey: "firstRun" }}>
          <Overview id="a" />
        </PinnedScenario>
        <PinnedScenario machine={sample} values={{ journey: "firstRun" }}>
          <Overview id="b" />
        </PinnedScenario>
      </>,
    )
    act(() => screen.getAllByRole("button", { name: "Create key" })[0].click())
    expect(part("a", "journey")).toBe("keyMade")
    expect(part("b", "journey")).toBe("firstRun")
    act(() => screen.getAllByRole("button", { name: "Start over" })[0].click())
    expect(part("a", "journey")).toBe("firstRun")
  })

  it("mirrors DOM bindings onto its own wrapper, never onto <html>", () => {
    function Probe() {
      const p = useScenario(looks)
      return <span data-testid={`density-${p.density}`} />
    }
    render(
      <>
        <PinnedScenario machine={looks} values={{ density: "compact" }}>
          <Probe />
        </PinnedScenario>
        <PinnedScenario machine={looks}>
          <Probe />
        </PinnedScenario>
      </>,
    )
    const compact = screen.getByTestId("density-compact").closest("[data-pinned-scenario]")!
    const comfortable = screen.getByTestId("density-comfortable").closest("[data-pinned-scenario]")!
    expect(compact.getAttribute("data-density")).toBe("compact")
    expect(comfortable.getAttribute("data-density")).toBe("comfortable")
    expect((compact as HTMLElement).style.display).toBe("contents")
    expect(document.documentElement.hasAttribute("data-density")).toBe(false)
  })

  it("adds no wrapper when nothing mirrors onto the DOM", () => {
    render(
      <PinnedScenario machine={sample}>
        <Overview id="a" />
      </PinnedScenario>,
    )
    expect(document.querySelector("[data-pinned-scenario]")).toBe(null)
  })

  it("keeps a panel inside it from mounting", () => {
    render(
      <PinnedScenario machine={sample}>
        <ScenarioPanel />
      </PinnedScenario>,
    )
    expect(panelMounted()).toBe(false)
  })

  it("sits inside a real provider without touching it", () => {
    function Outer() {
      return <span data-testid="outer">{useScenario(sample).data}</span>
    }
    render(
      <ScenarioProvider machine={sample} storageKey="pinned-outer-v1" enabled>
        <Outer />
        <PinnedScenario machine={sample} values={{ data: "error" }}>
          <Overview id="a" />
        </PinnedScenario>
      </ScenarioProvider>,
    )
    expect(screen.getByTestId("outer").textContent).toBe("real")
    expect(part("a", "data")).toBe("error")
  })

  it("renders the pinned state on the server", () => {
    const html = renderToString(
      <PinnedScenario machine={sample} values={{ data: "empty" }}>
        <Overview id="a" />
      </PinnedScenario>,
    )
    expect(html).toContain(">empty<")
  })

  it("refuses a pin that would show something other than what it says", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const pinned = (values: Record<string, unknown>) =>
      render(<PinnedScenario machine={sample} values={values as never} />)
    expect(() => pinned({ data: "lodaing" })).toThrow(/not one of its states\. Did you mean "loading"\?/)
    expect(() => pinned({ step: 2 })).toThrow(/the "journey" machine writes it\. Pin "journey"/)
    expect(() => pinned({ hasEvents: "yes" })).toThrow(/would refuse to hold/)
    expect(() => pinned({ jurney: "active" })).toThrow(/not a machine or a field\. Did you mean "journey"\?/)
  })
})
