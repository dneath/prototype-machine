# prototype-machine

A dev-only control panel that drives a prototype through its states — declared as
state machines, so illegal combinations cannot be expressed.

This repository holds two things:

| Path | What it is |
| --- | --- |
| [`package/`](package) | The `prototype-machine` npm package. Its [README](package/README.md) is the full documentation. |
| [`SKILL.md`](SKILL.md) + [`reference/`](reference) | A Claude Code skill that teaches an agent to model a scenario space and wire the panel. |

## The problem

The interesting states of a product are states, not screens. The same overview route
is a wall of zeroes or a useful dashboard depending on whether traffic exists. The same
sign-in lands on a checklist or a parked notice depending on whether an administrator
has assigned anything. None of it is reachable by clicking, because reaching it for
real means waiting a week and filing a ticket.

So prototypes grow a panel of toggles. And then a reviewer sets "has API key" without
setting "first request arrived", looks at a state the product cannot produce, and draws
a conclusion from it.

```ts
// A key exists but no request has landed. Real, and reachable.
{ step: 2, keyIssued: true, firstRequestAt: null }

// A request arrived on a key that was never issued. Not real, and with two
// independent toggles it is one click away.
{ step: 3, keyIssued: false, firstRequestAt: "2026-03-04T09:12:00Z" }
```

A **machine** is a journey: one state is current, and each state writes a whole tuple
of context at once. A **field** is an independent axis. Put the things that move
together into a machine and the second combination above stops being expressible — the
keys a machine owns are refused by `set()`, and undeclared moves are refused by `go()`
and drawn dead in the panel.

## Quick start

```bash
npm install --save-exact prototype-machine -D
```

```tsx
<ScenarioProvider machine={scenario} storageKey="my-prototype-v1">
  <App />
  <ScenarioPanel />
</ScenarioProvider>
```

Full documentation: [`package/README.md`](package/README.md).
Modelling guidance: [`reference/recipes.md`](reference/recipes.md).

## Development

```bash
cd package
npm install
npm test          # vitest, jsdom
npm run typecheck
npm run build     # tsup -> dist (esm + cjs + types)

cd demo
npm install
npm run dev       # a playground on :5199 exercising every feature
```

## License

[MIT](./LICENSE)
