import { defineMachine } from "prototype-machine"

/* The scenario space this demo drives.
 *
 * It is the one the package was cut from — an AI gateway's first hour, where
 * every interesting screen is a STATE rather than a route: the same overview is
 * a wall of zeroes or a useful dashboard depending on whether traffic exists,
 * and reaching that for real means waiting a week and getting an administrator
 * involved. */

const FIRST_REQUEST_AT = "2026-03-04T09:12:00.000Z"

export const scenario = defineMachine({
  machines: {
    /* A JOURNEY. Each rung writes the whole tuple, so no click can produce a
       request that arrived on a key which was never issued. */
    journey: {
      label: "Get connected",
      initial: "firstRun",
      states: {
        parked: {
          label: "Parked",
          note: "No models assigned yet",
          assign: { step: 0, keyIssued: false, firstRequestAt: null },
        },
        firstRun: {
          label: "First run",
          note: "1 of 3, models assigned, nothing else done",
          assign: { step: 1, keyIssued: false, firstRequestAt: null },
        },
        keyMade: {
          label: "Key made",
          note: "2 of 3, waiting pill live",
          assign: { step: 2, keyIssued: true, firstRequestAt: null },
        },
        requestIn: {
          label: "Request in",
          note: "3 of 3, receipt shown, not yet graduated",
          assign: { step: 3, keyIssued: true, firstRequestAt: FIRST_REQUEST_AT },
        },
        active: {
          label: "Active",
          note: "Traffic flowing",
          assign: { step: 3, keyIssued: true, firstRequestAt: FIRST_REQUEST_AT },
        },
      },
      transitions: {
        parked: ["firstRun"],
        firstRun: ["keyMade", "parked"],
        keyMade: ["requestIn", "firstRun"],
        requestIn: ["active", "keyMade"],
        active: ["parked"],
      },
    },

    /* VIEW CONTROLS. No `transitions` key, so every state is one click from
       every other — which is right, because these are not journeys. */
    role: {
      label: "Role",
      initial: "user",
      states: { user: { label: "Standard user" }, admin: { label: "Admin" } },
    },
    data: {
      label: "Data state",
      initial: "real",
      param: "state",
      states: {
        real: { label: "Real" },
        loading: { label: "Loading" },
        empty: { label: "Empty" },
        error: { label: "Error" },
      },
    },

    /* ONLY ON ONE SCREEN. You cannot reach "the directory is unreachable" by
       clicking, and a switch for it has no business sitting in the product UI
       of the first screen anyone sees. `when` keeps it out of the panel
       everywhere it would be meaningless. */
    signInFailure: {
      label: "Sign-in failure",
      initial: "none",
      when: (env) => env.path === "/signin",
      states: {
        none: { label: "None" },
        credentials: { label: "Wrong credentials" },
        disabled: { label: "Disabled" },
        directory: { label: "Directory down" },
      },
    },
    /* DELIBERATELY AWKWARD, and only on one route. Nine states, long labels
       and a dense transition map — a stress case for how the panel lays out a
       big row of pills with most of them disabled. Kept out of the way because
       it is a test fixture, not a model worth copying. */
    review: {
      label: "Review pipeline",
      initial: "drafting",
      when: (env) => env.path === "/guardrails",
      states: {
        drafting: { label: "Drafting the request" },
        submitted: { label: "Submitted for review" },
        triaged: { label: "Triaged by an admin" },
        needsInfo: { label: "Waiting on more info" },
        secondOpinion: { label: "Escalated for a second opinion" },
        approved: { label: "Approved with conditions" },
        rejected: { label: "Rejected, appealable" },
        appealed: { label: "Under appeal" },
        closed: { label: "Closed" },
      },
      transitions: {
        drafting: ["submitted"],
        submitted: ["triaged", "needsInfo", "drafting"],
        triaged: ["approved", "rejected", "secondOpinion", "needsInfo"],
        needsInfo: ["submitted", "closed"],
        secondOpinion: ["approved", "rejected"],
        approved: ["closed"],
        rejected: ["appealed", "closed"],
        appealed: ["triaged", "closed"],
        closed: [],
      },
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
      default: "comfortable",
      options: ["comfortable", "compact"],
      /* Mirrored onto <html> so plain CSS can read it. */
      dom: { attribute: "data-density" },
    },
    seats: { type: "number", label: "Seats", default: 12, min: 0, max: 500 },
  },

  derive: {
    /* Traffic follows from the journey rather than being a fourth independent
       switch. An active account has been using the proxy; a first-run account
       has not, which is the entire reason its overview must not lead with
       metrics. */
    hasTraffic: (ctx) => ctx.journey === "active",
    connected: (ctx) => `${ctx.step} of 3`,
  },

  actions: [
    {
      id: "restart",
      label: "Restart scenario",
      title: "Clears the scenario and returns to the front door",
      run: (api) => {
        api.reset()
        api.navigate("/signin")
      },
    },
  ],
})
