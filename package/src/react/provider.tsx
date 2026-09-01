"use client"

import * as React from "react"

import {
  type CompiledMachine,
  type Machine,
  type PartialSnapshot,
  type Snapshot,
  isDev,
} from "../core/machine"
import { type Env, type Primitive } from "../core/schema"
import {
  clearStorage,
  fromSearch,
  readStorage,
  resolve,
  toLink,
  writeStorage,
} from "../core/serialize"

export interface ScenarioApi {
  /** Change free fields. Refuses keys a machine owns. */
  set(patch: Record<string, Primitive>): void
  /** Move a machine. Refuses a move the transitions do not allow. */
  go(machineId: string, stateId: string): void
  /** Is that move legal from where this machine currently is? */
  can(machineId: string, stateId: string): boolean
  movesFrom(machineId: string): ReadonlyArray<string>
  /** Back to the config's defaults, and forget what was stored. */
  reset(): void

  /** A URL that reproduces the current scenario. */
  link(): string

  snapshot: Snapshot
  machine: CompiledMachine
  /** The provider's localStorage key, for anything needing to namespace beside it. */
  storageKey: string
  env: Env
  navigate(to: string): void
  hydrated: boolean
  /** Whether the controls are allowed to mount in this build. */
  enabled: boolean

  open: boolean
  setOpen(open: boolean): void
  diagramOpen: boolean
  setDiagramOpen(open: boolean): void
}

/** Context and the API in one object, so `p.step` and `p.set` read alike. */
export type Scenario<Ctx = Record<string, unknown>> = ScenarioApi & Ctx

const Ctx = React.createContext<Scenario | null>(null)

/* Hydration, as an external store rather than a `useState` + `useEffect` flag.
   `getServerSnapshot` returns false and `getSnapshot` returns true, and React
   swaps between them exactly once, when hydration finishes — which is the
   question, answered by the mechanism built for it.

   The alternative is reading localStorage in an effect and calling setState,
   which works and is a cascading render on every single load. */
const noSubscribe = () => () => {}
const onClient = () => true
const onServer = () => false

export function useHydrated(): boolean {
  return React.useSyncExternalStore(noSubscribe, onClient, onServer)
}

export interface ScenarioProviderProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  machine: Machine<any, any, any> | CompiledMachine
  /**
   * localStorage key. Required, and worth versioning: bump it whenever a field
   * changes MEANING rather than merely changing value, because every browser
   * that has opened this prototype is holding the old shape and will happily
   * render it under the new reading.
   */
  storageKey: string
  /** Current route, for `when` predicates and the report's Route line. */
  path?: string | null
  /** Router push, for declared actions. Without it, `navigate` is a no-op. */
  navigate?: (to: string) => void
  /** Anything else `when` predicates should see. */
  env?: Record<string, unknown>
  /**
   * Whether the CONTROLS mount. Defaults to "not a production build".
   *
   * Context is always provided regardless — consumers read it in every build,
   * and a deployed review build should still honour a shared scenario link.
   * To keep the panel's bytes out of a production bundle entirely, alias the
   * module at the bundler; see the README.
   */
  enabled?: boolean
  children?: React.ReactNode
}

export function ScenarioProvider({
  machine,
  storageKey,
  path = null,
  navigate,
  env: extraEnv,
  enabled,
  children,
}: ScenarioProviderProps) {
  const m = machine as CompiledMachine
  const hydrated = useHydrated()

  const [edits, setEdits] = React.useState<PartialSnapshot>({})
  const [open, setOpen] = React.useState(false)
  const [diagramOpen, setDiagramOpen] = React.useState(false)

  /* Server and first client render both produce the config's defaults, so the
     markup matches and nothing has to be suppressed. Storage and the URL are
     layered on from the render AFTER hydration — a read, not a write. */
  const layers = React.useMemo<ReadonlyArray<PartialSnapshot>>(() => {
    if (!hydrated) return []
    /* URL last: a link has to beat whatever this browser did earlier. */
    return [readStorage(m, storageKey), fromSearch(m, window.location.search)]
  }, [hydrated, m, storageKey])

  const snapshot = React.useMemo(() => resolve(m, [...layers, edits]), [m, layers, edits])

  /* Writing to an external system is exactly what an effect is for. */
  React.useEffect(() => {
    if (!hydrated) return
    writeStorage(storageKey, snapshot)
  }, [hydrated, storageKey, snapshot])

  const context = React.useMemo(() => m.contextOf(snapshot), [m, snapshot])

  /* Fields that mirror themselves onto the DOM, for CSS that reads attributes
     rather than props — the generalisation of a hand-rolled density toggle. */
  React.useEffect(() => {
    if (typeof document === "undefined") return
    const applied: Array<[Element, string]> = []
    for (const [id, def] of Object.entries(m.config.fields)) {
      const binding = "dom" in def ? def.dom : undefined
      if (!binding) continue
      const el = binding.target === "body" ? document.body : document.documentElement
      if (!el) continue
      el.setAttribute(binding.attribute, String(context[id]))
      applied.push([el, binding.attribute])
    }
    return () => {
      for (const [el, attribute] of applied) el.removeAttribute(attribute)
    }
  }, [m, context])

  const env = React.useMemo<Env>(() => ({ path, ...extraEnv }), [path, extraEnv])

  /* Every mutation writes the FULL next edit layer rather than a patch, so
     nothing calls setState from inside another setState's updater — which
     React is free to run twice. */
  const api = React.useMemo<Scenario>(() => {
    const go = (machineId: string, stateId: string) => {
      const def = m.config.machines[machineId]
      if (!def) {
        if (isDev) console.warn(`[prototype-machine] No machine called "${machineId}".`)
        return
      }
      if (!def.states[stateId]) {
        if (isDev) {
          console.warn(
            `[prototype-machine] "${machineId}" has no state "${stateId}". Known: ${Object.keys(def.states).join(", ")}.`
          )
        }
        return
      }
      const from = snapshot.machines[machineId] ?? def.initial
      if (!m.can(machineId, from, stateId)) {
        if (isDev) {
          console.warn(
            `[prototype-machine] "${machineId}" cannot go ${from} -> ${stateId}. Legal from here: ${m.movesFrom(machineId, from).join(", ") || "nothing"}.`
          )
        }
        return
      }
      setEdits({
        machines: { ...edits.machines, [machineId]: stateId },
        fields: { ...edits.fields },
      })
    }

    const set = (patch: Record<string, Primitive>) => {
      const fields: Record<string, Primitive> = {}
      for (const [key, value] of Object.entries(patch)) {
        const owner = m.ownerOf[key]
        if (owner) {
          if (isDev) {
            console.warn(
              `[prototype-machine] "${key}" is written by the "${owner}" machine, not set directly. Use go("${owner}", …) — refusing this is what stops half-written tuples existing.`
            )
          }
          continue
        }
        if (!(key in m.config.fields)) {
          if (isDev) console.warn(`[prototype-machine] "${key}" is not a declared field.`)
          continue
        }
        fields[key] = value
      }
      if (!Object.keys(fields).length) return
      setEdits({
        machines: { ...edits.machines },
        fields: { ...edits.fields, ...fields },
      })
    }

    return {
      ...context,
      set,
      go,
      can: (machineId: string, stateId: string) => {
        const def = m.config.machines[machineId]
        if (!def) return false
        return m.can(machineId, snapshot.machines[machineId] ?? def.initial, stateId)
      },
      movesFrom: (machineId: string) => {
        const def = m.config.machines[machineId]
        if (!def) return []
        return m.movesFrom(machineId, snapshot.machines[machineId] ?? def.initial)
      },
      /* Reset clears the session's edits AND the stored scenario, so it means
         the same thing on this load and the next one. */
      reset: () => {
        clearStorage(storageKey)
        const fresh = m.initial()
        setEdits({ machines: { ...fresh.machines }, fields: { ...fresh.fields } })
      },
      link: () => toLink(m, snapshot),
      snapshot,
      machine: m,
      storageKey,
      env,
      navigate: (to: string) => {
        if (navigate) navigate(to)
        else if (isDev) {
          console.warn(
            `[prototype-machine] An action asked to navigate to "${to}", but <ScenarioProvider> was given no \`navigate\` prop.`
          )
        }
      },
      hydrated,
      enabled: enabled ?? isDev,
      open,
      setOpen,
      diagramOpen,
      setDiagramOpen,
    }
  }, [
    context, m, snapshot, edits, storageKey,
    env, navigate, path, hydrated, enabled, open, diagramOpen,
  ])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export { Ctx as ScenarioContext }
