// Fixes a confirmed, real defect found while investigating a #286 further
// follow-up report (live-reported, DanCornett, with a clean repro):
// repeating an empty scraped About submission twice in a row added TWO
// citations instead of the second one correctly refreshing the first in
// place - even though buildReferenceAboutMe() itself (tested directly in
// test_286_citation_freshness_and_source_scope.js) already handles a
// same-source repeat correctly when given accurate inputs.
//
// Directly confirmed by reading submitform()'s own source: focusabout -
// its in-memory cache of "what Geni's About currently holds" - was set
// exactly ONCE, from the initial Geni fetch when the popup opened, and
// never reassigned anywhere after a successful submission. Any later
// About-related action in the same session would read stale state - a
// real, unambiguous defect regardless of exactly how it manifests
// server-side (which depends on whether Geni's own about_me API replaces
// or appends, not something a local fix or simulation can observe).
// Fixed by syncing focusabout to whatever was actually just built, at
// all three call sites that touch it. NOT claimed as the complete,
// confirmed explanation for every detail for Dan's exact repro - that
// needs his live confirmation on the next build, per this project's own
// Verified-vs-Unverified reporting convention - but it's a genuine gap,
// worth fixing on its own merits either way.
//
// This test simulates the real caller sequence submitform() now follows -
// call buildFocusReferenceAboutMe(), and if it returns a real value, sync
// focusabout to it before the next call - and confirms it now matches
// what buildReferenceAboutMe() already does correctly when given accurate
// inputs directly.
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
const moment = require(path.join(ROOT, 'moment.js'));

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- Structural: submitform()'s own real source now syncs focusabout after each build ---
assertTrue(src.indexOf('if (exists(builtAboutMe)) {\n                    focusabout = builtAboutMe;\n                }') !== -1,
    "The main submission path now keeps focusabout in sync with whatever buildFocusReferenceAboutMe() actually built");
assertTrue(src.indexOf('focusabout = focusMarriageAboutMe;') !== -1,
    "The marriage-via-spouse deferred path keeps focusabout in sync too");
assertTrue(src.indexOf('profileout["about_me"] = focusabout + "\\n" + about;\n                focusabout = profileout["about_me"];') !== -1,
    "The sourcecheck-off concatenation path keeps focusabout in sync too, for the same reason");

// --- Behavioral: real buildReferenceAboutMe(), simulating the FIXED caller sequence ---
const isAboutContentPresent = new Function('exists', extractFunction(src, 'normalizeAboutForComparison') + '\n' + extractFunction(src, 'isAboutContentPresent') + '\nreturn isAboutContentPresent;')(exists);
const footnoteLabel = new Function('exists', 'return ' + extractFunction(src, 'footnoteLabel'))(exists);
const getLastAboutBlock = new Function('exists', 'return ' + extractFunction(src, 'getLastAboutBlock'))(exists);
const isLastLineFromSameSource = new Function('exists', 'return ' + extractFunction(src, 'isLastLineFromSameSource'))(exists);
const refreshLastCitationTimestamp = new Function('exists', 'moment',
    extractVarStatement(src, 'ABOUT_CITATION_TIMESTAMP_PATTERN') + '\nreturn ' + extractFunction(src, 'refreshLastCitationTimestamp') + ';')(exists, moment);
const buildReferenceAboutMe = new Function('exists', 'moment', 'isAboutContentPresent', 'footnoteLabel', 'getLastAboutBlock', 'isLastLineFromSameSource', 'refreshLastCitationTimestamp', 'recordtype',
    'return ' + extractFunction(src, 'buildReferenceAboutMe'))(exists, moment, isAboutContentPresent, footnoteLabel, getLastAboutBlock, isLastLineFromSameSource, refreshLastCitationTimestamp, 'FamilySearch Family Tree');

const refurl = "https://familysearch.org/tree/person/details/ABCD-123";

// The FIXED sequence: mirrors submitform()'s real code now - sync
// focusabout after each build, same as the actual popup.js fix does.
function simulateFixedSession(submissions) {
    var focusabout = "";
    var results = [];
    submissions.forEach(function (sub) {
        var built = buildReferenceAboutMe(sub.about, focusabout, refurl, sub.categories);
        if (exists(built)) {
            focusabout = built;
        }
        results.push(focusabout);
    });
    return results;
}

// Note: this file deliberately does NOT try to simulate the pre-fix
// "broken" sequence's exact resulting text - that would depend on
// whether Geni's own about_me API replaces or appends, which is outside
// what a local simulation can observe. What IS directly confirmed (see
// the structural assertions above, checked against the real source) is
// that focusabout was captured once and never reassigned anywhere in
// submitform() before this fix - a real, verifiable staleness defect
// regardless of exactly how it manifested server-side. The behavioral
// assertions below confirm the FIXED sequence now matches what
// buildReferenceAboutMe() already does correctly when given accurate
// input directly (test_286_citation_freshness_and_source_scope.js).

// Dan's exact repro: two back-to-back empty-About submissions, same source, same category.
var submissions = [
    { about: "", categories: ["about"] },
    { about: "", categories: ["about"] }
];

var fixedResults = simulateFixedSession(submissions);
assertEqual((fixedResults[1].match(/\* '''\[/g) || []).length, 1,
    "#286 fix: two back-to-back empty-About submissions in one session now correctly produce exactly ONE citation, not two");

// A third repeat in the same session still stays at one citation, not three.
var threeSubmissions = submissions.concat([{ about: "", categories: ["about"] }]);
var fixedThree = simulateFixedSession(threeSubmissions);
assertEqual((fixedThree[2].match(/\* '''\[/g) || []).length, 1,
    "#286 fix: a third repeat in the same session still correctly stays at exactly one citation");

// Genuinely new content in a later submission within the same session still gets included correctly
// - and correctly earns its OWN new citation (the bare empty-check citation before it documented a
// different, real thing - no content - so this isn't the same-source-same-category repeat case at all).
var mixedSubmissions = [
    { about: "", categories: ["about"] },
    { about: "Test\n", categories: ["about"] }
];
var fixedMixed = simulateFixedSession(mixedSubmissions);
assertTrue(fixedMixed[1].indexOf("Test") !== -1,
    "#286 fix: genuinely new content submitted later in the same session is still correctly included, not lost");
assertEqual((fixedMixed[1].match(/\* '''\[/g) || []).length, 2,
    "#286 fix: real new content correctly gets its own second citation on top of the earlier bare one - accurate focusabout tracking doesn't suppress genuinely different submissions, only true repeats");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
