import { render } from "@testing-library/react"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { beforeEach, describe, expect, it } from "vitest"

import { defineMachine } from "../core/index"
import { ScenarioPanel } from "./panel"
import { ScenarioProvider, type Scenario } from "./provider"
import { useScenario } from "./use-scenario"

const themed = defineMachine({
  fields: {
    theme: {
      type: "enum",
      label: "Theme",
      default: "light",
      options: [{ value: "light" }, { value: "dark" }],
      dom: { target: "html", attribute: "data-theme" },
    },
  },
})

let handle: Scenario | null = null
function Grab() {
  handle = useScenario()
  return <span data-testid="theme">{String((handle as unknown as { theme: string }).theme)}</span>
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, "", "/")
  document.documentElement.removeAttribute("data-theme")
  handle = null
})

describe("runtime", () => {
  it("renders on the server without touching the browser", () => {
    const html = renderToString(
      <ScenarioProvider machine={themed} storageKey="rt-v1" enabled>
        <Grab />
        <ScenarioPanel />
      </ScenarioProvider>
    )
    expect(html).toContain("light")
  })

  it("survives StrictMode", () => {
    const { getByTestId } = render(
      <React.StrictMode>
        <ScenarioProvider machine={themed} storageKey="rt-v1" enabled>
          <Grab />
        </ScenarioProvider>
      </React.StrictMode>
    )
    expect(getByTestId("theme").textContent).toBe("light")
  })

  it("binds and unbinds dom attributes", () => {
    const { unmount } = render(
      <ScenarioProvider machine={themed} storageKey="rt-v1" enabled>
        <Grab />
      </ScenarioProvider>
    )
    expect(document.documentElement.getAttribute("data-theme")).toBe("light")
    React.act(() => handle!.set({ theme: "dark" }))
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    unmount()
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false)
  })

  it("reset clears storage", async () => {
    render(
      <ScenarioProvider machine={themed} storageKey="rt-v1" enabled>
        <Grab />
      </ScenarioProvider>
    )
    React.act(() => handle!.set({ theme: "dark" }))
    await new Promise((r) => setTimeout(r, 200))
    expect(window.localStorage.getItem("rt-v1")).not.toBeNull()
    React.act(() => handle!.reset())
    await new Promise((r) => setTimeout(r, 200))
    expect(window.localStorage.getItem("rt-v1")).toBeNull()
  })
})
