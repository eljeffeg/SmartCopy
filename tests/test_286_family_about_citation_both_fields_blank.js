// Verifies a #286 further follow-up, live-reported and precisely
// reconfirmed by DanCornett on 2026-10-19 (v...60, after the "missing
// about_me field" gap from 2026-10-14 was already fixed and shipped):
//
// "When a Geni profile with an empty About has some printable/visible
// content added to the About => when it is not the focus profile, a
// citation is not added [the first time]." Repeating the same submission a
// second time DID add a citation correctly.
//
// Root cause: the async fetch-and-merge callback (popup.js, the
// `abouturl = ".../pid?fields=about_me,nicknames&..."` GET's response
// handler) guarded the whole merge/citation step with
// `!$.isEmptyObject(geni_return)` - meant to skip the merge only when the
// response body failed to parse as JSON (geni_return stays `{}` from the
// catch block in that case). But this endpoint only ever requests
// about_me and nicknames, and Geni's API appears to omit a field entirely
// when it's genuinely blank rather than returning "" - already established
// for about_me alone (test_286_citation_symmetry_fixes.js's Fix 2). When
// BOTH requested fields are blank (a brand-new family member being
// matched for the first time, with no About and no nicknames yet - exactly
// Dan's case), Geni's response body is a literal, successfully-parsed `{}`,
// which is indistinguishable from a parse failure under the old guard -
// so the whole merge/citation step was silently skipped, and the raw
// scraped About (already sitting in familyout["about_me"] from Stage 1,
// no citation attached) passed straight through untouched. The SECOND
// submission then had a real (now non-blank) about_me in Geni's response,
// so geni_return was no longer `{}`, the guard passed, and the citation
// was added correctly - matching Dan's exact observed toggle.
//
// Fixed by gating on whether JSON.parse() actually threw, not on whether
// the successfully-parsed result happens to have zero keys.
//
// Extracts the REAL async callback body (not a reimplementation) - same
// technique and fixture style as test_286_citation_symmetry_fixes.js.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

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

function extractVarStatement(srcText, name) {
    const marker = 'var ' + name + ' =';
    const start = srcText.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    const semi = srcText.indexOf(';', start);
    return srcText.slice(start, semi + 1);
}

// Brace-counts the anonymous `function (response) { ... }` async callback
// immediately following the given anchor.
function extractResponseCallbackBody(srcText, anchor) {
    const anchorPos = srcText.indexOf(anchor);
    if (anchorPos === -1) throw new Error('anchor not found: ' + anchor);
    const fnStart = srcText.indexOf('function (response) {', anchorPos);
    const braceStart = srcText.indexOf('{', fnStart);
    let depth = 0, i = braceStart;
    for (; i < srcText.length; i++) {
        if (srcText[i] === '{') depth++;
        else if (srcText[i] === '}') { depth--; if (depth === 0) break; }
    }
    return srcText.slice(braceStart + 1, i);
}

function exists(v) { return typeof v !== 'undefined' && v !== null; }
const moment = require(path.join(ROOT, 'moment.js'));
// The async callback uses $.isEmptyObject() in its pre-fix form - load real
// jQuery, same as every other test in this suite that exercises real
// DOM/jQuery-touching code, so a regression back to that guard is caught
// for real rather than by coincidence.
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;

const footnoteLabel = new Function('exists', 'return ' + extractFunction(src, 'footnoteLabel'))(exists);
const getLastAboutBlock = new Function('exists', 'return ' + extractFunction(src, 'getLastAboutBlock'))(exists);
const isLastLineFromSameSource = new Function('exists', 'return ' + extractFunction(src, 'isLastLineFromSameSource'))(exists);
const refreshLastCitationTimestamp = new Function('exists', 'moment',
    extractVarStatement(src, 'ABOUT_CITATION_TIMESTAMP_PATTERN') + '\nreturn ' + extractFunction(src, 'refreshLastCitationTimestamp') + ';')(exists, moment);
const isAboutContentPresent = new Function('exists', extractFunction(src, 'normalizeAboutForComparison') + '\n' + extractFunction(src, 'isAboutContentPresent') + '\nreturn isAboutContentPresent;')(exists);
const buildReferenceAboutMe = new Function('exists', 'moment', 'isAboutContentPresent', 'footnoteLabel', 'getLastAboutBlock', 'isLastLineFromSameSource', 'refreshLastCitationTimestamp', 'recordtype',
    'return ' + extractFunction(src, 'buildReferenceAboutMe'))(exists, moment, isAboutContentPresent, footnoteLabel, getLastAboutBlock, isLastLineFromSameSource, refreshLastCitationTimestamp, 'FamilySearch Family Tree');
const applyBuiltAboutMe = new Function('exists', 'return ' + extractFunction(src, 'applyBuiltAboutMe'))(exists);

const asyncCallbackSrc = extractResponseCallbackBody(src, 'var abouturl = "https://www.geni.com/api/"');
function runRealAsyncAboutMerge(response) {
    var buildTreeCalls = [];
    var submitstatusPopCalls = 0;
    (new Function(
        'response', 'exists', 'buildReferenceAboutMe', 'applyBuiltAboutMe', 'buildTree', 'submitstatusPop',
        asyncCallbackSrc.replace(/buildTree\(/g, '__buildTree__(').replace(/submitstatus\.pop\(\)/g, '__submitstatusPop__()')
            .replace(/__buildTree__\(/g, 'buildTree(').replace(/__submitstatusPop__\(\)/g, 'submitstatusPop()')
    ))(response, exists, buildReferenceAboutMe, applyBuiltAboutMe,
        function (familyoutArg) { buildTreeCalls.push(familyoutArg); },
        function () { submitstatusPopCalls++; });
    return { familyout: buildTreeCalls[0], submitstatusPopCalls: submitstatusPopCalls };
}

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

var fdata = { url: 'https://www.familysearch.org/tree/person/details/ABCD-123' };

// --- #286 (2026-10-19): Dan's exact first-submission case - Geni's response is a literal {}, both about_me and nicknames genuinely blank. ---
{
    var familyout = { profile_id: '42', about_me: 'test\n' };
    var response = {
        source: JSON.stringify({}),
        variable: {
            pid: '6000000012345',
            familyout: familyout,
            rawAbout: 'test\n',
            refurl: fdata.url,
            updatedCategories: ['about'],
            sourcecheck: true
        }
    };
    var result = runRealAsyncAboutMerge(response);
    assertTrue(exists(result.familyout['about_me']) && result.familyout['about_me'].indexOf('test') !== -1 && result.familyout['about_me'].indexOf('SmartCopy') !== -1,
        "#286: new content for a matched family member still gets its citation when Geni's response is a literal {} (both about_me and nicknames genuinely blank), not just when about_me alone is missing");
}

// --- Safety: a genuinely malformed/unparseable response still skips the merge (familyout keeps Stage 1's raw value) and still submits the person. ---
{
    var familyout = { profile_id: '42', about_me: 'test\n' };
    var response = {
        source: 'not valid json {{{',
        variable: {
            pid: '6000000012345',
            familyout: familyout,
            rawAbout: 'test\n',
            refurl: fdata.url,
            updatedCategories: ['about']
        }
    };
    var result = runRealAsyncAboutMerge(response);
    assertTrue(result.familyout['about_me'] === 'test\n',
        "Safety: a genuinely unparseable Geni response still skips the merge/citation step, leaving Stage 1's raw about_me untouched");
    assertTrue(result.submitstatusPopCalls === 1,
        "Safety: a genuinely unparseable Geni response still submits the person (buildTree called, submitstatus popped) rather than stalling");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
