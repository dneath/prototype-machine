/* Install the package the way an app would, and use it.
 *
 * `npm run build` proves the code compiles. This proves the thing that gets
 * published works: it packs a tarball, installs it into a throwaway app beside
 * React, then imports every entry point as ESM and CommonJS, checks that the
 * `production` condition swaps in the stub panel, typechecks a small app
 * against the shipped types, and checks the tarball holds what it should and
 * nothing else.
 *
 *   node scripts/pack-test.mjs          clean up afterwards
 *   node scripts/pack-test.mjs --keep   leave the app behind to poke at */

import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const keep = process.argv.includes("--keep")
const npm = process.platform === "win32" ? "npm.cmd" : "npm"
const work = mkdtempSync(join(tmpdir(), "pm-pack-"))
const app = join(work, "app")
mkdirSync(app)

const run = (cmd, args, cwd, extra = {}) =>
  execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", ...extra })
const versionOf = (name) => JSON.parse(readFileSync(join(pkgDir, "node_modules", name, "package.json"), "utf8")).version
const fail = (message) => {
  console.error(`pack-test: ${message}`)
  console.error(`The app is in ${app}`)
  process.exit(1)
}

try {
  /* 1. The tarball: what is in it. */
  const [packed] = JSON.parse(run(npm, ["pack", "--json", "--dry-run=false", "--pack-destination", work], pkgDir))
  const files = packed.files.map((f) => f.path)
  const allowed = /^(dist\/|reference\/|README\.md$|LICENSE$|CHANGELOG\.md$|SKILL\.md$|package\.json$)/
  const stray = files.filter((f) => !allowed.test(f))
  if (stray.length) fail(`unexpected files in the tarball: ${stray.join(", ")}`)
  for (const need of ["README.md", "LICENSE", "CHANGELOG.md", "SKILL.md", "reference/api.md", "dist/index.js", "dist/production.js"]) {
    if (!files.includes(need)) fail(`the tarball is missing ${need}`)
  }

  /* 2. A throwaway app with the tarball and React. */
  writeFileSync(join(app, "package.json"), JSON.stringify({ name: "pm-pack-test-app", private: true, type: "module" }))
  run(
    npm,
    [
      "install", "--dry-run=false", "--no-audit", "--no-fund", "--prefer-offline", "--loglevel=error",
      join(work, packed.filename),
      `react@${versionOf("react")}`,
      `react-dom@${versionOf("react-dom")}`,
      `@types/react@${versionOf("@types/react")}`,
    ],
    app,
  )

  const installed = join(app, "node_modules", "prototype-machine")
  const readme = readFileSync(join(installed, "README.md"), "utf8")
  const relative = readme.match(/\]\((?!https?:|#|mailto:)[^)]+\)/g)
  if (relative) fail(`the packed README still has relative links, which break on npmjs.com: ${relative.join(" ")}`)

  /* 3. Every entry, as ESM, in development. */
  writeFileSync(
    join(app, "dev.mjs"),
    `
import assert from "node:assert/strict"
import * as root from "prototype-machine"
import * as core from "prototype-machine/core"
import * as panel from "prototype-machine/panel"
assert.equal(root.ScenarioError, core.ScenarioError, "one ScenarioError class across entries")
assert.equal(typeof root.ScenarioProvider, "function")
assert.equal(typeof root.StateBench, "function")
assert.equal(typeof panel.ScenarioPanel, "function")
assert.equal(typeof core.toDefaults, "function")
/* The real panel is a component with hooks; called bare, it throws. */
assert.throws(() => root.ScenarioPanel({}))
const m = core.defineMachine({ fields: { on: { type: "boolean", label: "On", default: false } } })
assert.deepEqual(m.initial().fields, { on: false })
`,
  )
  run("node", ["dev.mjs"], app)

  /* 4. The production condition resolves the stub, which renders nothing. */
  writeFileSync(
    join(app, "prod.mjs"),
    `
import assert from "node:assert/strict"
import { ScenarioPanel, ScenarioProvider } from "prototype-machine"
assert.equal(ScenarioPanel({}), null, "production ScenarioPanel is the stub")
assert.equal(typeof ScenarioProvider, "function")
`,
  )
  run("node", ["--conditions=production", "prod.mjs"], app)

  /* 5. CommonJS. */
  writeFileSync(
    join(app, "cjs.cjs"),
    `
const assert = require("node:assert/strict")
const root = require("prototype-machine")
const core = require("prototype-machine/core")
assert.equal(root.ScenarioError, core.ScenarioError)
assert.equal(typeof require("prototype-machine/panel").ScenarioPanel, "function")
`,
  )
  run("node", ["cjs.cjs"], app)

  /* 6. The shipped types, in an app's own tsconfig. */
  writeFileSync(
    join(app, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        jsx: "react-jsx",
        module: "esnext",
        moduleResolution: "bundler",
        target: "es2020",
        lib: ["es2020", "dom"],
        skipLibCheck: false,
        types: [],
      },
      files: ["app.tsx"],
    }),
  )
  writeFileSync(
    join(app, "app.tsx"),
    `
import { defineMachine, ScenarioPanel, ScenarioProvider, useScenario } from "prototype-machine"

const scenario = defineMachine({
  machines: {
    data: { label: "Data", initial: "real", states: { real: {}, empty: { assign: { rows: 0 } } } },
  },
  fields: { seats: { type: "number", label: "Seats", default: 3, min: 0, max: 10, control: "range" } },
})

function Screen() {
  const p = useScenario(scenario)
  const state: "real" | "empty" = p.data
  const seats: number = p.seats
  // @ts-expect-error: not a state of the machine
  p.go("data", "loading")
  return <p>{state} {seats}</p>
}

export function Root() {
  return (
    <ScenarioProvider machine={scenario} storageKey="pack-test-v1">
      <Screen />
      <ScenarioPanel />
    </ScenarioProvider>
  )
}
`,
  )
  run("node", [join(pkgDir, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"], app)

  console.log(`pack-test ok: ${packed.filename}, ${files.length} files, ${(packed.size / 1024).toFixed(0)} kB packed`)
} catch (error) {
  const out = [error.stdout, error.stderr].filter(Boolean).join("\n")
  fail(`${error.message}${out ? `\n${out}` : ""}`)
} finally {
  if (!keep) rmSync(work, { recursive: true, force: true })
}
