// Live-reported (Dan Bodenheimer, https://www.geni.com/people/Leo-Hirschfield/6000000228580616709,
// v4.18.0): importing a FindAGrave family hung forever with the spinner
// never stopping. Console showed an uncaught TypeError inside
// getFindAGraveName (collections/findagrave.js), thrown from inside
// parseFindAGrave, thrown from inside getFindAGraveFamily()'s
// chrome.runtime.sendMessage callback - the exact same bug shape as
// #362/#368 (an uncaught exception skips familystatus.pop(), and
// updateGeo()'s setTimeout poll on familystatus.length never sees it
// return to empty, hanging the whole import, not just one family member).
//
// Root cause: when a family member's own FindAGrave page doesn't match
// either of parseFindAGrave's two name-element selectors (".plus2 b", or
// a "#bio-name" that literally reads "Memorial has been merged."),
// `fperson` ends up an empty jQuery object. $(fperson[0]).html() then
// returns undefined, and getFindAGraveName(undefined).split(...) throws -
// uncaught, inside an async callback with no try/catch, so
// familystatus.pop() never ran.
//
// Fixed two ways, matching #362/#368's "never throws, degrade to blank"
// convention: (1) getFindAGraveName() now guards against undefined/falsy
// input directly, returning "" instead of throwing; (2)
// getFindAGraveFamily()'s callback (and the structurally identical
// merged-memorial redirect callback a few lines up, which had the same
// unguarded-exception-before-pop() shape around click[0].outerHTML) now
// wrap their risky work in try/catch/finally, so familystatus.pop() always
// runs regardless of what throws. Extracts the real functions verbatim.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
const src = fs.readFileSync(path.join(ROOT, 'collections/findagrave.js'), 'utf8');

function extractFunction(name) {
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
function assertTrue(cond, label) { assertEqual(!!cond, true, label); }

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
function exists(v) { return typeof v !== 'undefined' && v !== null; }
// shared.js's own String.prototype.contains() polyfill - parseFindAGrave
// uses .contains() throughout, a non-standard method this codebase relies
// on shared.js having already installed by the time it runs.
if (!String.prototype.contains) {
    String.prototype.contains = function () {
        return String.prototype.indexOf.apply(this, arguments) !== -1;
    };
}

// Trivial pass-through stubs for everything parseFindAGrave touches that
// this test isn't exercising - their own correctness is covered elsewhere.
function stripInlineEventHandlers(html) { return html; }
function addEvent(profiledata) { return profiledata; }
function isChild() { return false; }
function isSibling() { return false; }
function isParent() { return false; }
function isPartner() { return false; }
function cleanHTML(html) { return html; }
function escapeHtml(s) { return s; }
function startsWithHTTP() { return false; }
function hostDomain(u) { return u; }
function updateInfoData(person) { return person; }
// Real scheduleFindAGraveSend() staggers calls via setTimeout, which this
// test's synchronous assertions (expecting the mocked chrome.runtime.
// sendMessage callback to have already fired by the time each assertion
// runs) aren't set up to wait for - that staggering behavior itself has
// its own dedicated test (test_findagrave_request_stagger.js). Here it's
// an incidental dependency of getFindAGraveFamily(), not what's under
// test, so it's stubbed to call through immediately.
function scheduleFindAGraveSend(sendFn) { sendFn(); }

function freshCtx() {
    global.familystatus = [];
    global.alldata = { family: { spouse: [] } };
    global.databyid = {};
    global.focusgender = 'unknown';
    const fn = new Function(
        '$', 'exists', 'stripInlineEventHandlers', 'addEvent', 'isChild', 'isSibling', 'isParent',
        'isPartner', 'cleanHTML', 'escapeHtml', 'startsWithHTTP', 'hostDomain', 'updateInfoData',
        'scheduleFindAGraveSend', 'familystatus', 'alldata', 'databyid',
        extractFunction('getFindAGraveName') + '\n' +
        extractFunction('parseFindAGrave') + '\n' +
        extractFunction('getFindAGraveFamily') + '\n' +
        'return { getFindAGraveFamily: getFindAGraveFamily, getFindAGraveName: getFindAGraveName };'
    )($, exists, stripInlineEventHandlers, addEvent, isChild, isSibling, isParent,
        isPartner, cleanHTML, escapeHtml, startsWithHTTP, hostDomain, updateInfoData,
        scheduleFindAGraveSend, global.familystatus, global.alldata, global.databyid);
    return fn;
}

function makeChrome(canned) {
    return { runtime: { sendMessage: function (msg, callback) { callback(canned); } } };
}

// --- getFindAGraveName() direct guard ---
(function () {
    const ctx = freshCtx();
    var threw = false;
    var result;
    try { result = ctx.getFindAGraveName(undefined); } catch (e) { threw = true; }
    assertEqual(threw, false, "getFindAGraveName(undefined): no longer throws");
    assertEqual(result, "", "getFindAGraveName(undefined): degrades to an empty string");
})();

// --- getFindAGraveFamily(): the live-reported hang, reproduced ---
// Neither ".plus2 b" nor a matching "#bio-name" exists on this page -
// the exact condition that made fperson end up empty live.
(function () {
    const ctx = freshCtx();
    global.chrome = makeChrome({ source: '<html><body><title>Some Other Page</title></body></html>', variable: { title: 'spouse', profile_id: 7, itemId: '999' } });
    var threw = false;
    try {
        ctx.getFindAGraveFamily(0, 'https://www.findagrave.com/memorial/999/someone', { title: 'spouse', profile_id: 7, itemId: '999' });
    } catch (e) { threw = true; }
    assertEqual(threw, false, "getFindAGraveFamily(): a family member's page matching neither name selector no longer throws out of the function");
    assertEqual(global.familystatus.length, 0, "getFindAGraveFamily(): familystatus returns to empty instead of staying stuck - this is what actually unblocks updateGeo()'s poll loop");
    assertEqual(global.databyid[7].name, "", "getFindAGraveFamily(): degrades to a blank name rather than crashing - visibly incomplete but reviewable, not a hang");
})();

// --- Regression check: a normal, valid family member page still works ---
// The ".plus2" div is deliberately nested inside an extra wrapper, not a
// direct child of <body> - jQuery's HTML-string parsing flattens a direct
// child of <body>/<head> to the top level, which .find() then can't reach
// (the same quirk documented in CLAUDE.md's #335 writeup). Un-nesting it
// would make this fixture accidentally exercise that different, unrelated
// bug instead of the plain "name found correctly" success path this case
// is meant to cover.
(function () {
    const ctx = freshCtx();
    const html = '<html><body><div>' +
        '<div class="plus2"><b>Jane Doe</b></div>' +
        '<title>Jane Doe (1900-1980) - Find A Grave Memorial</title>' +
        '</div></body></html>';
    global.chrome = makeChrome({ source: html, variable: { title: 'spouse', profile_id: 7, itemId: '999' } });
    ctx.getFindAGraveFamily(0, 'https://www.findagrave.com/memorial/999/jane-doe', { title: 'spouse', profile_id: 7, itemId: '999' });
    assertEqual(global.familystatus.length, 0, "getFindAGraveFamily(): a normal, valid response still pops familystatus (success path unaffected)");
    assertTrue(exists(global.databyid[7]), "getFindAGraveFamily(): a normal, valid response still records the person under its real profile_id (success path unaffected)");
    assertEqual(global.databyid[7].name, "Jane Doe", "getFindAGraveFamily(): the parsed name is still correct on the success path");
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
