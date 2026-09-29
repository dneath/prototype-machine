"use client"

import * as React from "react"

import { type Machine } from "../core/index"
import { type Context, type StateOf, type TypedMoves } from "../core/index"
import { type Scenario, ScenarioContext, StoreCtx } from "./provider"

/** A scenario whose `go`, `can`, `movesFrom` and `set` are checked against its config. */
export type TypedScenario<M, F, D> = Omit<Scenario<Context<M, F, D>>, "go" | "set" | "can" | "movesFrom"> &
  TypedMoves<M, F> & {
    can<K extends keyof M & string>(machine: K, state: StateOf<M, K>): boolean
    movesFrom<K extends keyof M & string>(machine: K): ReadonlyArray<StateOf<M, K>>
  }

/**
 * The scenario: every context value flat on the object, plus the API.
 *
 * Pass the machine for typed context. Passing nothing still works and gives
 * you the API with an untyped bag of context, which is what a shared component
 * deep in a library wants.
 *
 * ```tsx
 * const p = useScenario(machine)
 * if (p.data === "loading") return <Skeleton />
 * const rows = p.hasEvents ? EVENTS : []
 * ```
 */
export function useScenario<M, F, D>(
  machine: Machine<M, F, D>
): TypedScenario<M, F, D>
export function useScenario(): Scenario
export function useScenario(machine?: unknown): Scenario {
  const ctx = React.useContext(ScenarioContext)
  if (!ctx) {
    throw new Error(
      "[prototype-machine] useScenario() was called outside <ScenarioProvider>. Wrap your app in it — usually in the root layout, above everything that reads a scenario."
    )
  }
  void machine
  return ctx
}

/**
 * A derived value that re-renders only when the selector's result changes
 * (compared with `Object.is`). Return primitives or stable references.
 */
export function useScenarioSelector<M, F, D, T>(
  machine: Machine<M, F, D>,
  selector: (ctx: Context<M, F, D>) => T
): T {
  const store = React.useContext(StoreCtx)
  if (!store) {
    throw new Error(
      "[prototype-machine] useScenarioSelector() was called outside <ScenarioProvider>."
    )
  }
  void machine
  const read = () => selector(store.get() as Context<M, F, D>)
  return React.useSyncExternalStore(store.subscribe, read, read)
}

/** One value, re-rendering only when that value changes. */
export function useScenarioValue<M, F, D, K extends keyof Context<M, F, D>>(
  machine: Machine<M, F, D>,
  key: K
): Context<M, F, D>[K] {
  return useScenarioSelector(machine, (ctx) => ctx[key])
}
