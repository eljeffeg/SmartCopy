// Verifies the real root cause of #287's persistent "Place and Country
// checked when they shouldn't be" reports, found via a genuine jsdom DOM
// reproduction (not just reading source) after two prior source-pattern-
// verified "fixes" both turned out to still be broken live:
//
// (1) jQuery's .trigger("click") on a checkbox invokes the browser's own
//     native default action for a checkbox click - which TOGGLES it - in
//     addition to firing bound handlers. Every .prop(X).trigger("click")
//     call in updateGeoLocation() was silently ending up as !X once the
//     native toggle ran. Fixed via setLocationFieldChecked(), which
//     re-asserts the intended state with a second .prop() after the
//     trigger (keeping the handler's necessary side effects, which fire
//     once during the trigger, while guaranteeing the final state).
//
// (2) A leftover "!geoon &&" gate on all 7 checked-state expressions
//     completely suppressed diff-based checking whenever a location was
//     already in geo-breakdown mode before this update - the
//     overwhelmingly common case, since that's what "Update Location" is
//     normally used for. Removed - harmless for the geoon=false case
//     (already unconditionally true there), fixes the geoon=true case.
//
// A live jsdom repro (scratchpad/dom_repro/) confirmed both fixes
// together reproduce-then-resolve Dan's exact screenshots byte-for-byte:
// blank Place stays unchecked, matching Country stays unchecked, a
// genuinely differing County correctly gets checked - regardless of
// whether the location was already in breakdown mode beforehand.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', expected, 'got', actual); }
}

function extractFunction(srcText, name) {
    const marker = 'function ' + name + '(';
    const start = srcText.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    let depth = 0, i = srcText.indexOf('{', start);
    for (; i < srcText.length; i++) {
        if (srcText[i] === '{') depth++;
        else if (srcText[i] === '}') { depth--; if (depth === 0) break; }
    }
    return srcText.slice(start, i + 1);
}

const body = extractFunction(src, 'updateGeoLocation');

// --- Fix 1: no raw .prop(...).trigger("click") left unguarded ---
assertTrue(body.indexOf('function setLocationFieldChecked(checkbox, checked)') !== -1,
    "setLocationFieldChecked() helper is defined");
assertTrue(body.indexOf('$(checkbox).prop("checked", checked).trigger("click").prop("checked", checked);') !== -1,
    "The helper re-asserts the intended checked state AFTER the trigger (undoing the native toggle side effect)");

const setLocationFieldCheckedCalls = (body.match(/setLocationFieldChecked\(/g) || []).length;
assertEqual(setLocationFieldCheckedCalls, 9,
    "All 8 checkbox-state calls (query row + 7 breakdown fields) route through the helper, plus its own definition, got " + setLocationFieldCheckedCalls);

// No remaining bare `.prop("checked", ...).trigger("click")` without the
// corrective second .prop() - would silently reintroduce the inversion.
const bareTriggerPattern = /\.prop\("checked", [^)]+\)\.trigger\("click"\);/g;
assertEqual((body.match(bareTriggerPattern) || []).length, 0,
    "No bare .prop(...).trigger(\"click\") calls remain in updateGeoLocation() without the corrective re-assert");

// --- Fix 2: the leftover !geoon gate is gone from all 7 field expressions ---
assertEqual((body.match(/!geoon && \(forceAllGeoFields/g) || []).length, 0,
    "The !geoon gate no longer suppresses the 7 diff-based checked-state expressions");
assertEqual((body.match(/setLocationFieldChecked\([^,]+, \(forceAllGeoFields \|\|/g) || []).length, 7,
    "All 7 fields (Place/City/County/State/Country/Latitude/Longitude) now use the plain (forceAllGeoFields || xDiffers) expression");

// The query-row checkbox (a genuinely different field, unrelated to the
// #287 diff logic) still legitimately uses plain `geoon` on its own -
// this one was never part of the bug and must stay untouched.
assertTrue(body.indexOf('setLocationFieldChecked($(eventrow).find("input[type=checkbox]")[0], geoon);') !== -1,
    "The unrelated query-row checkbox still uses geoon directly, unaffected by either fix");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
