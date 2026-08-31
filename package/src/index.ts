/* prototype-machine — the React entry.
 *
 * The interesting states of a product are states, not screens, and almost none
 * of them are reachable by clicking. This puts them one click away without
 * putting a role switcher in your settings tray. */

export {
  ScenarioProvider,
  ScenarioContext,
  useHydrated,
  type Scenario,
  type ScenarioApi,
  type ScenarioProviderProps,
} from "./react/provider"
export { useScenario, useScenarioValue } from "./react/use-scenario"
export { ScenarioPanel, type PanelPosition, type ScenarioPanelProps } from "./react/panel"
export { ScenarioPalette } from "./react/palette"
export { FieldRow, MachineRow, Pill, Row } from "./react/controls"
export { formatBinding, isTypingTarget, parseBinding, useHotkey } from "./react/hotkeys"
export { injectStyles, styles } from "./react/styles"

export * from "./core/index"
