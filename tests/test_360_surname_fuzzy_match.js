// Verifies #360: a sibling/child spelling variant of a surname (e.g.
// "Schwarz" vs "Schwartz") can now still match, but ONLY when corroborated
// by an exact given-name word-set match AND an identical birth year on
// both sides - exact surname match alone being required was too strict
// (DanCornett live report: "Bertha SCHWARZ" should have matched Geni's
// "Bertha Berta Schwartz"), but a surname-only fuzzy tolerance would be
// unsafe on its own - many genuinely different German surnames share a
// common prefix (Schmidt/Schwarz both "Sch-"), so this deliberately
// requires the given name AND birth year to already agree before the
// surname spelling is allowed to be approximate. Extracts the real
// functions verbatim from buildform.js - not a reimplementation.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const bfSrc = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');

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
const normalizeGermanic = new Function('return ' + extractFunction(bfSrc, 'normalizeGermanic'))();

function isPartner(r) { return exists(r) && ['spouse', 'wife', 'husband', 'partner', 'ex-husband', 'ex-wife', 'ex-partner'].indexOf(r) !== -1; }
function isChild(r) { return exists(r) && ['children', 'child', 'son', 'daughter', 'dau'].indexOf(r) !== -1; }
function isSibling(r) { return exists(r) && ['siblings', 'sibling', 'brother', 'sister', 'bro', 'sis'].indexOf(r) !== -1; }
function isParent(r) { return exists(r) && ['parents', 'father', 'mother', 'parent', 'moth', 'fath'].indexOf(r) !== -1; }

const getGivenNameWordsSrc = extractFunction(bfSrc, 'getGivenNameWords');
const compareGivenNameWordSetsSrc = extractFunction(bfSrc, 'compareGivenNameWordSets');
const levenshteinDistanceSrc = extractFunction(bfSrc, 'levenshteinDistance');
const isFuzzySurnameMatchSrc = extractFunction(bfSrc, 'isFuzzySurnameMatch');
const findExistingFamilyMatchSrc = extractFunction(bfSrc, 'findExistingFamilyMatch');

const ctx = new Function('exists', 'normalizeGermanic', 'isPartner', 'isChild', 'isSibling', 'isParent', `
    ${getGivenNameWordsSrc}
    ${compareGivenNameWordSetsSrc}
    ${levenshteinDistanceSrc}
    ${isFuzzySurnameMatchSrc}
    ${findExistingFamilyMatchSrc}
    return { levenshteinDistance, isFuzzySurnameMatch, findExistingFamilyMatch };
`)(exists, normalizeGermanic, isPartner, isChild, isSibling, isParent);

function makeCandidate(relation, firstName, middleName, lastName, maidenName, birthYear) {
    var data = {
        relation: relation,
        name_language: 'en-US',
        names: { 'en-US': { first_name: firstName || '', middle_name: middleName || '', last_name: lastName || '', maiden_name: maidenName || '' } },
        birth: { date: { year: birthYear || '' } }
    };
    return {
        get: function (a, b) {
            if (a === 'relation') return data.relation;
            if (a === 'name_language') return data.name_language;
            if (a === 'names') return data.names['en-US'][b.split('.')[1]];
            if (a === 'birth') return b === 'date.year' ? data.birth.date.year : undefined;
            return undefined;
        }
    };
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertNull(actual, label) { assertEqual(actual, null, label); }

function withFamily(family, fn) {
    global.genifamily = true;
    global.genifamilydata = family;
    return fn();
}

// --- levenshteinDistance / isFuzzySurnameMatch unit checks ---
assertEqual(ctx.levenshteinDistance('schwarz', 'schwartz'), 1, "Schwarz -> Schwartz is a single inserted letter");
assertEqual(ctx.levenshteinDistance('schmidt', 'schwarz'), 4, "Schmidt vs Schwarz - genuinely different surnames sharing only the 'Sch-' prefix");
assertEqual(ctx.isFuzzySurnameMatch('schwarz', 'schwartz'), true, "Within tolerance for a 7/8-letter surname - fuzzy match");
assertEqual(ctx.isFuzzySurnameMatch('schmidt', 'schwarz'), false, "Distance 4 on 7-letter surnames - never a fuzzy match, prevents merging unrelated families");
assertEqual(ctx.isFuzzySurnameMatch('lee', 'lew'), false, "Short surnames (under 6 chars) get no fuzzy tolerance at all - too easy to collide with a genuinely different short surname");
assertEqual(ctx.isFuzzySurnameMatch('schwarz', 'schwarz'), false, "Identical strings are an exact match, not a 'fuzzy' one - isFuzzySurnameMatch itself never reports true for equal input");

// --- findExistingFamilyMatch: end-to-end ---

// Scenario 1: the real reported case - exact given name + exact birth year rescues a genuine spelling variant
withFamily({ p1: makeCandidate('brother', 'Heinrich', '', 'Schwartz', '', '1922') }, function () {
    var match = ctx.findExistingFamilyMatch('sibling', 'male', 'Heinrich', '', 'Schwarz', '1922');
    assertEqual(match && match.get('relation'), 'brother', "Heinrich Schwarz (source) matches Geni's Heinrich Schwartz (sibling) - exact given name + matching birth year corroborates the surname spelling variant");
});

// Scenario 2: same spelling variant, but birth years genuinely differ - corroboration fails, no match
withFamily({ p1: makeCandidate('brother', 'Heinrich', '', 'Schwartz', '', '1922') }, function () {
    var match = ctx.findExistingFamilyMatch('sibling', 'male', 'Heinrich', '', 'Schwarz', '1930');
    assertNull(match, "Same spelling variant, but birth years disagree - fuzzy surname tier requires corroboration, declines rather than guessing");
});

// Scenario 3: same spelling variant, but no birth year available on either side - corroboration unavailable, no match
withFamily({ p1: makeCandidate('sister', 'Bertha', '', 'Schwartz', '', '') }, function () {
    var match = ctx.findExistingFamilyMatch('sibling', 'female', 'Bertha', '', 'Schwarz', undefined);
    assertNull(match, "Spelling variant with no birth year on either side - fuzzy tier requires corroboration it can't get, declines (a known, accepted limitation)");
});

// Scenario 4: a genuinely different surname that happens to share a common German prefix - must NOT match even with exact given name + birth year
withFamily({ p1: makeCandidate('brother', 'Heinrich', '', 'Schmidt', '', '1922') }, function () {
    var match = ctx.findExistingFamilyMatch('sibling', 'male', 'Heinrich', '', 'Schwarz', '1922');
    assertNull(match, "Schwarz vs Schmidt - a genuinely different surname, not a spelling variant - never fuzzy-matched regardless of given name/birth year agreement");
});

// Scenario 5: fuzzy surname tier requires the STRONGEST given-name tier (exact), not merely a subset match
withFamily({ p1: makeCandidate('sister', 'Bertha Marie', '', 'Schwartz', '', '1922') }, function () {
    var match = ctx.findExistingFamilyMatch('sibling', 'female', 'Bertha', '', 'Schwarz', '1922');
    assertNull(match, "Given name is only a subset match (missing 'Marie') - fuzzy surname tier declines even with a matching birth year, requires exact given-name tier");
});

// Scenario 6: exact surname match is completely unaffected by this change (baseline regression check)
withFamily({ p1: makeCandidate('son', 'Daniel', 'Ira', 'Smith', '', '1950') }, function () {
    var match = ctx.findExistingFamilyMatch('child', 'male', 'Daniel', 'Ira', 'Smith', '1950');
    assertEqual(match && match.get('relation'), 'son', "An exact surname match still works exactly as before - unaffected by the new fuzzy tier");
});

// Scenario 7: fuzzy surname match also checked against the maiden-name field, same as the exact-match path already does
withFamily({ p1: makeCandidate('sister', 'Ernestine', '', 'Klein', 'Schwartz', '1899') }, function () {
    var match = ctx.findExistingFamilyMatch('sibling', 'female', 'Ernestine', '', 'Schwarz', '1899');
    assertEqual(match && match.get('relation'), 'sister', "Fuzzy surname tolerance checks Geni's maiden_name too, not just last_name - matches a woman recorded under her Geni maiden name");
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
