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

function callApplyProtectedDisabledState(input, scrapedValue, currentValue, locked) {
    return new Function('isEnabled', 'return ' + applyProtectedDisabledStateSrc)(isEnabled)(input, scrapedValue, currentValue, locked);
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

// --- Regression: blank scraped + blank Geni - correctly stays checked/enabled (nothing to protect) ---
{
    const row = makeRow(true);
    callApplyProtectedDisabledState(row.input, '', '', false);
    assertEqual(row.state.inputDisabled, false, "Blank scraped + blank Geni value - correctly stays enabled, nothing to protect");
    assertEqual(row.state.checkboxChecked, true, "Its checkbox correctly stays checked");
}

// --- Regression: a manually-unchecked box never gets silently re-enabled ---
{
    const row = makeRow(false); // user already manually unchecked this
    callApplyProtectedDisabledState(row.input, 'Real Scraped Value', 'Geni Value', false);
    assertEqual(row.state.inputDisabled, true, "A manually-unchecked box's field stays disabled - never silently re-enabled just because the value comparison would otherwise allow it");
    assertEqual(row.state.checkboxChecked, false, "The checkbox itself is never auto-CHECKED by this function - only ever un-checked, matching the documented rule");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
