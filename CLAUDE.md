# SmartCopy

A Chrome/Firefox extension (Manifest V3) that copies genealogy profile data from
various source sites (FindAGrave, FamilySearch, WikiTree, MyHeritage, Ancestry,
Filae, Geneanet, YadVashem, Toldot, BeZikaron, GraveZ) into Geni.com.

Plain, unbundled vanilla JS - no build step, no bundler, no TypeScript. Content
scripts and the popup share a bundled `jquery.js`; `background.js` is a
Manifest V3 service worker (Chrome) / event page (Firefox) and does **not**
load `jquery.js` or `shared.js` - anything it needs (helpers, polyfills like
`.contains()`) must be self-contained or use native equivalents (e.g.
`.includes()` instead of the `.contains()` polyfill from `shared.js`).

## Verification & Testing Commands

There is no linter, type checker, or test framework in this project -
`package.json` has no other tooling beyond what's described here. The one
automated check available is **syntax validation**:

```
npm test        # or: npm run lint / npm run check (same thing)
```

This runs `scripts/check-syntax.js`, which calls `node --check` once per
project `.js` file (excluding vendored libraries `jquery.js`,
`jquery.csv.min.js`, `moment.js`) and reports every failure, not just the
first one. Note: `node --check file1.js file2.js` silently only checks
`file1.js` - passing multiple files to a single `node --check` invocation
does **not** check them all, which is why this project uses a script instead
of a raw shell one-liner.

**Run `npm test` before reporting any code change or QA step as complete.**
It won't catch logic bugs, but it will catch a broken commit before it ships -
which has real value given there's no other automated safety net here.

A pre-commit hook (`scripts/pre-commit`, installed to `.git/hooks/pre-commit`
via `npm install`'s `prepare` script, or directly via
`node scripts/install-git-hooks.js`) runs `npm test` automatically before
every commit and blocks the commit on failure. Bypass with
`git commit --no-verify` if you genuinely need to.

**On a fresh clone, or a fresh environment (a new Claude Code session working
in a directory that hasn't run this before), the hook is NOT active yet** -
`.git/hooks/` is never tracked by git, so a plain `git clone` does not bring
it along. Run `npm install` (or directly `node scripts/install-git-hooks.js`
if you don't want to trigger a full install) once before relying on the
pre-commit hook to catch anything. Check `ls -la .git/hooks/pre-commit` if
unsure whether it's already installed in the current checkout.

## What `npm test` does NOT catch

Syntax validation only. It will not catch:
- Logic bugs, wrong selectors, incorrect matching conditions
- Whether a fix actually behaves correctly against live Geni/source-site pages
- Regressions in behavior that's syntactically valid but semantically wrong

For anything beyond syntax, prefer live verification (asking the user to test
against the real site) or a targeted synthetic test (extract the specific
function from the live file via regex/eval and run representative + adversarial
cases against it - this repo's recent history has examples of exactly that
approach for things like URL/hostname matching and family-member matching
logic). Don't claim something "works" based on syntax validation alone.
