import { beforeEach, describe, expect, it } from "vitest"

import { sample } from "./machine.test"
import {
  clearStorage,
  fromSearch,
  readStorage,
  resolve,
  toSearch,
  writeStorage,
} from "./serialize"

const KEY = "test-scenario-v1"

beforeEach(() => window.localStorage.clear())

describe("reading a query string", () => {
  it("picks up machines and fields", () => {
    expect(fromSearch(sample, "?journey=keyMade&role=admin&hasEvents=0")).toEqual({
      machines: { journey: "keyMade", role: "admin" },
      fields: { hasEvents: false },
    })
  })

  it("honours a machine's custom param name", () => {
    expect(fromSearch(sample, "?state=error")).toEqual({ machines: { data: "error" } })
  })

  it("ignores a state the config does not have rather than rendering it", () => {
    expect(fromSearch(sample, "?journey=ghost")).toEqual({})
  })

  it("ignores inherited property names rather than treating them as states", () => {
    expect(fromSearch(sample, "?journey=constructor&role=__proto__&hasEvents=toString")).toEqual({})
  })

  it("ignores an unparseable field value", () => {
    expect(fromSearch(sample, "?hasEvents=maybe")).toEqual({})
  })

  it("accepts on and off for a boolean, alongside 1/0 and true/false", () => {
    expect(fromSearch(sample, "?hasEvents=on")).toEqual({ fields: { hasEvents: true } })
    expect(fromSearch(sample, "?hasEvents=off")).toEqual({ fields: { hasEvents: false } })
    expect(fromSearch(sample, "?hasEvents=true")).toEqual({ fields: { hasEvents: true } })
    expect(fromSearch(sample, "?hasEvents=0")).toEqual({ fields: { hasEvents: false } })
  })
})

describe("writing a query string", () => {
  it("omits everything sitting at its default", () => {
    expect(toSearch(sample, sample.initial())).toBe("")
  })

  it("spells out only what differs", () => {
    const search = toSearch(sample, {
      machines: { journey: "active", role: "user", data: "error" },
      fields: { hasEvents: true, chosenTool: "opencode" },
    })
    expect(search).toBe("journey=active&state=error")
  })

  it("round-trips", () => {
    const snapshot = {
      machines: { journey: "requestIn", role: "admin", data: "loading" },
      fields: { hasEvents: false, chosenTool: "claude-code" },
    }
    const back = resolve(sample, [fromSearch(sample, `?${toSearch(sample, snapshot)}`)])
    expect(back).toEqual(snapshot)
  })

  it("carries hidden fields, because a query carries the whole scenario", () => {
    const search = toSearch(sample, {
      machines: {},
      fields: { chosenTool: "cursor" },
    })
    expect(search).toBe("chosenTool=cursor")
  })
})

describe("storage", () => {
  it("round-trips a snapshot", () => {
    const snapshot = { machines: { journey: "keyMade" }, fields: { hasEvents: false } }
    writeStorage(sample, KEY, resolve(sample, [snapshot]))
    expect(readStorage(sample, KEY)).toEqual(snapshot)
  })

  it("stores only what differs from the defaults", () => {
    writeStorage(sample, KEY, sample.initial())
    expect(window.localStorage.getItem(KEY)).toBeNull()
    writeStorage(sample, KEY, resolve(sample, [{ fields: { hasEvents: false } }]))
    const stored = JSON.parse(window.localStorage.getItem(KEY)!)
    expect(stored.fields).toEqual({ hasEvents: false })
    expect(stored.machines).toBeUndefined()
  })

  it("ignores storage written for a differently shaped config", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ shape: "stale", fields: { hasEvents: false } })
    )
    expect(readStorage(sample, KEY)).toEqual({})
  })

  it("ignores inherited property names in storage", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ machines: { journey: "constructor" }, fields: { toString: 1 } })
    )
    expect(readStorage(sample, KEY)).toEqual({})
  })

  it("survives corrupt contents", () => {
    window.localStorage.setItem(KEY, "{ not json")
    expect(readStorage(sample, KEY)).toEqual({})
  })

  it("drops states a newer config no longer has", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ machines: { journey: "retired" } }))
    expect(readStorage(sample, KEY)).toEqual({})
  })

  it("clears", () => {
    writeStorage(sample, KEY, resolve(sample, [{ fields: { hasEvents: false } }]))
    clearStorage(KEY)
    expect(readStorage(sample, KEY)).toEqual({})
  })
})

describe("precedence", () => {
  /* defaults < storage < URL < this session's edits. A query string
     is an explicit instruction, so it beats what an earlier session stored. */
  it("lets each layer beat the one before it", () => {
    const stored = { machines: { journey: "parked" }, fields: { hasEvents: false } }
    const url = { machines: { journey: "keyMade" } }
    const edits = { machines: { role: "admin" } }

    const snapshot = resolve(sample, [stored, url, edits])

    expect(snapshot.machines.journey).toBe("keyMade")
    expect(snapshot.machines.role).toBe("admin")
    expect(snapshot.machines.data).toBe("real")
    expect(snapshot.fields.hasEvents).toBe(false)
    expect(snapshot.fields.chosenTool).toBe("opencode")
  })

  it("starts from the config's defaults with no layers at all", () => {
    expect(resolve(sample, [])).toEqual(sample.initial())
  })
})
