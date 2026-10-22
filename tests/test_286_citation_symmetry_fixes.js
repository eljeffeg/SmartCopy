// Verifies two #286 gaps Dan precisely re-confirmed on 2026-10-14, after
// the v...52/v...53 data-loss incident was resolved:
//
// 1. A brand-new family member ADDED with a blank scraped About never got
//    even a bare citation, unlike the focus profile (which always attempts
//    one, gated only on the source-citation config). Dan, 2026-10-14
//    11:04: "If the Config has citations enabled, adding a new profile
//    should put in a citation ... even if that 'scraped' About is empty."
//
// 2. A MATCHED (Update) family member whose Geni About was already empty,
//    now getting genuinely new scraped content, added the content WITHOUT
//    a citation - Dan, 2026-10-14 12:13: "If the empty Geni About is NOT
//    the focus profile, the 'scraped' (non-empty) text gets added WITHOUT
//    a citation." Root cause: the async fetch-and-merge callback required
//    `exists(geni_return.about_me)` before ever calling
//    buildReferenceAboutMe()/applyBuiltAboutMe() at all - but Geni's API
//    appears to omit the about_me field entirely from its JSON response
//    when a profile's About is genuinely empty, rather than returning "".
//    So the whole merge/citation step was silently skipped, and the raw
//    scraped text (already sitting in familyout["about_me"] from Stage 1,
//    no citation attached) passed straight through untouched.
//
// Both are now fixed:
// 1. The "add" branch's gate no longer requires rawAbout !== "" - it only
//    requires sourcecheck and action === "add", matching the focus
//    profile's own unconditional gate exactly. buildReferenceAboutMe()'s
//    own existing logic (unchanged) already produces a bare citation for
//    a blank About as long as something else is being submitted (which a
//    genuine "add" always has, per the #300 real-name requirement).
// 2. A missing geni_return.about_me is now treated as "" - the same
//    "absent field means blank" convention GeniPerson.get() already uses
//    everywhere else in this codebase - instead of skipping the
//    merge/citation step outright.
//
// Extracts the REAL code (not reimplementations) - same convention as
// test_286_family_about_blank_no_data_loss.js.
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

function extractIfBlockAfter(srcText, anchor, ifMarker) {
    const anchorPos = srcText.indexOf(anchor);
    if (anchorPos === -1) throw new Error('anchor not found: ' + anchor);
    const ifStart = srcText.indexOf(ifMarker, anchorPos);
    if (ifStart === -1) throw new Error('if marker not found after anchor: ' + ifMarker);
    const braceStart = srcText.indexOf('{', ifStart);
    let depth = 0, i = braceStart;
    for (; i < srcText.length; i++) {
        if (srcText[i] === '{') depth++;
        else if (srcText[i] === '}') { depth--; if (depth === 0) break; }
    }
    return srcText.slice(braceStart + 1, i);
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
// The async callback uses $.isEmptyObject() - load real jQuery, same as
// every other test in this suite that exercises real DOM/jQuery-touching code.
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;

const isAboutContentPresent = new Function('exists', extractFunction(src, 'normalizeAboutForComparison') + '\n' + extractFunction(src, 'isAboutContentPresent') + '\nreturn isAboutContentPresent;')(exists);
const footnoteLabel = new Function('exists', 'return ' + extractFunction(src, 'footnoteLabel'))(exists);
const getLastAboutBlock = new Function('exists', 'return ' + extractFunction(src, 'getLastAboutBlock'))(exists);
const isLastLineFromSameSource = new Function('exists', 'return ' + extractFunction(src, 'isLastLineFromSameSource'))(exists);
const refreshLastCitationTimestamp = new Function('exists', 'moment',
    extractVarStatement(src, 'ABOUT_CITATION_TIMESTAMP_PATTERN') + '\nreturn ' + extractFunction(src, 'refreshLastCitationTimestamp') + ';')(exists, moment);
const buildReferenceAboutMe = new Function('exists', 'moment', 'isAboutContentPresent', 'footnoteLabel', 'getLastAboutBlock', 'isLastLineFromSameSource', 'refreshLastCitationTimestamp', 'recordtype',
    'return ' + extractFunction(src, 'buildReferenceAboutMe'))(exists, moment, isAboutContentPresent, footnoteLabel, getLastAboutBlock, isLastLineFromSameSource, refreshLastCitationTimestamp, 'FamilySearch Family Tree');
const applyBuiltAboutMe = new Function('exists', 'return ' + extractFunction(src, 'applyBuiltAboutMe'))(exists);
const summarizeUpdatedCategories = new Function('exists', 'return ' + extractFunction(src, 'summarizeUpdatedCategories'))(exists);

const addBlockSrc = extractIfBlockAfter(src, 'var tempfamilyout = jQuery.extend', 'if (exists(fdata)) {');
function runRealFamilyAboutBlock(familyout, opts) {
    var fdata = opts.fdata;
    var sourcecheck = opts.sourcecheck;
    var databyid = opts.databyid || {};
    var photosubmit = opts.photosubmit || {};
    var marriagedates = opts.marriagedates || {};
    (new Function(
        'familyout', 'fdata', 'sourcecheck', 'databyid', 'photosubmit', 'marriagedates',
        'exists', 'buildReferenceAboutMe', 'applyBuiltAboutMe', 'summarizeUpdatedCategories',
        addBlockSrc + '\nreturn familyout;'
    ))(familyout, fdata, sourcecheck, databyid, photosubmit, marriagedates,
        exists, buildReferenceAboutMe, applyBuiltAboutMe, summarizeUpdatedCategories);
    return familyout;
}

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
    return buildTreeCalls[0];
}

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

var fdata = { url: 'https://www.familysearch.org/tree/person/details/ABCD-123' };

// --- Fix 1: a brand-new "Add" family member with a blank scraped About still gets a bare citation. ---
{
    var familyout = { profile_id: '42', action: 'add', about_me: '', names: { 'en-US': { last_name: 'Smith' } } };
    var result = runRealFamilyAboutBlock(familyout, { fdata: fdata, sourcecheck: true });
    assertTrue(exists(result['about_me']) && result['about_me'].indexOf('SmartCopy') !== -1,
        "#286: a brand-new Add with a blank scraped About still gets a bare citation when citations are enabled and real data (a name) is being submitted");
}

// --- Safety: with citations OFF, a brand-new Add with blank About still submits nothing destructive. ---
{
    var familyout = { profile_id: '42', action: 'add', about_me: '', names: { 'en-US': { last_name: 'Smith' } } };
    var result = runRealFamilyAboutBlock(familyout, { fdata: fdata, sourcecheck: false });
    assertTrue(!exists(result['about_me']),
        "Safety: with citations disabled, a blank About on a new Add still submits nothing for about_me");
}

// --- Fix 2: a matched Update family member whose Geni About is empty (API response omits the field entirely) still gets content + citation. ---
{
    var familyout = { profile_id: '42', about_me: 'Born in 1850 in Ohio.\n' };
    var response = {
        // Geni's API still returns other real fields (nicknames here) even
        // when about_me itself is genuinely empty - it's not a literal {},
        // just missing that one key. A literal {} would itself be caught
        // by the (unrelated) $.isEmptyObject() guard around this whole
        // merge step, which exists for a malformed/unparseable response,
        // not for this case.
        source: JSON.stringify({ nicknames: [] }),
        variable: {
            pid: '6000000012345',
            familyout: familyout,
            rawAbout: 'Born in 1850 in Ohio.\n',
            refurl: fdata.url,
            updatedCategories: ['about'],
            sourcecheck: true
        }
    };
    var result = runRealAsyncAboutMerge(response);
    assertTrue(exists(result['about_me']) && result['about_me'].indexOf('Born in 1850 in Ohio.') !== -1 && result['about_me'].indexOf('SmartCopy') !== -1,
        "#286: a matched family member's genuinely new content gets its citation even when Geni's API response omits about_me entirely (an empty About)");
}

// --- Regression: Geni's API DOES return a real existing about_me - the normal merge/dedup path must still work exactly as before. ---
{
    var familyout = { profile_id: '42', about_me: 'Born in 1850 in Ohio.\n' };
    var response = {
        source: JSON.stringify({ about_me: 'Some prior biography text.' }),
        variable: {
            pid: '6000000012345',
            familyout: familyout,
            rawAbout: 'Born in 1850 in Ohio.\n',
            refurl: fdata.url,
            updatedCategories: ['about'],
            sourcecheck: true
        }
    };
    var result = runRealAsyncAboutMerge(response);
    assertTrue(exists(result['about_me']) && result['about_me'].indexOf('Some prior biography text.') !== -1 && result['about_me'].indexOf('Born in 1850 in Ohio.') !== -1,
        "Regression: a real, non-empty existing Geni About still merges with new content exactly as before");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
