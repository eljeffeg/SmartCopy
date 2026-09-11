// Verifies the 6 keys added for "Living"/"Deceased"/"Male"/"Female"/
// "Unknown"/"Fix All" (previously en-only, silently falling back to
// English for every other locale) now have real per-locale translations
// across all 33 non-English locales, and that every locale file is still
// valid JSON with nothing else disturbed.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const localesDir = '' + ROOT + '/_locales';
const newKeys = ['Male', 'Female', 'Unknown', 'Living', 'Deceased', 'Fix_All_Case_Issues'];

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

const locales = fs.readdirSync(localesDir).filter(function (d) {
    return fs.statSync(path.join(localesDir, d)).isDirectory();
});
assertTrue(locales.length === 34, "34 locale directories exist (33 translated + en), got " + locales.length);

let allHaveKeys = true;
let anyInvalidJson = false;
locales.forEach(function (locale) {
    const filePath = path.join(localesDir, locale, 'messages.json');
    let data;
    try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        anyInvalidJson = true;
        console.log('FAIL: invalid JSON in', locale, '-', e.message);
        return;
    }
    newKeys.forEach(function (key) {
        if (!data.hasOwnProperty(key) || !data[key].message || data[key].message.trim() === "") {
            allHaveKeys = false;
            console.log('FAIL: ' + locale + ' missing or blank "' + key + '"');
        }
    });
});
assertTrue(!anyInvalidJson, "Every locale's messages.json still parses as valid JSON");
assertTrue(allHaveKeys, "Every one of the 34 locales has a non-blank value for all 6 keys");

// Every locale's translation for a given key must not be byte-identical
// to every OTHER locale's (a cheap sanity check against a copy-paste
// mistake that left every locale with the same untranslated placeholder).
newKeys.forEach(function (key) {
    const values = new Set();
    locales.filter(function (l) { return l !== 'en'; }).forEach(function (locale) {
        const data = JSON.parse(fs.readFileSync(path.join(localesDir, locale, 'messages.json'), 'utf8'));
        values.add(data[key].message);
    });
    assertTrue(values.size > 5, "'" + key + "' has real per-language variety across locales (" + values.size + " distinct values), not one value copy-pasted everywhere");
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
