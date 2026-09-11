// Verifies #249: computeLeftoverPlaceName() now preserves genuine prefix
// text glued onto a matched place name with no comma to split on, instead
// of discarding the whole segment. DanCornett's example: a burial location
// "at the crossroads 1 mile south of Springfield, Illinois" - "Springfield"
// resolves to City, "Illinois" resolves to State. Expected (per DanCornett,
// live discussion): Place keeps "at the crossroads 1 mile south of
// Springfield" whole - "Illinois" still correctly drops out (exact match to
// State), but "Springfield" is allowed to appear in both City and Place
// rather than trying to algorithmically split it out of the middle of real
// prose, which risks getting subtly wrong.
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

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label, '->', JSON.stringify(actual)); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// The live-discussed case itself.
var raw = "at the crossroads 1 mile south of Springfield, Illinois";
var geo = { place: "", city: "Springfield", county: "", state: "Illinois", country: "United States" };
assertEqual(computeLeftoverPlaceName(raw, geo), "at the crossroads 1 mile south of Springfield",
    "Glued prefix text survives whole (including 'Springfield'); 'Illinois' correctly drops out as an exact match to State");

// Regression: a segment that's an EXACT match to a field still correctly
// drops out entirely (this is the core behavior #249's fix must not break).
var rawExact = "Springfield, Illinois";
assertEqual(computeLeftoverPlaceName(rawExact, geo), "",
    "Regression: an exact-match segment ('Springfield' alone) still drops out cleanly - no leftover");

// Regression: state abbreviation equivalence (#260) still works via exact
// match after normalization - "IL" normalizes to "illinois", exactly
// matching the resolved state.
var rawAbbrev = "at the crossroads 1 mile south of Springfield, IL";
assertEqual(computeLeftoverPlaceName(rawAbbrev, geo), "at the crossroads 1 mile south of Springfield",
    "State abbreviation ('IL') still recognized as an exact-after-normalization match, dropped from leftover");

// Regression: County/Parish suffix mismatch (bare field vs suffixed
// segment, or vice versa) still matches - this is the real regression this
// same fix introduced and then had to specifically patch.
var rawCounty = "Somewhere, Hamilton County, Ohio";
var geoCounty = { place: "", city: "Somewhere", county: "Hamilton", state: "Ohio", country: "" };
assertEqual(computeLeftoverPlaceName(rawCounty, geoCounty), "",
    "Regression: 'Hamilton County' segment still matches a bare resolved county field 'Hamilton'");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
