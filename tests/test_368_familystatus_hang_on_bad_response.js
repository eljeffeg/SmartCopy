// Verifies #368 (found during a full pre-release code review - the same
// bug shape as #362's "Edit Location" spinner hang, in two different,
// more commonly-hit spots): loadGeniData() (buildform.js, runs on EVERY
// profile sync to fetch About/nicknames) and parseYadVaShem()
// (collections/yadvashem.js) both had an unguarded JSON.parse(response.
// source) inside a chrome.runtime.sendMessage callback, with
// familystatus.pop() only running if the parse (and, for YadVashem,
// everything after it) succeeded. updateGeo() (buildform.js) polls
// familystatus.length > 0 via setTimeout to decide when it's safe to
// proceed - an uncaught exception here means familystatus never returns
// to empty, hanging the entire import forever, not just one row.
//
// Both now wrap the risky parsing in try/catch and degrade to blank on
// failure, matching the "never throws, degrade to blank" convention
// performFamilySearchQuery() (parse-location.js) already established for
// exactly this class of problem. Extracts the real functions verbatim.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');
const yvSrc = fs.readFileSync(path.join(ROOT, 'collections/yadvashem.js'), 'utf8');
const sharedSrc = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');

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

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;
function exists(v) { return typeof v !== 'undefined' && v !== null; }

function makeChrome(canned) {
    return { runtime: { sendMessage: function (msg, callback) { callback(canned); } } };
}

// ============ loadGeniData() (buildform.js) ============

function freshLoadGeniDataCtx() {
    global.familystatus = [];
    global.focusid = 'profile-123';
    global.accountinfo = { access_token: 'fake-token' };
    global.focusabout = '';
    global.focusnicknames = '';
    const loadGeniDataSrc = extractFunction(bfSrc, 'loadGeniData');
    return new Function('$', 'exists', 'chrome', 'familystatus',
        loadGeniDataSrc + '\nreturn loadGeniData;'
    )($, exists, global.chrome, global.familystatus);
}

(function () {
    global.chrome = makeChrome({ source: 'not valid json {' });
    const loadGeniData = freshLoadGeniDataCtx();
    var threw = false;
    try { loadGeniData(); } catch (e) { threw = true; }
    assertEqual(threw, false, "loadGeniData(): a malformed response no longer throws out of the function");
    assertEqual(global.familystatus.length, 0, "loadGeniData(): familystatus returns to empty instead of staying stuck - this is what actually unblocks updateGeo()'s poll loop");
})();

(function () {
    global.chrome = makeChrome({ source: '' });
    const loadGeniData = freshLoadGeniDataCtx();
    loadGeniData();
    assertEqual(global.familystatus.length, 0, "loadGeniData(): an empty response.source (the existing exists()/!== \"\" guard's own case) still pops familystatus correctly - unaffected regression check");
})();

(function () {
    global.chrome = makeChrome({ source: JSON.stringify({ about_me: 'A real bio', nicknames: 'Bob' }) });
    const loadGeniData = freshLoadGeniDataCtx();
    loadGeniData();
    assertEqual(global.familystatus.length, 0, "loadGeniData(): a normal, valid response still pops familystatus (success path unaffected)");
    assertEqual(global.focusabout, 'A real bio', "loadGeniData(): a normal, valid response still correctly sets focusabout (success path unaffected)");
    assertEqual(global.focusnicknames, 'Bob', "loadGeniData(): a normal, valid response still correctly sets focusnicknames (success path unaffected)");
})();

// ============ parseYadVaShem() (collections/yadvashem.js) ============

function freshYadVaShemCtx(canned) {
    global.chrome = makeChrome(canned);
    global.familystatus = [];
    global.alldata = {};
    global.smscorefactors = {};
    global.yadvashemAPIurl = 'https://example.org/api';
    var updateGeoCalls = 0;
    global.__updateGeoCalls = function () { return updateGeoCalls; };
    function getItemIdStr() { return 'item-1'; }
    function getLang() { return 'en'; }
    var fieldNameToLabelMap = new Map();
    function parseYadVaShemJson(ys_person, focusperson, familymembers, relation) {
        return { name: focusperson };
    }
    function updateGeo() { updateGeoCalls++; }
    const updateUrlParamSrc = extractFunction(sharedSrc, 'updateUrlParam');
    const parseYadVaShemSrc = extractFunction(yvSrc, 'parseYadVaShem');
    const fn = new Function(
        '$', 'exists', 'chrome', 'familystatus', 'alldata', 'smscorefactors', 'yadvashemAPIurl',
        'getItemIdStr', 'getLang', 'fieldNameToLabelMap', 'parseYadVaShemJson', 'updateGeo',
        updateUrlParamSrc + '\n' + parseYadVaShemSrc + '\nreturn parseYadVaShem;'
    )($, exists, global.chrome, global.familystatus, global.alldata, global.smscorefactors, global.yadvashemAPIurl,
        getItemIdStr, getLang, fieldNameToLabelMap, parseYadVaShemJson, updateGeo);
    return fn;
}

(function () {
    const parseYadVaShem = freshYadVaShemCtx({ source: 'not valid json {' });
    var threw = false;
    try { parseYadVaShem('<html><body></body></html>', [], ''); } catch (e) { threw = true; }
    assertEqual(threw, false, "parseYadVaShem(): a malformed response no longer throws");
    assertEqual(global.familystatus.length, 0, "parseYadVaShem(): familystatus returns to empty on a malformed response - this is what actually unblocks updateGeo()'s poll loop");
})();

(function () {
    // Valid JSON, but shaped nothing like a real YadVashem response
    // (.details missing entirely) - the json_obj.details.reduce(...) call
    // itself throws, a separate failure point from JSON.parse() itself.
    const parseYadVaShem = freshYadVaShemCtx({ source: JSON.stringify({ unexpected: 'shape' }) });
    var threw = false;
    try { parseYadVaShem('<html><body></body></html>', [], ''); } catch (e) { threw = true; }
    assertEqual(threw, false, "parseYadVaShem(): valid JSON but an unexpected shape (.details missing) - still doesn't throw");
    assertEqual(global.familystatus.length, 0, "parseYadVaShem(): familystatus still returns to empty when the failure is in post-parse processing, not JSON.parse() itself");
})();

(function () {
    const parseYadVaShem = freshYadVaShemCtx({ source: JSON.stringify({ details: [] }) });
    parseYadVaShem('<html><body></body></html>', [], '');
    assertEqual(global.familystatus.length, 0, "parseYadVaShem(): a normal, valid (if minimal) response still pops familystatus (success path unaffected)");
    assertEqual(global.__updateGeoCalls(), 1, "parseYadVaShem(): a normal, valid response still calls updateGeo() exactly once (success path unaffected)");
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
