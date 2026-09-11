// Verifies #212/#240: datesAreEquivalent() (popup.js), used by parseForm()
// to decide whether a checked field's value is a genuine no-op update
// (identical to what Geni already shows) before submitting it. This
// format allowlist (DATE_PARSE_FORMATS) already needed two follow-up
// patches (abbreviated months, and a missing "D MMMM YYYY" form) - an
// incomplete list makes an unchanged date get silently reported and
// resubmitted as "(updated: ...)" forever, since it never recognizes the
// two differently-formatted strings as the same date. Extracts the real
// function verbatim with the real moment.js.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');
const moment = require(path.join(ROOT, 'moment.js'));

function exists(v) { return typeof v !== 'undefined' && v !== null; }

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

const DATE_QUALIFIER_PATTERN = /^(circa|about|after|before)\s+(the\s+)?/i;
const datesAreEquivalentSrc = extractArrayStatement(popupSrc, 'DATE_PARSE_FORMATS') + '\n' + extractFunction(popupSrc, 'datesAreEquivalent');
const datesAreEquivalent = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN', datesAreEquivalentSrc + '\nreturn datesAreEquivalent;')(exists, moment, DATE_QUALIFIER_PATTERN);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- The two previously-missing formats (#212/#240 follow-ups) ---
assertEqual(datesAreEquivalent('3 Jan 1920', 'January 3, 1920'), true,
    "#212/#240: an abbreviated month ('3 Jan 1920') is recognized as equivalent to a full-month Geni display ('January 3, 1920') - one of the two formats that had to be added after the fact");
assertEqual(datesAreEquivalent('3 January 1920', '3 Jan 1920'), true,
    "The 'D MMMM YYYY' form (day-first, full month name) - the other format that was missing and had to be added");

// --- Qualifier handling: 'About'/'Circa' are the same qualifier, differently worded ---
assertEqual(datesAreEquivalent('Circa 1920', 'About 1920'), true,
    "'Circa' and 'About' are recognized as the same qualifier wording, not two different dates");
assertEqual(datesAreEquivalent('Before 1920', 'After 1920'), false,
    "Different qualifiers (Before vs. After) on the same underlying year are correctly NOT equivalent");

// --- Ordinal suffix normalization ---
assertEqual(datesAreEquivalent('3rd Jan 1920', '3 January 1920'), true,
    "An ordinal suffix ('3rd') is stripped before comparing, so it doesn't block an otherwise-identical date from matching");

// --- Genuinely different dates must NOT match ---
assertEqual(datesAreEquivalent('3 Jan 1920', '4 Jan 1920'), false,
    "Two genuinely different dates are correctly NOT equivalent - this function must never over-match");

// --- Year-only vs. a full date must NOT match (different precision is a real difference, not noise) ---
assertEqual(datesAreEquivalent('1920', '3 January 1920'), false,
    "A bare year and a full day/month/year date are NOT treated as equivalent - Geni legitimately expanding a bare year into a full date is a real difference worth reporting, not formatting noise");

// --- Exact string match short-circuits without needing to parse at all ---
assertEqual(datesAreEquivalent('3 January 1920', '3 January 1920'), true,
    "Byte-identical strings short-circuit to true immediately");

// --- Blank/missing values never match (would be a different no-op path, not a date-format question) ---
assertEqual(datesAreEquivalent('', '3 January 1920'), false,
    "A blank value never counts as equivalent to a real date - that's a different case (blank-to-blank), not this function's job");
assertEqual(datesAreEquivalent(undefined, undefined), true,
    "Two undefined values don't crash - the identical-value shortcut (a === b) catches this before the blank/exists guard even runs");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
