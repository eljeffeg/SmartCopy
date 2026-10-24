// Verifies #354 (live-reported, DanCornett, with before/after
// screenshots): "When there are locked or inaccessible profiles within a
// category (e.g. children), but some of them ARE accessible (allowed),
// the user clicking on the top-level category tick-box does NOT change
// the status of those 'allowed' profiles... This problem occurs in both
// directions... If none of the sub-profiles are locked / inaccessible,
// the category top-level tick-box DOES do a 'select all' or 'deselect
// all' properly."
//
// Root cause: the category-wide .checkall click handler (popup.js) gated
// its ENTIRE body on `!$(ffs[0]).prop("disabled")` - whether just the
// FIRST checkbox found anywhere in the category fieldset was disabled.
// If that one representative element happened to belong to a locked
// person, the whole handler no-opped, silently leaving every OTHER,
// genuinely allowed profile in the category untouched too - exactly
// backwards from a per-item check, and not even a correct "is everyone in
// this category locked" check either (a single locked item anywhere, not
// just the first, shouldn't have blocked the rest).
//
// Fixed by removing that outer guard and skipping a disabled item
// per-item inside the filter instead - the same pattern
// applySelectAllState() (buildform.js, the per-PERSON equivalent) already
// uses correctly for exactly this reason (#78: jQuery's
// .prop('checked', ...) doesn't respect disabled for a programmatic set,
// only a real user interaction, so this has to be an explicit check).
//
// Uses the REAL extracted .checkall click handler (not a reimplementation) -
// same technique and harness as test_330_halfsibling_not_reselected.js,
// which covers this identical handler for a different exclusion case.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

function extractAnonymousFunctionBody(src, afterMarker) {
    const markerPos = src.indexOf(afterMarker);
    if (markerPos === -1) throw new Error('not found: ' + afterMarker);
    const fnStart = src.indexOf('function () {', markerPos);
    if (fnStart === -1) throw new Error('no anonymous function found after marker');
    const braceStart = src.indexOf('{', fnStart);
    let depth = 0, i = braceStart;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(braceStart + 1, i);
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

global.isValue = new Function('return ' + extractFunction(bfSrc, 'isValue'))();
global.isFieldValueBlank = new Function('exists', 'return ' + extractFunction(bfSrc, 'isFieldValueBlank'))(exists);
global.valuesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'valuesAreEquivalent'))();
global.valuesAreEquivalentForFieldType = new Function('return ' + extractFunction(bfSrc, 'valuesAreEquivalentForFieldType'))();
global.isFieldSelectable = new Function('return ' + extractFunction(bfSrc, 'isFieldSelectable'))();
global.isFieldEmptyForCheckAll = new Function('exists', 'return ' + extractFunction(popupSrc, 'isFieldEmptyForCheckAll'))(exists);
// Not under test here - stubbed so the real handler's own trailing call
// doesn't throw.
global.syncGeotopcheckState = function () {};

const checkallHandlerBody = extractAnonymousFunctionBody(popupSrc, "$('.checkall').on('click', ");
const checkallHandler = new Function(checkallHandlerBody);

function bindCheckallHandler() {
    $('.checkall').on('click', checkallHandler);
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// Real markup shape: a Children category with the .checkall header and a
// fieldset holding one LOCKED child (checkslide + its own checknext field
// both disabled, exactly as a real locked/inaccessible match renders) as
// the very FIRST person - the specific ordering Dan's own screenshots
// showed - followed by a second, genuinely ALLOWED child.
function freshChildrenGroup() {
    $('body').html(`
        <div id="child">
            <input type="checkbox" class="checkall" id="addchildck">
            <fieldset class="fieldeffect">
                <div id="childval" class="familydiv">
                    <table>
                        <tr><td><input type="checkbox" class="checkslide" id="lockedslide" disabled></td></tr>
                        <tr><td><input type="checkbox" class="checknext" id="lockedfield" disabled><input type="text" name="locked_occupation" value="Something" style="display:table-row"></td></tr>
                    </table>
                    <table>
                        <tr><td><input type="checkbox" class="checkslide" id="allowedslide"></td></tr>
                        <tr><td><input type="checkbox" class="checknext" id="allowedfield"><input type="text" name="allowed_occupation" value="Farmer" style="display:table-row"></td></tr>
                    </table>
                </div>
            </fieldset>
        </div>
    `);
    bindCheckallHandler();
}

// --- #354: checking the category with a locked FIRST profile still selects the allowed second one. ---
{
    freshChildrenGroup();
    $('#addchildck').trigger('click');
    assertEqual($('#allowedslide').prop('checked'), true,
        "#354: checking the category selects the allowed profile's top-level box, even though the FIRST profile in the category is locked");
    assertEqual($('#allowedfield').prop('checked'), true,
        "#354: the allowed profile's own field also gets selected");
    assertEqual($('#lockedslide').prop('checked'), false,
        "Safety: the locked profile's own checkbox is correctly left unchecked (it's disabled - never force-checked)");
    assertEqual($('#lockedfield').prop('checked'), false,
        "Safety: the locked profile's own field is correctly left unchecked too");
}

// --- #354 reverse direction: deselecting the category with a locked FIRST profile still clears the allowed second one. ---
{
    freshChildrenGroup();
    $('#allowedslide').prop('checked', true);
    $('#allowedfield').prop('checked', true);
    $('#addchildck')[0].checked = true; // setup only, no event - starts "checked" so a real click toggles it off
    $('#addchildck').trigger('click');
    assertEqual($('#allowedslide').prop('checked'), false,
        "#354: deselecting the category clears the allowed profile's top-level box too, even with a locked first profile");
    assertEqual($('#allowedfield').prop('checked'), false,
        "#354: the allowed profile's own field is cleared too");
}

// --- Regression: with nobody locked, the category checkbox still works exactly as before. ---
{
    $('body').html(`
        <div id="child">
            <input type="checkbox" class="checkall" id="addchildck">
            <fieldset class="fieldeffect">
                <div id="childval" class="familydiv">
                    <table>
                        <tr><td><input type="checkbox" class="checkslide" id="allowedslide"></td></tr>
                        <tr><td><input type="checkbox" class="checknext" id="allowedfield"><input type="text" name="allowed_occupation" value="Farmer" style="display:table-row"></td></tr>
                    </table>
                </div>
            </fieldset>
        </div>
    `);
    bindCheckallHandler();
    $('#addchildck').trigger('click');
    assertEqual($('#allowedslide').prop('checked'), true,
        "Regression: with no locked profiles at all, the category checkbox still selects the allowed profile, same as always");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
