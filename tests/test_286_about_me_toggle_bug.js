// Verifies the #286 "toggle" bug (live-reported, DanCornett): repeating the
// exact same About submission on the focus profile alternated between
// adding the citation and silently stripping it back out, forever, instead
// of settling into a stable state after the first run.
//
// Root cause: buildReferenceAboutMe() returns undefined to mean "nothing
// genuinely changed - about_me shouldn't be part of THIS submission at
// all." The focus profile's own call site (popup.js submitform()) already
// had profileout["about_me"] populated with the raw, un-merged, un-
// footnoted scraped text (from parseForm(), before this check ever runs) -
// and only OVERWROTE that with the built value when one existed. On
// undefined, the stale raw value was left in place and got submitted
// as-is, replacing Geni's real About (citation included) with just the
// bare resubmitted text. The family "Update" path already had this
// right (delete the key on undefined); the focus profile's didn't - the
// exact inconsistency that produced the toggle.
//
// Fix: applyBuiltAboutMe(target, builtAboutMe) is now the one shared rule
// - set the key when there's a real value, delete it otherwise - used by
// all three call sites (focus profile, family Add, family Update) instead
// of each one re-deciding independently.
//
// This test drives the real buildReferenceAboutMe() + applyBuiltAboutMe()
// together across four consecutive runs with IDENTICAL scraped content
// (mirroring Dan's own "Test" example), simulating what focusabout/
// profileout would actually look like run over run, and confirms the
// result now stabilizes after run 1 instead of toggling forever.
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

function exists(v) { return typeof v !== "undefined" && v !== null; }
const moment = require(path.join(ROOT, 'moment.js'));

const isAboutContentPresent = new Function('exists', extractFunction(src, 'normalizeAboutForComparison') + '\n' + extractFunction(src, 'isAboutContentPresent') + '\nreturn isAboutContentPresent;')(exists);
const footnoteLabel = new Function('exists', 'return ' + extractFunction(src, 'footnoteLabel'))(exists);
const isLastLineFromSameSource = new Function('exists', 'return ' + extractFunction(src, 'isLastLineFromSameSource'))(exists);
const buildReferenceAboutMe = new Function('exists', 'moment', 'isAboutContentPresent', 'footnoteLabel', 'isLastLineFromSameSource', 'recordtype',
    'return ' + extractFunction(src, 'buildReferenceAboutMe'))(exists, moment, isAboutContentPresent, footnoteLabel, isLastLineFromSameSource, 'FamilySearch Family Tree');
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

// --- Structural: the shared contract exists and both call sites use it ---
assertTrue(src.indexOf('function applyBuiltAboutMe(target, builtAboutMe)') !== -1,
    "applyBuiltAboutMe() exists as a single shared helper");
assertTrue((src.match(/applyBuiltAboutMe\(/g) || []).length >= 4,
    "applyBuiltAboutMe() is actually used at its call sites (1 definition + 3 call sites minimum)");
assertTrue(!/if \(exists\(builtAboutMe\)\) \{\s*\n\s*profileout\["about_me"\] = builtAboutMe;\s*\n\s*\}\s*\n\s*\} else if/.test(src),
    "The focus profile's old bare if-with-no-else is gone");

// --- Behavioral: reproduce Dan's exact repeated-identical-submission scenario end-to-end ---
function simulateFocusSubmission(currentAbout, refurl, updatedCategories) {
    // Mirrors submitform()'s real sequence: profileout["about_me"] starts
    // as the raw scraped text (parseForm()'s output), THEN gets replaced/
    // deleted by applyBuiltAboutMe() based on what buildReferenceAboutMe()
    // decides - exactly the shape of the real bug (a stale raw value
    // already sitting there before the check runs).
    var rawScraped = "Test\n";
    var profileout = { about_me: rawScraped };
    var builtAboutMe = buildReferenceAboutMe(rawScraped, currentAbout, refurl, updatedCategories);
    applyBuiltAboutMe(profileout, builtAboutMe);
    // The "About" Geni now has after this submission - real About text if
    // about_me was included, otherwise unchanged (nothing was submitted).
    return exists(profileout.about_me) ? profileout.about_me : currentAbout;
}

var refurl = "https://www.familysearch.org/tree/person/details/ABCD-123";
var about1 = simulateFocusSubmission("", refurl, ["about"]);
assertTrue(about1.indexOf("Test") !== -1 && about1.indexOf(encodeURI(refurl)) !== -1,
    "Run 1: identical to before the fix - real new content gets text + citation");

var about2 = simulateFocusSubmission(about1, refurl, ["about"]);
assertEqual(about2, about1,
    "#286 fix: run 2 (same text resubmitted) now leaves About COMPLETELY UNCHANGED, instead of stripping the citation");

var about3 = simulateFocusSubmission(about2, refurl, ["about"]);
assertEqual(about3, about2,
    "#286 fix: run 3 stays stable too - no citation re-added, no separator, nothing toggles");

var about4 = simulateFocusSubmission(about3, refurl, ["about"]);
assertEqual(about4, about3,
    "#286 fix: run 4 (and by extension, forever) stays stable - the toggle is gone");

// A GENUINE change (different text) still correctly gets its own new
// citation - the fix doesn't make About inert, just idempotent on repeats.
var about5 = simulateFocusSubmission(about4, refurl, ["about"]);
function simulateFocusSubmissionWithText(currentAbout, refurl, updatedCategories, text) {
    var profileout = { about_me: text };
    var builtAboutMe = buildReferenceAboutMe(text, currentAbout, refurl, updatedCategories);
    applyBuiltAboutMe(profileout, builtAboutMe);
    return exists(profileout.about_me) ? profileout.about_me : currentAbout;
}
var about6 = simulateFocusSubmissionWithText(about5, refurl, ["about"], "Genuinely different content\n");
assertTrue(about6 !== about5 && about6.indexOf("Genuinely different content") !== -1,
    "A genuinely new About addition still writes correctly - the fix only stops the no-op toggle, not real updates");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
