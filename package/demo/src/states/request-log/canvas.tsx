import { StateCanvas } from "prototype-machine"

import { RequestLog } from "../../components/request-log"
import { FIXTURES, MISSING, STATES } from "./fixtures"

/* The same states and fixtures as the bench beside it, all at once: every
   state in the built-in stress frames (as shipped, 320px, squeezed by a
   sidebar, very wide, right to left). Delete this file to remove it. */
export function RequestLogCanvas() {
  return (
    <StateCanvas states={STATES} missing={MISSING} width={880} frames="stress" label="Request log" enabled>
      {(state) => <RequestLog {...FIXTURES[state]} />}
    </StateCanvas>
  )
}
