/* The shapes a prototype's scenario space is described in.
 *
 * Two kinds of thing live here, and the difference between them is the whole
 * idea of this package:
 *
 *   A MACHINE is a journey. It has named states, one of which is current, and
 *   each state writes a whole tuple of context at once. You cannot be halfway
 *   between two of its states, which is how "a request that arrived on a key
 *   that was never issued" stops being expressible.
 *
 *   A FIELD is an independent axis. It varies freely and means nothing to the
 *   other axes.
 *
 * Most prototype controls that get built by hand are all fields, which is why
 * most prototype controls can be driven into states the product cannot reach.
 */

/** Everything a scenario is allowed to put into context. Must survive JSON. */
export type Primitive = string | number | boolean | null

/** What a `when` predicate gets to look at: the host, not the scenario. */
export interface Env {
  /** Current route path, supplied by the host. `null` if it did not supply one. */
  path: string | null
  /** Anything else the host wants predicates to see. */
  [key: string]: unknown
}

/** Mirror a scenario value onto the DOM, for CSS that reads attributes. */
export interface DomBinding {
  /** e.g. `data-density` */
  attribute: string
  /** Defaults to the document element. */
  target?: "html" | "body"
}

interface Common {
  label?: string
  /** Explains the state to whoever is clicking. Rendered as a tooltip. */
  note?: string
  /** Keep it in context, URL and storage, but out of the panel. */
  hidden?: boolean
  /** Override the query-string key. Defaults to the id. */
  param?: string
  /** Show this control only when the predicate passes. */
  when?: (env: Env) => boolean
}

export interface BooleanField extends Common {
  type: "boolean"
  default: boolean
  trueLabel?: string
  falseLabel?: string
  dom?: DomBinding
}

export interface EnumOption {
  value: string
  label?: string
  note?: string
}

export interface EnumField extends Common {
  type: "enum"
  default: string
  options: ReadonlyArray<string | EnumOption>
  /** Pills by default; a select once there are more than `SELECT_THRESHOLD`. */
  control?: "pills" | "select"
  dom?: DomBinding
}

export interface NumberField extends Common {
  type: "number"
  default: number
  min?: number
  max?: number
  step?: number
  control?: "stepper" | "range"
}

export interface StringField extends Common {
  type: "string"
  default: string
  placeholder?: string
}

export interface DateField extends Common {
  type: "date"
  /** ISO 8601, or null for "has not happened yet". */
  default: string | null
}

export type AnyField =
  | BooleanField
  | EnumField
  | NumberField
  | StringField
  | DateField

/** Above this many options a pill row becomes a select. */
export const SELECT_THRESHOLD = 6

export interface MachineStateDef {
  label?: string
  note?: string
  /** The tuple this state writes into context. Nothing else may write these. */
  assign?: Record<string, Primitive>
}

export interface MachineDef {
  label?: string
  /** Which state a fresh visitor starts in. */
  initial: string
  states: Record<string, MachineStateDef>
  /**
   * Legal moves, as `from -> to[]`. Omit the whole key and every state is
   * reachable from every state, which is the right answer for a view control
   * (a data-state switch is not a journey and has no illegal moves).
   *
   * Omit a single `from` key inside a supplied map and that state is a dead
   * end. That is a real thing to want and so it is not treated as "unspecified".
   */
  transitions?: Record<string, ReadonlyArray<string>>
  hidden?: boolean
  param?: string
  when?: (env: Env) => boolean
}

/** The subset of the API that a declared action is handed. */
export interface ActionApi {
  set(patch: Record<string, Primitive>): void
  go(machine: string, state: string): void
  reset(): void
  /** No-op unless the host passed a `navigate` prop. */
  navigate(to: string): void
  /** The current flat context, derived values included. */
  get(): Record<string, unknown>
}

export interface ActionDef {
  id: string
  label: string
  title?: string
  when?: (env: Env) => boolean
  run: (api: ActionApi) => void
}

export interface MachineConfigShape {
  machines?: Record<string, MachineDef>
  fields?: Record<string, AnyField>
  derive?: Record<string, (ctx: never) => unknown>
  actions?: ReadonlyArray<ActionDef>
}

/* ------------------------------------------------------------------ */
/* Type-level plumbing, so `useScenario()` knows the shape of context  */
/* without the caller annotating anything.                             */
/* ------------------------------------------------------------------ */

/**
 * `defineMachine` takes a `const` type parameter so state ids and enum options
 * survive as literal unions. That also freezes every `assign` value into a
 * literal (`step: 0` becomes the type `0`), which is wrong — the field is a
 * number that happens to start at zero. Widen those back.
 */
export type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T

export type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

/** `{ journey: "parked" | "firstRun" | ... }` — the cursor of each machine. */
export type MachineCursors<M> = {
  -readonly [K in keyof M]: M[K] extends { states: infer S } ? keyof S & string : string
}

/** Every `assign` object declared anywhere, as a union of object types. */
export type AllAssigns<M> = {
  [K in keyof M]: M[K] extends { states: infer S }
    ? { [SK in keyof S]: S[SK] extends { assign: infer A } ? A : never }[keyof S]
    : never
}[keyof M]

export type AssignKeys<M> = AllAssigns<M> extends infer U
  ? U extends unknown
    ? keyof U
    : never
  : never

/**
 * The assigned tuple, flattened.
 *
 * Values UNION across states rather than intersecting: `firstRequestAt` is
 * `null` in three states and a string in two, and intersecting those gives
 * `never` — which silently poisons the whole context type and is exactly the
 * kind of thing you only notice when every property stops autocompleting.
 */
export type MachineAssigns<M> = {
  [K in AssignKeys<M> & string]: AllAssigns<M> extends infer U
    ? U extends Record<K, unknown>
      ? Widen<U[K]>
      : never
    : never
}

export type FieldValue<F> = F extends { type: "boolean" }
  ? boolean
  : F extends { type: "number" }
    ? number
    : F extends { type: "enum"; options: infer O }
      ? O extends ReadonlyArray<infer Item>
        ? Item extends string
          ? Item
          : Item extends { value: infer V }
            ? V
            : string
        : string
      : F extends { type: "date" }
        ? string | null
        : string

export type FieldValues<F> = { -readonly [K in keyof F]: FieldValue<F[K]> }

/** What `derive` functions see: everything real, but no other derived value. */
export type BaseContext<M, F> = MachineCursors<M> & MachineAssigns<M> & FieldValues<F>

/**
 * The flat object a consumer reads.
 *
 * `D` is the map of derived VALUES, not of the functions producing them:
 * `defineMachine` declares `derive` as `{ [K in keyof D]: (ctx) => D[K] }`, so
 * `D` is inferred from each callback's return type while `ctx` keeps its
 * contextual type. Inferring the functions instead leaves `ctx` implicitly
 * `any`, because TypeScript does not contextually type a parameter from the
 * constraint of the type it is inferring.
 */
export type Context<M, F, D> = BaseContext<M, F> & D
