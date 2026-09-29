import { type CompiledMachine, has, type PartialSnapshot, type Snapshot, warn } from "./machine"
import { type Primitive } from "./schema"

/* Where a scenario comes from, in order of who wins:
 *
 *   defaults  <  localStorage  <  URL  <  what you clicked this session
 *
 * A query string is an explicit instruction ("open in this state"), so it
 * beats whatever an earlier session left in storage.
 */

const TRUE = "1"
const FALSE = "0"

function encodeField(value: Primitive): string {
  if (value === null) return ""
  if (typeof value === "boolean") return value ? TRUE : FALSE
  return String(value)
}

function decodeField(
  raw: string,
  def: { type: string }
): Primitive | undefined {
  switch (def.type) {
    case "boolean":
      if (raw === TRUE || raw === "true" || raw === "on") return true
      if (raw === FALSE || raw === "false" || raw === "off") return false
      return undefined
    case "number": {
      const n = Number(raw)
      return Number.isFinite(n) ? n : undefined
    }
    case "date":
      return raw === "" ? null : raw
    default:
      return raw
  }
}

/** Read whatever a query string has to say about the scenario. */
export function fromSearch(machine: CompiledMachine, search: string): PartialSnapshot {
  const params = new URLSearchParams(search)
  const machines: Record<string, string> = {}
  const fields: Record<string, Primitive> = {}

  for (const [key, target] of Object.entries(machine.params)) {
    const raw = params.get(key)
    if (raw === null) continue

    if (target.kind === "machine") {
      const def = machine.config.machines[target.id]
      if (has(def.states, raw)) {
        machines[target.id] = raw
      } else {
        warn(
          `?${key}=${raw} does not name a state of "${target.id}". Ignoring it. Known states: ${Object.keys(def.states).join(", ")}.`
        )
      }
      continue
    }

    const def = machine.config.fields[target.id]
    const value = decodeField(raw, def)
    if (value !== undefined) fields[target.id] = value
    else warn(`?${key}=${raw} is not a valid value for field "${target.id}". Ignoring it.`)
  }

  /* Through sanitize as well, so a value that decoded but is out of the
     declared range (a number below `min`, an enum option that was removed)
     falls back to the default rather than reaching context. */
  return machine.sanitize({
    machines: Object.keys(machines).length ? machines : undefined,
    fields: Object.keys(fields).length ? fields : undefined,
  })
}

/** The query string that reproduces this scenario. Hidden controls included,
 *  so it carries the whole scenario, not just the visible half. */
export function toSearch(machine: CompiledMachine, snapshot: Snapshot): string {
  const params = new URLSearchParams()
  for (const [key, target] of Object.entries(machine.params)) {
    if (target.kind === "machine") {
      const def = machine.config.machines[target.id]
      const value = has(snapshot.machines, target.id) ? snapshot.machines[target.id] : def.initial
      /* Omit anything already at its default. A query that spells out every
         axis is unreadable and hides which ones actually matter. */
      if (value !== def.initial) params.set(key, value)
      continue
    }
    const def = machine.config.fields[target.id]
    const value = has(snapshot.fields, target.id) ? snapshot.fields[target.id] : def.default
    if (value !== def.default) params.set(key, encodeField(value))
  }
  return params.toString()
}

/** `search` with the scenario's own keys replaced, or removed when `snapshot`
 *  is null. Every other parameter is left exactly where it was. */
export function mergeSearch(machine: CompiledMachine, search: string, snapshot: Snapshot | null): string {
  const params = new URLSearchParams(search)
  for (const key of Object.keys(machine.params)) params.delete(key)
  if (snapshot) {
    for (const [key, value] of new URLSearchParams(toSearch(machine, snapshot))) params.set(key, value)
  }
  const out = params.toString()
  return out ? `?${out}` : ""
}

/* Storage. Every read is defensive: private browsing throws on access, a quota
   error throws on write, and a key written by an older build of the config can
   hold states that no longer exist. None of it is worth an error boundary —
   the defaults are always a correct scenario. */

/** Only what differs from the defaults. A saved default is a pinned default:
 *  change `initial` in the config and every browser that saved it would keep
 *  showing the old one. */
export function diffFromDefaults(machine: CompiledMachine, snapshot: Snapshot): PartialSnapshot {
  const base = machine.initial()
  const out: PartialSnapshot = {}
  const m: Record<string, string> = {}
  for (const [id, value] of Object.entries(snapshot.machines)) {
    if (has(base.machines, id) && base.machines[id] !== value) m[id] = value
  }
  const f: Record<string, Primitive> = {}
  for (const [id, value] of Object.entries(snapshot.fields)) {
    if (has(base.fields, id) && base.fields[id] !== value) f[id] = value
  }
  if (Object.keys(m).length) out.machines = m
  if (Object.keys(f).length) out.fields = f
  return out
}

/** A fingerprint of the config's shape: machine states and field types. Labels
 *  and notes can change freely; a renamed state or retyped field cannot. */
export function shapeOf(machine: CompiledMachine): string {
  const parts: string[] = []
  for (const [id, def] of Object.entries(machine.config.machines)) {
    parts.push(`m:${id}:${Object.keys(def.states).join(",")}`)
  }
  for (const [id, def] of Object.entries(machine.config.fields)) {
    parts.push(`f:${id}:${def.type}`)
  }
  let hash = 5381
  const text = parts.join("|")
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
  return (hash >>> 0).toString(36)
}

interface Stored extends PartialSnapshot {
  shape?: string
}

export function readStorage(machine: CompiledMachine, key: string): PartialSnapshot {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Stored
    if (!parsed || typeof parsed !== "object") return {}
    /* A different shape means the config was restructured since this was
       saved. Guessing which saved values still mean the same thing is how a
       stale scenario sneaks back in, so start from the defaults. */
    if (parsed.shape !== undefined && parsed.shape !== shapeOf(machine)) return {}
    return machine.sanitize({ machines: parsed.machines, fields: parsed.fields })
  } catch {
    return {}
  }
}

export function writeStorage(machine: CompiledMachine, key: string, snapshot: Snapshot): void {
  try {
    const diff = diffFromDefaults(machine, snapshot)
    if (!diff.machines && !diff.fields) {
      window.localStorage.removeItem(key)
      return
    }
    const stored: Stored = { shape: shapeOf(machine), ...diff }
    window.localStorage.setItem(key, JSON.stringify(stored))
  } catch {
    /* Nothing depends on it persisting. */
  }
}

export function clearStorage(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* Ignore. */
  }
}

/** Lay the layers down in precedence order. */
export function resolve(
  machine: CompiledMachine,
  layers: ReadonlyArray<PartialSnapshot>
): Snapshot {
  const base = machine.initial()
  for (const layer of layers) {
    if (layer.machines) Object.assign(base.machines, layer.machines)
    if (layer.fields) Object.assign(base.fields, layer.fields)
  }
  return base
}
