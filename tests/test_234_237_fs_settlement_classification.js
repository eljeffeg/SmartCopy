// Verifies #234/#237: familySearchPlaceToGeoLocation()'s (parse-location.js)
// classification of FamilySearch's admin-hierarchy ancestors into City/
// County/State/Country. FS_SETTLEMENT_ANCESTOR_TYPES (a hardcoded list of
// place-type IDs) needed 5 separate live-bug-driven additions - each one a
// real case where an ancestor that LOOKS like it should be county/state
// turned out to itself be another settlement (a city, borough, or
// township), which would otherwise consume the county/state slot and push
// the real administrative jurisdiction out of the schema entirely (into
// leftover Place text, or just gone). Plus FS_MATCH_ADMIN_LEVEL, handling
// the case where the TOP-SCORED match itself is a county/state/country/
// colony, not a settlement at all. Complements the existing
// test_geo_fallback_and_warning.js coverage, which deliberately only
// exercises warningReason construction, not this classification logic.
// Extracts the real function verbatim - not a reimplementation.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const plSrc = fs.readFileSync(path.join(ROOT, 'parse-location.js'), 'utf8');

function exists(v) { return typeof v !== 'undefined' && v !== null; }
function isValue(v) { return v !== ""; }

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

// applyCountySuffix()/stripRedundantPlaceSuffix() only affect trailing
// " County"/" Parish" text normalization, unrelated to which ancestor
// lands in which field - stubbed as no-ops, same as the existing
// test_geo_fallback_and_warning.js does, so assertions here can check
// city/county/state/country directly without that separate concern
// interfering. The function's OWN internal FS_SETTLEMENT_ANCESTOR_TYPES/
// FS_MATCH_ADMIN_LEVEL declarations are real and verbatim - they're
// declared INSIDE the function body itself, not passed in.
function build() {
    const deps = { exists: exists, isValue: isValue, applyCountySuffix: function () {}, stripRedundantPlaceSuffix: function (p) { return p; } };
    const body = extractFunction(plSrc, 'familySearchPlaceToGeoLocation');
    return new Function(Object.keys(deps).join(','), 'return ' + body).apply(null, Object.values(deps));
}
const familySearchPlaceToGeoLocation = build();

// A "places" array entry - places[0] is the matched place itself (has a
// .display object); ancestors (places[1..]) are plain {names, type} nodes
// with no .display, matching the real FamilySearch API shape this
// function's own comments describe.
function settlement(name, typeId) { return { names: [{ value: name }], type: 'https://familysearch.org/platform/places/type/' + typeId }; }
function matched(name, displayType) { return { names: [{ value: name }], display: { name: name, fullName: name, type: displayType } }; }

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// Note: the LAST ancestor in `places` is always consumed as Country first
// (unconditionally, before any settlement/county/state logic runs) - every
// scenario below that wants a real County+State result needs a trailing
// country-level ancestor too, matching the real 4-level US hierarchy
// (settlement/county/state/country) these bugs were actually found on.

// --- #234: a neighborhood inside a city (Cincinnati/Price Hill) - city ancestor (type 186) must fold into City, not consume the County slot ---
{
    const places = [
        matched('Price Hill', 'Neighborhood'),
        settlement('Cincinnati', '186'),   // City - must be skipped/folded into City
        settlement('Hamilton', '209'),     // real County
        settlement('Ohio', '362'),         // real State
        settlement('United States', '')
    ];
    const loc = familySearchPlaceToGeoLocation(places, 'q', '', false, false);
    assertEqual(loc.city, 'Price Hill, Cincinnati', "#234: Cincinnati (type 186, a settlement) folds into City alongside the matched neighborhood, instead of wrongly consuming the County slot");
    assertEqual(loc.county, 'Hamilton', "The REAL county (Hamilton) still ends up in County, not pushed out by Cincinnati");
    assertEqual(loc.state, 'Ohio', "The REAL state still ends up in State");
}

// --- #237: an NYC borough (Manhattan) has "New York City" (type 520, Major City) as an ancestor with no real county surfaced at all ---
{
    const places = [
        matched('Manhattan', 'Borough'),
        settlement('New York City', '520'),
        settlement('New York', '362'),
        settlement('United States', '')
    ];
    const loc = familySearchPlaceToGeoLocation(places, 'q', '', false, false);
    assertEqual(loc.city, 'Manhattan, New York City', "#237: New York City (type 520) folds into City rather than wrongly becoming the County - FamilySearch's NYC hierarchy never surfaces a real county to extract here");
    assertEqual(loc.county, '', "No real county exists in this hierarchy - correctly left blank rather than filled with the wrong value");
    assertEqual(loc.state, 'New York', "State still resolves correctly");
}

// --- #277 follow-up: a Midwest civil township (type 378) sits between the settlement and the real county ---
{
    const places = [
        matched('Monroeville', 'Town'),
        settlement('Monroe Township', '378'),
        settlement('Allen', '209'),
        settlement('Indiana', '362'),
        settlement('United States', '')
    ];
    const loc = familySearchPlaceToGeoLocation(places, 'q', '', false, false);
    assertEqual(loc.city, 'Monroeville, Monroe Township', "The township (type 378) folds into City instead of consuming the County slot");
    assertEqual(loc.county, 'Allen', "The real county (Allen) is NOT pushed out - this was the original live symptom (the real state fell through to leftover Place text)");
    assertEqual(loc.state, 'Indiana', "The real state is still correctly resolved, not displaced by the township/county shift");
}

// --- #237: the top-scored match itself is a bare County (Accomack) ---
{
    const places = [matched('Accomack', 'County'), settlement('Virginia', '362'), settlement('United States', '')];
    const loc = familySearchPlaceToGeoLocation(places, 'q', '', false, false);
    assertEqual(loc.county, 'Accomack', "#237: a bare county top-match lands in County, not City");
    assertEqual(loc.city, '', "City correctly stays blank - nothing more specific than the county itself was matched");
    assertEqual(loc.state, 'Virginia', "State still resolves from the remaining (non-country) ancestor");
    assertEqual(loc.country, 'United States', "Country still resolves from the trailing ancestor");
}

// --- #237: the top-scored match itself is a bare State (Pennsylvania) ---
{
    const places = [matched('Pennsylvania', 'State'), settlement('United States', '362')];
    const loc = familySearchPlaceToGeoLocation(places, 'q', '', false, false);
    assertEqual(loc.state, 'Pennsylvania', "A bare state top-match lands in State, not City");
    assertEqual(loc.city, '', "City correctly stays blank");
}

// --- #237 follow-up: a colonial-era "Colony" match (Virginia, pre-statehood) ---
{
    const places = [matched('Virginia, British Colonial America', 'Colony')];
    const loc = familySearchPlaceToGeoLocation(places, 'q', '', false, false);
    assertEqual(loc.state, 'Virginia, British Colonial America', "#237: a 'Colony' type match is mapped into State (the closest fit in Geni's 4-field schema), not left unclassified in City");
}

// --- #237 follow-up: a bare Country match with nothing more specific ---
{
    const places = [matched('United States', 'Country')];
    const loc = familySearchPlaceToGeoLocation(places, 'q', '', false, false);
    assertEqual(loc.country, 'United States', "#237: a bare country top-match lands in Country");
    assertEqual(loc.city, '', "City/county/state all stay blank - nothing more specific than a bare country was actually matched");
    assertEqual(loc.county, '', "");
    assertEqual(loc.state, '', "");
}

// --- #277 follow-up (live-reported, DanCornett; live-confirmed via direct
// API query): "Cornwall, England, United Kingdom" put Cornwall in City
// instead of County. FamilySearch's real display.type for English/Welsh
// counties (Cornwall, Yorkshire, and Kent all confirmed live) is the
// qualified "County (Top level)", not the plain "County" a US county
// actually uses - an exact-string match against FS_MATCH_ADMIN_LEVEL
// missed it entirely. ---
{
    const places = [matched('Cornwall', 'County (Top level)'), settlement('England', '580'), settlement('United Kingdom', '580')];
    const loc = familySearchPlaceToGeoLocation(places, 'q', '', false, false);
    assertEqual(loc.county, 'Cornwall', "#277: a qualified 'County (Top level)' display.type is still recognized as County, not City");
    assertEqual(loc.state, 'England', "State correctly resolves from the immediate ancestor");
    assertEqual(loc.country, 'United Kingdom', "Country correctly resolves from the trailing ancestor");
    assertEqual(loc.city, '', "City correctly stays blank - this was the actual reported bug (Cornwall landing here instead)");
}

// Yorkshire and Kent - same live-confirmed qualified type, confirming this
// isn't a Cornwall-specific fix.
{
    const places = [matched('Yorkshire', 'County (Top level)'), settlement('England', '580'), settlement('United Kingdom', '580')];
    const loc = familySearchPlaceToGeoLocation(places, 'q', '', false, false);
    assertEqual(loc.county, 'Yorkshire', "#277: Yorkshire (also 'County (Top level)' live) resolves to County too, not just Cornwall specifically");
}

// A plain, unqualified "County" (the ordinary US case, e.g. #237's own
// Accomack, Virginia) must still work exactly as before - the fix only
// ADDS recognition of the qualified form, it doesn't change the plain one.
{
    const places = [matched('Accomack', 'County'), settlement('Virginia', '362')];
    const loc = familySearchPlaceToGeoLocation(places, 'q', '', false, false);
    assertEqual(loc.county, 'Accomack', "Regression control: a plain, unqualified 'County' still resolves to County exactly as before");
}

// --- #277 follow-up (live-reported, DanCornett; live-confirmed via direct
// API query): "England, United Kingdom" put England in Country and left
// "United Kingdom" as stray leftover Place text. England/Scotland/Wales/
// Northern Ireland all resolve with display.type "Country" - the same
// type a genuine sovereign country gets - but each has a real ancestor
// ("United Kingdom", itself also FamilySearch type 580/Country) where a
// true sovereign country (Germany, the United States - both live-
// confirmed) has none at all. Detected generically by ancestor type, not
// a hardcoded UK country-name list. ---
{
    const places = [matched('England', 'Country'), settlement('United Kingdom', '580')];
    const loc = familySearchPlaceToGeoLocation(places, 'q', '', false, false);
    assertEqual(loc.state, 'England', "#277: England (Country-typed, but with a Country-typed ancestor) is treated as State, not Country");
    assertEqual(loc.country, 'United Kingdom', "#277: the real country (United Kingdom) is correctly picked up from the ancestor - this was the actual reported bug (United Kingdom being lost/misplaced)");
    assertEqual(loc.city, '', "City stays blank - nothing more specific than England itself was matched");
    assertEqual(loc.county, '', "County stays blank too");
}

// Scotland/Wales/Northern Ireland - confirming this isn't England-specific.
['Scotland', 'Wales', 'Northern Ireland'].forEach(function (country) {
    const places = [matched(country, 'Country'), settlement('United Kingdom', '580')];
    const loc = familySearchPlaceToGeoLocation(places, 'q', '', false, false);
    assertEqual(loc.state, country, "#277: " + country + " (same UK-constituent-country shape) also resolves to State, not just England specifically");
    assertEqual(loc.country, 'United Kingdom', "#277: " + country + "'s real country (United Kingdom) is correctly recovered too");
});

// A genuine sovereign country (no ancestor at all) must still resolve to
// Country exactly as before - the fix only downgrades a Country match that
// itself has a Country-typed ancestor, never a country with none.
{
    const places = [matched('Germany', 'Country')];
    const loc = familySearchPlaceToGeoLocation(places, 'q', '', false, false);
    assertEqual(loc.country, 'Germany', "Regression control: a genuine sovereign country with no ancestor at all still resolves to Country, unaffected by the UK fix");
    assertEqual(loc.state, '', "State correctly stays blank for a real bare-country match");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
