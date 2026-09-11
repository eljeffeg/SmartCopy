// Verifies #204: the married-surname auto-fill guard chain in buildform.js
// (setBirthName(), getFocusSpouseSurname(), getParentSurname(), all built
// on aggregateFamilyByRelation()) - built up over 6 follow-up commits
// tightening edge cases (single vs. two-spouse, blank-only vs. confirmed-
// maiden, remarriage ambiguity). Collapsing any one of these guards
// silently overwrites a correct non-matching surname or blanks a valid
// one. Extracts the real functions verbatim, with a real NameParse
// (parse-names.js) so name-splitting quirks are exercised exactly as
// production does, not approximated.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');
const nameParseSrc = fs.readFileSync(path.join(ROOT, 'parse-names.js'), 'utf8');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;

function exists(v) { return typeof v !== 'undefined' && v !== null; }
global.exists = exists;
const NameParse = new Function(nameParseSrc + '\nreturn NameParse;')();

function isParent(r) { return exists(r) && ['parents', 'father', 'mother', 'parent', 'moth', 'fath'].indexOf(r) !== -1; }
function isPartner(r) { return exists(r) && ['spouse', 'wife', 'husband', 'partner', 'ex-husband', 'ex-wife', 'ex-partner'].indexOf(r) !== -1; }

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

function build(alldata) {
    const src = `
        ${extractFunction(bfSrc, 'aggregateFamilyByRelation')}
        ${extractFunction(bfSrc, 'setBirthName')}
        ${extractFunction(bfSrc, 'getFocusSpouseSurname')}
        ${extractFunction(bfSrc, 'getParentSurname')}
        return { setBirthName, getFocusSpouseSurname, getParentSurname };
    `;
    return new Function('exists', 'isParent', 'isPartner', 'NameParse', 'alldata', src)(exists, isParent, isPartner, NameParse, alldata);
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- setBirthName(): confirmed maiden name - a scraped father shares this exact last name ---
let ctx = build({ family: { father: [{ gender: 'male', name: 'Robert Smith' }] } });
assertEqual(ctx.setBirthName('focus', 'Smith', false), false,
    "#204: setBirthName returns false (confirmed maiden, don't move it) when the focus's own last name matches a scraped father's surname exactly");

// --- setBirthName(): no matching male candidate at all - safe to treat as a real maiden name to move ---
ctx = build({ family: { father: [{ gender: 'male', name: 'Robert Jones' }] } });
assertEqual(ctx.setBirthName('focus', 'Smith', false), true,
    "setBirthName returns true (safe to move to Birth Name) when no scraped parent shares this surname");

// --- setBirthName(): no relevant category at all (relation isn't focus/parent/partner) - always safe ---
ctx = build({ family: {} });
assertEqual(ctx.setBirthName('sibling', 'Smith', false), true,
    "setBirthName has no guard for sibling/child categories - always returns true (nothing to confirm-maiden against)");

// --- getFocusSpouseSurname(): exactly one male spouse - returns his surname ---
ctx = build({ family: { husband: [{ gender: 'male', name: 'Robert Smith' }] } });
assertEqual(ctx.getFocusSpouseSurname(false), 'Smith',
    "#204: getFocusSpouseSurname returns the one male spouse's surname");

// --- getFocusSpouseSurname(): TWO spouses (remarriage/ambiguous source) - refuses to guess ---
ctx = build({ family: { husband: [{ gender: 'male', name: 'Robert Smith' }], "ex-husband": [{ gender: 'male', name: 'Frank Jones' }] } });
assertEqual(ctx.getFocusSpouseSurname(false), '',
    "getFocusSpouseSurname refuses to guess when there are two spouse-category entries - an ambiguous remarriage source, not a single confident answer");

// --- getFocusSpouseSurname(): the one spouse is FEMALE (same-sex marriage, or a female spouse scraped oddly) - guard is male-only by design ---
ctx = build({ family: { wife: [{ gender: 'female', name: 'Roberta Smith' }] } });
assertEqual(ctx.getFocusSpouseSurname(false), '',
    "getFocusSpouseSurname's male-only restriction (this specific #204 direction) means a female spouse never supplies a guessed married surname here, by design");

// --- getFocusSpouseSurname(): no spouse at all ---
ctx = build({ family: {} });
assertEqual(ctx.getFocusSpouseSurname(false), '',
    "getFocusSpouseSurname returns blank when there's no spouse data at all, not a throw");

// --- getParentSurname(): exactly one father - returns his surname ---
ctx = build({ family: { father: [{ gender: 'male', name: 'Robert Smith' }] } });
assertEqual(ctx.getParentSurname('male', false), 'Smith',
    "#204 (parents): getParentSurname returns the one father's surname");

// --- getParentSurname(): TWO fathers (a remarriage scenario in the source data) - refuses to guess ---
ctx = build({ family: { father: [{ gender: 'male', name: 'Robert Smith' }], parent: [{ gender: 'male', name: 'Frank Jones' }] } });
assertEqual(ctx.getParentSurname('male', false), '',
    "getParentSurname refuses to guess between two father-category entries rather than picking one arbitrarily");

// --- getParentSurname(): asking for 'female' correctly only counts mother-gendered entries, not fathers ---
ctx = build({ family: { father: [{ gender: 'male', name: 'Robert Smith' }], mother: [{ gender: 'female', name: 'Jane Doe' }] } });
assertEqual(ctx.getParentSurname('female', false), 'Doe',
    "getParentSurname filters by the requested gender, not just 'is this a parent-category entry'");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
