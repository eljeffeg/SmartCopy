// Verifies #298 (live-reported): when the currently-selected Geni match
// for a family member can't be written to (no "update"/"update-basics"
// permission), setGeniFamilyData()'s blanket lock sweep used to disable
// EVERY input/select/textarea in that member's block, including the
// Action dropdown itself (.actionselect) - leaving no way to pick a
// different match or switch to "Add Profile". Fixed by excluding
// .actionselect from the blanket disable. Extracts the real
// setGeniFamilyData() (and its real dependencies) verbatim from
// buildform.js/shared.js, matching this repo's established jsdom
// extract-and-eval pattern (see repro_299.js).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');

const bfSrc = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');
const sharedSrc = fs.readFileSync('' + ROOT + '/shared.js', 'utf8');

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
const applyProtectedDisabledStateSrc = extractFunction(bfSrc, 'applyProtectedDisabledState');
const refreshFieldCheckStateSrc = extractFunction(bfSrc, 'refreshFieldCheckState');
const refreshLivingCheckStateSrc = extractFunction(bfSrc, 'refreshLivingCheckState');
const setGeniFamilyDataSrc = extractFunction(bfSrc, 'setGeniFamilyData');
const localizedGenderSrc = extractFunction(bfSrc, 'localizedGender');
const isAliveSrc = extractFunction(bfSrc, 'isAlive');
const isPublicSrc = extractFunction(bfSrc, 'isPublic');

function build(genifamilydata) {
    const getGeniData = makeGetGeniData(genifamilydata);
    const ctx = new Function(
        '$', 'exists', 'isValue', 'genifamilydata', 'getGeniData', '_',
        `
        ${getGeniLockSrc}
        ${getGeniFieldLockedSrc}
        ${getGeniPhotoLockedSrc}
        ${isAppendSrc}
        ${applyProtectedDisabledStateSrc}
        ${refreshFieldCheckStateSrc}
        ${refreshLivingCheckStateSrc}
        ${localizedGenderSrc}
        ${isAliveSrc}
        ${isPublicSrc}
        ${buildPrivacySelectSrc}
        ${refreshPrivacySelectSrc}
        ${setGeniFamilyDataSrc}
        return { setGeniFamilyData };
        `
    )($, exists, isValue, genifamilydata, getGeniData, function (k) { return k; });
    return ctx;
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

function freshDom(memberId, matchedProfileId) {
    $('body').html(`
        <div class="membertitle"><input type="checkbox" class="checkslide"></div>
        <div class="memberexpand">
            <table id="familytable_${memberId}">
                <tr><td><select class="actionselect"><option value="${matchedProfileId}" selected>Update</option><option value="add">Add Profile</option></select></td></tr>
                <tr><td><select name="is_alive" class="livingselect" update="${memberId}"><option value="false" selected>Deceased</option></select></td></tr>
                <tr><td><input type="text" name="first_name" class="checknext"></td></tr>
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

// --- Case 1: matched profile has NO update permission at all (the #298 scenario) ---
const lockedProfileId = 'geniLocked1';
global.genifamilydata = {};
global.genifamilydata[lockedProfileId] = new GeniPerson({
    id: lockedProfileId,
    public: true,
    is_alive: false,
    actions: ['add-photo'], // no "update"/"update-basics" - can't be written to
    names: {},
    birth: { date: { year: '1890' } }
});
freshDom(memberId, lockedProfileId);
let ctx = build(global.genifamilydata);
ctx.setGeniFamilyData(memberId, lockedProfileId);

assertEqual($('select.actionselect').prop('disabled'), false,
    "#298: the Action dropdown itself stays enabled when the matched profile can't be written to");
assertEqual($('select[name="is_alive"]').prop('disabled'), true,
    "Every OTHER field for this member is still correctly locked/disabled");
assertEqual($('input.checknext').prop('disabled'), true,
    "The per-member select-all checkbox is still correctly locked/disabled");
assertEqual($('.checkslide').prop('disabled'), true,
    "The member's own top-level checkbox is still correctly locked/disabled");
assertEqual($('#' + memberId + '_action_lock').css('display'), 'inline',
    "The lock icon still correctly shows for this member");

// --- Case 2: matched profile DOES have update permission - nothing should be locked ---
const writableProfileId = 'geniWritable1';
global.genifamilydata = {};
global.genifamilydata[writableProfileId] = new GeniPerson({
    id: writableProfileId,
    public: true,
    is_alive: false,
    actions: ['update', 'update-basics'],
    names: {},
    birth: { date: { year: '1890' } }
});
freshDom(memberId, writableProfileId);
ctx = build(global.genifamilydata);
ctx.setGeniFamilyData(memberId, writableProfileId);

assertEqual($('select.actionselect').prop('disabled'), false,
    "Writable match: Action dropdown enabled (unchanged baseline behavior)");
assertEqual($('#' + memberId + '_action_lock').css('display'), 'none',
    "Writable match: no lock icon shown");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
