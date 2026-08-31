import { type CompiledMachine, type Snapshot } from "./machine"

/* Undo for a control panel, which is a smaller problem than undo for a
   document: every entry is a whole snapshot, snapshots are tiny, and there is
   no merging to do. A capped array and an index is the entire design.

   It exists for one moment in a live review — "wait, go back to what you just
   had" — which is otherwise a scramble to remember which four pills were lit. */

export interface HistoryEntry {
  snapshot: Snapshot
  /** What changed to get here. Null for the entry a session opens on. */
  label: string | null
  at: number
}

export interface History {
  entries: ReadonlyArray<HistoryEntry>
  index: number
}

export const DEFAULT_LIMIT = 50

export function initHistory(snapshot: Snapshot): History {
  return { entries: [{ snapshot, label: null, at: Date.now() }], index: 0 }
}

/** Describe a move in the terms the panel labels it with. */
export function describe(
  machine: CompiledMachine,
  from: Snapshot,
  to: Snapshot
): string | null {
  const parts: string[] = []

  for (const [id, def] of Object.entries(machine.config.machines)) {
    const before = from.machines[id]
    const after = to.machines[id]
    if (before === after) continue
    const state = def.states[after]
    parts.push(`${def.label ?? id} → ${state?.label ?? after}`)
  }

  for (const [id, def] of Object.entries(machine.config.fields)) {
    const before = id in from.fields ? from.fields[id] : def.default
    const after = id in to.fields ? to.fields[id] : def.default
    if (before === after) continue
    const shown =
      def.type === "boolean"
        ? after
          ? (def.trueLabel ?? "on")
          : (def.falseLabel ?? "off")
        : String(after)
    parts.push(`${def.label ?? id} → ${shown}`)
  }

  if (parts.length === 0) return null
  /* Three is where the label stops being scannable in a 288px panel. */
  if (parts.length > 3) return `${parts.slice(0, 3).join(", ")} +${parts.length - 3} more`
  return parts.join(", ")
}

/**
 * Record a move.
 *
 * Pushing while somewhere behind the head discards the moves in front, the way
 * every undo stack does — you took a different branch, so the old one is gone.
 * A push that changes nothing is dropped rather than stored, so a reviewer
 * clicking the pill that is already lit does not have to press undo twice.
 */
export function push(
  history: History,
  entry: { snapshot: Snapshot; label: string | null },
  limit = DEFAULT_LIMIT
): History {
  const current = history.entries[history.index]
  if (current && sameSnapshot(current.snapshot, entry.snapshot)) return history

  const kept = history.entries.slice(0, history.index + 1)
  kept.push({ ...entry, at: Date.now() })

  const overflow = Math.max(0, kept.length - limit)
  const entries = overflow ? kept.slice(overflow) : kept
  return { entries, index: entries.length - 1 }
}

export function canUndo(history: History): boolean {
  return history.index > 0
}

export function canRedo(history: History): boolean {
  return history.index < history.entries.length - 1
}

export function undo(history: History): History {
  return canUndo(history) ? { ...history, index: history.index - 1 } : history
}

export function redo(history: History): History {
  return canRedo(history) ? { ...history, index: history.index + 1 } : history
}

export function at(history: History): HistoryEntry {
  return history.entries[history.index]
}

export function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  const am = Object.keys(a.machines)
  const bm = Object.keys(b.machines)
  if (am.length !== bm.length) return false
  for (const k of am) if (a.machines[k] !== b.machines[k]) return false

  const af = Object.keys(a.fields)
  const bf = Object.keys(b.fields)
  if (af.length !== bf.length) return false
  for (const k of af) if (a.fields[k] !== b.fields[k]) return false

  return true
}
