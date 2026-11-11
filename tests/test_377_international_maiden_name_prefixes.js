// Live-reported (#377, DanCornett): MyHeritage names in Hebrew carry
// "לבית" ("to the house of") as their own language's maiden-name marker -
// the exact same idiom as Polish "z d." (already handled), just a
// different script - and SmartCopy didn't strip it the way it does
// "nee"/"born". Expanded while fixing it: German's own equivalent
// ("geb"/"geb."/"geboren", short for "geboren" = "born") was missing
// entirely, and the French accented spellings ("née", the correct one,
// and "neé", a common real-world typo swapping which "e" carries the
// accent) weren't recognized either - only the unaccented "nee" was.
// Extracts the real NameParse.parse() verbatim.
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

assertEqual(NameParse.parse('Jane Cohen (לבית Levi)', true).birthName, 'Levi',
    "Hebrew's own maiden-name marker (לבית, \"to the house of\") is stripped, same idiom as Polish \"z d.\"");
assertEqual(NameParse.parse('Jane Schmidt (geb. Müller)', true).birthName, 'Müller',
    "German's abbreviated maiden-name marker \"geb.\" is stripped");
assertEqual(NameParse.parse('Jane Schmidt (geb Müller)', true).birthName, 'Müller',
    "German's abbreviated marker without the period (\"geb\") is also stripped");
assertEqual(NameParse.parse('Jane Schmidt (geboren Müller)', true).birthName, 'Müller',
    "German's unabbreviated marker (\"geboren\") is stripped too");
assertEqual(NameParse.parse('Jane Smith (née Jones)', true).birthName, 'Jones',
    "The correctly-accented French spelling (\"née\") is stripped, not just the unaccented \"nee\"");
assertEqual(NameParse.parse('Jane Smith (neé Jones)', true).birthName, 'Jones',
    "The common real-world typo variant (\"neé\", accent on the wrong e) is stripped too");

// --- Regression: the pre-existing markers still work ---
assertEqual(NameParse.parse('Jane Smith (born Jones)', true).birthName, 'Jones', "Regression: English \"born\" still works");
assertEqual(NameParse.parse('Jane Smith (nee Jones)', true).birthName, 'Jones', "Regression: the original unaccented \"nee\" still works");
assertEqual(NameParse.parse('Jane Nowak (z d. Kowalski)', true).birthName, 'Kowalski', "Regression: Polish \"z d.\" still works");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
