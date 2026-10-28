// Verifies #357 follow-up (live-reported, DanCornett): the #357 redesign's
// blanket "Place never pre-selects" went further than he wanted - he
// explicitly asked for Place to pre-select again under two conditions
// (a brand-new "Add Profile" candidate, or an existing match whose own
// Place field is still blank on Geni), but only when the leftover text
// itself looks like real venue/address content (a cemetery/venue keyword,
// or a street name/number) - not a bare historical city-name variant like
// "Poznan" next to a resolved "Posen", which he confirmed should stay an
// option, never pre-selected. Deliberately simple by his own explicit
// choice: the whole leftover string is tested as one unit (reusing the
// already-vetted isPlaceNameSegment() pattern from parse-location.js),
// not segment-by-segment.
//
// Extracts the real isPlaceEligibleForPreselection() and
// refreshFieldCheckState() verbatim from buildform.js, plus their real
// parse-location.js dependency (isPlaceNameSegment()) - not a
// reimplementation.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');
const plSrc = fs.readFileSync(path.join(ROOT, 'parse-location.js'), 'utf8');

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

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;
function exists(v) { return typeof v !== 'undefined' && v !== null; }
function isValue(v) { return v !== ""; }

// Real dependency chain, extracted verbatim.
const isPlaceNameSegmentSrc = extractFunction(plSrc, 'isPlaceNameSegment');
const isPlaceEligibleForPreselectionSrc = extractFunction(bfSrc, 'isPlaceEligibleForPreselection');
const refreshFieldCheckStateSrc = extractFunction(bfSrc, 'refreshFieldCheckState');
// PLACE_NAME_KEYWORD_PATTERN/PLACE_NAME_NUMERIC_PATTERN are module-level
// vars isPlaceNameSegment() closes over - extract them the same way.
function extractVar(src, name) {
    const marker = 'var ' + name + ' =';
    const start = src.indexOf(marker);
    const end = src.indexOf(';\n', start);
    return src.slice(start, end + 1);
}
const keywordPatternSrc = extractVar(plSrc, 'PLACE_NAME_KEYWORD_PATTERN');
const numericPatternSrc = extractVar(plSrc, 'PLACE_NAME_NUMERIC_PATTERN');

// Minimal stand-ins for refreshFieldCheckState()'s other dependencies -
// only the Place-specific eligible computation is under test, so these
// just need to exist and behave sanely, not be exercised deeply.
var protectedCalls = [];
function applyProtectedDisabledState(input, scrapedValue, currentValue, locked, fieldType, eligible, extraSuppress) {
    protectedCalls.push({ eligible: eligible });
}

const ctx = new Function('$', 'exists', 'isValue', 'applyProtectedDisabledState', `
    ${keywordPatternSrc}
    ${numericPatternSrc}
    ${isPlaceNameSegmentSrc}
    ${isPlaceEligibleForPreselectionSrc}
    ${refreshFieldCheckStateSrc}
    return { isPlaceEligibleForPreselection: isPlaceEligibleForPreselection, refreshFieldCheckState: refreshFieldCheckState };
`)($, exists, isValue, applyProtectedDisabledState);

// --- isPlaceEligibleForPreselection(): direct unit checks ---

assertEqual(ctx.isPlaceEligibleForPreselection("Oak Hill Cemetery", false, ""), true,
    "Cemetery keyword + Geni's Place blank - pre-selects");
assertEqual(ctx.isPlaceEligibleForPreselection("Oak Hill Cemetery", true, "Some Existing Place"), true,
    "Cemetery keyword + brand-new Add profile - pre-selects even though a (hypothetical) Geni value is non-blank, since isNewAdd alone is enough");
assertEqual(ctx.isPlaceEligibleForPreselection("Jagowstraße 29-33", false, ""), true,
    "German street-name-then-number convention - pre-selects (Geni's Place blank)");
assertEqual(ctx.isPlaceEligibleForPreselection("123 Main Street", true, ""), true,
    "US number-then-street-name convention - pre-selects on a new Add profile");

assertEqual(ctx.isPlaceEligibleForPreselection("Poznan", true, ""), false,
    "A bare historical city-name variant (no keyword, no street number) never pre-selects, even on a new Add profile or blank Geni Place - stays an option, per the user's own explicit prior decision");
assertEqual(ctx.isPlaceEligibleForPreselection("Oak Hill Cemetery", false, "Existing Geni Place"), false,
    "Cemetery keyword present, but Geni ALREADY has a real Place and this isn't a new Add - never pre-selects, there's something to protect");
assertEqual(ctx.isPlaceEligibleForPreselection("", true, ""), false,
    "A blank leftover never pre-selects regardless of either condition - nothing to select");
assertEqual(ctx.isPlaceEligibleForPreselection("pr", true, ""), false,
    "A scraping/split artifact with no real keyword or number content never pre-selects, even on a new Add profile - the content gate is what's actually protecting against noise");

// --- refreshFieldCheckState(): the resync path wires isNewAdd + Geni's current value through correctly ---

function runResync(fieldSuffix, scrapedValue, geniValue, isNewAdd) {
    protectedCalls = [];
    $('body').html('<table id="familytable_7"><tr><td><input type="text" name="burial:location:' + fieldSuffix + '" value="' + scrapedValue + '"></td></tr></table>');
    ctx.refreshFieldCheckState(7, "burial:location:" + fieldSuffix, geniValue, false, undefined, undefined, isNewAdd);
    return protectedCalls[0].eligible;
}

assertEqual(runResync("place_name_geo", "Oak Hill Cemetery", "", false),
    true, "Resync: existing match, Geni's Place blank, cemetery leftover - eligible");
assertEqual(runResync("place_name_geo", "Oak Hill Cemetery", "Existing Place", false),
    false, "Resync: existing match, Geni ALREADY has a real Place - not eligible even with a cemetery keyword");
assertEqual(runResync("place_name_geo", "Oak Hill Cemetery", "Existing Place", true),
    true, "Resync: brand-new Add Profile candidate (isNewAdd=true) - eligible regardless of what currentValue happens to be passed");
assertEqual(runResync("place_name_geo", "Poznan", "", true),
    false, "Resync: a new Add Profile with a bare city-name-variant leftover (no keyword/number) - still not eligible, content gate applies on the resync path too");
assertEqual(runResync("place_name", "123 Oak St", "", false),
    true, "Resync: the OTHER Place field name (place_name, not just place_name_geo) gets the identical treatment");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
