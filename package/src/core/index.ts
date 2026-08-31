/* The framework-agnostic half. No React import anywhere below this line, so a
   Vue or Svelte adapter has somewhere to stand. */

export * from "./schema"
export {
  compile,
  defineMachine,
  isDev,
  isValidFieldValue,
  optionsOf,
  ScenarioError,
  visible,
  warn,
  type CompiledMachine,
  type Machine,
  type PartialSnapshot,
  type Snapshot,
} from "./machine"
export {
  clearStorage,
  fromSearch,
  readStorage,
  resolve,
  toLink,
  toSearch,
  writeStorage,
} from "./serialize"
export {
  at,
  canRedo,
  canUndo,
  describe,
  initHistory,
  push,
  redo,
  sameSnapshot,
  undo,
  DEFAULT_LIMIT,
  type History,
  type HistoryEntry,
} from "./history"
export { copyText, toMarkdown, type ReportOptions } from "./report"
