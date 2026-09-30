// Verifies #298 (live-reported, DanCornett - reopened after being closed
// as "not a functional blocker"): "It is not a cosmetic issue or one of
// 'pre-selection'; it is a function missing - being able to select the
// parent when there are multiple spouses of the focus profile." Switching
// a previously-locked child's Action dropdown to "Add Profile" (or to a
// different, writable match) left the parent-selector dropdown - the only
// way to specify WHICH spouse/union a new child belongs to when the focus
// profile has more than one - permanently stuck disabled from the earlier
// lock sweep, and the person-level tick-box the same way.
//
// Root cause: setGeniFamilyData()'s blanket "no edit permission" lock
// sweep disables .parentselector and the .checkslide tick-box - but unlike
// every other field type, which gets its own refreshFieldCheckState()/
// applySelectAllState() pass earlier in the function that correctly
// re-enables it once a match becomes writable, these two controls are
// ONLY ever touched by the lock sweep itself - nothing ever explicitly
// re-enabled them again. Fixed by adding the else branch.
//
// Extracts the real setGeniFamilyData() (and its real dependencies)
// verbatim from buildform.js/shared.js, matching this repo's established
// jsdom extract-and-eval pattern - same harness shape as
// test_298_locked_actionselect_stays_enabled.js.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');

const bfSrc = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');
const sharedSrc = fs.readFileSync('' + ROOT + '/shared.js', 'utf8');
const popupSrc = fs.readFileSync('' + ROOT + '/popup.js', 'utf8');

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
const $ = require('' + ROOT + '/jquery.js');
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

global.genifamilydata = {};
const getGeniDataSrc = extractFunction(sharedSrc, 'getGeniData');
function makeGetGeniData(genifamilydata) {
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
const resolveFieldEnabledSrc = extractFunction(bfSrc, 'resolveFieldEnabled');
const isEnabledSrc = extractFunction(bfSrc, 'isEnabled');
const applyProtectedDisabledStateSrc = extractFunction(bfSrc, 'applyProtectedDisabledState');
const refreshFieldCheckStateSrc = extractFunction(bfSrc, 'refreshFieldCheckState');
const refreshLivingCheckStateSrc = extractFunction(bfSrc, 'refreshLivingCheckState');
const setGeniFamilyDataSrc = extractFunction(bfSrc, 'setGeniFamilyData');
const syncTopLevelIndicatorsSrc = extractFunction(bfSrc, 'syncTopLevelIndicators');
const localizedGenderSrc = extractFunction(bfSrc, 'localizedGender');
const isAliveSrc = extractFunction(bfSrc, 'isAlive');
const isPublicSrc = extractFunction(bfSrc, 'isPublic');
const DATE_QUALIFIER_PATTERN = /^(circa|about|after|before)\s+(the\s+)?/i;
const moment = require(path.join(ROOT, 'moment.js'));
const datesAreEquivalentSrc = extractArrayStatement(popupSrc, 'DATE_PARSE_FORMATS') + '\n' + extractFunction(popupSrc, 'datesAreEquivalent');
const datesAreEquivalent = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN', datesAreEquivalentSrc + '\nreturn datesAreEquivalent;')(exists, moment, DATE_QUALIFIER_PATTERN);
const valuesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'valuesAreEquivalent'))();
const nicknamesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'nicknamesAreEquivalent'))();
const normalizeAboutForComparisonSrc = extractFunction(popupSrc, 'normalizeAboutForComparison');
const isAboutContentPresent = new Function('exists', normalizeAboutForComparisonSrc + '\n' + extractFunction(popupSrc, 'isAboutContentPresent') + '\nreturn isAboutContentPresent;')(exists);
const valuesAreEquivalentForFieldType = new Function('datesAreEquivalent', 'nicknamesAreEquivalent', 'valuesAreEquivalent', 'isAboutContentPresent',
    'return ' + extractFunction(bfSrc, 'valuesAreEquivalentForFieldType'))(datesAreEquivalent, nicknamesAreEquivalent, valuesAreEquivalent, isAboutContentPresent);
const isFieldSelectable = new Function('isValue', 'valuesAreEquivalentForFieldType',
    'return ' + extractFunction(bfSrc, 'isFieldSelectable'))(isValue, valuesAreEquivalentForFieldType);

function build(genifamilydata) {
    const getGeniData = makeGetGeniData(genifamilydata);
    const ctx = new Function(
        '$', 'exists', 'isValue', 'genifamilydata', 'getGeniData', '_', 'isFieldSelectable',
        `
        ${getGeniLockSrc}
        ${getGeniFieldLockedSrc}
        ${getGeniPhotoLockedSrc}
        ${isAppendSrc}
        ${resolveFieldEnabledSrc}
        ${isEnabledSrc}
        ${applyProtectedDisabledStateSrc}
        ${refreshFieldCheckStateSrc}
        ${refreshLivingCheckStateSrc}
        ${localizedGenderSrc}
        ${isAliveSrc}
        ${isPublicSrc}
        ${buildPrivacySelectSrc}
        ${refreshPrivacySelectSrc}
        ${syncTopLevelIndicatorsSrc}
        ${setGeniFamilyDataSrc}
        return { setGeniFamilyData };
        `
    )($, exists, isValue, genifamilydata, getGeniData, function (k) { return k; }, isFieldSelectable);
    return ctx;
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// Includes a real .parentselector row (buildParentSelect()'s own markup
// shape - a <select name="parent" class="parentselector">), matching
// Dan's exact scenario: a child row where more than one spouse means the
// parent has to actually be chosen, not assumed.
function freshDom(memberId, matchedProfileId) {
    $('body').html(`
        <div class="membertitle"><input type="checkbox" class="checkslide"></div>
        <div class="memberexpand">
            <table id="familytable_${memberId}">
                <tr><td><select class="actionselect"><option value="${matchedProfileId}" selected>Update</option><option value="add">Add Profile</option></select></td></tr>
                <tr><td><select name="is_alive" class="livingselect" update="${memberId}"><option value="false" selected>Deceased</option></select></td></tr>
                <tr><td><input type="text" name="first_name" class="checknext"></td></tr>
                <tr name="parenttr"><td><select name="parent" class="parentselector">
                    <option value="1">Spouse One</option>
                    <option value="2">Spouse Two</option>
                </select></td></tr>
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
const lockedProfileId = 'geniLocked1';
const writableProfileId = 'geniWritable1';

global.genifamilydata = {};
global.genifamilydata[lockedProfileId] = new GeniPerson({
    id: lockedProfileId, public: true, is_alive: false,
    actions: ['add-photo'], // no update/update-basics - locked
    names: {}, birth: { date: { year: '1890' } }
});
global.genifamilydata[writableProfileId] = new GeniPerson({
    id: writableProfileId, public: true, is_alive: false,
    actions: ['update', 'update-basics'],
    names: {}, birth: { date: { year: '1890' } }
});

// --- Step 1: matched profile is locked - parentselector and checkslide correctly disabled ---
freshDom(memberId, lockedProfileId);
let ctx = build(global.genifamilydata);
ctx.setGeniFamilyData(memberId, lockedProfileId);
assertEqual($('.parentselector').prop('disabled'), true,
    "While locked: the parent-selector is correctly disabled (nothing should be editable on a locked match)");
assertEqual($('.checkslide').prop('disabled'), true,
    "While locked: the person-level tick-box is correctly disabled too");

// --- Step 2: #298 (live-reported, DanCornett - the reopened scenario): switch to "Add Profile" ---
// setGeniFamilyData() is what actionUpdate() calls on every Action dropdown
// change - this reproduces the exact sequence of switching the SAME row
// from a locked match to "add" without a fresh page render in between.
ctx.setGeniFamilyData(memberId, "add");
assertEqual($('.parentselector').prop('disabled'), false,
    "#298: switching to 'Add Profile' re-enables the parent-selector - this is the actual missing function Dan reported, not a cosmetic gap");
assertEqual($('.checkslide').prop('disabled'), false,
    "#298: switching to 'Add Profile' also re-enables the person-level tick-box");

// --- Regression control: switching to a DIFFERENT, writable match also correctly re-enables both ---
freshDom(memberId, lockedProfileId);
ctx = build(global.genifamilydata);
ctx.setGeniFamilyData(memberId, lockedProfileId);
ctx.setGeniFamilyData(memberId, writableProfileId);
assertEqual($('.parentselector').prop('disabled'), false,
    "Switching to a different, writable Geni match also correctly re-enables the parent-selector");
assertEqual($('.checkslide').prop('disabled'), false,
    "Switching to a different, writable Geni match also correctly re-enables the tick-box");

// --- Regression control: a member that was NEVER locked stays fully enabled (unaffected by this fix) ---
freshDom(memberId, writableProfileId);
ctx = build(global.genifamilydata);
ctx.setGeniFamilyData(memberId, writableProfileId);
assertEqual($('.parentselector').prop('disabled'), false,
    "A member whose match was never locked has its parent-selector enabled as normal");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
