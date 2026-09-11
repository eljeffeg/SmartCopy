// Verifies the localization follow-up (borrowed idea from reviewing
// pquenee/SmartCopy, reopening #211's scope on the user's decision):
// "Living"/"Deceased"/"Male"/"Female"/"Unknown" display text - previously
// hardcoded English regardless of active locale - now goes through _().
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const buildformSrc = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');
const en = JSON.parse(fs.readFileSync('' + ROOT + '/_locales/en/messages.json', 'utf8'));
const fallback = fs.readFileSync('' + ROOT + '/locale_fallback_en.js', 'utf8');

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

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// --- new locale keys exist ---
["Male", "Female", "Unknown", "Living", "Deceased"].forEach(function (key) {
    assertTrue(en.hasOwnProperty(key), "en/messages.json has a '" + key + "' key");
    assertTrue(fallback.indexOf('"' + key + '"') !== -1, "locale_fallback_en.js was regenerated and includes '" + key + "'");
});

// --- isAlive() ---
const _ = function (key) { return "[" + key + "]"; };
const isAlive = new Function('_', 'return ' + extractFunction(buildformSrc, 'isAlive'))(_);
assertEqual(isAlive(""), "", "isAlive('') still returns blank, not a translated empty-string lookup");
assertEqual(isAlive(true), "[Living]", "isAlive(true) now routes through _()");
assertEqual(isAlive(false), "[Deceased]", "isAlive(false) now routes through _()");

// --- localizedGender() ---
const localizedGender = new Function('_', 'return ' + extractFunction(buildformSrc, 'localizedGender'))(_);
assertEqual(localizedGender("male"), "[Male]", "localizedGender('male') now routes through _()");
assertEqual(localizedGender("female"), "[Female]", "localizedGender('female') now routes through _()");
assertEqual(localizedGender("unknown"), "[Unknown]", "localizedGender('unknown') now routes through _()");
assertEqual(localizedGender(""), "", "localizedGender('') returns blank rather than a translated empty-string lookup");

// --- call sites wired to the localized helpers, not the old English literals ---
assertEqual((buildformSrc.match(/capFL\(genifocusdata\.get\("gender"\)\)/g) || []).length, 0,
    "No remaining capFL(...) gender comparison call sites (all moved to localizedGender())");
assertEqual((buildformSrc.match(/localizedGender\(genifocusdata\.get\("gender"\)\)/g) || []).length, 2,
    "Both focus-profile gender comparison rows use localizedGender()");
assertTrue(buildformSrc.indexOf('localizedGender(getGeniData(profile, "gender"))') !== -1,
    "The family-member refresh path also uses localizedGender()");
assertEqual((buildformSrc.match(/>' \+ _\("Male"\) \+ '<\/option>/g) || []).length, 3,
    "All 3 gender <option> blocks (focus x2, family member) use _(\"Male\") instead of a literal 'Male'");
assertEqual((buildformSrc.match(/>' \+ _\("Deceased"\) \+ '<\/option>/g) || []).length, 3,
    "All 3 living <option> blocks use _(\"Deceased\") instead of a literal 'Deceased'");
assertEqual((buildformSrc.match(/selected>' \+ _\("Unknown"\) \+ '<\/option>/g) || []).length, 2,
    "Both standalone 'Unknown' dropdown options (relationship-type, person-match) use _(\"Unknown\")");
assertEqual((buildformSrc.match(/return _\("Male"\)|return _\("Female"\)|return _\("Unknown"\)/g) || []).length, 3,
    "localizedGender() itself returns via _() for all 3 real gender values");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
