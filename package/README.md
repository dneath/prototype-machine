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

## Examples

### Ask for it

The states worth showing are the ones nobody can click to, so a request for this
usually arrives as a complaint about the prototype rather than as a feature
request. Any of these is enough to start from:

- "add prototype controls so I can switch between the empty, loading and error states"
- "let me demo the state where the key exists but no request has landed"
- "these two toggles let me build a state that can't actually happen"
- "add a role switcher for admin, member and viewer"
- "only show the seat control on the billing screen"
- "send someone a link to this exact scenario"
- "show me the shape of this journey — what leads where?"
- "the panel is covering the thing I'm trying to look at"

### Request: "let me force the empty, loading and error states"

```tsx
export const scenario = defineMachine({
  machines: {
    data: {
      label: "Data state",
      initial: "real",
      param: "state",
      // No `transitions`: a view switch is not a journey and has no illegal
      // moves, so every state stays one click from every other.
      states: {
        real: { label: "Real" },
        loading: { label: "Loading" },
        empty: { label: "Empty" },
        error: { label: "Error" },
      },
    },
  },
})

// Usage:
const p = useScenario(scenario)

if (p.data === "loading") return <Skeleton />
if (p.data === "error") return <ErrorState onRetry={retry} />
if (p.data === "empty") return <EmptyState />
return <Dashboard rows={rows} />
```

### Request: "let me step through first run — I keep resetting the database to see it"

```tsx
machines: {
  journey: {
    label: "Get connected",
    initial: "firstRun",
    // Each rung writes the WHOLE tuple, so no click can produce a request that
    // arrived on a key which was never issued.
    states: {
      parked:    { label: "Parked",     note: "No models assigned yet",       assign: { step: 0, keyIssued: false, firstRequestAt: null } },
      firstRun:  { label: "First run",  note: "1 of 3, nothing else done",    assign: { step: 1, keyIssued: false, firstRequestAt: null } },
      keyMade:   { label: "Key made",   note: "2 of 3, waiting pill live",    assign: { step: 2, keyIssued: true,  firstRequestAt: null } },
      requestIn: { label: "Request in", note: "3 of 3, receipt shown",        assign: { step: 3, keyIssued: true,  firstRequestAt: FIRST_REQUEST } },
    },
    transitions: {
      parked:    ["firstRun"],
      firstRun:  ["keyMade", "parked"],
      keyMade:   ["requestIn", "firstRun"],
      requestIn: ["parked"],
    },
  },
},
derive: {
  // Traffic FOLLOWS from the journey. A fourth switch would be a fourth way to lie.
  hasTraffic: (ctx) => ctx.journey === "requestIn",
}

// Usage:
const p = useScenario(scenario)

if (!p.hasTraffic) return <Checklist step={p.step} keyIssued={p.keyIssued} />
return <Dashboard since={p.firstRequestAt} />
```

From **First run** the panel offers only **Key made** and **Parked**. **Request
in** is drawn and disabled — present, so the shape of the journey stays visible;
dead, so nobody reviews a screen the product cannot produce.

### Request: "add a role switcher and a density toggle"

```tsx
machines: {
  role: {
    label: "Role",
    initial: "member",
    states: {
      admin:  { label: "Admin" },
      member: { label: "Member" },
      viewer: { label: "Viewer", note: "Read-only, no billing" },
    },
  },
},
fields: {
  density: {
    type: "enum",
    label: "Density",
    default: "comfortable",
    options: ["comfortable", "compact"],
    // Mirrored onto <html> so a stylesheet can read it, with nothing threaded
    // through props.
    dom: { attribute: "data-density" },
  },
}

// Usage:
const p = useScenario(scenario)

{p.role === "admin" ? <BillingTab /> : null}
```

```css
/* Usage, from plain CSS: */
[data-density="compact"] .row { padding-block: 4px; }
```

### Request: "only show the seat control on the billing screen"

```tsx
fields: {
  seats: {
    type: "number",
    label: "Seats",
    default: 12,
    min: 0,
    max: 500,
    control: "range",
    // Keeps the row out of the panel everywhere it would mean nothing. `when`
    // works on machines and actions too.
    when: (env) => env.path === "/settings/billing",
  },
}

// Usage: `when` sees whatever the provider was told about the route.
<ScenarioProvider machine={scenario} storageKey="my-prototype-v1" path={pathname}>
```

### Request: "show me the shape of this journey, I keep losing track of what leads where"

Nothing to configure — the diagram draws whatever the machines already declare.
The button is in the panel's header, and `transitions` is what makes it worth
opening:

```tsx
// Declared: drawn as a ranked graph, with the moves you cannot make from here
// present but dead.
journey: {
  initial: "firstRun",
  states: { parked: {}, firstRun: {}, keyMade: {}, active: {} },
  transitions: {
    parked: ["firstRun"],
    firstRun: ["keyMade", "parked"],
    keyMade: ["active", "firstRun"],
    active: ["parked"],
  },
},

// Omitted: drawn flat, no arrows, because a view control has no journey and
// n*(n-1) arrows would say otherwise.
data: {
  initial: "real",
  states: { real: {}, loading: {}, empty: {}, error: {} },
},
```

```
+ - - - - - - [ GET CONNECTED ] - - - - - - -+
|                                            |
|   ┌           ┐                            |
|     First run                              |
|   └           ┘                            |
|                                            |
|         ╎                                  |
|        ┌┴- - - - - - -┐                    |
|        ▼              ▼                    |
|   ┌        ┐    ┌          ┐               |
|     Parked        Key made                 |
|   └        ┘    └          ┘               |
|    ↩ First run   ↩ First run               |
+ - - - - - - - - - - - - - - - - - - - - - -+
  currently First run. legal from here: Key made, Parked.
```

### End to end: Next.js app router

`path` and `navigate` are props rather than a router import, which is the whole
reason this works the same in Next, Vite, React Router and Remix.

```tsx
// app/providers.tsx
"use client"

import { usePathname, useRouter } from "next/navigation"
import { ScenarioPanel, ScenarioProvider } from "prototype-machine"
import { scenario } from "@/scenario"

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <ScenarioProvider
      machine={scenario}
      storageKey="my-prototype-v1"
      path={pathname}
      navigate={(to) => router.push(to)}
    >
      {children}
      <ScenarioPanel />
    </ScenarioProvider>
  )
}

// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

### End to end: driving a scenario from a test

`prototype-machine/core` is the same resolver the panel uses, with no React in
it — so a test can assert the model rather than clicking the UI that renders it.

```ts
import { resolve, toSearch } from "prototype-machine/core"
import { scenario } from "./scenario"

const early = resolve(scenario, [{ machines: { journey: "firstRun", data: "empty" } }])
const ctx = scenario.contextOf(early)

it("cannot reach a landed request before a key exists", () => {
  expect(ctx.keyIssued).toBe(false)
  expect(scenario.can("journey", "firstRun", "requestIn")).toBe(false)
})

// The same scenario as a link, for a bug report. Only what differs from the
// defaults is spelled out, so you can see which axes actually matter:
`/overview?${toSearch(scenario, early)}` // -> /overview?state=empty
```

## Features

- **Declared transitions** — an illegal move is refused by the API and disabled
  in the UI, not merely discouraged by a comment.
- **Whole-tuple states** — `assign` writes several context keys together, and
  nothing else may write them.
- **Parallel machines** — orthogonal axes (role, data state, journey) advance
  independently instead of exploding into a cross product.
- **The space, drawn** — a monospace state diagram of every machine, with dead
  moves visible but disabled. Declared journeys draw as ranked graphs; view
  controls draw flat, because they have no shape to show. It **docks beside**
  the app rather than over it, so the component you are reviewing stays visible
  and clickable.
- **Movable** — drag it out of the way of whatever it is covering, by the
  launcher or by the panel's header. Release near a corner and it takes the
  corner; release anywhere else and it stays exactly there. It remembers where
  you put it, and it cannot be dropped off screen.
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

Framework-agnostic on purpose: `path` and `navigate` are props, so it works the
same in Next, Vite, React Router or Remix — see [Examples](#examples).

### `<ScenarioPanel>`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `position` | `"bottom-right" \| "bottom-left" \| "top-right" \| "top-left"` | `"bottom-right"` | Which corner. |
| `title` | `string` | `"Prototype controls"` | Heading. |
| `zIndex` | `number` | `690` | High enough to clear your overlays, low enough to sit under anything that must never be covered. |
| `hotkey` | `string \| null` | `"mod+."` | Toggle. `null` to unbind. |
| `diagramHotkey` | `string \| null` | `null` | Open the diagram. Unbound by default. |
| `draggable` | `boolean` | `true` | Let the panel be moved and corner-snapped. `position` becomes where it starts. |
| `inset` | `{ name, value }` | — | A CSS custom property set on `<html>` while mounted, so your own corner UI can move clear. |
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
| `link` | `() => string` | A URL reproducing this scenario. |
| `snapshot` | `Snapshot` | The raw `{ machines, fields }`. |
| `open` / `setOpen` | | Panel visibility, if you want your own trigger. |
| `diagramOpen` / `setDiagramOpen` | | The diagram's visibility. |
| `storageKey` | `string` | The provider's key, for namespacing beside it. |

`useScenarioValue(machine, key)` reads one value, for a component that should not
re-render when unrelated axes move.

### Dragging, snapping and the dock

The panel snaps to a corner when released **within 140px of one**, measured
diagonally — so a drop 100px out on both axes is 141px away and stays put. A
dashed outline previews the corner mid-drag. What is stored is the corner
itself, so a snapped panel stays anchored through a window resize; a free drop
stores pixels and is re-clamped instead.

The diagram **docks to an edge with no backdrop**, so the component underneath
stays visible and clickable — a diagram that explains a component must not be
the thing hiding it. Resize it by its inner edge (320px to 92vw); drag its
header to pull it free, and drop it near a side to re-dock. While docked it
publishes `--pm-diagram-inset-right` (or `-left`) on `<html>`; the panel reads
that and slides clear, and your own layout can too if you would rather reflow
than be overlaid.

```tsx
<ScenarioPanel draggable diagramHotkey="mod+shift+d" />
<ScenarioDiagram defaultDock="left" />
```

### Colour

The diagram carries two accent tokens, both hue 268 so they read as one colour:

| Token | Value | Used for |
| --- | --- | --- |
| `--pm-dg-accent` | `#7410ff` | Focus rings, the resize handle, snap and dock previews, borders |
| `--pm-dg-accent-text` | `#a564ff` | The current state, the bracketed title, hovered nodes |

They are split because `#7410ff` is 3:1 on the diagram's `#0d0d0d` ground —
enough for a border under WCAG, short of the 4.5:1 that 13px monospace needs to
be read comfortably. Override either on `.pm-dg` to collapse them back to one.

### `prototype-machine/core`

Everything except the React bindings, with no React import: `defineMachine`,
`compile`, `toSearch`, `fromSearch`, `toLink`, `resolve`, and
`layout` — the diagram as a character grid, if you want to draw a figure
somewhere other than the overlay. Use it to drive a scenario from a test, a
script, or a non-React adapter.

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

Every bundler worth using replaces `process.env.NODE_ENV` at build time, in both
dev and production. **Where nothing replaces it, the package assumes production
and hides the controls.** That direction is deliberate: a panel that fails open
puts a role switcher in a deployed build, which is far worse than one that fails
closed. If you are in that position and you want the controls anyway — a review
deployment, say — pass `enabled` explicitly.

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

### If you link this package by path

Consuming it as `file:../prototype-machine/package` — which is how you would work
on the panel and an app at the same time — resolves through a symlink, so your
bundler may resolve `react` from *this* package's `node_modules` (it has one, for
its own test suite) rather than from your app. You then have two copies of React,
and the library's copy is null at runtime.

Under Vite it breaks the **production build only** — dev dedupes on its own — so
it is the kind of thing that ships. One line prevents it:

```ts
// vite.config.ts
export default defineConfig({
  resolve: { dedupe: ["react", "react-dom"] },
})
```

Webpack's equivalent is `resolve.alias` pointing `react` at your app's copy.
Installing from a registry rather than a path makes the problem disappear.

## Contributing

1. Open an issue before a pull request.
2. Keep pull requests atomic.
3. No new runtime dependencies.

## License

[MIT](./LICENSE)
