// Verifies #270: "USA"/"US" in raw scraped text is recognized as
// representing FamilySearch's own historically-accurate predecessor
// country names ("Republic of Texas", "British Colonial America"), not
// just literal "United States" - live-reported case: Charles Zanco's 1836
// death location "San Antonio, Bexar County, Texas, USA" resolves Country
// to "Republic of Texas" (period-correct for the Texas Revolution era),
// but "USA" was showing up as spurious leftover Place text since it only
// matched literal "United States" before this fix.
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

// The live-reported case itself.
var raw = "San Antonio, Bexar County, Texas, USA";
var geo = { place: "", city: "The Alamo, San Antonio", county: "Bexar County", state: "Texas", country: "Republic of Texas" };
assertEqual(computeLeftoverPlaceName(raw, geo), "",
    "'USA' recognized as representing 'Republic of Texas' - no spurious leftover");

// British Colonial America - same mechanism, different historical era.
var rawColonial = "Westmoreland, Virginia, USA";
var geoColonial = { place: "", city: "", county: "Westmoreland County", state: "Virginia", country: "British Colonial America" };
assertEqual(computeLeftoverPlaceName(rawColonial, geoColonial), "",
    "'USA' also recognized as representing 'British Colonial America'");

// Regression: modern "United States" case (#260) still works exactly as
// before this fix.
var rawModern = "Springfield, Illinois, USA";
var geoModern = { place: "", city: "Springfield", county: "", state: "Illinois", country: "United States" };
assertEqual(computeLeftoverPlaceName(rawModern, geoModern), "",
    "Regression: 'USA' -> 'United States' (the #260 case) still works unchanged");

// Regression: a genuinely different, unrelated country is never matched
// just because the segment says "USA".
var rawWrongCountry = "Somewhere, USA";
var geoWrongCountry = { place: "", city: "Somewhere", county: "", state: "", country: "Germany" };
assertEqual(computeLeftoverPlaceName(rawWrongCountry, geoWrongCountry), "USA",
    "Regression: 'USA' does NOT match an unrelated country ('Germany') - stays as genuine leftover");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
