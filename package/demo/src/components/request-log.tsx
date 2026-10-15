/* A product component, written the way a real one is: it takes its data as a
   query result and branches on it. Nothing here knows a bench exists. */

export interface RequestRow {
  id: string
  at: string
  user: string
  model: string
  tokens: number
  latencyMs: number
  status: 200 | 400 | 429
}

export type RequestQuery =
  | { status: "pending" }
  | { status: "error"; error: string }
  | { status: "success"; data: ReadonlyArray<RequestRow>; isFetching: boolean }

export const PAGE_SIZE = 25

const time = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" })
const STATUS = { 200: "OK", 400: "Blocked", 429: "Rate limited" } as const

export function RequestLog({ query, viewer }: { query: RequestQuery; viewer: "admin" | "member" }) {
  const admin = viewer === "admin"

  if (query.status === "pending") {
    return (
      <section className="log" aria-busy="true" aria-label="Requests">
        <header className="log-head"><h2>Requests</h2></header>
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="log-skeleton" />)}
      </section>
    )
  }

  if (query.status === "error") {
    return (
      <section className="log" aria-label="Requests">
        <header className="log-head"><h2>Requests</h2></header>
        <div className="log-message" role="alert">
          <p><b>Requests did not load.</b> {query.error}</p>
          <button type="button">Try again</button>
        </div>
      </section>
    )
  }

  const rows = query.data
  if (rows.length === 0) {
    return (
      <section className="log" aria-label="Requests">
        <header className="log-head"><h2>Requests</h2></header>
        <div className="log-message">
          <p><b>No requests in the last 24 hours.</b></p>
          <p>Requests appear here a few seconds after a tool sends one with your key.</p>
        </div>
      </section>
    )
  }

  const page = rows.slice(0, PAGE_SIZE)
  return (
    <section className="log" aria-label="Requests">
      <header className="log-head">
        <h2>Requests</h2>
        {query.isFetching ? <span className="log-updating" role="status">Updating</span> : null}
        {admin ? <button type="button">Export CSV</button> : null}
      </header>
      <table>
        <thead>
          <tr>
            <th scope="col">Time (UTC)</th>
            {admin ? <th scope="col">User</th> : null}
            <th scope="col">Model</th>
            <th scope="col" className="num">Tokens</th>
            <th scope="col" className="num">Latency</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {page.map((row) => (
            <tr key={row.id}>
              <td>{time.format(new Date(row.at))}</td>
              {admin ? <td>{row.user}</td> : null}
              <td><code>{row.model}</code></td>
              <td className="num">{row.tokens.toLocaleString("en-US")}</td>
              <td className="num">{row.latencyMs.toLocaleString("en-US")} ms</td>
              <td data-result={row.status}>{STATUS[row.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > PAGE_SIZE ? (
        <footer className="log-foot">
          <span>Showing 1 to {PAGE_SIZE} of {rows.length.toLocaleString("en-US")}</span>
          <button type="button">Next page</button>
        </footer>
      ) : null}
    </section>
  )
}
