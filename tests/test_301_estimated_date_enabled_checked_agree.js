// Verifies #301 (live-reported, DanCornett, with screenshots + confirmed
// via Geni's own Revisions tab): an estimated date (burial "After <death
// date>", #259/#208) whose checkbox correctly renders unchecked (Geni
// already has a real value) was STILL reaching Geni, because the
// checkbox and the field's own disabled state were computed by two
// different functions that disagreed - isCheckedDateField() had an
// estimated-aware override, plain isEnabled() did not. parseForm()
// (popup.js) decides what to submit purely from whether the FIELD is
// disabled, never from whether its checkbox is checked - so an enabled-
// but-visually-unchecked field was silently included every time.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const bfSrc = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');
const popupSrc = fs.readFileSync('' + ROOT + '/popup.js', 'utf8');

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

function exists(v) { return v !== undefined && v !== null && v !== ""; }
function isValue(v) { return v !== ""; }
function resolveFieldEnabled(value, score, force, currentValue, locked) {
    if (locked) { return false; }
    else if (force && score) { return true; }
    else if (score && isValue(value)) { return true; }
    else if (score && !isValue(value) && exists(currentValue) && !isValue(currentValue)) { return true; }
    else { return false; }
}
function isChecked(value, score, force, currentValue, locked) {
    return resolveFieldEnabled(value, score, force, currentValue, locked) ? "checked" : "";
}
function isEnabled(value, score, force, currentValue, locked) {
    return resolveFieldEnabled(value, score, force, currentValue, locked) ? "" : "disabled";
}

const isCheckedDateField = new Function('exists', 'isValue', 'isChecked', 'return ' + extractFunction(bfSrc, 'isCheckedDateField'))(exists, isValue, isChecked);
const isEnabledDateField = new Function('exists', 'isValue', 'isEnabled', 'return ' + extractFunction(bfSrc, 'isEnabledDateField'))(exists, isValue, isEnabled);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// --- Dan's exact scenario: estimated burial date, Geni already has a real one ---
const dateval = "After May 18 2010";
const geniValue = "May 26, 2010";
const scored = true;
const estimated = true;

assertEqual(isCheckedDateField(dateval, scored, geniValue, undefined, estimated), "",
    "Checkbox correctly renders unchecked (unchanged, pre-existing behavior)");
assertEqual(isEnabledDateField(dateval, scored, geniValue, undefined, estimated), "disabled",
    "#301: the field itself now ALSO renders disabled - previously this returned \"\" (enabled), disagreeing with the unchecked checkbox");

// --- The two must never disagree, for any input combination ---
function bothAgree(dateval, score, currentValue, locked, estimated) {
    var checkedResult = isCheckedDateField(dateval, score, currentValue, locked, estimated) === "checked";
    var enabledResult = isEnabledDateField(dateval, score, currentValue, locked, estimated) === "";
    return checkedResult === enabledResult;
}
assertTrue(bothAgree("After May 18 2010", true, "May 26, 2010", undefined, true), "Agree: estimated + real Geni value (Dan's case)");
assertTrue(bothAgree("Circa 1937", true, "", undefined, true), "Agree: estimated + blank Geni value (should both be checked/enabled)");
assertTrue(bothAgree("November 6, 1936", true, "June 5, 1942", undefined, false), "Agree: a genuinely scraped (non-estimated) date always checks/enables regardless of Geni's side");
assertTrue(bothAgree("", true, "", undefined, true), "Agree: blank estimated value (degenerate case)");
assertTrue(bothAgree("Circa 1900", false, "May 26, 2010", undefined, true), "Agree: unscored field stays unchecked/disabled regardless of estimated flag");

// --- Both focus and family-member call sites now use the matched pair ---
assertTrue(bfSrc.indexOf('enabledAttr: isEnabledDateField(dateval, scored, genifocusdata.get(title, "date.formatted_date"), datelocked, exists(obj[item].estimated) && obj[item].estimated === true),') !== -1,
    "Focus profile's date row now uses isEnabledDateField(), matching its checkedAttr's own estimated-awareness");
assertTrue(bfSrc.indexOf('enabledAttr: isEnabledDateField(dateval, fieldScored, geniFieldValue, undefined, exists(memberobj[item].estimated) && memberobj[item].estimated === true),') !== -1,
    "Family-member date row now uses isEnabledDateField(), matching its checkedAttr's own estimated-awareness");

// --- parseForm() genuinely decides submission from disabled, confirming why this mismatch was reachable at all ---
assertTrue(popupSrc.indexOf('if (exists(fsinput[item].value) && !fsinput[item].disabled && getProfileName(fsinput[item].name) !== "") {') !== -1,
    "parseForm() submission gate is driven purely by the field's own disabled state, never by its checkbox - confirms why the enabled/checked mismatch let an unchecked estimate reach Geni");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
