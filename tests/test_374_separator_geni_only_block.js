// Verifies #374 (live-reported, DanCornett, screenshots + repro profiles
// William Whiteside 6000000004228859954 / FindAGrave 40997957 and
// 69813713): the subtle divider line between field groups (e.g. before
// Marriage) disappeared under "Hide Unused Fields" specifically when
// nothing was scraped for that event but Geni already had a real value -
// the date/location rows stayed visible (they already check Geni's data
// via matchedCandidateForEstimate/genifocusdata), but their own leading
// separator was hardcoded data-hasvalue="false" and checked only
// isHidden(hidden), with no Geni-value check of its own. The #273 fix
// this separator originally came from assumed "nothing scraped" meant
// "empty segment" - true when #273 shipped, no longer true once #328/#35
// made the rows below it visible from Geni-only data too.
//
// Two call sites, same bug, same fix: compute the same "does Geni have
// anything here" signal the rows below already use, one step earlier,
// and gate the separator with it too - family members reuse
// matchedCandidateForEstimate (the pre-match candidate), focus profile
// reads genifocusdata.get() directly, matching #328's own precedent for
// exactly this family-vs-focus split.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- Structural: the old hardcoded-false separators are gone ---
// (There's a THIRD, unrelated hardcoded-false separator elsewhere in this
// file - the focus profile's About->Birth transition, gated by `sepx`,
// not tied to any one event title's Geni data - deliberately left alone;
// it's not part of this bug and Dan's reports never named it. Matching on
// the #355 comment that immediately follows ONLY the family-member
// per-event separator keeps this assertion from accidentally matching
// that unrelated one too.)
assertTrue(src.indexOf('<tr style="display: \' + isHidden(hidden) + \';" class="hiddenrow" data-hasvalue="false"><td colspan="3"><div class="separator"></div></td></tr>\';\n\n                        // #355:') === -1,
    "#374: the family-member per-event separator no longer hardcodes data-hasvalue=\"false\" unconditionally");
assertTrue(src.indexOf('<tr style="display: \' + isHidden(hidden) + \';" class="hiddenrow" data-hasvalue="false"><td colspan="3"><div class="separator"></div></td><td></td></tr>') === -1,
    "#374: the focus-profile separator no longer hardcodes data-hasvalue=\"false\" unconditionally");

// --- Structural: both separators now emit a computed hasValue flag ---
assertTrue(src.indexOf('data-hasvalue="\' + separatorHasGeniValue + \'"') !== -1,
    "#374: the family-member separator now emits a computed hasValue flag");
assertTrue(src.indexOf('data-hasvalue="\' + focusSeparatorHasGeniValue + \'"') !== -1,
    "#374: the focus-profile separator now emits a computed hasValue flag");

function extractVarExpr(name) {
    const marker = 'var ' + name + ' = ';
    const start = src.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    const end = src.indexOf(';\n', start);
    return src.slice(start, end + 1);
}

function exists(v) { return typeof v !== 'undefined' && v !== null; }
function isValue(v) { return v !== ""; }

// --- Functional: the family-member expression, with a real-shaped stub candidate ---
function evalMemberExpr(title, candidateData) {
    const candidate = exists(candidateData) ? {
        get: function (t, field) {
            if (field === undefined) { return candidateData[t] !== undefined ? candidateData[t] : ""; }
            return (candidateData[t] && candidateData[t][field] !== undefined) ? candidateData[t][field] : "";
        }
    } : undefined;
    return new Function('exists', 'isValue', 'matchedCandidateForEstimate', 'title',
        extractVarExpr('separatorHasGeniValue') + '\nreturn separatorHasGeniValue;'
    )(exists, isValue, candidate, title);
}

assertEqual(evalMemberExpr('marriage', undefined), false,
    "#374 member: no matched candidate at all (brand-new profile) - separator correctly has no Geni value to show");
assertEqual(evalMemberExpr('marriage', {}), false,
    "#374 member: a matched candidate with nothing recorded for marriage - separator correctly stays data-hasvalue=false");
assertEqual(evalMemberExpr('marriage', { marriage: { 'date.formatted_date': 'circa 1740' } }), true,
    "#374 member: Geni has a marriage date, nothing scraped - separator now correctly reports data-hasvalue=true (this is the live-reported bug)");
assertEqual(evalMemberExpr('marriage', { marriage: { 'location.city': 'Albemarle' } }), true,
    "#374 member: Geni has only a marriage location (no date) - separator still correctly reports data-hasvalue=true");
assertEqual(evalMemberExpr('death', { death: {}, cause_of_death: 'Smallpox' }), true,
    "#374 member: Geni has a cause of death but no date/location - separator still correctly reports data-hasvalue=true");
assertEqual(evalMemberExpr('baptism', { marriage: { 'date.formatted_date': 'circa 1740' } }), false,
    "#374 member: Geni's data is for a DIFFERENT title (marriage, not baptism) - this title's own separator correctly stays data-hasvalue=false");

// --- Functional: the focus-profile expression, with genifocusdata stubbed the same way ---
function evalFocusExpr(title, focusData) {
    const genifocusdata = {
        get: function (t, field) {
            if (field === undefined) { return focusData[t] !== undefined ? focusData[t] : ""; }
            return (focusData[t] && focusData[t][field] !== undefined) ? focusData[t][field] : "";
        }
    };
    return new Function('isValue', 'genifocusdata', 'title',
        extractVarExpr('focusSeparatorHasGeniValue') + '\nreturn focusSeparatorHasGeniValue;'
    )(isValue, genifocusdata, title);
}

assertEqual(evalFocusExpr('marriage', {}), false,
    "#374 focus: nothing on Geni for this title - separator correctly stays data-hasvalue=false");
assertEqual(evalFocusExpr('marriage', { marriage: { 'date.formatted_date': 'circa 1740' } }), true,
    "#374 focus: Geni has a marriage date, nothing scraped - separator now correctly reports data-hasvalue=true");
assertEqual(evalFocusExpr('death', { death: {}, cause_of_death: 'Smallpox' }), true,
    "#374 focus: Geni has a cause of death but no date/location - separator still correctly reports data-hasvalue=true");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
