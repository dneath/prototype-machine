import { describe, expect, it, vi } from "vitest"

import { compile, defineMachine, ScenarioError } from "./machine"

const FIRST_REQUEST_AT = "2026-03-04T09:12:00.000Z"

/** The AIM prototype's scenario space, which is what this package was cut from. */
export const aim = defineMachine({
  machines: {
    journey: {
      label: "Get connected",
      initial: "firstRun",
      states: {
        parked: { label: "Parked", note: "No models assigned yet", assign: { step: 0, keyIssued: false, firstRequestAt: null } },
        firstRun: { label: "First run", assign: { step: 1, keyIssued: false, firstRequestAt: null } },
        keyMade: { label: "Key made", assign: { step: 2, keyIssued: true, firstRequestAt: null } },
        requestIn: { label: "Request in", assign: { step: 3, keyIssued: true, firstRequestAt: FIRST_REQUEST_AT } },
        active: { label: "Active", assign: { step: 3, keyIssued: true, firstRequestAt: FIRST_REQUEST_AT } },
      },
      transitions: {
        parked: ["firstRun"],
        firstRun: ["keyMade", "parked"],
        keyMade: ["requestIn", "firstRun"],
        requestIn: ["active", "keyMade"],
        active: ["parked"],
      },
    },
    role: {
      label: "Role",
      initial: "user",
      states: { user: { label: "Standard user" }, admin: { label: "Admin" } },
    },
    data: {
      label: "Data state",
      initial: "real",
      param: "state",
      states: { real: { label: "Real" }, loading: {}, empty: {}, error: {} },
    },
  },
  fields: {
    hasEvents: { type: "boolean", label: "Guardrail events", default: true, trueLabel: "Some", falseLabel: "None" },
    chosenTool: { type: "string", default: "opencode", hidden: true },
  },
  derive: {
    hasTraffic: (ctx) => ctx.journey === "active",
  },
})

describe("transition legality", () => {
  it("allows a declared move", () => {
    expect(aim.can("journey", "firstRun", "keyMade")).toBe(true)
  })

  it("refuses a move the config did not declare", () => {
    expect(aim.can("journey", "parked", "active")).toBe(false)
    expect(aim.movesFrom("journey", "parked")).toEqual(["firstRun"])
  })

  it("treats staying put as always legal", () => {
    expect(aim.can("journey", "parked", "parked")).toBe(true)
  })

  it("makes every state reachable when no transitions are declared", () => {
    // `role` and `data` are view controls, not journeys.
    expect(aim.can("data", "real", "error")).toBe(true)
    expect(aim.can("role", "admin", "user")).toBe(true)
    expect(aim.movesFrom("data", "loading")).toEqual(["real", "loading", "empty", "error"])
  })

  it("treats an omitted `from` inside a supplied map as a dead end", () => {
    const m = compile({
      machines: {
        flow: {
          initial: "a",
          states: { a: {}, b: {} },
          transitions: { a: ["b"] },
        },
      },
    })
    expect(m.movesFrom("flow", "b")).toEqual([])
    expect(m.can("flow", "b", "a")).toBe(false)
  })
})

describe("tuple integrity", () => {
  it("records which machine owns each assigned key", () => {
    expect(aim.ownerOf).toEqual({
      step: "journey",
      keyIssued: "journey",
      firstRequestAt: "journey",
    })
  })

  it("writes the whole tuple when a state is current", () => {
    const ctx = aim.contextOf({
      machines: { journey: "keyMade", role: "user", data: "real" },
      fields: { hasEvents: true, chosenTool: "opencode" },
    })
    expect(ctx.step).toBe(2)
    expect(ctx.keyIssued).toBe(true)
    // The state that issues a key has not yet seen a request. This is the
    // combination two independent toggles would happily let you build.
    expect(ctx.firstRequestAt).toBe(null)
  })

  it("refuses a config where two machines write one key", () => {
    expect(() =>
      compile({
        machines: {
          a: { initial: "x", states: { x: { assign: { step: 1 } } } },
          b: { initial: "y", states: { y: { assign: { step: 2 } } } },
        },
      })
    ).toThrow(ScenarioError)
  })

  it("refuses a config where a machine and a field write one key", () => {
    expect(() =>
      compile({
        machines: { a: { initial: "x", states: { x: { assign: { step: 1 } } } } },
        fields: { step: { type: "number", default: 0 } },
      })
    ).toThrow(/owned by exactly one thing/)
  })
})

describe("config validation", () => {
  it("refuses an initial state that does not exist", () => {
    expect(() =>
      compile({ machines: { a: { initial: "nope", states: { x: {} } } } })
    ).toThrow(/starts in "nope"/)
  })

  it("refuses a transition to a state that does not exist", () => {
    expect(() =>
      compile({
        machines: { a: { initial: "x", states: { x: {} }, transitions: { x: ["ghost"] } } },
      })
    ).toThrow(/"ghost" is not one of its states/)
  })

  it("refuses two controls competing for one query parameter", () => {
    expect(() =>
      compile({
        machines: { a: { initial: "x", states: { x: {} }, param: "s" } },
        fields: { b: { type: "string", default: "", param: "s" } },
      })
    ).toThrow(/query parameter/)
  })

  it("refuses a context key that would shadow the API", () => {
    expect(() => compile({ fields: { reset: { type: "boolean", default: false } } })).toThrow(
      /part of the scenario API/
    )
  })

  it("refuses an enum default that is not one of its options", () => {
    expect(() =>
      compile({ fields: { tone: { type: "enum", default: "loud", options: ["quiet"] } } })
    ).toThrow(/not one of its options/)
  })

  it("warns about a state nothing can reach, without refusing to boot", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    compile({
      machines: {
        a: { initial: "x", states: { x: {}, orphan: {} }, transitions: { x: [] } },
      },
    })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("cannot be reached"))
    warn.mockRestore()
  })
})

describe("context", () => {
  it("exposes machine cursors, assigns, fields and derived values together", () => {
    const ctx = aim.contextOf({
      machines: { journey: "active", role: "admin", data: "error" },
      fields: { hasEvents: false, chosenTool: "claude-code" },
    })
    expect(ctx).toMatchObject({
      journey: "active",
      role: "admin",
      data: "error",
      step: 3,
      keyIssued: true,
      hasEvents: false,
      chosenTool: "claude-code",
      hasTraffic: true,
    })
  })

  it("falls back to the initial state when a snapshot names an unknown one", () => {
    const ctx = aim.contextOf({ machines: { journey: "ghost" }, fields: {} })
    expect(ctx.journey).toBe("ghost")
    // The cursor is echoed, but the tuple comes from the initial state rather
    // than being left undefined and crashing whatever reads `step`.
    expect(ctx.step).toBe(1)
  })
})

describe("sanitize", () => {
  it("drops states and fields the config no longer describes", () => {
    expect(
      aim.sanitize({
        machines: { journey: "keyMade", gone: "x", role: "ghost" },
        fields: { hasEvents: true, removed: 1 },
      })
    ).toEqual({ machines: { journey: "keyMade" }, fields: { hasEvents: true } })
  })

  it("drops a field value of the wrong type", () => {
    expect(aim.sanitize({ fields: { hasEvents: "yes" as never } })).toEqual({})
  })
})
