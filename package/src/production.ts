/* prototype-machine: the production entry.
 *
 * Bundlers pick this file under the "production" export condition. The
 * provider and hooks still work, so a scenario in storage or the query string
 * still resolves, but the panel renders nothing and its code is not shipped.
 * A review build that wants the panel imports it from "prototype-machine/panel". */

export {
  PinnedScenario,
  ScenarioProvider,
  ScenarioContext,
  useHydrated,
  type Scenario,
  type ScenarioApi,
  type PinnedScenarioProps,
  type ScenarioProviderProps,
} from "./react/provider"
export { useScenario, useScenarioSelector, useScenarioValue, type TypedScenario } from "./react/use-scenario"
export type { PanelPosition, ScenarioPanelProps } from "./react/panel"
export {
  STATE_PARAM,
  useStateParam,
  type BenchStateDef,
  type BenchStates,
  type StateBenchProps,
  type StateParamOptions,
} from "./react/bench-state"

export {
  DEFAULT_CANVAS_WIDTH,
  FRAME_PARAM,
  stressFrames,
  type CanvasFrameDef,
  type CanvasFrames,
  type StateCanvasProps,
} from "./react/canvas-state"

export * from "./core/index"

import { createElement } from "react"

import { BenchBody, type BenchStates, type StateBenchProps, useBench } from "./react/bench-state"
import { type CanvasFrames, FlatCanvas, type StateCanvasProps } from "./react/canvas-state"

export function ScenarioPanel(_props: import("./react/panel").ScenarioPanelProps): null {
  return null
}

/* The bench still renders the state its URL names, so a link keeps working.
   Only the switcher is gone. */
export function StateBench<T extends BenchStates>(props: StateBenchProps<T>) {
  const { state } = useBench(props)
  return createElement(BenchBody, {
    state,
    width: props.width,
    reserve: null,
    children: state === null ? null : props.children(state),
  })
}

/* The canvas renders every frame in a plain grid, so the page still shows
   every state. The camera, the labels and the bar are not shipped. */
export function StateCanvas<T extends BenchStates, F extends CanvasFrames = CanvasFrames>(props: StateCanvasProps<T, F>) {
  return createElement(FlatCanvas<T, F>, props)
}
