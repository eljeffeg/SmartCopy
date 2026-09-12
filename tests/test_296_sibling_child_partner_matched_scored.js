// Verifies #296 follow-up (live-reported, DanCornett, with real page
// source and screenshots against the Barbara C Kenney 1950 census
// record): a sibling/child/partner already confidently matched to an
// existing Geni person - via findExistingFamilyMatch(), the same
// name+birth-year match buildAction() uses to resolve the Action
// dropdown to "Update: <name>" - now scores true, so genuinely new field
// data (a Vital status that differs, a Privacy value that differs, a
// Photo/About the source has and Geni doesn't) becomes eligible for
// pre-checking. Before this fix, these three categories had NO path from
// false to true on a confirmed match at all - only an empty category or
// an actual MyHeritage SmartMatch relevance signal (scorefactors) could
// ever set scored=true, so a census-derived sibling like "Peter Kenney"
// (Geni already has 3 siblings; a census household listing has no
// per-relationship SmartMatch signal at all) stayed scored=false for
// its ENTIRE row - Vital/Privacy/Photo/About all shown unchecked and
// disabled even though several of them plainly differ from Geni.
//
// Also verifies this new match-based override does NOT fire when the
// user's own "exclude private profile auto-select" setting (skipprivate)
// already suppressed this member - that's a privacy safeguard, not an
// uncertainty heuristic a confirmed match should be allowed to override.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

function exists(v) { return v !== undefined && v !== null; }

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

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

// --- Structural: the fix no longer gates on an already-true `scored`, and sets true (not false) on a match ---
assertTrue(src.indexOf('if (!(skipprivate && (checkLiving(fullname) || hasPlaceholderIdentityName(fullname))) &&\n                (isSibling(relationship) || isChild(relationship) || isPartner(relationship))) {') !== -1,
    "The match-check now runs regardless of scored's starting value (no more 'if (scored && ...)' gate), and skips the privacy-suppressed case");
assertTrue(src.indexOf('if (findExistingFamilyMatch(relationship, gender, nameval.firstName, nameval.middleName, (nameval.lastName || nameval.birthName), earlyBirthYear)) {\n                    scored = true;\n                }') !== -1,
    "On a confirmed match, scored is now set to TRUE (was: forced to false)");

// --- Behavioral: real findExistingFamilyMatch() + real genifamilydata, Peter's exact scenario ---
function isPartner(r) { return exists(r) && ['spouse', 'wife', 'husband', 'partner', 'ex-husband', 'ex-wife', 'ex-partner'].indexOf(r) !== -1; }
function isChild(r) { return exists(r) && ['children', 'child', 'son', 'daughter', 'dau'].indexOf(r) !== -1; }
function isSibling(r) { return exists(r) && ['siblings', 'sibling', 'brother', 'sister', 'bro', 'sis'].indexOf(r) !== -1; }
function isParent(r) { return exists(r) && ['parents', 'father', 'mother', 'parent', 'moth', 'fath'].indexOf(r) !== -1; }
const normalizeGermanic = new Function('return ' + extractFunction(src, 'normalizeGermanic'))();
const getGivenNameWords = new Function('return ' + extractFunction(src, 'getGivenNameWords').replace(/normalizeGermanic/g, '(' + normalizeGermanic.toString() + ')'))();
const compareGivenNameWordSets = new Function('return ' + extractFunction(src, 'compareGivenNameWordSets'))();
const checkLiving = new Function('return ' + extractFunction(src, 'checkLiving'))();
const hasPlaceholderIdentityName = new Function('return ' + extractFunction(src, 'hasPlaceholderIdentityName'))();

function makeFindExistingFamilyMatch() {
    const body = extractFunction(src, 'findExistingFamilyMatch');
    return new Function('exists', 'isParent', 'isSibling', 'isChild', 'isPartner', 'normalizeGermanic', 'getGivenNameWords', 'compareGivenNameWordSets', 'genifamily', 'genifamilydata',
        'return ' + body
    )(exists, isParent, isSibling, isChild, isPartner, normalizeGermanic, getGivenNameWords, compareGivenNameWordSets, true, global.genifamilydata);
}

function makeCandidate(relation, firstName, lastName, birthYear) {
    return {
        get: function (a, b) {
            if (a === 'relation') return relation;
            if (a === 'name_language') return 'en-US';
            if (a === 'names') return { first_name: firstName, middle_name: '', last_name: lastName, maiden_name: '' }[b.split('.')[1]];
            if (a === 'birth') return b === 'date.year' ? birthYear : undefined;
            return undefined;
        }
    };
}

// Mirrors the real per-member decision snippet verbatim (halfsibling ->
// skipprivate -> the new match-based override), driven by the real
// findExistingFamilyMatch().
function computeScored(opts) {
    global.genifamilydata = opts.genifamilydata || {};
    const findExistingFamilyMatch = makeFindExistingFamilyMatch();
    var scored = opts.startingScored;
    var relationship = opts.relationship;
    var fullname = opts.fullname;
    var skipprivate = opts.skipprivate || false;
    if (isSibling(relationship) && opts.halfsibling) {
        scored = false;
    }
    if (skipprivate && (checkLiving(fullname) || hasPlaceholderIdentityName(fullname))) {
        scored = false;
    }
    if (!(skipprivate && (checkLiving(fullname) || hasPlaceholderIdentityName(fullname))) &&
        (isSibling(relationship) || isChild(relationship) || isPartner(relationship))) {
        if (findExistingFamilyMatch(relationship, opts.gender, opts.firstName, opts.middleName || '', opts.lastName, opts.birthYear)) {
            scored = true;
        }
    }
    return scored;
}

// Peter Kenney: Geni already has 3 siblings (so sibcheck=false), no
// scorefactor signal for a plain census page (startingScored=false), but
// he confidently matches an existing Geni sibling by name+birth year.
assertEqual(computeScored({
    startingScored: false, relationship: 'sibling', fullname: 'Peter Kenney', gender: 'male',
    firstName: 'Peter', lastName: 'Kenney', birthYear: '1949',
    genifamilydata: { p: makeCandidate('brother', 'Peter', 'Kenney', '1949') }
}), true, "#296: Peter Kenney (matched sibling, no scorefactor signal) now scores true - was stuck false with no way to become eligible");

// A sibling with NO existing Geni match at all stays false (nothing confirmed to make it safe).
assertEqual(computeScored({
    startingScored: false, relationship: 'sibling', fullname: 'Someone Else', gender: 'male',
    firstName: 'Someone', lastName: 'Else', birthYear: '1930',
    genifamilydata: { p: makeCandidate('brother', 'Peter', 'Kenney', '1949') }
}), false, "A sibling with no matching Geni candidate at all stays unscored - nothing confirmed to justify pre-checking");

// Half-sibling caution: the halfsibling flag alone still suppresses (unchanged baseline)...
assertEqual(computeScored({
    startingScored: true, relationship: 'sibling', fullname: 'Someone Else', gender: 'male',
    firstName: 'Someone', lastName: 'Else', birthYear: '1930', halfsibling: true,
    genifamilydata: {}
}), false, "An unmatched half-sibling with no confirmed Geni match still stays unscored (unchanged baseline caution)");
// ...but a half-sibling that IS confidently matched to an existing Geni person is safe to override, same as the base case.
assertEqual(computeScored({
    startingScored: true, relationship: 'sibling', fullname: 'Peter Kenney', gender: 'male',
    firstName: 'Peter', lastName: 'Kenney', birthYear: '1949', halfsibling: true,
    genifamilydata: { p: makeCandidate('brother', 'Peter', 'Kenney', '1949') }
}), true, "A half-sibling caution IS correctly overridden once confidently matched - the uncertainty was about identity, already resolved by the match");

// Privacy safeguard: skipprivate + a living/placeholder name must NOT be overridden by a confirmed match.
assertEqual(computeScored({
    startingScored: true, relationship: 'sibling', fullname: 'Living Kenney', gender: 'male',
    firstName: 'Living', lastName: 'Kenney', birthYear: '1949', skipprivate: true,
    genifamilydata: { p: makeCandidate('brother', 'Living', 'Kenney', '1949') }
}), false, "#296 follow-up guard: the user's own privacy-skip setting is NOT overridden by a confirmed match, unlike the halfsibling caution");

// Child and partner categories get the identical fix, not just sibling.
assertEqual(computeScored({
    startingScored: false, relationship: 'child', fullname: 'Donald Motta', gender: 'male',
    firstName: 'Donald', lastName: 'Motta', birthYear: '1940',
    genifamilydata: { p: makeCandidate('son', 'Donald', 'Motta', '1940') }
}), true, "A matched child scores true too, not just siblings");
assertEqual(computeScored({
    startingScored: false, relationship: 'partner', fullname: 'Manuel Motta', gender: 'male',
    firstName: 'Manuel', lastName: 'Motta', birthYear: '1911',
    genifamilydata: { p: makeCandidate('husband', 'Manuel', 'Motta', '1911') }
}), true, "A matched partner/spouse scores true too");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
