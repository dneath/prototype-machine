# prototype-machine

A dev-only control panel for React prototypes. Declare the states your prototype can be
in — empty, loading, first run, admin, trial expired — and get a panel that drives it.
Combinations you never declared can't be set.

Renders nothing in production.

## Quick start

```bash
npm install --save-exact prototype-machine -D
```

**1. Describe the states.**

```ts
// scenario.ts
import { defineMachine } from "prototype-machine"

export const scenario = defineMachine({
  machines: {
    account: {
      label: "Account",
      initial: "newUser",
      states: {
        newUser: { label: "New user", assign: { projects: 0, hasTeam: false } },
        firstProject: { label: "First project", assign: { projects: 1, hasTeam: false } },
        team: { label: "Team", assign: { projects: 8, hasTeam: true } },
      },
      transitions: {
        newUser: ["firstProject"],
        firstProject: ["team", "newUser"],
        team: ["newUser"],
      },
    },
  },
  fields: {
    loading: { type: "boolean", label: "Loading", default: false },
  },
})
```

**2. Mount the provider and the panel once, at the root.**

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

**3. Read it in any screen.**

```tsx
import { useScenario } from "prototype-machine"
import { scenario } from "./scenario"

export function Projects() {
  const p = useScenario(scenario)

  if (p.loading) return <Skeleton />
  if (p.projects === 0) return <EmptyState />
  return <ProjectList count={p.projects} team={p.hasTeam} />
}
```

A button appears in the bottom-right corner. Click it to open the panel, drag it to move
it. No stylesheet to import, no build config to change.

## Machines and fields

Two kinds of control, and choosing between them is most of the work.

| | What it is | Example |
| --- | --- | --- |
| **Machine** | A journey. One state is current, and it writes several context values at once. | new user → first project → team |
| **Field** | A free axis that varies on its own and means nothing to the others. | dark mode, role, unread count |

Values that move together belong in one machine. Then "8 projects but no team" stops
being something a reviewer can click into: `go()` refuses a move you never declared, and
the panel draws it disabled — visible, but not reachable.

- **Transitions** declare the legal moves. Omit them and every state is one click from
  every other: a switch, not a journey.
- **Fields** are `boolean`, `enum`, `number`, `string` or `date`. A boolean or enum can
  mirror itself onto `<html>` as an attribute, so plain CSS can read it.
- **Derived values** are computed from context, never stored, so they can't disagree
  with it.
- **Actions** are buttons at the foot of the panel, for what a control can't say.
- **`when`** hides a control on screens where it would be meaningless.

## What you get

**A panel.** Dark, plain and deliberately unlike your app, so it never becomes part of a
screenshot or part of the critique. Drag it by the launcher or the header; drop it near
a corner and it snaps.

**A state diagram.** One figure per machine, drawn from the config, current state
highlighted and illegal moves dead. Clicking a node is the same as `go()`. It docks to an
edge instead of covering the app.

```
+ - - - - - - -  [ ACCOUNT ]  - - - - - - - -+
|                                            |
|   ┌          ┐                             |
|     New user                               |
|   └          ┘                             |
|                                            |
|         ╎                                  |
|         └ ┐                                |
|           ▼                                |
|   ┌               ┐                        |
|     First project                          |
|   └               ┘                        |
|    ↩ New user                              |
|           ╎                                |
|       ┌ - ┘                                |
|       ▼                                    |
|   ┌      ┐                                 |
|     Team                                   |
|   └      ┘                                 |
|    ↩ New user                              |
|                                            |
+ - - - - - - - - - - - - - - - - - - - - - -+

currently New user. legal from here: First project.
```

**Shareable links.** `p.link()` returns a URL that reproduces what's on screen. A
scenario resolves in four layers, each beating the one before:

```
config defaults  <  localStorage  <  the URL  <  this session's clicks
```

**A React-free core.** `prototype-machine/core` imports no React, so a test or a script
can build a scenario and assert on it.

## Example prompts

The repo ships an agent skill — [`SKILL.md`](SKILL.md) and [`reference/`](reference) —
that teaches a coding agent to model a scenario space and wire the panel. With it
installed, these are the kinds of things to ask for.

**Setting up**

> Add prototype-machine to this prototype and mount the panel at the root.

> Model the screens in `src/routes/onboarding/` as a machine so I can step through them
> from the panel.

**Showing a state you can't click to**

> Add a control that flips the dashboard between loading, empty, error and populated,
> without touching the fetch.

> I need to demo the trial-expired screen. Make it a state I can jump to.

**Switching who's looking**

> Add a role switcher — admin, member, viewer — and hide the billing section for anyone
> but admin.

> Add a first-run vs returning-user switch for the home screen.

**Ruling out impossible states**

> The toggles in `DevControls.tsx` let me set "has billing" without "has org". Move them
> to prototype-machine so that can't happen.

> Trial expired should only be reachable from active, never from new user. Fix the
> transitions.

**Sharing and screenshots**

> Give me a link to the exact state on screen so I can paste it into Slack.

> Add a control for the unread count so I can screenshot it at 0, 1 and 99+.

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

- **Open an issue first.** Pull requests should reference one.
- **Keep pull requests small.** One bug fix, one feature, or one refactor.
- **No new runtime dependencies.** The package has zero, and that's a feature.
- **Edit the README at the repo root.** `package/README.md` is generated from it on
  publish and isn't tracked.
- **`npm test`, `npm run typecheck` and `npm run build` all pass** before a PR.

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
