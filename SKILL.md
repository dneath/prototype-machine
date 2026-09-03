---
name: prototype-machine
description: >-
  Model a prototype's scenario space as state machines and wire the control panel that
  drives it, using the `prototype-machine` npm package. Load this when someone needs to
  "show the empty state," "demo the error state," "switch roles in the prototype,"
  "fake being a new user," "get to the state where the key exists but no request has
  landed," "send someone a link to this exact scenario," or when a prototype has grown a
  hand-rolled panel of toggles that can be driven into states the product cannot reach.
  Covers modelling journeys vs free axes, transitions and guards, URL and storage
  precedence. Triggers on: prototype controls, scenario switcher, state switcher, persona switcher, role switcher, dev
  panel, debug panel, empty state, loading state, error state, forced state, first-run,
  onboarding state, feature flag panel, prototype-machine, defineMachine, ScenarioPanel,
  useScenario. NOT for production feature flags or real application state — this is
  scaffolding for showing a design, and it says so out loud.
---

# prototype-machine

Every interesting thing about a product's first hour is a **state, not a screen**. The
same overview route is a wall of zeroes or a useful dashboard depending on whether
traffic exists. The same sign-in lands on a checklist or a parked notice depending on
whether an administrator has assigned anything. None of it is reachable by clicking,
because reaching it for real means waiting a week and filing a ticket.

So prototypes grow a panel of toggles. And then a reviewer sets "has API key" without
setting "first request arrived", looks at a state the product cannot produce, and draws
a conclusion from it.

This skill teaches you to model that space so the illegal states are not expressible,
and to wire the panel that drives it.

---

## Vocabulary (defined once)

- **Scenario** — the whole state the prototype is in: which journey rung, which role,
  which data state. One scenario, many screens.
- **Machine** — a journey. One state is current; each state writes a whole **tuple** of
  context at once. You cannot be halfway between two of them.
- **Field** — an independent axis that varies freely and means nothing to the others.
- **Tuple** — the group of context keys a single state writes together (`step`,
  `keyIssued`, `firstRequestAt`). Writing them together is what makes half-written
  combinations impossible.
- **Transition** — a declared legal move, `from -> to`. Undeclared moves are refused by
  the API and drawn dead in the panel.
- **Context** — the flat object screens read: machine cursors, assigned tuples, fields
  and derived values, all on one object.
- **Derived value** — computed from context, never stored and never in the URL.
- **Guard / `when`** — a predicate that keeps a control out of the panel on screens
  where it would be meaningless.

## Sub-skills

| Doc | When to read it |
| --- | --- |
| [reference/api.md](reference/api.md) | Writing a config or calling the API. Every option, every type. |
| [reference/recipes.md](reference/recipes.md) | Deciding *how to model* something. Journey ladders, forced data states, role switches, migrating a hand-rolled panel. |
| [reference/control-types.json](reference/control-types.json) | Machine-readable catalogue of field types and their options. |

## Setup check

This guidance targets **prototype-machine 0.6.0**.

1. Read the project's `package.json` and lockfile before touching anything. Check
   whether `prototype-machine` is already installed and at which version.
2. **Never add or upgrade a dependency silently.** If the user authorises it, pin the
   version:
   ```bash
   npm install --save-exact prototype-machine@0.6.0 -D
   ```
3. **Never copy the package's source into the app.** It is an npm dependency, not a
   snippet to paste. If the user wants to modify it, they change the package.
4. Requires React 18+. The `prototype-machine/core` entry needs no React and is what a
   test or a script should import.

## Quick start

```tsx
import { defineMachine, ScenarioPanel, ScenarioProvider, useScenario } from "prototype-machine"

export const scenario = defineMachine({
  machines: {
    journey: {
      label: "Get connected",
      initial: "firstRun",
      states: {
        parked:   { label: "Parked",    assign: { step: 0, keyIssued: false } },
        firstRun: { label: "First run", assign: { step: 1, keyIssued: false } },
        keyMade:  { label: "Key made",  assign: { step: 2, keyIssued: true  } },
        active:   { label: "Active",    assign: { step: 3, keyIssued: true  } },
      },
      transitions: {
        parked: ["firstRun"], firstRun: ["keyMade", "parked"],
        keyMade: ["active", "firstRun"], active: ["parked"],
      },
    },
    data: { label: "Data state", initial: "real", states: { real: {}, loading: {}, empty: {}, error: {} } },
  },
  fields: { hasEvents: { type: "boolean", label: "Events", default: true } },
  derive: { hasTraffic: (ctx) => ctx.journey === "active" },
})

// Root, once.
<ScenarioProvider machine={scenario} storageKey="my-prototype-v1" path={pathname}>
  <App />
  <ScenarioPanel />
</ScenarioProvider>

// Any screen.
const p = useScenario(scenario)
if (p.data === "loading") return <Skeleton />
if (!p.hasTraffic) return <Checklist step={p.step} />
```

No stylesheet import, no Tailwind config, no build-step change. The panel collapses
to a button in the corner and opens on a click — it binds no keyboard shortcut, so do
not tell anyone to press one.

## Routing

1. **"Add prototype controls" / "let me switch states"** → model the space with
   `reference/recipes.md`, then wire it with the Quick Start above.
2. **"Show the empty/loading/error state"** → one machine with no `transitions`, read as
   a render switch at the top of each screen. Recipe 2.
3. **"Fake a new user / role / persona"** → a machine with no `transitions` if the axes
   are independent; a ladder if they are not. Recipe 1 and 3.
4. **"This toggle lets me build a state that can't happen"** → the two switches are one
   machine. Recipe 4, the migration recipe.
5. **"Send someone this exact state"** → already works; `p.link()`.
6. **A control that only makes sense on one screen** → `when: (env) => env.path === "/signin"`.
7. **Config throws at boot** → the message names the problem and the fix. It is meant to.
8. **Anything about production flags, real auth, or persisted user settings** → wrong
   tool. Say so.

## Design principles

1. **A control panel that can express an illegal state is a bug.** If two switches must
   move together, they are one machine. This is the whole point; do not model a journey
   as booleans because it was faster to type.
2. **Omit `transitions` for view controls.** A data-state or role switch is not a
   journey and has no illegal moves. Declaring a fully-connected map by hand is noise
   that will drift.
3. **The panel must not look like the product.** It ships deliberately foreign — dark
   slab, system font, no design tokens. Do not restyle it into the design system. A
   panel drawn in the product's language becomes part of the screenshot and part of the
   critique.
4. **Derived, not stored.** If a value follows from another (`hasTraffic` from the
   journey), derive it. A fourth independent switch is a fourth way to lie.
5. **Version the `storageKey` when a field changes meaning.** Every browser that opened
   the prototype is holding the old shape, and it will render it under the new reading.
6. **Dev-only, and prove it at the bundler.** `enabled` stops it rendering; a production
   alias stops it shipping.
7. **Label every state in the reviewer's language.** `note` is what the tooltip
   shows. "2 of 3, waiting pill live" is worth more than `keyMade`.
8. **The panel has to be movable, because it covers the thing being reviewed.** It drags
   from its launcher or its header, snaps to a corner when released near one, and
   remembers where it was put. Do not reintroduce a fixed corner as the only option.
9. **If it is not a state of the component, it is a field.** A theme switch, a density
   toggle, a locale — these vary freely, write no tuple and mean nothing to the machines.
   Modelling one as a machine puts it in a row beside the real journeys, which is how a
   reviewer ends up reading "light / dark" as a step in one. Use a field.
10. **`transitions` is what gives a journey its shape.** A machine without them renders
    as a row of pills that are all enabled, which is right for a view control and wrong
    for a journey. If the thing you are modelling really is a journey, declaring the map
    is what makes the illegal moves visible as disabled pills.
