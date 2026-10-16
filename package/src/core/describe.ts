import { type CompiledMachine, type Snapshot, has } from "./machine"
import { diffFromDefaults, toSearch } from "./serialize"

/** A plain-text outline of a scenario space: machines, their moves, and fields. */
export function describe(machine: CompiledMachine): string {
  const lines: string[] = []
  const { machines, fields, actions } = machine.config
  for (const [id, def] of Object.entries(machines)) {
    lines.push(`${def.label ?? id} (${id}), starts at ${def.initial}`)
    for (const stateId of Object.keys(def.states)) {
      const moves = machine.movesFrom(id, stateId)
      lines.push(`  ${stateId} -> ${moves.length ? moves.join(", ") : "(dead end)"}`)
    }
  }
  const fieldIds = Object.keys(fields)
  if (fieldIds.length) {
    lines.push("Fields")
    for (const id of fieldIds) {
      const def = fields[id]
      lines.push(`  ${id}: ${def.type} = ${JSON.stringify(def.default)}`)
    }
  }
  if (actions?.length) {
    lines.push("Actions")
    for (const action of actions) lines.push(`  ${action.id}: ${action.label}`)
  }
  return lines.join("\n")
}

/** How many machines and fields sit somewhere other than their default. */
export function changedCount(machine: CompiledMachine, snapshot: Snapshot): number {
  const diff = diffFromDefaults(machine, snapshot)
  return Object.keys(diff.machines ?? {}).length + Object.keys(diff.fields ?? {}).length
}

function show(value: unknown): string {
  if (typeof value === "string") {
    const flat = value.replace(/\n/g, "\\n")
    return JSON.stringify(flat.length > 80 ? `${flat.slice(0, 79)}…` : flat)
  }
  return JSON.stringify(value)
}

/**
 * The scenario currently on screen, as text to paste into a bug report, a
 * review comment or an agent's prompt. Every machine and field, changed ones
 * marked with their default, then the query string that reproduces it.
 */
export function summarize(machine: CompiledMachine, snapshot: Snapshot): string {
  const lines: string[] = []
  const { machines, fields } = machine.config
  for (const [id, def] of Object.entries(machines)) {
    const at = has(snapshot.machines, id) ? snapshot.machines[id] : def.initial
    const name = def.states[at]?.label
    const changed = at !== def.initial ? `  (default ${def.initial})` : ""
    lines.push(`${def.label ?? id}: ${at}${name && name !== at ? ` "${name}"` : ""}${changed}`)
  }
  for (const [id, def] of Object.entries(fields)) {
    const value = has(snapshot.fields, id) ? snapshot.fields[id] : def.default
    const changed = value !== def.default ? `  (default ${show(def.default)})` : ""
    lines.push(`${def.label ?? id}: ${show(value)}${changed}`)
  }
  const query = toSearch(machine, snapshot)
  lines.push(`Query: ${query ? `?${query}` : "(all defaults)"}`)
  return lines.join("\n")
}

/**
 * What to change in the config so a fresh visitor starts in the scenario on
 * screen, written as an instruction a coding agent can carry out. Tune a value
 * in the panel, copy, paste, and it becomes the default. Values are written in
 * full, never shortened, because an agent will type exactly what it is given.
 * Empty when nothing differs from the defaults.
 */
export function toDefaults(machine: CompiledMachine, snapshot: Snapshot): string {
  const diff = diffFromDefaults(machine, snapshot)
  const lines: string[] = []
  const { machines, fields } = machine.config
  for (const [id, state] of Object.entries(diff.machines ?? {})) {
    lines.push(`- machines.${id}.initial: ${JSON.stringify(state)} (was ${JSON.stringify(machines[id].initial)})`)
  }
  for (const [id, value] of Object.entries(diff.fields ?? {})) {
    lines.push(`- fields.${id}.default: ${JSON.stringify(value)} (was ${JSON.stringify(fields[id].default)})`)
  }
  if (!lines.length) return ""
  return ["To make this the starting scenario, change these in the defineMachine config:", ...lines].join("\n")
}
