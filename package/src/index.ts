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
export {
  useDrag,
  clampToViewport,
  cornerPosition,
  snapTarget,
  DRAG_THRESHOLD,
  SNAP_DISTANCE,
  type Corner,
  type Placement,
  type Point,
  type UseDragOptions,
  type UseDragResult,
} from "./react/drag"
export { FieldRow, MachineRow, Pill, Row } from "./react/controls"
export { injectStyles, styles } from "./react/styles"

export * from "./core/index"
