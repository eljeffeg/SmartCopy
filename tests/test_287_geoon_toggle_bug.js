// Verifies the real root cause of #287's persistent "Place and Country
// checked when they shouldn't be" reports, found via a genuine jsdom DOM
// reproduction (not just reading source) after two prior source-pattern-
// verified "fixes" both turned out to still be broken live:
//
// (1) A leftover "!geoon &&" gate on all 7 checked-state expressions
//     completely suppressed diff-based checking whenever a location was
//     already in geo-breakdown mode before this update - the
//     overwhelmingly common case, since that's what "Update Location" is
//     normally used for. Removed - harmless for the geoon=false case
//     (already unconditionally true there), fixes the geoon=true case.
//
// (2) #304 follow-up (live-reported, DanCornett, superseding the
//     ORIGINAL #287 fix for setLocationFieldChecked()): that original
//     fix used .prop(target).trigger("click").prop(target) - re-
//     asserting the checkbox's own final checked state after the
//     trigger. That correctly fixed the CHECKBOX, but jQuery's bound
//     .checknext handler fires DURING the trigger, and a checkbox's
//     native default click action (the toggle) runs BEFORE the bound
//     handler sees it - confirmed directly with a real jQuery/jsdom
//     reproduction below, not just re-reading the source. So the
//     handler's own side effects (the disabled toggle, the geotopcheck
//     cascade) were computed from the momentarily-WRONG, native-toggled
//     value, not the target - live-reported as fields ending up
//     checked-but-disabled (or the reverse, unchecked-but-enabled) after
//     a pencil edit, which then silently failed to submit at all, since
//     parseForm() (popup.js) submits based on disabled, never checked.
//     Fixed by not going through .trigger("click") at all -
//     setLocationFieldChecked() now sets checked to its final value
//     FIRST, then calls the real handler (handleChecknextClick(),
//     extracted to a named function for exactly this reason) directly.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
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

// --- Fix 1 (still in place): the leftover !geoon gate is gone from all 7 field expressions ---
assertEqual((body.match(/!geoon && \(forceAllGeoFields/g) || []).length, 0,
    "The !geoon gate no longer suppresses the 7 diff-based checked-state expressions");
assertEqual((body.match(/setLocationFieldChecked\([^,]+, \(forceAllGeoFields \|\|/g) || []).length, 7,
    "All 7 fields (Place/City/County/State/Country/Latitude/Longitude) now use the plain (forceAllGeoFields || xDiffers) expression");
assertTrue(body.indexOf('setLocationFieldChecked($(eventrow).find("input[type=checkbox]")[0], geoon);') !== -1,
    "The unrelated query-row checkbox still uses geoon directly, unaffected by either fix");

// --- Fix 2 (superseded and replaced): no more .trigger("click") anywhere in setLocationFieldChecked()'s own code
// (not just its surrounding comments, which still reference the string for explanatory purposes) ---
assertTrue(body.indexOf('function setLocationFieldChecked(checkbox, checked)') !== -1,
    "setLocationFieldChecked() helper is still defined");
const setLocationFieldCheckedBody = extractFunction(src, 'setLocationFieldChecked');
assertEqual(setLocationFieldCheckedBody.indexOf('.trigger(') !== -1, false,
    "#304 follow-up: setLocationFieldChecked()'s own code no longer uses .trigger(...) at all - see the behavioral reproduction below for why that was never reliable");
assertTrue(setLocationFieldCheckedBody.indexOf('handleChecknextClick.call(checkbox);') !== -1,
    "It now calls the real .checknext handler directly instead, with checked already set to its final value");

const setLocationFieldCheckedCalls = (body.match(/setLocationFieldChecked\(/g) || []).length;
assertEqual(setLocationFieldCheckedCalls, 9,
    "All 8 checkbox-state calls (query row + 7 breakdown fields) route through the helper, plus its own definition, got " + setLocationFieldCheckedCalls);

// ============================================================
// Behavioral: a real jQuery/jsdom reproduction, not just reading the
// source - proves the checkbox AND the field's disabled state actually
// end up agreeing now, in both directions, which is exactly what the
// OLD .trigger("click")-based fix could not guarantee.
// ============================================================
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;
function exists(v) { return typeof v !== 'undefined' && v !== null; }
global.exists = exists;

const handleChecknextClickSrc = extractFunction(src, 'handleChecknextClick');
const syncTopLevelIndicatorsSrc = extractFunction(src, 'syncTopLevelIndicators');
const ctx = new Function('$', 'exists', `
    ${syncTopLevelIndicatorsSrc}
    ${handleChecknextClickSrc}
    ${setLocationFieldCheckedBody}
    return { setLocationFieldChecked };
`)($, exists);

function freshLocationRow() {
    $('body').html(`
        <table>
            <tr class="geoloc"><td><input type="checkbox" class="checknext"></td><td><input type="text" name="city"></td></tr>
        </table>
    `);
    return { checkbox: $('.checknext')[0], field: $('input[name="city"]')[0] };
}

{
    const row = freshLocationRow();
    ctx.setLocationFieldChecked(row.checkbox, true);
    assertEqual(row.checkbox.checked, true, "Behavioral: checking a location field via setLocationFieldChecked() leaves the checkbox checked");
    assertEqual(row.field.disabled, false,
        "#304 follow-up (live-reported, DanCornett): the field itself is ALSO correctly enabled - this is exactly what the old .trigger(\"click\") fix could not guarantee, since the handler ran against the momentarily-toggled wrong value");
}
{
    const row = freshLocationRow();
    row.checkbox.checked = true;
    row.field.disabled = false;
    ctx.setLocationFieldChecked(row.checkbox, false);
    assertEqual(row.checkbox.checked, false, "Behavioral: unchecking via setLocationFieldChecked() leaves the checkbox unchecked");
    assertEqual(row.field.disabled, true,
        "#304 follow-up: the field itself is ALSO correctly disabled - the other direction of the same bug (unchecked-but-enabled, exactly what Dan's GPS fields showed)");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
