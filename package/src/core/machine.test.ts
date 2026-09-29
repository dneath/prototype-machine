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

describe("groups", () => {
  it("accepts group on a machine, a field and an action", () => {
    const m = defineMachine({
      machines: {
        account: { label: "Account", group: "Who", initial: "fresh", states: { fresh: {}, seasoned: {} } },
      },
      fields: { dark: { type: "boolean", default: false, group: "Look" } },
      actions: [{ id: "restart", label: "Restart", group: "Who", run: (api) => api.reset() }],
    })
    expect(m.config.machines.account.group).toBe("Who")
    expect(m.config.fields.dark.group).toBe("Look")
    expect(m.config.actions[0].group).toBe("Who")
    expect(m.contextOf(m.initial())).toEqual({ account: "fresh", dark: false })
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
    // Cursor and tuple both fall back together, so they can never disagree.
    expect(ctx.journey).toBe("firstRun")
    expect(ctx.step).toBe(1)
  })

  it("does not treat inherited property names as states", () => {
    const ctx = aim.contextOf({ machines: { journey: "constructor" }, fields: {} })
    expect(ctx.journey).toBe("firstRun")
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

describe("stricter compile checks", () => {
  const one = { a: { label: "A" } }
  it("throws when states assign different keys", () => {
    expect(() =>
      defineMachine({
        machines: {
          m: {
            label: "M",
            initial: "a",
            states: { a: { label: "A", assign: { x: 1 } }, b: { label: "B", assign: {} } },
          },
        },
      })
    ).toThrow(ScenarioError)
  })
  it("throws on a number default outside its range", () => {
    expect(() =>
      defineMachine({ fields: { n: { type: "number", label: "N", default: 50, max: 10 } } })
    ).toThrow(/range|max|outside/i)
  })
  it("throws on a range slider without bounds", () => {
    expect(() =>
      defineMachine({ fields: { n: { type: "number", label: "N", default: 1, control: "range" } } })
    ).toThrow(ScenarioError)
  })
  it("throws on an empty label or group", () => {
    expect(() => defineMachine({ fields: { n: { type: "boolean", label: " ", default: true } } })).toThrow(ScenarioError)
    expect(() =>
      defineMachine({ machines: { m: { label: "M", group: "", initial: "a", states: one } } })
    ).toThrow(ScenarioError)
  })
})
