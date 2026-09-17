// Verifies a #304 follow-up bug reported live by DanCornett: the
// checkbox "indicator" hierarchy (individual field -> person-level
// .checkslide -> category-level .checkall header, plus the focus
// profile's own #updateprofile) only ever got pushed to checked
// reactively - nothing ever recomputed a tier back to unchecked once the
// user manually unchecked the last field still selected underneath it,
// so a person or whole category could show "something is selected" long
// after nothing actually was. Also covers the recurring Privacy
// pre-selection bug: refreshPrivacySelect()'s own "select all means all"
// override used to key off the checkbox's raw checked state - the exact
// same indicator/shortcut conflation - so it force-enabled Privacy any
// time the top box was ticked purely as an indicator from an unrelated
// field.
//
// Uses a real jsdom DOM shaped exactly like the actual family panel
// markup (popup.html's <div id="sibling">/<input class="checkall">/
// <fieldset>/<div class="familydiv"> nesting, and buildform.js's own
// .membertitle/.checkslide/.memberexpand/.checknext shapes) with the
// real jQuery and the real extracted functions - not a reimplementation.
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
global.exists = exists;

const ctx = new Function('$', 'exists', `
    ${extractFunction(bfSrc, 'syncPersonCheckboxWithPreCheckedFields')}
    ${extractFunction(bfSrc, 'syncTopLevelIndicators')}
    return { syncPersonCheckboxWithPreCheckedFields, syncTopLevelIndicators };
`)($, exists);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// Real popup.html/buildform.js markup shape: a category div (Siblings)
// containing the .checkall header and a fieldset with two people, each
// with two .checknext fields.
function freshSiblingGroup() {
    $('body').html(`
        <div id="sibling">
            <input type="checkbox" class="checkall" id="addsiblingck">
            <fieldset class="fieldeffect">
                <div id="siblingval" class="familydiv">
                    <div class="membertitle"><input type="checkbox" class="checkslide"></div>
                    <div class="memberexpand">
                        <tr><input type="checkbox" class="checknext" id="p1f1"></tr>
                        <tr><input type="checkbox" class="checknext" id="p1f2"></tr>
                    </div>
                    <div class="membertitle"><input type="checkbox" class="checkslide"></div>
                    <div class="memberexpand">
                        <tr><input type="checkbox" class="checknext" id="p2f1"></tr>
                    </div>
                </div>
            </fieldset>
        </div>
    `);
}

// --- syncTopLevelIndicators(): person tier reacts both ways ---
{
    freshSiblingGroup();
    var p1f1 = $('#p1f1')[0];
    p1f1.checked = true;
    ctx.syncTopLevelIndicators(p1f1);
    assertEqual($('.checkslide').eq(0).prop('checked'), true,
        "Checking one field ticks its OWN person's checkslide (unchanged direction, still works)");
    assertEqual($('.checkslide').eq(1).prop('checked'), false,
        "The OTHER person's checkslide is untouched by a field belonging to person 1");
    assertEqual($('#addsiblingck').prop('checked'), true,
        "#304 follow-up: the category header also ticks, now that a person underneath it is checked");

    p1f1.checked = false;
    ctx.syncTopLevelIndicators(p1f1);
    assertEqual($('.checkslide').eq(0).prop('checked'), false,
        "#304 follow-up: unchecking the LAST checked field for person 1 correctly un-ticks their checkslide too - this direction never worked before this fix");
    assertEqual($('#addsiblingck').prop('checked'), false,
        "#304 follow-up: with nobody left checked in the whole category, the category header un-ticks too");
}

// --- syncTopLevelIndicators(): category header stays checked while ANY person underneath still is ---
{
    freshSiblingGroup();
    var p1f1 = $('#p1f1')[0];
    var p2f1 = $('#p2f1')[0];
    p1f1.checked = true;
    ctx.syncTopLevelIndicators(p1f1);
    p2f1.checked = true;
    ctx.syncTopLevelIndicators(p2f1);
    assertEqual($('#addsiblingck').prop('checked'), true, "Both people checked - category header checked");

    p1f1.checked = false;
    ctx.syncTopLevelIndicators(p1f1);
    assertEqual($('.checkslide').eq(0).prop('checked'), false, "Person 1's own checkslide un-ticks");
    assertEqual($('#addsiblingck').prop('checked'), true,
        "#304 follow-up: category header STAYS checked - person 2 is still checked, so the category as a whole still has something selected");
}

// --- syncTopLevelIndicators(): the focus profile's own #updateprofile, no .memberexpand involved at all ---
{
    $('body').html(`
        <div id="profileshadowdiv">
            <input type="checkbox" id="updateprofile">
            <fieldset>
                <input type="checkbox" class="checknext" id="focusf1">
                <input type="checkbox" class="checknext" id="focusf2">
            </fieldset>
        </div>
    `);
    var f1 = $('#focusf1')[0];
    var f2 = $('#focusf2')[0];
    f1.checked = true;
    ctx.syncTopLevelIndicators(f1);
    assertEqual($('#updateprofile').prop('checked'), true, "Checking one focus-profile field ticks #updateprofile");
    f2.checked = true;
    ctx.syncTopLevelIndicators(f2);
    f1.checked = false;
    ctx.syncTopLevelIndicators(f1);
    assertEqual($('#updateprofile').prop('checked'), true, "#updateprofile stays checked - the second field is still checked");
    f2.checked = false;
    ctx.syncTopLevelIndicators(f2);
    assertEqual($('#updateprofile').prop('checked'), false,
        "#304 follow-up (live-reported, DanCornett): #updateprofile correctly un-ticks once every focus-profile field is manually unchecked - previously stuck checked with nothing selected underneath");
}

// --- syncPersonCheckboxWithPreCheckedFields(): the one-time initial-render pass now also syncs the category tier ---
{
    freshSiblingGroup();
    $('#p1f1').prop('checked', true); // pre-checked at render, before any click ever fires
    ctx.syncPersonCheckboxWithPreCheckedFields();
    assertEqual($('.checkslide').eq(0).prop('checked'), true, "Person-tier initial sync still works (unchanged)");
    assertEqual($('#addsiblingck').prop('checked'), true,
        "#304 follow-up: the category header ALSO reflects a pre-checked person at initial render - previously stayed at its own unrelated render-time default forever");
}
{
    freshSiblingGroup();
    // Nobody pre-checked at all.
    ctx.syncPersonCheckboxWithPreCheckedFields();
    assertEqual($('#addsiblingck').prop('checked'), false,
        "Regression: with nobody pre-checked, the category header correctly stays unchecked too");
}

// ============================================================
// Structural: the actual click-handler wiring in buildform.js/popup.js
// calls into the functions verified above, and the OLD one-directional
// (check-only, never uncheck) cascade is gone. Same source-pattern
// verification convention as tests/test_287_geoon_toggle_bug.js, used
// there for the same reason - these are real jQuery .on('click', ...)
// event bindings, not pure functions, so a full simulated-click test
// would need the entire updateClassResponse() binding infrastructure.
// ============================================================
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

function extractBetween(src, startMarker, endMarker, fromIndex) {
    const start = src.indexOf(startMarker, fromIndex || 0);
    if (start === -1) throw new Error('not found: ' + startMarker);
    const end = src.indexOf(endMarker, start);
    if (end === -1) throw new Error('end marker not found: ' + endMarker);
    return src.slice(start, end);
}

const checknextHandler = extractBetween(bfSrc, "$('.checknext').on('click'", "$('.geotopcheck').off();");
assertEqual(checknextHandler.indexOf('syncTopLevelIndicators(this)') !== -1, true,
    "The real .checknext click handler calls syncTopLevelIndicators(this)");
assertEqual(checknextHandler.indexOf("personslide.find('.checkslide').prop('checked', true);") !== -1, false,
    "The OLD check-only cascade (unconditionally forcing .checkslide true) is gone from .checknext's handler");
assertEqual(checknextHandler.indexOf('"profileshadowdiv"') !== -1, false,
    "The OLD inline #updateprofile special-case is gone too - now handled uniformly inside syncTopLevelIndicators()");

const geotopcheckHandler = extractBetween(bfSrc, "$('.geotopcheck').on('click'", "$('.checkslide').off();");
assertEqual(geotopcheckHandler.indexOf('syncTopLevelIndicators(this)') !== -1, true,
    "The real .geotopcheck click handler also calls syncTopLevelIndicators(this)");
assertEqual((geotopcheckHandler.match(/personslide\.find\('\.checkslide'\)\.prop\('checked', true\);/g) || []).length, 0,
    "The OLD check-only cascade is gone from .geotopcheck's handler too");

const checkallHandler = extractBetween(popupSrc, "$('.checkall').on('click'", "});\n});");
assertEqual(checkallHandler.indexOf("fs.find('.checkslide').attr('data-select-all-active'") !== -1, true,
    "#304 follow-up: the category-wide .checkall click handler now sets data-select-all-active on every .checkslide it touches, matching an explicit per-person click");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
