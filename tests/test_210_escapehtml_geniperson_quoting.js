// Verifies #210: the escapeHtml(String(geniValue).replace(/&quot;/g, '"'))
// idiom used throughout buildform.js/content.js/popup.js to safely render
// a GeniPerson field's existing value, and the underlying GeniPerson.get()
// behavior that makes it necessary. Two real, already-happened failure
// modes:
// 1. GeniPerson.get(path) (no subpath) pre-escapes a raw quote to
//    &quot; and, for a non-string field (Geni's "nicknames" can hold more
//    than one value), returns the ARRAY itself, not a joined string.
//    Every call site assumed a string and called .replace() directly -
//    crashing with "X.replace is not a function" the first time a real
//    multi-value nickname array reached it (a live user report, mid a
//    Geneanet deep-dive).
// 2. A value already containing a literal &quot; (from GeniPerson.get()'s
//    own pre-escaping above) must be unescaped back to a real quote
//    BEFORE re-escaping, or a name with a real quote in it renders as
//    visible "&amp;quot;" text instead of a quote character.
// Extracts GeniPerson and escapeHtml verbatim (not reimplementations).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const sharedSrc = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');

function exists(v) { return typeof v !== 'undefined' && v !== null; }

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
function extractVarStatement(src, name) {
    // Brace-counted, not "find the first semicolon" - entityMap's own
    // VALUES are HTML entities like "&amp;" which themselves contain a
    // semicolon, so a naive scan stops mid-object.
    const marker = 'var ' + name + ' =';
    const start = src.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    const braceStart = src.indexOf('{', start);
    let depth = 0, i = braceStart;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    const semi = src.indexOf(';', i);
    return src.slice(start, semi + 1);
}

const entityMapDecl = extractVarStatement(sharedSrc, 'entityMap');
const escapeHtml = new Function(entityMapDecl + '\nreturn ' + extractFunction(sharedSrc, 'escapeHtml'))();

// GeniPerson's photo_urls branch calls checkNested()/geniPhoto() - neither
// is exercised by this test (no test data ever requests "photo_urls"), so
// they're stubbed rather than extracted, same as this repo's own earlier
// jsdom harnesses for this constructor (see the #299 investigation).
const GeniPerson = new Function('exists', 'checkNested', 'geniPhoto', 'return ' + extractFunction(sharedSrc, 'GeniPerson'))(
    exists, function () { return false; }, function () { return ''; }
);

// The real idiom used at ~25 call sites across buildform.js/content.js/
// popup.js, reproduced here as the literal fix commit (a2eb7d8) describes
// it - String()-coerce, then unescape any pre-existing &quot; before
// re-escaping for safe display.
function renderGeniValue(person, field) {
    return escapeHtml(String(person.get(field)).replace(/&quot;/g, '"'));
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertDoesNotThrow(fn, label) {
    try { fn(); pass++; console.log('PASS:', label); }
    catch (e) { fail++; console.log('FAIL:', label, '- threw:', e.message); }
}

// --- Failure mode 1: a multi-value nicknames ARRAY must not crash .replace() ---
const multiNicknamePerson = new GeniPerson({ nicknames: ['Itzig', 'Other Name'] });
assertDoesNotThrow(function () { renderGeniValue(multiNicknamePerson, 'nicknames'); },
    "#210: a multi-value nicknames array does not crash - the original live bug threw 'X.replace is not a function' here");
assertEqual(renderGeniValue(multiNicknamePerson, 'nicknames'), 'Itzig,Other Name',
    "The array renders as a comma-joined string, matching the pre-#210 plain-concatenation behavior, just safely escaped");

// --- A single-value nicknames array (still an array, just length 1) also works ---
const singleArrayPerson = new GeniPerson({ nicknames: ['Itzig'] });
assertEqual(renderGeniValue(singleArrayPerson, 'nicknames'), 'Itzig',
    "A single-element nicknames array renders as just that one name, not 'Itzig,' with a stray trailing comma");

// --- A plain string field (the common case) still works unchanged ---
const stringPerson = new GeniPerson({ nicknames: 'Itzig' });
assertEqual(renderGeniValue(stringPerson, 'nicknames'), 'Itzig',
    "A plain string nicknames value (no array at all) renders unchanged - this fix must not regress the common case");

// --- Failure mode 2: a real quote character must round-trip through GeniPerson's own pre-escaping without double-escaping ---
const quotedNamePerson = new GeniPerson({ nicknames: 'Robert "Bob" Smith' });
assertEqual(renderGeniValue(quotedNamePerson, 'nicknames'), 'Robert &quot;Bob&quot; Smith',
    "#210: a real quote character (which GeniPerson.get() itself pre-escapes to &quot; before returning) ends up escaped exactly ONCE - not visible as literal '&amp;quot;' text (double-escaped) and not a raw unescaped quote either");

// --- An array element containing a quote also round-trips correctly, not just the single-string case ---
const quotedArrayPerson = new GeniPerson({ nicknames: ['Bob "Bobby" Jones', 'Robert'] });
assertEqual(renderGeniValue(quotedArrayPerson, 'nicknames'), 'Bob &quot;Bobby&quot; Jones,Robert',
    "A quoted name INSIDE a multi-value array also escapes exactly once, combining both failure modes in one value");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
