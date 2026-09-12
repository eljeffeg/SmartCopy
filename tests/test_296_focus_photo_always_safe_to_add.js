// Verifies #296 follow-up (live-reported, DanCornett): the focus
// profile's Photo checkbox no longer requires MyHeritage's own auto-
// generated "value add" summary text to literally mention "photo" before
// it can pre-select. Real example: the Barbara C Kenney 1950 census
// record's summary reads "Adds: middle name and residence" - no mention
// of photo at all, even though a real scanned census image is attached
// and Geni has none - so Photo never pre-selected no matter how clearly
// new the image was.
//
// Per the user's own domain correction: unlike every other field,
// submitting a photo is purely ADDITIVE - Geni adds it to the person's
// photo gallery, it never replaces or overwrites an existing one. There
// is no "protect existing Geni data from being blanked" reason to gate
// this the way text fields are, and no identity-confidence reason either
// (the focus person is, by definition, never in question the way a
// family member's identity can be) - so Photo should pre-select purely
// off the user's own on/off setting, exactly like the family-member
// photo row already correctly does (it never had a scorefactors gate at
// all).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- Structural: the scorefactors gate is gone from the focus profile's photo block ---
assertTrue(src.indexOf('var scorephoto = false;\n            if ($(\'#photoonoffswitch\').prop(\'checked\')) {\n                scorephoto = true;\n                ck++;\n            }') !== -1,
    "#296 follow-up: focus profile's scorephoto no longer requires scorefactors.contains(\"photo\") - just the user's own on/off setting");

// --- Behavioral: reconstruct the real decision using the real isChecked()/resolveFieldEnabled() ---
function exists(v) { return typeof v !== 'undefined' && v !== null; }
function isValue(v) { return v !== ''; }
function extractFunction(srcText, name) {
    const marker = 'function ' + name + '(';
    const start = srcText.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    let depth = 0, i = srcText.indexOf('{', start);
    for (; i < srcText.length; i++) {
        if (srcText[i] === '{') depth++;
        else if (srcText[i] === '}') { depth--; if (depth === 0) break; }
    }
    return srcText.slice(start, i + 1);
}
const resolveFieldEnabled = new Function('isValue', 'exists', 'return ' + extractFunction(src, 'resolveFieldEnabled'))(isValue, exists);
const isChecked = new Function('resolveFieldEnabled', 'return ' + extractFunction(src, 'isChecked'))(resolveFieldEnabled);

// Computes scorephoto exactly as the real (fixed) code does - no
// scorefactors involved anymore, purely the user's own setting.
function computeScorephoto(photoSettingOn) {
    return photoSettingOn;
}

// Dan's exact scenario: real thumbnail from the census image, Geni has
// none, MyHeritage's own "value add" text never mentions "photo" at all,
// user's photo auto-select setting is ON.
const realThumbnail = 'https://cf.myheritageimages.com/records/thumb/usa_vitals/1950-census/example.jpg';
assertEqual(isChecked(realThumbnail, computeScorephoto(true)), 'checked',
    "#296 follow-up: a real scraped photo now pre-checks when the user's setting is on, regardless of MyHeritage's value-add summary text");

// The user's own setting is still respected - OFF means never auto-checked, even with a real photo.
assertEqual(isChecked(realThumbnail, computeScorephoto(false)), '',
    "The user's own 'Enable photo checkbox auto-selection' setting is still fully respected - OFF means Photo never auto-checks");

// No scraped photo at all - nothing to check regardless of the setting.
assertEqual(isChecked('', computeScorephoto(true)), '',
    "No real scraped photo at all - stays unchecked even with the setting on, nothing to offer");

// Geni already having its OWN photo doesn't block pre-selection - unlike a text field, adding a second photo is safe (additive), not a data-loss risk.
// (resolveFieldEnabled never even looks at Geni's current value for this
// call - photo's checked-state has always been - and still correctly is -
// independent of whatever Geni already has, exactly because adding never
// overwrites it.)
assertEqual(isChecked(realThumbnail, computeScorephoto(true)), 'checked',
    "A real scraped photo still pre-checks even when (implicitly) Geni already has its own photo - adding is safe, there's nothing to protect");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
