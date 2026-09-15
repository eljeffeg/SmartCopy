// Verifies #304 ("Too much being pre-selected?", live-reported by
// DanCornett): once a family member is confidently matched, every field
// the source had real data for used to pre-check regardless of whether it
// was actually different from what Geni already had - defeating the point
// of the green highlighting (a wall of green on fields that already match
// exactly). Fixed by threading a "sameAsGeni" comparison into the
// checked/enabled resolver, with a per-fieldType comparator: generic
// (case/whitespace-insensitive), date (Circa/About-stripped, Before/After/
// Between kept strict), and nicknames (containment, not exact match).
// Extracts every real function verbatim, no reimplementations - same
// jsdom extract-and-eval pattern as tests/test_298_locked_actionselect_stays_enabled.js.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');

const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');
const sharedSrc = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

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
function extractArrayStatement(src, name) {
    const marker = 'var ' + name + ' =';
    const start = src.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    const semi = src.indexOf(';', start);
    return src.slice(start, semi + 1);
}

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;

function exists(v) { return typeof v !== "undefined" && v !== null; }
function isValue(v) { return v !== ""; }
global.exists = exists;
global.isValue = isValue;

function checkNested(obj) {
    var args = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < args.length; i++) {
        if (!obj || !obj.hasOwnProperty(args[i])) { return false; }
        obj = obj[args[i]];
    }
    return true;
}
global.checkNested = checkNested;
const GeniPersonSrc = extractFunction(sharedSrc, 'GeniPerson');
const GeniPerson = new Function('exists', 'checkNested', 'geniPhoto', 'return ' + GeniPersonSrc)(
    exists, checkNested, function () { return 'images/no_photo_u.gif'; }
);

const moment = require(path.join(ROOT, 'moment.js'));
const DATE_QUALIFIER_PATTERN = /^(circa|about|after|before)\s+(the\s+)?/i;
const datesAreEquivalentSrc = extractArrayStatement(popupSrc, 'DATE_PARSE_FORMATS') + '\n' + extractFunction(popupSrc, 'datesAreEquivalent');
const datesAreEquivalent = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN', datesAreEquivalentSrc + '\nreturn datesAreEquivalent;')(exists, moment, DATE_QUALIFIER_PATTERN);
global.datesAreEquivalent = datesAreEquivalent;

const valuesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'valuesAreEquivalent'))();
const nicknamesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'nicknamesAreEquivalent'))();
global.valuesAreEquivalent = valuesAreEquivalent;
global.nicknamesAreEquivalent = nicknamesAreEquivalent;

const resolveFieldEnabled = new Function('isValue', 'exists', 'return ' + extractFunction(bfSrc, 'resolveFieldEnabled'))(isValue, exists);
const isChecked = new Function('resolveFieldEnabled', 'return ' + extractFunction(bfSrc, 'isChecked'))(resolveFieldEnabled);
const isEnabled = new Function('resolveFieldEnabled', 'return ' + extractFunction(bfSrc, 'isEnabled'))(resolveFieldEnabled);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// ============================================================
// Unit: valuesAreEquivalent() - generic case/whitespace-insensitive compare
// ============================================================
assertEqual(valuesAreEquivalent('Farmer', 'farmer'), true, "Case-insensitive");
assertEqual(valuesAreEquivalent('John  Smith', 'John Smith'), true, "Multiple spaces collapse to one before comparing");
assertEqual(valuesAreEquivalent('  Farmer  ', 'Farmer'), true, "Leading/trailing whitespace ignored");
assertEqual(valuesAreEquivalent('Farmer', 'Blacksmith'), false, "Genuinely different values are NOT equivalent");
assertEqual(valuesAreEquivalent('', ''), true, "Two blanks are equivalent");
assertEqual(valuesAreEquivalent(undefined, ''), true, "undefined normalizes the same as blank, never throws");

// ============================================================
// Unit: nicknamesAreEquivalent() - containment, not exact string equality
// ============================================================
assertEqual(nicknamesAreEquivalent('Johnny', ['Johnny', 'Jack']), true, "A single scraped nickname already present in Geni's array - equivalent (nothing new to add)");
assertEqual(nicknamesAreEquivalent('Johnny,Jack', 'Jack,Johnny'), true, "Order never matters, comma-string current-value form works too");
assertEqual(nicknamesAreEquivalent('johnny', ['Johnny']), true, "Case-insensitive, same as the generic comparator");
assertEqual(nicknamesAreEquivalent('Johnny,Rusty', ['Johnny']), false, "A genuinely NEW nickname among the scraped set - Geni doesn't have 'Rusty' yet, so this is real new data");
assertEqual(nicknamesAreEquivalent('', ['Johnny']), false, "Nothing scraped - never silently 'equivalent' on an empty scraped side (isValue() upstream already guards blank, this is defense in depth)");

// ============================================================
// Unit: resolveFieldEnabled()'s new sameAsGeni parameter
// ============================================================
assertEqual(resolveFieldEnabled('Farmer', true, false, 'Farmer', false, true), false,
    "sameAsGeni=true suppresses the 'scraped has data' branch - the core #304 fix");
assertEqual(resolveFieldEnabled('Farmer', true, false, 'Blacksmith', false, false), true,
    "sameAsGeni=false (genuinely different) still checks/enables as before");
assertEqual(resolveFieldEnabled('Farmer', true, false, 'Farmer', true, true), false,
    "locked still wins over everything, sameAsGeni or not");
assertEqual(resolveFieldEnabled('Farmer', true, true, 'Farmer', false, true), true,
    "force still wins over sameAsGeni - an estimated field forced true stays true (isCheckedDateField/isEnabledDateField already special-case estimated dates separately before this would ever be reached in practice)");
assertEqual(resolveFieldEnabled('Farmer', true, false, 'Farmer', false), true,
    "Omitting the new sameAsGeni argument entirely (undefined, falsy) reproduces every pre-#304 call site's exact behavior - still checks/enables purely on scraped-has-data, unchanged");
assertEqual(resolveFieldEnabled('', true, false, '', false), false,
    "#304 follow-up (live-reported, DanCornett): a blank scraped value NEVER pre-checks/enables, even when Geni's side is also blank - removed the old 'nothing to protect, save a click' branch entirely per Dan's explicit 'a blank source field should never be pre-selected' confirmation");
assertEqual(resolveFieldEnabled('', true, false, 'Real Geni Value', false), false,
    "Blank scraped + Geni HAS real data - still correctly protected/unchecked (unchanged baseline)");

// ============================================================
// End-to-end: setGeniFamilyData() via a real jsdom window
// ============================================================
function makeGetGeniData(genifamilydata) {
    const getGeniDataSrc = extractFunction(sharedSrc, 'getGeniData');
    return new Function('exists', 'geniPhoto', 'genifamilydata', 'return ' + getGeniDataSrc)(
        exists, function () { return 'images/no_photo_u.gif'; }, genifamilydata
    );
}

const buildPrivacySelectSrc = extractFunction(bfSrc, 'buildPrivacySelect');
const refreshPrivacySelectSrc = extractFunction(bfSrc, 'refreshPrivacySelect');
const getGeniLockSrc = extractFunction(bfSrc, 'getGeniLock');
const getGeniFieldLockedSrc = extractFunction(bfSrc, 'getGeniFieldLocked');
const getGeniPhotoLockedSrc = extractFunction(bfSrc, 'getGeniPhotoLocked');
const isAppendSrc = extractFunction(bfSrc, 'isAppend');
const valuesAreEquivalentSrc = extractFunction(bfSrc, 'valuesAreEquivalent');
const nicknamesAreEquivalentSrc = extractFunction(bfSrc, 'nicknamesAreEquivalent');
const valuesAreEquivalentForFieldTypeSrc = extractFunction(bfSrc, 'valuesAreEquivalentForFieldType');
const resolveFieldEnabledSrc = extractFunction(bfSrc, 'resolveFieldEnabled');
const isEnabledSrc = extractFunction(bfSrc, 'isEnabled');
const isCheckedSrc = extractFunction(bfSrc, 'isChecked');
const applyProtectedDisabledStateSrc = extractFunction(bfSrc, 'applyProtectedDisabledState');
const refreshFieldCheckStateSrc = extractFunction(bfSrc, 'refreshFieldCheckState');
const refreshLivingCheckStateSrc = extractFunction(bfSrc, 'refreshLivingCheckState');
const setGeniFamilyDataSrc = extractFunction(bfSrc, 'setGeniFamilyData');
const localizedGenderSrc = extractFunction(bfSrc, 'localizedGender');
const isAliveSrc = extractFunction(bfSrc, 'isAlive');
const isPublicSrc = extractFunction(bfSrc, 'isPublic');
// setGeniFamilyData() re-runs applySelectAllState() whenever the person's
// own top-level checkbox is already checked (see #304's person-bar
// scenarios below, which deliberately start pre-checked) - pull in the
// same dependency chain this needs, real source throughout.
const isFieldValueBlankSrc = extractFunction(bfSrc, 'isFieldValueBlank');
const isCompanionBlankSrc = extractFunction(bfSrc, 'isCompanionBlank');
const isFieldEmptyForCheckAllSrc = extractFunction(popupSrc, 'isFieldEmptyForCheckAll');
const applySelectAllStateSrc = extractFunction(bfSrc, 'applySelectAllState');
const syncGeotopcheckStateSrc = extractFunction(bfSrc, 'syncGeotopcheckState');

function build(genifamilydata) {
    const getGeniData = makeGetGeniData(genifamilydata);
    const ctx = new Function(
        '$', 'exists', 'isValue', 'genifamilydata', 'getGeniData', '_', 'datesAreEquivalent',
        `
        ${valuesAreEquivalentSrc}
        ${nicknamesAreEquivalentSrc}
        ${valuesAreEquivalentForFieldTypeSrc}
        ${getGeniLockSrc}
        ${getGeniFieldLockedSrc}
        ${getGeniPhotoLockedSrc}
        ${isAppendSrc}
        ${resolveFieldEnabledSrc}
        ${isEnabledSrc}
        ${isCheckedSrc}
        ${applyProtectedDisabledStateSrc}
        ${refreshFieldCheckStateSrc}
        ${refreshLivingCheckStateSrc}
        ${localizedGenderSrc}
        ${isAliveSrc}
        ${isPublicSrc}
        ${buildPrivacySelectSrc}
        ${refreshPrivacySelectSrc}
        ${isFieldValueBlankSrc}
        ${isCompanionBlankSrc}
        ${isFieldEmptyForCheckAllSrc}
        ${applySelectAllStateSrc}
        ${syncGeotopcheckStateSrc}
        ${setGeniFamilyDataSrc}
        return { setGeniFamilyData };
        `
    )($, exists, isValue, genifamilydata, getGeniData, function (k) { return k; }, datesAreEquivalent);
    return ctx;
}

function freshDom(memberId, matchedProfileId, occupationValue, occupationChecked) {
    $('body').html(`
        <div class="membertitle"><input type="checkbox" class="checkslide" checked></div>
        <div class="memberexpand">
            <table id="familytable_${memberId}">
                <tr><td><select class="actionselect"><option value="${matchedProfileId}" selected>Update</option><option value="add">Add Profile</option></select></td></tr>
                <tr><td><select name="is_alive" class="livingselect" update="${memberId}"><option value="false" selected>Deceased</option></select></td></tr>
                <tr><td><input type="checkbox" class="checknext" ${occupationChecked ? 'checked' : ''}></td><td><input type="text" name="occupation" value="${occupationValue}"></td><td><input id="${memberId}_geni_occupation" type="text" class="genislideinput" disabled></td></tr>
            </table>
            <select class="privacyselect" update="${memberId}" data-birthyear="1890">
                <option value="" selected>Auto</option><option value=true>Public</option><option value=false>Private</option>
            </select>
            <input id="${memberId}_public_checkbox" type="checkbox">
            <span id="${memberId}_action_lock"></span>
        </div>
    `);
}

const memberId = '0';

// --- Scenario 1: scraped occupation case/whitespace-different from Geni's - the exact #304 "wall of green" bug ---
{
    const profileId = 'geniMatch1';
    global.genifamilydata = {};
    global.genifamilydata[profileId] = new GeniPerson({
        id: profileId, public: true, is_alive: false,
        actions: ['update', 'update-basics'], names: {},
        birth: { date: { year: '1890' } }, occupation: 'Farmer'
    });
    freshDom(memberId, profileId, 'FARMER', true);
    const ctx = build(global.genifamilydata);
    ctx.setGeniFamilyData(memberId, profileId);

    assertEqual($('input[name="occupation"]').closest('tr').find('.checknext').prop('checked'), false,
        "#304: occupation un-checks once the match reveals it's already 'Farmer' on Geni, modulo case - Dan's reported wall-of-green");
    assertEqual($('input[name="occupation"]').prop('disabled'), true,
        "#304 follow-up (live-reported, DanCornett): the field itself also stays disabled (grey), not just its checkbox unchecked - applySelectAllState()'s own second filter (separate from the checkbox filter) used to force-re-enable it a moment later since Select All was already on for this person, showing green for a field whose checkbox had correctly unchecked - 'inconsistent visual implications' from Dan's report");
    assertEqual($('.checkslide').prop('checked'), false,
        "#304 person-bar converse: the top-level box (pre-checked as an earlier explicit action) clears too, since nothing underneath ended up checked");
}

// --- Scenario 2: control - a genuinely different occupation stays checked, and so does the person-bar ---
{
    const profileId = 'geniMatch2';
    global.genifamilydata = {};
    global.genifamilydata[profileId] = new GeniPerson({
        id: profileId, public: true, is_alive: false,
        actions: ['update', 'update-basics'], names: {},
        birth: { date: { year: '1890' } }, occupation: 'Blacksmith'
    });
    freshDom(memberId, profileId, 'Farmer', true);
    const ctx = build(global.genifamilydata);
    ctx.setGeniFamilyData(memberId, profileId);

    assertEqual($('input[name="occupation"]').closest('tr').find('.checknext').prop('checked'), true,
        "Control: a genuinely different occupation ('Farmer' scraped vs. Geni's 'Blacksmith') stays checked");
    assertEqual($('.checkslide').prop('checked'), true,
        "Control: the person-bar stays checked too, since a real field underneath still is");
}

// --- Scenario 3 (regression, part (c) of Dan's brief): a locked member never gets checked, even when every field would otherwise now match ---
{
    const profileId = 'geniLocked1';
    global.genifamilydata = {};
    global.genifamilydata[profileId] = new GeniPerson({
        id: profileId, public: true, is_alive: false,
        actions: [], names: {}, // no update/update-basics - locked
        birth: { date: { year: '1890' } }, occupation: 'Farmer'
    });
    freshDom(memberId, profileId, 'Farmer', true);
    const ctx = build(global.genifamilydata);
    ctx.setGeniFamilyData(memberId, profileId);

    assertEqual($('input[name="occupation"]').closest('tr').find('.checknext').prop('checked'), false,
        "Regression (part c): a locked member's occupation stays un-checked regardless of the new comparator");
    assertEqual($('.checkslide').prop('checked'), false,
        "Regression (part c): the person-bar stays un-checked for a locked member too");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
