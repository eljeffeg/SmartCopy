// Verifies #343 (live-reported, DanCornett, follow-up to #332): "a citation
// gets added to the family member(s) About irrespective of the Config
// option setting. It should be honored." The family-member Update path's
// fetch-and-merge callback called buildReferenceAboutMe()/applyBuiltAboutMe()
// unconditionally - it never checked the citations on/off toggle at all,
// unlike the focus profile's own equivalent call site
// (buildFocusReferenceAboutMe(), gated on `if (sourcecheck)` in
// submitform()) and the family "add" path (`if (sourcecheck && familyout.action
// === "add")`). A family member's Update always got a citation, even with
// citations explicitly turned off.
//
// Fixed by threading sourcecheck through to the async callback (same
// variable-passing pattern already used for rawAbout/updatedCategories) and
// mirroring the focus profile's own sourcecheck=false behavior exactly:
// real new content still merges with Geni's existing About (still additive,
// never overwrites) but with no footnote, and nothing at all when there's
// no new content.
//
// Extracts the REAL async callback verbatim - same technique and fixture
// style as test_286_citation_symmetry_fixes.js / test_332_family_bare_citation_when_other_fields_change.js.
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
    'return ' + extractFunction(src, 'buildReferenceAboutMe'))(exists, moment, isAboutContentPresent, footnoteLabel, getLastAboutBlock, isLastLineFromSameSource, refreshLastCitationTimestamp, 'FindAGrave');
const applyBuiltAboutMe = new Function('exists', 'return ' + extractFunction(src, 'applyBuiltAboutMe'))(exists);

const asyncCallbackSrc = extractResponseCallbackBody(src, 'var abouturl = "https://www.geni.com/api/"');
function runRealAsyncAboutMerge(response) {
    var buildTreeCalls = [];
    (new Function(
        'response', 'exists', 'buildReferenceAboutMe', 'applyBuiltAboutMe', 'buildTree', 'submitstatusPop',
        asyncCallbackSrc.replace(/buildTree\(/g, '__buildTree__(').replace(/submitstatus\.pop\(\)/g, '__submitstatusPop__()')
            .replace(/__buildTree__\(/g, 'buildTree(').replace(/__submitstatusPop__\(\)/g, 'submitstatusPop()')
    ))(response, exists, buildReferenceAboutMe, applyBuiltAboutMe,
        function (familyoutArg) { buildTreeCalls.push(familyoutArg); },
        function () {});
    return buildTreeCalls[0];
}

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

var fdata = { url: 'https://www.findagrave.com/memorial/41866395/eli-willie-gladden' };

// --- #343 (Dan's exact test case): citations OFF, real new content, Geni already has an existing About - content still merges in, but with no citation footnote. ---
{
    var familyout = { profile_id: '42', about_me: 'Buried in Oakwood Cemetery.\n' };
    var response = {
        source: JSON.stringify({ about_me: 'Born 1850 in Georgia.' }),
        variable: {
            pid: '6000000012345',
            familyout: familyout,
            rawAbout: 'Buried in Oakwood Cemetery.\n',
            refurl: fdata.url,
            updatedCategories: ['burial'],
            sourcecheck: false
        }
    };
    var result = runRealAsyncAboutMerge(response);
    assertTrue(exists(result['about_me']) && result['about_me'].indexOf('Buried in Oakwood Cemetery.') !== -1,
        "#343: with citations off, real new content still gets merged into the family member's About (additive, never overwrites)");
    assertTrue(result['about_me'].indexOf('Born 1850 in Georgia.') !== -1,
        "#343: with citations off, Geni's existing About content is still preserved in the merge");
    assertTrue(result['about_me'].indexOf('SmartCopy') === -1,
        "#343: with citations off, no citation footnote is added - this was the actual bug, a citation appeared regardless of the config toggle");
}

// --- #343: citations OFF, no new About content but another field changed - no bare citation, nothing added to About at all. ---
{
    var familyout = { profile_id: '42' };
    var response = {
        source: JSON.stringify({ about_me: 'Existing biography text.' }),
        variable: {
            pid: '6000000012345',
            familyout: familyout,
            rawAbout: '',
            refurl: fdata.url,
            updatedCategories: ['burial'],
            sourcecheck: false
        }
    };
    var result = runRealAsyncAboutMerge(response);
    assertTrue(!exists(result['about_me']),
        "#343: with citations off and no new About content, no bare citation gets added even though another field changed");
}

// --- Regression: citations ON (sourcecheck: true) still produces a real citation, same as before this fix. ---
{
    var familyout = { profile_id: '42', about_me: 'Buried in Oakwood Cemetery.\n' };
    var response = {
        source: JSON.stringify({}),
        variable: {
            pid: '6000000012345',
            familyout: familyout,
            rawAbout: 'Buried in Oakwood Cemetery.\n',
            refurl: fdata.url,
            updatedCategories: ['burial'],
            sourcecheck: true
        }
    };
    var result = runRealAsyncAboutMerge(response);
    assertTrue(exists(result['about_me']) && result['about_me'].indexOf('Buried in Oakwood Cemetery.') !== -1 && result['about_me'].indexOf('SmartCopy') !== -1,
        "Regression: with citations on, a family member's new content still gets its citation exactly as before this fix");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
