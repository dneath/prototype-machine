# prototype-machine

A dev-only control panel that drives a React prototype through its states, declared as
state machines so illegal combinations cannot be expressed. For designers and engineers
who need to show a state that nobody can click their way to.

Development-only. It renders nothing in production builds.

## Quick start

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
import { useScenario } from "prototype-machine"
import { scenario } from "./scenario"

export function Overview() {
  const p = useScenario(scenario)

  if (p.step < 2) return <Checklist step={p.step} />
  return <Dashboard events={p.hasEvents} />
}
```

A button appears in the bottom-right corner. Click it to open the panel; drag it to move
it. No stylesheet to import, no build-step change.

## The idea

A **machine** is a journey. One of its states is current, and that state writes a whole
tuple of context at once. A **field** is an independent axis that varies freely and means
nothing to the others.

That distinction is the whole point. Two independent booleans can be driven into a
combination the product cannot produce — a request arriving on a key that was never
issued. Put the keys that move together into a machine and that combination stops being
expressible: `go()` refuses an undeclared move, and the panel draws it
present-but-disabled so a reviewer can see it exists and see it is not reachable.

Everything else follows from it:

- **Transitions** declare the legal moves. Omit them and you have a view control instead
  of a journey — every state one click away.
- **Derived values** are computed from context, never stored, so they cannot disagree
  with what produced them.
- **Fields** come in five types: boolean, enum, number, string and date. A boolean or
  enum can mirror itself onto the DOM as an attribute for CSS to read.
- **Actions** are buttons at the foot of the panel for the things a control cannot say.
- **`when`** keeps a control off the panel on screens where it would be meaningless.

## What you get

**A panel.** Deliberately foreign — dark slab, system font, no design tokens — so it
never becomes part of a screenshot or part of the critique. Drag it by the launcher or
the header; release near a corner and it snaps.

**A state diagram.** The panel's header draws the scenario space as an ASCII grid, one
figure per machine, current state highlighted and unreachable moves drawn dead. Clicking
a node is the same as `go()`. It docks to an edge rather than covering the viewport.

```
+ - - - - - - [ GET CONNECTED ] - - - - - - -+
|                                            |
|   ┌           ┐                            |
|     First run                              |
|   └           ┘                            |
|         ╎                                  |
|        ┌┴- - - - - - -┐                    |
|        ▼              ▼                    |
|   ┌        ┐    ┌          ┐               |
|     Parked        Key made                 |
|   └        ┘    └          ┘               |
|    ↩ First run   ↩ First run               |
|                                            |
+ - - - - - - - - - - - - - - - - - - - - - -+

currently First run. legal from here: Key made, Parked.
```

**Shareable links.** `p.link()` builds a URL that reproduces exactly what is on screen.
A scenario resolves in four layers, each beating the one before:

```
config defaults  <  localStorage  <  the URL  <  this session's clicks
```

**A React-free core.** `prototype-machine/core` has no React import, so a test or a
script can build a scenario and assert on it.

## Example prompts

The repository ships an agent skill — [`SKILL.md`](SKILL.md) and
[`reference/`](reference) — that teaches a coding agent to model a scenario space and
wire the panel. With it installed, these are the kinds of things worth asking for.

**Starting out**

> Set up prototype-machine in this prototype. Model the onboarding journey from the
> screens in `src/routes/` and mount the panel at the root.

> I want to demo this dashboard in three data states — loading, empty and error — without
> touching the fetch. Add a control for it.

**Modelling a hard state**

> I need to show the state where the API key exists but the first request hasn't landed
> yet. Add it to the journey and make sure you can't get there from first run.

> The trial-expired state should only be reachable from active, never from first run.
> Fix the transitions.

**Fixing a panel that lies**

> This prototype has a `useState` panel of toggles in `DevControls.tsx` and half the
> combinations are impossible. Move it to prototype-machine and group the ones that move
> together.

> Someone set "has billing" without "has org" and got a screen we can't ship. Make that
> unexpressible.

**Personas and axes**

> Add a role switcher — standard user, admin, support — and hide the billing controls
> for anyone but admin.

> Add a density toggle that drives CSS from an attribute on `<html>`, not React props.

**Sharing and review**

> Give me a link to the exact scenario I'm looking at, and add a copy-link button to the
> panel.

> Write a test that resolves the scenario at "key made" and asserts the checklist renders
> at step 2.

## Documentation

| Doc | What it covers |
| --- | --- |
| [reference/api.md](reference/api.md) | Every option and type — `defineMachine`, fields, provider, panel, diagram, `useScenario`, the core entry, errors. |
| [reference/recipes.md](reference/recipes.md) | How to model something — journey ladders, forced data states, roles, migrating a hand-rolled panel, driving CSS. |
| [SKILL.md](SKILL.md) | The agent skill itself. |

Two things worth knowing before you ship a review build:

- `enabled` defaults to `process.env.NODE_ENV !== "production"` and fails safe. To keep
  the bytes out of the bundle too, alias the module to a stub in your production build.
- If you link the package by path, deduplicate `react` and `react-dom` — a `file:`
  dependency resolves through a symlink and can give you two copies of React.

## Contributing

1. Open an issue before a pull request.
2. Keep pull requests atomic — one bug fix, one feature, or one refactor.
3. No new runtime dependencies. The package has zero, and that is a feature.
4. Edit the README at the repository root. `package/README.md` is generated from it on
   publish and is not tracked.
5. `npm test`, `npm run typecheck` and `npm run build` all pass before a PR.

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

## License

[MIT](LICENSE)
