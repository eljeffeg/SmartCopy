// Verifies #284: a source explicitly labeling a relationship "Half
// Brother"/"Half Sister"/"Half Sibling" (hyphenated or not) is now
// recognized as a sibling at all - previously isSibling() only matched
// exact "brother"/"sister"/etc., so a half-sibling with this literal
// label fell through to the unrecognized-relationship branch entirely
// rather than being included (and therefore never reached the existing
// halfsibling=true protection that stops them being pre-selected to add,
// since scored gets forced false for a real halfsibling - see buildForm()).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const sharedSrc = fs.readFileSync('' + ROOT + '/shared.js', 'utf8');
const buildformSrc = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');

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

function exists(v) { return v !== undefined && v !== null && v !== ""; }

const isSibling = new Function('exists', 'return ' + extractFunction(sharedSrc, 'isSibling'))(exists);

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

assertTrue(isSibling("Half Brother"), "'Half Brother' is now recognized as a sibling relationship");
assertTrue(isSibling("Half Sister"), "'Half Sister' is now recognized as a sibling relationship");
assertTrue(isSibling("Half-Brother"), "Hyphenated 'Half-Brother' is also recognized");
assertTrue(isSibling("Half-Sister"), "Hyphenated 'Half-Sister' is also recognized");
assertTrue(isSibling("half sibling"), "Lowercase 'half sibling' is recognized");
assertTrue(isSibling("Half Siblings"), "Plural 'Half Siblings' is recognized");

// #304 follow-up (live-reported, DanCornett - a tree copy with "some
// siblings and step siblings" silently failed to create a few of them,
// with a flashed "no first/last name" error): familysearchjson.js and
// ancestrynew.js both use the single concatenated word "halfsibling" (no
// space or hyphen at all) as the relationship/grouping key itself -
// confirmed directly in both files - which never matched any of the
// spaced/hyphenated forms above, so every FamilySearch or Ancestry
// half-sibling (or step-sibling - FamilySearch's own data has no
// separate "step" concept here, a different second parent reads as
// "half" either way) fell through to the "Unknown" relationship bucket
// instead, where the top-level checkbox is disabled pending a manual
// relationship pick that a bulk "add everything" action never performs.
assertTrue(isSibling("halfsibling"), "#304: the literal concatenated 'halfsibling' (no space/hyphen) - familysearchjson.js's and ancestrynew.js's own internal relationship key - is now recognized too");
assertTrue(isSibling("HalfSibling"), "#304: works regardless of case, matching ancestrynew.js's own 'halfsibling' title casing");
assertTrue(isSibling("halfsiblings"), "#304: plural concatenated form is recognized too");

// Regression: every existing label this function already matched still works.
["Brother", "Sister", "Sibling", "Siblings", "Bro", "Sis"].forEach(function (label) {
    assertTrue(isSibling(label), "Regression: '" + label + "' still recognized");
});
assertTrue(!isSibling("Cousin"), "Regression: an unrelated relationship label is still correctly rejected");

// The buildForm() inference: alldata["family"] groups members by their
// exact original relationship label as the object key - a "Half Brother"
// key should mark every member under it as halfsibling=true (unless a
// parser already set it explicitly).
const familyLoopBody = extractFunction(buildformSrc, 'buildForm');
assertTrue(familyLoopBody.indexOf('/half/i.test(relationship)') !== -1,
    "buildForm() infers halfsibling=true from a relationship key containing 'half'");
assertTrue(familyLoopBody.indexOf('if (!exists(members[halfSiblingMember].halfsibling))') !== -1,
    "The inference only fills in halfsibling when a parser hasn't already set it explicitly");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
