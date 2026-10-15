import { defineMachine } from "prototype-machine"

/* The scenario space this demo drives.
 *
 * A sample product's first hour, where
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
       every other, which is right, because these are not journeys. */
    role: {
      label: "Role",
      group: "Viewing as",
      initial: "user",
      states: { user: { label: "Standard user" }, admin: { label: "Admin" } },
    },
    data: {
      label: "Data state",
      group: "Viewing as",
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
       and a dense transition map: a stress case for how the panel lays out a
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
      group: "Look",
      default: "comfortable",
      options: ["comfortable", "compact"],
      /* Mirrored onto <html> so plain CSS can read it. */
      dom: { attribute: "data-density" },
    },
    seats: { type: "number", label: "Seats", group: "Look", default: 12, min: 0, max: 500 },

    /* STRESS. One-click worst cases for the card on the overview: the stress
       sets are built in, so a 2,000-character name or an Arabic one is a
       click rather than something to remember to paste. */
    projectName: {
      type: "string",
      label: "Project name",
      group: "Stress",
      default: "Acme gateway",
      presets: "stress",
    },
    unread: { type: "number", label: "Unread", group: "Stress", default: 3, min: 0, presets: "stress" },
    region: {
      type: "enum",
      label: "Region",
      group: "Stress",
      default: "us-east-1",
      options: [
        "us-east-1", "us-east-2", "us-west-1", "us-west-2", "ca-central-1", "eu-west-1", "eu-west-2",
        "eu-central-1", "eu-north-1", "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1",
        "sa-east-1", "me-south-1", "af-south-1",
      ],
    },
    /* A HOSTILE HOST. Turns on demo.css rules that restyle every button,
       input and select on the page, force a serif font and a light scheme,
       transform the layout wrapper and open a modal at z-index 9999. These are the
       things a real product does that used to bleed into the panel. */
    hostile: {
      type: "boolean",
      label: "Hostile host CSS",
      group: "Stress",
      default: false,
      dom: { attribute: "data-hostile" },
    },
    modal: { type: "boolean", label: "Modal open", group: "Stress", default: false },
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
