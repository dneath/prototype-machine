import { describe, expect, expectTypeOf, it } from "vitest"

import { defineMachine } from "./machine"
import { sample } from "./machine.test"
import { statesOf } from "./states"

describe("statesOf", () => {
  it("lists a machine's states in declaration order, labelled the way the panel labels them", () => {
    const states = statesOf(sample, "journey")
    expect(Object.keys(states)).toEqual(["parked", "firstRun", "keyMade", "requestIn", "active"])
    expect(states.parked).toEqual({ label: "Parked", note: "No models assigned yet" })
    expect(states.firstRun).toEqual({ label: "First run" })
  })

  it("labels a state with no label by its id", () => {
    expect(statesOf(sample, "data")).toEqual({
      real: { label: "Real" },
      loading: { label: "loading" },
      empty: { label: "empty" },
      error: { label: "error" },
    })
  })

  it("lists an enum field's options", () => {
    const m = defineMachine({
      fields: {
        density: {
          type: "enum",
          default: "comfortable",
          options: ["comfortable", { value: "compact", label: "Compact", note: "8px padding" }],
        },
      },
    })
    expect(statesOf(m, "density")).toEqual({
      comfortable: { label: "comfortable" },
      compact: { label: "Compact", note: "8px padding" },
    })
  })

  it("types the keys as the state ids, so a canvas child can pin them", () => {
    const states = statesOf(sample, "data")
    expectTypeOf<keyof typeof states>().toEqualTypeOf<"real" | "loading" | "empty" | "error">()
  })

  it("refuses an id that is not a machine or enum field, naming the near miss", () => {
    // @ts-expect-error: not a machine or an enum field
    expect(() => statesOf(sample, "jurney")).toThrow(/no machine or enum field is called that\. Did you mean "journey"\?/)
  })

  it("refuses a boolean field and says what to write instead", () => {
    // @ts-expect-error: a boolean is not an enum
    expect(() => statesOf(sample, "hasEvents")).toThrow(/boolean field.*\{ on: "On", off: "Off" \}/)
  })
})
