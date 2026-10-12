// Verifies a #286 follow-up (live-reported, DanCornett, 2026-10-12): when
// the "to-be-added" About is blank but Geni's existing About is NOT blank
// (a profile that's already been cited by this source before), repeating
// the exact same no-op submission wrote a brand-new duplicate citation on
// EVERY run instead of refreshing the existing one in place - the same
// "toggle"-adjacent symptom test_286_about_me_toggle_bug.js covers for
// genuinely new content, but for the blank-About case specifically.
//
// Root cause: both call sites that feed the scraped about_me into
// buildReferenceAboutMe() (popup.js's focus-profile submission block, and
// the family-member equivalent) padded a blank about_me with a bare "\n"
// UNCONDITIONALLY, before ever checking whether it was genuinely blank -
// buildReferenceAboutMe()'s OWN internal padding (further down in the same
// file) already guards this exact same append with `about !== ""`, for
// exactly this reason, but neither call site's copy had the same guard.
// A padded "\n" is non-blank, so buildReferenceAboutMe()'s own `contentIsNew`
// check (`about !== "" && ...`) read every blank About as "real new
// content," bypassing both the "nothing to do" early return AND the
// same-source refresh-in-place check - writing a fresh bare citation on
// every single repeat instead of recognizing the existing one.
//
// Uses the REAL buildReferenceAboutMe() (extracted verbatim, same
// convention as test_286_about_me_toggle_bug.js) with a small helper that
// mirrors the two call sites' own (now-fixed) padding logic exactly, not a
// reimplementation of the padding decision itself.
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

const isAboutContentPresent = new Function('exists', extractFunction(src, 'normalizeAboutForComparison') + '\n' + extractFunction(src, 'isAboutContentPresent') + '\nreturn isAboutContentPresent;')(exists);
const footnoteLabel = new Function('exists', 'return ' + extractFunction(src, 'footnoteLabel'))(exists);
const getLastAboutBlock = new Function('exists', 'return ' + extractFunction(src, 'getLastAboutBlock'))(exists);
const isLastLineFromSameSource = new Function('exists', 'return ' + extractFunction(src, 'isLastLineFromSameSource'))(exists);
const refreshLastCitationTimestamp = new Function('exists', 'moment',
    extractVarStatement(src, 'ABOUT_CITATION_TIMESTAMP_PATTERN') + '\nreturn ' + extractFunction(src, 'refreshLastCitationTimestamp') + ';')(exists, moment);
const buildReferenceAboutMe = new Function('exists', 'moment', 'isAboutContentPresent', 'footnoteLabel', 'getLastAboutBlock', 'isLastLineFromSameSource', 'refreshLastCitationTimestamp', 'recordtype',
    'return ' + extractFunction(src, 'buildReferenceAboutMe'))(exists, moment, isAboutContentPresent, footnoteLabel, getLastAboutBlock, isLastLineFromSameSource, refreshLastCitationTimestamp, 'FamilySearch Family Tree');
const applyBuiltAboutMe = new Function('exists', 'return ' + extractFunction(src, 'applyBuiltAboutMe'))(exists);

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function countCitationLines(text) {
    return (text.match(/\* '''\[/g) || []).length;
}

// --- Structural: both real call sites guard the padding the same way
// buildReferenceAboutMe()'s own internal padding already does. ---
const guardedPadding = /about !== "" && !about\.endsWith\("\\n"\)/g;
assertEqual((src.match(guardedPadding) || []).length, 3,
    "#286: all three about_me-padding sites (buildReferenceAboutMe()'s own, the focus profile's call site, and the family member's call site) now guard with `about !== \"\"` - previously only buildReferenceAboutMe()'s own copy did");

// --- Behavioral: a blank About on a profile already cited by this exact
// source, resubmitted repeatedly with the SAME real (non-about) change, must
// stabilize at one citation - never grow a new one each run. ---
//
// Extracts the REAL family-member call site's own padding snippet
// (popup.js, inside the `if (exists(familyout["about_me"]))` block) rather
// than reimplementing the guard by hand - a hand-written reimplementation
// would trivially pass this test even against the unfixed source, since it
// tests itself rather than the actual code. Executes the real source
// fragment via `new Function`, exactly as this test suite's other files
// extract and run real (non-function-wrapped) logic.
function extractBetween(srcText, startMarker, endMarker) {
    const start = srcText.indexOf(startMarker);
    if (start === -1) throw new Error('not found: ' + startMarker);
    const end = srcText.indexOf(endMarker, start);
    if (end === -1) throw new Error('end marker not found: ' + endMarker);
    return srcText.slice(start, end + endMarker.length);
}
const familyPaddingSnippet = extractBetween(src, 'about = familyout["about_me"];', 'rawAbout = about;');
const simulateCallSitePadding = new Function('rawValue', `
    var familyout = { about_me: rawValue };
    var about;
    ${familyPaddingSnippet}
    return about;
`);

var refurl = "https://www.familysearch.org/tree/person/details/ABCD-123";
// Run 1: genuinely new real content establishes the first citation.
var padded1 = simulateCallSitePadding("Test");
var built1 = buildReferenceAboutMe(padded1, "", refurl, ["about"]);
assertTrue(exists(built1) && built1.indexOf("Test") !== -1, "Run 1: real content writes the first citation");
assertEqual(countCitationLines(built1), 1, "Run 1: exactly one citation line");

// Run 2+: the SAME person's About is now blank (e.g. the config no longer
// scrapes a bio, or the user cleared the box), but a genuinely different
// field (burial location, say) is still being submitted each time -
// updatedCategories reflects that real, non-about change.
var padded2 = simulateCallSitePadding("");
var built2 = buildReferenceAboutMe(padded2, built1, refurl, ["burial location"]);
assertTrue(exists(built2), "Run 2: a bare citation is still written (a genuinely different category changed)");
assertEqual(countCitationLines(built2), 2,
    "Run 2: a NEW second citation is correct here - it covers a different category (burial location) than run 1's (about), so merging into run 1's citation would have hidden that a real change happened");

// Runs 3+: the SAME blank-About, SAME-category ("burial location") update
// repeats, with nothing new to say beyond what run 2 already recorded -
// this is Dan's actual reported scenario (resubmitting an unchanged page).
// Before the fix, the unconditional "\n" padding made every one of these
// look like "real new content" to buildReferenceAboutMe(), so each repeat
// added its own fresh bare citation forever instead of refreshing run 2's.
var built3 = buildReferenceAboutMe(simulateCallSitePadding(""), built2, refurl, ["burial location"]);
assertEqual(countCitationLines(built3), 2,
    "#286 fix: run 3 (exact repeat of run 2) refreshes that citation in place - stays at 2, does not grow to 3");

var built4 = buildReferenceAboutMe(simulateCallSitePadding(""), built3, refurl, ["burial location"]);
assertEqual(countCitationLines(built4), 2,
    "#286 fix: run 4 (and by extension, forever) stays stable at 2 - the duplicate-every-run bug is gone");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
