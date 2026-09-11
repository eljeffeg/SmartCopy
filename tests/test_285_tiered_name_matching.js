// Verifies #285 (expanded per discussion with the user): given-name
// matching for sibling/partner/child dedup now handles a shifted First/
// Middle field boundary and reordered given names (Tier "exact" word-set
// match), and a source missing a middle name entirely (Tier "subset"),
// plus birth year acting as BOTH the existing single-match veto AND a
// new tie-breaking rescue when multiple candidates tie at the best name
// tier. Extracts the real functions verbatim from buildform.js - not a
// reimplementation.
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
// normalizeGermanic is a real buildform.js helper - extract it verbatim
// too so accented names are exercised exactly as production does.
const normalizeGermanic = new Function('return ' + extractFunction(bfSrc, 'normalizeGermanic'))();

function isPartner(r) { return exists(r) && ['spouse', 'wife', 'husband', 'partner', 'ex-husband', 'ex-wife', 'ex-partner'].indexOf(r) !== -1; }
function isChild(r) { return exists(r) && ['children', 'child', 'son', 'daughter', 'dau'].indexOf(r) !== -1; }
function isSibling(r) { return exists(r) && ['siblings', 'sibling', 'brother', 'sister', 'bro', 'sis'].indexOf(r) !== -1; }
function isParent(r) { return exists(r) && ['parents', 'father', 'mother', 'parent', 'moth', 'fath'].indexOf(r) !== -1; }

const getGivenNameWordsSrc = extractFunction(bfSrc, 'getGivenNameWords');
const compareGivenNameWordSetsSrc = extractFunction(bfSrc, 'compareGivenNameWordSets');
const findExistingFamilyMatchSrc = extractFunction(bfSrc, 'findExistingFamilyMatch');

const ctx = new Function('exists', 'normalizeGermanic', 'isPartner', 'isChild', 'isSibling', 'isParent', `
    ${getGivenNameWordsSrc}
    ${compareGivenNameWordSetsSrc}
    ${findExistingFamilyMatchSrc}
    return { getGivenNameWords, compareGivenNameWordSets, findExistingFamilyMatch };
`)(exists, normalizeGermanic, isPartner, isChild, isSibling, isParent);

// Minimal fake GeniPerson - just enough for findExistingFamilyMatch's own
// .get() calls (relation, name_language, names.*, birth.date.year).
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

// --- compareGivenNameWordSets unit checks ---
assertEqual(ctx.compareGivenNameWordSets(['daniel', 'ira'], ['daniel', 'ira']), 'exact', "Same words, same order - exact");
assertEqual(ctx.compareGivenNameWordSets(['max', 'rudolph'], ['rudolph', 'max']), 'exact', "Same words, reversed order - still exact (the reported bug)");
assertEqual(ctx.compareGivenNameWordSets(['max'], ['rudolph', 'max']), 'subset', "Source missing middle name entirely - subset");
assertEqual(ctx.compareGivenNameWordSets(['rudolph'], ['rudolph', 'max']), 'subset', "Subset works regardless of WHICH word is missing, not just the first");
assertEqual(ctx.compareGivenNameWordSets(['mary'], ['john']), null, "Genuinely different single-word names - null, not a false subset");
assertEqual(ctx.compareGivenNameWordSets(['mary', 'ann'], ['mary', 'jane']), null, "Same length, one differing word - null (never loosely 'subset' at equal length)");
assertEqual(ctx.compareGivenNameWordSets([], ['max']), null, "Blank side never matches anything");

// --- getGivenNameWords: the actual field-boundary-shift fix ---
assertEqual(JSON.stringify(ctx.getGivenNameWords('Daniel', 'Ira')), JSON.stringify(['daniel', 'ira']), "Source: first+middle combine into one word list");
assertEqual(JSON.stringify(ctx.getGivenNameWords('Daniel Ira', '')), JSON.stringify(['daniel', 'ira']), "Geni: compound first_name with blank middle_name produces the SAME word list");

// --- findExistingFamilyMatch: end-to-end, real reported scenarios ---

// Scenario 1: Geni's compound "Daniel Ira" vs source's split Daniel/Ira - the original report
withFamily({ p1: makeCandidate('son', 'Daniel Ira', '', 'Smith', '', '1950') }, function () {
    var match = ctx.findExistingFamilyMatch('child', 'male', 'Daniel', 'Ira', 'Smith', '1950');
    assertEqual(match && match.get('relation'), 'son', "Daniel Ira (Geni, compound) matches Daniel/Ira (source, split) - Tier 1 exact word-set");
});

// Scenario 2: reversed order between Geni and source
withFamily({ p1: makeCandidate('daughter', 'Max Rudolph', '', 'Klein', '', '1900') }, function () {
    var match = ctx.findExistingFamilyMatch('child', 'female', 'Rudolph', 'Max', 'Klein', '1900');
    assertEqual(match && match.get('relation'), 'daughter', "Geni 'Max Rudolph' matches source Rudolph/Max (reversed) - still exact tier");
});

// Scenario 3: source has no middle name at all - subset tier
withFamily({ p1: makeCandidate('brother', 'Rudolph', 'Max', 'Klein', '', '1900') }, function () {
    var match = ctx.findExistingFamilyMatch('sibling', 'male', 'Rudolph', '', 'Klein', '1900');
    assertEqual(match && match.get('relation'), 'brother', "Source has only 'Rudolph' (no middle field at all) - matches Geni's Rudolph Max via subset tier");
});

// Scenario 4: ambiguity - two candidates tie at subset tier, no birth year to break it - decline
withFamily({
    p1: makeCandidate('sister', 'Mary', 'Martha', 'Doe', '', ''),
    p2: makeCandidate('sister', 'Mary', 'Magdalene', 'Doe', '', '')
}, function () {
    var match = ctx.findExistingFamilyMatch('sibling', 'female', 'Mary', '', 'Doe', undefined);
    assertNull(match, "'Mary' alone matches BOTH Mary Martha and Mary Magdalene at subset tier with no birth year - declines rather than guessing");
});

// Scenario 5: same ambiguity, but birth year uniquely rescues it (NEW behavior)
withFamily({
    p1: makeCandidate('sister', 'Mary', 'Martha', 'Doe', '', '1920'),
    p2: makeCandidate('sister', 'Mary', 'Magdalene', 'Doe', '', '1955')
}, function () {
    var match = ctx.findExistingFamilyMatch('sibling', 'female', 'Mary', '', 'Doe', '1921');
    assertEqual(match && match.get('birth', 'date.year'), '1920', "Birth year (1921, within tolerance of 1920 only) uniquely breaks the Mary/Mary tie - NEW rescue behavior");
});

// Scenario 6: same ambiguity, birth year within tolerance of BOTH - still decline
withFamily({
    p1: makeCandidate('sister', 'Mary', 'Martha', 'Doe', '', '1920'),
    p2: makeCandidate('sister', 'Mary', 'Magdalene', 'Doe', '', '1921')
}, function () {
    var match = ctx.findExistingFamilyMatch('sibling', 'female', 'Mary', '', 'Doe', '1920');
    assertNull(match, "Birth year within tolerance of BOTH tied candidates - still declines, doesn't guess");
});

// Scenario 7: exact tier still wins over subset tier when both exist, not merged into one ambiguous pool
withFamily({
    p1: makeCandidate('son', 'Daniel Ira', '', 'Smith', '', ''),
    p2: makeCandidate('son', 'Daniel', '', 'Smith', '', '')
}, function () {
    var match = ctx.findExistingFamilyMatch('child', 'male', 'Daniel', 'Ira', 'Smith', undefined);
    assertEqual(match && match.get('names', 'en-US.first_name'), 'Daniel Ira', "Exact tier (Daniel Ira) wins outright over a separate subset-tier candidate (Daniel alone) - not pooled together as a tie");
});

// Scenario 8: existing single-exact-match birth-year VETO still works unchanged
withFamily({ p1: makeCandidate('son', 'Daniel', 'Ira', 'Smith', '', '1950') }, function () {
    var match = ctx.findExistingFamilyMatch('child', 'male', 'Daniel', 'Ira', 'Smith', '1990');
    assertNull(match, "A unique exact match is still vetoed by a real, conflicting birth year (unchanged baseline behavior)");
});

// Scenario 9: father/mother remain untouched (scope decision - siblings/partners/children only)
withFamily({ p1: makeCandidate('father', 'John', '', 'Smith', '', '1900') }, function () {
    var match = ctx.findExistingFamilyMatch('parent', 'male', 'John', '', 'Smith', '1900');
    assertNull(match, "Father/mother are still excluded entirely from findExistingFamilyMatch, per the agreed scope");
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
