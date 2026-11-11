// Live-reported (#373, DanCornett): a Consistency Check comparison
// between two siblings read "Birth date of Jacob Wasserman and his
// Frances Irene Wasserman are within 8 months." - missing the
// relationship word ("sister") entirely between "his" and the second
// sibling's name. The expected sentence is "...and his sister Frances
// Irene Wasserman...".
//
// Root cause: siblingName() (content.js) calls _("sister") for a female
// sibling, but no "sister" key existed anywhere - not in any of the 34
// _locales/*/messages.json files, and not in locale_fallback_en.js
// either. "brother" and "sibling" (the unknown-gender case) were both
// defined; "sister" was simply never added. Unlike a translation GAP
// (where the #211 English-fallback mechanism already covers a locale
// missing a key that genuinely exists in English), this was missing
// from the English source itself, so there was nothing for the fallback
// to find - the user's own confirmation that "sibling is fine" matches
// this exactly, since that key was never missing in the first place.
//
// Fixed by adding "sister" to _locales/en/messages.json and
// regenerating locale_fallback_en.js via scripts/generate-locale-
// fallback.js (not hand-duplicated, per #211's own documented
// convention) - deliberately only to English, relying on the existing
// EN_FALLBACK_MESSAGES mechanism to serve it in every other locale
// until/unless each is translated, exactly like every other
// currently-incomplete locale gap already works.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- The key now exists in the real English source ---
const enMessages = JSON.parse(fs.readFileSync(path.join(ROOT, '_locales/en/messages.json'), 'utf8'));
assertTrue(enMessages.hasOwnProperty('sister'), "en/messages.json now has a 'sister' key");
assertEqual(enMessages.sister.message, 'sister', "'sister' has the correct message text");

// --- It's also present in the generated fallback file, not just the source ---
// (locale_fallback_en.js is machine-generated FROM en/messages.json -
// checking both catches a forgotten regeneration step, not just a typo
// in one file.)
const fallbackSrc = fs.readFileSync(path.join(ROOT, 'locale_fallback_en.js'), 'utf8');
const EN_FALLBACK_MESSAGES = new Function(fallbackSrc + '\nreturn EN_FALLBACK_MESSAGES;')();
assertTrue(EN_FALLBACK_MESSAGES.hasOwnProperty('sister'),
    "locale_fallback_en.js (regenerated via scripts/generate-locale-fallback.js) now has 'sister' too, not just the source file");
assertEqual(EN_FALLBACK_MESSAGES.sister.message, 'sister', "The fallback entry has the correct message text");

// --- Regression: 'brother' and 'sibling' (confirmed working by the user, "sibling is fine") are untouched ---
assertTrue(enMessages.hasOwnProperty('brother') && enMessages.brother.message === 'brother', "Regression: 'brother' is untouched");
assertTrue(enMessages.hasOwnProperty('sibling') && enMessages.sibling.message === 'sibling', "Regression: 'sibling' (confirmed already working live) is untouched");

// --- No case-insensitive collision was introduced (chrome.i18n.getMessage() resolves case-insensitively - see test_locale_key_case_collisions.js) ---
const collidesWith = Object.keys(enMessages).filter(function (k) { return k !== 'sister' && k.toLowerCase() === 'sister'; });
assertTrue(collidesWith.length === 0, "The new 'sister' key doesn't case-insensitively collide with any other existing key" + (collidesWith.length ? (' - collides with: ' + collidesWith.join(', ')) : ''));

// --- End-to-end: siblingName() (content.js) now actually resolves "sister" for a female sibling ---
// Minimal _() + chrome.i18n stand-in mirroring shared.js's real fallback
// logic closely enough to exercise the real call site verbatim, without
// needing a full browser i18n environment.
function exists(v) { return typeof v !== 'undefined' && v !== null; }
function isFemale(g) { return g === 'female'; }
function isMale(g) { return g === 'male'; }
global.chrome = { i18n: { getMessage: function () { return ''; } } }; // simulates every locale except English having nothing for this key
function _(messageName) {
    var result = chrome.i18n.getMessage(messageName);
    if (result !== '') { return result; }
    return EN_FALLBACK_MESSAGES.hasOwnProperty(messageName) ? EN_FALLBACK_MESSAGES[messageName].message : result;
}
const contentSrc = fs.readFileSync(path.join(ROOT, 'content.js'), 'utf8');
function extractFunction(src, name) {
    const marker = 'function ' + name + '(';
    const start = src.indexOf(marker);
    let depth = 0, i = src.indexOf('{', start);
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(start, i + 1);
}
const siblingName = new Function('_', 'isFemale', 'isMale', extractFunction(contentSrc, 'siblingName') + '\nreturn siblingName;')(_, isFemale, isMale);
assertEqual(siblingName('female'), 'sister', "siblingName('female') now resolves to 'sister' instead of the previously-undefined key's blank string");
assertEqual(siblingName('male'), 'brother', "Regression: siblingName('male') still resolves to 'brother'");
assertEqual(siblingName('unknown'), 'sibling', "Regression: siblingName('unknown') still resolves to 'sibling' ('sibling is fine' per the live report)");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
