// Verifies #218: resolveResearchChainMatch() (popup.js) walks a tab's
// chrome.tabs.get().openerTabId chain to find the Geni focus profile a
// "Research this Person" link chain originated from. This exact mechanism
// regressed 3 times in its own history: no tab-id scoping at all (matched
// the wrong tab entirely), a single-hop-only check (missed a 2+ hop
// chain - tab C opened from tab B opened from Geni tab A), and a missing
// direct-opener case. Extracts the real function verbatim and exercises
// all three of those previously-broken scenarios plus the depth/dead-end
// guards.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');
const sharedSrc = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');

function exists(v) { return typeof v !== 'undefined' && v !== null; }
if (!String.prototype.contains) {
    String.prototype.contains = function () { return String.prototype.indexOf.apply(this, arguments) !== -1; };
}

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

// Real isGeni()/getProfile()/startsWithHTTP(), extracted verbatim from
// shared.js - not reimplementations, so this test exercises the exact
// URL-parsing quirks those functions actually have (e.g. getProfile()'s
// several URL-shape special cases).
const startsWithHTTP = new Function('return ' + extractFunction(sharedSrc, 'startsWithHTTP'))();
const isGeni = new Function('startsWithHTTP', 'return ' + extractFunction(sharedSrc, 'isGeni'))(startsWithHTTP);
const getProfile = new Function('return ' + extractFunction(sharedSrc, 'getProfile'))();

const MAX_OPENER_CHAIN_DEPTH = 5;

// #337 (live-reported, DanCornett - "wrong focus profile picked"):
// resolveResearchChainMatch() now consumes (clears) lastResearchFocus via
// consumeLastResearchFocus() the moment it's used, so a later tab-id reuse
// can never silently reapply a stale match - see that function's own
// comment. Both are extracted together, sharing one real `let
// lastResearchFocus` binding in this wrapper's own scope (mirroring the
// real module-level variable both functions close over in popup.js
// itself), so a test can observe the consumption actually happening, not
// just that the right id gets returned once.
function build(tabsById, initialLastResearchFocus) {
    const chrome = {
        tabs: { get: function (tabId, cb) { cb(tabsById[tabId]); } },
        runtime: { lastError: null },
        storage: { local: { remove: function () { storageRemoveCalls++; } } }
    };
    var storageRemoveCalls = 0;
    const consumeSrc = extractFunction(src, 'consumeLastResearchFocus');
    const resolveSrc = extractFunction(src, 'resolveResearchChainMatch');
    const state = new Function('exists', 'chrome', 'isGeni', 'getProfile', 'MAX_OPENER_CHAIN_DEPTH', 'initialLastResearchFocus', `
        var lastResearchFocus = initialLastResearchFocus;
        ${consumeSrc}
        ${resolveSrc}
        return {
            resolve: resolveResearchChainMatch,
            getLastResearchFocus: function () { return lastResearchFocus; }
        };
    `)(exists, chrome, isGeni, getProfile, MAX_OPENER_CHAIN_DEPTH, initialLastResearchFocus);
    return state;
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- Regression 1: a DIRECT opener (1 hop) whose own tab is a Geni profile page ---
{
    const tabsById = { 10: { url: 'http://www.geni.com/people/John-Smith/6000000012345', openerTabId: undefined } };
    const state = build(tabsById, undefined);
    state.resolve(99, 10, 0, function (id) {
        // getProfile()'s own real return shape for a "people/" URL prefixes
        // "profile-g" - not a bug, that's this helper's real, established
        // convention elsewhere in the app; asserting on it here (rather
        // than a hand-guessed bare id) keeps this test honest about what
        // the real function actually returns.
        assertEqual(id, 'profile-g6000000012345', "#218 (direct opener, 1 hop): a research tab opened directly from a Geni profile tab resolves to that profile");
    });
}

// --- Regression 2: a MULTI-HOP chain (tab C -> opened from tab B -> opened from Geni tab A) ---
{
    const tabsById = {
        20: { url: 'http://www.myheritage.com/some-intermediate-search-results', openerTabId: 10 },
        10: { url: 'http://www.geni.com/people/Jane-Doe/6000000099999', openerTabId: undefined }
    };
    const state = build(tabsById, undefined);
    state.resolve(99, 20, 0, function (id) {
        assertEqual(id, 'profile-g6000000099999', "#218 (multi-hop, 2 levels): a chain through a non-Geni intermediate tab still resolves to the Geni ancestor - a single-hop-only check would have missed this entirely");
    });
}

// --- Regression 3: lastResearchFocus matches the OPENER tab specifically (not just the current tab) ---
{
    const tabsById = { 10: { url: 'http://example.com/not-geni-at-all', openerTabId: undefined } };
    const lastResearchFocus = { tabId: 10, id: '6000000055555' };
    const state = build(tabsById, lastResearchFocus);
    state.resolve(99, 10, 0, function (id) {
        assertEqual(id, '6000000055555', "#218: lastResearchFocus recorded against the OPENER tab (not just the current tab) still resolves correctly");
    });
}

// --- Dead end: opener chain exhausted with nothing Geni-related at all ---
{
    const tabsById = { 10: { url: 'http://example.com/nothing-relevant', openerTabId: undefined } };
    const state = build(tabsById, undefined);
    state.resolve(99, 10, 0, function (id) {
        assertEqual(id, undefined, "A chain that never reaches a Geni tab or a recorded focus resolves to undefined, not a wrong guess");
    });
}

// --- Depth guard: a very long chain must stop at MAX_OPENER_CHAIN_DEPTH, not recurse forever ---
{
    const tabsById = {};
    for (let i = 0; i < 10; i++) {
        tabsById[i] = { url: 'http://example.com/hop-' + i, openerTabId: i + 1 };
    }
    const state = build(tabsById, undefined);
    state.resolve(99, 0, 0, function (id) {
        assertEqual(id, undefined, "A chain longer than MAX_OPENER_CHAIN_DEPTH stops safely instead of recursing indefinitely");
    });
}

// --- Closed/gone ancestor tab (chrome.runtime.lastError) - must not throw ---
{
    const tabsById = {}; // tabs.get callback receives undefined for a closed tab
    const state = build(tabsById, undefined);
    state.resolve(99, 10, 0, function (id) {
        assertEqual(id, undefined, "An opener tab that's since been closed resolves to undefined instead of throwing");
    });
}

// --- #337: a match consumes (clears) lastResearchFocus - a later call against
// the SAME now-stale value (simulating Chrome reusing that tab id for a
// completely unrelated later tab) must not match again. ---
{
    const tabsById = { 10: { url: 'http://example.com/not-geni-at-all', openerTabId: undefined } };
    const lastResearchFocus = { tabId: 10, id: '6000000055555' };
    const state = build(tabsById, lastResearchFocus);
    state.resolve(99, 10, 0, function (id) {
        assertEqual(id, '6000000055555', "#337: the first, legitimate use still resolves correctly");
    });
    assertEqual(state.getLastResearchFocus(), null,
        "#337: lastResearchFocus is cleared immediately after being used - a reused tab id later has nothing left to coincidentally match");

    // Simulate exactly the bug: tab id 10 gets closed and Chrome later
    // reuses it for a totally unrelated tab. The stale lastResearchFocus
    // this test started with is gone now (cleared above) - a second
    // resolution against tab id 10 must NOT silently reapply it.
    state.resolve(99, 10, 0, function (id) {
        assertEqual(id, undefined, "#337: a later, unrelated tab reusing the same numeric tab id no longer inherits the stale research focus");
    });
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
