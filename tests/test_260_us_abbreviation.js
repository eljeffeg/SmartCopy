// Verifies a #260 follow-up (live-reported by the user, immediately
// after #260 shipped): "USA"/"US" share no substring with a resolved
// "United States" field, so a raw segment ending in "USA" was
// incorrectly surviving as leftover text - invisible before #260 (hidden
// behind the geoicon toggle), now shown by default, which is what
// actually surfaced this as a real, visible bug. Two real examples given
// directly: a death location "Price Hill, Hamilton County, Ohio, USA"
// showing a spurious "USA" in the Place field, and a burial location
// "Adath Israel Cemetery, USA" showing "Adath Israel Cemetery, USA"
// instead of just the cemetery name.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const sharedSrc = fs.readFileSync('' + ROOT + '/shared.js', 'utf8');

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

function exists(v) { return v !== undefined && v !== null && v !== ""; }

const PLACE_SEGMENT_QUALIFIER_PATTERN = eval(sharedSrc.match(/var PLACE_SEGMENT_QUALIFIER_PATTERN = (.*?);/)[1]);
const PLACE_SEGMENT_EQUIVALENTS = eval('(' + sharedSrc.match(/var PLACE_SEGMENT_EQUIVALENTS = (\{[\s\S]*?\});/)[1] + ')');
function expandBurialVenueAbbreviation(text) {
    var expanded = String(text || "").replace(/\bcemetary\b/i, "Cemetery");
    expanded = expanded.replace(/\bmem\.?(\s+(?:garden|park))/i, "Memorial$1");
    return expanded.replace(/\bcem\.?(?![a-z])/i, "Cemetery");
}
const normalizePlaceSegmentForMatch = new Function('PLACE_SEGMENT_QUALIFIER_PATTERN', 'PLACE_SEGMENT_EQUIVALENTS', 'expandBurialVenueAbbreviation', 'return ' + extractFunction(sharedSrc, 'normalizePlaceSegmentForMatch'))(PLACE_SEGMENT_QUALIFIER_PATTERN, PLACE_SEGMENT_EQUIVALENTS, expandBurialVenueAbbreviation);
const stripTrailingCountySuffix = new Function('return ' + extractFunction(sharedSrc, 'stripTrailingCountySuffix'))();
const US_HISTORICAL_COUNTRY_EQUIVALENTS = eval(sharedSrc.match(/var US_HISTORICAL_COUNTRY_EQUIVALENTS = (\[[\s\S]*?\]);/)[1]);
const segmentMatchesAnyField = new Function('exists', 'normalizePlaceSegmentForMatch', 'stripTrailingCountySuffix', 'US_HISTORICAL_COUNTRY_EQUIVALENTS', 'return ' + extractFunction(sharedSrc, 'segmentMatchesAnyField'))(exists, normalizePlaceSegmentForMatch, stripTrailingCountySuffix, US_HISTORICAL_COUNTRY_EQUIVALENTS);
const computeLeftoverPlaceName = new Function('exists', 'segmentMatchesAnyField', 'return ' + extractFunction(sharedSrc, 'computeLeftoverPlaceName'))(exists, segmentMatchesAnyField);
const computeCombinedPlaceValue = new Function('exists', 'computeLeftoverPlaceName', 'return ' + extractFunction(sharedSrc, 'computeCombinedPlaceValue'))(exists, computeLeftoverPlaceName);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label, '->', JSON.stringify(actual)); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- normalizePlaceSegmentForMatch() equivalence ---
assertEqual(normalizePlaceSegmentForMatch("USA"), "united states", "USA -> united states");
assertEqual(normalizePlaceSegmentForMatch("US"), "united states", "US -> united states");
assertEqual(normalizePlaceSegmentForMatch("United States of America"), "united states", "United States of America -> united states");
assertEqual(normalizePlaceSegmentForMatch("United States"), "united states", "United States unaffected, matches the equivalence target");

// --- Real example 1: death location, live-reported directly ---
var raw1 = "Price Hill, Hamilton County, Ohio, USA";
var geo1 = { place: "", city: "Price Hill, Cincinnati", county: "Hamilton", state: "Ohio", country: "United States" };
assertEqual(computeLeftoverPlaceName(raw1, geo1), "", "Real case: 'USA' no longer survives as spurious leftover");

// --- Real example 2: burial/cemetery location, live-reported directly ---
var raw2 = "Adath Israel Cemetery, USA";
var geo2 = { place: "Adath Israel Cemetery", city: "", county: "", state: "", country: "United States" };
assertEqual(computeCombinedPlaceValue(raw2, geo2), "Adath Israel Cemetery",
    "Real case: Place field shows just the cemetery name, not 'Adath Israel Cemetery, USA'");

// --- Regression: a genuinely different, unmatched segment still survives
// (equivalence didn't turn off leftover detection entirely). ---
var raw3 = "Sagrario, Jalapa, Xalapa, Veracruz, México";
var geo3 = { place: "", city: "Xalapa-Enríquez, Xalapa", county: "", state: "Veracruz", country: "Mexico" };
assertEqual(computeLeftoverPlaceName(raw3, geo3), "Sagrario, Jalapa",
    "Regression: the original #260/#253 Sagrario case is unaffected by this fix");

// --- Regression: "us" as a normalized SUBSTRING inside an unrelated word
// (not its own discrete segment) must NOT get corrupted - equivalence is
// whole-segment-only, never a substring replace. ---
assertEqual(normalizePlaceSegmentForMatch("Russia"), "russia", "'Russia' (contains 'us' as a substring) is NOT mangled into anything else");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
