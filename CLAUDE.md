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

There is no linter or type checker in this project. Two separate automated
checks exist, and they catch different things - run the one that matches
what you're verifying, or `npm run test:all` for both:

```
npm test              # or: npm run lint / npm run check (same thing) - syntax only, ~1s
npm run test:regression   # tests/*.js - real behavior, ~10s
npm run test:all      # both, in that order
```

**`npm test` is syntax validation only:**

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

**Run `npm test` before reporting any code change or QA step as complete**,
and `npm run test:regression` too whenever `tests/` has coverage touching
what changed (or after adding new coverage for it - see "The `tests/`
regression suite" below). `npm test` alone won't catch logic bugs, but it
will catch a broken commit before it ships.

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

The `tests/` regression suite (below) covers the first and third of these for
whatever it has coverage of - it does NOT cover the second. Don't claim
something "works" based on syntax validation OR the regression suite alone
when it hasn't been checked against a real site/live session - report it as
Unverified (see "Reporting QA/completion status" below) either way.

## The `tests/` regression suite

`npm run test:regression` (`scripts/run-tests.js`) runs every `tests/test_*.js`
file and reports pass/fail per file, aggregated at the end - same "report
every failure, not just the first" convention as `check-syntax.js`. Each test
file is a standalone Node script using a plain hand-rolled assertion pattern
(`assertEqual`/`assertTrue` printing `PASS:`/`FAIL:` per check, `process.exit`
non-zero on any failure) - no test framework dependency beyond `jsdom`
(`devDependencies`), consistent with this project's "no build step" stance.

**These are never reimplementations - every test extracts the REAL function(s)
under test verbatim from the actual source file** (via a brace-counting
`extractFunction()` helper feeding `new Function(...)`, or for anything that
needs real DOM/jQuery behavior, by loading a real `jsdom` window and `eval`-ing
the actual project files into it exactly like `popup.html` does, then calling
the real top-level function directly). A synthetic reimplementation of the
logic being tested only proves the reimplementation is self-consistent, not
that the real code works - this repo's own history has a concrete example of
exactly that gap: two prior rounds of "fixes" for #287 were verified only by
re-reading the source and were both still broken live, until a genuine jsdom
reproduction was built first and caught two real bugs neither prior round had
found. Several tests go further and assert against a real saved page from the
actual source site (`tests/fixtures/*.html` - MyHeritage census/marriage/
obituary pages saved by a live user, not fabricated) rather than synthetic
HTML, for exactly the same reason.

**When fixing a bug or adding behavior that's more than a one-line change,
add or extend a test here** rather than only verifying by hand in this
session - a synthetic/jsdom verification you ran once and discarded protects
nothing the next time this code changes. Follow the existing files' pattern:
name it `test_<issue-or-topic>.js`, open with a comment explaining what real
bug/behavior it verifies and why (not just what it does), extract the real
function(s) rather than reimplementing them, and cover both the reported
case and at least one adjacent case that should NOT trigger the same
behavior (the "safety" side, not just the "it works" side).

This suite is intentionally excluded from the release zip
(`.gitattributes` `export-ignore`, alongside `scripts/`) - it's dev-only,
never loaded by the extension at runtime.

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

- **Scraped blank:** stays unchecked/disabled, full stop - regardless of
  whether Geni has real data there or is also blank. (#304 follow-up,
  live-reported, DanCornett: there used to be a "scraped blank + Geni also
  blank -> start checked, nothing to protect, saves a click before typing"
  exception - explicitly removed on Dan's confirmation that a blank source
  field should never be pre-selected under any circumstance. The small
  convenience cost - an extra click before typing into a genuinely new,
  blank-on-both-sides field - is intentionally accepted in exchange.) Still
  manually overridable (an explicit, deliberate action), just never
  pre-checked into it. **One deliberate exception: family-member Vital
  (Living/Deceased) for a brand-new "Add Profile" candidate.** Vital always
  holds a real true/false value even when merely defaulted at render (there's
  no third "unknown" state the way Gender has one) - `refreshLivingCheckState()`'s
  `data-scraped` flag exists to stop that synthetic default from silently
  overriding an already-MATCHED person's real Geni value, but for a new add
  there's no existing Geni value to protect at all. Blanking it out anyway
  (once the stricter blank rule shipped) meant `is_alive` could go entirely
  unsubmitted on a new profile, and Geni's own server-side Auto-privacy logic
  (see `buildPrivacySelect()`'s own comment) can default an unspecified
  profile to Private - live-reported by DanCornett as a real, unacceptable
  risk. `refreshLivingCheckState()` takes an `isNewAdd` argument
  (`profile === "add"`) that bypasses the `data-scraped` gate specifically
  for this case, while leaving the MATCHED-person protection unchanged.
- **Scraped has data, and Geni's real value is known but different:**
  checked/enabled, same as always - **except a date that's genuinely LESS
  specific than Geni's existing one never pre-selects**, even though it's
  technically "different." Live-reported directly by the user: a source
  giving only "November 1963" or "1963" was pre-selecting over Geni's
  existing full "November 13, 1963", which would have overwritten a more
  precise date with a vaguer one. `isDateSpecificityDowngrade()` (popup.js)
  ranks day+month+year > month+year > year-only and suppresses
  pre-selection only for a strict downgrade - equal or better specificity
  still pre-selects even when the value differs (confirmed with the user:
  a genuine conflict at the same granularity, e.g. Geni's year 1963 vs. a
  scraped 1965, should still surface for review, not be silently hidden).
  Deliberately kept separate from `datesAreEquivalent()` itself (used by
  `parseForm()`'s submit-time no-op check, where a specificity downgrade is
  still a real, submittable difference) - folded into
  `valuesAreEquivalentForFieldType()`'s own `"date"` branch instead (a
  consolidation fix: originally only computed inline inside
  `isCheckedDateField()`/`isEnabledDateField()`, which meant a family
  member's date field re-resyncing against a *different* match's value
  after the Action dropdown changed - `applyProtectedDisabledState()`,
  which also routes through `valuesAreEquivalentForFieldType()` - never
  got this same protection). Scoped to dates only for now; the same blind
  spot technically exists for
  names/locations too (a shorter/less-complete scraped value can still
  pre-select over a fuller existing one) but has no clean, unambiguous
  hierarchy the way day/month/year does - treated as a separate follow-up
  rather than guessing at a generalized "completeness" heuristic.
- **Scraped has data, and it's meaningfully identical to Geni's real value**
  (#304 - case-insensitive, whitespace-collapsed; "Circa"/"About" ignored for
  dates, but Before/After/Between kept strict; nicknames use containment,
  not exact string equality): stays unchecked/disabled too - there's nothing
  actually different to submit, so it shouldn't light up green. This only
  applies once a real Geni value is knowable (a confirmed match) -
  `valuesAreEquivalentForFieldType()` in `buildform.js` is the per-field-type
  dispatch (generic/date/nicknames; Photo is excluded entirely - purely
  additive, "already has this" is never a reason to skip). About is also
  additive (submission prepends, never overwrites) so it's never "protected"
  the way an overwriting field is, but it does stop pre-selecting once the
  exact scraped text is already present somewhere in Geni's existing About -
  `isAboutContentPresent()` (popup.js), the same containment check the
  submit-time merge already uses to dedupe, reused here for the
  pre-selection decision too. A genuinely new About addition still
  pre-selects even alongside content it's additive with. Family Gender
  and Living use the plain generic comparator too, same as any other field -
  their scraped and Geni values are already the same raw vocabulary
  (male/female/unknown; true/false). The FOCUS profile's Gender/Living never
  reach this dispatch at all - they resolve via their own separate bespoke
  branching instead (live-reported, DanCornett, #304 follow-up: this was
  originally mis-scoped to exclude family Gender/Living too, on the mistaken
  assumption they shared that same bespoke path - they don't, so they never
  un-checked even when identical to Geni until this was corrected).

**Checking a box must only ever be the result of an explicit user action** -
an individual field checkbox, or a person's "select all" button - never a
side effect of picking an action from the "Add Profile / Update: existing
person" dropdown, or of any other field changing. A collapsed/hidden row
should never end up with real fields silently queued for submission while
its own top-level checkbox still shows unchecked with no visible sign
anything would happen. `refreshFieldCheckState()`/`applySelectAllState()` in
`buildform.js` only ever toggle `disabled`, never `checked`, for exactly this
reason - re-syncing field state when the action dropdown or Vital status
changes is fine, auto-checking as a side effect of that is not.

**The per-person top-level checkbox (`.checkslide`) has two distinct
meanings, and the code must not confuse them** (design clarified directly by
DanCornett on #304): it's an **indicator** the rest of the time (auto-reflects
whether any field underneath is checked, via a plain `.prop('checked', true)`
whenever an individual field/location gets checked - never fires
`.checkslide`'s own click handler, so this never cascades into a real
select-all), and a **shortcut** only at the moment the user actually clicks
it (checks/unchecks every eligible field for that person). These must not be
conflated: `data-select-all-active` on the `.checkslide` element tracks which
one is currently true - set to `"true"` only inside `.checkslide`'s own click
handler (an explicit click), and cleared back to `"false"` by any more
granular action (an individual `.checknext` click, or a location's own
`.geotopcheck` click) - the moment the user makes a per-field choice, the
blanket "select everything" intent no longer applies. `setGeniFamilyData()`'s
resync (replaying `applySelectAllState()` on a match/dropdown change to
re-widen what's eligible) only fires when this flag reads `"true"`, not
merely because `.checkslide` happens to be checked right now. (Live-reported,
DanCornett, #304 follow-up: before this flag existed, checking a single
field auto-ticked the indicator, and a later match/dropdown change would
then force-check every OTHER non-blank field for that person too - well
beyond what the user actually asked for.)

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
already has as 1821, or a Privacy value Geni already has). This is the final
safety net regardless of anything above - even a field the pre-selection
logic gets wrong can never actually submit a genuine no-op.

**`isFieldSelectable(scrapedValue, currentValue, fieldType)` (`buildform.js`)
is the one shared answer to "would this field actually contribute something
new over what Geni already has"** - added during a consolidation pass after
the same question got re-derived independently in multiple places and drifted
out of sync more than once (the two `applySelectAllState()` filters below,
`refreshPrivacySelect()`, Gender's exclusion from Select All). A blank
scraped value is never selectable; a blank `currentValue` (nothing to
compare against) is always selectable if the scraped side has data;
otherwise only a genuine difference (via `valuesAreEquivalentForFieldType()`)
is selectable. `applyProtectedDisabledState()` and `isFieldEmptyForCheckAll()`
(popup.js) both defer to this now instead of each independently computing
blank-checks and equivalence themselves - if a third place ever needs this
same question, call `isFieldSelectable()` rather than writing another copy.

`isFieldEmptyForCheckAll()` (popup.js) - "select all"'s own independent
protection - mirrors the same #304 comparison for exactly this reason: a
field non-blank but identical to Geni (not just blank-vs-Geni-has-data) is
also excluded from what "select all" force-checks. Without this, turning
"select all" on for a person would immediately re-check every field the new
comparison-aware logic had just correctly un-checked, the next time a
match/action change re-runs the resync (`setGeniFamilyData()` ->
`applySelectAllState()`). It also excludes a blank scraped field from
"select all" unconditionally, matching `resolveFieldEnabled()`'s own "never
pre-select blank, regardless of Geni's side" rule - it used to include a
blank-scraped field whenever Geni's own companion was ALSO blank ("nothing
to protect"), the same symmetric exception `resolveFieldEnabled()` had and
lost together (DanCornett, #304 follow-up: "a blank source field should
never be pre-selected under any circumstance"). Note: it still calls
`isFieldValueBlank()` for this blank-check first (not `isFieldSelectable()`'s
own generic blank-check) - that function knows each field's own blank
sentinel (Gender's `"unknown"` option; Living's `data-scraped` flag), a
DOM-shape concern `isFieldSelectable()` doesn't need to know about.

**`applySelectAllState()` (`buildform.js`) has two separate filters over the
same row set - one for checkboxes, one for the value fields themselves - and
both need to agree, or a field's checkbox and its own visible enabled/
disabled (green/grey) state can disagree.** Live-reported (DanCornett, #304
follow-up): the value-field filter used to run its own separate inline
blank-only check instead of calling `isFieldEmptyForCheckAll()` like the
checkbox filter does - two independent implementations of "is this field a
no-op" that drifted the moment one of them learned about `sameAsGeni` and
the other didn't. Symptom: a field's checkbox correctly un-checked itself,
but the field was then re-enabled (green) a moment later by the other
filter, because it only knew how to protect a genuinely blank field, not one
that just happened to already match Geni. Now both filters call the one
shared `isFieldEmptyForCheckAll()`. **A third, independent copy of this
exact same duplicated pattern already existed** - the `.checkall` handler
(popup.js; correction to an earlier note here - this is the per-*category*
header checkbox, Parents/Siblings/Partners/Children/Unknown, one per
category, **not** a single whole-form-wide control) had the identical
un-updated inline blank-only check. Found while auditing for exactly this
risk and fixed the same way. If a fourth place ever needs this same "is
this field a no-op" question, reuse `isFieldEmptyForCheckAll()` rather than
writing another copy - this codebase has now drifted on this exact
duplication twice.

**The indicator/shortcut duality (see the `.checkslide` entry above)
actually has THREE tiers, not two, and each needs the same two directions
kept working: individual field -> person (`.checkslide`) -> category
(`.checkall` header) -> and separately, the focus profile's own
`#updateprofile`, which has no person/category tiers above it at all.**
Live-reported, DanCornett, #304 follow-up: the existing cascade only ever
pushed a tier to checked reactively (on an individual field's check),
never recomputed it back down when the user unchecked the last thing still
selected underneath - so unchecking every field for a person (or manually
clearing a whole category) left that tier's box stuck showing "something
is selected" indefinitely. `syncTopLevelIndicators(clickedElement)`
(`buildform.js`) recomputes the relevant tier(s) **from scratch** after
every `.checknext`/`.geotopcheck` click, in whichever direction, based on
what's actually checked right now - not just cascading upward.
`syncPersonCheckboxWithPreCheckedFields()`'s own one-time initial-render
pass was extended the same way, so a category header correctly reflects
pre-checked people at first render too, not just after a later click.

A category-wide `.checkall` click is exactly as deliberate a "select
everything" action as clicking one person's own top-bar box - it now also
stamps `data-select-all-active="true"`/`"false"` on every `.checkslide` it
touches (popup.js), matching the same explicit-click semantics an
individual person's own click would set. Without this, a match/dropdown
change for one of those people afterward wouldn't recognize the category
click as genuine Select All intent (see `setGeniFamilyData()`'s resync gate
above) and would silently fail to re-widen what's eligible.

**`refreshPrivacySelect()`'s own "Select All means all" override had the
exact same indicator/shortcut conflation as `setGeniFamilyData()`'s resync
gate did before that was fixed** - it read `.checkslide`'s raw checked
state instead of `data-select-all-active`, so Privacy stayed force-enabled
any time the top box was ticked purely as an indicator from some unrelated
field (About, a genuinely different Birth Date, ...), even though Privacy
itself already matched Geni exactly and `buildPrivacySelect()` correctly
said so. This was the recurring "Privacy keeps pre-selecting" report Dan
saw across several different profiles - now gated on the same
`data-select-all-active === "true"` check.

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

**Release notes voice:** the audience is SmartCopy users - people with a
little technical fluency who care about how a release makes their genealogy
work easier, not the implementation. It is a different audience than a GitHub
issue comment or a commit message, which are written for whoever picks up
the code next and should stay as technical and precise as that requires -
don't flatten those down to this same voice.

- **Benefit first, every bullet.** Open with what changed for the user
  ("Adding a new wife now auto-fills her married surname"), not the
  mechanism ("getFocusSpouseSurname() now checks..."). If a bullet can't be
  rephrased to open with a concrete outcome, it likely belongs in a commit
  message instead of the release notes.
- **Cut verification narration from the body.** "(live-verified)",
  "confirmed via a 4-scenario Node harness," "traced synthetically," exact
  reproduction steps - none of this belongs in front of a user. It matters
  enormously in an issue comment or a commit message (that's how a
  dev/reviewer judges whether to trust a fix), but a release note is not
  that audience. State the fix and its benefit; leave the how-we-know-it-
  works out.
  - **One exception:** when the testing/QA process *itself* is the
    benefit being described - e.g. "this release went through a dedicated
    review pass that caught and fixed several bugs before they could reach
    a real submission" - that's a legitimate trust/reliability signal for
    a user and can stay. Keep it to that one framing, though: state that
    the review happened and what kind of confidence it buys, don't
    re-narrate each bug's technical root cause underneath it.
- **File each fix under the feature it affects, not a catch-all "bug
  fixes" dump.** A Privacy-checkbox fix reads as "this got better" next to
  the checkbox feature it's part of; lumped into a generic list of
  unrelated technical bugs, it reads as noise. Group by user-facing area
  first, chronology/PR-order a distant second.
- **Dev-process/tooling hardening (syntax checks, pre-commit hooks,
  packaging scripts, doc improvements) still belongs in the notes - don't
  cut it, give it its own "Behind the Scenes" section.** It's the same
  reliability signal as the QA-pass exception above (fewer broken commits
  reaching a release), just phrased as what it buys the user ("a broken
  file can no longer slip into a release") rather than the mechanism
  ("added scripts/check-syntax.js"). A prior pass at this over-corrected
  and deleted the section outright - don't repeat that; compress it, don't
  remove it.
- **Keep the issue number on every bullet that has one, as a bare `(#123)`
  - GitHub auto-links it.** That's where the nerdy stuff already lives (the
  root cause, the exact repro, how it was verified) via the issue's own
  comments - the release note doesn't need to duplicate any of that, it
  just needs to point there for whoever wants it.
- **Bold the main point of every bullet** - the short lead clause stating
  the outcome (e.g. "**Import a whole new family in fewer clicks**"),
  normal weight for the elaboration that follows. Lets someone scan the
  whole release in bold-only and still get the gist.
- **Impersonal and imperative, not conversational.** No "you"/"your," no
  rhetorical questions ("Adding a new wife with no scraped last name?").
  State the outcome as a fact or an instruction, third person, the way a
  changelog reads rather than the way a support article talks to someone:
  "Protect existing Geni data from accidental overwrite" or "Ensure
  current Geni fields are never accidentally cleared," not "Your existing
  Geni data is safer by default" or "Adding a new wife...?" This keeps
  bullets terse and prevents an actual benefit from getting buried under
  chatty framing.
- **Concrete over vague - state specifically what changes or stays safe.**
  "Safer by default" and "better experience" don't say what's actually
  different; "Protect existing Geni data from accidental overwrite" earns
  its claim right in the sentence (blank scraped fields stay unchecked
  whenever Geni already has real data there). If a bolded lead could
  describe two unrelated fixes equally well, it's too vague - tighten it
  until it only fits the one change it's naming. Good opening verbs to
  reach for: Ensure, Protect, Prevent, Auto-fill, Skip, Default, Reduce,
  Fix.
- This is benefit-focused release copy for a genealogy hobbyist audience,
  not a dry technical log entry and not marketing copy either - impersonal
  and imperative per the rule above, but still written around what
  changed for someone doing genealogy work, not compressed into changelog
  shorthand. If a rewrite starts reading like a git log one-liner, it's
  gone too far in the terse direction; loosen it back toward a plain
  sentence a non-engineer would still find natural.
- **Before publishing, audit for completeness**: `git log <prev-tag>..HEAD
  --format="%B" | grep -oE '#[0-9]+' | sort -u` against the actual release
  range, then check every number found appears somewhere in the notes.
  Expect some false positives (a numbered list item inside a commit
  message, a reference to an older/already-shipped issue given as
  context, this very file's own example text) - verify each with `git log
  --format="%B" | grep -B3 '#N\b'` before concluding it's really missing,
  don't just add every number the grep turns up.

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
