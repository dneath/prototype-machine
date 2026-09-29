"use client"

import * as React from "react"

import {
  type CompiledMachine,
  type Machine,
  type PartialSnapshot,
  type Snapshot,
  has,
  isDev,
  isValidFieldValue,
  suggest,
} from "../core/index"
import { type Env, type Primitive } from "../core/index"
import {
  clearStorage,
  fromSearch,
  mergeSearch,
  readStorage,
  resolve,
  writeStorage,
} from "../core/index"

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
  /** Current route, for `when` predicates. */
  path?: string | null
  /** Router push, for declared actions. Without it, `navigate` is a no-op. */
  navigate?: (to: string) => void
  /** Anything else `when` predicates should see. */
  env?: Record<string, unknown>
  /**
   * Whether the CONTROLS mount. Defaults to "not a production build".
   *
   * Context is always provided regardless — consumers read it in every build,
   * and a deployed review build should still honour a scenario query string.
   * Production builds resolve to a stub panel through the "production" export
   * condition, so the panel's bytes never ship.
   */
  enabled?: boolean
  /**
   * Keep the address bar in step with the scenario, using `replaceState` so
   * history is never polluted. Off by default: the query string is read once
   * and then removed, so a reload shows what you last clicked, not the link.
   */
  syncUrl?: boolean
  /** Follow scenario changes saved by other tabs on the same storageKey. Off by default. */
  syncTabs?: boolean
  children?: React.ReactNode
}

const liveKeys = new Map<string, number>()

export function ScenarioProvider({
  machine,
  storageKey,
  path = null,
  navigate,
  env: extraEnv,
  enabled,
  syncUrl = false,
  syncTabs = false,
  children,
}: ScenarioProviderProps) {
  const m = machine as CompiledMachine
  const hydrated = useHydrated()

  const [edits, setEditsState] = React.useState<PartialSnapshot>({})
  /* The latest edit layer, readable synchronously. Two calls in one handler
     each build on the previous one instead of on the last render's state. */
  const editsRef = React.useRef<PartialSnapshot>(edits)
  const initialEdits = React.useRef(edits)
  const setEdits = React.useCallback((next: PartialSnapshot) => {
    editsRef.current = next
    setEditsState(next)
  }, [])
  const [open, setOpen] = React.useState(false)

  /* Server and first client render both produce the config's defaults, so the
     markup matches and nothing has to be suppressed. Storage and the URL are
     layered on from the render AFTER hydration — a read, not a write.

     A query string that names any scenario key is the whole scenario: the
     storage layer is skipped, so this browser's leftovers cannot leak in. */
  const [urlVersion, setUrlVersion] = React.useState(0)
  const layers = React.useMemo<ReadonlyArray<PartialSnapshot>>(() => {
    if (!hydrated) return []
    const search = window.location.search
    if (hasScenarioParams(m, search)) return [fromSearch(m, search)]
    return [readStorage(m, storageKey)]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, m, storageKey, urlVersion])

  /* A scenario that arrived by URL is persisted straight away, so it survives
     the query being stripped or the tab being reloaded. */
  React.useEffect(() => {
    if (!hydrated) return
    const search = window.location.search
    if (!hasScenarioParams(m, search)) return
    writeStorage(m, storageKey, resolve(m, layers))
    if (!syncUrl) {
      const url = window.location.pathname + mergeSearch(m, search, null) + window.location.hash
      window.history.replaceState(window.history.state, "", url)
    }
  }, [hydrated, m, storageKey, layers, syncUrl])

  /* Back/forward with a different query: take it as the new scenario. */
  React.useEffect(() => {
    if (!syncUrl) return
    const onPop = () => {
      setEdits({})
      initialEdits.current = editsRef.current
      setUrlVersion((v) => v + 1)
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [syncUrl, setEdits])

  const layersRef = React.useRef(layers)
  layersRef.current = layers

  const snapshot = React.useMemo(() => resolve(m, [...layers, edits]), [m, layers, edits])

  /* Only writes once something was actually edited, batched so a slider drag
     or typing does not hit storage on every event, and flushed on pagehide. */
  const pending = React.useRef<(() => void) | null>(null)
  React.useEffect(() => {
    if (!hydrated || edits === initialEdits.current) return
    const write = () => {
      pending.current = null
      writeStorage(m, storageKey, snapshot)
    }
    pending.current = write
    const timer = window.setTimeout(write, 150)
    return () => window.clearTimeout(timer)
  }, [hydrated, m, storageKey, snapshot, edits])

  React.useEffect(() => {
    if (!isDev) return
    const count = (liveKeys.get(storageKey) ?? 0) + 1
    liveKeys.set(storageKey, count)
    if (count > 1) {
      console.warn(`[prototype-machine] Two providers share the storageKey "${storageKey}". They will overwrite each other's saved scenario; give each its own key.`)
    }
    return () => {
      const left = (liveKeys.get(storageKey) ?? 1) - 1
      if (left <= 0) liveKeys.delete(storageKey)
      else liveKeys.set(storageKey, left)
    }
  }, [storageKey])

  /* Another tab saved a scenario under the same key: follow it. */
  React.useEffect(() => {
    if (!syncTabs) return
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return
      setEdits({})
      initialEdits.current = editsRef.current
      setUrlVersion((v) => v + 1)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [syncTabs, storageKey, setEdits])

  React.useEffect(() => {
    const flush = () => pending.current?.()
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [])

  /* Address bar sync: one replaceState per frame at most, only our keys. */
  React.useEffect(() => {
    if (!syncUrl || !hydrated) return
    const frame = window.requestAnimationFrame(() => {
      const next = mergeSearch(m, window.location.search, snapshot)
      if (next === window.location.search) return
      window.history.replaceState(window.history.state, "", window.location.pathname + next + window.location.hash)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [syncUrl, hydrated, m, snapshot])

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
      const def = has(m.config.machines, machineId) ? m.config.machines[machineId] : undefined
      if (!def) {
        if (isDev) console.warn(
            `[prototype-machine] No machine called "${machineId}".${suggest(machineId, Object.keys(m.config.machines))}`
          )
        return
      }
      if (!has(def.states, stateId)) {
        if (isDev) {
          console.warn(
            `[prototype-machine] "${machineId}" has no state "${stateId}".${suggest(stateId, Object.keys(def.states))} Known: ${Object.keys(def.states).join(", ")}.`
          )
        }
        return
      }
      const current = editsRef.current
      const live = resolve(m, [...layersRef.current, current])
      const from = live.machines[machineId] ?? def.initial
      if (!m.can(machineId, from, stateId)) {
        if (isDev) {
          console.warn(
            `[prototype-machine] "${machineId}" cannot go ${from} -> ${stateId}. Legal from here: ${m.movesFrom(machineId, from).join(", ") || "nothing"}.`
          )
        }
        return
      }
      setEdits({
        machines: { ...current.machines, [machineId]: stateId },
        fields: { ...current.fields },
      })
    }

    const set = (patch: Record<string, Primitive>) => {
      const fields: Record<string, Primitive> = {}
      for (const [key, value] of Object.entries(patch)) {
        const owner = has(m.ownerOf, key) ? m.ownerOf[key] : undefined
        if (owner) {
          if (isDev) {
            console.warn(
              `[prototype-machine] "${key}" is written by the "${owner}" machine, not set directly. Use go("${owner}", …) — refusing this is what stops half-written tuples existing.`
            )
          }
          continue
        }
        if (!has(m.config.fields, key)) {
          if (isDev) console.warn(
              `[prototype-machine] "${key}" is not a declared field.${suggest(key, Object.keys(m.config.fields))}`
            )
          continue
        }
        if (!isValidFieldValue(m.config.fields[key], value)) {
          if (isDev) {
            const def = m.config.fields[key]
            const range =
              def.type === "number"
                ? ` Expected a number${def.min !== undefined ? ` >= ${def.min}` : ""}${def.max !== undefined ? ` <= ${def.max}` : ""}.`
                : ` Expected a ${def.type} value.`
            console.warn(`[prototype-machine] Refusing ${JSON.stringify(value)} for "${key}".${range}`)
          }
          continue
        }
        fields[key] = value
      }
      if (!Object.keys(fields).length) return
      const current = editsRef.current
      setEdits({
        machines: { ...current.machines },
        fields: { ...current.fields, ...fields },
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
    }
  }, [
    context, m, snapshot, storageKey, setEdits,
    env, navigate, hydrated, enabled, open,
  ])

  const store = React.useState(createStore)[0]
  React.useLayoutEffect(() => {
    store.publish(context)
  }, [store, context])
  if (!store.ready) store.seed(context)

  return (
    <StoreCtx.Provider value={store}>
      <Ctx.Provider value={api}>{children}</Ctx.Provider>
    </StoreCtx.Provider>
  )
}

export { Ctx as ScenarioContext }

export interface ScenarioStore {
  ready: boolean
  get(): Record<string, unknown>
  subscribe(listener: () => void): () => void
  seed(value: Record<string, unknown>): void
  publish(value: Record<string, unknown>): void
}

/* A stable store beside the context, so a selector hook re-renders only when
   the value it picked actually changes. */
function createStore(): ScenarioStore {
  let current: Record<string, unknown> = {}
  const listeners = new Set<() => void>()
  return {
    ready: false,
    get: () => current,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    seed(value) {
      current = value
      this.ready = true
    },
    publish(value) {
      if (value === current) return
      current = value
      for (const listener of listeners) listener()
    },
  }
}

export const StoreCtx = React.createContext<ScenarioStore | null>(null)

function hasScenarioParams(m: CompiledMachine, search: string): boolean {
  const params = new URLSearchParams(search)
  return Object.keys(m.params).some((key) => params.has(key))
}
