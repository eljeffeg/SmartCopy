// Verifies #216: FindAGrave's "Memorial has been merged" redirect handler
// (parseFindAGrave in collections/findagrave.js) keys the re-fetched
// person by arg.proid, not arg.profile_id. Two DIFFERENT relation-object
// shapes exist in this same file for conceptually the same "which family
// member is this" descriptor: getFindAGraveFamily() builds
// {title, proid, itemId} (used here), while a separate code path elsewhere
// in the file uses {title, profile_id, itemId}. The original bug: using
// the wrong key name here means arg.proid is always undefined, so every
// merged-memorial redirect writes to databyid[undefined] - silently
// colliding every such person into the same slot and cross-attributing
// one person's data onto another, with no error at all. Extracts the
// real callback logic verbatim.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'collections/findagrave.js'), 'utf8');

function exists(v) { return typeof v !== 'undefined' && v !== null; }

// Extract the exact attribution block verbatim.
const marker = 'if (exists(arg.proid)) {\n                        databyid[arg.proid] = person;\n                        alldata["family"][arg.title].push(person);\n                    }';
const start = src.indexOf(marker);
if (start === -1) throw new Error('merged-memorial attribution block not found - has this code changed shape?');
const blockSrc = src.slice(start, start + marker.length);

function attributeRedirectedPerson(arg, person, databyid, alldata) {
    new Function('exists', 'arg', 'person', 'databyid', 'alldata', blockSrc)(exists, arg, person, databyid, alldata);
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- The real shape getFindAGraveFamily() builds: {title, proid, itemId} ---
let databyid = {};
let alldata = { family: { sibling: [] } };
const relation = { title: 'sibling', proid: 42, itemId: '123' };
const person = { name: 'Jane Doe' };
attributeRedirectedPerson(relation, person, databyid, alldata);
assertEqual(databyid[42], person,
    "#216: a real {title, proid, itemId} relation object correctly attributes the merged-memorial person by its OWN proid, not a shared/undefined slot");
assertEqual(alldata.family.sibling[0], person,
    "The person is also correctly pushed into alldata.family under the relation's own title");

// --- The historical bug scenario: passing the OTHER shape ({profile_id}, used elsewhere in this file) ---
databyid = {};
alldata = { family: { sibling: [] } };
const wrongShapeRelation = { title: 'sibling', profile_id: 99, itemId: '123' };
attributeRedirectedPerson(wrongShapeRelation, person, databyid, alldata);
assertEqual(Object.keys(databyid).length, 0,
    "#216 regression check: a {profile_id} (not {proid}) relation object is correctly recognized as having no usable id here - exists(arg.proid) is false, so nothing gets written under the wrong key. If this ever silently wrote under databyid[undefined] instead, that would be the original bug reproduced.");

// --- The focus-person case: relation is the plain string "" (no proid at all) - must no-op safely ---
databyid = {};
alldata = { family: {} };
attributeRedirectedPerson("", person, databyid, alldata);
assertEqual(Object.keys(databyid).length, 0,
    "The focus person's own merged-memorial redirect (relation === \"\", no family slot to attribute to) safely no-ops instead of throwing on arg.title/arg.proid");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
