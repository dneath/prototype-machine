# Publishing to npm

How prototype-machine gets to npm. Part 1 happens once. After that, every release is
Part 2: three commands and a push.

## Where things stand

- Version **0.12.0** is ready and not published yet.
- The name `prototype-machine` was free on npm on 2026-10-16. If it's taken by the time
  you publish, see "If the name is taken" at the bottom.
- `npm run check` (in `package/`) runs everything a release needs and passes:
  - tests and the typecheck
  - the build
  - two package linters, publint and Are the Types Wrong
  - an install of the packed package into a throwaway app, to make sure it works the
    way someone else's project will use it
- `npm publish` runs `npm run check` first, so a broken build can't go out.
- `.github/workflows/release.yml` publishes from GitHub when you push a version tag.
  It needs the one-time setup in Part 1, step 6.

## Part 1: the first publish (once)

npm only lets GitHub publish a package that already exists, so the first version
goes up from your computer.

1. **Make an npm account** at npmjs.com if you don't have one, and turn on two-factor
   authentication (Account → Two-Factor Authentication). npm requires it to publish.

2. **Get the latest code and install.**
   ```bash
   cd prototype-machine
   git checkout main && git pull
   cd package
   npm ci
   ```

3. **Sign in to npm.** This opens your browser.
   ```bash
   npm login
   ```

4. **Check what will be uploaded, without uploading it.**
   ```bash
   npm publish --dry-run
   ```
   It runs the full check (about a minute), then lists the files. You should see
   `dist/`, `reference/`, `README.md`, `SKILL.md`, `CHANGELOG.md`, `LICENSE` and
   `package.json`, and nothing else. `npm run test:pack` checks the same list on its own.

5. **Publish.**
   ```bash
   npm publish
   ```
   npm asks for a one-time code from your authenticator app. When it finishes, the
   package is live at npmjs.com/package/prototype-machine.

   Tag the release in git so the history shows what went out:
   ```bash
   git tag v0.12.0
   git push origin v0.12.0
   ```
   The release workflow will run on that tag and fail, because 0.12.0 is already on
   npm. That's expected this one time.

6. **Let GitHub publish from now on.** On npmjs.com, open the package → **Settings** →
   **Trusted Publisher** → **GitHub Actions**, and fill in:

   | Field | Value |
   | --- | --- |
   | Organization or user | `dneath` |
   | Repository | `prototype-machine` |
   | Workflow filename | `release.yml` |
   | Environment | leave empty |

   Then, under **Publishing access** on the same page, choose **Require two-factor
   authentication and disallow tokens**. GitHub doesn't need a token, so nothing
   with publish rights is stored anywhere.

7. **Check the workflows are on GitHub.** The repo needs `.github/workflows/ci.yml` and
   `.github/workflows/release.yml`. If they're missing, a push was refused because the
   access token couldn't change workflows. Add them on github.com with **Add file →
   Create new file**, pasting each file's contents.

## Part 2: every release after that

1. **Write the changelog entry.** In `package/CHANGELOG.md`, add a `## 0.13.0` section
   at the top saying what changed. A test fails if the version has no entry.

2. **Bump the version.** In `package/`:
   ```bash
   npm version minor --no-git-tag-version
   ```
   Use `patch` for fixes only (0.12.0 → 0.12.1), `minor` for new features
   (0.12.0 → 0.13.0), and `major` for changes that break existing configs. This also
   updates the version named in `SKILL.md` and `reference/`.

3. **Check, commit, tag, push.**
   ```bash
   npm run check
   git add -A
   git commit -m "Release 0.13.0"
   git tag v0.13.0
   git push origin main v0.13.0
   ```

4. **Watch it go.** The repo's **Actions** tab shows the Release run. When it's green,
   the new version is on npm with a provenance badge linking it to the commit.

A version with a hyphen (`0.13.0-beta.1`) publishes under the `next` tag, so
`npm install prototype-machine` keeps getting the last stable version until you
release one.

## If something goes wrong

- **The Release run fails at "Check the tag matches package.json".** The tag and the
  version in `package/package.json` differ. Delete the tag
  (`git tag -d v0.13.0 && git push origin :v0.13.0`), fix the version, and tag again.
- **It fails with E404 or "not authorized".** The trusted publisher on npmjs.com
  doesn't match: the workflow filename must be exactly `release.yml`, and the user
  and repo must match GitHub.
- **A bad version went out.** Don't unpublish it. Publish a fixed patch version, then
  mark the bad one: `npm deprecate prototype-machine@0.13.0 "Use 0.13.1"`.

## If the name is taken

Use a scoped name such as `@dneath/prototype-machine`:

1. Change `"name"` in `package/package.json`.
2. Replace every `from "prototype-machine"` and `npm install … prototype-machine` in
   `README.md`, `SKILL.md` and `reference/`.
3. Publishing works the same; `publishConfig.access` is already `"public"`, which a
   scoped package needs.

## Hosting the demo

`package/demo` is a Vite app that shows the panel with every kind of control. To give
it a public link, import the repo into Vercel or Netlify with:

| Setting | Value |
| --- | --- |
| Root directory | `package/demo` |
| Build command | `npm run build` |
| Output directory | `dist` |
