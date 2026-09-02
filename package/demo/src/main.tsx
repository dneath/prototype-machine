import * as React from "react"
import { createRoot } from "react-dom/client"

import { ScenarioPanel, ScenarioProvider, useScenario } from "prototype-machine"

import { scenario } from "./scenario"
import "./demo.css"

/* A stand-in for a router, so the demo can show `when` predicates working
   without dragging one in. */
function usePath() {
  const [path, setPath] = React.useState(
    () => window.location.pathname || "/overview"
  )
  const navigate = React.useCallback((to: string) => {
    window.history.pushState({}, "", to)
    setPath(to)
  }, [])
  React.useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])
  return { path, navigate }
}

const ROUTES = ["/overview", "/guardrails", "/signin"]

function Screen({ path, navigate }: { path: string; navigate: (to: string) => void }) {
  /* Exactly how a real screen reads it: flat values off one hook, no knowledge
     that a control panel exists. */
  const p = useScenario(scenario)

  return (
    <main>
      <nav>
        {ROUTES.map((route) => (
          <button
            key={route}
            type="button"
            data-current={route === path}
            onClick={() => navigate(route)}
          >
            {route}
          </button>
        ))}
      </nav>

      <h1>{path}</h1>

      {p.data === "loading" ? (
        <p className="muted">Skeletons would be here.</p>
      ) : p.data === "error" ? (
        <p className="bad">Something went wrong loading this.</p>
      ) : path === "/guardrails" ? (
        <p>
          {p.hasEvents && p.data !== "empty"
            ? "A table of blocked and flagged requests."
            : "Nothing has been blocked or flagged — the teaching empty state."}
        </p>
      ) : path === "/signin" ? (
        <p>
          {p.signInFailure === "none"
            ? "The sign-in form."
            : p.signInFailure === "credentials"
              ? "That username and password did not match."
              : p.signInFailure === "disabled"
                ? "This account has been disabled."
                : "The directory is not answering. Try again shortly."}
        </p>
      ) : p.hasTraffic && p.data !== "empty" ? (
        <p>A dashboard of real usage. {p.seats} seats.</p>
      ) : (
        <p>A checklist, {p.connected} done. No traffic yet, so no metrics.</p>
      )}

      <dl>
        <div><dt>journey</dt><dd>{p.journey}</dd></div>
        <div><dt>step</dt><dd>{p.step}</dd></div>
        <div><dt>keyIssued</dt><dd>{String(p.keyIssued)}</dd></div>
        <div><dt>firstRequestAt</dt><dd>{p.firstRequestAt ?? "null"}</dd></div>
        <div><dt>role</dt><dd>{p.role}</dd></div>
        <div><dt>signInFailure</dt><dd>{p.signInFailure}</dd></div>
        <div><dt>data</dt><dd>{p.data}</dd></div>
        <div><dt>hasEvents</dt><dd>{String(p.hasEvents)}</dd></div>
        <div><dt>density</dt><dd>{p.density}</dd></div>
        <div><dt>seats</dt><dd>{p.seats}</dd></div>
        <div><dt>hasTraffic</dt><dd>{String(p.hasTraffic)}</dd></div>
      </dl>

      <p className="muted">
        The journey is a ladder: from <b>First run</b> only <b>Key made</b> and{" "}
        <b>Parked</b> are legal, so <b>Active</b> is drawn but dead. Open the
        controls with the button in the corner.
      </p>
    </main>
  )
}

function App() {
  const { path, navigate } = usePath()
  return (
    <ScenarioProvider
      machine={scenario}
      storageKey="prototype-machine-demo-v1"
      path={path}
      navigate={navigate}
      enabled
    >
      <Screen path={path} navigate={navigate} />
      <ScenarioPanel />
    </ScenarioProvider>
  )
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
