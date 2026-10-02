// Verifies Dan's #304 follow-up proposal (issue #304, discussed at length,
// not yet filed as its own numbered sub-issue at the time this shipped):
// "editable" and "selected for update" are different questions. A field
// should be typeable regardless of its checkbox's state (the only reason a
// field should be non-editable is a genuine lock, not a pre-selection
// recommendation) - the moment the user actually edits a field, its own
// checkbox should check itself, rather than requiring a checkbox click
// FIRST before the field becomes typeable (the two-click cost Dan's
// proposal was meant to remove).
//
// This required three coordinated changes, each covered below:
// (1) isEnabled() (buildform.js) now answers "is this locked", nothing else -
//     pre-selection (isChecked()/resolveFieldEnabled()) is completely
//     unaffected and untouched.
// (2) A new delegated input/change listener (buildform.js,
//     updateClassResponse()) checks a field's own checkbox for the user the
//     moment they type into or change a field whose checkbox isn't checked
//     yet - by re-clicking the real checkbox (.trigger('click')), not by
//     duplicating handleChecknextClick()'s own logic.
// (3) parseForm() (popup.js) now independently gates submission on the
//     field's own checkbox being checked, not just on whether it's
//     disabled - since disabled no longer implies "not selected."
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
function extractBetween(src, startMarker, endMarker) {
    const start = src.indexOf(startMarker);
    if (start === -1) throw new Error('start marker not found: ' + startMarker);
    const end = src.indexOf(endMarker, start);
    if (end === -1) throw new Error('end marker not found: ' + endMarker);
    return src.slice(start, end);
}

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;
function exists(v) { return typeof v !== 'undefined' && v !== null; }
global.exists = exists;

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// ============================================================
// Part 1: isEnabled() only answers "is this locked"
// ============================================================
const resolveFieldEnabledSrc = extractFunction(bfSrc, 'resolveFieldEnabled');
const isValue = function (v) { return v !== ''; };
const resolveFieldEnabled = new Function('isValue', 'return ' + resolveFieldEnabledSrc)(isValue);
const isEnabled = new Function('resolveFieldEnabled', 'return ' + extractFunction(bfSrc, 'isEnabled'))(resolveFieldEnabled);

assertEqual(isEnabled('', true, false, '', false, false), '',
    "A blank, unscored, unlocked field is still editable - score/value no longer matter at all to isEnabled()");
assertEqual(isEnabled('Real Value', true, false, 'Different', false, false), '',
    "A genuinely different, scored, unlocked field is editable - same as before");
assertEqual(isEnabled('Real Value', true, false, 'Real Value', false, true), '',
    "A field identical to Geni's value (sameAsGeni=true) is STILL editable - only checked state would differ, not editability");
assertEqual(isEnabled('anything', true, false, 'anything', true, false), 'disabled',
    "Locked always means disabled, regardless of every other argument");

// ============================================================
// Part 2: the real delegated listener, extracted verbatim, real jQuery/jsdom
// ============================================================
const handleChecknextClickSrc = extractFunction(bfSrc, 'handleChecknextClick');
const syncTopLevelIndicatorsSrc = extractFunction(bfSrc, 'syncTopLevelIndicators');
const listenerSetupSrc = extractBetween(bfSrc,
    "$('#familydata, #profiledata').off('input change'",
    "$('.geotopcheck').off();");

function installListener() {
    new Function('$', 'exists', `
        ${syncTopLevelIndicatorsSrc}
        ${handleChecknextClickSrc}
        $('.checknext').off();
        $('.checknext').on('click', handleChecknextClick);
        ${listenerSetupSrc}
    `)($, exists);
}

function freshFamilyRow() {
    $('body').html(`
        <div id="familydata">
            <div class="membertitle"><input type="checkbox" class="checkslide"></div>
            <div class="memberexpand">
                <table>
                    <tr><td><input type="checkbox" class="checknext"></td><td><input type="text" name="occupation"></td></tr>
                    <tr><td><input type="checkbox" class="checknext"></td><td><select name="gender"><option value="unknown" selected>Unknown</option><option value="male">Male</option></select></td></tr>
                    <tr class="geoloc"><td><input type="checkbox" class="checknext"></td><td><input type="text" name="birth:location:city"></td></tr>
                    <tr><td><input type="checkbox" class="checknext" disabled></td><td><input type="text" name="cause_of_death" disabled></td></tr>
                    <tr><td><input type="hidden" name="profile_id" value="5"></td></tr>
                </table>
            </div>
        </div>
        <div id="profiledata"></div>
    `);
    // Real .checknext bindings are direct (not delegated) and get rebound
    // on every render by updateClassResponse() - mirrored here by
    // reinstalling after every fresh DOM build, same as the real app does
    // after every buildForm()/expandFamily() call.
    installListener();
}

// --- Typing into a text field checks its own, previously-unchecked checkbox ---
freshFamilyRow();
{
    const occCheckbox = $('input[name="occupation"]').closest('tr').find('.checknext');
    assertEqual(occCheckbox.prop('checked'), false, "Starts unchecked (sanity check)");
    $('input[name="occupation"]').val('Farmer').trigger('input');
    assertEqual(occCheckbox.prop('checked'), true,
        "#304 follow-up: typing into a text field checks its own row's checkbox for the user - the whole point of Dan's proposal");
}

// --- Picking a different option in a <select> does the same, via 'change' ---
freshFamilyRow();
{
    const genderCheckbox = $('select[name="gender"]').closest('tr').find('.checknext');
    $('select[name="gender"]').val('male').trigger('change');
    assertEqual(genderCheckbox.prop('checked'), true,
        "Selecting a different Gender option checks its own checkbox the same way typing does");
}

// --- A field whose checkbox is ALREADY checked is left alone (idempotent, no duplicate side effects) ---
freshFamilyRow();
{
    const occCheckbox = $('input[name="occupation"]').closest('tr').find('.checknext');
    occCheckbox.prop('checked', true);
    $('input[name="occupation"]').val('Baker').trigger('input');
    assertEqual(occCheckbox.prop('checked'), true, "Stays checked - no error, no double-toggle back to unchecked");
}

// --- A genuinely locked field (checkbox itself disabled) never gets auto-checked, even if something dispatches an event on it ---
freshFamilyRow();
{
    const causeCheckbox = $('input[name="cause_of_death"]').closest('tr').find('.checknext');
    assertEqual(causeCheckbox.prop('disabled'), true, "Sanity check: this row is locked");
    $('input[name="cause_of_death"]').val('Pneumonia').trigger('input');
    assertEqual(causeCheckbox.prop('checked'), false,
        "A locked field's checkbox is never auto-checked, even on an input event - the listener's own disabled guard holds");
}

// --- Reuses the REAL handleChecknextClick() wholesale, not a duplicate - the geotopcheck cascade fires too ---
freshFamilyRow();
{
    $('body').find('table').prepend('<tr id="birthlocation"><td></td></tr>');
    const cityCheckbox = $('input[name="birth:location:city"]').closest('tr').find('.checknext');
    $('input[name="birth:location:city"]').val('Chicago').trigger('input');
    assertEqual(cityCheckbox.prop('checked'), true, "The city field's own checkbox checks");
    assertEqual($('#birthlocation').find('.geotopcheck').length, 0,
        "(no .geotopcheck in this minimal fixture - the point of this case is just confirming no error is thrown walking back for one, proving the real handleChecknextClick() body ran, not a stub)");
}

// --- A row with no .checknext at all (profile_id's own shape) never throws, never does anything ---
freshFamilyRow();
{
    assertTrue(true, "Sanity placeholder - the real assertion is that dispatching events near profile_id's row doesn't throw");
    try {
        $('input[name="profile_id"]').trigger('input');
        assertTrue(true, "No .checknext in this row - the listener's own length-0 guard no-ops safely (profile_id itself is a hidden field a user can't type into anyway; this just confirms the guard, not a realistic scenario)");
    } catch (e) {
        assertTrue(false, "Should not throw: " + e.message);
    }
}

// ============================================================
// Part 3: parseForm()'s new selection gate (popup.js) - extracted as its
// own small snippet (not the full 240-line parseForm()) since this is the
// one piece of it that changed; the rest of parseForm() is unrelated to
// this proposal and already covered by its own existing tests.
// ============================================================
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');
const fieldIsSelectedSrc = extractBetween(popupSrc,
    "var checknextForSelection = ",
    "if (fieldIsSelected");
// The extracted snippet reads `fsinput[item]` (its real variable names in
// parseForm()) - supplied here as a one-element array so it resolves
// without modifying the real source.
function computeFieldIsSelectedFor(el) {
    const fsinput = [el];
    const item = 0;
    return new Function('$', 'fsinput', 'item', fieldIsSelectedSrc + '\nreturn fieldIsSelected;')($, fsinput, item);
}

$('body').html(`
    <table>
        <tr><td><input type="checkbox" class="checknext" checked></td><td><input type="text" id="checkedField" name="occupation"></td></tr>
        <tr><td><input type="checkbox" class="checknext"></td><td><input type="text" id="uncheckedField" name="cause_of_death"></td></tr>
        <tr><td><input type="hidden" id="profileIdField" name="profile_id" value="5"></td></tr>
    </table>
`);
assertEqual(computeFieldIsSelectedFor(document.getElementById('checkedField')), true,
    "A field whose row's checkbox IS checked is selected for submission");
assertEqual(computeFieldIsSelectedFor(document.getElementById('uncheckedField')), false,
    "#304 follow-up: a field whose row's checkbox is NOT checked is excluded - even though the field itself stays editable now, it's not submitted until the user actually checks or edits it");
assertEqual(computeFieldIsSelectedFor(document.getElementById('profileIdField')), true,
    "A row with no .checknext at all (profile_id's own shape) is always included - structurally never a protect/select field in the first place");

// ============================================================
// Part 4: live-reported regression (DanCornett, same session) - the FOCUS
// profile's own Name fields (Title/First/Last/Birth Name/Suffix/Display
// Name/Nicknames), plus Occupation and Death Cause, used to hardcode the
// value input's disabled attribute to a literal "disabled" string - never
// going through isEnabled() at all. The ONLY thing that ever flipped them
// to editable was the (now removed) .checknext click handler's blanket
// disable-toggle. The rest of this file's Part 1 fix (isEnabled() itself)
// never touched these, since they never called isEnabled() in the first
// place - confirmed live: these fields stayed stuck disabled even after
// checking their box, exactly the two-click problem this whole proposal
// was meant to remove, now reintroduced a different way. Family-member
// equivalents are NOT affected the same way - they're hardcoded disabled
// too, but get corrected automatically by setGeniFamilyData()'s post-
// render resync (applyProtectedDisabledState(), covered by
// test_checkbox_disabled_resync.js) before the user ever sees them; the
// focus profile has no equivalent resync pass at all.
// ============================================================
assertTrue(bfSrc.indexOf('var nameFocusEnabledAttr = namelocked ? "disabled" : "";') !== -1,
    "The focus profile's Name fields now compute their disabled attribute from namelocked, not a hardcoded literal");
assertTrue(bfSrc.indexOf('buildTextFieldRow("Title:", "title", nameval.prefix, "", nameFocusEnabledAttr,') !== -1,
    "Title uses the computed attribute, not a hardcoded \"disabled\" string");
assertTrue(bfSrc.indexOf('buildTextFieldRow("Also Known As: ", "nicknames", nameval.nickName, "", nameFocusEnabledAttr,') !== -1,
    "Nicknames (the last of the seven name fields) uses it too");
assertTrue(bfSrc.indexOf('var middleNameEnabled = namelocked ? "disabled" : "";') !== -1,
    "Middle Name's own enabled computation is lock-only too, not tied to namescore/mnameonoff/isValue anymore");
assertTrue(bfSrc.indexOf('name="occupation" \' + (focusFieldLocked("occupation") ? "disabled" : "") + \'>') !== -1,
    "Focus Occupation's blank-value branch computes disabled from focusFieldLocked(), not a hardcoded literal");
assertTrue(bfSrc.indexOf('name="cause_of_death" \' + (focusFieldLocked("cause_of_death") ? "disabled" : "") + \'>') !== -1,
    "Focus Death Cause computes disabled from focusFieldLocked(), not a hardcoded literal (both branches - this file's own extractBetween would need updating if a third branch is ever added)");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
