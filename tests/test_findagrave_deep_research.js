// Verifies the Deep Research fallback added to collections/findagrave.js
// after live-reported evidence (Dan Bodenheimer) that findagrave.com is
// actively serving a Cloudflare "Just a moment..." challenge page to at
// least some of SmartCopy's plain background fetches - confirmed via
// debug logging that the fetched response.source was the challenge page
// itself, not real content, for multiple family members in the same
// import. A plain background fetch can never pass that challenge on its
// own (no JS execution); the fix mirrors the same shape already proven
// for Geneanet (#195): fall back to a real hidden browser tab, and once
// any one tab clears the challenge, retry the much cheaper plain fetch
// for everyone else before assuming they all need their own tab.
//
// The actual chrome.tabs.create/executeScript polling loop
// (runFindAGraveTabFetch) isn't unit-tested here, matching this project's
// existing precedent - no other Deep Research site (Geneanet, Filae,
// MyHeritage-new, Online-OFB, Ancestry) has a dedicated test for that
// specific polling mechanic either, since realistically mocking
// chrome.tabs/chrome.scripting's async behavior is low-value, high-
// maintenance work; that part is covered by live/manual QA instead. What
// IS unit-tested here, because it doesn't require any of that mocking:
// the usability heuristic, the deepResearchOn/Off queue-draining switch,
// and the "retry the plain fetch once before trying another tab" logic.
// Extracts the real functions verbatim.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
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

function exists(v) { return typeof v !== 'undefined' && v !== null; }

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) { assertEqual(!!cond, true, label); }

// --- isUsableFindAGravePerson() ---
(function () {
    const isUsable = new Function('exists', extractFunction('isUsableFindAGravePerson') + '\nreturn isUsableFindAGravePerson;')(exists);
    assertEqual(isUsable({ name: "", gender: "unknown" }), false,
        "A blank name with no birth/death (exactly what the Cloudflare challenge page parses as, confirmed live) is not usable");
    assertEqual(isUsable(""), false, "An empty-string person (parseFindAGrave's own merged-memorial no-op return) is not usable");
    assertEqual(isUsable({ name: "Jane Doe" }), true, "A real name alone is usable, even with no dates yet");
    assertEqual(isUsable({ name: "", birth: [{ date: "1900" }] }), true, "A blank name but a real birth date is still usable (sparse-but-real profile)");
    assertEqual(isUsable({ name: "", death: [{ date: "1980" }] }), true, "A blank name but a real death date is still usable");
})();

// --- runNextFindAGraveTabFetch(): Deep Research off drains the queue without touching chrome.tabs ---
(function () {
    global.alldata = { family: { spouse: [] } };
    global.databyid = {};
    global.familystatus = [1, 2];
    global.deepResearchOn = false;
    global.deepResearchSkipRun = false;
    function updateInfoData(person, arg) { return (!exists(person) || person === "") ? arg : person; }
    const ctx = new Function(
        'exists', 'updateInfoData', 'familystatus', 'alldata', 'databyid', 'deepResearchOn', 'deepResearchSkipRun',
        extractFunction('finishFindAGraveFamilyMember') + '\n' +
        extractFunction('runNextFindAGraveTabFetch') + '\n' +
        'var findagraveTabQueue = [{famid: 1, url: "u1", arg: {title: "spouse", profile_id: 1, name: "Fallback One"}}, {famid: 2, url: "u2", arg: {title: "spouse", profile_id: 2, name: "Fallback Two"}}];\n' +
        'var findagraveTabRunning = false;\n' +
        'return { runNextFindAGraveTabFetch: runNextFindAGraveTabFetch, getQueueLength: function () { return findagraveTabQueue.length; } };'
    )(exists, updateInfoData, global.familystatus, global.alldata, global.databyid, global.deepResearchOn, global.deepResearchSkipRun);

    var threw = false;
    try { ctx.runNextFindAGraveTabFetch(); } catch (e) { threw = true; }
    assertEqual(threw, false, "runNextFindAGraveTabFetch(): deepResearchOn=false doesn't throw trying to reach chrome.tabs.*, which isn't even defined in this test");
    assertEqual(ctx.getQueueLength(), 0, "runNextFindAGraveTabFetch(): deepResearchOn=false drains the entire queue immediately");
    assertEqual(global.familystatus.length, 0, "runNextFindAGraveTabFetch(): both queued family members' familystatus entries get popped, not left stuck");
    assertEqual(global.databyid[1].name, "Fallback One", "runNextFindAGraveTabFetch(): each drained entry still falls back to its own URL-slug name guess, not dropped entirely");
    assertEqual(global.databyid[2].name, "Fallback Two", "runNextFindAGraveTabFetch(): ...for every queued member, not just the first");
})();

// --- getFindAGraveFamily(): a successful clearance-likely retry never reaches the tab fallback at all ---
(function () {
    global.alldata = { family: { spouse: [] } };
    global.databyid = {};
    global.familystatus = [];
    let sendCount = 0;
    global.chrome = {
        runtime: {
            sendMessage: function (msg, callback) {
                sendCount++;
                // First call: simulate the Cloudflare challenge (blank parse).
                // Second call (the clearance-likely retry): simulate success.
                if (sendCount === 1) {
                    callback({ source: '<html><body></body></html>', variable: msg.variable });
                } else {
                    callback({ source: '<html><body><div><div class="plus2"><b>Jane Doe</b></div></div></body></html>', variable: msg.variable });
                }
            }
        },
        tabs: { create: function () { throw new Error("should never reach the tab fallback - the clearance-likely retry should have succeeded first"); } }
    };
    function exists2(v) { return typeof v !== 'undefined' && v !== null; }
    function updateInfoData(person, arg) { return (!exists2(person) || person === "") ? arg : person; }
    const dom = new (require('jsdom').JSDOM)('<!DOCTYPE html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    const $ = require(path.join(ROOT, 'jquery.js'));
    if (!String.prototype.contains) {
        String.prototype.contains = function () { return String.prototype.indexOf.apply(this, arguments) !== -1; };
    }

    const ctx = new Function(
        '$', 'exists', 'updateInfoData', 'chrome', 'familystatus', 'alldata', 'databyid',
        'stripInlineEventHandlers', 'addEvent', 'isChild', 'isSibling', 'isParent', 'isPartner',
        'cleanHTML', 'escapeHtml', 'startsWithHTTP', 'hostDomain', 'focusgender',
        extractFunction('getFindAGraveName') + '\n' +
        extractFunction('parseFindAGrave') + '\n' +
        extractFunction('fetchFindAGravePlain') + '\n' +
        extractFunction('isUsableFindAGravePerson') + '\n' +
        extractFunction('finishFindAGraveFamilyMember') + '\n' +
        extractFunction('fetchFindAGraveFamilyViaTab') + '\n' +
        extractFunction('runNextFindAGraveTabFetch') + '\n' +
        extractFunction('getFindAGraveFamily') + '\n' +
        'var findagraveTabQueue = []; var findagraveTabRunning = false; var findagraveClearanceLikely = true; var deepResearchOn = false; var deepResearchSkipRun = false;\n' +
        'return getFindAGraveFamily;'
    )($, exists2, updateInfoData, global.chrome, global.familystatus, global.alldata, global.databyid,
        function (h) { return h; }, function (p) { return p; }, function () { return false; }, function () { return false; },
        function () { return false; }, function () { return false; }, function (h) { return h; }, function (s) { return s; },
        function () { return false; }, function (u) { return u; }, 'unknown');

    var threw = false;
    try {
        ctx(0, 'https://www.findagrave.com/memorial/999/jane-doe', { title: 'spouse', profile_id: 7, itemId: '999', name: 'Jane Doe' });
    } catch (e) { threw = true; console.log(e); }
    assertEqual(threw, false, "getFindAGraveFamily(): the clearance-likely retry path doesn't throw");
    assertEqual(sendCount, 2, "getFindAGraveFamily(): with findagraveClearanceLikely=true, a failed first fetch triggers exactly one retry (not an immediate jump to the tab fallback)");
    assertTrue(exists2(global.databyid[7]), "getFindAGraveFamily(): the retry's successful result gets recorded");
    assertEqual(global.databyid[7].name, "Jane Doe", "getFindAGraveFamily(): the retry's real parsed name wins, not the slug guess - the tab fallback (chrome.tabs.create) was never touched, confirmed by it throwing if called");
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
