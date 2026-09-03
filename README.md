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

**Add prototype-machine to an existing prototype**

> I have a projects dashboard that fetches from a mock API. Add prototype-machine so I
> can drive it through loading, empty, error and populated without touching the fetch.
> Model the data state as one machine with no transitions, mount the provider and the
> panel at the root, and read the state at the top of the dashboard component.

**Build something new with the states declared up front**

> Create an onboarding flow with three steps: connect an account, create the first
> project, invite the team. Model it as a machine with transitions — forward one step at
> a time, back to the start from anywhere — where each state assigns `projectCount` and
> `hasTeam`. Add a "Restart" action that resets the scenario and navigates to step one.

**Switch who's looking**

> Add a role machine to this settings page with admin, member and viewer states, plus a
> boolean field for "trial expired". Hide the billing section for anyone but admin and
> show the paywall banner when the trial has expired. Mirror the role onto `<html>` as
> `data-role` so the CSS can react to it too.

**Replace a hand-rolled panel**

> The toggles in my DevControls component let me set "has billing" without "has org",
> which the product can't do. Move them into prototype-machine as a single account
> machine whose states assign both values, so that combination stops being clickable,
> then delete DevControls.

**Tune values and share the exact state**

> Add a number field for the inbox's unread count (0 to 999, as a slider) and a boolean
> for dark mode. Then add a "Copy link" action that calls `link()` and puts the URL on
> the clipboard, so I can screenshot 0, 1 and 99+ and paste the exact scenario into
> Slack.

## Documentation

| Doc | What it covers |
| --- | --- |
| [reference/api.md](reference/api.md) | Every option and type — `defineMachine`, fields, provider, panel, `useScenario`, the core entry, errors. |
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
