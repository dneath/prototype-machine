"use client"

import * as React from "react"

import { type Machine } from "../core/machine"
import { type Context } from "../core/schema"
import { type Scenario, ScenarioContext } from "./provider"

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
): Scenario<Context<M, F, D>>
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
 * One value, for a component that should not re-render when unrelated axes
 * move. Everything in the panel changes the same context object, so a screen
 * reading only `role` still re-renders when someone toggles a data state —
 * fine for a prototype, wasteful for a component in a long list.
 */
export function useScenarioValue<M, F, D, K extends keyof Context<M, F, D>>(
  machine: Machine<M, F, D>,
  key: K
): Context<M, F, D>[K] {
  const ctx = useScenario(machine)
  return ctx[key]
}
