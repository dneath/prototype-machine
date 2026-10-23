import * as React from "react"
import { createRoot } from "react-dom/client"

import { ScenarioPanel, ScenarioProvider } from "prototype-machine"

import { scenario } from "./scenario"
import { Screen } from "./screen"
import { OverviewCanvas } from "./states/overview/canvas"
import { RequestLogCanvas } from "./states/request-log/canvas"
import { RequestLogStates } from "./states/request-log/page"
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

function App() {
  const { path, navigate } = usePath()
  /* A component bench is its own scratch route. It needs no provider. */
  if (path === "/states/request-log") return <RequestLogStates />
  /* So is a canvas. The overview canvas pins a scenario in each frame. */
  if (path === "/states/request-log/canvas") return <RequestLogCanvas />
  if (path === "/states/overview/canvas") return <OverviewCanvas />
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
