import { PinnedScenario, StateCanvas, statesOf } from "prototype-machine"

import { scenario } from "../../scenario"
import { Screen } from "../../screen"

/* The overview screen in every rung of the journey (rows) under every data
   state (columns): twenty frames, each a real <Screen> reading a scenario
   pinned with PinnedScenario. The labels come from the config, so the canvas
   says "Key made" where the panel does. */
const JOURNEY = statesOf(scenario, "journey")
const DATA = statesOf(scenario, "data")

/* The canvas is a page of its own; a nav click inside a frame goes nowhere. */
const stay = () => {}

export function OverviewCanvas() {
  return (
    <StateCanvas states={JOURNEY} frames={DATA} width={880} label="Overview" enabled>
      {(journey, data) => (
        <PinnedScenario machine={scenario} values={{ journey, data }} path="/overview">
          <Screen path="/overview" navigate={stay} />
        </PinnedScenario>
      )}
    </StateCanvas>
  )
}
