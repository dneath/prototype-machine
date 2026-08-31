# Modelling recipes

**Part of [prototype-machine](../SKILL.md)**

How to decide what is a machine, what is a field, and what is derived. The modelling
decision is the one that matters; the wiring is mechanical.

## Contents

- [The one question](#the-one-question)
- [Recipe 1 — a journey ladder](#recipe-1--a-journey-ladder)
- [Recipe 2 — forced data states](#recipe-2--forced-data-states)
- [Recipe 3 — roles and personas](#recipe-3--roles-and-personas)
- [Recipe 4 — migrating a hand-rolled panel](#recipe-4--migrating-a-hand-rolled-panel)
- [Recipe 5 — a control for one screen only](#recipe-5--a-control-for-one-screen-only)
- [Recipe 6 — driving CSS from a scenario](#recipe-6--driving-css-from-a-scenario)
- [Recipe 7 — the app writing to the scenario](#recipe-7--the-app-writing-to-the-scenario)
- [Worked example — the whole space](#worked-example--the-whole-space)

---

## The one question

> If I move this switch and nothing else, is the result a state the product could
> actually be in?

**Yes** → a field. **No** → it belongs to a machine with whatever it moves alongside.

That is the entire modelling method. Everything below is it applied.

---

## Recipe 1 — a journey ladder

Onboarding, provisioning, approval, checkout: anything with an order to it.

**BAD.** Three independent booleans, and six of the eight combinations are impossible:

```ts
fields: {
  modelsAssigned: { type: "boolean", default: true },
  keyIssued:      { type: "boolean", default: false },
  requestArrived: { type: "boolean", default: false },
}
// One click gets you a request that arrived on a key that was never issued.
```

**GOOD.** One machine, each rung writing the whole tuple:

```ts
machines: {
  journey: {
    label: "Get connected",
    initial: "firstRun",
    states: {
      parked:    { label: "Parked",     note: "No models assigned yet",
                   assign: { step: 0, keyIssued: false, firstRequestAt: null } },
      firstRun:  { label: "First run",  note: "1 of 3, models assigned, nothing else done",
                   assign: { step: 1, keyIssued: false, firstRequestAt: null } },
      keyMade:   { label: "Key made",   note: "2 of 3, waiting pill live",
                   assign: { step: 2, keyIssued: true,  firstRequestAt: null } },
      requestIn: { label: "Request in", note: "3 of 3, receipt shown, not yet graduated",
                   assign: { step: 3, keyIssued: true,  firstRequestAt: FIRST_REQUEST_AT } },
      active:    { label: "Active",     note: "Traffic flowing",
                   assign: { step: 3, keyIssued: true,  firstRequestAt: FIRST_REQUEST_AT } },
    },
    transitions: {
      parked:    ["firstRun"],
      firstRun:  ["keyMade", "parked"],
      keyMade:   ["requestIn", "firstRun"],
      requestIn: ["active", "keyMade"],
      active:    ["parked"],
    },
  },
}
```

Three things to copy from this:

**A resting state is not always zero.** `firstRun` sits at `step: 1` because "your
models are assigned" is already true the moment an admin assigns them. A checklist that
opens at 0 of 3 when one item is genuinely finished is lying to make the bar look
emptier. Only `parked` sits at 0.

**A timestamp, not a boolean.** `firstRequestAt` is an ISO string because the receipt
shown on arrival quotes it, and re-deriving "now" at render would move the time on
every re-render.

**Two states can share a tuple.** `requestIn` and `active` assign the same values and
differ only in what the rest of the app derives from them. That is fine — they are
different rungs of the reviewer's journey.

### Do you need `transitions` at all?

Only if there are moves you want refused. Ask what a reviewer landing on a rung out of
order would actually see. If every jump produces a coherent screen, omit the map and
let every state be one click away — the tuples alone already prevent the illegal
*combinations*, which is most of the value.

Declare the map when the order carries meaning you want protected, or when the shape of
the journey is itself something you want the panel to teach.

---

## Recipe 2 — forced data states

Loading, empty and error are not a journey. They are a view override, and every state
is one click from every other.

```ts
machines: {
  data: {
    label: "Data state",
    initial: "real",
    param: "state",        // keeps a legacy ?state=error link working
    states: {
      real:    { label: "Real" },
      loading: { label: "Loading" },
      empty:   { label: "Empty" },
      error:   { label: "Error" },
    },
    // No `transitions`. Omitting it means fully connected, which is correct here.
  },
}
```

Read it at the top of each screen, before anything else:

```tsx
const p = useScenario(scenario)

if (p.data === "loading") return <><PageHeader /><Skeleton lines={8} /></>
if (p.data === "error")   return <><PageHeader /><ErrorState onRetry={...} /></>

const rows = p.data === "empty" ? [] : realRows
```

Note the shape: `loading` and `error` return early because they replace the page;
`empty` does not, because an empty page is still the page — same header, same filters,
different body. Getting that wrong is the most common mistake in wiring this up.

---

## Recipe 3 — roles and personas

A role is usually a free axis, so it is a machine with no `transitions` (or a field, if
nothing else keys off it):

```ts
machines: {
  role: {
    label: "Role",
    initial: "user",
    states: { user: { label: "Standard user" }, admin: { label: "Admin" } },
  },
}
```

It becomes a ladder the moment roles imply each other — a trial that becomes a
subscriber that becomes an owner, where you cannot be a subscriber without having been
a trial. Then it is Recipe 1.

If a role carries fixture data, assign it rather than looking it up in twelve places:

```ts
admin: { label: "Admin", assign: { seats: 250, canApprove: true } },
```

---

## Recipe 4 — migrating a hand-rolled panel

The usual starting point is a `Partial<State>` patch bag and a wall of pills.

1. **List every field the old state holds.** For each, ask the one question above.
2. **Group the ones that fail it.** Each group becomes a machine. The named states are
   the combinations the old panel's tooltips or comments already describe — a
   hand-rolled panel almost always has a comment naming the legal tuples, because
   somebody hit the bug once.
3. **The rest become fields**, keeping their existing `param` names so old links live.
4. **Anything computed from the others becomes `derive`.** A "has traffic" boolean
   sitting next to an "account is active" boolean is a bug waiting to happen; make it
   `(ctx) => ctx.journey === "active"`.
5. **Keep the storage key, or bump it deliberately.** Bump it if any field changed
   meaning — see the principle in [SKILL.md](../SKILL.md).
6. **Replace `p.set({ account: "active", step: 3, keyIssued: true })` with
   `p.go("journey", "active")`.** The tuple now lives in one place. `set()` will refuse
   the machine-owned keys and tell you which machine owns them, so the compiler and the
   console between them will find every call site.

Consumers reading `p.step` or `p.forced` do not change at all. The context stays flat.

---

## Recipe 5 — a control for one screen only

Some scenarios are unreachable by clicking *and* meaningless everywhere but one screen.
A sign-in failure is the classic: it used to live in a card under the sign-in form,
which is exactly the thing this panel exists to keep out of the product UI.

```ts
signInFailure: {
  label: "Sign-in failure",
  initial: "none",
  when: (env) => env.path === "/signin",
  states: {
    none:        { label: "None" },
    credentials: { label: "Wrong credentials" },
    disabled:    { label: "Disabled" },
    directory:   { label: "Directory down" },
  },
},
```

`env.path` comes from the `path` prop, so pass your router's current path to the
provider. `when` also works on fields and actions.

---

## Recipe 6 — driving CSS from a scenario

For anything a stylesheet needs to read — density, a theme, a locale — mirror the value
onto the document instead of threading a prop through everything:

```ts
fields: {
  density: {
    type: "enum",
    label: "Density",
    default: "comfortable",
    options: ["comfortable", "compact"],
    dom: { attribute: "data-density" },   // or { attribute: "...", target: "body" }
  },
}
```

```css
:root { --pad: 16px; }
[data-density="compact"] { --pad: 8px; }
```

The attribute is removed when the provider unmounts.

---

## Recipe 7 — the app writing to the scenario

The panel is not the only writer. When a prototype's own UI advances the story — the
user creates a key in the real modal, and the checklist should tick — call the API from
the product code:

```tsx
// components/create-key-modal.tsx
const p = useScenario(scenario)

function onCreated() {
  p.go("journey", "keyMade")
}
```

This is legitimate and expected. What changes versus a hand-rolled store is that the
modal cannot write half a tuple: it names the state, and the state knows what that
means. If `keyMade` is not reachable from where the user is, the move is refused and
the console says why — which is usually a real bug in the flow you just built.

---

## Worked example — the whole space

Five axes, and only one of them is a journey.

```ts
import { defineMachine } from "prototype-machine"

const FIRST_REQUEST_AT = "2026-03-04T09:12:00.000Z"

export const scenario = defineMachine({
  machines: {
    journey:       { /* Recipe 1 — the ladder, with transitions */ },
    role:          { /* Recipe 3 — no transitions */ },
    data:          { /* Recipe 2 — no transitions, param: "state" */ },
    signInFailure: { /* Recipe 5 — when: env.path === "/signin" */ },
  },

  fields: {
    hasEvents:  { type: "boolean", label: "Guardrail events", default: true,
                  trueLabel: "Some", falseLabel: "None" },
    density:    { type: "enum", label: "Density", default: "comfortable",
                  options: ["comfortable", "compact"], dom: { attribute: "data-density" } },
    // In context, in links, out of the panel: it has its own control in the product.
    chosenTool: { type: "string", default: "opencode", hidden: true },
  },

  derive: {
    // Follows from the journey rather than being a fifth switch. An active account has
    // been using the proxy; a first-run account has not, which is the entire reason its
    // overview must not lead with metrics.
    hasTraffic: (ctx) => ctx.journey === "active",
    connected:  (ctx) => `${ctx.step} of 3`,
  },

  actions: [
    {
      id: "restart",
      label: "Restart scenario",
      title: "Clears the scenario and returns to the front door",
      // Restart means restart: clearing the scenario without also going back to the
      // front door leaves you on a screen the fresh scenario would not have sent you
      // to — an overview full of traffic for an account that, as of this click, has
      // never made a request.
      run: (api) => { api.reset(); api.navigate("/signin") },
    },
  ],
})
```

A runnable version of exactly this is in the package's `demo/` directory
(`npm run dev` inside it).
