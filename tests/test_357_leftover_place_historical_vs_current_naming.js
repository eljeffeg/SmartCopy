// Verifies #357 (live-reported by the user): a large tree copy required
// manually deselecting the "Place" field on every single person, because
// the raw scraped location's county/state segments used current-day
// administrative names while FamilySearch's historical place resolution
// correctly filled City/County/State/Country with the historically
// accurate names for the record's own date - "Freudenstadt, Baden-
// Württemberg" (modern Kreis/Land names) vs. the historically resolved
// "Horb am Neckar, Württemberg" for a 19th-century German record.
//
// Two earlier designs were tried and both had real, confirmed gaps before
// shipping (a count-only check broke two already-correct cases the
// regression suite itself caught; a three-condition anchor check - count
// plus matching both the first AND last raw segment - broke on real
// FamilySearch data for pre-1871 German records, where "Germany" itself
// doesn't exist in the resolved hierarchy at all, since the country
// didn't exist yet, and no per-country lookup table of unification dates
// would generalize).
//
// Settled on the user's own explicit design instead, after walking
// through several real examples together: ONLY leading content (whatever
// comes before the raw text reaches something SmartCopy already
// recognizes as part of the structured City/County/State/Country chain)
// is worth showing in Place at all. The moment the scan reaches a segment
// that matches ANY resolved field, that segment and everything after it
// is dropped unconditionally - no further per-segment judgment calls
// about whether a later mismatch is a legitimate historical variant or a
// genuinely wrong match, since that question turned out to have no
// reliable, generalizable answer. A city-level historical/modern variant
// ("Poznan" vs. a resolved historical "Posen") correctly survives as
// leading content under this rule, same as genuine venue/address text.
//
// Deliberate, explicitly-accepted trade-offs from this redesign (not
// bugs - see the "Safety: redesign trade-off" cases below): the
// function's own ORIGINAL motivating case ("Potsdam"/"Preussen", #224 -
// genuine extra historical levels beyond the 4 resolved fields) no longer
// survives as leftover, since it's trailing content; and a genuinely
// WRONG/unrelated country match ("Somewhere, USA" resolving against an
// unrelated "Germany") also no longer survives as a visible red flag,
// since it's trailing too. Both are now acceptable because Place is ALSO
// never pre-selected at all (see the render-time checkedAttr changes in
// buildform.js) - losing this leftover text is a lost secondary data
// point, not an accidental-submission risk either way.
//
// Uses the REAL extracted computeLeftoverPlaceName()/segmentMatchesAnyField()
// and their real dependencies verbatim - same technique as
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
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- #357: the exact reported case - the raw text's first segment matches the resolved city, so the scan stops immediately and nothing trailing ever shows. ---
assertEqual(
    computeLeftoverPlaceName("Rexingen, Freudenstadt, Baden-Württemberg, Germany",
        { place: "", city: "Rexingen", county: "Horb am Neckar", state: "Württemberg", country: "Germany" }),
    "",
    "#357: 'Rexingen' matches the resolved city immediately - the scan stops at position 0, so 'Freudenstadt, Baden-Württemberg, Germany' never shows, regardless of whether any of those individual words match anything"
);

// --- #357: confirmed from REAL FamilySearch API data (pre-1871 German record) - country itself can be historically variable, not just county/state, and the fix still works because it never needs the country to match anything at all. ---
assertEqual(
    computeLeftoverPlaceName("Oberndorf am Neckar, Rottweil, Baden-Württemberg, Germany",
        { place: "", city: "Oberndorf am Neckar", county: "", state: "Oberndorf", country: "Württemberg" }),
    "",
    "#357: real pre-1871 FamilySearch resolution (no 'Germany' anywhere in the hierarchy, country resolved to the historical state 'Württemberg' instead) still correctly drops everything, since 'Oberndorf am Neckar' alone is enough to stop the scan at position 0"
);

// --- The Poznan/Posen example: a CITY-level historical/modern variant, confirmed to survive as leading content since it never matches anything, stopping the scan. ---
assertEqual(
    computeLeftoverPlaceName("Poznan, Wielkopolskie, Poland",
        { place: "", city: "Posen", county: "", state: "Provinz Posen", country: "Prussia" }),
    "Poznan, Wielkopolskie, Poland",
    "A city-level historical/modern name variant ('Poznan' vs. resolved 'Posen') correctly survives as leading content, same as genuine venue text would - since nothing in this raw string happens to textually match the resolved fields, the scan never finds a stopping point and the whole string shows, unchecked (Place is never pre-selected regardless - see buildform.js)"
);

// --- Safety: the real #260 screenshot case (genuine leading venue text, no historical-naming question involved at all) is completely unaffected. ---
assertEqual(
    computeLeftoverPlaceName("Sagrario, Jalapa, Xalapa, Veracruz, México",
        { place: "", city: "Xalapa-Enríquez, Xalapa", county: "", state: "Veracruz", country: "Mexico" }),
    "Sagrario, Jalapa",
    "Safety: the real #260 screenshot case - 'Sagrario' and 'Jalapa' both survive as genuine leading venue text, stopping only once 'Xalapa' matches part of the resolved (comma-containing) city value"
);

// --- Safety: a leading segment that duplicates geo.place (already shown separately) is skipped without ending the scan - Place isn't a hierarchy boundary. ---
assertEqual(
    computeLeftoverPlaceName("Sagrario, Oak Hill Cemetery, Springfield, Illinois",
        { place: "Oak Hill Cemetery", city: "Springfield", county: "Sangamon", state: "Illinois", country: "United States" }),
    "Sagrario",
    "Safety: 'Oak Hill Cemetery' (already shown via geo.place, computeCombinedPlaceValue()'s job to re-add it) is correctly skipped without stopping the scan - 'Sagrario' still survives, and the scan correctly continues past it to find 'Springfield' matching city"
);

// --- Safety: an ordinary, already-clean match has nothing leading at all. ---
assertEqual(
    computeLeftoverPlaceName("Springfield, Sangamon, Illinois, United States",
        { place: "", city: "Springfield", county: "Sangamon", state: "Illinois", country: "United States" }),
    "",
    "Safety: an ordinary, already-matching location has nothing leading - the very first segment matches city, so nothing ever shows"
);

// --- Safety (redesign trade-off, deliberately accepted - see comment above): the function's own ORIGINAL motivating case no longer survives, since it's trailing content now. ---
assertEqual(
    computeLeftoverPlaceName("Storkow (Mark), Kr. Beeskow-Storkow, Potsdam, Brandenburg, Preussen",
        { place: "", city: "Storkow (Mark)", county: "Kr. Beeskow-Storkow", state: "Brandenburg", country: "Germany" }),
    "",
    "Safety (redesign trade-off, explicitly accepted): 'Potsdam'/'Preussen' no longer survive - 'Storkow (Mark)' matches the resolved city immediately, stopping the scan before reaching them, even though they're a genuine extra historical level the structured fields don't otherwise capture"
);

// --- Safety (redesign trade-off, deliberately accepted): a genuinely wrong/unrelated country match no longer survives as a visible red flag either, since it's also trailing content. ---
assertEqual(
    computeLeftoverPlaceName("Somewhere, USA", { place: "", city: "Somewhere", county: "", state: "", country: "Germany" }),
    "",
    "Safety (redesign trade-off, explicitly accepted): 'USA' no longer survives even though the resolved country ('Germany') is genuinely unrelated, not a historical variant - 'Somewhere' matching city is now trusted enough on its own to stop the scan; Place never being pre-selected means this is a lost secondary data point, not a silent-submission risk"
);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
