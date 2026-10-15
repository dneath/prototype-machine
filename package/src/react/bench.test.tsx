import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { defineMachine } from "../core/machine"
import { sample } from "../core/machine.test"
import { type BenchStates, type StateBenchProps, STATE_PARAM, useStateParam } from "./bench-state"
import { ScenarioPanel } from "./panel"
import { ScenarioProvider } from "./provider"
import { StateBench, StateSwitcher } from "./switcher"
import { bar, panelRoot, switcherMounted, switcherRoot, ui } from "./test-utils"
import { useScenario } from "./use-scenario"
import * as production from "../production"

/* A component with the branches a real one has. The bench feeds it through
   props, at the boundary where the app would. */
function AuditLog({ rows, loading, error }: { rows?: readonly string[]; loading?: boolean; error?: string }) {
  const [mounts] = React.useState(() => ++mountCount)
  if (loading) return <p data-testid="body">Loading audit events</p>
  if (error) return <p data-testid="body">{error}</p>
  if (!rows?.length) return <p data-testid="body">No audit events in this range</p>
  return (
    <ul data-testid="body" data-mount={mounts}>
      {rows.map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ul>
  )
}
let mountCount = 0

const FIXTURES = {
  loading: { loading: true },
  empty: { rows: [] },
  one: { rows: ["j.rivera rotated key ak-7f2c"] },
  typical: { rows: ["j.rivera rotated key ak-7f2c", "m.chen invited t.ito", "t.ito joined Project 4"] },
  error: { error: "The audit service did not answer" },
} as const

const STATES = {
  loading: "Loading",
  empty: "Empty",
  one: "One event",
  typical: { label: "Typical", note: "Three events from today" },
  error: "Error",
}

function Bench({ states = STATES, initial = "typical", ...rest }: Partial<Omit<StateBenchProps<BenchStates>, "children">> = {}) {
  return (
    <StateBench states={states} initial={initial} width={960} enabled {...rest}>
      {(state) => <AuditLog {...FIXTURES[state as keyof typeof FIXTURES]} />}
    </StateBench>
  )
}

const body = () => screen.getByTestId("body").textContent
const pressed = () => bar.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent)

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, "", "/states/audit-log")
  mountCount = 0
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe("StateBench", () => {
  it("shows the initial state when the URL names none, and leaves the URL alone", () => {
    render(<Bench />)
    expect(body()).toContain("m.chen invited")
    expect(window.location.search).toBe("")
    expect(pressed()).toEqual(["Typical"])
  })

  it("reads the state from __state", () => {
    window.history.replaceState({}, "", "/states/audit-log?__state=empty")
    render(<Bench />)
    expect(body()).toBe("No audit events in this range")
    expect(document.querySelector("[data-state-bench]")!.getAttribute("data-state")).toBe("empty")
  })

  it("writes __state on a click, keeps every other parameter and the hash, and adds no history", async () => {
    window.history.replaceState({}, "", "/states/audit-log?tenant=range-4#top")
    const before = window.history.length
    const user = userEvent.setup()
    render(<Bench />)
    await user.click(bar.getByRole("button", { name: "Error" }))
    expect(body()).toBe("The audit service did not answer")
    const params = new URLSearchParams(window.location.search)
    expect(params.get(STATE_PARAM)).toBe("error")
    expect(params.get("tenant")).toBe("range-4")
    expect(window.location.hash).toBe("#top")
    expect(window.history.length).toBe(before)
    expect(pressed()).toEqual(["Error"])
  })

  it("follows back and forward", () => {
    render(<Bench />)
    act(() => {
      window.history.replaceState({}, "", "/states/audit-log?__state=loading")
      window.dispatchEvent(new PopStateEvent("popstate"))
    })
    expect(body()).toBe("Loading audit events")
  })

  it("falls back to the initial state for an unknown id, with a suggestion", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    window.history.replaceState({}, "", "/states/audit-log?__state=emty")
    render(<Bench />)
    expect(body()).toContain("m.chen invited")
    expect(spy.mock.calls.flat().join(" ")).toMatch(/Did you mean "empty"/)
  })

  it("mounts each state fresh", async () => {
    const user = userEvent.setup()
    render(<Bench />)
    expect(screen.getByTestId("body").getAttribute("data-mount")).toBe("1")
    await user.click(bar.getByRole("button", { name: "Empty" }))
    await user.click(bar.getByRole("button", { name: "Typical" }))
    expect(screen.getByTestId("body").getAttribute("data-mount")).toBe("3")
  })

  it("sets the container to the production width and nothing else", () => {
    render(<Bench />)
    const box = document.querySelector<HTMLElement>("[data-state-bench]")!
    expect(box.style.width).toBe("960px")
    expect(box.style.maxWidth).toBe("100%")
    expect(box.style.cssText.split(";").filter(Boolean)).toHaveLength(2)
  })

  it("uses its own parameter when asked", async () => {
    const user = userEvent.setup()
    render(<Bench param="__log" />)
    await user.click(bar.getByRole("button", { name: "Empty" }))
    expect(new URLSearchParams(window.location.search).get("__log")).toBe("empty")
  })

  it("throws on a config no page could show", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<Bench states={{}} />)).toThrow(/no states/)
    expect(() => render(<Bench initial={"tipical" as never} />)).toThrow(/Did you mean "typical"/)
    expect(() => render(<Bench missing={{ empty: "Empty" }} />)).toThrow(/both a state and missing/)
  })

  it("renders nothing on the server, so the wrong state never flashes", () => {
    const html = renderToString(<Bench />)
    expect(html).toContain("data-state-bench")
    expect(html).not.toContain("m.chen")
  })
})

describe("the switcher", () => {
  it("is a labelled nav of toggle buttons, in the declared order", () => {
    render(<Bench />)
    const nav = bar.getByRole("navigation", { name: "States" })
    expect(nav).toBeTruthy()
    const names = bar.getAllByRole("button").map((b) => b.textContent)
    expect(names.slice(0, 5)).toEqual(["Loading", "Empty", "One event", "Typical", "Error"])
  })

  it("lives in its own shadow root, apart from the panel", () => {
    render(
      <ScenarioProvider machine={sample} storageKey="bench-panel-v1" enabled>
        <Bench />
        <ScenarioPanel tools={false} />
      </ScenarioProvider>,
    )
    expect(switcherRoot()).not.toBe(panelRoot())
    expect(ui.getByRole("button", { name: /open prototype controls/i })).toBeTruthy()
    expect(bar.getByRole("navigation", { name: "States" })).toBeTruthy()
  })

  it("steps with the arrow keys, Home and End while focus is inside it", () => {
    render(<Bench />)
    const typical = bar.getByRole("button", { name: "Typical" })
    typical.focus()
    fireEvent.keyDown(typical, { key: "ArrowRight" })
    expect(body()).toBe("The audit service did not answer")
    expect(switcherRoot().activeElement?.textContent).toBe("Error")
    fireEvent.keyDown(switcherRoot().activeElement!, { key: "ArrowRight" })
    expect(body()).toBe("Loading audit events")
    fireEvent.keyDown(switcherRoot().activeElement!, { key: "End" })
    expect(pressed()).toEqual(["Error"])
    fireEvent.keyDown(switcherRoot().activeElement!, { key: "Home" })
    expect(pressed()).toEqual(["Loading"])
    fireEvent.keyDown(switcherRoot().activeElement!, { key: "ArrowLeft" })
    expect(pressed()).toEqual(["Error"])
  })

  it("ignores arrows with a modifier key", () => {
    render(<Bench />)
    const typical = bar.getByRole("button", { name: "Typical" })
    fireEvent.keyDown(typical, { key: "ArrowRight", metaKey: true })
    fireEvent.keyDown(typical, { key: "ArrowRight", shiftKey: true })
    expect(pressed()).toEqual(["Typical"])
  })

  it("binds no key on the page", () => {
    render(<Bench />)
    for (const key of ["ArrowRight", "ArrowLeft", "1", "2", "h", "H", "Home", "End"]) {
      fireEvent.keyDown(document.body, { key })
      fireEvent.keyDown(document, { key })
    }
    expect(pressed()).toEqual(["Typical"])
    expect(switcherMounted()).toBe(true)
  })

  it("lists missing states, disabled, with the reason, and never renders them", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const user = userEvent.setup()
    render(<Bench missing={{ partial: { label: "Some pending", note: "requests resolve one by one" } }} />)
    const partial = bar.getByRole("button", { name: "Some pending" })
    expect(partial.getAttribute("aria-disabled")).toBe("true")
    expect(partial.getAttribute("aria-pressed")).toBe("false")
    const describedBy = partial.getAttribute("aria-describedby")!
    expect(switcherRoot().getElementById(describedBy)!.textContent).toBe("Not in the code yet: requests resolve one by one.")
    await user.click(partial)
    expect(pressed()).toEqual(["Typical"])
    expect(new URLSearchParams(window.location.search).has(STATE_PARAM)).toBe(false)

    /* Stepping skips it. */
    const error = bar.getByRole("button", { name: "Error" })
    error.focus()
    fireEvent.keyDown(error, { key: "ArrowRight" })
    expect(pressed()).toEqual(["Loading"])

    /* A link to it says it is missing. */
    spy.mockClear()
    act(() => {
      window.history.replaceState({}, "", "/states/audit-log?__state=partial")
      window.dispatchEvent(new PopStateEvent("popstate"))
    })
    expect(body()).toContain("m.chen invited")
    expect(spy.mock.calls.flat().join(" ")).toMatch(/listed as missing/)
  })

  it("shows a state's note as its tooltip", () => {
    render(<Bench />)
    expect(bar.getByRole("button", { name: "Typical" }).getAttribute("title")).toBe("Three events from today")
  })

  it("hides until the page reloads, keeping the state on screen", async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, "", "/states/audit-log?__state=empty")
    render(<Bench />)
    expect(document.querySelector("[data-state-bench-spacer]")).not.toBe(null)
    await user.click(bar.getByRole("button", { name: "Hide states" }))
    expect(switcherMounted()).toBe(false)
    expect(body()).toBe("No audit events in this range")
    expect(document.querySelector("[data-state-bench-spacer]")).toBe(null)
  })

  it("moves to the top edge and takes an offset", () => {
    render(<Bench placement="top" offset="calc(var(--banner-h) + 8px)" />)
    const nav = bar.getByRole("navigation", { name: "States" })
    expect(nav.className).toContain("pm-switcher-top")
    expect(nav.style.top).toBe("calc(var(--banner-h) + 8px)")
    const spacer = document.querySelector("[data-state-bench-spacer]")!
    expect(spacer.nextElementSibling?.hasAttribute("data-state-bench")).toBe(true)
  })

  it("does not mount when disabled, and the state still renders", () => {
    window.history.replaceState({}, "", "/states/audit-log?__state=error")
    render(<Bench enabled={false} />)
    expect(switcherMounted()).toBe(false)
    expect(body()).toBe("The audit service did not answer")
  })
})

describe("the production bench", () => {
  it("renders the state the URL names, with no switcher", () => {
    window.history.replaceState({}, "", "/states/audit-log?__state=one")
    render(
      <production.StateBench states={STATES} width={960}>
        {(state) => <AuditLog {...FIXTURES[state as keyof typeof FIXTURES]} />}
      </production.StateBench>,
    )
    expect(body()).toContain("j.rivera")
    expect(switcherMounted()).toBe(false)
    expect(production.StateSwitcher({ machine: "data" })).toBe(null)
  })
})

describe("useStateParam", () => {
  it("is usable on its own, for a custom bench layout", () => {
    let set: (s: "a" | "b") => void = () => {}
    function Probe() {
      const [state, setState] = useStateParam(["a", "b"] as const, { initial: "a" })
      set = setState
      return <span data-testid="probe">{state}</span>
    }
    render(<Probe />)
    expect(screen.getByTestId("probe").textContent).toBe("a")
    act(() => set("b"))
    expect(screen.getByTestId("probe").textContent).toBe("b")
    expect(window.location.search).toBe("?__state=b")
  })
})

describe("StateSwitcher", () => {
  function Readout() {
    const p = useScenario(sample)
    return <span data-testid="journey">{p.journey}</span>
  }
  function mount(props: Partial<React.ComponentProps<typeof StateSwitcher>> = {}, provider: Partial<React.ComponentProps<typeof ScenarioProvider>> = {}) {
    return render(
      <ScenarioProvider machine={sample} storageKey="switcher-test-v1" enabled {...provider}>
        <Readout />
        <StateSwitcher machine="journey" {...props} />
      </ScenarioProvider>,
    )
  }

  it("lists a machine's states under its label", () => {
    mount()
    expect(bar.getByRole("navigation", { name: "Get connected" })).toBeTruthy()
    expect(pressed()).toEqual(["First run"])
  })

  it("draws illegal moves disabled, with the reason, and refuses them", async () => {
    const user = userEvent.setup()
    mount()
    const active = bar.getByRole("button", { name: "Active" })
    expect(active.getAttribute("aria-disabled")).toBe("true")
    expect(active.getAttribute("title")).toBe("Not reachable from First run. From here: Key made, Parked.")
    await user.click(active)
    expect(screen.getByTestId("journey").textContent).toBe("firstRun")
    await user.click(bar.getByRole("button", { name: "Key made" }))
    expect(screen.getByTestId("journey").textContent).toBe("keyMade")
  })

  it("steps only through legal moves", () => {
    mount()
    const first = bar.getByRole("button", { name: "First run" })
    fireEvent.keyDown(first, { key: "ArrowRight" })
    expect(screen.getByTestId("journey").textContent).toBe("keyMade")
  })

  it("makes every state a link with syncUrl", async () => {
    const user = userEvent.setup()
    mount({}, { syncUrl: true })
    await user.click(bar.getByRole("button", { name: "Key made" }))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    expect(new URLSearchParams(window.location.search).get("journey")).toBe("keyMade")
  })

  it("follows the machine's when", () => {
    const signIn = defineMachine({
      machines: {
        failure: {
          label: "Sign-in failure",
          initial: "none",
          when: (env) => env.path === "/signin",
          states: { none: { label: "None" }, credentials: { label: "Wrong credentials" } },
        },
      },
    })
    const { rerender } = render(
      <ScenarioProvider machine={signIn} storageKey="switcher-when-v1" enabled path="/overview">
        <StateSwitcher machine="failure" />
      </ScenarioProvider>,
    )
    expect(switcherMounted()).toBe(false)
    rerender(
      <ScenarioProvider machine={signIn} storageKey="switcher-when-v1" enabled path="/signin">
        <StateSwitcher machine="failure" />
      </ScenarioProvider>,
    )
    expect(switcherMounted()).toBe(true)
  })

  it("warns once and renders nothing for an unknown machine", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    mount({ machine: "jorney" })
    expect(switcherMounted()).toBe(false)
    expect(spy.mock.calls.flat().join(" ")).toMatch(/names no machine/)
  })

  it("follows the provider's enabled", () => {
    mount({}, { enabled: false })
    expect(switcherMounted()).toBe(false)
  })
})
