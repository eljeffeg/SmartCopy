// Live-reported, Dan Bodenheimer, real FindAGrave page
// (https://www.findagrave.com/memorial/156849664/): after #379's hang fix
// let family imports proceed past the freeze, several family members'
// names were still coming out wrong - a maiden name landing nowhere
// (swallowed into the plain name text) and a quoted nickname ("Tootsie")
// never recognized as a nickname at all, both because the real FindAGrave
// markup doesn't look like what the parsing code assumed.
//
// Two separate root causes, found by fetching the real page:
//
// 1. getFindAGraveName() (collections/findagrave.js) detected a maiden
//    name via focusperson.match("\<i\>(.*)\</i\>") - a plain STRING handed
//    to .match(), coerced to a regex with no "i" flag, so it only ever
//    matched a lowercase <i> tag. FindAGrave's actual markup for Clara B
//    "Tootsie" Ludwig is `Clara B “Tootsie” <I>Hirschfeld</I>
//    Ludwig` - an UPPERCASE <I> tag. The match silently failed, so the
//    maiden name was never tagged with the "(born X)" annotation this
//    code (and the gender-detection line right below it,
//    focusperson.contains("(born") -> genderval = "female") both depend
//    on - "Hirschfeld" just dissolved into plain name text with nothing
//    marking it as a maiden name, and gender inference silently broke too.
//
// 2. NameParse.parse() (parse-names.js)'s nickname detector
//    (testNickStart/testNickEnd and isCompleteNickPart) only recognized
//    plain ASCII quotes (" and '). FindAGrave's real markup wraps a
//    nickname in curly "smart quotes" (“/”), which carried no
//    recognized marker at all - "Tootsie" was left stuck as an ordinary
//    name word instead of being pulled into the nickname field.
//
// Fixed: getFindAGraveName()'s match now uses a real regex literal with
// the "i" flag; NameParse's quote-detection regexes and isCompleteNickPart
// now accept the curly variants (‘/’/“/”) alongside
// the existing straight ones. Extracts the real functions verbatim.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const faSrc = fs.readFileSync(path.join(ROOT, 'collections/findagrave.js'), 'utf8');
const nameParseSrc = fs.readFileSync(path.join(ROOT, 'parse-names.js'), 'utf8');

function exists(v) { return typeof v !== 'undefined' && v !== null; }
if (!String.prototype.contains) {
    String.prototype.contains = function () { return String.prototype.indexOf.apply(this, arguments) !== -1; };
}

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

const getFindAGraveName = new Function('exists',
    extractFunction(faSrc, 'getFindAGraveName') + '\nreturn getFindAGraveName;'
)(exists);

function capFL(s) { return s; }
const NameParse = new Function('exists', '$', 'capFL',
    nameParseSrc + '\nreturn NameParse;'
)(exists, function () { return { prop: function () { return false; } }; }, capFL);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) { assertEqual(!!cond, true, label); }

// --- getFindAGraveName(): FindAGrave's real uppercase <I> maiden-name markup ---
(function () {
    const raw = 'Clara B “Tootsie” <I>Hirschfeld</I> Ludwig  ';
    const result = getFindAGraveName(raw);
    assertTrue(result.indexOf('(born Hirschfeld)') !== -1,
        "getFindAGraveName(): an uppercase <I> maiden-name tag (FindAGrave's real markup) is still recognized and annotated as '(born Hirschfeld)'");
    assertTrue(result.indexOf('<I>') === -1 && result.indexOf('</I>') === -1,
        "getFindAGraveName(): the <I> tags themselves don't leak into the final name text");
})();

// --- Regression: the original lowercase <i> case still works ---
(function () {
    const result = getFindAGraveName('Jane <i>Smith</i> Doe');
    assertTrue(result.indexOf('(born Smith)') !== -1,
        "getFindAGraveName(): regression - a lowercase <i> maiden-name tag still works as before");
})();

// --- getFindAGraveName() feeds genderval detection via "(born" - confirm that still fires ---
(function () {
    const result = getFindAGraveName('Clara B “Tootsie” <I>Hirschfeld</I> Ludwig');
    assertTrue(result.contains('(born'),
        "getFindAGraveName(): the result still contains '(born' - this is what collections/findagrave.js's own genderval detection (focusperson.contains(\"(born\")) depends on to correctly infer female gender");
})();

// --- NameParse.parse(): FindAGrave's real curly-quote nickname markup ---
(function () {
    // The name as it comes out of getFindAGraveName() for Clara's real page.
    var result = NameParse.parse(getFindAGraveName('Clara B “Tootsie” <I>Hirschfeld</I> Ludwig'), true);
    assertEqual(result.firstName, 'Clara', "NameParse: a curly-quoted nickname no longer swallows the real first name");
    assertEqual(result.lastName, 'Ludwig', "NameParse: the real last name is still correctly extracted");
    assertTrue(result.nickName.indexOf('Tootsie') !== -1,
        "NameParse: the curly-quoted nickname 'Tootsie' is now actually recognized as a nickname, not left stuck in the plain name");
    assertEqual(result.birthName, 'Hirschfeld', "NameParse: the maiden name annotation getFindAGraveName() added is still correctly read as the birth/maiden name");
})();

// --- Regression: a plain-ASCII-quoted nickname still works ---
(function () {
    var result = NameParse.parse('John "Captain Black Jack" Geary', true);
    assertEqual(result.firstName, 'John', "NameParse: regression - a straight-ASCII-quoted nickname still works as before");
    assertEqual(result.lastName, 'Geary', "NameParse: regression - last name still correct");
    assertTrue(result.nickName.indexOf('Captain') !== -1, "NameParse: regression - the straight-quoted nickname is still recognized");
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
