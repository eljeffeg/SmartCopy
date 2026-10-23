// Verifies a live-reported bug: "(Nechama) Anna (Chana) Obridka" (an
// Ancestry name with two SEPARATE alternate-name parentheticals around a
// genuine middle given name) parsed as firstName="Obridka", lastName="" -
// the real first name ("Anna") and the real last name ("Obridka") both
// vanished.
//
// Root cause: NameParse.parse() (parse-names.js) has a reconstruction step
// meant to re-join a genuinely multi-word quoted/parenthesized nickname
// whose MIDDLE words carry no quote/paren marker at all (e.g. John
// "Captain Black Jack" Geary - only "Captain and Jack" get caught by the
// per-word filter on their own; "Black" has no marker and needs this
// second pass to find it). But the same trigger condition
// (nickParts.length > 1 && the parts aren't already adjacent in the
// original string) also fired for two entirely SEPARATE, already-complete
// nicknames with real name content between them - "(Nechama)" and
// "(Chana)" each already have both their own open AND close marker, so
// there's nothing fragmented to reassemble. Treating them as one
// nickname spanning all three words swept "Anna" (the real first name)
// into the nickname and left only "Obridka" in nameParts - a single
// word, read as a bare first name with no last name at all.
//
// A second, related bug found in the same investigation: nickfirst's own
// paren-stripping used non-global .replace("(","")/.replace(")",""), so
// only the FIRST "(" and FIRST ")" in the whole joined nickname string
// ever got removed - a second, separate parenthetical nickname kept its
// own parens in the final display text.
//
// Fixed by only entering the multi-word reconstruction when at least one
// nickPart is genuinely incomplete (an opening marker with no matching
// close in the same word) - the actual signal that a word was split off a
// longer nickname, which two separately-complete parentheticals never
// are - and by making the final paren-stripping global.
//
// Extracts the REAL NameParse.parse() verbatim - same technique already
// established in test_204_married_surname_guards.js.
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

// --- Live-reported bug: two separate single-word alternate-name parentheticals around a real middle given name ---
{
    var result = NameParse.parse('(Nechama) Anna (Chana) Obridka', true);
    assertEqual(result.firstName, 'Anna', "The real first name 'Anna' is no longer swept into the nickname field");
    assertEqual(result.lastName, 'Obridka', "The real last name 'Obridka' is correctly extracted, not left as a bare single-word firstName");
    assertEqual(result.nickName.indexOf('(') === -1 && result.nickName.indexOf(')') === -1, true,
        "Neither alternate-name parenthetical leaves its own parens in the final nickname text");
    assertEqual(result.nickName.indexOf('Nechama') !== -1 && result.nickName.indexOf('Chana') !== -1, true,
        "Both alternate names ('Nechama' and 'Chana') still end up in the nickname field, just without the real first/last name swept in with them");
}

// --- Regression: Dorothy's case (one nickname + one trailing maiden-name parenthetical) is unaffected ---
{
    var result = NameParse.parse('Dorothy (Doba) Lachtman (Blumenthal)', true);
    assertEqual(result.firstName, 'Dorothy', "Regression: Dorothy's first name is still correctly parsed");
    assertEqual(result.lastName, 'Lachtman', "Regression: Dorothy's last name is still correctly parsed");
    assertEqual(result.birthName, 'Blumenthal', "Regression: Dorothy's birth/maiden name is still correctly parsed");
}

// --- Regression: the ORIGINAL use case this reconstruction logic was built for - a genuine multi-word quoted nickname with an unmarked middle word ---
{
    var result = NameParse.parse('John "Captain Black Jack" Geary', true);
    assertEqual(result.firstName, 'John', "Regression: a genuine multi-word quoted nickname still correctly identifies the real first name");
    assertEqual(result.lastName, 'Geary', "Regression: ...and the real last name");
    assertEqual(result.nickName.indexOf('Captain') !== -1 && result.nickName.indexOf('Black') !== -1 && result.nickName.indexOf('Jack') !== -1, true,
        "Regression: all three words of the genuine multi-word nickname ('Captain Black Jack') are still reassembled correctly - this fix must not break the case the logic was originally built for");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
