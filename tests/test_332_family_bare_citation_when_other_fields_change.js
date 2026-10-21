// Verifies a #332 follow-up, live-reported by DanCornett after the original
// #332 crash (a stale Action dropdown after a Gender change) was fixed in
// v4.17.3.59: once the crash was gone, he found a second, silent gap in the
// same area. His exact repro (2026-10-19): a matched child-of-focus profile,
// Gender left as Unknown, only the Burial Place field changed (About was
// never checked/selected at all). Geni's own Revisions history confirmed
// the burial update genuinely went through - but no citation was added to
// the About noting it happened, and no error of any kind was shown. His own
// diagnosis: "Even though the About isn't selected for updating, it still
// needs to be fetched from Geni and updated with the citation noting the
// other field(s) which are being updated."
//
// Root cause: the family-member "Update" path's fetch-and-merge step (the
// code that asks Geni for a person's real About before deciding what to
// submit) only ever ran `if ((about_me has content) || (nicknames has
// content))` - a family member whose About/nicknames weren't touched at all
// never triggered it, no matter what else changed. This is the one piece of
// symmetry the #286 fix for family members never had: the FOCUS profile's
// own equivalent (buildFocusReferenceAboutMe(), called unconditionally
// whenever citations are enabled) already handles a "nothing in About
// changed, but something else did" submission by writing a bare citation -
// buildReferenceAboutMe() itself already contains that exact logic
// (updatedCategories.length > 0 keeps a blank `about` from returning
// undefined) - family members just never reached it when About itself
// wasn't part of the submission.
//
// Fixed by (1) widening the outer "should we even fetch Geni's About" gate
// to also fire when updatedCategories is non-empty, and (2) removing the
// `exists(familyout["about_me"])` guard around the merge call inside the
// async callback - it now runs unconditionally, exactly like the focus
// profile's own call site, and lets buildReferenceAboutMe() itself decide
// whether that produces real content+citation, a bare citation, or nothing.
//
// Extracts the REAL async callback and the REAL outer gate condition
// (not reimplementations) - same technique and fixture style as
// test_286_citation_symmetry_fixes.js.
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

// --- #332 (2026-10-19): Dan's exact case - About never touched (no about_me key at all), but another field (burial) changed. Geni already has real About content. ---
{
    var familyout = { profile_id: '42' }; // no about_me key at all - About checkbox was never checked
    var response = {
        source: JSON.stringify({ about_me: 'Existing biography text.' }),
        variable: {
            pid: '6000000012345',
            familyout: familyout,
            rawAbout: '',
            refurl: fdata.url,
            updatedCategories: ['burial']
        }
    };
    var result = runRealAsyncAboutMerge(response);
    assertTrue(exists(result['about_me']),
        "#332: a family member with no about_me key at all still gets an about_me assigned when another real field changed");
    assertTrue(result['about_me'].indexOf('Existing biography text.') !== -1,
        "#332: Geni's real existing About content is preserved in the bare-citation result");
    assertTrue(result['about_me'].indexOf('SmartCopy') !== -1 && result['about_me'].indexOf('this update: burial') !== -1,
        "#332: a bare citation noting the burial update is added, even though About itself was never selected");
}

// --- Safety: nothing at all changed (no about_me, empty updatedCategories) - no citation spam, about_me stays absent. ---
{
    var familyout = { profile_id: '42' };
    var response = {
        source: JSON.stringify({ about_me: 'Existing biography text.' }),
        variable: {
            pid: '6000000012345',
            familyout: familyout,
            rawAbout: '',
            refurl: fdata.url,
            updatedCategories: []
        }
    };
    var result = runRealAsyncAboutMerge(response);
    assertTrue(!exists(result['about_me']),
        "Safety: with no new About content and nothing else changed (empty updatedCategories), no bare citation gets added - a true no-op run stays a no-op");
}

// --- Regression: real new About content for this same family member still works exactly as before (not just the bare-citation case). ---
{
    var familyout = { profile_id: '42', about_me: 'Buried in Oakwood Cemetery.\n' };
    var response = {
        source: JSON.stringify({}),
        variable: {
            pid: '6000000012345',
            familyout: familyout,
            rawAbout: 'Buried in Oakwood Cemetery.\n',
            refurl: fdata.url,
            updatedCategories: ['about']
        }
    };
    var result = runRealAsyncAboutMerge(response);
    assertTrue(exists(result['about_me']) && result['about_me'].indexOf('Buried in Oakwood Cemetery.') !== -1 && result['about_me'].indexOf('SmartCopy') !== -1,
        "Regression: real new About content for a family member still gets merged with its own citation exactly as before");
}

// --- Structural: the outer gate (decides whether to even fetch Geni's About) now also fires on a non-empty updatedCategories, not only on about_me/nicknames themselves having content. ---
{
    var gateMarker = 'if ((exists(familyout["about_me"]) && familyout["about_me"] !== "") || (exists(familyout["nicknames"]) && familyout["nicknames"] !== "") || updatedCategories.length > 0) {';
    assertTrue(src.indexOf(gateMarker) !== -1,
        "#332: the outer fetch-and-merge gate for a family member's Update is widened to include updatedCategories.length > 0");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
