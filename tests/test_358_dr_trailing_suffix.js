// Verifies #358 (live-reported, surfaced while chasing a separate sibling
// auto-match report): "Heinrich Hirsch SCHWARZ Dr." failed to auto-match
// its exact Geni counterpart "Heinrich Hirsch Schwarz [1847-1899]" - not a
// case-sensitivity issue (findExistingFamilyMatch() already lowercases
// both sides of the surname/given-name comparison), and not a spelling-
// variant issue either (confirmed via the real NameParse.parse(): plain
// names without a trailing title, e.g. "Bertha SCHWARZ"/"Ernestine
// SCHWARZ", parse correctly - their own separate mismatch is a genuine
// "Schwarz" vs "Schwartz" spelling difference, a different, higher-stakes
// problem deliberately NOT addressed by this fix).
//
// Root cause, confirmed by running the real parser directly: "Dr." as a
// TRAILING word (a common convention in European records, where a title
// sometimes follows the name instead of leading it) was recognized by
// neither is_salutation() (prefix-only - "Mr"/"Mrs"/"Miss"/"Ms") nor
// is_suffix()'s own list (which already has MD/PhD/DDS/Esq/etc., just
// not the plain word "Dr"). With nothing to mark it as a suffix, the
// whole parse collapsed around it - NameParse.parse("Heinrich Hirsch
// SCHWARZ Dr.") returned firstName="Heinrich Hirsch Schwarz" (the real
// surname swept into the given name) and lastName="Dr." - breaking
// sibling/parent auto-match entirely, since the surname comparison
// requires an exact string match and "Dr" is nothing like "Schwarz".
//
// Fixed by adding "Dr" to is_suffix()'s existing suffixArray, the exact
// same mechanism (and the exact right list) MD/PhD/DDS/Esq already use -
// not a new, separate special case.
//
// Extracts the REAL NameParse.parse() verbatim - same technique as
// tests/test_multi_parenthetical_name_parsing.js.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const nameParseSrc = fs.readFileSync(path.join(ROOT, 'parse-names.js'), 'utf8');

function exists(v) { return typeof v !== 'undefined' && v !== null; }
global.exists = exists;
global.$ = function () { return { prop: function () { return false; } }; };
if (!String.prototype.contains) {
    String.prototype.contains = function () { return String.prototype.indexOf.apply(this, arguments) !== -1; };
}
function capFL(s) { return s; }
global.capFL = capFL;
const NameParse = new Function(nameParseSrc + '\nreturn NameParse;')();

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- #358: the exact reported case. ---
{
    var result = NameParse.parse('Heinrich Hirsch SCHWARZ Dr.', false);
    assertEqual(result.firstName, 'Heinrich Hirsch',
        "#358: trailing 'Dr.' no longer gets swept into firstName along with the real surname");
    assertEqual(result.lastName, 'Schwarz',
        "#358: lastName correctly resolves to the real surname 'Schwarz', not 'Dr' - this is what actually broke the Geni auto-match, since the surname comparison requires an exact match");
    assertEqual(result.suffix, 'Dr',
        "#358: 'Dr' is now recognized and stored as the suffix, the same mechanism MD/PhD/DDS already use");
}

// --- Safety: a leading "Dr." (already-working prefix path, unrelated mechanism to is_suffix()) is unaffected. ---
{
    var result = NameParse.parse('Dr. Heinrich Schwarz', false);
    assertEqual(result.firstName, 'Heinrich',
        "Safety: a LEADING 'Dr.' still parses correctly via its own separate prefix mechanism, untouched by this fix");
    assertEqual(result.lastName, 'Schwarz',
        "Safety: leading 'Dr.' case still gets the correct surname");
}

// --- Safety: an existing, already-recognized trailing suffix (Jr.) still works, confirming the array itself wasn't broken by the addition. ---
{
    var result = NameParse.parse('William Edwin Butts Jr.', false);
    assertEqual(result.firstName, 'William Edwin',
        "Safety: an existing trailing suffix (Jr.) still parses correctly after adding Dr to the same list");
    assertEqual(result.lastName, 'Butts',
        "Safety: existing Jr. case still gets the correct surname");
    assertEqual(result.suffix, 'Jr',
        "Safety: existing Jr. suffix recognition is unchanged");
}

// --- Safety: a plain name with no title at all is completely unaffected. ---
{
    var result = NameParse.parse('Bertha Schwarz', false);
    assertEqual(result.firstName, 'Bertha',
        "Safety: an ordinary name with no title parses exactly as before");
    assertEqual(result.lastName, 'Schwarz',
        "Safety: an ordinary name's surname is unaffected");
    assertEqual(result.suffix, '',
        "Safety: no spurious suffix is introduced for a name that doesn't have one");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
