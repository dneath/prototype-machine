import { type CompiledMachine, visible } from "./machine"
import { type ActionDef, type AnyField, type Env, type MachineDef } from "./schema"

/* How the panel is carved up. Pure, so the React panel is a thin renderer and
   a non-React adapter can lay itself out the same way. */

export interface PanelSection {
  /** `null` is the ungrouped section, which always comes first. */
  group: string | null
  machines: Array<[string, MachineDef]>
  fields: Array<[string, AnyField]>
  actions: ActionDef[]
}

/**
 * Split a config into sections, in declaration order within each section.
 *
 * Machines are walked first, then fields, then actions, and anything `visible`
 * says no to is skipped. Entries with no `group` land in the `null` section;
 * named sections follow in the order their group is first seen. Empty sections
 * are dropped, so a config with no `group` anywhere yields exactly one `null`
 * section holding everything, exactly as the flat panel rendered it.
 */
export function sectionsOf(config: CompiledMachine["config"], env: Env): PanelSection[] {
  const ungrouped: PanelSection = { group: null, machines: [], fields: [], actions: [] }
  const named = new Map<string, PanelSection>()

  function sectionFor(group: string | undefined): PanelSection {
    if (group === undefined) return ungrouped
    let section = named.get(group)
    if (!section) {
      section = { group, machines: [], fields: [], actions: [] }
      named.set(group, section)
    }
    return section
  }

  for (const [id, def] of Object.entries(config.machines)) {
    if (visible(def, env)) sectionFor(def.group).machines.push([id, def])
  }
  for (const [id, def] of Object.entries(config.fields)) {
    if (visible(def, env)) sectionFor(def.group).fields.push([id, def])
  }
  for (const action of config.actions) {
    if (visible(action, env)) sectionFor(action.group).actions.push(action)
  }

  return [ungrouped, ...named.values()].filter(
    (s) => s.machines.length + s.fields.length + s.actions.length > 0
  )
}
