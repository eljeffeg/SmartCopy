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
