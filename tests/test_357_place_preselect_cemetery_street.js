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
// Extended for #365 follow-up (live-reported, GaryKoven): when geocoding
// resolves NOTHING at all (FamilySearch Places and Google both off, or
// both fail), Place holds the ENTIRE raw scraped text, not a leftover
// fragment - the keyword/number gate above was wrongly rejecting
// ordinary, complete location text ("Revere, Suffolk, Massachusetts,
// USA") even on a brand-new profile with nothing else on Geni to
// protect. hasGeoFields now distinguishes the two cases: true keeps the
// ORIGINAL #357 behavior above completely unchanged (confirmed explicitly
// below - a brand-new profile still does NOT bypass the keyword gate
// when something WAS geocoded); false applies a simpler rule instead -
// pre-select unconditionally for a brand-new Add Profile, or when NONE of
// Geni's own location fields for that event (City/County/State/Country,
// AND both of Geni's own Place representations) have anything in them -
// not just this one Place field, since the full raw blob could otherwise
// duplicate data Geni already has split out properly.
//
// Extracts the real isPlaceEligibleForPreselection(),
// isGeniLocationEntirelyBlank(), and refreshFieldCheckState() verbatim
// from buildform.js, plus their real parse-location.js dependency
// (isPlaceNameSegment()) - not a reimplementation.
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
const isGeniLocationEntirelyBlankSrc = extractFunction(bfSrc, 'isGeniLocationEntirelyBlank');
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
    ${isGeniLocationEntirelyBlankSrc}
    ${refreshFieldCheckStateSrc}
    return { isPlaceEligibleForPreselection: isPlaceEligibleForPreselection, isGeniLocationEntirelyBlank: isGeniLocationEntirelyBlank, refreshFieldCheckState: refreshFieldCheckState };
`)($, exists, isValue, applyProtectedDisabledState);

// --- isPlaceEligibleForPreselection(): hasGeoFields=true (the ORIGINAL #357 leftover-residue behavior, must be completely unchanged) ---

assertEqual(ctx.isPlaceEligibleForPreselection("Oak Hill Cemetery", false, "", true), true,
    "Cemetery keyword + Geni's Place blank - pre-selects");
assertEqual(ctx.isPlaceEligibleForPreselection("Oak Hill Cemetery", true, "Some Existing Place", true), true,
    "Cemetery keyword + brand-new Add profile - pre-selects even though a (hypothetical) Geni value is non-blank, since isNewAdd alone is enough");
assertEqual(ctx.isPlaceEligibleForPreselection("Jagowstraße 29-33", false, "", true), true,
    "German street-name-then-number convention - pre-selects (Geni's Place blank)");
assertEqual(ctx.isPlaceEligibleForPreselection("123 Main Street", true, "", true), true,
    "US number-then-street-name convention - pre-selects on a new Add profile");

assertEqual(ctx.isPlaceEligibleForPreselection("Poznan", true, "", true), false,
    "#365 regression guard: a bare historical city-name variant (no keyword, no street number) still never pre-selects even on a BRAND-NEW Add Profile when something WAS geocoded (hasGeoFields=true) - the keyword gate is not bypassed by isNewAdd in this branch, confirming #365's fix didn't loosen the original #357 behavior");
assertEqual(ctx.isPlaceEligibleForPreselection("Oak Hill Cemetery", false, "Existing Geni Place", true), false,
    "Cemetery keyword present, but Geni ALREADY has a real Place and this isn't a new Add - never pre-selects, there's something to protect");
assertEqual(ctx.isPlaceEligibleForPreselection("", true, "", true), false,
    "A blank leftover never pre-selects regardless of either condition - nothing to select");
assertEqual(ctx.isPlaceEligibleForPreselection("pr", true, "", true), false,
    "A scraping/split artifact with no real keyword or number content never pre-selects, even on a new Add profile - the content gate is what's actually protecting against noise");

// --- isPlaceEligibleForPreselection(): hasGeoFields=false (#365 - no geocoding happened at all, Place holds the raw text verbatim) ---

assertEqual(ctx.isPlaceEligibleForPreselection("Revere, Suffolk, Massachusetts, USA", true, "", false, true), true,
    "Brand-new Add Profile, no geocoding at all - pre-selects unconditionally, no keyword/number needed (Gary's exact reported case)");
assertEqual(ctx.isPlaceEligibleForPreselection("Revere, Suffolk, Massachusetts, USA", true, "Existing Place", false, false), true,
    "Brand-new Add Profile still pre-selects even if (hypothetically) currentGeniValue/geniLocationEntirelyBlank say otherwise - isNewAdd alone is sufficient, nothing on a brand-new profile could conflict");
assertEqual(ctx.isPlaceEligibleForPreselection("Revere, Suffolk, Massachusetts, USA", false, "", false, true), true,
    "Existing match, no geocoding, and Geni has NOTHING for this event at all - pre-selects");
assertEqual(ctx.isPlaceEligibleForPreselection("Revere, Suffolk, Massachusetts, USA", false, "", false, false), false,
    "Existing match, no geocoding, but Geni has SOMETHING for this event (geniLocationEntirelyBlank=false) - does NOT pre-select, even though this one Place field's own currentGeniValue is blank - avoids duplicating data already split across Geni's structured fields");
assertEqual(ctx.isPlaceEligibleForPreselection("", true, "", false, true), false,
    "A blank scraped value never pre-selects, even on a brand-new profile with no geocoding - nothing to select");

// --- isGeniLocationEntirelyBlank(): direct unit checks ---

assertEqual(ctx.isGeniLocationEntirelyBlank("", "", "", "", "", ""), true,
    "All six fields blank - entirely blank");
assertEqual(ctx.isGeniLocationEntirelyBlank("Springfield", "", "", "", "", ""), false,
    "City alone has real data - not entirely blank");
assertEqual(ctx.isGeniLocationEntirelyBlank("", "", "", "", "Oak Hill Cemetery", ""), false,
    "Only the structured Place (location.place_name) has data - still not entirely blank");
assertEqual(ctx.isGeniLocationEntirelyBlank("", "", "", "", "", "Springfield, IL"), false,
    "Only the flat Place (location_string) has data - still not entirely blank");

// --- refreshFieldCheckState(): the resync path wires hasGeoFields/geniLocationEntirelyBlank through correctly ---

function runResync(fieldSuffix, scrapedValue, geniValue, isNewAdd, hasGeoFields, geniLocationEntirelyBlank) {
    protectedCalls = [];
    $('body').html('<table id="familytable_7"><tr><td><input type="text" name="burial:location:' + fieldSuffix + '" value="' + scrapedValue + '"></td></tr></table>');
    ctx.refreshFieldCheckState(7, "burial:location:" + fieldSuffix, geniValue, false, undefined, undefined, isNewAdd, hasGeoFields, geniLocationEntirelyBlank);
    return protectedCalls[0].eligible;
}

assertEqual(runResync("place_name_geo", "Oak Hill Cemetery", "", false, true, false),
    true, "Resync, hasGeoFields=true: existing match, Geni's Place blank, cemetery leftover - eligible (unchanged #357 behavior)");
assertEqual(runResync("place_name_geo", "Oak Hill Cemetery", "Existing Place", false, true, false),
    false, "Resync, hasGeoFields=true: existing match, Geni ALREADY has a real Place - not eligible even with a cemetery keyword");
assertEqual(runResync("place_name_geo", "Poznan", "", true, true, true),
    false, "Resync, hasGeoFields=true: a new Add Profile with a bare city-name-variant leftover (no keyword/number) - still not eligible, content gate applies on the resync path too, even with isNewAdd true");
assertEqual(runResync("place_name_geo", "Revere, Suffolk, Massachusetts, USA", "", true, false, true),
    true, "Resync, hasGeoFields=false (#365): brand-new Add Profile, no geocoding at all - eligible, no keyword needed");
assertEqual(runResync("place_name_geo", "Revere, Suffolk, Massachusetts, USA", "", false, false, true),
    true, "Resync, hasGeoFields=false (#365): existing match, no geocoding, Geni has nothing at all for this event - eligible");
assertEqual(runResync("place_name_geo", "Revere, Suffolk, Massachusetts, USA", "", false, false, false),
    false, "Resync, hasGeoFields=false (#365): existing match, no geocoding, but Geni has SOME real location data for this event already - not eligible, avoids duplicating structured data");
assertEqual(runResync("place_name", "123 Oak St", "", false, true, false),
    true, "Resync: the OTHER Place field name (place_name, not just place_name_geo) gets the identical treatment");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
