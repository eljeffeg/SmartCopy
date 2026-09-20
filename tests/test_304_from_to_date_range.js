// Verifies a #304 follow-up (live-reported, DanCornett): cleanDate()
// (buildform.js) turned FamilySearch's "From <date1> to <date2>" range
// phrasing into "Between After <date1> and <date2>" - two bugs stacked on
// top of each other. "from" unconditionally mapped to "After" first, then
// the separate " to " -> " and " / "Between " wrapping ran on top of that
// already-mutated string, since the " to " itself was never consumed by
// the "from" substitution. The result both read wrong and no longer
// matched a Geni "Between" date at all (Dan's report: this also breaks
// matching against Geni's own "Between" dates).
//
// Fix: a paired "from ... to ..." now drops the word "from" entirely and
// lets the existing " to " handling build "Between X and Y" on its own. A
// LONE "From <date>" (no matching "to") still means "starting from," so it
// keeps mapping to "After", unchanged.
//
// Extracts the real cleanDate() (and its translateForeignMonthNames()
// dependency) verbatim - same extract-and-eval pattern as
// tests/test_197_onlineofb_field_date_parsing.js, which already does this
// for the same function.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

function exists(v) { return typeof v !== 'undefined' && v !== null; }
if (!String.prototype.contains) {
    String.prototype.contains = function () { return String.prototype.indexOf.apply(this, arguments) !== -1; };
}

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
function extractVarStatement(src, name) {
    const marker = 'var ' + name + ' =';
    const start = src.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    const semi = src.indexOf(';', start);
    return src.slice(start, semi + 1);
}
const monthTranslationVars = extractVarStatement(bfSrc, 'MONTH_NAME_TRANSLATIONS') + '\n' + extractVarStatement(bfSrc, 'ENGLISH_MONTH_NAMES');
const translateForeignMonthNames = new Function('exists', monthTranslationVars + '\nreturn ' + extractFunction(bfSrc, 'translateForeignMonthNames'))(exists);
const cleanDate = new Function('exists', 'translateForeignMonthNames', 'return ' + extractFunction(bfSrc, 'cleanDate'))(exists, translateForeignMonthNames);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- The exact bug: a paired "from ... to ..." range ---
assertEqual(cleanDate('From 1810 to 1820'), 'Between 1810 and 1820',
    "#304 follow-up: 'From X to Y' is 'Between X and Y', not 'Between After X and Y'");
assertEqual(cleanDate('from 1 January 1810 to 5 May 1820'), 'Between 1 January 1810 and 5 May 1820',
    "Same fix with full day/month/year dates on both sides");
assertEqual(cleanDate('from 1810 to 1820'), 'Between 1810 and 1820',
    "Lowercase 'from'/'to' (as FamilySearch actually renders it) works the same way");
// Note: the downstream " to " -> " and " wrapping this fix relies on
// (further down in cleanDate()) is itself case-SENSITIVE and pre-existing,
// not part of this fix - an all-caps "FROM ... TO ..." doesn't get wrapped
// into "Between ... and ..." at all (falls through unchanged past the
// "from" removal). Not touched here since Dan's report was specifically
// about ordinary-case "From ... to ...", the actual FamilySearch phrasing.

// --- Regression: a lone "From <date>" (no "to") still means "starting from" ---
assertEqual(cleanDate('From 1810'), 'After 1810',
    "A lone 'From' with no matching 'to' still maps to 'After', unchanged");
assertEqual(cleanDate('From 3 May 1900'), 'After 3 May 1900',
    "Same for a lone 'From' with a full date");

// --- Regression: existing GEDCOM-style and dash/slash ranges untouched ---
assertEqual(cleanDate('BET 1810 AND 1820'), 'Between 1810 AND 1820',
    "GEDCOM 'BET ... AND ...' still resolves the same way as before (pre-existing behavior, not touched by this fix)");
assertEqual(cleanDate('1810-1820'), 'Between 1810 and 1820',
    "A plain dash-separated year range still becomes 'Between X and Y'");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
