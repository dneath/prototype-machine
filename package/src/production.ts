/* prototype-machine — the production entry.
 *
 * Bundlers pick this file under the "production" export condition. The
 * provider and hooks still work, so a scenario in storage or the query string
 * still resolves, but the panel renders nothing and its code is not shipped.
 * A review build that wants the panel imports it from "prototype-machine/panel". */

export {
  ScenarioProvider,
  ScenarioContext,
  useHydrated,
  type Scenario,
  type ScenarioApi,
  type ScenarioProviderProps,
} from "./react/provider"
export { useScenario, useScenarioSelector, useScenarioValue, type TypedScenario } from "./react/use-scenario"
export type { PanelPosition, ScenarioPanelProps } from "./react/panel"

export * from "./core/index"

export function ScenarioPanel(_props: import("./react/panel").ScenarioPanelProps): null {
  return null
}
