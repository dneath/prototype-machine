/* Lint the package as it will be published: publint for the manifest and the
 * file list, Are the Types Wrong for the types each entry point resolves to.
 *
 * Packs once, explicitly for real. Under `npm publish --dry-run`, npm hands
 * its dry-run setting down to any `npm pack` a script runs, and a dry-run pack
 * writes no tarball for the linters to read. */

import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const npm = process.platform === "win32" ? "npm.cmd" : "npm"
const bin = (name) => join(pkgDir, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name)
const work = mkdtempSync(join(tmpdir(), "pm-lint-"))

try {
  const [packed] = JSON.parse(
    execFileSync(npm, ["pack", "--json", "--dry-run=false", "--pack-destination", work], {
      cwd: pkgDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }),
  )
  const tarball = join(work, packed.filename)
  execFileSync(bin("publint"), [tarball], { cwd: pkgDir, stdio: "inherit" })
  /* node10 is the pre-`exports` resolver. Subpaths like /core need `exports`,
     which every supported Node and bundler reads. */
  execFileSync(bin("attw"), [tarball, "--profile", "node16"], { cwd: pkgDir, stdio: "inherit" })
} catch (error) {
  process.exitCode = 1
  if (error.status === undefined) console.error(error)
} finally {
  rmSync(work, { recursive: true, force: true })
}
