// Verifies #361: getCurrentGpsCoordinates() (buildform.js) - the data
// source for the new "copy coordinates" button next to a location's pin -
// reads the LIVE latitude/longitude input values for one specific
// location row and returns them as a single "lat,lon" pair, or "" when
// either field is missing or blank (never a partial/malformed pair).
// Mirrors getCurrentEventYear()'s own dataid/scope convention (a leading
// "focus" or person-index segment selects #profiletable vs.
// #familytable_N), so the main risk to guard against is scope bleed - two
// different people's same-named event ("burial") rows must never read
// each other's values. Extracts the real function verbatim from
// buildform.js, using a real jsdom + jQuery DOM exactly like
// test_346_347_pencil_edit_location_precision.js does for the sibling
// dataid-scoped helper in the same file.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
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

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;
function exists(v) { return typeof v !== 'undefined' && v !== null; }
const isValueSrc = extractFunction(bfSrc, 'isValue');
const getCurrentGpsCoordinatesSrc = extractFunction(bfSrc, 'getCurrentGpsCoordinates');

const ctx = new Function('$', 'exists', `
    ${isValueSrc}
    ${getCurrentGpsCoordinatesSrc}
    return { getCurrentGpsCoordinates: getCurrentGpsCoordinates };
`)($, exists);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// Inputs are wrapped in a real <tr><td> - a bare <input> as a direct
// child of <table> gets foster-parented OUT of the table by the HTML
// parser (same gotcha test_346_347_pencil_edit_location_precision.js's
// own comment calls out), which would silently defeat the very scoping
// this test exists to verify.
function locationRow(tableId, item, latitude, longitude) {
    var html = '';
    if (latitude !== null) {
        html += '<tr><td><input type="text" name="' + item + ':location:latitude" value="' + latitude + '"></td></tr>';
    }
    if (longitude !== null) {
        html += '<tr><td><input type="text" name="' + item + ':location:longitude" value="' + longitude + '"></td></tr>';
    }
    return '<table id="' + tableId + '">' + html + '</table>';
}

// Scenario 1: focus profile, both fields present - the common case
(function () {
    $('body').html(locationRow('profiletable', 'burial', '32.75', '-97.33'));
    assertEqual(ctx.getCurrentGpsCoordinates('focus_burial'), '32.75,-97.33',
        "Focus profile: both latitude and longitude present - returns the comma-joined pair");
})();

// Scenario 2: one field blank - declines rather than returning a partial pair
(function () {
    $('body').html(locationRow('profiletable', 'burial', '', '-97.33'));
    assertEqual(ctx.getCurrentGpsCoordinates('focus_burial'), '',
        "Latitude blank, longitude present - returns \"\" rather than a malformed \",-97.33\" pair");
})();

// Scenario 3: both fields blank
(function () {
    $('body').html(locationRow('profiletable', 'burial', '', ''));
    assertEqual(ctx.getCurrentGpsCoordinates('focus_burial'), '',
        "Both fields blank - returns \"\"");
})();

// Scenario 4: neither field even rendered (the "Unknown location" fallback row has no lat/long inputs at all)
(function () {
    $('body').html('<table id="profiletable"></table>');
    assertEqual(ctx.getCurrentGpsCoordinates('focus_burial'), '',
        "Fields not rendered at all (blank-location fallback row) - returns \"\" instead of throwing");
})();

// Scenario 5: family member - scoped to the correct #familytable_N, not the focus profile's table
(function () {
    $('body').html(
        locationRow('profiletable', 'burial', '1.11', '2.22') +
        locationRow('familytable_7', 'burial', '32.75', '-97.33')
    );
    assertEqual(ctx.getCurrentGpsCoordinates('7_burial'), '32.75,-97.33',
        "Family member's own table is read, not the focus profile's same-named 'burial' row");
})();

// Scenario 6: two DIFFERENT family members sharing the same event name - no scope bleed between them
(function () {
    $('body').html(
        locationRow('familytable_7', 'burial', '32.75', '-97.33') +
        locationRow('familytable_9', 'burial', '40.71', '-74.01')
    );
    assertEqual(ctx.getCurrentGpsCoordinates('7_burial'), '32.75,-97.33',
        "Person 7's burial coordinates are read correctly");
    assertEqual(ctx.getCurrentGpsCoordinates('9_burial'), '40.71,-74.01',
        "Person 9's own, different burial coordinates are read correctly - not person 7's (the real risk this change could introduce)");
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
