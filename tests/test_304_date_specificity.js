// Verifies a #304 follow-up bug reported directly by the user (not Dan):
// pre-selection was choosing an incoming source date over an existing Geni
// date even when the incoming date was LESS specific - e.g. Geni already
// had a full date ("November 13, 1963") and the source only had a partial
// date ("November 1963" or "1963"), but the partial date still pre-selected
// as if it were an improvement, which would have overwritten the more
// precise Geni value.
//
// Fix: getDateSpecificity()/isDateSpecificityDowngrade() (popup.js) rank a
// date's granularity (day+month+year > month+year > year-only) and suppress
// pre-selection only when the SCRAPED date is strictly less specific than
// Geni's. Deliberately NOT folded into datesAreEquivalent() itself (used
// separately by parseForm()'s submit-time no-op check, where a specificity
// downgrade is still a real, submittable difference) - confirmed with the
// user directly: equal or better specificity still pre-selects, even when
// the value differs, so a genuine conflict at the same granularity still
// surfaces for review rather than being silently hidden.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');
const moment = require(path.join(ROOT, 'moment.js'));

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

function exists(v) { return typeof v !== 'undefined' && v !== null; }
function isValue(v) { return v !== ''; }
const DATE_QUALIFIER_PATTERN = /^(circa|about|after|before)\s+(the\s+)?/i;

const dateSpecificitySrc = extractArrayStatement(popupSrc, 'DATE_SPECIFICITY_FORMATS') + '\n' +
    extractFunction(popupSrc, 'getDateSpecificity') + '\n' + extractFunction(popupSrc, 'isDateSpecificityDowngrade');
const ctx1 = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN',
    dateSpecificitySrc + '\nreturn { getDateSpecificity, isDateSpecificityDowngrade };')(exists, moment, DATE_QUALIFIER_PATTERN);
const getDateSpecificity = ctx1.getDateSpecificity;
const isDateSpecificityDowngrade = ctx1.isDateSpecificityDowngrade;

const datesAreEquivalentSrc = extractArrayStatement(popupSrc, 'DATE_PARSE_FORMATS') + '\n' + extractFunction(popupSrc, 'datesAreEquivalent');
const datesAreEquivalent = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN', datesAreEquivalentSrc + '\nreturn datesAreEquivalent;')(exists, moment, DATE_QUALIFIER_PATTERN);

const resolveFieldEnabled = new Function('isValue', 'exists', 'return ' + extractFunction(bfSrc, 'resolveFieldEnabled'))(isValue, exists);
const isChecked = new Function('resolveFieldEnabled', 'return ' + extractFunction(bfSrc, 'isChecked'))(resolveFieldEnabled);
const isEnabled = new Function('resolveFieldEnabled', 'return ' + extractFunction(bfSrc, 'isEnabled'))(resolveFieldEnabled);
const isCheckedDateField = new Function('exists', 'isValue', 'isChecked', 'datesAreEquivalent', 'isDateSpecificityDowngrade',
    'return ' + extractFunction(bfSrc, 'isCheckedDateField'))(exists, isValue, isChecked, datesAreEquivalent, isDateSpecificityDowngrade);
const isEnabledDateField = new Function('exists', 'isValue', 'isEnabled', 'datesAreEquivalent', 'isDateSpecificityDowngrade',
    'return ' + extractFunction(bfSrc, 'isEnabledDateField'))(exists, isValue, isEnabled, datesAreEquivalent, isDateSpecificityDowngrade);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- Unit: getDateSpecificity() ranks day+month+year > month+year > year-only ---
assertEqual(getDateSpecificity('November 13, 1963'), 3, "Full day+month+year date ranks 3");
assertEqual(getDateSpecificity('13 November 1963'), 3, "Day-first full date form also ranks 3");
assertEqual(getDateSpecificity('November 1963'), 2, "Month+year (no day) ranks 2");
assertEqual(getDateSpecificity('Nov 1963'), 2, "Abbreviated month+year also ranks 2");
assertEqual(getDateSpecificity('1963'), 1, "Bare year ranks 1");
assertEqual(getDateSpecificity('Circa 1963'), 1, "A qualifier is stripped before ranking - still a bare year underneath");
assertEqual(getDateSpecificity(''), 0, "Blank ranks 0 (unknown)");
assertEqual(getDateSpecificity('Between 1960 and 1965'), 0, "An unparseable range ranks 0 - never guessed at");

// --- Unit: isDateSpecificityDowngrade() ---
assertEqual(isDateSpecificityDowngrade('November 1963', 'November 13, 1963'), true,
    "The exact reported bug: month+year scraped over Geni's full date - a downgrade");
assertEqual(isDateSpecificityDowngrade('1963', 'November 13, 1963'), true,
    "Bare year scraped over Geni's full date - also a downgrade");
assertEqual(isDateSpecificityDowngrade('1963', 'November 1963'), true,
    "Bare year scraped over Geni's month+year - a downgrade one tier apart");
assertEqual(isDateSpecificityDowngrade('November 13, 1963', 'November 1963'), false,
    "Incoming MORE specific than existing - not a downgrade, should still pre-select");
assertEqual(isDateSpecificityDowngrade('1965', '1963'), false,
    "Equal specificity (both bare years), genuinely different value - NOT a downgrade, confirmed with the user: equal specificity still pre-selects so the conflict surfaces for review");
assertEqual(isDateSpecificityDowngrade('November 13, 1963', 'November 13, 1963'), false,
    "Equal specificity, identical value - not a downgrade either (datesAreEquivalent() already handles the identical case separately)");
assertEqual(isDateSpecificityDowngrade('November 1963', ''), false,
    "Blank current value - never a downgrade (nothing to be worse than)");
assertEqual(isDateSpecificityDowngrade('Between 1960 and 1965', 'November 13, 1963'), false,
    "An unparseable scraped value is never treated as a downgrade - falls back to the existing datesAreEquivalent()-driven behavior instead of guessing");

// --- End-to-end: isCheckedDateField()/isEnabledDateField(), the real pre-selection call sites ---
assertEqual(isCheckedDateField('November 1963', true, 'November 13, 1963', false), '',
    "#304 follow-up (live-reported by the user): the exact reported scenario - a partial scraped date no longer pre-checks over Geni's more precise existing date");
assertEqual(isEnabledDateField('November 1963', true, 'November 13, 1963', false), 'disabled',
    "The field itself also stays disabled, matching the unchecked checkbox (same #301 agreement requirement)");
assertEqual(isCheckedDateField('1963', true, 'November 1963', false), '',
    "Partial (year-only) over a less-bare-but-still-partial existing (month+year) - still a downgrade, still suppressed");
assertEqual(isCheckedDateField('November 13, 1963', true, 'November 1963', false), 'checked',
    "Incoming MORE specific than existing (full date over Geni's month+year) - still pre-selects, exactly as before");
assertEqual(isCheckedDateField('1965', true, '1963', false), 'checked',
    "Equal specificity (both bare years) but genuinely different values - still pre-selects, per the user's explicit confirmation, so the conflict isn't silently hidden");
assertEqual(isCheckedDateField('November 13, 1963', true, 'November 13, 1963', false), '',
    "Equal specificity, identical value - stays unchecked via the existing datesAreEquivalent() path, unaffected by this fix");
assertEqual(isCheckedDateField('November 1963', true, '', false), 'checked',
    "Regression: Geni blank + a real (even if partial) scraped date - still pre-selects, nothing to protect");
assertEqual(isCheckedDateField('Circa November 1963', true, 'November 13, 1963', false, false), '',
    "A qualified partial date ('Circa November 1963') is still recognized as a downgrade against Geni's full date");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
