// Verifies #296 follow-up (live-reported, DanCornett): the focus
// profile's About field no longer has a hardcoded scoreabout=false that
// prevented it from EVER pre-selecting, regardless of content. Dan's own
// stated expectation: "About should always pre-select when it is not
// empty ... irrespective of whether Geni profile has About or not."
//
// Verified this is safe: popup.js's actual submission path (the "merge-
// existing-About" logic) explicitly PREPENDS whatever Geni already has
// onto the new About text before submitting - the same additive, never-
// overwrites property already established for Photo - so there's no
// "protect existing data" reason to withhold pre-selection here either.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- Structural: the hardcoded false is gone ---
assertTrue(src.indexOf('var scoreabout = true;') !== -1,
    "#296 follow-up: focus profile's scoreabout is no longer hardcoded false");
assertTrue(!/var scoreabout = false;/.test(src),
    "The old hardcoded-false line is gone entirely, not just shadowed");

// --- The load-bearing assumption: submission actually merges, never overwrites ---
assertTrue(popupSrc.indexOf('familyout["about_me"] = geni_return.about_me + "\\n" + familyout["about_me"]') !== -1,
    "Confirms the assumption this fix depends on: Geni's existing about_me is explicitly prepended before resubmission, never discarded");

// --- Behavioral: real isChecked()/resolveFieldEnabled(), Dan's exact ask ---
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

const scoreabout = true; // matches the real fixed code exactly
assertEqual(isChecked("* '''Residence''': Apr 1 1950 - 1149 N Mayburn, Dearborn, Wayne, Michigan, United States", scoreabout), 'checked',
    "#296 follow-up: real About content now pre-checks - Dan's exact request, 'irrespective of whether Geni profile has About or not'");
assertEqual(isChecked('', scoreabout), '',
    "A genuinely blank About still stays unchecked - nothing to offer");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
