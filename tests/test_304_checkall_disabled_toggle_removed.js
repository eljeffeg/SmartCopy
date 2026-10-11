// Verifies the most severe item from the 2026-10-11 triage (diagnosed by
// DanCornett on #286, but really a #304 bug): toggling a whole CATEGORY
// checkbox (Parents/Siblings/Partners/Children) OFF then back ON - or the
// focus profile's own #updateprofile, which shares the same .checkall
// class - permanently broke editability for every field that wasn't
// pre-selected. Confirmed by Dan across FindAGrave and FamilySearch, on
// every category and the focus profile.
//
// Root cause: the category-wide `.checkall` click handler (popup.js) had
// its own, separate `.attr('disabled', !selectingAll)` sweep over every
// value field - a leftover from BEFORE the #304 editability/pre-selection
// split that was already correctly removed from the per-person path
// (applySelectAllState(), buildform.js - see its own comment: "Select
// All's entire remaining job" is setting `checked`, nothing else) but
// never removed from this separate category-level handler. Unchecking a
// category disabled every field under it; re-checking only re-enabled the
// pre-selected subset, leaving every blank/matching field stuck disabled
// with no way back in (no workaround at all for the focus profile).
//
// Structural source check, not a function extraction - the handler is an
// anonymous `.on('click', ...)` closure with deep dependencies
// (isFieldEmptyForCheckAll -> isFieldValueBlank/isFieldSelectable) not
// practical to extract and execute standalone - same convention
// test_304_indicator_tiers.js already uses for this exact handler's OTHER
// structural checks (the data-select-all-active assertion).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

function extractBetween(src, startMarker, endMarker, fromIndex) {
    const start = src.indexOf(startMarker, fromIndex || 0);
    if (start === -1) throw new Error('not found: ' + startMarker);
    const end = src.indexOf(endMarker, start);
    if (end === -1) throw new Error('end marker not found: ' + endMarker);
    return src.slice(start, end);
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

const checkallHandler = extractBetween(popupSrc, "$('.checkall').on('click'", "});\n});");

assertEqual(checkallHandler.indexOf(".attr('disabled'") !== -1, false,
    "The real .checkall click handler no longer toggles any field's disabled attribute - the exact leftover bug that broke editability on every category/focus-profile deselect-reselect cycle");

// Regression guard: the real "select all" job (setting checked, with the
// no-op/blank exclusion and data-select-all-active bookkeeping) must still
// be intact - this fix should only remove the disabled-toggle sweep, not
// the actual select-all behavior.
assertEqual(checkallHandler.indexOf(".prop('checked', selectingAll)") !== -1, true,
    "The real .checkall click handler still sets checked state on the filtered field set");
assertEqual(checkallHandler.indexOf("data-select-all-active") !== -1, true,
    "The real .checkall click handler still stamps data-select-all-active on every .checkslide it touches");
assertEqual(checkallHandler.indexOf('syncGeotopcheckState(fs)') !== -1, true,
    "The real .checkall click handler still resyncs .geotopcheck state after the click");
assertEqual(checkallHandler.indexOf('isFieldEmptyForCheckAll') !== -1, true,
    "The real .checkall click handler still excludes no-op/blank fields from being force-checked");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
