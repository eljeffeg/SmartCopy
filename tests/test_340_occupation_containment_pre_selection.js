// Verifies #340 (live-reported, DanCornett, with screenshot): a scraped
// Occupation of "shirt maker" pre-selected as different from Geni's
// existing "Shirt Maker / Tailor" - his own words: "This should not
// pre-select." Root cause: the occupation comparison
// (buildform.js's focus-profile occSameAsGeni, and the family-member
// resync dispatch in valuesAreEquivalentForFieldType()) used
// valuesAreEquivalent(), which requires an EXACT match (modulo case/
// whitespace/periods) - but Geni's occupation is often a fuller,
// elaborated version of what a source scrapes, not byte-identical. Fixed
// by adding a case-insensitive CONTAINMENT comparator for occupation
// specifically (occupationAlreadyPresent()), the same philosophy already
// used for nicknames (nicknamesAreEquivalent()) and About
// (isAboutContentPresent()) - routed through the one shared
// valuesAreEquivalentForFieldType() dispatch, used by both the focus
// profile's initial render and every family member's post-match resync.
//
// Extracts the REAL functions verbatim (not reimplementations) - same
// technique used throughout this suite.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');
const moment = require(path.join(ROOT, 'moment.js'));

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

function exists(v) { return typeof v !== 'undefined' && v !== null; }
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');
function extractArrayStatement(src, name) {
    const marker = 'var ' + name + ' =';
    const start = src.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    const semi = src.indexOf(';', start);
    return src.slice(start, semi + 1);
}
const DATE_QUALIFIER_PATTERN = /^(circa|about|after|before)\s+(the\s+)?/i;
const datesAreEquivalentSrc = extractArrayStatement(popupSrc, 'DATE_PARSE_FORMATS') + '\n' + extractFunction(popupSrc, 'datesAreEquivalent');
const datesAreEquivalent = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN', datesAreEquivalentSrc + '\nreturn datesAreEquivalent;')(exists, moment, DATE_QUALIFIER_PATTERN);
const DATE_SPECIFICITY_FORMATS_SRC = extractArrayStatement(popupSrc, 'DATE_SPECIFICITY_FORMATS');
const getDateSpecificity = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN',
    DATE_SPECIFICITY_FORMATS_SRC + '\n' + extractFunction(popupSrc, 'getDateSpecificity') + '\nreturn getDateSpecificity;')(exists, moment, DATE_QUALIFIER_PATTERN);
const isDateSpecificityDowngrade = new Function('getDateSpecificity', 'return ' + extractFunction(popupSrc, 'isDateSpecificityDowngrade'))(getDateSpecificity);

const occupationAlreadyPresent = new Function('return ' + extractFunction(bfSrc, 'occupationAlreadyPresent'))();
const nicknamesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'nicknamesAreEquivalent'))();
const valuesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'valuesAreEquivalent'))();
function isAboutContentPresentStub() { return false; } // not exercised by any case below
const valuesAreEquivalentForFieldType = new Function(
    'datesAreEquivalent', 'isDateSpecificityDowngrade', 'nicknamesAreEquivalent', 'occupationAlreadyPresent', 'isAboutContentPresent', 'valuesAreEquivalent',
    'return ' + extractFunction(bfSrc, 'valuesAreEquivalentForFieldType')
)(datesAreEquivalent, isDateSpecificityDowngrade, nicknamesAreEquivalent, occupationAlreadyPresent, isAboutContentPresentStub, valuesAreEquivalent);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- #340 (2026-10-19): Dan's exact example ---
assertEqual(occupationAlreadyPresent('shirt maker', 'Shirt Maker / Tailor'), true,
    "#340: a scraped occupation already contained (case-insensitive) in Geni's fuller existing occupation is treated as nothing new");
assertEqual(valuesAreEquivalentForFieldType('shirt maker', 'Shirt Maker / Tailor', 'occupation'), true,
    "#340: the shared dispatch correctly routes fieldType='occupation' to the new containment comparator");

// --- Safety: a genuinely NEW occupation must still pre-select ---
assertEqual(occupationAlreadyPresent('blacksmith', 'Shirt Maker / Tailor'), false,
    "Safety: a genuinely different occupation is NOT treated as already present - this fix must not over-match");

// --- Regression: exact match (the pre-existing #304 case) still works ---
assertEqual(occupationAlreadyPresent('Shirt Maker', 'shirt maker'), true,
    "Regression: an exact match (modulo case) still correctly counts as already present, same as before this fix");

// --- Safety: blank scraped value is never 'already present' (defense in depth - isValue() upstream already guards this) ---
assertEqual(occupationAlreadyPresent('', 'Shirt Maker / Tailor'), false,
    "Safety: a blank scraped occupation is never considered already present");

// --- Regression: generic fields (not occupation) are unaffected - still exact match only ---
assertEqual(valuesAreEquivalentForFieldType('shirt maker', 'Shirt Maker / Tailor', 'generic'), false,
    "Regression: a generic (non-occupation) field type is NOT affected by this change - containment is scoped to occupation specifically");

// --- Structural: refreshFieldCheckState() (the family-member post-match resync) recognizes fieldName === 'occupation' ---
{
    const refreshFieldCheckStateSrc = extractFunction(bfSrc, 'refreshFieldCheckState');
    assertEqual(refreshFieldCheckStateSrc.indexOf('fieldName === "occupation" ? "occupation"') !== -1, true,
        "#340: refreshFieldCheckState()'s fieldType dispatch recognizes an occupation field and routes it to the 'occupation' comparator, not the generic exact-match one");
}

// --- Structural: the focus profile's own occSameAsGeni computation now routes through the shared dispatch instead of calling valuesAreEquivalent() directly ---
{
    assertEqual(bfSrc.indexOf('valuesAreEquivalentForFieldType(occupation, genifocusdata.get("occupation"), "occupation")') !== -1, true,
        "#340: the focus profile's occSameAsGeni now uses the shared valuesAreEquivalentForFieldType() dispatch (occupation-aware), not a separate direct valuesAreEquivalent() call");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
