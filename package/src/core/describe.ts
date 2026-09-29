import type { CompiledMachine } from "./machine"

/** A plain-text outline of a scenario space: machines, their moves, and fields. */
export function describe(machine: CompiledMachine): string {
  const lines: string[] = []
  const { machines, fields, actions } = machine.config
  for (const [id, def] of Object.entries(machines)) {
    lines.push(`${def.label} (${id}), starts at ${def.initial}`)
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
