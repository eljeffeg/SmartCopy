// Verifies a #286 DATA-LOSS regression (live-reported, DanCornett,
// 2026-10-12, testing v...52): enabling a family member's About checkbox
// while leaving the scraped value blank EMPTIED that person's existing
// About on Geni entirely. The focus profile's own identical scenario was
// safe (nothing got submitted) - only the family-member path destroyed
// data.
//
// Root cause: this session's earlier #286 fix (commit d2ef78b) correctly
// stopped padding a blank about_me into a non-blank "\n" before the
// citation logic - but that padding had been ACCIDENTALLY serving as the
// trigger that got a blank about_me routed through
// buildReferenceAboutMe()/applyBuiltAboutMe() at all. Once padding no
// longer forced entry, neither of the two branches handling a family
// member's about_me ran for a genuinely blank value, so
// familyout["about_me"] was left holding its ORIGINAL RAW value from
// parseForm() - a literal "" - which then got submitted as-is. Geni's API
// treats a submitted empty about_me as a real value and wipes the
// profile's existing About. The focus profile never had this gap:
// buildFocusReferenceAboutMe()/applyBuiltAboutMe() run unconditionally
// there (gated only on the source-citation config, never on about_me's own
// content), always either setting a real built value or deleting the key.
//
// Fix: an explicit `else { delete familyout["about_me"]; }` closes the
// same gap for family members - a blank About is now never submitted as a
// destructive overwrite, matching the focus profile's existing safety.
//
// Extracts the REAL block from popup.js (not a reimplementation) and runs
// it with mock inputs shaped like the real submission loop's variables -
// same convention as test_286_blank_about_padding_duplicate_citation.js.
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

// Brace-counts the `if (exists(fdata)) { ... }` block that immediately
// follows the given anchor text (disambiguates from a second, unrelated
// `if (exists(fdata))` elsewhere in the file).
function extractIfBlockAfter(srcText, anchor) {
    const anchorPos = srcText.indexOf(anchor);
    if (anchorPos === -1) throw new Error('anchor not found: ' + anchor);
    const ifStart = srcText.indexOf('if (exists(fdata)) {', anchorPos);
    const braceStart = srcText.indexOf('{', ifStart);
    let depth = 0, i = braceStart;
    for (; i < srcText.length; i++) {
        if (srcText[i] === '{') depth++;
        else if (srcText[i] === '}') { depth--; if (depth === 0) break; }
    }
    return srcText.slice(braceStart + 1, i);
}

function exists(v) { return typeof v !== 'undefined' && v !== null; }
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
const summarizeUpdatedCategories = new Function('exists', 'return ' + extractFunction(src, 'summarizeUpdatedCategories'))(exists);

// The real block under test, run with mock loop state shaped like the
// actual submission loop's own variables at this point.
const blockSrc = extractIfBlockAfter(src, 'var tempfamilyout = jQuery.extend');
function runRealFamilyAboutBlock(familyout, opts) {
    var fdata = opts.fdata;
    var sourcecheck = opts.sourcecheck;
    var databyid = opts.databyid || {};
    var photosubmit = opts.photosubmit || {};
    var marriagedates = opts.marriagedates || {};
    var about, rawAbout;
    (new Function(
        'familyout', 'fdata', 'sourcecheck', 'databyid', 'photosubmit', 'marriagedates',
        'exists', 'buildReferenceAboutMe', 'applyBuiltAboutMe', 'summarizeUpdatedCategories',
        blockSrc + '\nreturn familyout;'
    ))(familyout, fdata, sourcecheck, databyid, photosubmit, marriagedates,
        exists, buildReferenceAboutMe, applyBuiltAboutMe, summarizeUpdatedCategories);
    return familyout;
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

var fdata = { url: 'https://www.familysearch.org/tree/person/details/ABCD-123' };

// --- #286 DATA LOSS: blank about_me on an "Add" family member must never
// be submitted as a destructive blank overwrite - whether that means
// deleting it entirely, or (per a later #286 follow-up fix, which
// intentionally gives a brand-new Add a bare citation here instead,
// matching the focus profile's own behavior) a real, non-blank citation
// value. Either is safe; a literal "" is the one thing that must never
// reach this point, since Geni's API treats a submitted empty about_me as
// a real value and wipes the profile's existing About with it. ---
{
    var familyout = { profile_id: '42', action: 'add', about_me: '', last_name: 'Smith' };
    var result = runRealFamilyAboutBlock(familyout, { fdata: fdata, sourcecheck: true });
    assertTrue(!exists(result['about_me']) || result['about_me'] !== '',
        "#286 DATA LOSS fix: a blank about_me on a new 'Add' family member is never submitted as a literal empty string - either omitted entirely, or (intentionally, per a later fix) a real bare citation");
}

// --- #286 DATA LOSS: same scenario for a matched 'Update' family member. ---
{
    var familyout = { profile_id: '42', action: '6000000012345', about_me: '', last_name: 'Smith' };
    var result = runRealFamilyAboutBlock(familyout, { fdata: fdata, sourcecheck: true });
    assertTrue(!exists(result['about_me']),
        "#286 DATA LOSS fix: a blank about_me on a matched 'Update' family member is also deleted, not submitted as a destructive empty string");
}

// --- Regression: real, non-blank About content must still be submitted correctly (the fix must not have broken the working case). ---
{
    var familyout = { profile_id: '42', action: 'add', about_me: 'Born in 1850.', last_name: 'Smith' };
    var result = runRealFamilyAboutBlock(familyout, { fdata: fdata, sourcecheck: true });
    assertTrue(exists(result['about_me']) && result['about_me'].indexOf('Born in 1850.') !== -1,
        "Regression: real, non-blank About content on a new Add still gets submitted with its content and citation intact");
}

// --- Regression: with the source-citation config OFF, real content still submits as plain raw text (unrelated to this fix). ---
{
    var familyout = { profile_id: '42', action: 'add', about_me: 'Born in 1850.', last_name: 'Smith' };
    var result = runRealFamilyAboutBlock(familyout, { fdata: fdata, sourcecheck: false });
    assertEqual(result['about_me'], 'Born in 1850.\n',
        "Regression: with citations off, real content still submits as the plain scraped text");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
