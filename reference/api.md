# API reference

**Part of [prototype-machine](../SKILL.md)** — targets prototype-machine 0.1.0.

For *how to model* a scenario space, read [recipes.md](recipes.md) first. This file is
the exhaustive surface.

## Contents

- [defineMachine](#definemachine)
- [MachineDef](#machinedef)
- [Fields](#fields)
- [Actions](#actions)
- [ScenarioProvider](#scenarioprovider)
- [ScenarioPanel](#scenariopanel)
- [ScenarioPalette](#scenariopalette)
- [useScenario](#usescenario)
- [The core entry](#the-core-entry)
- [Errors and warnings](#errors-and-warnings)
- [Keyboard](#keyboard)

---

## defineMachine

```ts
const scenario = defineMachine({ machines, fields, derive, actions })
```

| Key | Type | Description |
| --- | --- | --- |
| `machines` | `Record<string, MachineDef>` | Journeys. Each puts its current state id into context under its own name. |
| `fields` | `Record<string, AnyField>` | Independent axes. |
| `derive` | `Record<string, (ctx) => value>` | Computed values. Never stored, never in a URL. `ctx` is fully typed and contains machines, tuples and fields — but not other derived values. |
| `actions` | `ActionDef[]` | Buttons at the foot of the panel, and entries in the palette. |

Everything is validated at module load. Types are inferred, so `useScenario(scenario)`
knows the shape of context with no annotation anywhere.

Context is the union of four things, and no two of them may share a name:

1. each machine's id → its current state id
2. every key any state `assign`s
3. every field id
4. every derived name

## MachineDef

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `initial` | `string` | yes | Where a fresh visitor starts. Must be one of `states`. |
| `states` | `Record<string, MachineStateDef>` | yes | See below. |
| `transitions` | `Record<string, string[]>` | no | Legal moves, `from -> to[]`. |
| `label` | `string` | no | Row heading. Defaults to the id. |
| `param` | `string` | no | Query-string key. Defaults to the id. |
| `when` | `(env: Env) => boolean` | no | Render the row only when this passes. |
| `hidden` | `boolean` | no | In context, URL and storage; out of the panel. |

`MachineStateDef` is `{ label?, note?, assign? }`. `assign` is the tuple this state
writes into context; `note` is the tooltip and is quoted in the agent report.

### transitions

Three distinct meanings, and the difference matters:

| Written | Means |
| --- | --- |
| key omitted entirely | Not a journey. Every state reachable from every state. |
| `{ a: ["b"] }` | From `a` you may go to `b`. From anything else, nowhere. |
| `{ a: [] }` | `a` is a dead end. Deliberate, not "unspecified". |

Staying put is always legal. An illegal move is refused by `go()` with a console
warning naming the legal moves, and its pill renders present but disabled — the shape of
the journey stays visible.

A state that nothing can reach produces a boot-time warning rather than an error,
because the initial state of a one-way journey is legitimately unreachable.

## Fields

Every field takes `label`, `note`, `hidden`, `param`, `when`, and a **required**
`default`.

| `type` | Value | Control | Extra keys |
| --- | --- | --- | --- |
| `boolean` | `boolean` | Two pills | `trueLabel`, `falseLabel`, `dom` |
| `enum` | literal union of the options | Pills; a `<select>` above 6 options | `options`, `control`, `dom` |
| `number` | `number` | Number input, or a slider | `min`, `max`, `step`, `control` |
| `string` | `string` | Text input | `placeholder` |
| `date` | `string \| null` | Datetime input, stored as ISO/UTC | — |

`options` accepts `["a", "b"]` or `[{ value, label, note }]`. `control` is
`"pills" | "select"` for enums and `"stepper" | "range"` for numbers.

`dom: { attribute, target? }` mirrors the value onto `<html>` (or `"body"`) as an
attribute, so plain CSS can read it. Removed on unmount.

A field value that fails validation — wrong type, an enum option that no longer exists,
a number outside `min`/`max` — is dropped from storage and URLs rather than reaching
context. Storage outlives configs.

## Actions

```ts
actions: [{ id, label, title?, when?, run: (api) => void }]
```

`api` is `{ set, go, reset, navigate, get }`. `navigate` is a no-op (with a dev warning)
unless the provider was given a `navigate` prop.

## ScenarioProvider

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `machine` | `Machine` | — | **Required.** |
| `storageKey` | `string` | — | **Required.** Version it when a field changes meaning. |
| `path` | `string \| null` | `null` | Current route. Feeds `env.path` and the report. |
| `navigate` | `(to: string) => void` | — | Router push, for actions. |
| `env` | `Record<string, unknown>` | — | Merged into what `when` sees. |
| `enabled` | `boolean` | `NODE_ENV !== "production"` | Whether the controls mount. Context is provided either way. |
| `historyLimit` | `number` | `50` | Undo depth. |

Mount it once, above everything that reads a scenario.

### Precedence

```
defaults  <  localStorage  <  URL  <  this session's clicks
```

Storage is read on the render after hydration, never in an effect: the server and the
first client render both produce the declared defaults, so markup matches and nothing
needs `suppressHydrationWarning`.

## ScenarioPanel

| Prop | Type | Default |
| --- | --- | --- |
| `position` | `"bottom-right" \| "bottom-left" \| "top-right" \| "top-left"` | `"bottom-right"` |
| `title` | `string` | `"Prototype controls"` |
| `zIndex` | `number` | `690` |
| `hotkey` | `string \| null` | `"mod+."` |
| `paletteHotkey` | `string \| null` | `"mod+shift+p"` |
| `inset` | `{ name: string; value: string }` | — |
| `showHistory` | `boolean` | `true` |
| `onCopy` | `(markdown: string) => void` | — |
| `enabled` | `boolean` | the provider's |
| `children` | `ReactNode` | — |

`children` renders at the foot of the panel, for anything the config cannot express — a
theme switch bound to the host's own provider, a link to the design file.

`inset` sets a CSS custom property on `<html>` while the controls are mounted, so the
host can push its own corner UI clear: `{ name: "--toast-inset-bottom", value: "4.5rem" }`.

`zIndex` defaults to 690 — above an app's overlays, below anything that must never be
covered, like a mandated classification banner.

## ScenarioPalette

Rendered by the panel; export exists so you can mount it alone (a panel-less build where
the palette is the only surface). Takes `zIndex`.

Every state of every visible machine, plus every action. Unreachable states are listed
and disabled with the reason, because someone typing "active" and getting nothing back
concludes the feature is broken.

## useScenario

```ts
const p = useScenario(scenario)   // typed
const p = useScenario()           // untyped, for a shared component
```

Returns context and the API on one object.

| Member | Signature | Notes |
| --- | --- | --- |
| `go` | `(machine, state) => void` | Refuses an undeclared move; warns with the legal ones. |
| `set` | `(patch) => void` | Refuses machine-owned keys and undeclared fields. |
| `can` | `(machine, state) => boolean` | From the current state. |
| `movesFrom` | `(machine) => string[]` | |
| `reset` | `() => void` | Defaults, and clears storage. |
| `undo` / `redo` | `() => void` | |
| `canUndo` / `canRedo` | `boolean` | |
| `jump` | `(index) => void` | |
| `history` | `{ entries, index }` | Entries are `{ snapshot, label, at }`. |
| `link` | `() => string` | Current URL with the scenario applied. |
| `markdown` | `() => string` | The agent report. |
| `copy` | `() => Promise<boolean>` | `markdown()` to the clipboard; falls back to `execCommand` on insecure origins, which is where prototypes live. |
| `snapshot` | `{ machines, fields }` | |
| `machine` | `CompiledMachine` | |
| `env` | `Env` | |
| `navigate` | `(to) => void` | |
| `hydrated` | `boolean` | |
| `enabled` | `boolean` | |
| `open` / `setOpen` | | For your own trigger. |
| `paletteOpen` / `setPaletteOpen` | | |

`useScenarioValue(machine, key)` reads one value.

These names are reserved and a config may not use them for context keys — `compile`
throws if it tries.

## The core entry

```ts
import { defineMachine, toMarkdown, toSearch, fromSearch, resolve } from "prototype-machine/core"
```

No React import anywhere in it. Use it in tests, scripts, or a non-React adapter:
`compile`, `defineMachine`, `isValidFieldValue`, `optionsOf`, `visible`, `toSearch`,
`fromSearch`, `toLink`, `readStorage`, `writeStorage`, `clearStorage`, `resolve`,
`initHistory`, `push`, `undo`, `redo`, `at`, `canUndo`, `canRedo`, `describe`,
`sameSnapshot`, `toMarkdown`, `copyText`.

## Errors and warnings

Thrown at module load, by `compile`:

- an `initial` that is not one of the machine's states
- a transition naming a state that does not exist
- two machines assigning the same key
- a machine and a field claiming the same key
- two controls wanting the same query parameter
- a derived name shadowing something real
- a context key that would shadow the API
- an enum default that is not one of its options
- duplicate action ids

Console warnings at runtime:

- a state nothing can reach
- `set()` on a machine-owned key, naming the owner
- `go()` to an unknown state or an illegal move, naming the legal ones
- a URL parameter that does not name a valid state or value
- `navigate` with no `navigate` prop

The errors are worded to name the fix. They are the main way the package teaches the
model, so do not swallow them.

## Keyboard

| Binding | Does |
| --- | --- |
| `mod+.` | Toggle the panel |
| `mod+shift+p` | Open the palette |
| `↑` `↓` `Enter` `Esc` | Move, apply, dismiss in the palette |
| `Esc` | Close the panel |
| `mod+z` / `mod+shift+z` | Undo / redo — **only while the panel has focus** |

`mod` is Command on Apple platforms, Control elsewhere. No binding fires while focus is
in an input, textarea, select or contenteditable. Undo is never bound globally: `mod+z`
belongs to whatever the host is doing.
