import { type CompiledMachine, type Snapshot } from "./machine"
import { toLink } from "./serialize"

/* The scenario, written out for something that cannot see the screen.
 *
 * A coding agent asked to fix what you are looking at needs to know which of
 * the prototype's states you are in, and "the guardrails page looks wrong" does
 * not carry that. Neither does a screenshot. This does, in the same move
 * agentation makes for annotations: click once, paste into the agent.
 *
 * The link at the bottom is what makes it reproducible rather than merely
 * descriptive. */

export interface ReportOptions {
  /** Route being viewed, if the host supplied one. */
  path?: string | null
  /** Base URL for the link line. Defaults to the current location. */
  href?: string
  /** Heading text. */
  title?: string
}

export function toMarkdown(
  machine: CompiledMachine,
  snapshot: Snapshot,
  options: ReportOptions = {}
): string {
  const lines: string[] = [`## ${options.title ?? "Prototype scenario"}`]

  for (const [id, def] of Object.entries(machine.config.machines)) {
    const stateId = snapshot.machines[id] ?? def.initial
    const state = def.states[stateId]
    const name = state?.label ?? stateId
    const note = state?.note ? ` — ${state.note}` : ""
    lines.push(`- ${def.label ?? id}: **${name}**${note}`)
  }

  for (const [id, def] of Object.entries(machine.config.fields)) {
    if (def.hidden) continue
    const value = id in snapshot.fields ? snapshot.fields[id] : def.default
    lines.push(`- ${def.label ?? id}: ${describeValue(def, value)}`)
  }

  /* The assigned tuple, spelled out. A machine state's label says "Key made";
     the agent needs to know that means step 2 and keyIssued true, because those
     are the names the code branches on. */
  const assigned = assignedTuple(machine, snapshot)
  if (Object.keys(assigned).length) {
    const pairs = Object.entries(assigned)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(", ")
    lines.push("", `Context written by those states: ${pairs}`)
  }

  const derived = derivedValues(machine, snapshot)
  if (Object.keys(derived).length) {
    const pairs = Object.entries(derived)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(", ")
    lines.push(`Derived: ${pairs}`)
  }

  lines.push("")
  if (options.path) lines.push(`Route: ${options.path}`)
  lines.push(`Link: ${toLink(machine, snapshot, options.href)}`)

  return lines.join("\n")
}

function describeValue(
  def: { type: string; trueLabel?: string; falseLabel?: string },
  value: unknown
): string {
  if (def.type === "boolean") {
    return value ? `**${def.trueLabel ?? "on"}**` : `**${def.falseLabel ?? "off"}**`
  }
  if (value === null) return "_none_"
  return `**${String(value)}**`
}

function assignedTuple(machine: CompiledMachine, snapshot: Snapshot) {
  const out: Record<string, unknown> = {}
  for (const [id, def] of Object.entries(machine.config.machines)) {
    const stateId = snapshot.machines[id] ?? def.initial
    Object.assign(out, def.states[stateId]?.assign ?? {})
  }
  return out
}

function derivedValues(machine: CompiledMachine, snapshot: Snapshot) {
  const names = Object.keys(machine.config.derive)
  if (!names.length) return {}
  const ctx = machine.contextOf(snapshot)
  const out: Record<string, unknown> = {}
  for (const name of names) out[name] = ctx[name]
  return out
}

/** Best-effort clipboard write. Returns whether it landed. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* Insecure origin, denied permission, or no focus. Fall through. */
  }
  /* execCommand is deprecated and still the only thing that works on an
     http:// origin, which is where prototypes live. */
  try {
    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.opacity = "0"
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}
