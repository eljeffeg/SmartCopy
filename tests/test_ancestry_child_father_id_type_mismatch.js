// Verifies a live-reported bug: copying a woman with a husband and three
// children (none previously on Geni) correctly added the husband, but all
// three children landed under a brand-new "(no name)" second union instead
// of the real one. Inspecting the family form showed "Unknown" selected
// for each child's father, with the real father genuinely present as a
// dropdown option - just not the one picked.
//
// Root cause: a child's own father/mother gets matched against the id
// already recorded for that same person as a SPOUSE (in `unionurls`,
// populated while processing the parent's own page) via jQuery's
// $.inArray(), which compares with strict equality - but Ancestry doesn't
// consistently return a person's id as the same type (number vs. string)
// in every part of its JSON (the file's own very next-door comparison,
// `String(focusPersonId) !== String(father.Id)`, already has to coerce
// for exactly this reason). $.inArray() never got the same treatment, so
// a father who IS genuinely already in unionurls could still silently
// fail to match, falling back to "Unknown" with no error at all.
//
// Fixed with indexOfLooseId() - a String()-coercing array search, used in
// place of $.inArray() for this exact lookup.
//
// Extracts the REAL function verbatim (not a reimplementation).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'collections/ancestrynew.js'), 'utf8');

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

const indexOfLooseId = new Function('return ' + extractFunction(src, 'indexOfLooseId'))();

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- The exact reported bug: the father's id is a number in unionurls but a string on the child's own page (or vice versa). ---
// Uses a realistic Ancestry person id (12 digits, matching real examples
// from live reports - e.g. #342's "352802014635") - well within
// Number.MAX_SAFE_INTEGER, so this isolates the type-mismatch question
// from a separate concern (large-integer precision loss, which a fix
// built only on String() coercion can't repair if the precision was
// already lost earlier, e.g. during JSON.parse of an unquoted numeric id -
// not what this specific fix addresses).
assertEqual(indexOfLooseId('352802014635', [352802014635]), 0,
    "Live-reported bug: a father id that's a STRING on the child's page still matches the SAME id stored as a NUMBER in unionurls");
assertEqual(indexOfLooseId(352802014635, ['352802014635']), 0,
    "Works in the other direction too - a NUMBER id against a STRING stored in unionurls");

// --- Regression: same-type ids still match exactly as $.inArray() already did ---
assertEqual(indexOfLooseId(42, [10, 20, 42, 50]), 2,
    "Regression: matching same-type ids still find the correct index");
assertEqual(indexOfLooseId('42', ['10', '20', '42', '50']), 2,
    "Regression: matching same-type STRING ids still find the correct index");

// --- Safety: a genuinely absent id still correctly returns -1 ("Unknown"), not a false match ---
assertEqual(indexOfLooseId(99, [10, 20, 42]), -1,
    "Safety: an id that genuinely isn't in the array still correctly returns -1, same as $.inArray() would");
assertEqual(indexOfLooseId(99, []), -1,
    "Safety: an empty array (no spouses registered yet) correctly returns -1, not a crash");

// --- Structural: both the father and mother parent_id/childlist resolutions use the new loose-matching helper, not $.inArray() ---
{
    const parseAncestryNewSrc = extractFunction(src, 'parseAncestryNew');
    const inArrayCount = (parseAncestryNewSrc.match(/\$\.inArray\(/g) || []).length;
    assertEqual(inArrayCount, 0,
        "parseAncestryNew() no longer uses $.inArray() anywhere - both the father and mother lookups were converted to indexOfLooseId()");
    const looseIdCount = (parseAncestryNewSrc.match(/indexOfLooseId\(/g) || []).length;
    assertEqual(looseIdCount, 4,
        "indexOfLooseId() is used in all 4 call sites that used to call $.inArray() (childlist + parent_id, for both father and mother)");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
