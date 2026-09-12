// Verifies a real, live-reported bug: chrome.i18n.getMessage() resolves
// message names case-INSENSITIVELY, so two locale keys differing only in
// case silently collide - only one of them can ever actually be served at
// runtime, even though both exist as syntactically distinct keys in
// messages.json/EN_FALLBACK_MESSAGES. The "Living" key (Vital status
// dropdown, buildform.js, added under #297) collided with a pre-existing
// "living" key (Consistency Checker's profileStatus() badge, content.js) -
// Chrome served the older lowercase key's plain "living" text for BOTH
// call sites, silently defeating "Living"'s correct capitalization
// everywhere the Vital dropdown used it, across all 34 locales, for
// months, with no error or warning anywhere.
//
// Two checks: (1) this specific collision is fixed (the old "living" key
// is gone, replaced by a name that can't collide), and (2) no OTHER pair
// of keys currently defined anywhere in en/messages.json collides the
// same way - a general guard against the next accidental case collision,
// not just this one.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (JSON.stringify(actual) === JSON.stringify(expected)) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- The specific historical collision is fixed ---
const enMessages = JSON.parse(fs.readFileSync(path.join(ROOT, '_locales/en/messages.json'), 'utf8'));
assertTrue(!enMessages.hasOwnProperty('living'),
    "The old, colliding 'living' key (Consistency Checker) no longer exists in en/messages.json");
assertTrue(enMessages.hasOwnProperty('consistencyCheckLiving'),
    "It was renamed to 'consistencyCheckLiving' rather than just deleted");
assertTrue(enMessages.hasOwnProperty('Living'),
    "The unrelated 'Living' key (Vital status dropdown) is untouched and still present");
assertEqual(enMessages.Living.message, 'Living',
    "'Living' still has its correct, capitalized message text");

// --- content.js's call site was updated to match ---
const contentSrc = fs.readFileSync(path.join(ROOT, 'content.js'), 'utf8');
assertTrue(contentSrc.indexOf('_("consistencyCheckLiving")') !== -1,
    "content.js's profileStatus() now requests the renamed key");
assertTrue(contentSrc.indexOf('_("living")') === -1,
    "content.js no longer requests the old lowercase key anywhere");

// --- General guard: no two keys anywhere in en/messages.json collide case-insensitively ---
const keysByLowercase = {};
Object.keys(enMessages).forEach(function (key) {
    const lower = key.toLowerCase();
    if (!keysByLowercase[lower]) { keysByLowercase[lower] = []; }
    keysByLowercase[lower].push(key);
});
const collisions = Object.keys(keysByLowercase).filter(function (lower) { return keysByLowercase[lower].length > 1; });
assertEqual(collisions.map(function (lower) { return keysByLowercase[lower]; }), [],
    "No two locale keys anywhere in en/messages.json differ only by case - chrome.i18n.getMessage() would silently collide them exactly like 'living'/'Living' did. If this fails, the reported keys are unusable together and one must be renamed.");

// --- Every OTHER locale file was renamed consistently, not just English ---
const localesDir = path.join(ROOT, '_locales');
const locales = fs.readdirSync(localesDir).filter(function (d) { return fs.statSync(path.join(localesDir, d)).isDirectory(); });
let allRenamed = true;
let missingCount = 0;
locales.forEach(function (locale) {
    const messages = JSON.parse(fs.readFileSync(path.join(localesDir, locale, 'messages.json'), 'utf8'));
    if (messages.hasOwnProperty('living')) {
        allRenamed = false;
        console.log('  still has old "living" key:', locale);
    }
    if (!messages.hasOwnProperty('consistencyCheckLiving')) {
        missingCount++;
        console.log('  missing "consistencyCheckLiving" key:', locale);
    }
});
assertTrue(allRenamed, "No locale file (out of " + locales.length + ") still has the old 'living' key");
assertEqual(missingCount, 0, "Every locale file has the renamed 'consistencyCheckLiving' key");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
