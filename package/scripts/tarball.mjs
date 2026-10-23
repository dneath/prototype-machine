/* `npm run tarball`: a .tgz of this package that installs anywhere, checked
 * before it is handed over.
 *
 * Plain `npm pack` builds and copies the docs in its prepack step, and npm
 * skips that step when `ignore-scripts` is on, a setting many people now turn
 * on globally. The pack then succeeds with three files and no code, and the
 * first sign of it is an import that fails in someone else's app. `npm run`
 * always runs the script it names, so this builds when it needs to, packs
 * with scripts forced back on, and refuses to leave a tarball behind that is
 * missing anything an install needs.
 *
 *   npm run tarball                         into this folder
 *   npm run tarball -- --out ../somewhere   into another one */

import { execSync } from "node:child_process"
import { mkdirSync, rmSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { buildIfStale } from "./fresh-build.mjs"

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const at = process.argv.indexOf("--out")
const out = at > 0 && process.argv[at + 1] ? resolve(process.argv[at + 1]) : pkgDir
mkdirSync(out, { recursive: true })

/* What an install of this package reads. A tarball without any of these is
   broken, however cleanly it installs. */
const REQUIRED = [
  "package.json",
  "dist/index.js",
  "dist/index.cjs",
  "dist/index.d.ts",
  "dist/production.js",
  "dist/panel.js",
  "dist/core/index.js",
  "README.md",
  "SKILL.md",
  "reference/api.md",
  "reference/canvas.md",
]

buildIfStale(pkgDir)

/* Quoted, so a folder with a space in its name survives the shell. The shell
   is what finds npm.cmd on Windows. */
const raw = execSync(`npm pack --json --ignore-scripts=false --dry-run=false --pack-destination ${JSON.stringify(out)}`, {
  cwd: pkgDir,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
})
const [packed] = JSON.parse(raw.slice(raw.indexOf("[")))
const tarball = join(out, packed.filename)
const files = packed.files.map((file) => file.path)
const missing = REQUIRED.filter((file) => !files.includes(file))

if (missing.length) {
  rmSync(tarball, { force: true })
  console.error(`tarball: the packed package is missing ${missing.join(", ")}, so it was deleted.`)
  console.error("Run `npm ci`, then `npm run build`, and look at what fails.")
  process.exit(1)
}

const shown = relative(process.cwd(), tarball) || tarball
console.log(`Wrote ${shown}: ${files.length} files, ${Math.round(packed.size / 1024)} kB.`)
console.log("Install it in another project with:")
console.log(`  npm install --save-dev ${JSON.stringify(tarball)}`)
