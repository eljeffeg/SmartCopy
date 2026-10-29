// Verifies the common root cause behind three separate live-reported
// issues (DanCornett, 2026-10-25), all found while retesting #328:
// switching a family member's Action dropdown from "Add profile" to a
// matched existing Geni profile never re-ran the same checks a fresh page
// load does. Dan's own words: "Switching a family member from 'Add
// profile' to a matching profile should run the same checks/scans as if
// it were the startup pass of preselection checks."
//
// setGeniFamilyData() (buildform.js) is the one resync that runs on an
// Action-dropdown change - it was missing three pieces the original
// render pass has:
//
// - #325: after the blanket "no edit permission" sweep forces this
//   person's own fields/checkslide off, syncTopLevelIndicators() - the
//   function that also recomputes the CATEGORY header above them - was
//   skipped specifically in that case ("already forced everything off
//   above"), leaving the category checkbox stuck checked from before the
//   switch even though nothing underneath it is checked anymore.
// - #328: the "Hide Empty Fields" row-visibility decision (hiddenRowAttrs()
//   at render time) never gets revisited - AKA/Middle Name/other
//   secondary fields stay hidden forever once rendered that way for an
//   unmatched "Add profile" candidate, even after switching to a real
//   match with a genuine Geni value.
// - #338: the location-specificity-downgrade check (don't pre-select a
//   scraped location less detailed than Geni's existing one) was only
//   ever re-applied by the pencil "Edit Location" flow, never by a plain
//   Action-dropdown match change.
//
// Uses the REAL setGeniFamilyData() and its real dependency chain
// (GeniPerson, getGeniData, applyProtectedDisabledState, etc.) extracted
// verbatim - same harness shape as tests/test_298_locked_actionselect_stays_enabled.js.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');

const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');
const sharedSrc = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
const plSrc = fs.readFileSync(path.join(ROOT, 'parse-location.js'), 'utf8');

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
function isValue(v) { return v !== ''; }
function checkNested(obj, ...keys) {
    for (const k of keys) {
        if (!obj || !obj.hasOwnProperty(k)) { return false; }
        obj = obj[k];
    }
    return true;
}
function geniPhoto() { return 'images/no_photo_u.gif'; }

const GeniPerson = new Function('exists', 'checkNested', 'geniPhoto', 'return ' + extractFunction(sharedSrc, 'GeniPerson'))(exists, checkNested, geniPhoto);

global.genifamilydata = {};
const getGeniDataSrc = extractFunction(sharedSrc, 'getGeniData');
function makeGetGeniData(genifamilydata) {
    return new Function('exists', 'geniPhoto', 'genifamilydata', 'return ' + getGeniDataSrc)(exists, geniPhoto, genifamilydata);
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
const hasVisibleCheckedFieldSrc = extractFunction(bfSrc, 'hasVisibleCheckedField');
const syncGeotopcheckStateSrc = extractFunction(bfSrc, 'syncGeotopcheckState');
const syncTopLevelIndicatorsSrc = extractFunction(bfSrc, 'syncTopLevelIndicators');
const getLocationSpecificitySrc = extractFunction(bfSrc, 'getLocationSpecificity');
const isLocationSpecificityDowngradeSrc = extractFunction(bfSrc, 'isLocationSpecificityDowngrade');
const localizedGenderSrc = extractFunction(bfSrc, 'localizedGender');
const isAliveSrc = extractFunction(bfSrc, 'isAlive');
const isPublicSrc = extractFunction(bfSrc, 'isPublic');

const DATE_QUALIFIER_PATTERN = /^(circa|about|after|before)\s+(the\s+)?/i;
const DATE_BETWEEN_PATTERN = /^between\s+(.+?)\s+and\s+(.+)$/i;
const moment = require(path.join(ROOT, 'moment.js'));
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');
function extractArrayStatement(src, name) {
    const marker = 'var ' + name + ' =';
    const start = src.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    const semi = src.indexOf(';', start);
    return src.slice(start, semi + 1);
}
const datesAreEquivalentSrc = extractArrayStatement(popupSrc, 'DATE_PARSE_FORMATS') + '\n' + extractFunction(popupSrc, 'datesAreEquivalent');
const datesAreEquivalent = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN', 'DATE_BETWEEN_PATTERN', datesAreEquivalentSrc + '\nreturn datesAreEquivalent;')(exists, moment, DATE_QUALIFIER_PATTERN, DATE_BETWEEN_PATTERN);
const valuesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'valuesAreEquivalent'))();
const nicknamesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'nicknamesAreEquivalent'))();
const normalizeAboutForComparisonSrc = extractFunction(popupSrc, 'normalizeAboutForComparison');
const isAboutContentPresent = new Function('exists', normalizeAboutForComparisonSrc + '\n' + extractFunction(popupSrc, 'isAboutContentPresent') + '\nreturn isAboutContentPresent;')(exists);
const dateSpecificitySrc = extractArrayStatement(popupSrc, 'DATE_SPECIFICITY_FORMATS') + '\n' +
    extractFunction(popupSrc, 'getDateSpecificity') + '\n' + extractFunction(popupSrc, 'isDateSpecificityDowngrade');
const isDateSpecificityDowngrade = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN',
    dateSpecificitySrc + '\nreturn isDateSpecificityDowngrade;')(exists, moment, DATE_QUALIFIER_PATTERN);
const valuesAreEquivalentForFieldType = new Function('datesAreEquivalent', 'nicknamesAreEquivalent', 'valuesAreEquivalent', 'isAboutContentPresent', 'isDateSpecificityDowngrade',
    'return ' + extractFunction(bfSrc, 'valuesAreEquivalentForFieldType'))(datesAreEquivalent, nicknamesAreEquivalent, valuesAreEquivalent, isAboutContentPresent, isDateSpecificityDowngrade);
const isFieldSelectable = new Function('isValue', 'valuesAreEquivalentForFieldType',
    'return ' + extractFunction(bfSrc, 'isFieldSelectable'))(isValue, valuesAreEquivalentForFieldType);
// #365: setGeniFamilyData() now unconditionally calls
// isGeniLocationEntirelyBlank() per title (not just when a Place field
// actually exists in the DOM), so its real dependency chain - including
// isPlaceEligibleForPreselection()/isPlaceNameSegment() and parse-
// location.js's own pattern vars - needs to be in scope even though this
// test's own fixture never renders a Place field.
const isPlaceNameSegmentSrc = extractFunction(plSrc, 'isPlaceNameSegment');
const placeNameKeywordPatternSrc = extractArrayStatement(plSrc, 'PLACE_NAME_KEYWORD_PATTERN');
const placeNameNumericPatternSrc = extractArrayStatement(plSrc, 'PLACE_NAME_NUMERIC_PATTERN');
const isPlaceEligibleForPreselectionSrc = extractFunction(bfSrc, 'isPlaceEligibleForPreselection');
const isGeniLocationEntirelyBlankSrc = extractFunction(bfSrc, 'isGeniLocationEntirelyBlank');

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
        ${hasVisibleCheckedFieldSrc}
        ${syncGeotopcheckStateSrc}
        ${syncTopLevelIndicatorsSrc}
        ${getLocationSpecificitySrc}
        ${isLocationSpecificityDowngradeSrc}
        ${placeNameKeywordPatternSrc}
        ${placeNameNumericPatternSrc}
        ${isPlaceNameSegmentSrc}
        ${isPlaceEligibleForPreselectionSrc}
        ${isGeniLocationEntirelyBlankSrc}
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

// ============================================================
// #325: category header must clear when the last selected "Add profile"
// child switches to a matched-but-locked profile.
// ============================================================
{
    function freshCategoryDom() {
        $('body').html(`
            <div id="children">
                <input type="checkbox" class="checkall" id="childrencheckall" checked>
                <fieldset class="fieldeffect">
                    <div class="membertitle"><input type="checkbox" class="checkslide" id="aSlide" disabled></div>
                    <div class="memberexpand">
                        <table id="familytable_A">
                            <tr><td><select class="actionselect"><option value="geniLockedA" selected>Update</option></select></td></tr>
                            <tr><td><input type="checkbox" class="checknext" name="first_name" disabled></td></tr>
                        </table>
                    </div>
                    <div class="membertitle"><input type="checkbox" class="checkslide" id="bSlide" checked></div>
                    <div class="memberexpand">
                        <table id="familytable_B">
                            <tr><td><select class="actionselect"><option value="add" selected>Add Profile</option></select></td></tr>
                            <tr><td><input type="checkbox" class="checknext" name="first_name" checked></td></tr>
                            <tr><td><select name="is_alive" class="livingselect" update="B"><option value="false" selected>Deceased</option></select></td></tr>
                        </table>
                        <select class="privacyselect" update="B" data-birthyear="1890">
                            <option value="" selected>Auto</option><option value=true>Public</option><option value=false>Private</option>
                        </select>
                        <input id="B_public_checkbox" type="checkbox">
                        <span id="B_action_lock"></span>
                    </div>
                </fieldset>
            </div>
        `);
    }
    freshCategoryDom();
    global.genifamilydata = {};
    global.genifamilydata['geniLockedA'] = new GeniPerson({ id: 'geniLockedA', actions: ['add-photo'], names: {} });
    const lockedMatchId = 'geniLockedB';
    global.genifamilydata[lockedMatchId] = new GeniPerson({
        id: lockedMatchId, public: true, is_alive: false,
        actions: ['add-photo'], // no "update"/"update-basics" - inaccessible, matches Dan's exact scenario
        names: {}
    });
    const ctx = build(global.genifamilydata);

    assertEqual($('#childrencheckall').prop('checked'), true,
        "Sanity: category header starts checked - person B's own field is checked, matching Dan's first screenshot");

    ctx.setGeniFamilyData('B', lockedMatchId);

    assertEqual($('#bSlide').prop('checked'), false,
        "Sanity: person B's own checkslide correctly clears once their match turns out to be inaccessible - this part already worked");
    assertEqual($('#childrencheckall').prop('checked'), false,
        "#325: the category header now also clears - previously stuck checked because syncTopLevelIndicators() was skipped whenever this person ended up with no edit permission");
}

// ============================================================
// #328: a secondary field (Middle Name) hidden at render time (nothing
// scraped for an unmatched "Add profile" candidate) becomes visible once
// switched to a match that has a real Geni value for it.
// ============================================================
{
    function freshMemberDom() {
        $('body').html(`
            <input type="checkbox" id="hideemptyonoffswitch" checked>
            <select id="M_geni_name_language"><option value="en-US" selected>en-US</option></select>
            <table id="familytable_M">
                <tr><td><select class="actionselect"><option value="add" selected>Add Profile</option></select></td></tr>
                <tr class="hiddenrow" data-hasvalue="false" style="display:none">
                    <td><input type="checkbox" class="checknext"></td>
                    <td><input type="text" name="middle_name"></td>
                    <td><img class="genislideimage"><input id="M_geni_middle_name" type="text" class="formtext genislideinput" value="" disabled></td>
                </tr>
                <tr><td><select name="is_alive" class="livingselect" update="M"><option value="false" selected>Deceased</option></select></td></tr>
            </table>
            <select class="privacyselect" update="M" data-birthyear="1890">
                <option value="" selected>Auto</option><option value=true>Public</option><option value=false>Private</option>
            </select>
            <input id="M_public_checkbox" type="checkbox">
            <span id="M_action_lock"></span>
        `);
    }
    freshMemberDom();
    global.genifamilydata = {};
    const matchId = 'geniMatchM';
    global.genifamilydata[matchId] = new GeniPerson({
        id: matchId, public: true, is_alive: false,
        actions: ['update', 'update-basics'],
        names: { 'en-US': { middle_name: 'Alexander' } }
    });
    const ctx = build(global.genifamilydata);

    assertEqual($('[name="middle_name"]').closest('tr').css('display'), 'none',
        "Sanity: Middle Name row starts collapsed under Hide Empty Fields - nothing scraped, no match yet to show a Geni value from");

    ctx.setGeniFamilyData('M', matchId);

    assertEqual($('[name="middle_name"]').closest('tr').attr('data-hasvalue'), 'true',
        "#328: data-hasvalue is recomputed once the match reveals a real Geni Middle Name");
    assertEqual($('[name="middle_name"]').closest('tr').css('display'), 'table-row',
        "#328: switching to a match with a real Geni Middle Name now reveals the row under Hide Empty Fields - previously stayed hidden forever once rendered that way for an unmatched Add candidate");
}

// ============================================================
// #338: a scraped location less detailed than the newly-matched profile's
// own Geni location must suppress pre-selection, the same as the pencil
// "Edit Location" flow already does - just triggered by an Action switch
// instead.
// ============================================================
{
    function freshLocationMemberDom() {
        $('body').html(`
            <table id="familytable_P">
                <tr><td><select class="actionselect"><option value="add" selected>Add Profile</option></select></td></tr>
                <tr><td><input type="checkbox" class="checknext"></td><td><input type="text" name="birth:location:city" value=""></td></tr>
                <tr><td><input type="checkbox" class="checknext"></td><td><input type="text" name="birth:location:state" value="Some Other State"></td></tr>
                <tr><td><select name="is_alive" class="livingselect" update="P"><option value="false" selected>Deceased</option></select></td></tr>
            </table>
            <select class="privacyselect" update="P" data-birthyear="1890">
                <option value="" selected>Auto</option><option value=true>Public</option><option value=false>Private</option>
            </select>
            <input id="P_public_checkbox" type="checkbox">
            <span id="P_action_lock"></span>
        `);
    }
    freshLocationMemberDom();
    global.genifamilydata = {};
    const matchId = 'geniMatchP';
    global.genifamilydata[matchId] = new GeniPerson({
        id: matchId, public: true, is_alive: false,
        actions: ['update', 'update-basics'],
        names: {},
        // Geni's own birth location is fully detailed (city-level) - more
        // specific than the scraped state-only value above.
        birth: { location: { city: 'Scranton', county: 'Lackawanna', state: 'Pennsylvania', country: 'USA' } }
    });
    const ctx = build(global.genifamilydata);
    ctx.setGeniFamilyData('P', matchId);

    assertEqual($('[name="birth:location:state"]').closest('tr').find('.checknext').prop('checked'), false,
        "#338: a scraped State-only location, genuinely less detailed than Geni's own city-level location revealed by this match, no longer pre-selects - previously only the pencil 'Edit Location' flow caught this, never a plain Action-dropdown switch");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
