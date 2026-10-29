// Verifies #366/#357 follow-up (live-reported, DanCornett): "Place didn't
// get updated on the Add, but a re-run of the same focus would then
// pre-select the Place field... it should catch those on the 'Add' step."
//
// Root cause, confirmed by tracing the real call graph (not guessed):
// isPlaceEligibleForPreselection() (shipped v4.17.3.94/97) only ever ran
// for a family member through setGeniFamilyData()'s resync - but that
// resync only runs for a member iconUpdate()'s own genibuildaction-keyed
// loop reaches, and genibuildaction is ONLY EVER populated when
// findExistingFamilyMatch() found a real candidate (confirmed: every
// genibuildaction[...] write site in buildform.js is inside a match-found
// branch - none exist for the "no match at all" case). A genuinely
// brand-new, zero-candidate person never got an entry there, so the
// resync never ran for them during the initial build - Place stayed stuck
// at a hardcoded blank on that very first "Add Profile" pass. A later
// re-run (now matched to the profile just created) finally reaches
// setGeniFamilyData(), which is why Dan saw it work "the second time."
//
// Fixed by computing Place's eligibility directly at family-member render
// time instead - the same approach the focus profile already used - via
// a findExistingFamilyMatch() call using the IDENTICAL arguments
// buildAction() itself uses one line above, so this can never disagree
// with what the Action dropdown actually shows. This test extracts BOTH
// real inline code blocks verbatim from buildform.js (not a
// reimplementation) and drives them with a real GeniPerson/genifamilydata
// fixture - the critical case being the zero-candidate one, run with NO
// resync/setGeniFamilyData call anywhere in this test, proving the render
// path alone is now sufficient.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');
const plSrc = fs.readFileSync(path.join(ROOT, 'parse-location.js'), 'utf8');
const sharedSrc = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');

function extractFunction(src, name) {
    const marker = 'function ' + name + '(';
    const start = src.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    let depth = 0, i = src.indexOf('{', start);
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(start, i + 1);
}
function extractVar(src, name) {
    const marker = 'var ' + name + ' =';
    const start = src.indexOf(marker);
    const end = src.indexOf(';\n', start);
    return src.slice(start, end + 1);
}
function extractBetween(src, startMarker, endMarker) {
    const start = src.indexOf(startMarker);
    if (start === -1) throw new Error('start marker not found: ' + startMarker);
    const end = src.indexOf(endMarker, start);
    if (end === -1) throw new Error('end marker not found: ' + endMarker);
    return src.slice(start, end + endMarker.length);
}

function exists(v) { return typeof v !== 'undefined' && v !== null; }
function isValue(v) { return v !== ''; }

// The two real inline blocks added to buildform.js's family-member render
// path, extracted verbatim by their own exact, distinctive source text.
const matchBlockSrc = extractBetween(bfSrc,
    'var existingFamilyMatchForPlace = findExistingFamilyMatch(',
    'var isNewAddForPlace = !existingFamilyMatchForPlace;');
const geniValuesBlockSrc = extractBetween(bfSrc,
    'var geniPlaceLocationStringForPlace = existingFamilyMatchForPlace ?',
    'geniPlaceNameForPlace, geniPlaceLocationStringForPlace) : true;');

const findExistingFamilyMatchSrc = extractFunction(bfSrc, 'findExistingFamilyMatch');
const getGivenNameWordsSrc = extractFunction(bfSrc, 'getGivenNameWords');
const compareGivenNameWordSetsSrc = extractFunction(bfSrc, 'compareGivenNameWordSets');
const normalizeGermanicSrc = extractFunction(bfSrc, 'normalizeGermanic');
const isGeniLocationEntirelyBlankSrc = extractFunction(bfSrc, 'isGeniLocationEntirelyBlank');
const isPlaceEligibleForPreselectionSrc = extractFunction(bfSrc, 'isPlaceEligibleForPreselection');
const isPlaceNameSegmentSrc = extractFunction(plSrc, 'isPlaceNameSegment');
const keywordPatternSrc = extractVar(plSrc, 'PLACE_NAME_KEYWORD_PATTERN');
const numericPatternSrc = extractVar(plSrc, 'PLACE_NAME_NUMERIC_PATTERN');
const GeniPersonSrc = extractFunction(sharedSrc, 'GeniPerson');
const getGeniDataSrc = extractFunction(sharedSrc, 'getGeniData');

function isPartner(r) { return exists(r) && ['spouse', 'wife', 'husband', 'partner', 'ex-husband', 'ex-wife', 'ex-partner'].indexOf(r) !== -1; }
function isChild(r) { return exists(r) && ['children', 'child', 'son', 'daughter', 'dau'].indexOf(r) !== -1; }
function isSibling(r) { return exists(r) && ['siblings', 'sibling', 'brother', 'sister', 'bro', 'sis'].indexOf(r) !== -1; }
function isParent(r) { return exists(r) && ['parents', 'father', 'mother', 'parent', 'moth', 'fath'].indexOf(r) !== -1; }
function checkNested(obj) {
    var args = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < args.length; i++) {
        if (!obj || !obj.hasOwnProperty(args[i])) { return false; }
        obj = obj[args[i]];
    }
    return true;
}
function geniPhoto() { return 'images/no_photo_u.gif'; }

const GeniPerson = new Function('exists', 'checkNested', 'geniPhoto', 'return ' + GeniPersonSrc)(exists, checkNested, geniPhoto);

// Simulates the exact per-member/per-title render-time scope: relationship/
// gender/nameval/actionBirthYear (per-member), title (per-title), plus
// whatever Geni family candidates currently exist. Returns the real,
// final boolean both buildLocationFieldRow() calls now use for checkedAttr.
function computePlaceChecked(genifamilydata, relationship, gender, nameval, actionBirthYear, title, scrapedPlaceValue) {
    global.genifamily = true;
    global.genifamilydata = genifamilydata;
    const getGeniData = new Function('exists', 'geniPhoto', 'genifamilydata', 'return ' + getGeniDataSrc)(exists, geniPhoto, genifamilydata);
    const ctx = new Function(
        'exists', 'isValue', 'isPartner', 'isChild', 'isSibling', 'isParent',
        'genifamilydata', 'getGeniData', 'relationship', 'gender', 'nameval', 'actionBirthYear', 'title',
        `
        ${normalizeGermanicSrc}
        ${getGivenNameWordsSrc}
        ${compareGivenNameWordSetsSrc}
        ${findExistingFamilyMatchSrc}
        ${keywordPatternSrc}
        ${numericPatternSrc}
        ${isPlaceNameSegmentSrc}
        ${isPlaceEligibleForPreselectionSrc}
        ${isGeniLocationEntirelyBlankSrc}
        ${matchBlockSrc}
        ${geniValuesBlockSrc}
        return { existingFamilyMatchForPlace, isNewAddForPlace, geniPlaceLocationStringForPlace, geniPlaceNameForPlace, geniLocationEntirelyBlankForPlace, isPlaceEligibleForPreselection };
        `
    )(exists, isValue, isPartner, isChild, isSibling, isParent,
        genifamilydata, getGeniData, relationship, gender, nameval, actionBirthYear, title);
    return ctx.isPlaceEligibleForPreselection(scrapedPlaceValue, ctx.isNewAddForPlace, ctx.geniPlaceNameForPlace, true, ctx.geniLocationEntirelyBlankForPlace);
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

var placeValue = 'Saint Joseph Catholic Cemetery, New Brighton, Beaver County, Pennsylvania, United States';

// --- Scenario 1 (the real bug): zero candidates at all - genifamilydata has NOBODY resembling this person ---
(function () {
    var genifamilydata = {}; // nobody at all - the exact "brand-new, zero-candidate" case
    var nameval = { firstName: 'Philip', middleName: '', lastName: 'Gold' };
    var checked = computePlaceChecked(genifamilydata, 'child', 'male', nameval, '1921', 'burial', placeValue);
    assertEqual(checked, true,
        "#366: a genuinely zero-candidate brand-new person's cemetery Place now pre-selects at RENDER TIME alone - no resync/setGeniFamilyData() call happened anywhere in this test, proving the fix no longer depends on one");
})();

// --- Scenario 2: a real match exists, and Geni's own Place is already blank for this event - still eligible ---
(function () {
    // genifamilydata's own dictionary key MUST equal the person's own "id"
    // field - getGeniData(profile, ...) looks the person up by that same
    // key (genifamilydata[profile]), exactly as the real buildAction()/
    // findExistingFamilyMatch() call chain always does (the Action
    // dropdown's own option value is literally familymem.get("id")). Using
    // a different key here (an earlier draft of this test used "p1") would
    // silently make getGeniData() fail to find the person at all, making
    // EVERY Geni comparison value read back blank regardless of what's in
    // the fixture - exactly the kind of test-harness mistake that could
    // mask a real regression.
    var genifamilydata = {
        'geni-123': new GeniPerson({
            id: 'geni-123', relation: 'son', name_language: 'en-US',
            names: { 'en-US': { first_name: 'Philip', last_name: 'Gold' } },
            birth: { date: { year: '1921' } },
            burial: { location: { city: '', county: '', state: '', country: '', place_name: '' }, location_string: '' }
        })
    };
    var nameval = { firstName: 'Philip', middleName: '', lastName: 'Gold' };
    var checked = computePlaceChecked(genifamilydata, 'child', 'male', nameval, '1921', 'burial', placeValue);
    assertEqual(checked, true,
        "A real match exists, but Geni has nothing at all for this event yet - still eligible, matching the already-shipped #357 follow-up behavior");
})();

// --- Scenario 3 (regression safety): a real match exists, and Geni ALREADY has a real Place for this event - must NOT pre-select ---
(function () {
    var genifamilydata = {
        'geni-123': new GeniPerson({
            id: 'geni-123', relation: 'son', name_language: 'en-US',
            names: { 'en-US': { first_name: 'Philip', last_name: 'Gold' } },
            birth: { date: { year: '1921' } },
            burial: { location: { city: 'New Brighton', county: 'Beaver County', state: 'Pennsylvania', country: 'United States', place_name: 'Saint Joseph Catholic Cemetery' }, location_string: 'Saint Joseph Catholic Cemetery, New Brighton, PA' }
        })
    };
    var nameval = { firstName: 'Philip', middleName: '', lastName: 'Gold' };
    var checked = computePlaceChecked(genifamilydata, 'child', 'male', nameval, '1921', 'burial', placeValue);
    assertEqual(checked, false,
        "Regression safety: a real match ALREADY has a real Place on Geni for this event - must stay unchecked, something real to protect");
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
