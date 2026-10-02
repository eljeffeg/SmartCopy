// Verifies #301 (live-reported, DanCornett, with screenshots + confirmed
// via Geni's own Revisions tab): an estimated date (burial "After <death
// date>", #259/#208) whose checkbox correctly renders unchecked (Geni
// already has a real value) was STILL reaching Geni, because the
// checkbox and the field's own disabled state were computed by two
// different functions that disagreed - isCheckedDateField() had an
// estimated-aware override, plain isEnabled() did not. parseForm()
// (popup.js), at the time, decided what to submit purely from whether
// the FIELD is disabled, never from whether its checkbox is checked - so
// an enabled-but-visually-unchecked field was silently included every
// time.
//
// (Dan's #304 follow-up proposal, applied later): isEnabled() now only
// ever answers "is this locked" - editability no longer tracks the
// checked/no-op computation anywhere, including for ordinary (non-
// estimated) date fields, which now stay editable even while unchecked
// (the whole point of the broader change). isEnabledDateField() keeps
// its OWN estimated-aware early return UNCHANGED though (hardcoded
// "disabled" when estimated && Geni already has a real value) -
// deliberately kept as the one narrow exception to "always editable
// unless locked," given this exact mechanism has a real, previously-
// shipped production bug behind it. parseForm() (popup.js) also now
// independently gates on the field's own checkbox being checked, not
// just disabled - so this exact danger is now caught two independent
// ways, not one. The assertions below only require full checked/enabled
// agreement for the genuinely DANGEROUS case (estimated + Geni already
// has real data) - a blank estimated value with nothing to protect is
// now allowed to be unchecked-but-editable, same as any other blank
// field, which is intentional, not a regression.
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

function extractArrayStatement(src, name) {
    const marker = 'var ' + name + ' =';
    const start = src.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    const semi = src.indexOf(';', start);
    return src.slice(start, semi + 1);
}

function exists(v) { return v !== undefined && v !== null && v !== ""; }
function isValue(v) { return v !== ""; }
// #304: datesAreEquivalent(), extracted from popup.js verbatim -
// isCheckedDateField()/isEnabledDateField() now call it internally, so it
// must be present in this harness (same extraction shape as
// tests/test_212_240_dates_are_equivalent.js).
const DATE_QUALIFIER_PATTERN = /^(circa|about|after|before)\s+(the\s+)?/i;
const moment = require(path.join(ROOT, 'moment.js'));
const datesAreEquivalentSrc = extractArrayStatement(popupSrc, 'DATE_PARSE_FORMATS') + '\n' + extractFunction(popupSrc, 'datesAreEquivalent');
const datesAreEquivalent = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN', datesAreEquivalentSrc + '\nreturn datesAreEquivalent;')(exists, moment, DATE_QUALIFIER_PATTERN);
// #304 follow-up: isCheckedDateField()/isEnabledDateField() now also call
// isDateSpecificityDowngrade(), which itself needs getDateSpecificity()/
// DATE_SPECIFICITY_FORMATS - all extracted verbatim from popup.js.
const isDateSpecificityDowngradeSrc = extractArrayStatement(popupSrc, 'DATE_SPECIFICITY_FORMATS') + '\n' +
    extractFunction(popupSrc, 'getDateSpecificity') + '\n' + extractFunction(popupSrc, 'isDateSpecificityDowngrade');
const isDateSpecificityDowngrade = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN',
    isDateSpecificityDowngradeSrc + '\nreturn isDateSpecificityDowngrade;')(exists, moment, DATE_QUALIFIER_PATTERN);

const resolveFieldEnabled = new Function('isValue', 'exists', 'return ' + extractFunction(bfSrc, 'resolveFieldEnabled'))(isValue, exists);
const isChecked = new Function('resolveFieldEnabled', 'return ' + extractFunction(bfSrc, 'isChecked'))(resolveFieldEnabled);
const isEnabled = new Function('resolveFieldEnabled', 'return ' + extractFunction(bfSrc, 'isEnabled'))(resolveFieldEnabled);

// #304 follow-up (consolidation pass): isCheckedDateField()/isEnabledDateField()
// now call the shared isFieldSelectable() (which itself dispatches to
// valuesAreEquivalentForFieldType(), folding in both datesAreEquivalent()
// and isDateSpecificityDowngrade() for the "date" fieldType) instead of
// computing sameAsGeni inline - build that same chain here.
const valuesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'valuesAreEquivalent'))();
const nicknamesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'nicknamesAreEquivalent'))();
const normalizeAboutForComparisonSrc = extractFunction(popupSrc, 'normalizeAboutForComparison');
const isAboutContentPresent = new Function('exists', normalizeAboutForComparisonSrc + '\n' + extractFunction(popupSrc, 'isAboutContentPresent') + '\nreturn isAboutContentPresent;')(exists);
const valuesAreEquivalentForFieldType = new Function('datesAreEquivalent', 'nicknamesAreEquivalent', 'valuesAreEquivalent', 'isAboutContentPresent', 'isDateSpecificityDowngrade',
    'return ' + extractFunction(bfSrc, 'valuesAreEquivalentForFieldType'))(datesAreEquivalent, nicknamesAreEquivalent, valuesAreEquivalent, isAboutContentPresent, isDateSpecificityDowngrade);
const isFieldSelectable = new Function('isValue', 'valuesAreEquivalentForFieldType',
    'return ' + extractFunction(bfSrc, 'isFieldSelectable'))(isValue, valuesAreEquivalentForFieldType);

const isCheckedDateField = new Function('exists', 'isValue', 'isChecked', 'isFieldSelectable', 'return ' + extractFunction(bfSrc, 'isCheckedDateField'))(exists, isValue, isChecked, isFieldSelectable);
const isEnabledDateField = new Function('exists', 'isValue', 'isEnabled', 'isFieldSelectable', 'return ' + extractFunction(bfSrc, 'isEnabledDateField'))(exists, isValue, isEnabled, isFieldSelectable);

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

// --- The two must never disagree for the DANGEROUS case - estimated with
// Geni already holding real data, where isEnabledDateField()'s own
// hardcoded early return is the one deliberate exception to "editable
// unless locked." Everywhere else, disagreement (unchecked-but-editable)
// is now expected and safe - parseForm()'s own checkbox-based gate (see
// its own assertion below) independently keeps it from submitting. ---
function bothAgree(dateval, score, currentValue, locked, estimated) {
    var checkedResult = isCheckedDateField(dateval, score, currentValue, locked, estimated) === "checked";
    var enabledResult = isEnabledDateField(dateval, score, currentValue, locked, estimated) === "";
    return checkedResult === enabledResult;
}
assertTrue(bothAgree("After May 18 2010", true, "May 26, 2010", undefined, true), "Agree: estimated + real Geni value (Dan's case) - the one case that must still fully agree");
assertTrue(bothAgree("Circa 1937", true, "", undefined, true), "Agree: estimated + blank Geni value (nothing to protect, so both land on checked/enabled anyway)");
assertTrue(bothAgree("November 6, 1936", true, "June 5, 1942", undefined, false), "Agree: a genuinely scraped (non-estimated) date always checks/enables regardless of Geni's side");
assertTrue(bothAgree("Circa 1900", false, "May 26, 2010", undefined, true), "Agree: unscored + estimated + real Geni value still agrees - isEnabledDateField()'s hardcoded branch fires on estimated+currentValue alone, before score is even consulted");

// --- (Dan's #304 follow-up proposal): a BLANK estimated value is the one
// combination that now intentionally diverges - nothing to protect (no
// value to submit either way), so the field stays editable even though
// its checkbox correctly stays unchecked, same as any other blank field.
// Not a regression: there's nothing dangerous about this disagreement,
// since an unchecked checkbox excludes it from submission either way. ---
assertEqual(isCheckedDateField("", true, "", undefined, true), "",
    "A blank estimated value's checkbox stays unchecked - nothing to pre-select");
assertEqual(isEnabledDateField("", true, "", undefined, true), "",
    "(Dan's #304 follow-up): but the field itself stays editable (not locked) - the user can type a real date in with no extra click first");

// --- Both focus and family-member call sites now use the matched pair ---
assertTrue(bfSrc.indexOf('enabledAttr: isEnabledDateField(dateval, scored, genifocusdata.get(title, "date.formatted_date"), datelocked, exists(obj[item].estimated) && obj[item].estimated === true),') !== -1,
    "Focus profile's date row now uses isEnabledDateField(), matching its checkedAttr's own estimated-awareness");
assertTrue(bfSrc.indexOf('enabledAttr: isEnabledDateField(dateval, fieldScored, geniFieldValue, undefined, exists(memberobj[item].estimated) && memberobj[item].estimated === true),') !== -1,
    "Family-member date row now uses isEnabledDateField(), matching its checkedAttr's own estimated-awareness");

// --- (Dan's #304 follow-up proposal): parseForm() now ALSO gates on the
// field's own checkbox being checked, independent of disabled - this is
// the second, independent safety net that makes the estimated-date danger
// doubly protected rather than resting on isEnabledDateField()'s one
// hardcoded branch alone. ---
assertTrue(popupSrc.indexOf('var fieldIsSelected = checknextForSelection.length === 0 || checknextForSelection.prop(\'checked\');') !== -1,
    "parseForm() now independently gates submission on the field's own checkbox too, not disabled alone - a second, independent safety net alongside isEnabledDateField()'s hardcoded estimated-date exception");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
