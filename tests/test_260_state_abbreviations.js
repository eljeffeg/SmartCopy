// Verifies a #260 follow-up found proactively (not yet live-reported):
// the exact same abbreviation-matching gap as USA/US also affects US
// state postal codes, and INCONSISTENTLY - "IL" happened to already
// match a resolved "Illinois" by sheer substring coincidence
// ("illinois" starts with "il"), but "NY" did NOT match "New York" (no
// "ny" substring exists once the space between "new" and "york" is in
// the way), confirmed directly before this fix. Standard USPS two-letter
// codes are unambiguous, standardized data, not a guessed translation -
// added in full rather than waiting for each unlucky state to get its
// own bug report.
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

// The specific case confirmed broken BEFORE this fix: "NY" shares no
// substring with a resolved "New York".
var rawNY = "Brooklyn, Kings County, NY, USA";
var geoNY = { place: "", city: "Brooklyn", county: "Kings", state: "New York", country: "United States" };
assertEqual(computeLeftoverPlaceName(rawNY, geoNY), "", "NY -> New York now recognized (previously leaked through as 'NY')");

// A spot check across several other states, including ones that would
// have accidentally worked before (IL) and ones that would not have (MA
// happened to accidentally work too - "massachusetts" starts with "ma").
var cases = [
    { abbr: "TX", full: "Texas" },
    { abbr: "CA", full: "California" },
    { abbr: "PA", full: "Pennsylvania" },
    { abbr: "WA", full: "Washington" },
    { abbr: "OH", full: "Ohio" },
    { abbr: "ME", full: "Maine" }
];
cases.forEach(function (c) {
    var raw = "Somewhere, Somecounty, " + c.abbr + ", USA";
    var geo = { place: "", city: "Somewhere", county: "Somecounty", state: c.full, country: "United States" };
    assertEqual(computeLeftoverPlaceName(raw, geo), "", c.abbr + " -> " + c.full + " recognized, no spurious leftover");
});

// Regression: a genuinely unresolved segment (not a state abbreviation
// at all) still correctly survives as leftover.
var rawUnresolved = "Somewhere, Somecounty, XY, ZZ Nation";
var geoUnresolved = { place: "", city: "Somewhere", county: "Somecounty", state: "", country: "" };
assertEqual(computeLeftoverPlaceName(rawUnresolved, geoUnresolved), "XY, ZZ Nation",
    "Regression: a genuinely unrecognized 2-letter token (not a real US state code) still survives as leftover");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
