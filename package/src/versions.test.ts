import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const pkgDir = join(__dirname, "..")

describe("release bookkeeping", () => {
  it("every doc targets the version in package.json", () => {
    expect(() =>
      execFileSync("node", [join(pkgDir, "scripts/sync-version.mjs"), "--check"], { stdio: "pipe" }),
    ).not.toThrow()
  })

  it("the changelog has an entry for this version", () => {
    const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"))
    const changelog = readFileSync(join(pkgDir, "CHANGELOG.md"), "utf8")
    expect(changelog).toContain(`\n## ${version}\n`)
  })
})
