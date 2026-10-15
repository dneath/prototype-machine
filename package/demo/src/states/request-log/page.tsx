import { StateBench } from "prototype-machine"

import { RequestLog } from "../../components/request-log"
import { FIXTURES, MISSING, STATES } from "./fixtures"

/* A scratch page: the real RequestLog in every state it can be in. The page
   adds the container, the fixtures and the switcher, nothing else. Delete
   this folder to remove it. */
export function RequestLogStates() {
  return (
    <main className="bench">
      <StateBench states={STATES} missing={MISSING} initial="typical" width={880} label="Request log states" enabled>
        {(state) => <RequestLog {...FIXTURES[state]} />}
      </StateBench>
    </main>
  )
}
