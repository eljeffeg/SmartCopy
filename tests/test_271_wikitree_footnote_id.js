// Verifies #271: WikiTree footnotes now include the stable page ID (the
// slug after /wiki/), matching the existing Find A Grave/FamilySearch
// pattern in footnoteLabel() (popup.js).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const popupSrc = fs.readFileSync('' + ROOT + '/popup.js', 'utf8');

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

function exists(v) { return typeof v !== 'undefined' && v !== null; }
const footnoteLabel = new Function('exists', 'return ' + extractFunction(popupSrc, 'footnoteLabel'))(exists);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

assertEqual(footnoteLabel('https://www.wikitree.com/wiki/Zanco-2', 'WikiTree Genealogy'), 'WikiTree, ID:Zanco-2',
    "WikiTree footnote includes the page slug ID (issue's own example)");
assertEqual(footnoteLabel('https://www.wikitree.com/genealogy/some-page', 'WikiTree Genealogy'), 'WikiTree Genealogy',
    "A WikiTree URL that doesn't match /wiki/<id> falls back to the plain recordtype, doesn't throw");
assertEqual(footnoteLabel(undefined, 'WikiTree Genealogy'), 'WikiTree Genealogy',
    "No URL at all still falls back to the plain recordtype");

// --- Existing behavior unchanged ---
assertEqual(footnoteLabel('https://www.findagrave.com/memorial/12345/john-doe', 'Find A Grave Memorial'), 'Find A Grave, ID:12345',
    "Find A Grave footnote still works (unchanged baseline)");
assertEqual(footnoteLabel('https://www.familysearch.org/tree/person/details/ABCD-123', 'FamilySearch Genealogy'), 'FamilySearch, ID:ABCD-123',
    "FamilySearch Genealogy footnote still works (unchanged baseline)");
assertEqual(footnoteLabel('https://example.com/x', 'Ancestry Genealogy'), 'Ancestry Genealogy',
    "A recordtype with no dedicated ID-extraction branch still falls back cleanly");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
