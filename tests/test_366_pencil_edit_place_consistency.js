// Verifies #366 follow-up (live-reported, DanCornett): the pencil "Edit
// Location" tool used to hardcode Place's own checked state to false
// unconditionally, even when the correction was a genuine cemetery/venue
// name and nothing else about the location actually needed protecting -
// a deliberate #357-era decision, made back when FamilySearch's return-
// value handling was unreliable enough that a lot of junk routinely ended
// up in Place. Dan's own explicit direction once that handling matured:
// "let's not treat pencil-edit flow any differently than the initial
// handling of a location... consistency of behavior is preferred."
//
// updateGeoLocation() now runs the exact same isPlaceEligibleForPreselection()
// rule the initial render already uses, reading Geni's own comparison
// values by field NAME (scoped to this person's own table) rather than by
// sibling position - deliberately avoiding the exact positional-walk
// fragility that caused both #355's cross-contamination bug and #362's
// titleobj crash in this same function before.
//
// Extracts the REAL updateGeoLocation(), isPlaceEligibleForPreselection(),
// isGeniLocationEntirelyBlank(), and isPlaceNameSegment() verbatim - same
// harness style as test_346_347_pencil_edit_location_precision.js.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');
const plSrc = fs.readFileSync(path.join(ROOT, 'parse-location.js'), 'utf8');

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

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
function extractVar(src, name) {
    const marker = 'var ' + name + ' =';
    const start = src.indexOf(marker);
    const end = src.indexOf(';\n', start);
    return src.slice(start, end + 1);
}

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;
function exists(v) { return typeof v !== 'undefined' && v !== null; }
global.exists = exists;
if (!String.prototype.contains) {
    String.prototype.contains = function () { return String.prototype.indexOf.apply(this, arguments) !== -1; };
}
function isValue(v) { return v !== ""; }
global.isValue = isValue;

const valuesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'valuesAreEquivalent'))();
global.valuesAreEquivalent = valuesAreEquivalent;
const gpsEffectivelyMatches = new Function('isValue', 'return ' + extractFunction(bfSrc, 'gpsEffectivelyMatches'))(isValue);
global.gpsEffectivelyMatches = gpsEffectivelyMatches;
const getLocationSpecificity = new Function('isValue', 'return ' + extractFunction(bfSrc, 'getLocationSpecificity'))(isValue);
const isLocationSpecificityDowngrade = new Function('getLocationSpecificity', 'return ' + extractFunction(bfSrc, 'isLocationSpecificityDowngrade'))(getLocationSpecificity);
global.isLocationSpecificityDowngrade = isLocationSpecificityDowngrade;
const syncTopLevelIndicators = new Function('return ' + extractFunction(bfSrc, 'syncTopLevelIndicators'))();
global.syncTopLevelIndicators = syncTopLevelIndicators;
const handleChecknextClickSrc = extractFunction(bfSrc, 'handleChecknextClick');
function checkNested() { return false; }
global.checkNested = checkNested;
global.alldata = { profile: {} };
global.databyid = [];
const getParsedLocationEntrySrc = extractFunction(bfSrc, 'getParsedLocationEntry');
const persistGeoUpdateToSourceEntrySrc = extractFunction(bfSrc, 'persistGeoUpdateToSourceEntry');
// Stubbed exactly like test_346_347_pencil_edit_location_precision.js's
// own fixture - computeCombinedPlaceValue()'s own leftover-computation
// logic is already extensively covered elsewhere (shared.js's own
// comment, test_357_place_preselect_cemetery_street.js); what's new and
// actually under test here is updateGeoLocation()'s OWN eligibility
// wiring, so locationdata.query is set directly to each scenario's
// intended final Place text rather than threading the real computation
// through.
global.computeCombinedPlaceValue = function (rawLocation, geo) { return rawLocation; };
const GEO_BREAKDOWN_ROW_COUNT = 7;
global.GEO_BREAKDOWN_ROW_COUNT = GEO_BREAKDOWN_ROW_COUNT;

const isPlaceNameSegmentSrc = extractFunction(plSrc, 'isPlaceNameSegment');
const keywordPatternSrc = extractVar(plSrc, 'PLACE_NAME_KEYWORD_PATTERN');
const numericPatternSrc = extractVar(plSrc, 'PLACE_NAME_NUMERIC_PATTERN');
const isPlaceEligibleForPreselectionSrc = extractFunction(bfSrc, 'isPlaceEligibleForPreselection');
const isGeniLocationEntirelyBlankSrc = extractFunction(bfSrc, 'isGeniLocationEntirelyBlank');

const ctx = new Function(
    '$', 'exists', 'isValue', 'valuesAreEquivalent', 'gpsEffectivelyMatches', 'isLocationSpecificityDowngrade',
    'syncTopLevelIndicators', 'checkNested', 'alldata', 'databyid', 'computeCombinedPlaceValue', 'GEO_BREAKDOWN_ROW_COUNT',
    `
    ${handleChecknextClickSrc}
    ${getParsedLocationEntrySrc}
    ${persistGeoUpdateToSourceEntrySrc}
    ${keywordPatternSrc}
    ${numericPatternSrc}
    ${isPlaceNameSegmentSrc}
    ${isPlaceEligibleForPreselectionSrc}
    ${isGeniLocationEntirelyBlankSrc}
    ${extractFunction(bfSrc, 'updateGeoLocation')}
    return { updateGeoLocation: updateGeoLocation };
    `
)($, exists, isValue, valuesAreEquivalent, gpsEffectivelyMatches, isLocationSpecificityDowngrade,
    syncTopLevelIndicators, checkNested, global.alldata, global.databyid, global.computeCombinedPlaceValue, GEO_BREAKDOWN_ROW_COUNT);

// Builds the real row markup, with Geni .genislideinput values
// configurable on EVERY location sub-field (including place_name_geo and
// place_name, unlike test_346_347's own fixture which only needed
// City/County/State/Country for the specificity-downgrade check). An
// `isNewAdd` flag adds a real <select class="actionselect"> with value
// "add" inside the family table, matching how updateGeoLocation() itself
// now detects a brand-new candidate - never added for the focus profile
// ("profiletable" short-circuits to isNewAdd=false unconditionally,
// regardless of any select element).
function buildLocationRowGroup(geniValues, tableId, isNewAdd) {
    var html = '<table id="' + tableId + '">';
    if (isNewAdd && tableId !== 'profiletable') {
        html += '<select class="actionselect"><option value="add" selected>Add Profile</option></select>';
    }
    html += '<tr id="focus_burial"><td><div class="membertitle">' +
        '<input type="checkbox" class="geotopcheck">' +
        '<img class="geoicon" src="images/geoon.png">' +
        '<img src="images/edit.png" class="geoUpdateBtn">' +
        '<img src="images/copy.png" class="geoCopyBtn">' +
        '<img class="geopin" src="images/clearpin.png">' +
        'Burial Location: &#160;original text' +
        '</div></td></tr>' +
        '<tr class="geoplace geohidden" style="display: none;"><td><input type="checkbox" class="checknext"></td><td><input type="text" name="burial:location:place_name"></td><td><input type="text" class="genislideinput" value="' + (geniValues.place_name || '') + '"></td></tr>';
    var fields = [
        ['place_name_geo', geniValues.place_name_geo], ['city', geniValues.city], ['county', geniValues.county],
        ['state', geniValues.state], ['country', geniValues.country], ['latitude', geniValues.latitude || ''], ['longitude', geniValues.longitude || '']
    ];
    fields.forEach(function (f) {
        html += '<tr class="geoloc" style="display: table-row;"><td><input type="checkbox" class="checknext"></td><td><input type="text" name="burial:location:' + f[0] + '"></td><td><input type="text" class="genislideinput" value="' + (f[1] || '') + '"></td></tr>';
    });
    html += '<input type="checkbox" id="forcegeoswitch">' +
        '<img class="geopin" id="' + tableId.replace('familytable_', '') + 'gpin" src="images/clearpin.png">' +
        '</table>';
    $('body').html(html);
}

function placeChecked() {
    // fields[0] in buildLocationRowGroup is place_name_geo - the one
    // updateGeoLocation() actually writes/checks.
    return $('.geoloc .checknext').first().prop('checked');
}

function runPencilEdit(queryValue, geoFields, geniValues, tableId, isNewAdd) {
    buildLocationRowGroup(geniValues, tableId, isNewAdd);
    global.googlerequery = 'focus_burial';
    global.geoid = 1;
    global.geostatus = [];
    global.geolocation = [Object.assign({
        query: queryValue, place: '', latitude: '', longitude: '', count: 1, ambiguous: false
    }, geoFields)];
    ctx.updateGeoLocation();
    return placeChecked();
}

// --- Scenario 1 (the real #366 follow-up ask): a brand-new Add Profile, pencil-corrected Country, genuine cemetery Place - should now pre-select ---
assertEqual(
    runPencilEdit('North Burial Ground, Providence, Providence County, Rhode Island, United States',
        { city: 'Providence', county: 'Providence County', state: 'Rhode Island', country: 'United States' },
        {}, 'familytable_7', true),
    true,
    "#366 follow-up: brand-new Add Profile, pencil-edit correction, genuine cemetery venue (\"North Burial Ground\") - now pre-selects, matching Dan's explicit consistency request"
);

// --- Scenario 2: existing match, Geni's own Place is blank for this event - still eligible (matches the already-shipped #357 follow-up rule) ---
assertEqual(
    runPencilEdit('Oak Hill Cemetery, Springfield, Sangamon County, Illinois, United States',
        { city: 'Springfield', county: 'Sangamon County', state: 'Illinois', country: 'United States' },
        { city: 'Springfield', county: 'Sangamon County', state: 'Illinois', country: 'United States' }, 'familytable_7', false),
    true,
    "Existing match, Geni's Place still blank for this event - pre-selects after a pencil correction, same as the initial-render rule"
);

// --- Scenario 3 (regression safety): existing match, Geni ALREADY has a real Place for this event - must stay unchecked ---
assertEqual(
    runPencilEdit('Oak Hill Cemetery, Springfield, Sangamon County, Illinois, United States',
        { city: 'Springfield', county: 'Sangamon County', state: 'Illinois', country: 'United States' },
        { city: 'Springfield', county: 'Sangamon County', state: 'Illinois', country: 'United States', place_name_geo: 'Oak Hill Cemetery' }, 'familytable_7', false),
    false,
    "Regression safety: Geni ALREADY has a real Place for this event - a pencil correction that doesn't change it still does not pre-select, something real to protect"
);

// --- Scenario 4 (regression safety): a bare historical-variant correction with no keyword/number - still never pre-selects, pencil or not ---
assertEqual(
    runPencilEdit('Poznan, Posen, Poland', { city: 'Posen', county: '', state: '', country: 'Poland' }, {}, 'familytable_7', true),
    false,
    "Regression safety: a bare city-name-variant leftover (no cemetery keyword, no street number) still never pre-selects after a pencil edit, even on a brand-new Add Profile"
);

// --- Scenario 5: the focus profile (never a new Add) - same rule applies, keyed off its own real Geni value ---
assertEqual(
    runPencilEdit('Saint Joseph Catholic Cemetery, New Brighton, Beaver County, Pennsylvania, United States',
        { city: 'New Brighton', county: 'Beaver County', state: 'Pennsylvania', country: 'United States' },
        {}, 'profiletable', false),
    true,
    "Focus profile: not a new Add, but Geni's own Place is blank for this event - still pre-selects after a pencil correction"
);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
