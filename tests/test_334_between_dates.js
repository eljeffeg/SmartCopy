// Verifies #334 (live-reported, DanCornett): "Between" date ranges weren't
// being used anywhere - neither for comparison nor for location lookup.
//
// Part A: Geni allows a Between date's two halves in either order ("so
// that one can indicate a more likely date being the first shown"), e.g.
// "Between 1949 and 1945". datesAreEquivalent() (popup.js) had no concept
// of a two-date range at all - it fell straight through to moment-parsing
// the whole "X and Y" phrase as a single date, which always fails, so a
// scraped Between date with the same two dates in the opposite order from
// Geni's own read as genuinely different and pre-selected a no-op update.
//
// Part B: getCurrentEventYear()/extractDateYear() (shared.js), used to
// default the "Edit Location" year field for a FamilySearch Places lookup,
// had the identical gap - the whole Between string failed to parse as one
// date, leaving the year field empty for any Between-dated event (Dan: "It
// should probably try the first; if there are 'errors', then try the
// second.").
//
// Both fixed via a shared DATE_BETWEEN_PATTERN (shared.js, next to
// DATE_QUALIFIER_PATTERN) rather than two separate inline regexes.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');
const sharedSrc = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
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

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- Structural: DATE_BETWEEN_PATTERN is defined once in shared.js, not duplicated per file. ---
const dateBetweenPatternCount = (sharedSrc.match(/var DATE_BETWEEN_PATTERN = /g) || []).length;
assertEqual(dateBetweenPatternCount, 1,
    "#334: DATE_BETWEEN_PATTERN is defined exactly once, in shared.js, reused by both datesAreEquivalent() and extractDateYear()");

// --- Part A: datesAreEquivalent() (popup.js) ---
const datesAreEquivalentSrc = extractArrayStatement(popupSrc, 'DATE_PARSE_FORMATS') + '\n' + extractArrayStatement(sharedSrc, 'DATE_BETWEEN_PATTERN') + '\n' + extractFunction(popupSrc, 'datesAreEquivalent');
const datesAreEquivalent = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN', datesAreEquivalentSrc + '\nreturn datesAreEquivalent;')(exists, moment, DATE_QUALIFIER_PATTERN);

assertEqual(datesAreEquivalent('Between 1949 and 1945', 'Between 1945 and 1949'), true,
    "#334 Part A: the same two dates in a Between range, swapped order, are recognized as equivalent (Geni allows either order to indicate likelihood)");
assertEqual(datesAreEquivalent('Between 1945 and 1949', 'Between 1945 and 1949'), true,
    "Safety: the same order still matches too, as it always did");
assertEqual(datesAreEquivalent('Between 1945 and 1949', 'Between 1945 and 1950'), false,
    "Safety: genuinely different dates within a Between range (1949 vs 1950) are still correctly NOT equivalent, in either order");
assertEqual(datesAreEquivalent('Between 1945 and 1949', '1945'), false,
    "Safety: a Between range compared against a single plain date is never equivalent, regardless of overlap");
assertEqual(datesAreEquivalent('Between 3 Jan 1920 and 1925', 'Between 1925 and January 3, 1920'), true,
    "#334 Part A: swapped order still recognizes each half via datesAreEquivalent()'s own existing format/qualifier handling (abbreviated vs. full month), not just an exact string match per half");

// --- Part B: extractDateYear() (shared.js) ---
function getDateFormat(valdate) {
    var dateformat = ["MMM YYYY", "MMMM YYYY", "MMM D YYYY", "MMMM D YYYY", "MMM D, YYYY", "MMMM D, YYYY", "YYYY", "MM/DD/YYYY", "D MMM YYYY", "D MMMM YYYY"];
    if (exists(valdate)) {
        if (valdate.trim().search(/\d{4}-\d{2}/) !== -1) {
            dateformat = "YYYY-MM-DD";
        } else if ((valdate.trim().search(/\d{2}-\d{4}/) !== -1) || (valdate.trim().search(/\d{1}-\d{1}-\d{4}/) !== -1)) {
            var datesplit = valdate.split("-");
            if (parseInt(datesplit[0]) > 12) {
                dateformat = "DD-MM-YYYY";
            } else {
                dateformat = "MM-DD-YYYY";
            }
        }
    }
    return dateformat;
}
const extractDateYearSrc = extractArrayStatement(sharedSrc, 'DATE_BETWEEN_PATTERN') + '\n' + extractFunction(sharedSrc, 'extractDateYear');
const extractDateYear = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN', 'getDateFormat', extractDateYearSrc + '\nreturn extractDateYear;')(exists, moment, DATE_QUALIFIER_PATTERN, getDateFormat);

assertEqual(extractDateYear('Between 1949 and 1945'), 1949,
    "#334 Part B: a Between date's year is no longer left empty for the 'Edit Location' lookup - uses the FIRST date when it parses");
assertEqual(extractDateYear('Between Unparseable and 1945'), 1945,
    "#334 Part B: falls back to the SECOND date when the first doesn't parse, matching Dan's own suggested behavior");
assertEqual(extractDateYear('Between Unparseable and AlsoUnparseable'), undefined,
    "Safety: if NEITHER half parses, still correctly returns undefined (empty), same as before this fix - no guessing");
assertEqual(extractDateYear('3 January 1920'), 1920,
    "Safety: an ordinary, non-Between date is completely unaffected by this fix");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
