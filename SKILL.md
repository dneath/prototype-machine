---
name: prototype-machine
description: >-
  Model a prototype's scenario space as state machines and wire the control panel that
  drives it, using the `prototype-machine` npm package. Load this when someone needs to
  "show the empty state," "demo the error state," "switch roles in the prototype,"
  "fake being a new user," "get to the state where the key exists but no request has
  landed," or when a prototype has grown a
  hand-rolled panel of toggles that can be driven into states the product cannot reach.
  Covers modelling journeys vs free axes, transitions and guards, URL and storage
  precedence, stress-testing layouts with edge-case presets, component benches that
  show one component in every state its code can reach, one URL per state, and state
  canvases that show every state at once, in every frame (320px, squeezed, RTL), on a
  pan-and-zoom surface that flags overflow. Triggers on: prototype controls, scenario switcher, state switcher, persona switcher, role switcher, dev
  panel, debug panel, empty state, loading state, error state, forced state, first-run,
  onboarding state, edge cases, stress test, long text, RTL, feature flag panel, prototype-machine, defineMachine, ScenarioPanel,
  useScenario, state bench, component states, every state of a component, StateBench,
  __state, break this component, every state at once, all states side by side, state
  canvas, infinite canvas, contact sheet, StateCanvas, PinnedScenario, statesOf. NOT for
  production feature flags or real application state.
  This is scaffolding for showing a design, and it says so out loud.
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

- **Scenario**: the whole state the prototype is in: which journey rung, which role,
  which data state. One scenario, many screens.
- **Machine**: a journey. One state is current; each state writes a whole **tuple** of
  context at once. You cannot be halfway between two of them.
- **Field**: an independent axis that varies freely and means nothing to the others.
- **Tuple**: the group of context keys a single state writes together (`step`,
  `keyIssued`, `firstRequestAt`). Writing them together is what makes half-written
  combinations impossible.
- **Transition**: a declared legal move, `from -> to`. Undeclared moves are refused by
  the API and drawn dead in the panel.
- **Context**: the flat object screens read: machine cursors, assigned tuples, fields
  and derived values, all on one object.
- **Derived value**: computed from context, never stored and never in the URL.
- **Guard / `when`**: a predicate that keeps a control out of the panel on screens
  where it would be meaningless.
- **Bench**: a scratch page that renders one real component in each of its states. The
  state is in the URL (`?__state=empty`), so every state is a link.
- **Missing state**: a state the design shows but the code cannot reach. A bench lists
  it, disabled. It never renders a fake of it.
- **Canvas**: a scratch page that renders one component in every state at once, a row
  per state and a column per frame, on a surface you pan and zoom.
- **Frame**: a canvas column. A condition the component is put in from outside: a
  width, a sibling that squeezes it, a text direction, a theme attribute. It changes the
  container, never the data.
- **Pinned scenario**: a scenario fixed to one set of values with `PinnedScenario`, so a
  screen can be shown in a state without the panel, many to a page.
- **Finding**: what a canvas measured in a frame: content wider than its container, or a
  box that cuts content off without an ellipsis or a scrollbar.

## Sub-skills

| Doc | When to read it |
| --- | --- |
| [reference/api.md](reference/api.md) | Writing a config or calling the API. Every option, every type. |
| [reference/recipes.md](reference/recipes.md) | Deciding *how to model* something. Journey ladders, forced data states, role switches, migrating a hand-rolled panel. |
| [reference/bench.md](reference/bench.md) | Showing one component in every state. Finding states in the code, fixtures at the data boundary, verifying each state in a browser, removal. |
| [reference/canvas.md](reference/canvas.md) | Showing every state at once, or breaking a component. Which axes apply, frames, a screen in every state of a machine, looking, reporting what broke. |
| [reference/control-types.json](reference/control-types.json) | Machine-readable catalogue of field types and their options. |

## Setup check

This guidance targets **prototype-machine 0.13.0**.

1. Read the project's `package.json` and lockfile before touching anything. Check
   whether `prototype-machine` is already installed and at which version.
2. **Never add or upgrade a dependency silently.** Once the user agrees, install it as
   a dev dependency at an exact version:
   ```bash
   npm install --save-dev --save-exact prototype-machine
   ```
   If the registry has no such package, build a tarball from the repo instead
   (`npm ci && npm pack` in `prototype-machine/package`) and install that file.
3. **Read the docs that match the installed version.** The package ships this skill:
   `node_modules/prototype-machine/SKILL.md` and its `reference/` describe exactly the
   version installed. If they disagree with a copy from somewhere else, they win.
4. **Never copy the package's source into the app.** It is an npm dependency, not a
   snippet to paste. If the user wants to modify it, they change the package.
5. Requires React 18+. The `prototype-machine/core` entry needs no React and is what a
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
to a button in the corner and opens on a click. It binds no keyboard shortcut, so do
not tell anyone to press one. The bench switcher binds none either: its arrow keys work
only while focus is in the bar.

## Routing

1. **"Add prototype controls" / "let me switch states"** → model the space with
   `reference/recipes.md`, then wire it with the Quick Start above.
2. **"Show the empty/loading/error state"** → one machine with no `transitions`, read as
   a render switch at the top of each screen. Recipe 2.
3. **"Fake a new user / role / persona"** → a machine with no `transitions` if the axes
   are independent; a ladder if they are not. Recipe 1 and 3.
4. **"This toggle lets me build a state that can't happen"** → the two switches are one
   machine. Recipe 4, the migration recipe.
5. **A control that only makes sense on one screen** → `when: (env) => env.path === "/signin"`.
6. **Config throws at boot** → the message names the problem and the fix. It is meant to.
7. **"Stress-test this layout" / "what happens with a long name, RTL, big text"** →
   fields with `presets: "stress"`, plus the panel's built-in Page tools. Recipe 8.
8. **"Show every state of this component" / "give me a link to the error state"** →
   a bench. Follow `reference/bench.md` from step 1. Do not skip finding the states in
   the code.
9. **"Step through the data states without opening the panel"** → use the panel. It is
   the one place for scenario controls. Do not add a second bar for a machine.
10. **"Show every state at once" / "break this component" / "stress-test it at every
   width"** → a canvas. Follow `reference/canvas.md` from step 1. Find the states in the
   code first, then keep only the axes whose cue matches.
11. **"Show this screen in every state of the journey"** → a canvas of the screen, rows
   and columns from `statesOf`, each frame a `PinnedScenario`. `reference/canvas.md`
   section 6.
12. **Anything about production flags, real auth, or persisted user settings** → wrong
   tool. Say so.

## Design principles

1. **A control panel that can express an illegal state is a bug.** If two switches must
   move together, they are one machine. This is the whole point; do not model a journey
   as booleans because it was faster to type.
2. **Omit `transitions` for view controls.** A data-state or role switch is not a
   journey and has no illegal moves. Declaring a fully-connected map by hand is noise
   that will drift.
3. **The panel must not look like the product.** It ships deliberately foreign (dark
   slab, system font, no design tokens), and it renders in its own shadow root on
   `<body>`, so the product's CSS cannot reach it. Do not restyle it into the design
   system, and do not pass product components as its `children` (they render unstyled
   in there); use the exported `Row`, `Pill` and `Select`. A panel drawn in the
   product's language becomes part of the screenshot and part of the critique.
4. **Derived, not stored.** If a value follows from another (`hasTraffic` from the
   journey), derive it. A fourth independent switch is a fourth way to lie.
5. **Version the `storageKey` when a field changes meaning.** Every browser that opened
   the prototype is holding the old shape, and it will render it under the new reading.
6. **Dev-only, and prove it at the bundler.** `enabled` stops it rendering; the package's
   `production` export condition swaps in a stub panel so it never ships. Review builds
   that need the panel import it from `prototype-machine/panel`.
7. **A section is a title plus its controls. Never subtext.** No explanatory line under a
   section or row heading; if a control needs explaining, put it in `note` (the tooltip).
8. **Label every state in the reviewer's language.** `note` is what the tooltip
   shows. "2 of 3, waiting pill live" is worth more than `keyMade`.
9. **The panel has to be movable, because it covers the thing being reviewed.** It drags
   from its launcher or its header, snaps to a corner when released near one, and
   remembers where it was put. Its corners keep clear of bars fixed to the page's top or
   bottom edge by default (`avoidBars`); do not turn that off to make room. Do not
   reintroduce a fixed corner as the only option.
10. **If it is not a state of the component, it is a field.** A theme switch, a density
   toggle, a locale: these vary freely, write no tuple and mean nothing to the machines.
   Modelling one as a machine puts it in a row beside the real journeys, which is how a
   reviewer ends up reading "light / dark" as a step in one. Use a field.
11. **`transitions` is what gives a journey its shape.** A machine without them renders
    as a row of pills that are all enabled, which is right for a view control and wrong
    for a journey. If the thing you are modelling really is a journey, declaring the map
    is what makes the illegal moves visible as disabled pills.
12. **A state the code cannot reach is not a state.** On a bench, list it in `missing`.
    Do not fake it with a fixture the component could never receive. The disabled entry
    is the finding: it tells the team what to build.
13. **Feed data at the boundary, never into the component.** Fixtures go in through
    props or the app's data seam. Loading is held still with a pending status, never on
    a timer. Fixtures look like the product's data, in real quantities.
14. **Check every state in a browser before you say it works.** Open each state's URL,
    make sure the component shows it, and run axe. Do it again after each change.
15. **One place for scenario controls: the panel.** Do not add a bar, a toolbar or a
    second switcher for a machine the panel already shows. Two places for one control
    are two things to keep in step. A bench page has no panel, so its bar is the only
    control on that page.
16. **A frame changes the container, never the data.** Long text, RTL content and a
    thousand rows are states, fed through fixtures. A 320px width, a squeezing sidebar,
    a direction and a theme attribute are frames. Mixing them up is how a canvas starts
    faking states.
17. **A finding is observed, never predicted.** Report what the page shows. The canvas
    measures overflow and clipping; everything else needs someone to look at every
    frame. "No overflow" is not "nothing broke".

## Before you finish

| Mistake | Fix |
| --- | --- |
| Two switches that must move together | One machine whose states assign both. |
| A fully connected `transitions` map typed by hand | Omit `transitions`. |
| A stored value that follows from another | `derive` it. |
| A field that changed meaning, same `storageKey` | Version the key. |
| Explanatory text under a section or row | Move it to `note`. |
| A keyboard shortcut to open the panel or switch states | Remove it. The package binds none. |
| A bench state the code cannot reach, shown with a fake | Move it to `missing`. |
| A bench that adds props or flags to the component | Feed data at the boundary. |
| Loading on a timer | Hold it still. |
| "Done" without opening each state | Open each state's URL and run axe. |
| Long text or RTL content added as a canvas frame | Make it a state, with `STRESS_TEXT` in the fixture. |
| Every axis run on every component | Keep an axis only when its cue matches. Note the dropped ones. |
| Every machine crossed with every other on a canvas | Cross only what the screen branches on. |
| A shared cache seeded by every canvas frame | One provider with a fresh client per frame. |
| A canvas report of predicted failures | Report what the page shows, broken frames first, each a link. |
| The package source copied into the app | Install it as a dependency. Change it in the package. |
