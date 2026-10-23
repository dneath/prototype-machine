/* Build when dist/ is missing or older than anything it is built from.
 *
 * Shared by prepack.mjs (`npm pack`, `npm publish`) and tarball.mjs
 * (`npm run tarball`). A dist/ that is already fresh, as after the build in
 * `npm run check`, is left alone, so a check does not build three times. */

import { execSync } from "node:child_process"
import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

/* The newest modification time under a path, or 0 if it does not exist. */
function newest(path) {
  if (!existsSync(path)) return 0
  const stat = statSync(path)
  if (!stat.isDirectory()) return stat.mtimeMs
  return Math.max(0, ...readdirSync(path).map((name) => newest(join(path, name))))
}

/* The oldest of the built entry points: a build interrupted halfway is stale. */
const ENTRIES = ["index.js", "index.cjs", "production.js", "panel.js", "core/index.js"]

/** Build the package in `pkgDir` unless dist/ is newer than its sources. Returns whether it built. */
export function buildIfStale(pkgDir) {
  const built = Math.min(...ENTRIES.map((entry) => newest(join(pkgDir, "dist", entry))))
  const source = Math.max(
    newest(join(pkgDir, "src")),
    newest(join(pkgDir, "tsup.config.ts")),
    newest(join(pkgDir, "package.json")),
  )
  if (built >= source) return false
  /* To stderr, so `npm pack --json` keeps a clean stdout. */
  console.error("dist/ is missing or older than src/, so building it first.")
  /* Through a shell, so `npm` resolves to npm.cmd on Windows. `npm run` runs
     the script it names even when ignore-scripts is on. */
  execSync("npm run build", { cwd: pkgDir, stdio: ["ignore", 2, 2] })
  return true
}
