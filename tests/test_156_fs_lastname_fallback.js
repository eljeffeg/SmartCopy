// Verifies #156: FamilySearch's lastName fallback (parseFamilySearchJSON in
// collections/familysearchjson.js) only fills focusperson.lastName from the
// nameForms familyPart when the primary parsed name's lastName is blank.
// The original bug: this condition was literally inverted
// (focusperson.lastName !== "" instead of === ""), so the fallback fired
// exactly backwards - clobbering a real, correctly-parsed last name with
// the (often less reliable) nameForms value, while leaving a genuinely
// blank last name unfilled. Extracts the real decision block verbatim.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const fsJsonSrc = fs.readFileSync(path.join(ROOT, 'collections/familysearchjson.js'), 'utf8');
const nameParseSrc = fs.readFileSync(path.join(ROOT, 'parse-names.js'), 'utf8');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;

if (!String.prototype.contains) {
    String.prototype.contains = function () { return String.prototype.indexOf.apply(this, arguments) !== -1; };
}

function exists(v) { return typeof v !== 'undefined' && v !== null; }
global.exists = exists;

// Real NameParse, loaded verbatim - parse-names.js declares it as a plain
// `var NameParse = (function(){...})();` global, no module wrapper. It
// reads jQuery ($) at parse time (an optional "adjust name case" setting
// toggle), so $ must already be a real global before this runs.
const NameParse = new Function(nameParseSrc + '\nreturn NameParse;')();

const startMarker = 'focusperson = NameParse.parse(parsed["data"]["name"], mnameonoff);';
const start = fsJsonSrc.indexOf(startMarker);
if (start === -1) throw new Error('start marker not found - has parseFamilySearchJSON changed shape?');
const endMarker = 'focusperson.middleName = "";\n                }\n            }';
const endIdx = fsJsonSrc.indexOf(endMarker, start);
if (endIdx === -1) throw new Error('end marker not found - has the lastName fallback block changed shape?');
const blockSrc = fsJsonSrc.slice(start, endIdx + endMarker.length);

function resolveLastName(name, familyPart, mnameonoff) {
    return new Function('NameParse', 'mnameonoff', 'parsed', `
        var focusperson;
        ${blockSrc}
        return focusperson;
    `)(NameParse, mnameonoff, { data: { name: name, nameConclusion: { details: { nameForms: [{ familyPart: familyPart }] } } } });
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- The historical bug scenario: a real, non-blank last name must NOT be clobbered ---
const realName = resolveLastName('John Smith', 'VanDerBerg', false);
assertEqual(realName.lastName, 'Smith',
    "#156: a real, non-blank parsed last name is NOT overwritten by the nameForms fallback (the bug: this used to fire backwards and clobber it)");

// --- A genuinely blank last name IS filled from the fallback ---
const blankName = resolveLastName('John', 'Smith', false);
assertEqual(blankName.lastName, 'Smith',
    "A genuinely blank last name IS filled in from the nameForms familyPart fallback");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
