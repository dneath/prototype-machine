# prototype-machine

A dev-only control panel that drives a prototype through its states — declared as
state machines, so illegal combinations cannot be expressed.

**Development-only.** It renders nothing in production builds.

The interesting states of a product are states, not screens. The same overview
route is a wall of zeroes or a useful dashboard depending on whether traffic
exists. The same sign-in lands on a checklist or a parked notice depending on
whether an administrator has assigned anything. None of that is reachable by
clicking, because reaching it for real means waiting a week and filing a ticket.

So you build a little panel of toggles. And then a reviewer sets "has API key"
without setting "first request arrived", and now they are looking at a state the
product cannot produce, drawing conclusions from it.

This package is that panel, with the states declared properly.

## Install

```bash
npm install --save-exact prototype-machine -D
```

## Quick start

```tsx
// scenario.ts
import { defineMachine } from "prototype-machine"

export const scenario = defineMachine({
  machines: {
    journey: {
      label: "Get connected",
      initial: "firstRun",
      states: {
        parked:    { label: "Parked",     assign: { step: 0, keyIssued: false } },
        firstRun:  { label: "First run",  assign: { step: 1, keyIssued: false } },
        keyMade:   { label: "Key made",   assign: { step: 2, keyIssued: true  } },
        active:    { label: "Active",     assign: { step: 3, keyIssued: true  } },
      },
      transitions: {
        parked:   ["firstRun"],
        firstRun: ["keyMade", "parked"],
        keyMade:  ["active", "firstRun"],
        active:   ["parked"],
      },
    },
    data: {
      label: "Data state",
      initial: "real",
      states: { real: {}, loading: {}, empty: {}, error: {} },
    },
  },
  fields: {
    hasEvents: { type: "boolean", label: "Events", default: true },
  },
  derive: {
    hasTraffic: (ctx) => ctx.journey === "active",
  },
})
```

```tsx
// app root
import { ScenarioPanel, ScenarioProvider } from "prototype-machine"
import { scenario } from "./scenario"

<ScenarioProvider machine={scenario} storageKey="my-prototype-v1">
  <App />
  <ScenarioPanel />
</ScenarioProvider>
```

```tsx
// any screen
import { useScenario } from "prototype-machine"
import { scenario } from "./scenario"

function Overview() {
  const p = useScenario(scenario)

  if (p.data === "loading") return <Skeleton />
  if (p.data === "error") return <ErrorState />
  if (!p.hasTraffic) return <Checklist step={p.step} />
  return <Dashboard />
}
```

No stylesheet import, no Tailwind config, no build-step change. The panel
collapses to a single button in the corner, and `⌘.` toggles it.

## Machines and fields

The distinction is the whole idea.

A **machine** is a journey. One of its states is current, and each state writes a
whole tuple of context at once. You cannot be halfway between two of them.

A **field** is an independent axis. It varies freely and means nothing to the
others.

Most hand-built prototype panels are all fields, which is why most hand-built
prototype panels can be driven into states the product cannot reach. Put the
things that move together into a machine and that stops being possible:

```ts
// A key exists but no request has landed. Real, and reachable.
{ step: 2, keyIssued: true, firstRequestAt: null }

// A request arrived on a key that was never issued. Not real, and with two
// independent toggles it is one click away.
{ step: 3, keyIssued: false, firstRequestAt: "2026-03-04T09:12:00Z" }
```

A key written by a machine's `assign` is refused by `set()` — the panel and your
own code both have to go through `go()`, which only accepts a declared move.

`transitions` is optional. **Omit it and every state is reachable from every
state**, which is the right answer for a view control: a data-state switch is not
a journey and has no illegal moves. Supply it and the panel disables the pills
for moves you did not declare, drawn but dead, so the shape of the journey stays
visible.

## Features

- **Declared transitions** — an illegal move is refused by the API and disabled
  in the UI, not merely discouraged by a comment.
- **Whole-tuple states** — `assign` writes several context keys together, and
  nothing else may write them.
- **Parallel machines** — orthogonal axes (role, data state, journey) advance
  independently instead of exploding into a cross product.
- **Scenario palette** — `⌘⇧P` for a filterable list of every state and action.
  Unreachable ones are listed and disabled, with the reason.
- **Undo / redo** — a capped history of the session, with readable labels and a
  jump-to-any-point list. `⌘Z` inside the panel only; it never hijacks undo
  globally.
- **Copy for agents** — one button puts the whole scenario on the clipboard as
  markdown, including the assigned tuple and a link that reproduces it.
- **Shareable by URL** — a scenario link beats whatever the recipient's browser
  had stored, so it lands the same way for everyone.
- **SSR-safe** — server and first client render both produce the declared
  defaults, so there is no hydration warning and nothing to suppress.
- **Zero dependencies** — no icon package, no class utilities, no CSS import.
  React is an optional peer; the `/core` entry has no React at all.
- **Route-aware** — `when` predicates keep a control out of the panel on screens
  where it would be meaningless.

## Why it looks like that

The panel is deliberately not styled like your product: a dark slab, a system
font stack, its own spacing, no design tokens. A control panel drawn in the
product's own language becomes part of the screenshot and part of the critique,
and someone eventually asks why the settings tray has a role switcher in it.
Looking foreign is how it stays legible as scaffolding.

## API

### `defineMachine(config)`

| Key | Type | Description |
| --- | --- | --- |
| `machines` | `Record<string, MachineDef>` | Journeys. Each contributes its current state id to context under its own name. |
| `fields` | `Record<string, AnyField>` | Independent axes. |
| `derive` | `Record<string, (ctx) => value>` | Computed values. Never stored, never in the URL. |
| `actions` | `ActionDef[]` | Buttons at the foot of the panel. |

Validation runs at module load. A transition to a state that does not exist, two
machines writing one key, an enum default that is not one of its options, or a
context key that would shadow the API all throw where you wrote them rather than
misbehaving where you clicked.

#### `MachineDef`

| Key | Type | Description |
| --- | --- | --- |
| `initial` | `string` | **Required.** Where a fresh visitor starts. |
| `states` | `Record<string, { label?, note?, assign? }>` | **Required.** `assign` is the tuple this state writes. |
| `transitions` | `Record<string, string[]>` | Legal moves as `from -> to[]`. Omit entirely for "fully connected". Omit one `from` key inside a supplied map for a dead end. |
| `label` | `string` | Row heading. Defaults to the id. |
| `param` | `string` | Query-string key. Defaults to the id. |
| `when` | `(env) => boolean` | Show only when this passes. |
| `hidden` | `boolean` | Keep in context, URL and storage, out of the panel. |

#### Field types

| `type` | Control | Extra keys |
| --- | --- | --- |
| `boolean` | Two pills | `trueLabel`, `falseLabel`, `dom` |
| `enum` | Pills, or a select above 6 options | `options`, `control: "pills" \| "select"`, `dom` |
| `number` | Stepper, or a slider | `min`, `max`, `step`, `control: "stepper" \| "range"` |
| `string` | Text input | `placeholder` |
| `date` | Datetime input | — |

All of them take `label`, `note`, `default` (required), `hidden`, `param` and
`when`. `dom: { attribute, target }` mirrors the value onto `<html>` or `<body>`
so plain CSS can read it — how a density or theme switch reaches a stylesheet.

### `<ScenarioProvider>`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `machine` | `Machine` | — | **Required.** From `defineMachine`. |
| `storageKey` | `string` | — | **Required.** localStorage key. Version it — see below. |
| `path` | `string \| null` | `null` | Current route, for `when` predicates and the report. |
| `navigate` | `(to: string) => void` | — | Router push, for actions. |
| `env` | `Record<string, unknown>` | — | Anything else `when` should see. |
| `enabled` | `boolean` | `NODE_ENV !== "production"` | Whether the controls mount. |
| `historyLimit` | `number` | `50` | How many moves undo remembers. |

Framework-agnostic on purpose: `path` and `navigate` are props, so it works the
same in Next, Vite, React Router or Remix.

```tsx
// Next.js app router
const pathname = usePathname()
const router = useRouter()

<ScenarioProvider
  machine={scenario}
  storageKey="my-prototype-v1"
  path={pathname}
  navigate={(to) => router.push(to)}
>
```

### `<ScenarioPanel>`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `position` | `"bottom-right" \| "bottom-left" \| "top-right" \| "top-left"` | `"bottom-right"` | Which corner. |
| `title` | `string` | `"Prototype controls"` | Heading. |
| `zIndex` | `number` | `690` | High enough to clear your overlays, low enough to sit under anything that must never be covered. |
| `hotkey` | `string \| null` | `"mod+."` | Toggle. `null` to unbind. |
| `paletteHotkey` | `string \| null` | `"mod+shift+p"` | Open the palette. |
| `inset` | `{ name, value }` | — | A CSS custom property set on `<html>` while mounted, so your own corner UI can move clear. |
| `showHistory` | `boolean` | `true` | Show the session's moves. |
| `onCopy` | `(markdown: string) => void` | — | Called with the report when the copy button is used. |
| `enabled` | `boolean` | provider's | Override. |
| `children` | `ReactNode` | — | Rendered at the foot — a theme switch, a link, whatever the config cannot express. |

If your toasts live in the same corner:

```tsx
<ScenarioPanel inset={{ name: "--toast-inset-bottom", value: "4.5rem" }} />
```

### `useScenario(machine)`

Returns every context value flat on the object, plus the API. Pass the machine
for full type inference; call it with no argument for the untyped version, which
is what a shared component deep in a component library wants.

| Member | Type | Description |
| --- | --- | --- |
| *(context)* | inferred | Machine cursors, assigned tuples, fields, derived values. |
| `go` | `(machine, state) => void` | Move. Refuses an undeclared transition. |
| `set` | `(patch) => void` | Change fields. Refuses machine-owned keys. |
| `can` | `(machine, state) => boolean` | Is that move legal from here? |
| `movesFrom` | `(machine) => string[]` | Legal moves from here. |
| `reset` | `() => void` | Back to defaults, and forget what was stored. |
| `undo` / `redo` | `() => void` | Step through the session. |
| `canUndo` / `canRedo` | `boolean` | |
| `jump` | `(index) => void` | Go to any point in `history`. |
| `history` | `History` | `{ entries, index }`. |
| `link` | `() => string` | A URL reproducing this scenario. |
| `markdown` | `() => string` | The scenario, written out for a coding agent. |
| `copy` | `() => Promise<boolean>` | `markdown()` to the clipboard. |
| `snapshot` | `Snapshot` | The raw `{ machines, fields }`. |
| `open` / `setOpen` | | Panel visibility, if you want your own trigger. |

`useScenarioValue(machine, key)` reads one value, for a component that should not
re-render when unrelated axes move.

### `prototype-machine/core`

Everything except the React bindings, with no React import: `defineMachine`,
`compile`, `toSearch`, `fromSearch`, `toLink`, `toMarkdown`, `resolve`, the
history reducers. Use it to drive a scenario from a test, a script, or a
non-React adapter.

## Where a scenario comes from

```
defaults  <  localStorage  <  URL  <  what you clicked this session
```

The URL beating storage is the load-bearing part. A link is how a scenario
travels into a review or a bug report, and a link that lost to the recipient's
storage would render something neither of you meant — reading as a broken
product rather than as a link that failed to land.

A link spells out only what differs from the defaults, so it stays readable and
you can see which axes actually matter:

```
/guardrails?journey=keyMade&state=error&hasEvents=0
```

**Version your `storageKey`.** Bump it whenever a field changes *meaning* rather
than merely changing value. Every browser that has opened the prototype is
holding the old shape and will happily render it under the new reading — a
`step: 0` that used to mean "not started" and now means "not even provisioned"
will show the wrong screen to everyone who visited last week, and the bug looks
like a product bug.

## Keeping it out of production

`enabled` defaults to `process.env.NODE_ENV !== "production"`, so the controls do
not render in a production build. Context is still provided in every build —
your screens read it everywhere, and a deployed review build should still honour
a shared scenario link.

To keep the panel's *bytes* out of the bundle as well, alias the module to a stub
in your production build. Some bundlers trace a dynamic import and ship the
toolbar anyway:

```ts
// stub.tsx
export function ScenarioPanel() { return null }

// next.config.ts
if (process.env.NODE_ENV === "production") {
  config.resolve.alias["prototype-machine"] = "./stub.tsx"
}
```

## Requirements

React 18 or newer. The `/core` entry needs no React at all.

## Contributing

1. Open an issue before a pull request.
2. Keep pull requests atomic.
3. No new runtime dependencies.

## License

[MIT](./LICENSE)
