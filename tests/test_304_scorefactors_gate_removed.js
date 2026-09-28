// Verifies #304 (tracking issue #316, cases A and B): scorefactors -
// MyHeritage's own SmartMatch "value add" relevance signal, scraped from
// .value_add_score_factors_container (collections/smartmatch.js) - is
// populated ONLY when parsing an actual MyHeritage SmartMatch comparison
// page. Every other source (FamilySearch, WikiTree, a plain MyHeritage
// census/record page, ...) always carries it forward as "", so any gate
// requiring scorefactors.contains(...) as its ONLY path to eligibility was
// a near-permanent miss for the vast majority of real usage - the same
// shape of bug already fixed for Photo/Occupation/About (#296).
//
// Case A: the focus profile's date and place fields were still gated on
// scorefactors.contains(title + " date"/" place") even though every
// downstream isChecked()/isEnabled() call already independently compares
// against Geni's real value (sameAsGeni) - the gate could only ever
// suppress a safe pre-selection, never protect anything the comparison
// doesn't already.
//
// Case B: a sibling/child/partner candidate had exactly three paths to
// scored=true - an empty category, an actual scorefactors signal, or (per
// #296) a confirmed Geni match. A genuinely NEW, unmatched candidate in a
// category Geni already has some of (so the empty-category path doesn't
// fire) had no path at all on a non-MyHeritage-SmartMatch source, even
// though it's provably safe (nothing on Geni to conflict with - the same
// reasoning the empty-category path already relies on). Fixed by adding an
// "unmatched, not a half-sibling" fallback alongside the existing
// confirmed-match branch - deliberately excluding half-siblings, since that
// caution is about relationship confidence (is this really a relative),
// not match confidence (does this profile already exist on Geni), and
// should stay opt-in unless a confirmed match independently backs it up.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');
const moment = require(path.join(ROOT, 'moment.js'));

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
function extractArrayStatement(src, name) {
    const marker = 'var ' + name + ' =';
    const start = src.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    const semi = src.indexOf(';', start);
    return src.slice(start, semi + 1);
}

function exists(v) { return typeof v !== 'undefined' && v !== null; }
function isValue(v) { return v !== ''; }
const DATE_QUALIFIER_PATTERN = /^(circa|about|after|before)\s+(the\s+)?/i;

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- Structural: both gates are gone ---
assertTrue(!/if \(scorefactors\.contains\(title \+ " date"\)\)/.test(bfSrc),
    "The focus date field's executable scorefactors.contains(title + \" date\") gate is gone (a comment may still mention the old behavior for context)");
assertTrue(!/if \(scorefactors\.contains\(title \+ " place"\)\)/.test(bfSrc),
    "The focus location field's executable scorefactors.contains(title + \" place\") gate is gone");
assertTrue(bfSrc.indexOf('} else if (!halfsibling) {') !== -1,
    "The sibling/child/partner match-check now has an unmatched, non-halfsibling fallback");

// --- Case A behavioral: real isCheckedDateField()/isEnabledDateField()/isChecked() + valuesAreEquivalent(), scored always true now ---
const dateSpecificitySrc = extractArrayStatement(popupSrc, 'DATE_SPECIFICITY_FORMATS') + '\n' +
    extractFunction(popupSrc, 'getDateSpecificity') + '\n' + extractFunction(popupSrc, 'isDateSpecificityDowngrade');
const ctx1 = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN',
    dateSpecificitySrc + '\nreturn { getDateSpecificity, isDateSpecificityDowngrade };')(exists, moment, DATE_QUALIFIER_PATTERN);
const isDateSpecificityDowngrade = ctx1.isDateSpecificityDowngrade;

const datesAreEquivalentSrc = extractArrayStatement(popupSrc, 'DATE_PARSE_FORMATS') + '\n' + extractFunction(popupSrc, 'datesAreEquivalent');
const datesAreEquivalent = new Function('exists', 'moment', 'DATE_QUALIFIER_PATTERN', datesAreEquivalentSrc + '\nreturn datesAreEquivalent;')(exists, moment, DATE_QUALIFIER_PATTERN);

const resolveFieldEnabled = new Function('isValue', 'exists', 'return ' + extractFunction(bfSrc, 'resolveFieldEnabled'))(isValue, exists);
const isChecked = new Function('resolveFieldEnabled', 'return ' + extractFunction(bfSrc, 'isChecked'))(resolveFieldEnabled);
const isEnabled = new Function('resolveFieldEnabled', 'return ' + extractFunction(bfSrc, 'isEnabled'))(resolveFieldEnabled);
const valuesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'valuesAreEquivalent'))();
const nicknamesAreEquivalent = new Function('return ' + extractFunction(bfSrc, 'nicknamesAreEquivalent'))();
const normalizeAboutForComparisonSrc = extractFunction(popupSrc, 'normalizeAboutForComparison');
const isAboutContentPresent = new Function('exists', normalizeAboutForComparisonSrc + '\n' + extractFunction(popupSrc, 'isAboutContentPresent') + '\nreturn isAboutContentPresent;')(exists);
const valuesAreEquivalentForFieldType = new Function('datesAreEquivalent', 'nicknamesAreEquivalent', 'valuesAreEquivalent', 'isAboutContentPresent', 'isDateSpecificityDowngrade',
    'return ' + extractFunction(bfSrc, 'valuesAreEquivalentForFieldType'))(datesAreEquivalent, nicknamesAreEquivalent, valuesAreEquivalent, isAboutContentPresent, isDateSpecificityDowngrade);
const isFieldSelectable = new Function('isValue', 'valuesAreEquivalentForFieldType',
    'return ' + extractFunction(bfSrc, 'isFieldSelectable'))(isValue, valuesAreEquivalentForFieldType);
const isCheckedDateField = new Function('exists', 'isValue', 'isChecked', 'isFieldSelectable',
    'return ' + extractFunction(bfSrc, 'isCheckedDateField'))(exists, isValue, isChecked, isFieldSelectable);
const isEnabledDateField = new Function('exists', 'isValue', 'isEnabled', 'isFieldSelectable',
    'return ' + extractFunction(bfSrc, 'isEnabledDateField'))(exists, isValue, isEnabled, isFieldSelectable);

const scored = true; // matches the real fixed code exactly - no scorefactors dependency for dates/places

assertEqual(isCheckedDateField('12 March 1901', scored, '', false), 'checked',
    "A real FamilySearch birth date now pre-checks with an empty scorefactors (Geni has nothing yet) - previously stuck unchecked forever on a non-MyHeritage-SmartMatch source");
assertEqual(isCheckedDateField('12 March 1901', scored, '15 March 1901', false), 'checked',
    "A genuinely different date still pre-checks against a real Geni value, unaffected by removing the gate");
assertEqual(isCheckedDateField('12 March 1901', scored, '12 March 1901', false), '',
    "An identical date still correctly stays unchecked via the existing sameAsGeni comparison - the gate's removal doesn't disable this protection");
assertEqual(isCheckedDateField('', scored, 'Geni already has this', false), '',
    "A blank scraped date still never pre-checks, regardless of scored");

assertEqual(isChecked('Springfield', scored, false, ''), 'checked',
    "A real FamilySearch place now pre-checks with an empty scorefactors, same reasoning as dates");
assertEqual(isChecked('Springfield', scored, false, 'Springfield', false,
    isValue('Springfield') && isValue('Springfield') && valuesAreEquivalent('Springfield', 'Springfield')), '',
    "A place identical to Geni's still correctly stays unchecked via the real call site's own sameAsGeni computation");
assertEqual(isChecked('Springfield', scored, false, 'Chicago', false,
    isValue('Springfield') && isValue('Chicago') && valuesAreEquivalent('Springfield', 'Chicago')), 'checked',
    "A genuinely different place still pre-checks");

// --- Case B behavioral: real findExistingFamilyMatch() + real genifamilydata, mirroring the actual per-member snippet ---
function isPartner(r) { return exists(r) && ['spouse', 'wife', 'husband', 'partner', 'ex-husband', 'ex-wife', 'ex-partner'].indexOf(r) !== -1; }
function isChild(r) { return exists(r) && ['children', 'child', 'son', 'daughter', 'dau'].indexOf(r) !== -1; }
function isSibling(r) { return exists(r) && ['siblings', 'sibling', 'brother', 'sister', 'bro', 'sis'].indexOf(r) !== -1; }
function isParent(r) { return exists(r) && ['parents', 'father', 'mother', 'parent', 'moth', 'fath'].indexOf(r) !== -1; }
const normalizeGermanic = new Function('return ' + extractFunction(bfSrc, 'normalizeGermanic'))();
const getGivenNameWords = new Function('return ' + extractFunction(bfSrc, 'getGivenNameWords').replace(/normalizeGermanic/g, '(' + normalizeGermanic.toString() + ')'))();
const compareGivenNameWordSets = new Function('return ' + extractFunction(bfSrc, 'compareGivenNameWordSets'))();
const checkLiving = new Function('return ' + extractFunction(bfSrc, 'checkLiving'))();
const hasPlaceholderIdentityName = new Function('return ' + extractFunction(bfSrc, 'hasPlaceholderIdentityName'))();

function makeFindExistingFamilyMatch() {
    const body = extractFunction(bfSrc, 'findExistingFamilyMatch');
    return new Function('exists', 'isParent', 'isSibling', 'isChild', 'isPartner', 'normalizeGermanic', 'getGivenNameWords', 'compareGivenNameWordSets', 'genifamily', 'genifamilydata',
        'return ' + body
    )(exists, isParent, isSibling, isChild, isPartner, normalizeGermanic, getGivenNameWords, compareGivenNameWordSets, true, global.genifamilydata);
}

// Mirrors the real per-member decision snippet verbatim, including the new
// unmatched/non-halfsibling fallback.
function computeScored(opts) {
    global.genifamilydata = opts.genifamilydata || {};
    const findExistingFamilyMatch = makeFindExistingFamilyMatch();
    var localScored = opts.startingScored;
    var relationship = opts.relationship;
    var fullname = opts.fullname;
    var skipprivate = opts.skipprivate || false;
    var halfsibling = false;
    if (isSibling(relationship) && opts.halfsibling) {
        localScored = false;
        halfsibling = true;
    }
    if (skipprivate && (checkLiving(fullname) || hasPlaceholderIdentityName(fullname))) {
        localScored = false;
    }
    if (!(skipprivate && (checkLiving(fullname) || hasPlaceholderIdentityName(fullname))) &&
        (isSibling(relationship) || isChild(relationship) || isPartner(relationship))) {
        if (findExistingFamilyMatch(relationship, opts.gender, opts.firstName, opts.middleName || '', opts.lastName, opts.birthYear)) {
            localScored = true;
        } else if (!halfsibling) {
            localScored = true;
        }
    }
    return localScored;
}

// A brand-new sibling with NO existing Geni match at all - Geni already has
// 3 siblings (non-empty category, so the empty-category path doesn't fire),
// no scorefactors signal (plain census page). Previously stuck false for
// the entire row; now correctly becomes eligible since there's nothing on
// Geni to conflict with.
assertEqual(computeScored({
    startingScored: false, relationship: 'sibling', fullname: 'Someone New', gender: 'male',
    firstName: 'Someone', lastName: 'New', birthYear: '1930',
    genifamilydata: { p: { get: function (a, b) {
        if (a === 'relation') return 'brother';
        if (a === 'name_language') return 'en-US';
        if (a === 'names') return { first_name: 'Peter', middle_name: '', last_name: 'Kenney', maiden_name: '' }[b.split('.')[1]];
        if (a === 'birth') return b === 'date.year' ? '1949' : undefined;
        return undefined;
    } } }
}), true, "#304 case B: a genuinely new, unmatched sibling in a non-empty category now scores true");

// Same scenario, but flagged as a half-sibling - caution about the
// relationship itself must NOT be overridden just because the candidate is
// unmatched (that's the opposite of confirmation).
assertEqual(computeScored({
    startingScored: false, relationship: 'sibling', fullname: 'Someone New', gender: 'male',
    firstName: 'Someone', lastName: 'New', birthYear: '1930', halfsibling: true,
    genifamilydata: {}
}), false, "#304 case B: an unmatched half-sibling still stays unscored - relationship-confidence caution is untouched by this fix");

// A half-sibling that IS confidently matched is still safe (unchanged from #296).
assertEqual(computeScored({
    startingScored: false, relationship: 'sibling', fullname: 'Peter Kenney', gender: 'male',
    firstName: 'Peter', lastName: 'Kenney', birthYear: '1949', halfsibling: true,
    genifamilydata: { p: { get: function (a, b) {
        if (a === 'relation') return 'brother';
        if (a === 'name_language') return 'en-US';
        if (a === 'names') return { first_name: 'Peter', middle_name: '', last_name: 'Kenney', maiden_name: '' }[b.split('.')[1]];
        if (a === 'birth') return b === 'date.year' ? '1949' : undefined;
        return undefined;
    } } }
}), true, "A confirmed-match half-sibling still scores true (#296 behavior, unaffected by #304 case B)");

// Privacy safeguard must still win over the new unmatched fallback too.
assertEqual(computeScored({
    startingScored: false, relationship: 'sibling', fullname: 'Living Someone', gender: 'male',
    firstName: 'Living', lastName: 'Someone', birthYear: '1990', skipprivate: true,
    genifamilydata: {}
}), false, "#304 case B: the user's own privacy-skip setting still suppresses an unmatched new candidate too");

// Child and partner get the identical unmatched fallback, not just sibling.
assertEqual(computeScored({
    startingScored: false, relationship: 'child', fullname: 'Brand New Child', gender: 'female',
    firstName: 'Brand', lastName: 'New', birthYear: '1995',
    genifamilydata: {}
}), true, "#304 case B: an unmatched new child also scores true");
assertEqual(computeScored({
    startingScored: false, relationship: 'partner', fullname: 'Brand New Spouse', gender: 'female',
    firstName: 'Brand', lastName: 'New', birthYear: '1995',
    genifamilydata: {}
}), true, "#304 case B: an unmatched new partner also scores true");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
