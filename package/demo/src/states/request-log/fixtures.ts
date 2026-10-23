import { type RequestQuery, type RequestRow } from "../../components/request-log"

/* Product-shaped data in the quantities users have: real model ids, a mix of
   results, token counts that vary, timestamps a few seconds apart. Three rows
   of "Test item" make every state look fine. */

const USERS = ["j.rivera", "m.chen", "t.ito", "s.patel", "a.haddad", "k.berg"]
const MODELS = ["gpt-4.1", "claude-sonnet-4", "llama-3.1-70b-instruct", "mistral-large-2411"]
const START = Date.parse("2026-10-15T14:02:11.000Z")

function rows(count: number): RequestRow[] {
  return Array.from({ length: count }, (_, i) => {
    const status = i % 17 === 5 ? 429 : i % 11 === 3 ? 400 : 200
    return {
      id: `req_${(9000 + i).toString(36)}`,
      at: new Date(START - i * 37_000).toISOString(),
      user: USERS[(i * 5) % USERS.length],
      model: MODELS[(i * 3) % MODELS.length],
      tokens: status === 200 ? 180 + ((i * 7919) % 6400) : 0,
      latencyMs: status === 429 ? 12 : 340 + ((i * 104_729) % 4200),
      status,
    }
  })
}

/* The longest values real traffic has carried: a federated user id and a
   fine-tuned model's full name. The table must survive them. */
function longRows(count: number): RequestRow[] {
  return rows(count).map((row, i) => ({
    ...row,
    user: i % 2 ? "maximiliana.oyelaran-vandervoort@field-operations.example-tenant.com" : row.user,
    model: i % 3 ? row.model : "ft:llama-3.1-70b-instruct:acme-support-triage:2026-09-30:ckpt-0412",
  }))
}

/* Held still: nothing resolves until the switcher moves. */
const pending: RequestQuery = { status: "pending" }

export const STATES = {
  loading: "Loading",
  empty: { label: "Empty", note: "A new key, no traffic yet" },
  one: "One request",
  typical: { label: "Typical", note: "18 requests, the median for a team" },
  paged: { label: "Paged", note: "60 requests, so the table paginates" },
  refetching: { label: "Refetching", note: "Stale rows while a refresh runs" },
  member: { label: "Member", note: "Typical rows, seen by a member: no User column, no export" },
  long: { label: "Long values", note: "The longest user and model ids the gateway accepts" },
  error: "Error",
}

export const MISSING = {
  partial: { label: "Partly loaded", note: "the design streams rows in, the code waits for all of them" },
}

export type BenchState = keyof typeof STATES

export const FIXTURES: Record<BenchState, { query: RequestQuery; viewer: "admin" | "member" }> = {
  loading: { query: pending, viewer: "admin" },
  empty: { query: { status: "success", data: [], isFetching: false }, viewer: "admin" },
  one: { query: { status: "success", data: rows(1), isFetching: false }, viewer: "admin" },
  typical: { query: { status: "success", data: rows(18), isFetching: false }, viewer: "admin" },
  paged: { query: { status: "success", data: rows(60), isFetching: false }, viewer: "admin" },
  refetching: { query: { status: "success", data: rows(18), isFetching: true }, viewer: "admin" },
  member: { query: { status: "success", data: rows(18), isFetching: false }, viewer: "member" },
  long: { query: { status: "success", data: longRows(6), isFetching: false }, viewer: "admin" },
  error: { query: { status: "error", error: "The gateway answered 503. It is probably restarting." }, viewer: "admin" },
}
