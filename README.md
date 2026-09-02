# prototype-machine

A dev-only control panel that drives a React prototype through its states, declared as
state machines so illegal combinations cannot be expressed. For designers and engineers
who need to show a state that nobody can click their way to.

Development-only. It renders nothing in production builds.

## Quick Start

```bash
npm install --save-exact prototype-machine -D
```

Describe the scenario space once:

```ts
// scenario.ts
import { defineMachine } from "prototype-machine"

export const scenario = defineMachine({
  machines: {
    journey: {
      label: "Get connected",
      initial: "firstRun",
      states: {
        firstRun: { label: "First run", assign: { step: 1, keyIssued: false } },
        keyMade: { label: "Key made", assign: { step: 2, keyIssued: true } },
        active: { label: "Active", assign: { step: 3, keyIssued: true } },
      },
      transitions: {
        firstRun: ["keyMade"],
        keyMade: ["active", "firstRun"],
        active: ["firstRun"],
      },
    },
  },
  fields: {
    hasEvents: { type: "boolean", label: "Events", default: true },
  },
})
```

Mount the provider and the panel once, at the root:

```tsx
// main.tsx
import { ScenarioPanel, ScenarioProvider } from "prototype-machine"
import { scenario } from "./scenario"

export function Root() {
  return (
    <ScenarioProvider machine={scenario} storageKey="my-prototype-v1">
      <App />
      <ScenarioPanel />
    </ScenarioProvider>
  )
}
```

Read the scenario in any screen:

```tsx
// Overview.tsx
import { useScenario } from "prototype-machine"
import { scenario } from "./scenario"

export function Overview() {
  const p = useScenario(scenario)

  if (p.step < 2) return <Checklist step={p.step} />
  return <Dashboard events={p.hasEvents} />
}
```

A button appears in the bottom-right corner. Click it to open the panel; drag it to move
it. There is no stylesheet to import and no build-step change — the panel injects its own
CSS.

---

## API reference

### `defineMachine(config)`

```ts
const scenario = defineMachine({ machines, fields, derive, actions })
```

| Parameter | Type | Description |
|---|---|---|
| `machines` | `Record<string, MachineDef>` | Journeys. Each contributes its current state id to context under its own name. |
| `fields` | `Record<string, AnyField>` | Independent axes. |
| `derive` | `Record<string, (ctx) => unknown>` | Computed values. Never stored, never in the URL. |
| `actions` | `ActionDef[]` | Buttons at the foot of the panel. |

All four are optional. The config is validated when the module loads, so a mistake throws
at boot with a message naming the problem — not silently at click time.

**Returns:** a `Machine`, which is the compiled scenario. Pass it to `<ScenarioProvider>`
and to `useScenario()`.

### `MachineDef`

| Parameter | Type | Description |
|---|---|---|
| `initial` | `string` | **Required.** The state it starts in. Must be one of `states`. |
| `states` | `Record<string, MachineStateDef>` | **Required.** The named states. |
| `transitions` | `Record<string, string[]>` | Legal moves, `from -> to[]`. Omit for a view control. |
| `label` | `string` | Row label in the panel. Defaults to the machine id. |
| `param` | `string` | Overrides the query-string key. Defaults to the id. |
| `when` | `(env: Env) => boolean` | Show this machine only when the predicate passes. |
| `hidden` | `boolean` | Keep it in context, URL and storage, but out of the panel. |

### `MachineStateDef`

| Parameter | Type | Description |
|---|---|---|
| `assign` | `Record<string, Primitive>` | The tuple of context this state writes. Written whole, or not at all. |
| `label` | `string` | Pill label. Defaults to the state id. |
| `note` | `string` | Tooltip, and the caption the diagram quotes. |

### Field options

Every field type takes these, plus a **required** `default`.

| Parameter | Type | Description |
|---|---|---|
| `default` | matches the type | **Required.** The value before anything is stored or shared. |
| `label` | `string` | Row label. Defaults to the field id. |
| `note` | `string` | Tooltip. |
| `hidden` | `boolean` | Keep it in context, URL and storage, but out of the panel. |
| `param` | `string` | Overrides the query-string key. Defaults to the id. |
| `when` | `(env: Env) => boolean` | Show this field only when the predicate passes. |

### Field types

| `type` | Value | Control | Extra options |
|---|---|---|---|
| `boolean` | `boolean` | Two pills | `trueLabel`, `falseLabel`, `dom` |
| `enum` | one of the option values | Pills; a `<select>` above 6 options | `options`, `control`, `dom` |
| `number` | `number` | Stepper, or a slider | `min`, `max`, `step`, `control` |
| `string` | `string` | Text input | `placeholder` |
| `date` | `string \| null` | Datetime input, stored as ISO/UTC | — |

| Parameter | Type | Description |
|---|---|---|
| `trueLabel` | `string` | Label for the on pill. Default `"On"`. |
| `falseLabel` | `string` | Label for the off pill. Default `"Off"`. |
| `options` | `Array<string \| { value, label?, note? }>` | Enum choices. An option `note` becomes that pill's tooltip. |
| `control` | `"pills" \| "select"` (enum), `"stepper" \| "range"` (number) | Forces the control instead of letting the option count decide. |
| `min` / `max` | `number` | Bounds. A value outside them is dropped from storage and the URL. |
| `step` | `number` | Increment. Default `1`. |
| `placeholder` | `string` | Placeholder for a string field. |
| `dom` | `{ attribute: string, target?: "html" \| "body" }` | Mirror the value onto the DOM as an attribute. **Boolean and enum only.** |

### `ActionDef`

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | **Required.** Unique among actions. |
| `label` | `string` | **Required.** Button text. |
| `run` | `(api: ActionApi) => void` | **Required.** What the button does. |
| `title` | `string` | Tooltip. |
| `when` | `(env: Env) => boolean` | Show the button only when the predicate passes. |

`ActionApi` is `{ set, go, reset, navigate, get }`. `get()` returns the current context
object; `navigate` is a no-op that warns in development unless the provider was given a
`navigate` prop.

### `<ScenarioProvider>`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `machine` | `Machine` | **Required.** | The compiled scenario. |
| `storageKey` | `string` | **Required.** | localStorage key. Also namespaces the panel's stored position and the diagram's dock. |
| `path` | `string \| null` | `null` | Current route, for `when` predicates. |
| `navigate` | `(to: string) => void` | — | Router push, for actions that change route. |
| `env` | `Record<string, unknown>` | — | Anything else `when` predicates should see. |
| `enabled` | `boolean` | `NODE_ENV !== "production"` | Whether the **controls** mount. Context is provided either way. |
| `children` | `React.ReactNode` | — | |

### `<ScenarioPanel>`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `position` | `"bottom-right" \| "bottom-left" \| "top-right" \| "top-left"` | `"bottom-right"` | The corner it starts in. |
| `title` | `string` | `"Prototype controls"` | Heading, and the dialog's accessible name. |
| `zIndex` | `number` | `690` | High enough to clear an app's overlays, low enough to sit under anything that must never be covered. |
| `draggable` | `boolean` | `true` | Drag from the launcher or the header. Double-click returns it to its corner. |
| `inset` | `{ name: string, value: string }` | — | A CSS custom property set on `<html>` while the panel is mounted, so the host can move its own corner UI clear. |
| `enabled` | `boolean` | the provider's | Overrides the dev-only default for the panel alone. |
| `children` | `React.ReactNode` | — | Rendered at the foot of the panel, after the fields and before the actions. |

### `<ScenarioDiagram>`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `zIndex` | `number` | `691` | One above the panel. |
| `defaultDock` | `"right" \| "left" \| "free"` | `"right"` | Which edge it opens against. |
| `draggable` | `boolean` | `true` | Drag it off its edge, and resize it. |

`ScenarioPanel` renders the diagram itself when it is open. Mount `<ScenarioDiagram>`
directly only if you want to change these defaults.

### `useScenario(scenario)`

| Member | Type | Description |
|---|---|---|
| `set` | `(patch: Record<string, Primitive>) => void` | Change free fields. Refuses keys a machine owns. |
| `go` | `(machine: string, state: string) => void` | Move a machine. Refuses an undeclared move. |
| `can` | `(machine: string, state: string) => boolean` | Is that move legal from where the machine is now? |
| `movesFrom` | `(machine: string) => readonly string[]` | The legal next states. |
| `reset` | `() => void` | Back to the config's defaults, and forget what was stored. |
| `link` | `() => string` | A URL that reproduces the current scenario. |
| `snapshot` | `Snapshot` | `{ machines, fields }` as stored. |
| `machine` | `CompiledMachine` | The compiled config. |
| `storageKey` | `string` | The provider's key. |
| `env` | `Env` | `{ path, ...env }`, what `when` predicates see. |
| `navigate` | `(to: string) => void` | The provider's router push. |
| `hydrated` | `boolean` | False on the server and on the first client render. |
| `enabled` | `boolean` | Whether the controls are allowed to mount. |
| `open` / `setOpen` | `boolean` / `(open: boolean) => void` | Panel open state. |
| `diagramOpen` / `setDiagramOpen` | `boolean` / `(open: boolean) => void` | Diagram open state. |

Every context key is spread flat onto the same object, so `p.step` and `p.set` read alike.
Those 17 member names are therefore reserved: a config that uses one as a machine id,
field id, `assign` key or `derive` name throws at boot.

`useScenarioValue(scenario, key)` reads a single key with the same typing. It is
narrowing sugar, not a re-render optimisation.

**Returns:** the API and the whole context on one object, fully typed from the config.

### `prototype-machine/core`

The React-free half, for tests, scripts and non-React adapters.

```ts
import { defineMachine, layout, resolve, toSearch } from "prototype-machine/core"
```

Exports `compile`, `defineMachine`, `isDev`, `isValidFieldValue`, `optionsOf`,
`ScenarioError`, `visible`, `warn`, `clearStorage`, `fromSearch`, `readStorage`,
`resolve`, `toLink`, `toSearch`, `writeStorage`, `layout`, and every type in the schema
(`Primitive`, `Env`, `AnyField`, `MachineDef`, `ActionDef`, `Context`, and the rest).

---

## Machines and fields

A **machine** is a journey. One of its states is current, and that state writes a whole
tuple of context at once. A **field** is an independent axis that varies freely and means
nothing to the others.

The distinction is the point of the package. Two independent booleans can be driven into
a combination the product cannot produce:

```ts
// A key exists but no request has landed. Real, and reachable.
const reachable = { step: 2, keyIssued: true, firstRequestAt: null }

// A request arrived on a key that was never issued. Not real, and with two
// independent toggles it is one click away.
const impossible = { step: 3, keyIssued: false, firstRequestAt: "2026-03-04T09:12:00Z" }
```

Put the keys that move together into a machine and the second combination stops being
expressible:

```ts
import { defineMachine } from "prototype-machine"

export const scenario = defineMachine({
  machines: {
    journey: {
      initial: "keyMade",
      states: {
        keyMade: { assign: { step: 2, keyIssued: true, firstRequestAt: null } },
        active: { assign: { step: 3, keyIssued: true, firstRequestAt: "2026-03-04T09:12:00Z" } },
      },
    },
  },
})
```

**Output:** `step`, `keyIssued` and `firstRequestAt` are now owned by `journey`.
`p.set({ keyIssued: false })` drops the key and warns in development, naming the machine
that owns it. `p.go("journey", "active")` writes all three together.

## Transitions

`transitions` declares the legal moves. Anything undeclared is refused by `go()` and drawn
present-but-disabled in the panel, so a reviewer can see the move exists and see that it
is not reachable from here.

```ts
transitions: {
  parked: ["firstRun"],
  firstRun: ["keyMade", "parked"],
  keyMade: ["active", "firstRun"],
  active: ["parked"],
}
```

The map has three meanings:

| Shape | Meaning |
|---|---|
| `transitions` omitted | Every state reachable from every state. This is a view control, not a journey. |
| `transitions: { a: ["b"] }` | Only the declared moves are legal. |
| a `from` key omitted from a supplied map | That state is a dead end. |

Staying put is always legal. A state that nothing can reach warns at boot rather than
throwing, because it is usually a typo but occasionally deliberate.

**Returns:** `p.can("journey", "active")` is `true` only from `keyMade`.
`p.movesFrom("journey")` returns the legal next states from wherever the machine is now.

## Derived values

A value that follows from another is computed, never stored. It never reaches localStorage
or the URL, so it cannot disagree with what produced it.

```ts
import { defineMachine } from "prototype-machine"

export const scenario = defineMachine({
  machines: {
    journey: {
      initial: "firstRun",
      states: { firstRun: { assign: { step: 1 } }, active: { assign: { step: 3 } } },
    },
  },
  derive: {
    hasTraffic: (ctx) => ctx.journey === "active",
  },
})
```

`ctx` is typed and holds machine cursors, assigned tuples and fields — but not other
derived values.

**Returns:** `p.hasTraffic` is a `boolean`, recomputed on every change, and absent from
`p.link()`.

## Field types

### Boolean

```ts
hasEvents: { type: "boolean", label: "Guardrail events", default: true,
             trueLabel: "Some", falseLabel: "None" }
```

Two pills. Without `trueLabel` / `falseLabel` they read "On" and "Off".

**Returns:** `boolean`. In a URL: `1` or `0` (reading also accepts `true` / `false`).

### Enum

```ts
density: { type: "enum", label: "Density", default: "cosy",
           options: ["cosy", "compact"] }
```

Options can be plain strings, or objects for a custom label and a per-option tooltip:

```ts
role: {
  type: "enum",
  default: "user",
  options: [
    { value: "user", label: "Standard user" },
    { value: "admin", label: "Admin", note: "Sees the billing tab" },
  ],
}
```

Pills up to six options, then a `<select>`. `control: "pills" | "select"` forces it.

**Returns:** the selected option's `value`, typed as a union of the option values. In a
URL: the value verbatim.

### Number

```ts
seats: { type: "number", label: "Seats", default: 5, min: 1, max: 50, control: "range" }
```

A stepper by default; `control: "range"` gives a slider with a numeric readout. `step`
defaults to `1`.

**Returns:** `number`. In a URL: a decimal string. A value outside `min`/`max` is dropped
rather than clamped.

### String

```ts
orgName: { type: "string", label: "Org name", default: "Acme", placeholder: "Org name" }
```

**Returns:** `string`. In a URL: verbatim.

### Date

```ts
firstRequestAt: { type: "date", label: "First request", default: null }
```

A datetime input. `null` means "has not happened yet", which is usually the state worth
showing.

**Returns:** `string | null` — an ISO 8601 UTC string. In a URL: the ISO string, or empty
for `null`.

## Actions

Buttons at the foot of the panel, for the things a control cannot express.

```ts
import { defineMachine } from "prototype-machine"

export const scenario = defineMachine({
  fields: { hasEvents: { type: "boolean", default: true } },
  actions: [
    {
      id: "restart",
      label: "Start over",
      title: "Reset everything and go to sign-in",
      run: (api) => {
        api.reset()
        api.navigate("/signin")
      },
    },
  ],
})
```

**Output:** one button per action that passes its `when`, rendered after the fields and
after any `children` you passed to the panel.

## `when` and route awareness

A control that only makes sense on one screen should not be on the panel elsewhere. Give
the provider the current route and guard the control with a predicate.

```tsx
import { ScenarioPanel, ScenarioProvider } from "prototype-machine"
import { usePathname, useRouter } from "next/navigation"
import { scenario } from "./scenario"

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
```

```ts
seats: {
  type: "number",
  label: "Seats",
  default: 5,
  when: (env) => env.path === "/billing",
}
```

`when` works on machines, fields and actions alike. `hidden: true` is the blunter version:
it keeps a control out of the panel everywhere while leaving it in context, storage and the
URL.

**Output:** the control is absent from the panel off `/billing`, and its value is still
readable from context on every route.

## DOM bindings

A boolean or enum field can mirror its value onto the document, for CSS that reads
attributes.

```ts
density: {
  type: "enum",
  label: "Density",
  default: "cosy",
  options: ["cosy", "compact"],
  dom: { attribute: "data-density" },
}
```

```css
[data-density="compact"] .row { padding: 4px 8px; }
```

`target: "body"` writes to `<body>` instead of `<html>`. The attribute is removed when the
provider unmounts. Number, string and date fields have no `dom` option.

**Output:** `<html data-density="compact">`.

## The URL and storage

A scenario is assembled from four layers, each beating the one before it:

```
config defaults  <  localStorage  <  the URL  <  this session's clicks
```

`p.link()` builds a URL that reproduces exactly what is on screen. Only values that differ
from their defaults appear in it, so the link stays short and stays readable.

```tsx
import { useScenario } from "prototype-machine"
import { scenario } from "./scenario"

export function ShareButton() {
  const p = useScenario(scenario)
  return <button onClick={() => navigator.clipboard.writeText(p.link())}>Copy link</button>
}
```

**Returns:** a string such as
`https://prototype.example.com/overview?journey=keyMade&hasEvents=0`. A value the config no
longer describes is dropped from both the URL and storage, with a warning naming it.

Server and first client render both use the config defaults; storage and the URL are
layered on after hydration, so the markup matches. Version the `storageKey` when a field
changes meaning — every browser that opened the prototype is holding the old shape.

## The state diagram

The panel's header has a button that draws the scenario space: one figure per visible
machine, as an ASCII grid, with the current state highlighted and unreachable moves drawn
dead. Clicking a node is the same as `go()`.

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
|                       ╎                    |
|          ┌ - - - - - -┘                    |
|          ▼                                 |
|   ┌            ┐                           |
|     Request in                             |
|   └            ┘                           |
|    ↩ Key made                              |
|                                            |
+ - - - - - - - - - - - - - - - - - - - - - -+

currently First run. legal from here: Key made, Parked.
```

Solid arrows are forward moves. A `↩` under a node lists the moves back.

A machine with `transitions` draws as a ranked graph with arrows. A machine without them
draws as a flat row, which is correct and also uninformative — declaring the map is what
makes a journey's shape visible.

Fields are deliberately never drawn. They are free axes, not states, and putting a theme
switch beside a journey is how a reviewer ends up reading "light / dark" as a step.

The diagram docks to an edge rather than covering the viewport, and draws no backdrop, so
the component it explains stays visible and clickable. Drag its header off the edge to
float it, or drag the separator to resize it between 320px and 92% of the viewport.

**Output:** one figure per visible machine. A config with only fields gets a short message
saying so.

`layout(machine, machineId, currentState)` from `prototype-machine/core` returns the same
figure as data — `{ machineId, title, mode, rows, caption }`, where `rows` is a grid of
`{ ch, kind, nodeId?, edgeId? }` cells.

## Dragging, snapping and the dock

The panel covers the thing being reviewed, so it moves. Drag the launcher button, or the
panel's header. Release within 140px of a corner and it snaps there; release anywhere else
and it stays. A snapped panel stays glued through a window resize.

Double-click the header to send it back to its starting corner. With the launcher or the
header focused, arrow keys nudge it 8px, or 32px with shift held.

The position is stored under `` `${storageKey}:pm-panel-position` `` and the diagram's dock
under `` `${storageKey}:pm-diagram` ``.

While the diagram is docked it sets `--pm-diagram-inset-right` (or `-left`) on `<html>`,
and the panel's corner anchors read it, so the two never overlap. Read the same property if
your app has its own corner UI to move.

**Output:** a stored placement of `{ kind: "corner", corner }` or `{ kind: "free", x, y }`.

## Colour

The panel is deliberately foreign — dark slab, system font, no design tokens — so it never
becomes part of a screenshot or part of the critique. Restyling it into the design system
defeats that. If you must, override the custom properties.

| Property | Default | Applies to |
|---|---|---|
| `--pm-bg` | `#171717` | Panel background |
| `--pm-fg` | `#ffffff` | Panel foreground |
| `--pm-line` | `rgba(255,255,255,0.2)` | Borders |
| `--pm-line-strong` | `rgba(255,255,255,0.5)` | Active borders |
| `--pm-muted` | `rgba(255,255,255,0.5)` | Labels |
| `--pm-text` | `rgba(255,255,255,0.7)` | Body text |
| `--pm-dg-bg` | `#0d0d0d` | Diagram background |
| `--pm-dg-frame` | `rgba(255,255,255,0.16)` | Box-drawing characters |
| `--pm-dg-text` | `#b4b0a8` | State labels |
| `--pm-dg-accent` | `#7410ff` | The current state's frame, focus rings, snap previews |
| `--pm-dg-accent-text` | `#a564ff` | The current state's label, which has to be read |
| `--pm-dg-dead` | `rgba(255,255,255,0.22)` | Unreachable nodes and edges |

```css
.pm-dg { --pm-dg-accent: #0f766e; --pm-dg-accent-text: #5eead4; }
```

The stylesheet is prepended to `<head>`, so a host rule wins without `!important`.

## Driving a scenario from a test

`prototype-machine/core` has no React import, so a test or a script can build a scenario
and assert on it.

```ts
import { resolve, toSearch } from "prototype-machine/core"
import { scenario } from "./scenario"

const early = resolve(scenario, [{ machines: { journey: "firstRun" } }])

scenario.contextOf(early)                      // { journey: "firstRun", step: 1, ... }
scenario.can("journey", "firstRun", "active")  // false — not a declared move
toSearch(scenario, early)                      // "journey=firstRun"
```

**Returns:** `resolve` gives a full `Snapshot` with every layer applied over the config
defaults. `contextOf` gives the flat object a screen would read. `can` takes an explicit
`from` here, unlike the hook's version, which is relative to the current state.

## Keeping it out of production

`enabled` defaults to `process.env.NODE_ENV !== "production"`, and fails safe: if
`process` is not readable at all, it assumes production and renders nothing.

That keeps the panel off the screen. To keep its bytes out of the bundle entirely, alias
the module to a stub in your production build:

```ts
// vite.config.ts
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: mode === "production" ? { "prototype-machine": "/src/scenario-stub.ts" } : {},
  },
}))
```

Context is provided in every build regardless, so a deployed review build still honours a
shared scenario link.

## If you link this package by path

A `file:` dependency resolves through a symlink, which can give you a second copy of React
and a null-dispatcher crash that only appears in a production build. Deduplicate:

```ts
// vite.config.ts
export default defineConfig({
  resolve: { dedupe: ["react", "react-dom"] },
})
```

Webpack wants `resolve.alias` pointing `react` and `react-dom` at your own
`node_modules`.

---

## Full example

```tsx
import {
  defineMachine,
  ScenarioPanel,
  ScenarioProvider,
  useScenario,
} from "prototype-machine"

export const scenario = defineMachine({
  machines: {
    // A journey: declared moves, and each state writes a whole tuple.
    journey: {
      label: "Get connected",
      initial: "firstRun",
      states: {
        parked: {
          label: "Parked",
          note: "No models assigned yet",
          assign: { step: 0, keyIssued: false, firstRequestAt: null },
        },
        firstRun: { label: "First run", assign: { step: 1, keyIssued: false, firstRequestAt: null } },
        keyMade: { label: "Key made", assign: { step: 2, keyIssued: true, firstRequestAt: null } },
        active: {
          label: "Active",
          assign: { step: 3, keyIssued: true, firstRequestAt: "2026-03-04T09:12:00.000Z" },
        },
      },
      transitions: {
        parked: ["firstRun"],
        firstRun: ["keyMade", "parked"],
        keyMade: ["active", "firstRun"],
        active: ["parked"],
      },
    },

    // A view control: no transitions, so every state is one click away.
    data: {
      label: "Data state",
      initial: "real",
      param: "state",
      states: { real: { label: "Real" }, loading: {}, empty: {}, error: {} },
    },
  },

  fields: {
    hasEvents: {
      type: "boolean",
      label: "Guardrail events",
      default: true,
      trueLabel: "Some",
      falseLabel: "None",
    },
    density: {
      type: "enum",
      label: "Density",
      default: "cosy",
      options: ["cosy", "compact"],
      dom: { attribute: "data-density" },
    },
    seats: {
      type: "number",
      label: "Seats",
      default: 5,
      min: 1,
      max: 50,
      control: "range",
      when: (env) => env.path === "/billing",
    },
  },

  derive: {
    hasTraffic: (ctx) => ctx.journey === "active",
  },

  actions: [
    {
      id: "restart",
      label: "Start over",
      run: (api) => {
        api.reset()
        api.navigate("/signin")
      },
    },
  ],
})

export function Root({ pathname, push }: { pathname: string; push: (to: string) => void }) {
  return (
    <ScenarioProvider
      machine={scenario}
      storageKey="my-prototype-v1"
      path={pathname}
      navigate={push}
    >
      <Overview />
      <ScenarioPanel />
    </ScenarioProvider>
  )
}

function Overview() {
  const p = useScenario(scenario)

  if (p.data === "loading") return <Skeleton />
  if (p.data === "error") return <ErrorState />
  if (!p.hasTraffic) return <Checklist step={p.step} seats={p.seats} />

  return <Dashboard events={p.hasEvents} since={p.firstRequestAt} />
}
```

---

## Contributing

1. Open an issue before a pull request.
2. Keep pull requests atomic — one bug fix, one feature, or one refactor.
3. No new runtime dependencies. The package has zero, and that is a feature.
4. Edit the README at the repository root. `package/README.md` is generated from it on
   publish and is not tracked.
5. `npm test`, `npm run typecheck` and `npm run build` all pass before a PR.

Repository layout, and how to run it:

```bash
cd package
npm install
npm test          # vitest, jsdom
npm run typecheck
npm run build     # tsup -> dist (esm + cjs + types)

cd demo
npm install
npm run dev       # a playground on :5199
```

The repository also holds an agent skill —
[`SKILL.md`](https://github.com/dneath/prototype-machine/blob/main/SKILL.md) and
[`reference/`](https://github.com/dneath/prototype-machine/tree/main/reference) — that
teaches a coding agent to model a scenario space and wire the panel.

## License

[MIT](https://github.com/dneath/prototype-machine/blob/main/LICENSE)
