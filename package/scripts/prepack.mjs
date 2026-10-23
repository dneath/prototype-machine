/* Runs before `npm pack` and `npm publish` (and with --clean, after them).
 *
 * First it makes sure there is a build to ship. `npm pack` does not build, so
 * on a fresh clone it would pack a tarball with no dist/, which installs
 * cleanly and fails on its first import. fresh-build.mjs builds it when it is
 * missing or stale.
 *
 * npm skips this whole step when `ignore-scripts` is on, and the pack then
 * succeeds with three files. `npm run tarball` (tarball.mjs) does not depend
 * on it.
 *
 * Then it copies the docs, which live at the repo root, one level above this
 * package, so they ship:
 *
 *   README.md   with relative links made absolute, because npmjs.com resolves
 *               a relative link against the repository and this package sits
 *               in a subfolder, so `reference/api.md` would 404 there.
 *   SKILL.md    the agent skill, so an agent can read the guidance that
 *   reference/  matches the installed version from node_modules.
 *
 * None of the copies is tracked: package/.gitignore lists them. */

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { buildIfStale } from "./fresh-build.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const pkgDir = join(here, "..")
const repoDir = join(pkgDir, "..")
const COPIES = ["README.md", "SKILL.md", "reference"]

if (process.argv.includes("--clean")) {
  for (const name of COPIES) rmSync(join(pkgDir, name), { recursive: true, force: true })
  process.exit(0)
}

buildIfStale(pkgDir)

const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"))
const repo = pkg.repository.url.replace(/^git\+/, "").replace(/\.git$/, "")
const blob = `${repo}/blob/main/`

for (const name of COPIES) {
  if (!existsSync(join(repoDir, name))) throw new Error(`prepack: ${name} is missing at the repo root.`)
}

/* [text](path) where path is relative: not a URL, not an anchor, not mailto. */
const readme = readFileSync(join(repoDir, "README.md"), "utf8").replace(
  /\]\((?!https?:|#|mailto:)([^)\s]+)\)/g,
  (_, path) => `](${blob}${path.replace(/^\.\//, "")})`,
)
writeFileSync(join(pkgDir, "README.md"), readme)
cpSync(join(repoDir, "SKILL.md"), join(pkgDir, "SKILL.md"))
cpSync(join(repoDir, "reference"), join(pkgDir, "reference"), { recursive: true })
