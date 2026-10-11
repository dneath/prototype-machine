import { type NumberField, type Preset, type StringField } from "./schema"

/* Worst-case values, for the presets a field can offer with `presets: "stress"`.
 *
 * Every one of these is something real data does eventually, and almost none
 * of them is what a designer types into a mock. A card that is fine with
 * "Acme Inc" and breaks on a 60-character German compound or an Arabic name
 * is a card that breaks in production; the point of keeping the list here is
 * that it is one click away instead of something you remember to try. */

export interface LabelledPreset<T> {
  label: string
  value: T
}

const LONG =
  "Quarterly infrastructure reconciliation report for the Asia-Pacific regional operations team (revised draft, pending sign-off)"

/* About two thousand characters of ordinary prose, so wrapping, clamping and
   truncation get exercised by real word lengths rather than by one repeated
   letter. */
const HUGE = Array.from(
  { length: 22 },
  () => "The quick brown fox jumps over the lazy dog while the reviewer waits for the layout to break."
).join(" ")

export const STRESS_TEXT: ReadonlyArray<LabelledPreset<string>> = [
  { label: "Empty", value: "" },
  { label: "Spaces", value: "   " },
  { label: "1 char", value: "A" },
  { label: "Long", value: LONG },
  { label: "2,000 chars", value: HUGE },
  { label: "No breaks", value: "Donaudampfschifffahrtsgesellschaftskapitänswitwe-https://example.com/a/very/long/path/that/never/wraps?ref=newsletter_2026" },
  { label: "Email", value: "first.middle.lastname+notifications@subdomain.example-company.co.uk" },
  { label: "RTL", value: "مرحبًا بالعالم، هذا نص تجريبي طويل قليلاً" },
  { label: "Mixed bidi", value: "Order #4521 تم الشحن on 12/03 — שלום" },
  { label: "CJK", value: "国际化与本地化测试文本・日本語のテキスト・한국어" },
  { label: "Emoji", value: "👩🏽‍💻 🧑‍🤝‍🧑 🇯🇵 🏳️‍🌈 ✨" },
  { label: "Diacritics", value: "Zoë Ångström-Ñúñez Øvergård Łukasz Dvořák" },
  { label: "Markup", value: "<b>bold</b> & \"quotes\" <script>alert(1)</script>" },
  { label: "Lines", value: "First line\nSecond line\n\nAfter a blank line" },
]

export const STRESS_NUMBERS: ReadonlyArray<LabelledPreset<number>> = [
  { label: "0", value: 0 },
  { label: "1", value: 1 },
  { label: "-1", value: -1 },
  { label: "0.1+0.2", value: 0.1 + 0.2 },
  { label: "99", value: 99 },
  { label: "100", value: 100 },
  { label: "999", value: 999 },
  { label: "1,000", value: 1000 },
  { label: "1M", value: 1_000_000 },
  { label: "Max safe", value: Number.MAX_SAFE_INTEGER },
]

function label<T extends string | number>(preset: Preset<T>): LabelledPreset<T> {
  if (typeof preset === "object" && preset !== null) return preset
  const text = String(preset)
  return { label: text === "" ? "Empty" : text.length > 24 ? `${text.slice(0, 23)}…` : text, value: preset }
}

/** The presets a field offers, labelled, with `"stress"` expanded and number
 *  presets outside the field's range dropped. */
export function presetsOf(def: StringField): LabelledPreset<string>[]
export function presetsOf(def: NumberField): LabelledPreset<number>[]
export function presetsOf(def: StringField | NumberField): LabelledPreset<string | number>[] {
  if (!def.presets) return []
  if (def.type === "string") {
    return def.presets === "stress" ? [...STRESS_TEXT] : (def.presets as ReadonlyArray<Preset<string>>).map(label)
  }
  const all = def.presets === "stress" ? [...STRESS_NUMBERS] : (def.presets as ReadonlyArray<Preset<number>>).map(label)
  if (def.presets !== "stress") return all
  return all.filter(
    (p) => (def.min === undefined || p.value >= def.min) && (def.max === undefined || p.value <= def.max)
  )
}
