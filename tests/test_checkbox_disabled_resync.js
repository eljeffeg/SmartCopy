// Verifies a fix found during a full pre-selection audit: every
// family-member field's INITIAL checked state is computed with
// currentValue hardcoded blank (no match resolved yet to read a real
// Geni value from). Once setGeniFamilyData() learns the real value and
// calls refreshFieldCheckState() -> applyProtectedDisabledState(), a
// field that render-time guessed wrong (checked, because it looked like
// "scraped blank + Geni blank") needs correcting once Geni's real,
// non-blank value is known.
//
// This was NOT data-destructive - parseForm() gates submission on the
// field's own `disabled` attribute, not the checkbox's checked state,
// and applyProtectedDisabledState() already correctly disabled the
// field. But the checkbox itself was never un-checked to match, so a
// user could see a field showing checked, believe it would submit, and
// be wrong - the same "checkbox and reality disagree" failure mode
// CLAUDE.md's family-member checkbox rule exists to prevent, just from
// the checked side instead of the disabled side. Fixed by extending the
// existing "locked -> uncheck" precedent to the "would be disabled
// anyway" case too - confirmed safe against "Select All" independently
// (isFieldEmptyForCheckAll() in popup.js already reads the real
// .genislideinput value directly, not the disabled attribute, so it
// won't re-check a field this correction just protected).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

function exists(v) { return typeof v !== 'undefined' && v !== null; }
function isValue(v) { return v !== ''; }

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
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

// Real isChecked/isEnabled/resolveFieldEnabled, extracted verbatim.
const resolveFieldEnabled = new Function('isValue', 'exists', 'return ' + extractFunction(src, 'resolveFieldEnabled'))(isValue, exists);
const isEnabled = new Function('resolveFieldEnabled', 'return ' + extractFunction(src, 'isEnabled'))(resolveFieldEnabled);
// #304: applyProtectedDisabledState() now computes sameAsGeni via
// valuesAreEquivalentForFieldType(), which itself needs the real
// valuesAreEquivalent()/nicknamesAreEquivalent()/datesAreEquivalent() -
// all extracted verbatim, same pattern as tests/test_304_pre_selection_comparison.js.
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');
function extractArrayStatement(srcText, name) {
    const marker = 'var ' + name + ' =';
    const start = srcText.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    const semi = srcText.indexOf(';', start);
    return srcText.slice(start, semi + 1);
}
const DATE_QUALIFIER_PATTERN = /^(circa|about|after|before)\s+(the\s+)?/i;
const moment = require(path.join(ROOT, 'moment.js'));
const datesAreEquivalentSrc = extractArrayStatement(popupSrc, 'DATE_PARSE_FORMATS') + '\n' + extractFunction(popupSrc, 'datesAreEquivalent');
const datesAreEquivalent = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN', datesAreEquivalentSrc + '\nreturn datesAreEquivalent;')(exists, moment, DATE_QUALIFIER_PATTERN);
const valuesAreEquivalent = new Function('return ' + extractFunction(src, 'valuesAreEquivalent'))();
const nicknamesAreEquivalent = new Function('return ' + extractFunction(src, 'nicknamesAreEquivalent'))();
// #304 follow-up: About's fieldType now reuses isAboutContentPresent()
// (popup.js) - the same containment check the submit-time merge already
// uses to dedupe - so it also needs extracting here.
const normalizeAboutForComparisonSrc = extractFunction(popupSrc, 'normalizeAboutForComparison');
const isAboutContentPresent = new Function('exists', normalizeAboutForComparisonSrc + '\n' + extractFunction(popupSrc, 'isAboutContentPresent') + '\nreturn isAboutContentPresent;')(exists);
const valuesAreEquivalentForFieldType = new Function('datesAreEquivalent', 'nicknamesAreEquivalent', 'valuesAreEquivalent', 'isAboutContentPresent',
    'return ' + extractFunction(src, 'valuesAreEquivalentForFieldType'))(datesAreEquivalent, nicknamesAreEquivalent, valuesAreEquivalent, isAboutContentPresent);
const applyProtectedDisabledStateSrc = extractFunction(src, 'applyProtectedDisabledState');

// Minimal jQuery-shaped stand-in for a single <input> + its row's
// .checknext checkbox, real enough to exercise the actual function's
// .prop() calls and closest('tr') traversal.
function makeRow(initialChecked) {
    var state = { inputDisabled: false, checkboxChecked: initialChecked, checkboxDisabled: false };
    var checknext = {
        prop: function (name, value) {
            if (value === undefined) { return name === 'checked' ? state.checkboxChecked : state.checkboxDisabled; }
            if (name === 'checked') { state.checkboxChecked = value; } else if (name === 'disabled') { state.checkboxDisabled = value; }
            return checknext;
        }
    };
    var input = {
        closest: function () { return { find: function () { return checknext; } }; },
        prop: function (name, value) {
            if (value === undefined) { return name === 'disabled' ? state.inputDisabled : undefined; }
            if (name === 'disabled') { state.inputDisabled = value; }
            return input;
        }
    };
    return { input: input, state: state };
}

function callApplyProtectedDisabledState(input, scrapedValue, currentValue, locked, fieldType) {
    return new Function('isEnabled', 'isValue', 'valuesAreEquivalentForFieldType', 'return ' + applyProtectedDisabledStateSrc)(isEnabled, isValue, valuesAreEquivalentForFieldType)(input, scrapedValue, currentValue, locked, fieldType);
}

// --- The historical bug scenario: render-time guessed "checked" (blank scraped, blank hardcoded currentValue), but Geni's REAL value turns out to be real/non-blank ---
{
    const row = makeRow(true); // checked at render time, per the old blank/blank guess
    callApplyProtectedDisabledState(row.input, '', 'Jr.', false); // real Geni suffix is "Jr." - genuinely not blank
    assertEqual(row.state.inputDisabled, true, "The field itself is correctly disabled once Geni's real value is known (unchanged - this part already worked)");
    assertEqual(row.state.checkboxChecked, false, "FIX: the checkbox is now also un-checked to match - no longer shows checked for a field that won't actually submit");
}

// --- Regression: the pre-existing 'locked' behavior is unchanged ---
{
    const row = makeRow(true);
    callApplyProtectedDisabledState(row.input, 'Some Value', '', true); // locked, regardless of value comparison
    assertEqual(row.state.inputDisabled, true, "A locked field is still disabled");
    assertEqual(row.state.checkboxChecked, false, "A locked field's checkbox is still un-checked (unchanged baseline)");
    assertEqual(row.state.checkboxDisabled, true, "A locked field's checkbox itself is still disabled too (unchanged baseline)");
}

// --- Regression: a field that's correctly checked (real scraped value) stays checked and enabled ---
{
    const row = makeRow(true);
    callApplyProtectedDisabledState(row.input, 'Real Scraped Value', 'Geni Value', false);
    assertEqual(row.state.inputDisabled, false, "A field with a real scraped value stays enabled - scraped-has-data always wins regardless of Geni's side");
    assertEqual(row.state.checkboxChecked, true, "Its checkbox correctly stays checked, matching the field being enabled");
}

// --- #304 follow-up (live-reported, DanCornett): blank scraped + blank Geni now stays disabled/unchecked too -
// the old "nothing to protect, save a click" branch was removed entirely per Dan's explicit confirmation that a
// blank source field should never be pre-selected under any circumstance. ---
{
    const row = makeRow(true); // was checked at render time under the OLD blank+blank rule
    callApplyProtectedDisabledState(row.input, '', '', false);
    assertEqual(row.state.inputDisabled, true, "#304 follow-up: blank scraped + blank Geni value now correctly stays disabled - nothing pre-selects on a blank source, period");
    assertEqual(row.state.checkboxChecked, false, "Its checkbox correctly un-checks to match");
}

// --- Regression: a manually-unchecked box never gets silently re-enabled ---
{
    const row = makeRow(false); // user already manually unchecked this
    callApplyProtectedDisabledState(row.input, 'Real Scraped Value', 'Geni Value', false);
    assertEqual(row.state.inputDisabled, true, "A manually-unchecked box's field stays disabled - never silently re-enabled just because the value comparison would otherwise allow it");
    assertEqual(row.state.checkboxChecked, false, "The checkbox itself is never auto-CHECKED by this function - only ever un-checked, matching the documented rule");
}

// --- #304: generic fieldType - case/whitespace-only difference now un-checks too ---
{
    const row = makeRow(true);
    callApplyProtectedDisabledState(row.input, 'FARMER', 'farmer', false, 'generic');
    assertEqual(row.state.inputDisabled, true, "#304: a field identical to Geni's value except for case now correctly un-checks - no more wall-of-green on fields that already match");
    assertEqual(row.state.checkboxChecked, false, "Its checkbox un-checks to match");
}
{
    const row = makeRow(true);
    callApplyProtectedDisabledState(row.input, 'Genuinely Different', 'Farmer', false, 'generic');
    assertEqual(row.state.inputDisabled, false, "Regression: a genuinely different generic-fieldType value still stays checked/enabled");
    assertEqual(row.state.checkboxChecked, true, "");
}

// --- #304: date fieldType - Circa-stripped equivalence un-checks, Before/After stays strict ---
{
    const row = makeRow(true);
    callApplyProtectedDisabledState(row.input, 'Circa 1890', '1890', false, 'date');
    assertEqual(row.state.checkboxChecked, false, "#304: 'Circa 1890' un-checks against Geni's plain '1890' - the exact scenario from #304's design brief");
}
{
    const row = makeRow(true);
    callApplyProtectedDisabledState(row.input, 'Before 1890', '1890', false, 'date');
    assertEqual(row.state.checkboxChecked, true, "Before/After/Between are never stripped - 'Before 1890' still counts as genuinely different from '1890', per Dan's explicit requirement");
}

// --- #304: nicknames fieldType - scraped subset already on Geni un-checks ---
{
    const row = makeRow(true);
    callApplyProtectedDisabledState(row.input, 'Johnny', ['Johnny', 'Jack'], false, 'nicknames');
    assertEqual(row.state.checkboxChecked, false, "#304: a scraped nickname already present in Geni's (array) list un-checks - no duplicate re-add");
}
{
    const row = makeRow(true);
    callApplyProtectedDisabledState(row.input, 'Johnny,Rusty', 'Johnny,Jack', false, 'nicknames');
    assertEqual(row.state.checkboxChecked, true, "A genuinely new nickname among the scraped set still stays checked");
}

// --- #304: photo fieldType is explicitly NEVER affected by the new comparator (additive, never protected) ---
{
    const row = makeRow(true);
    callApplyProtectedDisabledState(row.input, 'images/new.jpg', 'images/new.jpg', false, 'photo');
    assertEqual(row.state.checkboxChecked, true, "Regression: photo stays checked regardless of Geni's side - additive, never protected");
}

// --- #304 follow-up (live-reported, DanCornett): About now un-checks once the exact scraped text is already
// present somewhere in Geni's existing About (avoids re-appending a duplicate), but a genuinely NEW addition -
// even alongside existing content it's additive with - still correctly pre-selects. Reuses isAboutContentPresent()
// (popup.js), the same containment check the submit-time merge already uses to dedupe. ---
{
    const row = makeRow(true);
    callApplyProtectedDisabledState(row.input, "* '''Residence''': Chicago, Illinois - 1920", "* '''Residence''': Chicago, Illinois - 1920\n* '''Residence''': Detroit, Michigan - 1930", false, 'about_me');
    assertEqual(row.state.checkboxChecked, false, "#304 follow-up: About un-checks when the exact scraped text is already present in Geni's existing About - avoids a duplicate re-add");
}
{
    const row = makeRow(true);
    callApplyProtectedDisabledState(row.input, "* '''Residence''': Detroit, Michigan - 1930", "* '''Residence''': Chicago, Illinois - 1920", false, 'about_me');
    assertEqual(row.state.checkboxChecked, true, "A genuinely NEW About addition not already present in Geni's existing text still pre-selects");
}
{
    const row = makeRow(true);
    callApplyProtectedDisabledState(row.input, "* '''Residence''': Chicago, Illinois - 1920", "", false, 'about_me');
    assertEqual(row.state.checkboxChecked, true, "Geni's About is empty - real scraped content still pre-selects, nothing to dedupe against");
}

// --- #304 follow-up (live-reported, DanCornett): family Gender/Living use "generic" just like any other field -
// initially excluded here on the mistaken assumption they already had their own comparison-aware path (true only
// for the FOCUS profile, not family members), which meant family Gender/Living never un-checked even when
// identical to Geni. refreshFieldCheckState()/refreshLivingCheckState() pass fieldType="generic" for these now,
// same as this scenario. ---
{
    const row = makeRow(true);
    callApplyProtectedDisabledState(row.input, 'male', 'male', false, 'generic');
    assertEqual(row.state.checkboxChecked, false, "#304 follow-up: family Gender identical to Geni's now correctly un-checks (was stuck always-checked before this fix)");
}
{
    const row = makeRow(true);
    callApplyProtectedDisabledState(row.input, 'male', 'female', false, 'generic');
    assertEqual(row.state.checkboxChecked, true, "Regression: a genuinely different Gender still stays checked");
}
{
    const row = makeRow(true);
    callApplyProtectedDisabledState(row.input, 'true', 'true', false, 'generic');
    assertEqual(row.state.checkboxChecked, false, "#304 follow-up: family Living identical to Geni's now correctly un-checks, same fix as Gender");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
