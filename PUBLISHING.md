# Publishing to npm

prototype-machine is **not on npm yet**. It will be published later. This file is the
note, and the checklist for that day.

## Current state

- Version 0.11.0, not published.
- When 0.11.0 was prepared, `npm view prototype-machine` returned 404, so the name was
  free.
- Install today: a tarball built from this repo. The README's Quick start has the steps.
- `package/package.json` is ready to publish: `files`, the `exports` map with its
  `production` condition, `prepublishOnly` (tests, typecheck, build) and `prepack` (copies
  the root README into `package/`).

## Before the first publish

1. Check that the name is still free: `npm view prototype-machine`. A 404 means free. If
   it is taken, use a scoped name such as `@dneath/prototype-machine`, and change every
   import in the docs.
2. Choose the version: 0.11.0 as it is, or 1.0.0 if the API is stable.
3. Sign in with an account that has two-factor authentication: `npm login`.
4. Do a dry run: `cd package && npm publish --dry-run`. The file list must contain only
   `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md` and `package.json`.
5. Publish: `npm publish`. Add `--access public` for a scoped name.
6. Tag the commit: `git tag v0.11.0 && git push origin v0.11.0`.

## After the first publish

- README: remove the Status note, and change step 0 of the Quick start to
  `npm install --save-exact prototype-machine -D`.
- SKILL.md, Setup check: make the same change.
- Keep this file as the release checklist, or delete it.
