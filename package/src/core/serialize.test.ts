import { beforeEach, describe, expect, it } from "vitest"

import { aim } from "./machine.test"
import {
  clearStorage,
  fromSearch,
  readStorage,
  resolve,
  toLink,
  toSearch,
  writeStorage,
} from "./serialize"

const KEY = "test-scenario-v1"

beforeEach(() => window.localStorage.clear())

describe("reading a query string", () => {
  it("picks up machines and fields", () => {
    expect(fromSearch(aim, "?journey=keyMade&role=admin&hasEvents=0")).toEqual({
      machines: { journey: "keyMade", role: "admin" },
      fields: { hasEvents: false },
    })
  })

  it("honours a machine's custom param name", () => {
    expect(fromSearch(aim, "?state=error")).toEqual({ machines: { data: "error" } })
  })

  it("ignores a state the config does not have rather than rendering it", () => {
    expect(fromSearch(aim, "?journey=ghost")).toEqual({})
  })

  it("ignores an unparseable field value", () => {
    expect(fromSearch(aim, "?hasEvents=maybe")).toEqual({})
  })
})

describe("writing a query string", () => {
  it("omits everything sitting at its default", () => {
    expect(toSearch(aim, aim.initial())).toBe("")
  })

  it("spells out only what differs", () => {
    const search = toSearch(aim, {
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
    const back = resolve(aim, [fromSearch(aim, `?${toSearch(aim, snapshot)}`)])
    expect(back).toEqual(snapshot)
  })

  it("carries hidden fields, because a link has to carry the whole scenario", () => {
    const search = toSearch(aim, {
      machines: {},
      fields: { chosenTool: "cursor" },
    })
    expect(search).toBe("chosenTool=cursor")
  })

  it("builds a full link against a base URL", () => {
    const link = toLink(
      aim,
      { machines: { journey: "active" }, fields: {} },
      "http://localhost:3000/guardrails?stale=1"
    )
    expect(link).toBe("http://localhost:3000/guardrails?journey=active")
  })
})

describe("storage", () => {
  it("round-trips a snapshot", () => {
    const snapshot = { machines: { journey: "keyMade" }, fields: { hasEvents: false } }
    writeStorage(KEY, snapshot as never)
    expect(readStorage(aim, KEY)).toEqual(snapshot)
  })

  it("survives corrupt contents", () => {
    window.localStorage.setItem(KEY, "{ not json")
    expect(readStorage(aim, KEY)).toEqual({})
  })

  it("drops states a newer config no longer has", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ machines: { journey: "retired" } }))
    expect(readStorage(aim, KEY)).toEqual({})
  })

  it("clears", () => {
    writeStorage(KEY, aim.initial())
    clearStorage(KEY)
    expect(readStorage(aim, KEY)).toEqual({})
  })
})

describe("precedence", () => {
  /* defaults < storage < URL < this session's edits. The URL beating storage is
     the load-bearing part: a link has to land the same way on a browser that
     has been clicking around as on a fresh one. */
  it("lets each layer beat the one before it", () => {
    const stored = { machines: { journey: "parked" }, fields: { hasEvents: false } }
    const url = { machines: { journey: "keyMade" } }
    const edits = { machines: { role: "admin" } }

    const snapshot = resolve(aim, [stored, url, edits])

    expect(snapshot.machines.journey).toBe("keyMade")
    expect(snapshot.machines.role).toBe("admin")
    expect(snapshot.machines.data).toBe("real")
    expect(snapshot.fields.hasEvents).toBe(false)
    expect(snapshot.fields.chosenTool).toBe("opencode")
  })

  it("starts from the config's defaults with no layers at all", () => {
    expect(resolve(aim, [])).toEqual(aim.initial())
  })
})
