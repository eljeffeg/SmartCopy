// Verifies #346/#347 (live-reported, DanCornett - follow-ups to #338):
// #338 taught the FOCUS PROFILE's initial render not to pre-select
// City/County/State/Country/Latitude/Longitude when the scraped location
// is genuinely less detailed than what Geni already has (ranked by which
// of City/County/State/Country is the most granular non-blank field
// present, ignoring content). #346 asks for the same check after a pencil
// "Edit Location" correction; #347 asks for it to also apply to family
// members, once #346 lands.
//
// updateGeoLocation() (buildform.js, the pencil-edit recompute) is a
// SINGLE function shared by both the focus profile and every family
// member's location row - unlike buildForm()'s initial render, which only
// has Geni's real comparison values available for the focus profile (a
// family member has no confirmed match yet at that point). By the time a
// pencil edit can happen, every row - focus or family - already has real
// Geni values available via its own .genislideinput companion, so wiring
// the check in here covers #346 and #347 in the same change: the function
// doesn't know or care which kind of row it's operating on.
//
// Also verifies the accompanying warning: the location's own pin turns
// yellow with "Location appears less precise than current Geni location"
// when a downgrade is detected and nothing more urgent (an ambiguous/
// failed lookup) already claimed it.
//
// Extracts the REAL updateGeoLocation() and isLocationSpecificityDowngrade()
// functions verbatim - same harness (buildLocationRowGroup, dependency
// injection) as test_277_geo_view_resync_after_correction.js.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
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
global.computeCombinedPlaceValue = function (rawLocation, geo) { return rawLocation; };
const GEO_BREAKDOWN_ROW_COUNT = 7;
global.GEO_BREAKDOWN_ROW_COUNT = GEO_BREAKDOWN_ROW_COUNT;

const ctx = new Function(
    '$', 'exists', 'isValue', 'valuesAreEquivalent', 'gpsEffectivelyMatches', 'isLocationSpecificityDowngrade',
    'syncTopLevelIndicators', 'checkNested', 'alldata', 'databyid', 'computeCombinedPlaceValue', 'GEO_BREAKDOWN_ROW_COUNT',
    `
    ${handleChecknextClickSrc}
    ${getParsedLocationEntrySrc}
    ${persistGeoUpdateToSourceEntrySrc}
    ${extractFunction(bfSrc, 'updateGeoLocation')}
    return { updateGeoLocation: updateGeoLocation };
    `
)($, exists, isValue, valuesAreEquivalent, gpsEffectivelyMatches, isLocationSpecificityDowngrade,
    syncTopLevelIndicators, checkNested, global.alldata, global.databyid, global.computeCombinedPlaceValue, GEO_BREAKDOWN_ROW_COUNT);

// Builds the real row markup buildForm() produces for one already-
// structured location (so the breakdown rows are visible from the start -
// this test is about checked-state/pin behavior, not the flat/structured
// toggle #277 already covers), with real Geni .genislideinput values
// pre-populated on City/County/State/Country so a downgrade can be
// detected. `tableId` lets a case simulate a family-member table
// (familytable_NNN) vs. the focus profile's own (profiletable).
function buildLocationRowGroup(geniValues, tableId) {
    var html = '<table id="' + tableId + '">' +
        '<tr id="focus_burial"><td><div class="membertitle">' +
        '<input type="checkbox" class="geotopcheck">' +
        '<img class="geoicon" src="images/geoon.png">' +
        '<img src="images/edit.png" class="geoUpdateBtn">' +
        '<img class="geopin" src="images/clearpin.png">' +
        'Burial Location: &#160;original text' +
        '</div></td></tr>' +
        '<tr class="geoplace geohidden" style="display: none;"><td><input type="checkbox" class="checknext"></td><td><input type="text" name="burial:location:place_name"></td><td><input type="text" class="genislideinput" value=""></td></tr>';
    var fields = [
        ['place_name_geo', ''], ['city', geniValues.city], ['county', geniValues.county],
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

function rowStates() {
    var checknexts = $('.geoloc .checknext');
    // Scoped to #focus_burial specifically - a bare $('.geopin') is
    // ambiguous once the aggregate test pin (id="...gpin", a direct
    // non-tr/td child of <table> used to verify #347's family-member
    // case) gets foster-parented elsewhere in the DOM by the HTML parser,
    // same way a real <table> would relocate any invalid direct child.
    return {
        pinSrc: $('#focus_burial').find('.geopin').attr('src'),
        pinTitle: $('#focus_burial').find('.geopin').attr('title'),
        // index order matches buildLocationRowGroup's `fields` array:
        // 0=place_name_geo 1=city 2=county 3=state 4=country 5=latitude 6=longitude
        checked: checknexts.map(function () { return this.checked; }).get()
    };
}

var fdata = { city: 'Fort Worth', county: 'Tarrant', state: 'Texas', country: 'United States', latitude: '32.75', longitude: '-97.33' };

// --- #346: a pencil-edit correction that's LESS detailed than Geni's existing location must not pre-select City/County/State/Country/Lat/Long. ---
// State is deliberately a genuinely DIFFERENT string from Geni's ("Lone
// Star State" vs. "Texas") rather than blank or identical - a weaker test
// using a blank/matching value would pass even without this fix, since
// the pre-existing plain diff check already leaves a blank or equivalent
// field unchecked on its own. A real difference proves the specificity
// check - not just "nothing to pre-select in the first place" - is what
// suppresses pre-selection here.
(function () {
    buildLocationRowGroup(fdata, 'profiletable');
    global.googlerequery = 'focus_burial';
    global.geoid = 1;
    global.geostatus = [];
    global.geolocation = [{
        query: 'Lone Star State, United States', place: '',
        city: '', county: '', state: 'Lone Star State', country: 'United States',
        latitude: '', longitude: '', count: 1, ambiguous: false
    }];
    ctx.updateGeoLocation();
    var state = rowStates();
    assertTrue(state.checked.slice(1, 5).every(function (c) { return c === false; }),
        "#346: City/County/State/Country stay unchecked after a pencil edit that resolved a less-detailed location than Geni's existing one, even though State itself genuinely differs in text");
    assertEqual(state.pinSrc, 'images/yellowpin.png',
        "#346: the location's own pin turns yellow to flag the precision downgrade");
    assertEqual(state.pinTitle, 'Location appears less precise than current Geni location',
        "#346: the pin's title explains why, matching the initial-render warning text from #338");
})();

// --- #346 regression: equal specificity still pre-selects a genuine difference, same as before this fix. ---
(function () {
    buildLocationRowGroup(fdata, 'profiletable');
    global.googlerequery = 'focus_burial';
    global.geoid = 1;
    global.geostatus = [];
    global.geolocation = [{
        query: 'Dallas, Dallas, Texas, United States', place: '',
        city: 'Dallas', county: 'Dallas', state: 'Texas', country: 'United States',
        latitude: '32.78', longitude: '-96.80', count: 1, ambiguous: false
    }];
    ctx.updateGeoLocation();
    var state = rowStates();
    assertTrue(state.checked[1] === true && state.checked[2] === true,
        "Regression: a genuinely different City/County at the SAME specificity as Geni's still pre-selects after a pencil edit");
    assertEqual(state.pinSrc, 'images/clearpin.png',
        "Regression: no precision warning when specificity is equal, even though the values differ");
})();

// --- #346: forceAllGeoFields overrides the downgrade suppression, same as it overrides the plain diff checks. ---
(function () {
    buildLocationRowGroup(fdata, 'profiletable');
    $('#forcegeoswitch').prop('checked', true);
    global.googlerequery = 'focus_burial';
    global.geoid = 1;
    global.geostatus = [];
    global.geolocation = [{
        query: 'Texas, United States', place: '',
        city: '', county: '', state: 'Texas', country: 'United States',
        latitude: '', longitude: '', count: 1, ambiguous: false
    }];
    ctx.updateGeoLocation();
    var state = rowStates();
    assertTrue(state.checked[3] === true,
        "#346: forceAllGeoFields ('auto-select one, select all') still force-checks State even though it's a precision downgrade - a deliberate override, same as for a plain value difference");
})();

// --- #347: the identical check applies to a family member's row - updateGeoLocation() doesn't distinguish, same function either way. ---
// Same "genuinely different text, not blank/matching" reasoning as the
// first scenario above - State differs for real, so the pre-existing
// diff check alone would have pre-selected it without this fix.
(function () {
    buildLocationRowGroup(fdata, 'familytable_42');
    global.googlerequery = 'focus_burial';
    global.geoid = 1;
    global.geostatus = [];
    global.geolocation = [{
        query: 'Lone Star State, United States', place: '',
        city: '', county: '', state: 'Lone Star State', country: 'United States',
        latitude: '', longitude: '', count: 1, ambiguous: false
    }];
    ctx.updateGeoLocation();
    var state = rowStates();
    assertTrue(state.checked.slice(1, 5).every(function (c) { return c === false; }),
        "#347: a family member's location row gets the identical precision-downgrade protection after a pencil edit - updateGeoLocation() is one shared function for both");
    assertEqual($('#42gpin').attr('src'), 'images/yellowpin.png',
        "#347: the family member's own aggregate top-level pin also reflects the downgrade warning (visible even when the profile is collapsed)");
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
