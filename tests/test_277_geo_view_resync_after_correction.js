// Verifies #277 (live-reported, DanCornett: "the pin came back red, but
// when I corrected it, it didn't make any difference"): whether a location
// row shows the flat "Place" line or the detailed City/County/State/
// Country breakdown is decided once, at the very first render, from
// whether that first lookup found structured data (hasGeoFields). Manually
// correcting a red-pin location via the pencil-edit modal re-resolves the
// data (updateGeoLocation(), buildform.js) and correctly writes fresh
// values/checked-state into every row - but until now, nothing ever
// revisited WHICH rows were actually visible, or (more seriously) WHICH
// rows were actually SUBMITTABLE, based on the fresh result. A row still
// carrying the "geohidden" class is excluded entirely from parseForm()'s
// submission (popup.js) - so a correction that successfully resolved real
// City/County/State/Country data would populate and correctly check those
// fields, and NONE of it would actually reach Geni, only the stale flat
// "Place" text would.
//
// Fixed by having updateGeoLocation() sync the flat/structured row
// visibility AND the geohidden class with the freshly computed
// updateHasGeoFields, mirroring the exact same convention (and now a
// shared GEO_BREAKDOWN_ROW_COUNT constant) the .geoicon click handler
// already uses for the same flat/structured toggle.
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

// --- Structural: GEO_BREAKDOWN_ROW_COUNT is now one shared constant, not two independent copies ---
assertTrue(bfSrc.indexOf('var GEO_BREAKDOWN_ROW_COUNT = 7;') !== -1,
    "GEO_BREAKDOWN_ROW_COUNT is declared once, at module level");
assertEqual((bfSrc.match(/var GEO_BREAKDOWN_ROW_COUNT = 7;/g) || []).length, 1,
    "GEO_BREAKDOWN_ROW_COUNT is declared exactly once - the .geoicon handler's own local copy is gone");

// --- Behavioral: real jsdom DOM matching buildForm()'s actual location row markup ---
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;
function exists(v) { return typeof v !== 'undefined' && v !== null; }
global.exists = exists;
// updateGeoLocation() calls String.prototype.contains, a polyfill normally
// loaded from shared.js at runtime - not present in this standalone harness.
if (!String.prototype.contains) {
    String.prototype.contains = function () { return String.prototype.indexOf.apply(this, arguments) !== -1; };
}
function isValue(v) { return v !== ""; }
global.isValue = isValue;

const valuesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'valuesAreEquivalent'))();
global.valuesAreEquivalent = valuesAreEquivalent;
const syncTopLevelIndicators = new Function('return ' + extractFunction(bfSrc, 'syncTopLevelIndicators'))();
global.syncTopLevelIndicators = syncTopLevelIndicators;
const handleChecknextClickSrc = extractFunction(bfSrc, 'handleChecknextClick');

// checkNested/getParsedLocationEntry/persistGeoUpdateToSourceEntry: a
// deliberately simplified stub - this test's dataid never resolves to a
// real alldata entry (googlerequery points at test markup, not scraped
// data), so persistGeoUpdateToSourceEntry's own real body just no-ops
// early via its "!exists(entry)" guard either way. Not the behavior this
// test is about; real fidelity for THAT function's own logic (#260/#265)
// lives in its own coverage.
function checkNested() { return false; }
global.checkNested = checkNested;
global.alldata = { profile: {} };
global.databyid = [];
const getParsedLocationEntrySrc = extractFunction(bfSrc, 'getParsedLocationEntry');
const persistGeoUpdateToSourceEntrySrc = extractFunction(bfSrc, 'persistGeoUpdateToSourceEntry');

// computeCombinedPlaceValue: real dependency of updateGeoLocation(), but
// its own correctness is already fully covered by
// test_260_combined_place_value.js - stubbed here to isolate what THIS
// test actually verifies (row visibility/submission-eligibility syncing),
// not text-value computation.
global.computeCombinedPlaceValue = function (rawLocation, geo) { return rawLocation; };

const GEO_BREAKDOWN_ROW_COUNT = 7;
global.GEO_BREAKDOWN_ROW_COUNT = GEO_BREAKDOWN_ROW_COUNT;

const ctx = new Function(
    '$', 'exists', 'isValue', 'valuesAreEquivalent', 'syncTopLevelIndicators', 'checkNested',
    'alldata', 'databyid', 'computeCombinedPlaceValue', 'GEO_BREAKDOWN_ROW_COUNT',
    `
    ${handleChecknextClickSrc}
    ${getParsedLocationEntrySrc}
    ${persistGeoUpdateToSourceEntrySrc}
    ${extractFunction(bfSrc, 'updateGeoLocation')}
    return { updateGeoLocation: updateGeoLocation };
    `
)($, exists, isValue, valuesAreEquivalent, syncTopLevelIndicators, checkNested,
    global.alldata, global.databyid, global.computeCombinedPlaceValue, GEO_BREAKDOWN_ROW_COUNT);

// Builds the real row markup buildForm() produces for one location: a
// title row (geoicon, edit-button, geopin - in that DOM order, matching
// find("img")[0]/[2] in the real code), the flat "geoplace" row, then the
// 7 "geoloc" breakdown rows (place_name_geo, city, county, state, country,
// latitude, longitude).
function buildLocationRowGroup(startingStructured) {
    var flatDisplay = startingStructured ? 'none' : 'table-row';
    var flatClass = 'geoplace' + (startingStructured ? ' geohidden' : '');
    var detailDisplay = startingStructured ? 'table-row' : 'none';
    var detailClass = 'geoloc' + (startingStructured ? '' : ' geohidden');
    var icon = startingStructured ? 'geoon.png' : 'geooff.png';
    var html = '<table>' +
        '<tr id="focus_burial"><td><div class="membertitle">' +
        '<input type="checkbox" class="geotopcheck">' +
        '<img class="geoicon" src="images/' + icon + '">' +
        '<img src="images/edit.png" class="geoUpdateBtn">' +
        '<img class="geopin" src="images/redpin.png">' +
        'Burial Location: &#160;original text' +
        '</div></td></tr>' +
        '<tr class="' + flatClass + '" style="display: ' + flatDisplay + ';"><td><input type="checkbox" class="checknext"></td><td><input type="text" name="burial:location:place_name"></td><td><input type="text" class="genislideinput" value=""></td></tr>';
    var fields = ['place_name_geo', 'city', 'county', 'state', 'country', 'latitude', 'longitude'];
    fields.forEach(function (f) {
        html += '<tr class="' + detailClass + '" style="display: ' + detailDisplay + ';"><td><input type="checkbox" class="checknext"></td><td><input type="text" name="burial:location:' + f + '"></td><td><input type="text" class="genislideinput" value=""></td></tr>';
    });
    html += '<input type="checkbox" id="forcegeoswitch"></table>';
    $('body').html(html);
}

function rowStates() {
    var rows = $('table tr');
    return {
        geoicon: $('.geoicon').attr('src'),
        flatDisplay: $('.geoplace')[0].style.display,
        flatHidden: $('.geoplace').hasClass('geohidden'),
        detailDisplays: $('.geoloc').map(function () { return this.style.display; }).get(),
        detailHidden: $('.geoloc').map(function () { return $(this).hasClass('geohidden'); }).get()
    };
}

// --- Scenario 1: the actual #277 bug - starts flat (red pin, no structured data), correction resolves real fields ---
(function () {
    buildLocationRowGroup(false);
    global.googlerequery = 'focus_burial';
    global.geoid = 1;
    global.geostatus = [];
    global.geolocation = [{
        query: 'Woodland, Barry, Michigan, United States', place: '',
        city: 'Woodland', county: 'Barry', state: 'Michigan', country: 'United States',
        latitude: '42.6', longitude: '-85.2', count: 1, ambiguous: false
    }];
    ctx.updateGeoLocation();
    var state = rowStates();
    assertEqual(state.geoicon, 'images/geoon.png', "#277: geoicon now flips to 'on' once the correction resolves real structured fields - previously stuck at whatever it was before");
    assertEqual(state.flatDisplay, 'none', "#277: the flat Place row is now hidden once structured data resolved - previously stayed visible forever");
    assertTrue(state.flatHidden, "#277: the flat Place row now also gains 'geohidden' - excluded from submission, since structured data is now the real answer");
    assertTrue(state.detailDisplays.every(function (d) { return d === 'table-row'; }),
        "#277: all 7 structured rows (place_name_geo/city/county/state/country/latitude/longitude) are now VISIBLE");
    assertTrue(state.detailHidden.every(function (h) { return h === false; }),
        "#277: all 7 structured rows lose 'geohidden' too - this is the actual fix, since a row still carrying geohidden never reaches parseForm()'s submission at all");
})();

// --- Scenario 2: correction still genuinely fails (no city/county/state/country) - must NOT flip to structured ---
(function () {
    buildLocationRowGroup(false);
    global.googlerequery = 'focus_burial';
    global.geoid = 1;
    global.geostatus = [];
    global.geolocation = [{ query: 'Some Unresolvable Place', place: 'Some Unresolvable Place', city: '', county: '', state: '', country: '', count: 0 }];
    ctx.updateGeoLocation();
    var state = rowStates();
    assertEqual(state.geoicon, 'images/geooff.png', "Scenario 2 (regression control): a genuinely still-unresolved correction stays in flat mode, geoicon stays 'off'");
    assertEqual(state.flatDisplay, 'table-row', "Scenario 2: the flat Place row correctly stays visible when nothing structured resolved");
    assertTrue(state.detailDisplays.every(function (d) { return d === 'none'; }),
        "Scenario 2: the 7 structured rows correctly stay hidden - the fix doesn't force structured view when there's genuinely nothing structured to show");
})();

// --- Scenario 3: already structured, correction resolves structured data again - stays structured, no flapping ---
(function () {
    buildLocationRowGroup(true);
    global.googlerequery = 'focus_burial';
    global.geoid = 1;
    global.geostatus = [];
    global.geolocation = [{
        query: 'Middleville, Thornapple Township, Barry, Michigan, United States', place: '',
        city: 'Middleville', county: 'Barry', state: 'Michigan', country: 'United States',
        latitude: '42.7', longitude: '-85.4', count: 1, ambiguous: false
    }];
    ctx.updateGeoLocation();
    var state = rowStates();
    assertEqual(state.geoicon, 'images/geoon.png', "Scenario 3 (regression control): an already-structured location re-confirmed as structured stays structured");
    assertEqual(state.flatDisplay, 'none', "Scenario 3: the flat row correctly stays hidden - no flapping back and forth");
    assertTrue(state.detailDisplays.every(function (d) { return d === 'table-row'; }),
        "Scenario 3: the 7 structured rows correctly stay visible");
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
