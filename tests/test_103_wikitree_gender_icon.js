// Verifies #103: WikiTree's gender-from-icon detection in parseWikiTree()
// (collections/wikitree.js) checks htmlstring for female.gif vs. male.gif.
// The original bug: both branches literally tested the same string
// ("female.gif" twice), so male-by-icon detection silently never fired -
// every male profile fell through to the weaker "(born ...)" text-based
// fallback or stayed "unknown". Extracts the real decision block verbatim
// (not a reimplementation) so a future copy-paste edit reintroducing the
// same class of bug (two branches checking the same condition) gets
// caught immediately instead of silently miscategorizing gender.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const wtSrc = fs.readFileSync(path.join(ROOT, 'collections/wikitree.js'), 'utf8');

function exists(v) { return typeof v !== 'undefined' && v !== null; }
// shared.js's own polyfill, needed since this test runs standalone (no
// shared.js loaded) but the extracted block uses String.prototype.contains.
if (!String.prototype.contains) {
    String.prototype.contains = function () { return String.prototype.indexOf.apply(this, arguments) !== -1; };
}

// Extract the real decision block verbatim, from its start marker through
// the closing brace of the final `else`.
const startMarker = 'var imageflag = false;';
const start = wtSrc.indexOf(startMarker);
if (start === -1) throw new Error('start marker not found - has parseWikiTree changed shape?');
const endMarker = "focusperson.contains(\"(born\")) {\n            genderval = \"female\";\n        }\n        imageflag = true;\n    }";
const endIdx = wtSrc.indexOf(endMarker, start);
if (endIdx === -1) throw new Error('end marker not found - has the gender-detection block changed shape?');
const blockSrc = wtSrc.slice(start, endIdx + endMarker.length);

function detectGender(htmlstring, relation, focusperson) {
    return new Function('exists', 'htmlstring', 'relation', 'focusperson', `
        ${blockSrc}
        return {genderval: genderval, imageflag: imageflag};
    `)(exists, htmlstring, relation, focusperson);
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- The historical bug scenario: a MALE profile's icon ---
assertEqual(detectGender('<img src="images/icons/male.gif">', '', 'John Smith').genderval, 'male',
    "#103: a male.gif icon is detected as male (the bug: this branch was unreachable, always fell through)");

// --- Female icon still works (was never broken, but must stay correct) ---
assertEqual(detectGender('<img src="images/icons/female.gif">', '', 'Jane Smith').genderval, 'female',
    "A female.gif icon is detected as female");

// --- No icon at all, relation carries a known gender ---
assertEqual(detectGender('<div>no icon here</div>', {gender: 'male'}, 'John Smith').genderval, 'male',
    "No icon present: falls back to relation.gender when known");

// --- No icon, no relation gender, but a '(born ...)' maiden-name marker (focus person only) ---
assertEqual(detectGender('<div>no icon</div>', '', 'Jane Smith (born Doe)').genderval, 'female',
    "No icon, no relation gender: '(born ...)' text on the FOCUS person implies female");

// --- Same '(born ...)' marker on a non-focus relation must NOT trigger (relation !== "") ---
assertEqual(detectGender('<div>no icon</div>', {gender: 'unknown'}, 'Jane Smith (born Doe)').genderval, 'unknown',
    "The '(born ...)' fallback is scoped to the focus person only (relation === \"\") - a family member with the same text stays unknown rather than guessed");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
