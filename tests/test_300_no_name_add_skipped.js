// Verifies #300 (live-reported, GuyKh/DanCornett): a brand-new "add"
// family-member/parent/sibling/partner profile could reach buildTree()
// and get submitted to Geni with no name field checked at all (e.g. only
// Privacy or Vital status ended up selected), creating an empty, unusable
// "(No Name)" profile on Geni. buildTree()'s only prior guard was
// !$.isEmptyObject(data) - true even for {public: true} alone. Extracts
// the real hasRealName check verbatim from popup.js and exercises it
// against representative "some fields selected but no name" cases
// (matching GuyKh's report that this happens "even in cases where you
// select some or all the fields").
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const popupSrc = fs.readFileSync('' + ROOT + '/popup.js', 'utf8');

function exists(v) { return typeof v !== "undefined" && v !== null; }

const marker = "// #300 (live-reported)";
const start = popupSrc.indexOf(marker);
if (start === -1) throw new Error('#300 guard comment not found in popup.js');
const blockStart = popupSrc.indexOf('var hasRealName', start);
const blockEnd = popupSrc.indexOf('if (!hasRealName)', blockStart);
const hasRealNameSrc = popupSrc.slice(blockStart, blockEnd);

function computeHasRealName(data) {
    return new Function('exists', 'data', hasRealNameSrc + '\nreturn hasRealName;')(exists, data);
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// Dan's theory: only Privacy checked, nothing else - no `names` key at all.
assertEqual(computeHasRealName({ public: "true" }), false,
    "Privacy-only submission (no names object at all) is rejected");

// GuyKh's broader report: several non-name fields selected, still no name.
assertEqual(computeHasRealName({ public: "true", gender: "male", is_alive: "false" }), false,
    "Several non-name fields selected (gender, vital status, privacy) but still no name is rejected");

// A `names` object exists but every field inside is blank (e.g. a Title-only row with empty value).
assertEqual(computeHasRealName({ names: { "en-US": { title: "" } } }), false,
    "A names object present but with only a blank field is still rejected");

// A real first name alone is enough.
assertEqual(computeHasRealName({ names: { "en-US": { first_name: "John" } }, gender: "male" }), true,
    "A real first name (plus other fields) is accepted");

// A real last name alone is enough.
assertEqual(computeHasRealName({ names: { "en-US": { last_name: "Smith" } } }), true,
    "A real last name alone is accepted");

// A real maiden name or display name alone is also enough.
assertEqual(computeHasRealName({ names: { "en-US": { maiden_name: "Jones" } } }), true,
    "A real maiden name alone is accepted");
assertEqual(computeHasRealName({ names: { "en-US": { display_name: "J. Smith" } } }), true,
    "A real display name alone is accepted");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
