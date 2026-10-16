/* Runs before `npm pack` and `npm publish` (and with --clean, after them).
 *
 * The docs live at the repo root, one level above this package. This copies
 * them in so they ship:
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

const here = dirname(fileURLToPath(import.meta.url))
const pkgDir = join(here, "..")
const repoDir = join(pkgDir, "..")
const COPIES = ["README.md", "SKILL.md", "reference"]

if (process.argv.includes("--clean")) {
  for (const name of COPIES) rmSync(join(pkgDir, name), { recursive: true, force: true })
  process.exit(0)
}

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
