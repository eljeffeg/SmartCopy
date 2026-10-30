// Full-script-load smoke test - not tied to any one issue. Every other
// test in this suite extracts ONE function with a hand-picked set of
// dependencies, which proves that function's own logic is correct but
// can never catch a broken reference BETWEEN files - a renamed/removed
// function one file still calls, a typo in a shared helper's name, a
// file that no longer parses when loaded in the real order. This test
// loads every script popup.html actually loads, in the EXACT order
// popup.html lists them (parsed directly from popup.html itself, not a
// hand-maintained duplicate list that could silently drift), into one
// real jsdom window - the same way the real popup does - and asserts
// each one executes with zero errors.
//
// Uses the SAME global.window/global.document/indirect-eval pattern every
// other jsdom-based test in this suite already relies on (not
// window.eval() - jsdom's Window.prototype.eval has different "browser
// global" detection semantics than a real <script> tag, which breaks
// jQuery's own UMD factory in a way that would never happen in the real
// popup; confirmed directly - window.eval() fails even on jquery.js
// itself, cascading into every file after it, a false positive from the
// test harness, not a real bug).
//
// A minimal chrome.* stub is provided because several files (popup.js
// especially - its whole settings-restore block is ~50 top-level
// chrome.storage.local.get() calls) call chrome APIs unconditionally at
// load time, not just inside functions triggered later. background.js is
// deliberately NOT included - it's a separate service-worker context,
// never loaded by popup.html at all.
//
// Scope, confirmed directly by deliberately breaking two different
// things and checking what this test actually catches: a reference that
// only gets evaluated when some OTHER function is later CALLED (e.g.
// renaming a function only invoked from inside buildForm()'s own body)
// is NOT caught here - JS doesn't validate a function body's internal
// references until that function actually runs, so this is a real,
// inherent limit of a load-only smoke test, not a gap in this one. What
// IS caught: anything evaluated at the moment a file loads - a
// registerCollection({...}) call's own property values (confirmed:
// renaming findagrave.js's own `"parseProfileData": parseFindAGrave`
// throws immediately, "parseFindAGraveRENAMED is not defined", exactly
// where you'd want it to), every one of popup.js's ~50 top-level
// chrome.storage.local.get() calls, and any genuine syntax/parse
// failure. That's a real, different blind spot than the rest of this
// suite covers (which validates function BODIES, just never whether two
// files still agree on what to call each other), not a replacement for
// it.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// The authoritative load order, parsed directly from popup.html's own
// <script src="..."> tags - if a future change adds/removes/reorders a
// script there, this test picks it up automatically instead of silently
// testing a stale list.
const popupHtml = fs.readFileSync(path.join(ROOT, 'popup.html'), 'utf8');
const scriptOrder = Array.from(popupHtml.matchAll(/<script src="([^"]+)"><\/script>/g)).map(function (m) { return m[1]; });

assertTrue(scriptOrder.length > 25,
    "popup.html's own <script src> tags were found and parsed (got " + scriptOrder.length + ") - this test tracks the real file, not a hand-maintained copy");
assertTrue(scriptOrder.indexOf('buildform.js') !== -1 && scriptOrder.indexOf('jquery.js') !== -1,
    "The parsed load order includes the expected core files (jquery.js, buildform.js) - a sane parse, not an empty/garbage match");

// Load the REAL popup.html body markup (not a bare shell) - several
// top-level calls in popup.js (event listener wiring especially) expect
// the real elements to already exist, exactly like they do when a real
// browser parses popup.html before running its <script> tags. Strips the
// <script src> tags themselves back out, since those are loaded and
// error-checked separately by this test's own loop below, not by letting
// jsdom fetch them.
const bodyMatch = popupHtml.match(/<body[^>]*>([\s\S]*)<\/body>/);
assertTrue(bodyMatch !== null, "popup.html's own <body> markup was found and extracted");
const bodyMarkup = (bodyMatch ? bodyMatch[1] : '').replace(/<script src="[^"]+"><\/script>/g, '');

const dom = new JSDOM('<!DOCTYPE html><html><body>' + bodyMarkup + '</body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Minimal, safe no-op chrome.* stub - only what's actually called at
// SCRIPT-LOAD time (not inside a function, which never runs during this
// test) needs real behavior; everything else just needs to exist so a
// later function DEFINITION (not invocation) referencing chrome.X doesn't
// throw if it's ever accidentally called during load.
function noop() {}
global.chrome = {
    runtime: {
        sendMessage: noop,
        onMessage: { addListener: noop },
        getManifest: function () { return { version: '0.0.0' }; },
        getURL: function (p) { return 'chrome-extension://stub/' + p; },
        lastError: undefined
    },
    storage: {
        local: {
            get: function (key, callback) { if (typeof callback === 'function') { callback({}); } },
            set: function (items, callback) { if (typeof callback === 'function') { callback(); } },
            remove: function (key, callback) { if (typeof callback === 'function') { callback(); } }
        }
    },
    tabs: { query: noop, create: noop, get: noop, onActivated: { addListener: noop }, onUpdated: { addListener: noop } },
    scripting: { executeScript: noop },
    action: { setIcon: noop, setBadgeText: noop },
    offscreen: undefined
};
global.alert = function () {};
global.confirm = function () { return true; };

// Indirect eval - forces true global scope (so a later file's eval() can
// see an earlier file's function/var declarations, matching real
// sequential <script> tag execution), exactly like the rest of this
// suite's own eval() usage throughout.
const globalEval = eval;

// jquery.js and moment.js are both real UMD libraries - their own wrapper
// checks typeof module/exports, which indirect eval does NOT hide (free
// variable lookups still see this file's own CommonJS module/exports via
// the normal scope chain, eval-directness only affects where NEW
// declarations land). Eval'ing them directly would make them attach to
// THIS TEST FILE's own module.exports instead of becoming the bare
// window-global $/jQuery/moment every other script expects - exactly the
// same reason every other test in this suite require()'s jquery.js
// instead of eval'ing it. Loaded for real via require(), then manually
// attached to window/global so later eval'd plain-script files can find
// them as ambient globals, same as a real <script> tag would.
const UMD_LIBRARIES = { 'jquery.js': ['$', 'jQuery'], 'moment.js': ['moment'] };

let firstError = null;
for (let i = 0; i < scriptOrder.length; i++) {
    const relPath = scriptOrder[i];
    const fullPath = path.join(ROOT, relPath);
    if (UMD_LIBRARIES[relPath]) {
        try {
            const lib = require(fullPath);
            UMD_LIBRARIES[relPath].forEach(function (name) {
                global[name] = lib;
                global.window[name] = lib;
            });
            pass++;
            console.log('PASS:', relPath + ' loaded with no error (' + (i + 1) + '/' + scriptOrder.length + ', via require() - real UMD library)');
        } catch (e) {
            fail++;
            console.log('FAIL:', relPath + ' threw during load: ' + e.message);
            if (!firstError) { firstError = relPath + ': ' + e.message; }
        }
        continue;
    }
    let source;
    try {
        source = fs.readFileSync(fullPath, 'utf8');
    } catch (e) {
        fail++;
        console.log('FAIL:', 'Could not read ' + relPath + ' (' + e.message + ') - popup.html references a file that does not exist on disk');
        if (!firstError) { firstError = relPath + ': file not found'; }
        continue;
    }
    try {
        globalEval(source);
        pass++;
        console.log('PASS:', relPath + ' loaded with no error (' + (i + 1) + '/' + scriptOrder.length + ')');
    } catch (e) {
        fail++;
        console.log('FAIL:', relPath + ' threw during load: ' + e.message);
        if (!firstError) { firstError = relPath + ': ' + e.message; }
    }
}

if (firstError) {
    console.log('\nFirst failure (fix this one first - later files may cascade-fail only because an earlier one never finished defining something they depend on):');
    console.log('  ' + firstError);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
