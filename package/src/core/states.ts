import { type Machine, has, optionsOf, ScenarioError, suggest } from "./machine"
import { type FieldValue, type StateOf } from "./schema"

/* A machine's states, or an enum field's options, in the shape a bench or a
 * canvas takes: `{ id: { label, note } }`, in declaration order.
 *
 * It is how a canvas shows every state a scenario can be in without anyone
 * retyping the labels: the config already names each state the way the
 * reviewer talks about it. */

export interface StateEntry {
  label: string
  note?: string
}

/** The ids of fields that hold one of a fixed set of strings. */
export type EnumFieldIds<F> = { [K in keyof F]: F[K] extends { type: "enum" } ? K : never }[keyof F]

/** A machine's state ids, or an enum field's values. */
export type StateIdsOf<M, F, K> = K extends keyof M
  ? StateOf<M, K>
  : K extends keyof F
    ? FieldValue<F[K]> & string
    : never

/**
 * Every state of one machine, or every option of one enum field, labelled.
 *
 * ```ts
 * statesOf(scenario, "data")   // { real: { label: "Real" }, loading: { label: "Loading" }, ... }
 * ```
 *
 * Pass the result as a canvas's `states` or `frames`, then pin each frame
 * with `<PinnedScenario values={{ data: state }}>`.
 */
export function statesOf<M, F, D, K extends (keyof M | EnumFieldIds<F>) & string>(
  machine: Machine<M, F, D>,
  id: K,
): Record<StateIdsOf<M, F, K>, StateEntry> {
  const { machines, fields } = machine.config
  const out: Record<string, StateEntry> = {}

  if (has(machines, id)) {
    for (const [stateId, def] of Object.entries(machines[id].states)) {
      out[stateId] = def.note ? { label: def.label ?? stateId, note: def.note } : { label: def.label ?? stateId }
    }
    return out as Record<StateIdsOf<M, F, K>, StateEntry>
  }

  if (has(fields, id)) {
    const def = fields[id]
    if (def.type !== "enum") {
      throw new ScenarioError(
        `statesOf("${id}"): "${id}" is a ${def.type} field. It works on machines and enum fields, whose values are a fixed set of names.${
          def.type === "boolean" ? ` For a boolean, write the two states yourself: { on: "On", off: "Off" }.` : ""
        }`,
      )
    }
    for (const option of optionsOf(def)) {
      out[option.value] = option.note ? { label: option.label, note: option.note } : { label: option.label }
    }
    return out as Record<StateIdsOf<M, F, K>, StateEntry>
  }

  const known = [
    ...Object.keys(machines),
    ...Object.entries(fields).filter(([, def]) => def.type === "enum").map(([fieldId]) => fieldId),
  ]
  throw new ScenarioError(
    `statesOf("${id}"): no machine or enum field is called that.${suggest(id, known)} Known: ${known.join(", ") || "nothing"}.`,
  )
}
