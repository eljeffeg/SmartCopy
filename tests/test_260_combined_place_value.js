// Verifies the corrected #260 fix, root-caused from DanCornett's actual
// before/after screenshots (downloaded and viewed directly): the
// visible-by-default "Place: " row (title:location:place_name_geo) only
// ever showed geo.place (whatever extractPlaceNameSegments() stripped as
// a recognized venue keyword) - genuinely blank whenever nothing matched
// a keyword, even with real leftover text sitting in a DIFFERENT row
// (title:location:place_name, "Baptism Place:") that's hidden by default
// whenever real geo fields resolve. computeCombinedPlaceValue() (shared.js)
// now feeds the visible row with BOTH pieces combined, in all three
// places that build a Place value: buildForm()'s focus-profile render,
// its family-member render, and updateGeoLocation() (the pencil-edit
// result handler, which incorrectly substituted PURE
// computeLeftoverPlaceName() in the original, wrong #253 fix - that
// silently loses a real stripped venue name, since that function
// deliberately excludes anything matching geo.place from its own output).
//
// Uses the EXACT geo shape from DanCornett's live screenshot (city
// "Xalapa-Enríquez, Xalapa" - Xalapa folded in as a settlement-type
// ancestor, per #237's own FS_SETTLEMENT_ANCESTOR_TYPES logic - and
// county genuinely blank), not the earlier assumed shape from an
// isolated curl test.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const buildformSrc = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');
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
function isValue(v) { return exists(v) && String(v).trim() !== ""; }

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
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// --- The exact real case from DanCornett's screenshots ---
var realRaw = "Sagrario, Jalapa, Xalapa, Veracruz, México";
var realGeo = { place: "", city: "Xalapa-Enríquez, Xalapa", county: "", state: "Veracruz", country: "Mexico" };
assertEqual(computeCombinedPlaceValue(realRaw, realGeo), "Sagrario, Jalapa",
    "Real screenshot case: no stripped venue, leftover alone fills the visible Place row");

// --- A case WITH a real stripped venue (the case the original, wrong
// #253 fix would have silently broken - computeLeftoverPlaceName() alone
// excludes anything matching geo.place from ITS OWN output). ---
var venueGeo = { place: "Oak Hill Cemetery", city: "Springfield", county: "Sangamon", state: "Illinois", country: "United States" };
assertEqual(computeCombinedPlaceValue("Oak Hill Cemetery, Springfield, Illinois", venueGeo), "Oak Hill Cemetery",
    "Regression: a real stripped venue with no OTHER leftover still shows correctly (the #253 fix would have shown '' here)");

// --- Both a venue AND separate leftover text present - previously
// impossible to see either without a rare toggle click; now both show,
// comma-joined, never duplicated (computeLeftoverPlaceName's own
// geo.place exclusion prevents double-inclusion). ---
var bothGeo = { place: "Oak Hill Cemetery", city: "Springfield", county: "Sangamon", state: "Illinois", country: "United States" };
assertEqual(computeCombinedPlaceValue("Sagrario, Oak Hill Cemetery, Springfield, Illinois", bothGeo), "Oak Hill Cemetery, Sagrario",
    "Venue AND separate leftover both present - combined, no duplication");

// --- Neither present - blank, as before. ---
var neitherGeo = { place: "", city: "Springfield", county: "Sangamon", state: "Illinois", country: "United States" };
assertEqual(computeCombinedPlaceValue("Springfield, Illinois", neitherGeo), "",
    "Nothing left over and no venue - blank, unchanged from prior behavior");

// --- Wiring: all three call sites (focus profile, family member,
// updateGeoLocation) use computeCombinedPlaceValue(), none still uses the
// wrong pure-computeLeftoverPlaceName() substitution from the original
// #253 fix. ---
var focusBlock = buildformSrc.slice(buildformSrc.indexOf('var hasGeoFields = isValue(city)'), buildformSrc.indexOf('locationval = locationval +\n                            \'<tr id="focus_'));
assertTrue(focusBlock.indexOf('computeCombinedPlaceValue(place, geovar1)') !== -1,
    "Focus profile render: placegeo now uses computeCombinedPlaceValue()");

var updateGeoLocationBody = extractFunction(buildformSrc, 'updateGeoLocation');
assertTrue(updateGeoLocationBody.indexOf('computeCombinedPlaceValue(locationdata.query, locationdata)') !== -1,
    "updateGeoLocation() (pencil-edit result) now uses computeCombinedPlaceValue(), not pure computeLeftoverPlaceName()");
assertTrue(updateGeoLocationBody.indexOf('computeLeftoverPlaceName(locationdata.query, locationdata)') === -1,
    "The original, wrong #253 substitution is fully gone from updateGeoLocation()");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
