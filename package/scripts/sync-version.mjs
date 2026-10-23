/* `npm version <patch|minor|major>` runs this after it bumps package.json.
 *
 * The docs name the version they describe in a few places, so an agent reading
 * them knows which release they match. This writes the new version into each,
 * so a release is one command, not a hunt through the docs.
 *
 * With --check it changes nothing and fails if any of them disagrees with
 * package.json. `npm test` runs that (src/versions.test.ts). */

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const pkgDir = join(here, "..")
const repoDir = join(pkgDir, "..")
const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"))

const SEMVER = String.raw`\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?`
const VERSIONED = [
  ["SKILL.md", new RegExp(String.raw`(This guidance targets \*\*prototype-machine )${SEMVER}(\*\*)`)],
  ["reference/api.md", new RegExp(String.raw`(Targets prototype-machine )${SEMVER}(\.)`)],
  ["reference/bench.md", new RegExp(String.raw`(Targets prototype-machine )${SEMVER}(\.)`)],
  ["reference/canvas.md", new RegExp(String.raw`(Targets prototype-machine )${SEMVER}(\.)`)],
  ["reference/control-types.json", new RegExp(String.raw`(catalogue for prototype-machine )${SEMVER}(\.)`)],
  ["reference/control-types.json", new RegExp(String.raw`("version": ")${SEMVER}(")`)],
]

const check = process.argv.includes("--check")
const wrong = []
for (const [file, pattern] of VERSIONED) {
  const path = join(repoDir, file)
  const text = readFileSync(path, "utf8")
  const match = text.match(pattern)
  if (!match) throw new Error(`sync-version: no version found in ${file}.`)
  const found = match[0].slice(match[1].length, match[0].length - match[2].length)
  if (found === version) continue
  if (check) wrong.push(`${file} says ${found}`)
  else writeFileSync(path, text.replace(pattern, `$1${version}$2`))
}

if (wrong.length) {
  console.error(`package.json is ${version}, but ${wrong.join(", ")}. Run: node scripts/sync-version.mjs`)
  process.exit(1)
}
if (!check) console.log(`The docs now target ${version}.`)
