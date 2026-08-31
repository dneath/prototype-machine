import { type CompiledMachine, type PartialSnapshot, type Snapshot, warn } from "./machine"
import { type Primitive } from "./schema"

/* Where a scenario comes from, in order of who wins:
 *
 *   defaults  <  localStorage  <  URL  <  what you clicked this session
 *
 * The URL beating storage is the load-bearing part. A link is how a scenario
 * travels into a review or a bug report, and if the recipient's browser had
 * been clicking around earlier, a link that lost to their storage would render
 * something neither of you meant and read as a broken product rather than a
 * link that failed to land.
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
      if (raw === TRUE || raw === "true") return true
      if (raw === FALSE || raw === "false") return false
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
      if (def.states[raw]) {
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

/** The query string that reproduces this scenario. Hidden controls included:
 *  a link has to carry the whole scenario, not just the visible half. */
export function toSearch(machine: CompiledMachine, snapshot: Snapshot): string {
  const params = new URLSearchParams()
  for (const [key, target] of Object.entries(machine.params)) {
    if (target.kind === "machine") {
      const def = machine.config.machines[target.id]
      const value = snapshot.machines[target.id] ?? def.initial
      /* Omit anything already at its default. A link that spells out every
         axis is unreadable and hides which ones actually matter. */
      if (value !== def.initial) params.set(key, value)
      continue
    }
    const def = machine.config.fields[target.id]
    const value = target.id in snapshot.fields ? snapshot.fields[target.id] : def.default
    if (value !== def.default) params.set(key, encodeField(value))
  }
  return params.toString()
}

/** A full URL for the current scenario on the current page. */
export function toLink(machine: CompiledMachine, snapshot: Snapshot, href?: string): string {
  const base =
    href ?? (typeof window !== "undefined" ? window.location.href : "http://localhost/")
  try {
    const url = new URL(base)
    url.search = toSearch(machine, snapshot)
    return url.toString()
  } catch {
    return `?${toSearch(machine, snapshot)}`
  }
}

/* Storage. Every read is defensive: private browsing throws on access, a quota
   error throws on write, and a key written by an older build of the config can
   hold states that no longer exist. None of it is worth an error boundary —
   the defaults are always a correct scenario. */

export function readStorage(machine: CompiledMachine, key: string): PartialSnapshot {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PartialSnapshot
    if (!parsed || typeof parsed !== "object") return {}
    return machine.sanitize(parsed)
  } catch {
    return {}
  }
}

export function writeStorage(key: string, snapshot: Snapshot): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(snapshot))
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
