// Verifies a #286 follow-up bug (live-reported, DanCornett): submitting a
// real About update from a source correctly wrote a citation ending
// "(this update: about)". Separately submitting an Also Known As change
// from the SAME source wrote NO citation at all - silently nothing,
// despite nicknames being a genuinely different, real change.
//
// Root cause: isLastLineFromSameSource() (popup.js) - the dedup guard
// meant to stop a bare "nothing new, just documenting the source" citation
// from piling up duplicates when literally repeated - only checked whether
// the About's last line came from the same source URL/ID, not whether it
// already covered the SAME category being reported this run. The AKA
// submission's own bare citation would have read "(this update: alias)" -
// genuinely new information - but got silently swallowed because the
// About citation from the earlier, unrelated run was still the last line
// and happened to share the same source.
//
// Fix: isLastLineFromSameSource() now also takes updatedCategories, and
// only treats a bare citation as a redundant repeat when EVERY category
// this run wants to report is already named in that last citation's own
// "(this update: ...)" text - a genuinely different category from the
// identical source still gets its own citation.
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

// --- Unit: isLastLineFromSameSource() itself, category-aware ---
var sameSourceLine = "* '''[http://x FamilySearch, ID:ABCD]''' - SmartCopy: ''Sep 29 2026'' (this update: about)";
assertTrue(isLastLineFromSameSource(sameSourceLine, "[http://x FamilySearch, ID:ABCD]", ["about"]),
    "A category already named in the last citation ('about' again) is still treated as a redundant repeat");
assertTrue(!isLastLineFromSameSource(sameSourceLine, "[http://x FamilySearch, ID:ABCD]", ["alias"]),
    "#286 fix: a DIFFERENT category ('alias') from the same source is NOT treated as a repeat - this is the actual bug");
assertTrue(!isLastLineFromSameSource(sameSourceLine, "[http://x FamilySearch, ID:ABCD]", ["about", "alias"]),
    "Even one genuinely new category among several still means 'not fully covered yet' - not suppressed");
assertTrue(isLastLineFromSameSource(sameSourceLine, "[http://x FamilySearch, ID:ABCD]", []),
    "No categories to report at all (a plain 'mark as reviewed' case) keeps the original source-only dedup behavior");
assertTrue(isLastLineFromSameSource(sameSourceLine, "[http://x FamilySearch, ID:ABCD]"),
    "Omitting updatedCategories entirely (undefined) also keeps the original source-only behavior - backward compatible");
assertTrue(!isLastLineFromSameSource(sameSourceLine, "[http://y OtherSource]", ["about"]),
    "A different source entirely is never a repeat regardless of categories, unchanged from before");

// --- End-to-end: the exact reported sequence - About, then a separate Also Known As update, same source ---
var refurl = "https://familysearch.org/tree/person/details/LTSG-Z7Z";
var aboutContent = "* '''Residence''': Milam, Texas, United States - 1920\n";

var focusabout = "";
var builtAfterAbout = buildReferenceAboutMe(aboutContent, focusabout, refurl, ["about"]);
assertTrue(exists(builtAfterAbout) && builtAfterAbout.indexOf("this update: about") !== -1,
    "Run 1 (About): writes real content plus a citation documenting 'about', as reported");

// Simulate what Geni's About now holds after run 1, then a SEPARATE run
// submitting only a genuinely new Also Known As - no About content this
// time (about="").
focusabout = builtAfterAbout;
var builtAfterAka = buildReferenceAboutMe("", focusabout, refurl, ["alias"]);
assertTrue(exists(builtAfterAka),
    "#286 fix: run 2 (Also Known As only, same source) now correctly WRITES a citation instead of silently returning nothing");
assertTrue(exists(builtAfterAka) && builtAfterAka.indexOf("this update: alias") !== -1,
    "The new citation correctly documents 'alias', not 'about' again");
assertTrue(exists(builtAfterAka) && builtAfterAka.indexOf(aboutContent.trim()) !== -1,
    "The original About content (residence list) from run 1 is still preserved, not lost");

// A true repeat (identical categories, nothing new) still never adds a
// SECOND citation line - it refreshes the existing one's timestamp in
// place instead (the #286 further follow-up "most recent" behavior - see
// test_286_citation_freshness_and_source_scope.js for dedicated coverage).
var builtRepeatAbout = buildReferenceAboutMe("", builtAfterAka, refurl, ["alias"]);
assertTrue(exists(builtRepeatAbout), "Regression control: resubmitting the SAME 'alias' category again still produces a result (a refreshed timestamp), not a second citation");
assertEqual((builtRepeatAbout.match(/\(this update: alias\)/g) || []).length, 1,
    "Regression control: still exactly ONE 'alias' citation - the repeat refreshes it rather than duplicating it");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
