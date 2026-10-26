// Verifies #357 (live-reported by the user, not Dan): a large tree copy
// forced manually deselecting the "Place" field on every single person,
// because the raw scraped location's county/state segments used CURRENT-
// day administrative names while FamilySearch's historical place
// resolution correctly filled City/County/State/Country with the
// HISTORICALLY accurate names for the record's own date - two genuinely
// different administrative names for the same two jurisdiction levels,
// not spelling variants, so computeLeftoverPlaceName()'s value-based
// matching (segmentMatchesAnyField()) could never recognize them as the
// same thing and kept surfacing the current-day names as "leftover,"
// pre-selecting Place on every person.
//
// Exact reported case: raw scraped "Rexingen, Freudenstadt, Baden-
// Württemberg, Germany" (modern Kreis "Freudenstadt", modern Land "Baden-
// Württemberg" - merged from Baden and Württemberg only in 1952) against
// FamilySearch's historically correct resolution for the record's date:
// City=Rexingen, County=Horb am Neckar, State=Württemberg, Country=
// Germany (the full historical chain is actually five levels - "Rexingen,
// Horb am Neckar, Oberamt Horb, Württemberg, Germany" - with "Oberamt
// Horb" folded away during FamilySearch's own 5-into-4 field mapping,
// same class of thing as the pre-existing "Potsdam"/"Preussen" case
// below).
//
// Fix: when the raw segment count EXACTLY matches how many jurisdiction
// levels resolved (city/county/state/country all non-blank here), every
// raw segment must correspond to one of those levels by position - safe
// to treat the whole string as fully accounted for regardless of text.
// The moment the counts differ (a genuine extra level is in play, or
// real leading venue/address text), falls through to the ORIGINAL
// value-based matching completely unchanged - which is exactly why the
// function's own original motivating case must NOT regress: "Storkow
// (Mark), Kr. Beeskow-Storkow, Potsdam, Brandenburg, Preussen" (5 raw
// segments) against 4 resolved fields (City=Storkow, County=Beeskow-
// Storkow, State=Brandenburg, Country=Germany) is a count MISMATCH (5 vs
// 4), so "Potsdam" and "Preussen" still correctly survive as leftover,
// same as before this fix - they're genuine extra historical context the
// resolved 4 fields don't otherwise capture, not administrative noise.
//
// Uses the REAL extracted computeLeftoverPlaceName()/segmentMatchesAnyField()
// and their real dependencies verbatim - same extraction harness as
// tests/test_260_combined_place_value.js.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
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

// --- #357: the exact reported case - current-day names fully superseded by historical resolution, nothing should be left over. ---
assertEqual(
    computeLeftoverPlaceName("Rexingen, Freudenstadt, Baden-Württemberg, Germany",
        { place: "", city: "Rexingen", county: "Horb am Neckar", state: "Württemberg", country: "Germany" }),
    "",
    "#357: 4 raw segments against 4 resolved jurisdiction levels (all non-blank) - 'Freudenstadt'/'Baden-Württemberg' are the current-day names for the same two levels FamilySearch resolved historically as 'Horb am Neckar'/'Württemberg', not genuine extra content - no longer surfaces as leftover"
);

// --- Safety: the function's own ORIGINAL motivating case must not regress - a genuine extra historical level (count mismatch) still survives. ---
assertEqual(
    computeLeftoverPlaceName("Storkow (Mark), Kr. Beeskow-Storkow, Potsdam, Brandenburg, Preussen",
        { place: "", city: "Storkow (Mark)", county: "Kr. Beeskow-Storkow", state: "Brandenburg", country: "Germany" }),
    "Potsdam, Preussen",
    "Safety: 5 raw segments against only 4 resolved fields (Potsdam is a genuine EXTRA level FamilySearch's own 5-into-4 mapping folded away, Preussen is the historical country name) - a count MISMATCH, so this correctly falls through to the original value-based matching and both still survive as leftover, exactly as before this fix"
);

// --- Safety: the #260 venue case (real screenshot) must not regress - a count mismatch (blank county) still preserves genuine venue/address text. ---
assertEqual(
    computeLeftoverPlaceName("Sagrario, Jalapa, Xalapa, Veracruz, México",
        { place: "", city: "Xalapa-Enríquez, Xalapa", county: "", state: "Veracruz", country: "Mexico" }),
    "Sagrario, Jalapa",
    "Safety: 5 raw segments against only 3 non-blank resolved fields (county blank) - a count mismatch, so 'Sagrario, Jalapa' (genuine venue/leftover text, the real #260 screenshot case) still correctly survives, unaffected by this fix"
);

// --- Safety: a simple, already-clean match (segment count equals field count, everything textually matches too) stays blank either way. ---
assertEqual(
    computeLeftoverPlaceName("Springfield, Sangamon, Illinois, United States",
        { place: "", city: "Springfield", county: "Sangamon", state: "Illinois", country: "United States" }),
    "",
    "Safety: an ordinary, already-matching 4-segment location (no historical/modern naming conflict at all) stays correctly blank, same as before this fix"
);

// --- Safety: a 2-segment raw location with only 2 resolved fields (e.g. city+country, no county/state ever existed) still count-matches and drops cleanly. ---
assertEqual(
    computeLeftoverPlaceName("Paris, France", { place: "", city: "Paris", county: "", state: "", country: "France" }),
    "",
    "Safety: a short, 2-segment location with only 2 non-blank fields (county/state genuinely never existed) still count-matches 2-for-2 and correctly stays blank"
);

// --- Safety (the two real regressions a first, count-only version of this fix introduced - caught by the existing suite, not hypothetical): a coincidental count match is not enough on its own, both end anchors must independently confirm too. ---
assertEqual(
    computeLeftoverPlaceName("Sagrario, Oak Hill Cemetery, Springfield, Illinois",
        { place: "Oak Hill Cemetery", city: "Springfield", county: "Sangamon", state: "Illinois", country: "United States" }),
    "Sagrario",
    "Safety (real regression caught by test_260_combined_place_value.js, via computeCombinedPlaceValue() which also re-adds geo.place separately): 4 raw segments happen to equal 4 non-blank jurisdiction fields, but 'Sagrario' (the FIRST raw segment) doesn't match city 'Springfield' at all - it's genuine venue text, not an administrative level - so the first-anchor check fails and this correctly falls through to preserve it (computeLeftoverPlaceName() itself always excludes geo.place from its own output, by design - 'Oak Hill Cemetery' drops via that existing rule, not this fix), instead of being wrongly swept away just because the count happened to match"
);
assertEqual(
    computeLeftoverPlaceName("Somewhere, USA", { place: "", city: "Somewhere", county: "", state: "", country: "Germany" }),
    "USA",
    "Safety (real regression caught by test_270_historical_country.js): 2 raw segments happen to equal 2 non-blank fields, and the FIRST segment 'Somewhere' does match city - but the LAST segment 'USA' does NOT represent country 'Germany' under any equivalence rule (a genuinely wrong/unrelated country, not an era-naming difference), so the last-anchor check fails and 'USA' correctly survives instead of being silently dropped as if the mismatch were just historical naming"
);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
