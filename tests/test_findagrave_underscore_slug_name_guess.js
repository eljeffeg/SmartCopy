// Live-reported, Dan Bodenheimer: a daughter scraped from her father's
// FindAGrave "Children" list came through with firstName "Clara_b"
// instead of firstName "Clara" / middleName "B". Root cause, confirmed
// against the real page (https://www.findagrave.com/memorial/150507526/
// leo-hirschfeld): FindAGrave's own link to her used an UNDERSCORE, not a
// hyphen, between the given name and middle initial -
// href="/memorial/156849664/clara_b-ludwig" - while every OTHER word
// boundary in the same slug used a hyphen. The quick name-guess this
// extension derives from the URL slug (used as a fallback/merge-conflict
// candidate alongside the properly fetched full-page name) only replaced
// hyphens with spaces, leaving the underscore-joined "clara_b" stuck
// together as one word instead of splitting into "Clara" and "B".
// Extracts the real construction expression verbatim.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'collections/findagrave.js'), 'utf8');

const marker = "NameParse.fix_case(url.substring(url.lastIndexOf('/') + 1).replace(/[-_]/g, \" \"))";
if (src.indexOf(marker) === -1) {
    throw new Error('slug-to-name expression not found verbatim - has this code changed shape?');
}

// NameParse.fix_case() itself isn't under test here - a plain per-word
// capitalizer stand-in is enough to isolate what this specific expression
// does to the raw URL slug.
function fix_case(s) {
    return s.split(' ').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
}

function slugToName(url) {
    return new Function('NameParse', 'url', 'return ' + marker + ';')({ fix_case: fix_case }, url);
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

assertEqual(slugToName('/memorial/156849664/clara_b-ludwig'), 'Clara B Ludwig',
    "An underscore between the given name and a middle initial (FindAGrave's real slug for Clara B Ludwig) is now split into separate words, not stuck together as 'Clara_b'");
assertEqual(slugToName('/memorial/150507526/leo-hirschfeld'), 'Leo Hirschfeld',
    "Regression: a plain all-hyphen slug still works exactly as before");
assertEqual(slugToName('/memorial/1/john_q-public'), 'John Q Public',
    "An underscore anywhere in the slug (not just right after the first word) still splits correctly");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
