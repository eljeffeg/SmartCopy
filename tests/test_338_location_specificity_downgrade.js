// Verifies #338 (live-reported, DanCornett): the focus profile's location
// fields (City/County/State/Country/Latitude/Longitude) pre-selected
// purely because the raw values differed, even when the scraped location
// was genuinely LESS detailed than what Geni already had - e.g. Geni has
// "Fort Worth, Tarrant County, Texas, United States" and the source only
// gives "Texas, United States". Dan's own example and settled design
// (after discussing two alternatives): rank which of City (1, most
// detailed) / County (2) / State (3) / Country (4, least detailed) is the
// most granular NON-BLANK field present, for both the scraped side and
// Geni's side, looking only at presence/blankness, never field content.
// A scraped location with a WORSE (higher) rank than Geni's never
// pre-selects any of those six fields - Place/place_name_geo are
// deliberately excluded (Dan's own note: Place can hold non-location
// content unrelated to geographic precision). Equal rank leaves today's
// existing value-based comparison untouched.
//
// Also verifies the accompanying warning: the location pin now shows
// yellow with "Location appears less precise than current Geni location"
// when a downgrade is detected and nothing more urgent (an ambiguous or
// failed lookup) already claimed the pin.
//
// Scope note: this pass covers the FOCUS profile only. A family member's
// location fields are pre-selected in two separate stages - an initial
// render with no Geni comparison data available at all (a match isn't
// confirmed yet), then a later per-FIELD resync once matched
// (refreshFieldCheckState(), buildform.js) that has no visibility into
// its OWN sibling location fields, only the one field it's called for.
// This specificity check needs all four City/County/State/Country values
// on both sides at once, which the family-member resync path isn't
// structured to provide without a larger refactor - deliberately not
// attempted here, flagged as a known follow-up instead of guessed at.
//
// Extracts the REAL functions verbatim (not reimplementations).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

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

function isValue(v) { return v !== ""; }
const getLocationSpecificity = new Function('isValue', 'return ' + extractFunction(bfSrc, 'getLocationSpecificity'))(isValue);
const isLocationSpecificityDowngrade = new Function('getLocationSpecificity', 'return ' + extractFunction(bfSrc, 'isLocationSpecificityDowngrade'))(getLocationSpecificity);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// --- getLocationSpecificity(): ranks by most-granular non-blank field ---
assertEqual(getLocationSpecificity("Fort Worth", "Tarrant County", "Texas", "United States"), 1, "City present - specificity 1, most detailed");
assertEqual(getLocationSpecificity("", "Tarrant County", "Texas", "United States"), 2, "No City, County present - specificity 2");
assertEqual(getLocationSpecificity("", "", "Texas", "United States"), 3, "Only State and Country present - specificity 3");
assertEqual(getLocationSpecificity("", "", "", "United States"), 4, "Only Country present - specificity 4, least detailed");
assertEqual(getLocationSpecificity("", "", "", ""), 0, "Nothing at all present - specificity 0 (no detail), never a downgrade or upgrade");

// --- #338 (2026-10-17): Dan's exact example - scraped "Texas, United States" is less detailed than Geni's full city/county/state/country ---
assertTrue(isLocationSpecificityDowngrade("", "", "Texas", "United States", "Fort Worth", "Tarrant County", "Texas", "United States"),
    "#338: a scraped location with only State/Country is a downgrade from Geni's full City/County/State/Country");

// --- Dan's own stated rule: equal specificity is NOT a downgrade, regardless of whether the actual values differ ---
assertTrue(!isLocationSpecificityDowngrade("Dallas", "Dallas County", "Texas", "United States", "Fort Worth", "Tarrant County", "Texas", "United States"),
    "Equal specificity (both have City+County+State+Country) is never a downgrade, even though the actual city/county genuinely differ - today's value-based comparison decides that case, unchanged");

// --- Safety: a scraped location MORE detailed than Geni's is never a downgrade (an upgrade should still pre-select) ---
assertTrue(!isLocationSpecificityDowngrade("Fort Worth", "Tarrant County", "Texas", "United States", "", "", "Texas", "United States"),
    "Safety: a scraped location MORE detailed than Geni's existing one is not a downgrade - an upgrade still pre-selects normally");

// --- Safety: Geni having nothing at all is never treated as a downgrade (nothing to protect, any real scraped detail is new information) ---
assertTrue(!isLocationSpecificityDowngrade("", "", "Texas", "United States", "", "", "", ""),
    "Safety: when Geni has no location detail at all, a scraped location is never a 'downgrade' - there's nothing to protect");

// --- Safety: scraped having nothing at all is never treated as a downgrade either (isValue() upstream already guards a genuinely blank scrape) ---
assertTrue(!isLocationSpecificityDowngrade("", "", "", "", "Fort Worth", "Tarrant County", "Texas", "United States"),
    "Safety: a scraped side with zero location detail at all is not itself flagged as a 'downgrade' - defense in depth, isValue() upstream already keeps a blank scrape from pre-selecting");

// --- Structural: wired into the focus profile's City/County/State/Country/Latitude/Longitude checked+enabled calls, but NOT Place/place_name_geo ---
{
    ["city", "county", "state", "country", "latitude", "longitude"].forEach(function (field) {
        var pattern = new RegExp('checkedAttr: isChecked\\(' + field + ', geoScored, geoone, genifocusdata\\.get\\(title, "location\\.' + field + '"\\), locationlocked, locationSpecificityDowngrade \\|\\|');
        assertTrue(pattern.test(bfSrc), "#338: the focus profile's " + field + " row OR's locationSpecificityDowngrade into its sameAsGeni argument");
    });
    // #357 redesign (live-reported by the user): Place's own checked
    // computation isn't just "untouched by #338" anymore - it's never a
    // function of locationSpecificityDowngrade at all, so it was never
    // going to interact with this specific check either way.
    assertTrue(bfSrc.indexOf('enabledAttr: isEnabled(itemPlaceNameValue, placeScored, false, genifocusdata.get(title, "location_string")') !== -1,
        "#357: the focus profile's Place row still computes its own editable/enabled state normally");
    // #357 follow-up (live-reported, DanCornett): Place's blanket "never
    // pre-select" went further than asked - the focus profile's own Place
    // row now runs isPlaceEligibleForPreselection() instead of a hardcoded
    // "", since real Geni comparison data is already known at render time
    // for an already-matched focus profile (see that function's own
    // comment). A family member has no confirmed match yet at initial
    // render, so it still hardcodes "" there and picks up the same
    // conditional rule later, through refreshFieldCheckState()'s resync.
    assertTrue(bfSrc.indexOf('checkedAttr: isPlaceEligibleForPreselection(itemPlaceNameValue, false, genifocusdata.get(title, "location_string"), hasGeoFields, isGeniLocationEntirelyBlank(') !== -1,
        "#357 follow-up: the focus profile's Place row now conditionally pre-selects via isPlaceEligibleForPreselection(), not a hardcoded \"\"");
    assertEqual((bfSrc.match(/checkedAttr: "",\n\s+enabledAttr: isEnabled\(itemPlaceNameValue/g) || []).length, 1,
        "#357 follow-up: only the family-member render still hardcodes \"\" for Place at render time - deferred to the resync path, which has real Geni data by then");
}

// --- Structural: the warning pin text is present and only overrides a 'clear' pin (never overrides a more urgent ambiguous/failed-lookup warning) ---
{
    assertTrue(bfSrc.indexOf('"Location appears less precise than current Geni location"') !== -1,
        "#338: the warning message text is present in the source");
    assertTrue(bfSrc.indexOf('if (pincolor === "clear" && locationSpecificityDowngrade)') !== -1,
        "#338: the specificity warning only fires when nothing more urgent (ambiguous/failed lookup) already claimed the pin");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
