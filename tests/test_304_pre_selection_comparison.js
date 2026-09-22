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
const dateSpecificitySrc = extractArrayStatement(popupSrc, 'DATE_SPECIFICITY_FORMATS') + '\n' +
    extractFunction(popupSrc, 'getDateSpecificity') + '\n' + extractFunction(popupSrc, 'isDateSpecificityDowngrade');
const isDateSpecificityDowngrade = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN',
    dateSpecificitySrc + '\nreturn isDateSpecificityDowngrade;')(exists, moment, DATE_QUALIFIER_PATTERN);

const valuesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'valuesAreEquivalent'))();
const nicknamesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'nicknamesAreEquivalent'))();
const isPublic = new Function('return ' + extractFunction(bfSrc, 'isPublic'))();
const isAlive = new Function('_', 'return ' + extractFunction(bfSrc, 'isAlive'))(function (k) { return k; });
global.valuesAreEquivalent = valuesAreEquivalent;
global.nicknamesAreEquivalent = nicknamesAreEquivalent;

const resolveFieldEnabled = new Function('isValue', 'exists', 'return ' + extractFunction(bfSrc, 'resolveFieldEnabled'))(isValue, exists);
const isChecked = new Function('resolveFieldEnabled', 'return ' + extractFunction(bfSrc, 'isChecked'))(resolveFieldEnabled);
const isEnabled = new Function('resolveFieldEnabled', 'return ' + extractFunction(bfSrc, 'isEnabled'))(resolveFieldEnabled);

const valuesAreEquivalentForFieldType = new Function('datesAreEquivalent', 'nicknamesAreEquivalent', 'valuesAreEquivalent', 'isDateSpecificityDowngrade',
    'return ' + extractFunction(bfSrc, 'valuesAreEquivalentForFieldType'))(datesAreEquivalent, nicknamesAreEquivalent, valuesAreEquivalent, isDateSpecificityDowngrade);
// #304 follow-up (consolidation pass): the single shared "would this field
// actually contribute something new" answer - both applyProtectedDisabledState()
// and isFieldEmptyForCheckAll() defer to this now instead of each
// re-deriving the same blank/equivalence logic independently.
const isFieldSelectable = new Function('isValue', 'valuesAreEquivalentForFieldType',
    'return ' + extractFunction(bfSrc, 'isFieldSelectable'))(isValue, valuesAreEquivalentForFieldType);
const isFieldValueBlank = new Function('return ' + extractFunction(bfSrc, 'isFieldValueBlank'))();
// isFieldEmptyForCheckAll() lives in popup.js, calls back into buildform.js's
// isFieldValueBlank()/isFieldSelectable() - same cross-file pattern already
// established (buildform.js already calls popup.js's datesAreEquivalent()),
// safe since both are only ever actually invoked later, after every script
// has loaded.
const isFieldEmptyForCheckAll = new Function('isFieldValueBlank', 'isFieldSelectable', 'valuesAreEquivalent', 'isPublic', 'isAlive',
    'return ' + extractFunction(popupSrc, 'isFieldEmptyForCheckAll'))(isFieldValueBlank, isFieldSelectable, valuesAreEquivalent, isPublic, isAlive);

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
// (live-reported, DanCornett, #304 follow-up): a middle initial scraped
// without a period against a Geni value that has one (or vice versa)
// never matched - periods are now stripped before comparing.
assertEqual(valuesAreEquivalent('M', 'M.'), true, "A middle initial without a period matches its punctuated counterpart");
assertEqual(valuesAreEquivalent('Jr.', 'Jr'), true, "Same for a suffix abbreviation");
assertEqual(valuesAreEquivalent('St. Louis', 'St Louis'), true, "Removing the period doesn't introduce a double space");
assertEqual(valuesAreEquivalent('M', 'N.'), false, "Still correctly NOT equivalent when the letters themselves differ");

// ============================================================
// Unit: isFieldSelectable() - the single shared "would this field actually contribute something new"
// answer, introduced during a consolidation pass to replace duplicated logic in
// applyProtectedDisabledState() and isFieldEmptyForCheckAll() that had already drifted apart more than once.
// ============================================================
assertEqual(isFieldSelectable('', ''), false, "Blank scraped is never selectable, regardless of Geni's side");
assertEqual(isFieldSelectable('', 'Farmer'), false, "Blank scraped is never selectable even when Geni has real data");
assertEqual(isFieldSelectable('Farmer', ''), true, "Scraped has data, Geni has nothing to compare against - always selectable");
assertEqual(isFieldSelectable('Farmer', 'Blacksmith'), true, "Genuinely different values - selectable");
assertEqual(isFieldSelectable('FARMER', 'Farmer'), false, "Identical modulo case - not selectable, nothing new");
assertEqual(isFieldSelectable('November 1963', 'November 13, 1963', 'date'), false,
    "Per-fieldType dispatch works too - a date specificity downgrade is not selectable");
assertEqual(isFieldSelectable('Johnny', ['Johnny', 'Jack'], 'nicknames'), false,
    "A nickname already contained in Geni's list is not selectable");

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
// Unit: isFieldEmptyForCheckAll() (popup.js) - "Select All"'s own
// independent no-op detection, now aligned with resolveFieldEnabled()'s
// two #304 rules: blank scraped never selectable (regardless of Geni's
// side), and non-blank-but-sameAsGeni never selectable either.
// ============================================================
function makeCheckAllRow(fieldName, value, companionValue) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><input type="text" name="' + fieldName + '"></td><td><input type="text" class="genislideinput" disabled></td>';
    tr.querySelector('input[name="' + fieldName + '"]').value = value;
    tr.querySelector('.genislideinput').value = companionValue;
    return $(tr);
}
assertEqual(isFieldEmptyForCheckAll(makeCheckAllRow('occupation', '', '')), true,
    "#304 follow-up: blank scraped + blank Geni companion is now excluded from Select All too, not just included as 'nothing to protect' - matches resolveFieldEnabled()'s same rule");
assertEqual(isFieldEmptyForCheckAll(makeCheckAllRow('occupation', '', 'Blacksmith')), true,
    "Blank scraped + Geni HAS real data - still excluded (protected), unchanged baseline");
assertEqual(isFieldEmptyForCheckAll(makeCheckAllRow('occupation', 'FARMER', 'Farmer')), true,
    "#304: non-blank but identical to Geni (case-insensitive) - excluded, nothing new to select");
assertEqual(isFieldEmptyForCheckAll(makeCheckAllRow('occupation', 'Farmer', 'Blacksmith')), false,
    "A genuinely different, non-blank value is NOT excluded - Select All should still pick it up");

function makeCheckAllSelectRow(fieldName, value, companionValue, dataScraped) {
    var tr = document.createElement('tr');
    var scrapedAttr = dataScraped ? ' data-scraped="true"' : '';
    tr.innerHTML = '<td><select name="' + fieldName + '"' + scrapedAttr + '><option value="' + value + '" selected></option></select></td><td><input type="text" class="genislideinput" disabled></td>';
    tr.querySelector('.genislideinput').value = companionValue;
    return $(tr);
}
// #304 follow-up (live-reported, DanCornett, confirmed live): Gender used to be excluded from this function's
// comparison entirely (a cautious workaround for the companion column's localized display value), which left
// Gender pre-checking via Select All even when it already matched Geni exactly.
assertEqual(isFieldEmptyForCheckAll(makeCheckAllSelectRow('gender', 'male', 'Male')), true,
    "#304 follow-up: Gender identical to Geni (modulo the display column's capitalization) is now excluded from Select All too, matching the main resolver's own Gender fix");
assertEqual(isFieldEmptyForCheckAll(makeCheckAllSelectRow('gender', 'male', 'Female')), false,
    "A genuinely different Gender is still correctly picked up by Select All");
// (live-reported, DanCornett, #313): Living/is_alive had the same raw-vs-
// localized gap as Privacy - isAlive() displays the companion as localized
// "Living"/"Deceased" text, while the <select>'s own scraped value is the
// raw "true"/"false". Fixed the same way Privacy was, by reusing isAlive()
// itself for the comparison instead of a raw string compare.
assertEqual(isFieldEmptyForCheckAll(makeCheckAllSelectRow('is_alive', 'true', 'Living', true)), true,
    "#313: Living matching Geni's own value is now excluded from Select All too");
assertEqual(isFieldEmptyForCheckAll(makeCheckAllSelectRow('is_alive', 'false', 'Deceased', true)), true,
    "Same for a matching Deceased value");
assertEqual(isFieldEmptyForCheckAll(makeCheckAllSelectRow('is_alive', 'true', 'Deceased', true)), false,
    "A genuinely different Vital value is still correctly picked up by Select All");

// (live-reported, DanCornett, #299/#304): Privacy's <select name="public">
// wasn't in isFieldEmptyForCheckAll()'s field list at all until now, so the
// category-wide "select all non-matching" click always treated it as
// differing regardless of Geni's actual value - even though the initial,
// per-field render (buildPrivacySelect()) already got this right.
assertEqual(isFieldEmptyForCheckAll(makeCheckAllSelectRow('public', 'true', 'Public')), true,
    "Privacy matching Geni's own 'Public' value (raw true vs. isPublic()'s localized text) is now excluded from Select All");
assertEqual(isFieldEmptyForCheckAll(makeCheckAllSelectRow('public', 'false', 'Private')), true,
    "Same for a matching 'Private' value");
assertEqual(isFieldEmptyForCheckAll(makeCheckAllSelectRow('public', 'true', 'Private')), false,
    "A genuinely different Privacy value is still correctly picked up by Select All");
assertEqual(isFieldEmptyForCheckAll(makeCheckAllSelectRow('public', '', '')), true,
    "Auto (blank select value) is treated as blank/no-op, same as isFieldValueBlank() already does for every other field");

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
const isFieldSelectableSrc = extractFunction(bfSrc, 'isFieldSelectable');
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
        ${isFieldSelectableSrc}
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

function freshDom(memberId, matchedProfileId, occupationValue, occupationChecked, selectAllActive, causeOfDeathValue, causeOfDeathChecked, livingChecked, livingScrapedFlag) {
    $('body').html(`
        <div class="membertitle"><input type="checkbox" class="checkslide" checked data-select-all-active="${selectAllActive ? 'true' : 'false'}"></div>
        <div class="memberexpand">
            <table id="familytable_${memberId}">
                <tr><td><select class="actionselect"><option value="${matchedProfileId}" selected>Update</option><option value="add">Add Profile</option></select></td></tr>
                <tr><td><input type="checkbox" class="checknext" ${livingChecked ? 'checked' : ''}></td><td><select name="is_alive" class="livingselect" data-scraped="${livingScrapedFlag ? 'true' : 'false'}" update="${memberId}"><option value="false" selected>Deceased</option><option value="true">Living</option></select></td><td><input id="${memberId}_geni_is_alive" type="text" class="genislideinput" disabled></td></tr>
                <tr><td><input type="checkbox" class="checknext" ${occupationChecked ? 'checked' : ''}></td><td><input type="text" name="occupation" value="${occupationValue}"></td><td><input id="${memberId}_geni_occupation" type="text" class="genislideinput" disabled></td></tr>
                <tr><td><input type="checkbox" class="checknext" ${causeOfDeathChecked ? 'checked' : ''}></td><td><input type="text" name="cause_of_death" value="${causeOfDeathValue || ''}"></td><td><input id="${memberId}_geni_cause_of_death" type="text" class="genislideinput" disabled></td></tr>
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
    freshDom(memberId, profileId, 'FARMER', true, true);
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
    freshDom(memberId, profileId, 'Farmer', true, true);
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
    freshDom(memberId, profileId, 'Farmer', true, true);
    const ctx = build(global.genifamilydata);
    ctx.setGeniFamilyData(memberId, profileId);

    assertEqual($('input[name="occupation"]').closest('tr').find('.checknext').prop('checked'), false,
        "Regression (part c): a locked member's occupation stays un-checked regardless of the new comparator");
    assertEqual($('.checkslide').prop('checked'), false,
        "Regression (part c): the person-bar stays un-checked for a locked member too");
}

// --- Scenario 4 (live-reported, DanCornett): the top-level box checked merely as an INDICATOR (one field was
// individually checked) must NOT be mistaken for an explicit "Select All" - a match/dropdown change must not
// force-check other non-blank fields just because the box happens to read checked. ---
{
    const profileId = 'geniMatch4';
    global.genifamilydata = {};
    global.genifamilydata[profileId] = new GeniPerson({
        id: profileId, public: true, is_alive: false,
        actions: ['update', 'update-basics'], names: {},
        birth: { date: { year: '1890' } }, occupation: 'Farmer', cause_of_death: ''
    });
    // occupation matches Geni exactly (would stay unchecked under normal
    // per-field resolution) and starts UNCHECKED; cause_of_death is
    // genuinely different and was individually checked by the user,
    // ticking the top box as a pure indicator (data-select-all-active
    // left false, unlike scenarios 1-3 above).
    freshDom(memberId, profileId, 'Farmer', false, false, 'Heart Disease', true);
    const ctx = build(global.genifamilydata);
    ctx.setGeniFamilyData(memberId, profileId);

    assertEqual($('input[name="occupation"]').closest('tr').find('.checknext').prop('checked'), false,
        "#304 follow-up: occupation stays un-checked - the top box being checked as an indicator (from cause_of_death alone) must never force-include an unrelated matching field");
    assertEqual($('input[name="cause_of_death"]').closest('tr').find('.checknext').prop('checked'), true,
        "The individually-checked field the user actually touched stays checked, via its own normal per-field resolution");
    assertEqual($('.checkslide').prop('checked'), true,
        "The person-bar stays checked too, purely as the indicator it always was (OR of the one real field still checked)");
}

// --- Scenario 5 (live-reported, DanCornett): Vital pre-checks for a brand-new "Add Profile" candidate even
// when the scraper only defaulted (not genuinely scraped) a Living/Deceased guess - critical because an
// unsubmitted is_alive can let Geni's own Auto-privacy logic default the new profile to Private. ---
{
    global.genifamilydata = {};
    // livingChecked=true (matches render time, which always checks Vital regardless of data-scraped);
    // livingScrapedFlag=false (the scraper never determined a real living status - just the render default).
    freshDom(memberId, 'add', 'Farmer', true, false, '', false, true, false);
    const ctx = build(global.genifamilydata);
    ctx.setGeniFamilyData(memberId, 'add');

    assertEqual($('select[name="is_alive"]').closest('tr').find('.checknext').prop('checked'), true,
        "#304 follow-up (live-reported, DanCornett): Vital stays checked for a brand-new 'Add Profile' candidate even when only defaulted (not genuinely scraped) - there's no existing Geni value to protect, and leaving it unsubmitted risks Geni's own Auto-privacy defaulting the new profile to Private");
    assertEqual($('select[name="is_alive"]').prop('disabled'), false,
        "The field itself stays enabled too, so the default value actually submits");
}

// --- Scenario 6 (regression): Vital still protects a MATCHED person's real Geni value from a merely-defaulted
// scraped guess - the data-scraped distinction must still apply when NOT a new add. ---
{
    const profileId = 'geniMatch6';
    global.genifamilydata = {};
    global.genifamilydata[profileId] = new GeniPerson({
        id: profileId, public: true, is_alive: true, // Geni says this person is actually LIVING
        actions: ['update', 'update-basics'], names: {},
        birth: { date: { year: '1990' } }
    });
    freshDom(memberId, profileId, 'Farmer', true, false, '', false, true, false);
    const ctx = build(global.genifamilydata);
    ctx.setGeniFamilyData(memberId, profileId);

    assertEqual($('select[name="is_alive"]').closest('tr').find('.checknext').prop('checked'), false,
        "Regression: a MATCHED person's Vital still protects Geni's real value from a merely-defaulted (not genuinely scraped) guess - un-checks once the match reveals Geni already has real living data");
}

// --- Scenario 7 (live-reported, DanCornett): refreshPrivacySelect()'s own "select all means all" override used to
// key off the checkbox's raw checked state - the same indicator/shortcut conflation setGeniFamilyData()'s resync
// had - so Privacy stayed force-enabled any time the top box was ticked purely as an indicator from an unrelated
// field, even though Privacy itself already matched Geni exactly. ---
{
    const profileId = 'geniMatch7';
    global.genifamilydata = {};
    global.genifamilydata[profileId] = new GeniPerson({
        id: profileId, public: true, is_alive: false, // already Public on Geni
        actions: ['update', 'update-basics'], names: {},
        birth: { date: { year: '1890' } }, occupation: 'Farmer', cause_of_death: ''
    });
    // occupation matches Geni exactly; cause_of_death is genuinely different (Geni's side is blank) and starts
    // individually checked,
    // ticking the top box as a pure INDICATOR - data-select-all-active stays false (no explicit click).
    freshDom(memberId, profileId, 'Farmer', false, false, 'Heart Disease', true);
    const ctx = build(global.genifamilydata);
    ctx.setGeniFamilyData(memberId, profileId);

    assertEqual($('.checkslide').prop('checked'), true, "Sanity check: the top box IS ticked (indicator, from cause_of_death)");
    assertEqual($('#' + memberId + '_public_checkbox').prop('checked'), false,
        "#304 follow-up (live-reported, DanCornett): Privacy stays correctly disabled/unchecked - already Public on Geni, matches exactly - even though the top box reads checked, because that's only an indicator, not a genuine Select All");
}
{
    const profileId = 'geniMatch7b';
    global.genifamilydata = {};
    global.genifamilydata[profileId] = new GeniPerson({
        id: profileId, public: true, is_alive: false,
        actions: ['update', 'update-basics'], names: {},
        birth: { date: { year: '1890' } }, occupation: 'Farmer', cause_of_death: 'Heart Disease'
    });
    // Same scenario, but this time Select All really was explicitly clicked (selectAllActive=true).
    freshDom(memberId, profileId, 'Farmer', false, true, 'Heart Disease', true);
    const ctx = build(global.genifamilydata);
    ctx.setGeniFamilyData(memberId, profileId);

    assertEqual($('#' + memberId + '_public_checkbox').prop('checked'), true,
        "Regression: with a GENUINE explicit Select All active, Privacy still stays enabled/checked even though it would otherwise be a no-op - 'Select All means all' still works as designed");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
