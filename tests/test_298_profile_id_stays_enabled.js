// Verifies a follow-up to #298 (live-reported, DanCornett): after the
// parent-selector/tick-box re-enable fix shipped, switching a previously-
// locked child's Action dropdown to "Add Profile" looked correct in the UI
// (fields pre-selected, parent-selector usable) but Submit silently failed
// with no child actually added - console showed:
//   "Skipping family member with missing/invalid profile_id - see #216"
//
// Root cause: setGeniFamilyData()'s blanket "no edit permission" lock sweep
// (`memberexpand.find('input, select, textarea').not('.genislideinput,
// .actionselect')...disabled(true)`) also disables the row's hidden
// profile_id input - a structural lookup key (which scraped record this
// row represents, used by parseForm()/databyid), never user-editable and
// never something locking is meant to protect, same category as
// .genislideinput/.actionselect which are already excluded from the sweep.
// Unlike every real field, profile_id has no refreshFieldCheckState() call
// of its own (it isn't a value field), so nothing ever re-enabled it again
// after the lock sweep ran - and parseForm() silently skips any disabled
// input's value entirely (popup.js: `!fsinput[item].disabled`), so the
// submission went out with no profile_id at all, correctly tripping the
// #216 guard and silently skipping the whole person.
//
// Fixed by excluding profile_id from the blanket disable in the first
// place (same as .genislideinput/.actionselect), so there's no re-enable
// to forget on the way back out of a lock.
//
// Same jsdom harness shape as test_298_parentselector_reenable.js.
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

// Matches the real row shape (buildform.js:1913) - a bare
// <input type="hidden" name="profile_id"> with no class, alongside a real
// .parentselector row (Dan's exact #298 scenario).
function freshDom(memberId, matchedProfileId) {
    $('body').html(`
        <div class="membertitle"><input type="checkbox" class="checkslide"></div>
        <div class="memberexpand">
            <table id="familytable_${memberId}">
                <tr><td><input type="hidden" name="profile_id" value="${memberId}"></td></tr>
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

const memberId = '7';
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

// --- Step 1: matched profile is locked - profile_id is excluded from the blanket disable, same as .genislideinput/.actionselect ---
freshDom(memberId, lockedProfileId);
let ctx = build(global.genifamilydata);
ctx.setGeniFamilyData(memberId, lockedProfileId);
assertEqual($('[name="profile_id"]').prop('disabled'), false,
    "While locked: the hidden profile_id input is never disabled in the first place (it's a structural lookup key, not a protectable field - harmless either way here, since the row's checkslide is disabled/unchecked, so it's never submitted while genuinely locked)");

// --- Step 2: #216/#298 - switch to "Add Profile", same row, no fresh render in between ---
ctx.setGeniFamilyData(memberId, "add");
assertEqual($('[name="profile_id"]').prop('disabled'), false,
    "#216/#298: switching to 'Add Profile' re-enables the hidden profile_id input - this is the actual bug behind \"Skipping family member with missing/invalid profile_id - see #216\": the field the submission needs to identify this person was left disabled, so parseForm() silently dropped it and the whole person got skipped");

// --- Regression control: switching to a DIFFERENT, writable match also re-enables it ---
freshDom(memberId, lockedProfileId);
ctx = build(global.genifamilydata);
ctx.setGeniFamilyData(memberId, lockedProfileId);
ctx.setGeniFamilyData(memberId, writableProfileId);
assertEqual($('[name="profile_id"]').prop('disabled'), false,
    "Switching to a different, writable Geni match also re-enables profile_id");

// --- Regression control: a member that was NEVER locked never has profile_id disabled at all ---
freshDom(memberId, writableProfileId);
ctx = build(global.genifamilydata);
ctx.setGeniFamilyData(memberId, writableProfileId);
assertEqual($('[name="profile_id"]').prop('disabled'), false,
    "A member whose match was never locked never has profile_id disabled in the first place");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
