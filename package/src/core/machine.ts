import {
  type ActionDef,
  type AnyField,
  type BaseContext,
  type Context,
  type Env,
  type MachineDef,
  type Primitive,
} from "./schema"

/* Compiling a config into something the runtime can answer questions about,
   and refusing to compile one that describes a prototype nobody could ever be
   looking at. */

/** A machine cursor plus every free field: the whole of what gets persisted. */
export interface Snapshot {
  machines: Record<string, string>
  fields: Record<string, Primitive>
}

export interface PartialSnapshot {
  machines?: Record<string, string>
  fields?: Record<string, Primitive>
}

declare const process: { env: { NODE_ENV?: string } }

/* Read once, and written so a bundler can substitute `process.env.NODE_ENV`
   at build time — the expression is left textually intact for exactly that
   reason, so it constant-folds and the dev-only branches drop out.
 *
 * When NOTHING substitutes it, `process` is undefined in a browser and the
 * reference throws, and we assume PRODUCTION. That direction is deliberate:
 * failing open puts a role switcher in a deployed build, which is much worse
 * than failing closed, and `enabled` is the escape hatch for a review build
 * that genuinely wants the controls. */
export const isDev = (() => {
  try {
    return process.env.NODE_ENV !== "production"
  } catch {
    return false
  }
})()

function warn(message: string) {
  if (isDev && typeof console !== "undefined") {
    console.warn(`[prototype-machine] ${message}`)
  }
}

/* `useScenario()` returns context and the API spread into one object, the way
   the hand-written original did, because `p.step` reading the same as `p.set`
   is most of why that shape is pleasant. The cost is that a context key called
   `reset` would shadow the function. Cheaper to refuse the name than to make
   every consumer reach through `.context`. */
export const RESERVED = new Set([
  "set", "go", "can", "movesFrom", "reset", "link", "snapshot", "machine",
  "storageKey", "env", "navigate", "open", "setOpen",
  "hydrated", "enabled",
])

export class ScenarioError extends Error {
  constructor(message: string) {
    super(`[prototype-machine] ${message}`)
    this.name = "ScenarioError"
  }
}

export interface CompiledMachine {
  config: {
    machines: Record<string, MachineDef>
    fields: Record<string, AnyField>
    derive: Record<string, (ctx: never) => unknown>
    actions: ReadonlyArray<ActionDef>
  }
  /** Which machine owns each assigned key, for the "you cannot set that" check. */
  ownerOf: Record<string, string>
  /** Query-string key -> what it addresses. */
  params: Record<string, { kind: "machine" | "field"; id: string }>
  initial(): Snapshot
  /** Legal next states from wherever `machineId` currently is. */
  movesFrom(machineId: string, from: string): ReadonlyArray<string>
  can(machineId: string, from: string, to: string): boolean
  /** Flatten a snapshot into the object consumers read. */
  contextOf(snapshot: Snapshot): Record<string, unknown>
  /** Drop anything the config no longer describes. Storage outlives configs. */
  sanitize(input: PartialSnapshot): PartialSnapshot
}

export interface Machine<M, F, D> extends CompiledMachine {
  /** Phantom, for inference only. Never populated at runtime. */
  readonly __context?: Context<M, F, D>
}

function paramKeyFor(id: string, def: { param?: string }): string {
  return def.param ?? id
}

export function compile(config: {
  machines?: Record<string, MachineDef>
  fields?: Record<string, AnyField>
  derive?: Record<string, (ctx: never) => unknown>
  actions?: ReadonlyArray<ActionDef>
}): CompiledMachine {
  const machines = config.machines ?? {}
  const fields = config.fields ?? {}
  const derive = config.derive ?? {}
  const actions = config.actions ?? []

  /* Validation runs at module load, not on first click, so a typo in a state id
     is a boot-time complaint rather than a pill that silently does nothing. */
  const ownerOf: Record<string, string> = {}
  const params: Record<string, { kind: "machine" | "field"; id: string }> = {}

  for (const [machineId, def] of Object.entries(machines)) {
    const stateIds = Object.keys(def.states)
    if (stateIds.length === 0) {
      throw new ScenarioError(`Machine "${machineId}" declares no states.`)
    }
    if (!def.states[def.initial]) {
      throw new ScenarioError(
        `Machine "${machineId}" starts in "${def.initial}", which is not one of its states (${stateIds.join(", ")}).`
      )
    }

    for (const [stateId, state] of Object.entries(def.states)) {
      for (const key of Object.keys(state.assign ?? {})) {
        if (key in machines) {
          throw new ScenarioError(
            `"${machineId}.${stateId}" assigns "${key}", but a machine is already called that.`
          )
        }
        if (key in fields) {
          throw new ScenarioError(
            `"${machineId}.${stateId}" assigns "${key}", but that is also a free field. A key is owned by exactly one thing — either the machine writes it as part of a tuple, or it varies on its own.`
          )
        }
        const owner = ownerOf[key]
        if (owner && owner !== machineId) {
          throw new ScenarioError(
            `Machines "${owner}" and "${machineId}" both assign "${key}". Two machines writing one key is how illegal tuples get in.`
          )
        }
        ownerOf[key] = machineId
      }
    }

    if (def.transitions) {
      for (const [from, tos] of Object.entries(def.transitions)) {
        if (!def.states[from]) {
          throw new ScenarioError(
            `Machine "${machineId}" declares transitions from "${from}", which is not one of its states.`
          )
        }
        for (const to of tos) {
          if (!def.states[to]) {
            throw new ScenarioError(
              `Machine "${machineId}" allows "${from}" -> "${to}", but "${to}" is not one of its states.`
            )
          }
        }
      }

      /* A state nothing can reach is almost always a typo rather than an
         intention, and it is invisible in the panel — the pill is simply never
         enabled. Say so, but do not refuse to boot: the initial state is
         legitimately unreachable in a one-way journey. */
      const reachable = new Set<string>([def.initial])
      for (const tos of Object.values(def.transitions)) for (const to of tos) reachable.add(to)
      for (const stateId of stateIds) {
        if (!reachable.has(stateId)) {
          warn(
            `"${machineId}.${stateId}" cannot be reached from anywhere, so its pill will never be enabled.`
          )
        }
      }
    }

    const key = paramKeyFor(machineId, def)
    if (params[key]) {
      throw new ScenarioError(`Two controls both want the "?${key}" query parameter.`)
    }
    params[key] = { kind: "machine", id: machineId }
  }

  for (const [fieldId, def] of Object.entries(fields)) {
    if (fieldId in machines) {
      throw new ScenarioError(`"${fieldId}" is both a machine and a field.`)
    }
    if (def.type === "enum") {
      const values = def.options.map((o) => (typeof o === "string" ? o : o.value))
      if (!values.includes(def.default)) {
        throw new ScenarioError(
          `Field "${fieldId}" defaults to "${def.default}", which is not one of its options (${values.join(", ")}).`
        )
      }
    }
    const key = paramKeyFor(fieldId, def)
    if (params[key]) {
      throw new ScenarioError(`Two controls both want the "?${key}" query parameter.`)
    }
    params[key] = { kind: "field", id: fieldId }
  }

  for (const name of Object.keys(derive)) {
    if (name in machines || name in fields || name in ownerOf) {
      throw new ScenarioError(
        `Derived value "${name}" shadows something real. Derived values are computed from context and cannot share a name with part of it.`
      )
    }
  }

  for (const name of [
    ...Object.keys(machines),
    ...Object.keys(fields),
    ...Object.keys(ownerOf),
    ...Object.keys(derive),
  ]) {
    if (RESERVED.has(name)) {
      throw new ScenarioError(
        `"${name}" is part of the scenario API, so it cannot also be part of context. Rename it.`
      )
    }
  }

  const seenActions = new Set<string>()
  for (const action of actions) {
    if (seenActions.has(action.id)) {
      throw new ScenarioError(`Two actions share the id "${action.id}".`)
    }
    seenActions.add(action.id)
  }

  function initial(): Snapshot {
    const m: Record<string, string> = {}
    for (const [id, def] of Object.entries(machines)) m[id] = def.initial
    const f: Record<string, Primitive> = {}
    for (const [id, def] of Object.entries(fields)) f[id] = def.default
    return { machines: m, fields: f }
  }

  function movesFrom(machineId: string, from: string): ReadonlyArray<string> {
    const def = machines[machineId]
    if (!def) return []
    /* No transition map at all means "this is not a journey" — every state is
       one click away, which is what a data-state or role switch wants. */
    if (!def.transitions) return Object.keys(def.states)
    return def.transitions[from] ?? []
  }

  function can(machineId: string, from: string, to: string): boolean {
    if (from === to) return true
    return movesFrom(machineId, from).includes(to)
  }

  function contextOf(snapshot: Snapshot): Record<string, unknown> {
    const ctx: Record<string, unknown> = {}

    /* Assigns first, so a machine's tuple is in place before anything reads it,
       then the cursors, then free fields. None of the three can collide —
       compile() refused the config if they could. */
    for (const [machineId, def] of Object.entries(machines)) {
      const stateId = snapshot.machines[machineId] ?? def.initial
      const state = def.states[stateId] ?? def.states[def.initial]
      Object.assign(ctx, state.assign ?? {})
      ctx[machineId] = stateId
    }
    for (const [fieldId, def] of Object.entries(fields)) {
      ctx[fieldId] = fieldId in snapshot.fields ? snapshot.fields[fieldId] : def.default
    }
    for (const [name, fn] of Object.entries(derive)) {
      ctx[name] = (fn as (c: unknown) => unknown)(ctx)
    }
    return ctx
  }

  function sanitize(input: PartialSnapshot): PartialSnapshot {
    const out: PartialSnapshot = {}
    if (input.machines) {
      const m: Record<string, string> = {}
      for (const [id, stateId] of Object.entries(input.machines)) {
        if (machines[id]?.states[stateId]) m[id] = stateId
      }
      if (Object.keys(m).length) out.machines = m
    }
    if (input.fields) {
      const f: Record<string, Primitive> = {}
      for (const [id, value] of Object.entries(input.fields)) {
        const def = fields[id]
        if (def && isValidFieldValue(def, value)) f[id] = value
      }
      if (Object.keys(f).length) out.fields = f
    }
    return out
  }

  return {
    config: { machines, fields, derive, actions },
    ownerOf,
    params,
    initial,
    movesFrom,
    can,
    contextOf,
    sanitize,
  }
}

export function isValidFieldValue(def: AnyField, value: unknown): value is Primitive {
  switch (def.type) {
    case "boolean":
      return typeof value === "boolean"
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return false
      if (def.min !== undefined && value < def.min) return false
      if (def.max !== undefined && value > def.max) return false
      return true
    case "enum":
      return (
        typeof value === "string" &&
        def.options.some((o) => (typeof o === "string" ? o : o.value) === value)
      )
    case "string":
      return typeof value === "string"
    case "date":
      return value === null || typeof value === "string"
  }
}

export function optionsOf(def: { options: ReadonlyArray<string | { value: string; label?: string; note?: string }> }) {
  return def.options.map((o) => (typeof o === "string" ? { value: o, label: o } : { label: o.value, ...o }))
}

/** Does this control apply on the screen we are looking at? */
export function visible(def: { when?: (env: Env) => boolean; hidden?: boolean }, env: Env): boolean {
  if (def.hidden) return false
  return def.when ? def.when(env) : true
}

/**
 * Describe a prototype's scenario space.
 *
 * Machines are journeys whose states write whole tuples; fields are free axes.
 * Everything is validated eagerly, so a bad config throws where you wrote it
 * rather than misbehaving where you clicked.
 */
export function defineMachine<
  /* No default type arguments on M and F, deliberately. A default is used as
     the contextual type while inference is still open, so `= Record<never,
     never>` silently leaves every `when(env)` callback's parameter implicitly
     `any`. Omitting the defaults costs nothing — an absent `machines` or
     `fields` key still infers an empty object from the call site. */
  const M extends Record<string, MachineDef>,
  const F extends Record<string, AnyField>,
  D extends Record<string, unknown> = Record<never, never>,
>(config: {
  machines?: M
  fields?: F
  derive?: { [K in keyof D]: (ctx: BaseContext<M, F>) => D[K] }
  actions?: ReadonlyArray<ActionDef>
}): Machine<M, F, D> {
  return compile(
    config as unknown as Parameters<typeof compile>[0]
  ) as Machine<M, F, D>
}

export { warn }
