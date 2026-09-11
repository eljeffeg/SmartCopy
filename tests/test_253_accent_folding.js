// Verifies #253: normalizePlaceSegmentForMatch() folds accented letters
// to their ASCII base so "México" correctly matches a resolved "Mexico",
// rather than being ASCII-stripped into two broken word fragments that
// match nothing. (The updateGeoLocation()/Place-row behavior this file
// used to also cover was superseded by #260's fix - see
// test_260_combined_place_value.js for the corrected, currently-accurate
// version of that.)
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
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

assertEqual(normalizePlaceSegmentForMatch("México"), "mexico", "Accented segment folds to plain-ASCII base");
assertEqual(normalizePlaceSegmentForMatch("Mexico"), "mexico", "Unaccented segment unaffected, matches the folded form");
assertTrue(segmentMatchesAnyField("México", ["", "", "", "", "Mexico"]), "Accented raw segment now matches an unaccented resolved country field");

// Real live-captured case (curl against the FS API directly).
var realGeo = { place: "", city: "Xalapa-Enríquez", county: "Xalapa", state: "Veracruz", country: "Mexico" };
var realRaw = "Sagrario, Jalapa, Xalapa, Veracruz, México";
assertEqual(computeLeftoverPlaceName(realRaw, realGeo), "Sagrario, Jalapa",
    "Live-captured Sagrario case: leftover is exactly the two genuinely-unmatched segments, no false 'México' duplicate");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
