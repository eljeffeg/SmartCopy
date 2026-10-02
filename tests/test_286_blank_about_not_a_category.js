// Verifies the actual root cause behind #286's persistent "duplication of
// empty-scraped-About citations" report (live-reported, DanCornett - still
// happening after the focusabout staleness fix shipped earlier).
//
// About is "always pre-selected" (additive, never overwrites existing
// Geni data) and stays checked+submitted even when the scraped source has
// no bio text at all, as long as Geni's own About is also blank - this
// lets a user type something in manually without an extra click first
// (buildform.js's isChecked(about, scoreabout, ...) branch 3). That means
// a present-but-EMPTY about_me="" key reaches parseForm()'s output on
// every such submission, even when nothing about-related actually
// happened.
//
// summarizeUpdatedCategories() only ever excluded "profile_id" and
// "action" from the fields it scans - a blank about_me key still counted
// as a real "about" category every time. That fed two compounding
// symptoms: (1) buildReferenceAboutMe()'s own "did anything genuinely
// change" guard (`!contentIsNew && updatedCategories.length === 0`) could
// never trip, since "about" was always present, even on a pure re-run
// where truly nothing changed - a citation got added/refreshed every
// single time just because the key existed; (2) on a run where some OTHER
// real field also changed, the phantom "about" tag polluted the
// "(this update: ...)" text, which isLastLineFromSameSource() then has to
// text-match against on the next run - a mismatch there is exactly what
// causes a second, genuinely-duplicate citation block instead of a
// refreshed one.
//
// Dan's own diagnosis matches this: "the real issue is that an empty
// 'scraped' About is treated as [something happened]... if it is empty,
// [it should be] treated as being already accounted for." The minimal fix
// is at the source of the signal, not a rewrite of the dedup logic that
// already correctly handles everything else (getLastAboutBlock,
// isLastLineFromSameSource, refreshLastCitationTimestamp - all untouched,
// all still covered by test_286_citation_freshness_and_source_scope.js).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

function extractFunction(srcText, name) {
    const marker = 'function ' + name + '(';
    const start = srcText.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    let depth = 0, i = srcText.indexOf('{', start);
    for (; i < srcText.length; i++) {
        if (srcText[i] === '{') depth++;
        else if (srcText[i] === '}') { depth--; if (depth === 0) break; }
    }
    return srcText.slice(start, i + 1);
}
function extractVarStatement(srcText, name) {
    const marker = 'var ' + name + ' =';
    const start = srcText.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    const semi = srcText.indexOf(';', start);
    return srcText.slice(start, semi + 1);
}

function exists(v) { return typeof v !== "undefined" && v !== null; }
if (!String.prototype.contains) {
    String.prototype.contains = function () { return String.prototype.indexOf.apply(this, arguments) !== -1; };
}
const moment = require(path.join(ROOT, 'moment.js'));

const summarizeUpdatedCategories = new Function('exists', 'return ' + extractFunction(src, 'summarizeUpdatedCategories'))(exists);
const isAboutContentPresent = new Function('exists', extractFunction(src, 'normalizeAboutForComparison') + '\n' + extractFunction(src, 'isAboutContentPresent') + '\nreturn isAboutContentPresent;')(exists);
const footnoteLabel = new Function('exists', 'return ' + extractFunction(src, 'footnoteLabel'))(exists);
const getLastAboutBlock = new Function('exists', 'return ' + extractFunction(src, 'getLastAboutBlock'))(exists);
const isLastLineFromSameSource = new Function('exists', 'return ' + extractFunction(src, 'isLastLineFromSameSource'))(exists);
const refreshLastCitationTimestamp = new Function('exists', 'moment',
    extractVarStatement(src, 'ABOUT_CITATION_TIMESTAMP_PATTERN') + '\nreturn ' + extractFunction(src, 'refreshLastCitationTimestamp') + ';')(exists, moment);
const buildReferenceAboutMe = new Function('exists', 'moment', 'isAboutContentPresent', 'footnoteLabel', 'getLastAboutBlock', 'isLastLineFromSameSource', 'refreshLastCitationTimestamp', 'recordtype',
    'return ' + extractFunction(src, 'buildReferenceAboutMe'))(exists, moment, isAboutContentPresent, footnoteLabel, getLastAboutBlock, isLastLineFromSameSource, refreshLastCitationTimestamp, 'FamilySearch Family Tree');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// ============================================================
// summarizeUpdatedCategories() itself
// ============================================================
assertEqual(summarizeUpdatedCategories({ about_me: "" }, false, undefined).indexOf("about"), -1,
    "A present-but-blank about_me key is NOT counted as an 'about' category");
{
    var cats = summarizeUpdatedCategories({ about_me: "Some real bio text" }, false, undefined);
    assertTrue(cats.indexOf("about") !== -1, "Non-blank about_me IS still counted as an 'about' category - regression check");
}
{
    var cats = summarizeUpdatedCategories({ about_me: "", "birth:date": { year: "1900" } }, false, undefined);
    assertEqual(cats.length, 1, "A blank about_me alongside a genuinely different field only counts the real field");
    assertTrue(cats.indexOf("birth") !== -1, "...and that real field's category is still present");
    assertTrue(cats.indexOf("about") === -1, "...with no phantom 'about' tag alongside it");
}
assertEqual(summarizeUpdatedCategories({}, false, undefined).length, 0,
    "No fields at all (and no photo/marriage) -> no categories, same as before");

// ============================================================
// End-to-end via buildReferenceAboutMe(): the actual reported symptom
// ============================================================
var refurl = "http://example.com/person/1";

// --- Scenario: fresh popup reopen, submit with About pre-checked but
// blank (Geni's own About is also blank), nothing else genuinely
// different, repeated 3 times in a row - the exact repro shape Dan
// described ("re-activating the popup each time" to test the citation
// behavior). Before the fix: a citation got added on run 1 and "refreshed"
// on runs 2/3 purely because the phantom "about" category always matched
// itself - still arguably one bug (a citation should never have appeared
// at all for a genuine no-op), made worse whenever a real field changed
// between runs (see the next scenario). After the fix: updatedCategories
// is correctly empty every time, so buildReferenceAboutMe() returns
// undefined and about_me is never part of the submission at all.
{
    var categories = summarizeUpdatedCategories({ about_me: "" }, false, undefined);
    var result1 = buildReferenceAboutMe("", "", refurl, categories);
    assertEqual(result1, undefined,
        "Run 1, nothing genuinely changed (blank About, blank Geni About, no other fields): no citation is written at all");
}

// --- Scenario: a real field (birth date) changes between two fresh-reopen
// runs, About stays blank/pre-checked both times. Before the fix, run 1's
// citation text would read "(this update: about, birth)" - the phantom
// "about" tag riding along. After the fix it correctly reads
// "(this update: birth)" only, and a second run with the SAME real change
// correctly recognizes itself as a repeat (same source, same real
// category) and refreshes in place rather than piling up a duplicate.
{
    var categoriesRun1 = summarizeUpdatedCategories({ about_me: "", "birth:date": { year: "1900" } }, false, undefined);
    var afterRun1 = buildReferenceAboutMe("", "", refurl, categoriesRun1);
    assertTrue(exists(afterRun1) && afterRun1.indexOf("(this update: birth)") !== -1,
        "Run 1: the citation names only the real category that changed, no phantom 'about'");

    var categoriesRun2 = summarizeUpdatedCategories({ about_me: "", "birth:date": { year: "1900" } }, false, undefined);
    var afterRun2 = buildReferenceAboutMe("", afterRun1, refurl, categoriesRun2);
    var separatorCount = (afterRun2.match(/----/g) || []).length;
    assertEqual(separatorCount, 0,
        "Run 2 (same real category, same source, About still blank): refreshed in place - no second citation block created");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
