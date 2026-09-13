// Verifies a fix found during a pre-selection audit: the focus profile's
// Occupation field used to require scorefactors.contains("occupation") -
// MyHeritage's own auto-generated "value add" summary text literally
// mentioning "occupation" - the same gate Photo/About had (#296) before
// being removed. Unlike Photo, Occupation already compares against
// Geni's real current value via isChecked(occupation, scoreoccupation,
// false, genifocusdata.get("occupation"), occlocked), so the gate was
// only ever making this MISS real, safe pre-selection opportunities
// (most record types never mention "occupation" in that summary even
// with a real scraped occupation), never protecting anything the
// existing value comparison doesn't already.
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

// --- Structural: the scorefactors gate is gone ---
assertTrue(src.indexOf('var scoreoccupation = true;') !== -1,
    "Focus profile's scoreoccupation is no longer gated on scorefactors.contains(\"occupation\")");
assertTrue(!/scorefactors\.contains\(title\)\s*\)\s*\{\s*\n\s*scoreoccupation = true;/.test(src),
    "The old scorefactors-gated branch is gone");

// --- Behavioral: real isChecked()/resolveFieldEnabled(), confirming the existing value-comparison protection still works without the gate ---
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

const scoreoccupation = true; // matches the real fixed code exactly - no scorefactors dependency
assertEqual(isChecked('Farmer', scoreoccupation, false, ''), 'checked',
    "A real scraped occupation now pre-checks even when MyHeritage's summary never mentions 'occupation' at all");
assertEqual(isChecked('Farmer', scoreoccupation, false, 'Farmer'), 'checked',
    "Still checked when it happens to match Geni's own value exactly - parseForm()'s own no-op filter (not this gate) is what skips a genuine no-op at submit time");
assertEqual(isChecked('', scoreoccupation, false, 'Blacksmith'), '',
    "Blank scraped + Geni already has a real occupation - still correctly protected, unchanged from before");
assertEqual(isChecked('', scoreoccupation, false, ''), 'checked',
    "Blank scraped + Geni also blank - still correctly starts checked, nothing to protect");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
