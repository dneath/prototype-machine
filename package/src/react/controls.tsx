"use client"

import * as React from "react"

import { optionsOf, presetsOf, type LabelledPreset } from "../core/index"
import { SELECT_THRESHOLD, type AnyField, type MachineDef, type Primitive } from "../core/index"
import { type Scenario } from "./provider"
import { Select } from "./select"

/* Past this many presets a row of pills costs more space than it saves, and
   the presets become a dropdown instead. */
const PRESET_PILLS = 6

/**
 * A labelled control. `onReset`, when given, draws a small way back to the
 * default beside the label — only while the value differs from it, so the
 * presence of the button is itself the "changed" signal.
 */
export function Row({
  label,
  children,
  onReset,
  layout = "pills",
}: {
  label: string
  children: React.ReactNode
  onReset?: () => void
  /** Pills wrap in a row; a stack gives each child the full width. */
  layout?: "pills" | "stack"
}) {
  const id = React.useId()
  return (
    <div className="pm-row">
      <div className="pm-row-head">
        <span className="pm-label" id={id} title={label}>
          {label}
        </span>
        {onReset ? (
          <button type="button" className="pm-reset" onClick={onReset} aria-label={`Reset ${label} to its default`} title="Back to the default">
            Reset
          </button>
        ) : null}
      </div>
      <div className={layout === "stack" ? "pm-stack" : "pm-options"} role="group" aria-labelledby={id}>
        {children}
      </div>
    </div>
  )
}

/**
 * A pill. An unavailable one stays focusable and says why: `aria-disabled`
 * keeps it in the tab order, and the reason is read out through a visually
 * hidden description, with the same text as a tooltip for the pointer.
 */
export function Pill({
  active,
  disabled,
  onClick,
  title,
  reason,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  title?: string
  /** Why it is unavailable. Only used when `disabled`. */
  reason?: string
  children: React.ReactNode
}) {
  const id = React.useId()
  const why = disabled ? reason : undefined
  return (
    <>
      <button
        type="button"
        className="pm-pill"
        onClick={() => {
          if (!disabled) onClick()
        }}
        aria-disabled={disabled ? true : undefined}
        aria-describedby={why ? id : undefined}
        title={why ?? title}
        aria-pressed={active}
      >
        {children}
      </button>
      {why ? (
        <span id={id} className="pm-sr">
          {why}
        </span>
      ) : null}
    </>
  )
}

/**
 * A machine's states, as pills — or as a dropdown past `SELECT_THRESHOLD`.
 *
 * An illegal move renders present but disabled rather than hidden. The shape of
 * the journey is part of what the panel is showing — a reviewer needs to see
 * that "Active" exists and is two rungs away, not have it vanish and reappear.
 */
export function MachineRow({
  id,
  def,
  scenario,
}: {
  id: string
  def: MachineDef
  scenario: Scenario
}) {
  const current = scenario.snapshot.machines[id] ?? def.initial
  const entries = Object.entries(def.states)
  const here = def.states[current]?.label ?? current
  const moves = scenario.movesFrom(id)
  const reason = moves.length
    ? `Not reachable from ${here}. From here: ${moves
        .map((s) => def.states[s]?.label ?? s)
        .join(", ")}.`
    : `Not reachable from ${here}, which has no moves out.`
  const label = def.label ?? id

  if (entries.length > SELECT_THRESHOLD) {
    return (
      <Row label={label} layout="stack">
        <Select
          label={label}
          value={current}
          onChange={(next) => scenario.go(id, next)}
          options={entries.map(([stateId, state]) => ({
            value: stateId,
            label: state.label ?? stateId,
            note: state.note,
            disabled: !scenario.can(id, stateId),
            reason,
          }))}
        />
      </Row>
    )
  }

  return (
    <Row label={label}>
      {entries.map(([stateId, state]) => (
        <Pill
          key={stateId}
          active={current === stateId}
          disabled={!scenario.can(id, stateId)}
          title={state.note}
          reason={reason}
          onClick={() => scenario.go(id, stateId)}
        >
          {state.label ?? stateId}
        </Pill>
      ))}
    </Row>
  )
}

/** One-click values for a string or number field. */
function Presets<T extends string | number>({
  label,
  presets,
  value,
  onPick,
}: {
  label: string
  presets: ReadonlyArray<LabelledPreset<T>>
  value: Primitive
  onPick: (value: T) => void
}) {
  if (!presets.length) return null
  if (presets.length > PRESET_PILLS) {
    const index = presets.findIndex((p) => p.value === value)
    return (
      <Select
        label={`${label} presets`}
        placeholder="Presets…"
        value={index >= 0 ? String(index) : ""}
        onChange={(i) => onPick(presets[Number(i)].value)}
        options={presets.map((p, i) => ({ value: String(i), label: p.label }))}
      />
    )
  }
  return (
    <div className="pm-options pm-presets" role="group" aria-label={`${label} presets`}>
      {presets.map((p) => (
        <Pill key={`${p.label}:${String(p.value)}`} active={p.value === value} onClick={() => onPick(p.value)}>
          {p.label}
        </Pill>
      ))}
    </div>
  )
}

/** A free field, in whichever control its type and size call for. */
export function FieldRow({
  id,
  def,
  scenario,
}: {
  id: string
  def: AnyField
  scenario: Scenario
}) {
  const label = def.label ?? id
  const value = scenario.snapshot.fields[id] ?? def.default
  const set = (next: Primitive) => scenario.set({ [id]: next })
  const onReset = value !== def.default ? () => set(def.default) : undefined

  switch (def.type) {
    case "boolean":
      return (
        <Row label={label} onReset={onReset}>
          <Pill active={value === true} onClick={() => set(true)}>
            {def.trueLabel ?? "On"}
          </Pill>
          <Pill active={value === false} onClick={() => set(false)}>
            {def.falseLabel ?? "Off"}
          </Pill>
        </Row>
      )

    case "enum": {
      const options = optionsOf(def)
      if (def.control === "select" || (def.control !== "pills" && options.length > SELECT_THRESHOLD)) {
        return (
          <Row label={label} onReset={onReset} layout="stack">
            <Select
              label={label}
              value={String(value)}
              onChange={(next) => set(next)}
              options={options.map((o) => ({ value: o.value, label: o.label ?? o.value, note: o.note }))}
            />
          </Row>
        )
      }
      return (
        <Row label={label} onReset={onReset}>
          {options.map((o) => (
            <Pill key={o.value} active={value === o.value} title={o.note} onClick={() => set(o.value)}>
              {o.label ?? o.value}
            </Pill>
          ))}
        </Row>
      )
    }

    case "number": {
      const n = typeof value === "number" ? value : def.default
      const input =
        def.control === "range" ? (
          <div className="pm-number-row">
            <input
              className="pm-range"
              type="range"
              min={def.min}
              max={def.max}
              step={def.step ?? 1}
              value={n}
              onChange={(e) => set(Number(e.target.value))}
              aria-label={label}
              aria-valuetext={String(n)}
            />
            <span className="pm-number-value" aria-hidden="true">
              {n}
            </span>
          </div>
        ) : (
          <NumberInput
            value={n}
            min={def.min}
            max={def.max}
            step={def.step ?? 1}
            label={label}
            onCommit={set}
          />
        )
      return (
        <Row label={label} onReset={onReset} layout="stack">
          {input}
          <Presets label={label} presets={presetsOf(def)} value={n} onPick={set} />
        </Row>
      )
    }

    case "string": {
      const text = String(value ?? "")
      return (
        <Row label={label} onReset={onReset} layout="stack">
          {def.multiline ? (
            <textarea
              className="pm-textarea"
              value={text}
              rows={3}
              placeholder={def.placeholder}
              onChange={(e) => set(e.target.value)}
              aria-label={label}
              spellCheck={false}
            />
          ) : (
            <input
              className="pm-text"
              type="text"
              value={text}
              placeholder={def.placeholder}
              onChange={(e) => set(e.target.value)}
              aria-label={label}
              spellCheck={false}
              autoComplete="off"
            />
          )}
          <Presets label={label} presets={presetsOf(def)} value={text} onPick={set} />
        </Row>
      )
    }

    case "date":
      return (
        <Row label={label} onReset={onReset} layout="stack">
          <div className="pm-date-row">
            <input
              className="pm-text"
              type="datetime-local"
              value={toLocalInput(value)}
              onChange={(e) => {
                if (!e.target.value) return set(null)
                const date = new Date(e.target.value)
                if (!Number.isNaN(date.getTime())) set(date.toISOString())
              }}
              aria-label={label}
            />
            {def.nullable === false ? null : (
              <Pill active={value === null} onClick={() => set(null)} title="Writes null: has not happened yet">
                Not set
              </Pill>
            )}
          </div>
        </Row>
      )
  }
}

/* `datetime-local` wants "YYYY-MM-DDTHH:mm" in local time; scenarios store ISO
   in UTC, because that is what a timestamp in fixture data looks like. */
function toLocalInput(value: unknown): string {
  if (typeof value !== "string" || !value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/* A draft while typing, so clearing the box to retype does not flash the
   prototype to 0 on the way. Commits valid input as it arrives; blur puts back
   whatever is actually set. */
function NumberInput({
  value,
  min,
  max,
  step,
  label,
  onCommit,
}: {
  value: number
  min?: number
  max?: number
  step: number
  label: string
  onCommit: (next: number) => void
}) {
  const [draft, setDraft] = React.useState<string | null>(null)
  return (
    <input
      className="pm-number"
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={draft ?? String(value)}
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        if (raw.trim() === "") return
        const next = Number(raw)
        if (!Number.isFinite(next)) return
        if (min !== undefined && next < min) return
        if (max !== undefined && next > max) return
        onCommit(next)
      }}
      onBlur={() => setDraft(null)}
      aria-label={label}
      aria-invalid={draft !== null && draft.trim() !== "" && !isInRange(draft, min, max) ? true : undefined}
    />
  )
}

function isInRange(raw: string, min?: number, max?: number): boolean {
  const n = Number(raw)
  return Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)
}
