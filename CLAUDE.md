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

## MV3 service worker guardrails

Chrome's MV3 service worker (`background.js`) is ephemeral - it terminates
after idle periods and restarts on the next event. These guardrails are
already correctly followed by the existing code; keep following them for
anything new added to `background.js`, verified against the current file
rather than asserted:

- **No persistent state in module-level variables.** `background.js` has
  none today - its two module-level vars (`sandboxIframeReady`, `creating`,
  both in the offscreen-document setup) are lazy, self-healing caches that
  regenerate fine if wiped by a restart, not session/token state. The real
  example of "durable state" in this extension - `accountinfo` (the Geni
  access token) - correctly lives in `chrome.storage.local`, written from
  `popup.js`. Follow that pattern for anything that needs to survive a
  restart or be shared across contexts; don't cache it in a `background.js`
  variable.
- **Register every top-level listener synchronously, at the root of the
  file** (not inside a callback or conditional) - `chrome.runtime.onMessage`,
  `onInstalled`, `onStartup`, `chrome.tabs.onActivated`/`onUpdated` all
  already are. A listener registered inside an async callback can miss
  events that arrive while the worker is waking up.
- **Return `true` from an `onMessage` listener whenever a response will be
  sent asynchronously** via the `callback`/`sendResponse` parameter -
  otherwise Chrome closes the message channel before the async work
  finishes. The existing `xhttp`/`eval` handler already does this
  correctly; match it for any new message action.
- **Host permissions are required for background fetches to a domain**,
  separately from that domain appearing in a content script's `matches` -
  confirmed directly by #202 (MyHeritage's `cf.mhcache.com` fetches failed
  until added to `host_permissions`, even though `myheritage.com` itself was
  already covered). Adding a new source site's parser means adding its
  domain(s) to `host_permissions` too, not just `collections/*.js` and
  `content_scripts`/`SUPPORTED_SITE_HOSTS`.
- **Match the existing callback-style `chrome.*` API convention** -
  `chrome.storage.local.get/set`, `chrome.tabs.query/get`,
  `chrome.action.setIcon`/`setBadgeText` are all called with callbacks
  throughout this codebase (one pre-existing exception:
  `await chrome.tabs.query()` in `popup.js`'s `getTabId()`). This isn't
  because Firefox can't handle promises - the manifest already requires
  Firefox 140+, which supports promise-based WebExtension APIs fine - it's
  just internal consistency. Match whichever style the surrounding code
  already uses rather than mixing styles in the same file.

None of this is automatically checked - `npm test` only validates syntax, not
service-worker lifecycle correctness. If a change relies on background state
surviving across events, that's exactly the kind of thing to flag as
Unverified and worth a live reload-and-retest rather than assuming it's fine.

## Verification & Testing Commands

There is no linter, type checker, or test framework in this project -
`package.json` has no other tooling beyond what's described here. The one
automated check available is **syntax validation**:

```
npm test        # or: npm run lint / npm run check (same thing)
```

This runs `scripts/check-syntax.js`, which calls `node --check` once per
project `.js` file and reports every failure, not just the first one. Note:
`node --check file1.js file2.js` silently only checks `file1.js` - passing
multiple files to a single `node --check` invocation does **not** check them
all, which is why this project uses a script instead of a raw shell one-liner.

Vendored third-party files are excluded from checking (never hand-edited, so
checking them adds noise, not coverage) - both by exact name (`jquery.js`,
`moment.js`) and by pattern (`*.min.js`, `*-min.js`, `*.bundle.js`), so a
future vendored addition following a normal minified-file naming convention
is excluded automatically rather than needing a manual list update. See
`EXCLUDED_FILENAMES`/`EXCLUDED_FILE_PATTERNS` in `scripts/check-syntax.js`.

**Run `npm test` before reporting any code change or QA step as complete.**
It won't catch logic bugs, but it will catch a broken commit before it ships -
which has real value given there's no other automated safety net here.

A pre-commit hook (`scripts/pre-commit`, installed to `.git/hooks/pre-commit`
via `npm install`'s `prepare` script, or directly via
`node scripts/install-git-hooks.js`) runs the syntax check automatically
before every commit and blocks the commit on failure. It checks only
**staged** `.js` files (`node scripts/check-syntax.js --staged`), not the
whole project, so it stays fast as the codebase grows - safe to scope this
way because it's a pure per-file syntax check with no cross-file awareness,
unlike a type-checker or test suite. `npm test` itself (no flag) always
checks everything; run it directly for full-project confidence rather than
relying on the hook alone. Bypass the hook with `git commit --no-verify` if
you genuinely need to.

**On a fresh clone, or a fresh environment (a new Claude Code session working
in a directory that hasn't run this before), the hook is NOT active yet** -
`.git/hooks/` is never tracked by git, so a plain `git clone` does not bring
it along. Run `npm install` (or directly `node scripts/install-git-hooks.js`
if you don't want to trigger a full install) once before relying on the
pre-commit hook to catch anything. Check installation status with:

```
test -f .git/hooks/pre-commit && echo "Hook active" || echo "Hook missing - run npm install"
```

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

## URL/hostname matching guardrail

Never match a hostname with a bare substring or suffix check
(`url.includes("geni.com")`, `hostname.endsWith("geni.com")`) - both accept
spoofing hosts that merely contain the string, e.g. `evilgeni.com` genuinely
does end with the literal characters `"geni.com"`. This was a real bug caught
during a QA audit of the #113 fix, and the *first* attempted fix for it
(`hostname.endsWith(".geni.com")` alone, without also checking the exact-match
case) still had a related gap. Always parse the URL (`new URL(url).hostname`)
and check `hostname === host || hostname.endsWith("." + host)` - exact match
or a proper dot-delimited subdomain, never a raw suffix. This exact pattern is
already factored out as `isSubdomainOf()` in `background.js` - reuse it (or
its logic if working in a file that can't reach it) rather than writing a new
inline check.

## Family-member checkbox pre-selection rules

When deciding whether a field/checkbox in the "add family member" or "update
profile" forms should start checked, compare the freshly-scraped value
against what Geni currently has for that field, not just whether the scraped
value is non-empty:

- **Scraped blank, Geni has real data:** stays unchecked/disabled - protects
  existing data from being blanked. Still manually overridable (an explicit,
  deliberate "clear this field" action), just never pre-checked into it.
- **Scraped blank, Geni also blank:** starts checked/enabled - nothing to
  protect, saves a click before typing.
- **Scraped has data:** checked/enabled as before, regardless of Geni's side.

**Checking a box must only ever be the result of an explicit user action** -
an individual field checkbox, or a person's "select all" button - never a
side effect of picking an action from the "Add Profile / Update: existing
person" dropdown, or of any other field changing. A collapsed/hidden row
should never end up with real fields silently queued for submission while
its own top-level checkbox still shows unchecked with no visible sign
anything would happen. `refreshFieldCheckState()`/`applySelectAllState()` in
`buildform.js` only ever toggle `disabled`, never `checked`, for exactly this
reason - re-syncing field state when the action dropdown or Vital status
changes is fine, auto-checking as a side effect of that is not. If "select
all" is already checked for a person, a dropdown/status change re-applies
`applySelectAllState()` to keep everything in sync (previously the only way
to force this was manually unchecking then rechecking "select all").

**Read Geni's comparison value from the row's own `.genislideinput` field,
not from the checkbox/input's current `disabled` attribute** - `disabled`
gets toggled by these same handlers on every check/uncheck cycle and goes
stale the moment "select all" is unchecked once, even for a field that was
correctly deemed safe moments earlier. `isFieldEmptyForCheckAll()` (popup.js)
and its "select all" companions were a real bug here before this was fixed.

**A checkbox being checked does not mean the value gets submitted.**
`parseForm()` (popup.js) independently excludes any field whose value is
identical to what Geni already has, checked or not - covers the blank-to-
blank case above, and also a checked field whose non-blank value happens to
already match Geni (e.g. a birth year of 1821 landing on a profile Geni
already has as 1821, or a Privacy value Geni already has). This is what lets
"select all" stay simple (always checks everything it safely can, no
no-op-skipping logic in the UI itself) without submitting a pointless update
or logging a false "(updated: ...)" reference-note category.

**Category-level "add all parents/siblings/children/partners" and each
individual member's own auto-select both fire when Geni has zero existing
members of that category at all** (`geniHasAnyOfCategory()`), independent of
the source's own SmartMatch relevance signal (`scorefactors`) - a
deterministic signal, since there's nothing on Geni to conflict with. The
per-member SmartMatch signal still separately drives auto-select when Geni
already has *some* (but not all) of a category - e.g. one parent present,
the other missing.

## Background service worker centralization

`background.js` is the one place that sees every outbound request this
extension makes (Geni API calls, source-site fetches, image resolution - all
of it funnels through its shared `xhttp` message handler) and every tab
navigation event (`tabs.onActivated`/`tabs.onUpdated`). When a need calls for
inspecting or reacting to *any* request/response globally - an auth-failure
interceptor (`checkGeniAuthStatus()`, #113), a site-detection badge
(`isSupportedSite()`, #55) - implement it centrally in `background.js` rather
than adding checks at each individual call site in `popup.js`/`content.js`/
the `collections/*.js` parsers. There are dozens of call sites and multiple
JS worlds involved; a central check in the one place that already sees
everything is far less likely to be missed or drift out of sync than the same
logic copy-pasted per caller.

## Reporting QA/completion status

When reporting a fix or change as complete, explicitly categorize it:
- **Verified** - actually tested against the live site/API (by you, or
  confirmed by the user pasting real results), not just "should work."
- **Unverified** - validated only via syntax check and/or synthetic/mocked
  tests, because live testing wasn't possible (e.g. Geni's bot-check blocks
  browser automation in this environment, or the failure mode can't be forced
  on demand, like an expired auth token).

Don't blur these into one undifferentiated "done." If something is
Unverified, say so plainly and give a concrete, human-executable manual QA
checklist (exact steps, preconditions, expected result) rather than letting
"the code looks right" stand in for confirmation it actually behaves right.

## Release process

This project has no separate "dist" build step - the working tree at a given
commit/tag *is* the shipped extension, modulo a short dev-only exclusion
list. Releases go directly to `master` (no feature branches, no PRs - this
has been the workflow throughout, not a one-off shortcut).

**Tagging:** version releases use an annotated tag (`v<version>`, matching
`manifest.json`'s `version` field). Moving a tag forward to a later commit
(common while a release is still being iterated on pre-launch) requires
delete + recreate + force-push, not `git tag -f` alone reaching the remote:

```
git tag -d v<version>
git tag -a v<version> <commit> -m "v<version>"
git push origin v<version> --force
```

**Known gotcha:** deleting and recreating a tag for an *existing* GitHub
Release can orphan it into Draft state (losing its Pre-release/Latest
designation) - `gh release list` will show it as plain "Draft" afterward.
Fix immediately with `gh release edit <tag> --tag <tag> --draft=false
[--latest|--prerelease]` (must pass `--tag` again explicitly). Always check
`gh release list` right after moving a tag to catch this.

**Release notes:** `gh release edit <tag> --notes-file <file>` - GitHub's API
cannot backdate `published_at`, so for a not-yet-shipped version the notes
body should say `**Released:** TBD`, never a specific date, until it's
actually live in the Chrome/Firefox stores.

**Building the release zip:**

```
node scripts/build-release-zip.js [ref]     # defaults to HEAD
```

Wraps `git archive --format=zip`, which excludes dev-only files via
`export-ignore` entries in `.gitattributes` (currently: `.gitattributes`
itself, `.gitignore`, `CLAUDE.md`, `package.json`, `scripts/`) - add new
dev-only paths there, not as custom exclusion logic in the script. Output is
named from `manifest.json`'s version automatically
(`smartcopy-<version>.zip`). **Only one zip, not separate Chrome/Firefox
builds** - the same source tree loads as both an unpacked Chrome extension
and a temporary Firefox add-on. Before trusting a freshly-built zip, spot
check with `unzip -l` that dev-only files are actually absent and that
files loaded at runtime via a bare relative path rather than referenced in
`manifest.json` (e.g. `location-test.txt`, fetched by `buildform.js` via
`$.get('location-test.txt', ...)`) are still present - a change to the
exclusion list could plausibly catch one of these by accident.

**This script only builds a local zip file. It does not upload or attach
anything, and building a zip is not itself confirmation the release is
ready.** Attaching an asset (`gh release upload <tag> <zip>`) and flipping a
release from Pre-release to Latest are both real publish actions - always
confirm explicitly with the user before either, the same as any other
"publish/make public" action. Don't treat "I built the zip" as license to
proceed to uploading or flipping status without that confirmation.

## Software Engineering Design Principles (apply to all planning, prompts, and reviews)

**Scaling caveat, added for this project specifically (not part of the
canonical text below):** apply these in spirit, scaled to SmartCopy's actual
size and shape - a single-developer, unbundled, no-build-step browser
extension with no telemetry pipeline and no regulatory footprint. A few of
the principles below describe infrastructure this project doesn't have and
almost certainly shouldn't build just to satisfy the letter of the principle
- "Observable" calls for logs/metrics/traces "designed in from the start,"
and "Compliant" is about legal jurisdictions; neither maps onto a client-side
extension with a handful of users. Don't read either as license to bolt on a
metrics system or a compliance process nobody asked for. Everything else -
Modular, Reusable, Testable, Resilient, Correct, Nimble - maps directly onto
how this project already works and should keep being applied literally.

The principles themselves are canonical and verbatim - do not paraphrase,
compress, or reword them in future edits. A compressed derivative of these
principles lives in the Claude web project instructions; this file is the
canonical source.

Source: Nacho Solis, isolis/principles on GitHub (MIT) - adopted verbatim.
The repo's README carries the full argument and examples behind each
principle.

### Valuable

_Does it do something real for real people?_

**Useful.**
A correct system solving the wrong problem has failed.

**Intuitive.**
If users need training, redesign the feature.

**Consistent.**
Inconsistency is hidden complexity. Build so the first corner teaches all the others.

**Accessible.**
If it excludes anyone, that exclusion was a choice. Make it consciously or undo it.

**Operable.**
An interface that requires human interpretation to automate is broken by design. Surface limits before they become errors; everything else follows.

**Responsive.**
Loading, empty, and error states are always handled — never blank, never frozen.

### Simple

_Can it be understood and changed?_

**Modular.**
A change in one area does not require changes in unrelated areas. Hidden dependencies are hidden debt.

**Reusable.**
Don't build what already exists. Duplication is not inefficiency — it is future inconsistency.

**Evolvable.**
Breaking changes are a design decision, not an accident.

**Testable.**
Code you cannot test is code you cannot trust. Structure enables testing; the rest is hope.

### Efficient

_Can it be operated without heroics?_

**Nimble.**
Code is written for the next developer. A change that cannot be shipped quickly is a liability. A security fix that takes weeks to deploy is a vulnerability that stays open for weeks.

**Iterable.**
If adding capabilities requires rewriting what works, that's not iteration — it's rewriting in slow motion.

**Observable.**
Logs, metrics, and traces are designed in from the start — not added after a production incident. If you cannot tell what the system is doing in production, you do not know what the system is doing.

**Inexpensive.**
Same outcome, lower cost — always. Never optimize what you haven't measured.

### Trusted

_Can it be relied on?_

**Correct.**
A system that silently drops data when it promised not to is incorrect, even if mostly working. Make commitments explicit, measurable, and enforced.

**Resilient.**
Failure modes are designed, not discovered. The system degrades predictably — a failure in one component does not cascade. Errors are informative, not cryptic.

**Secure.**
Least privilege everywhere. The system fails closed, not open. Security is a requirement, not a feature.

**Private.**
Collect only what the system needs. Data never collected cannot be leaked. Data should expire, not accumulate.

**Compliant.**
Meet the legal requirements of every jurisdiction you operate in. Compliance discovered after launch is not compliance — it is damage control.
