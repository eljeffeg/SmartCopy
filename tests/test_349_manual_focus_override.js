// Verifies #349 (live-reported, Dan): SmartCopy auto-picked the wrong Geni
// focus profile in Opera, with no way to correct it - no control to paste
// in a different profile URL/ID and have SmartCopy use that instead.
//
// Added a "Change focus profile" control (near the focus name display,
// popup.html) that persists the typed/pasted profile (parsed via the real
// getProfile(), same parser every other manual-entry path in this codebase
// already uses) to chrome.storage.local, then reloads the whole popup -
// deliberately a full reload rather than trying to re-run the fetch/build
// pipeline in place, since buildForm() (and the family-member equivalent)
// read-then-append to #profiletable's existing HTML rather than clearing
// it first - every EXISTING call path only ever runs them against a freshly
// opened popup, so re-entering in place without reopening would duplicate
// rows instead of replacing them.
//
// On the fresh load, loadPage() checks the newly-added manualFocusOverride
// FIRST, ahead of every existing auto-resolution path (buildhistory match,
// opener-chain resolution) - the user just explicitly set this, a stronger
// signal than any guess - and consumes it exactly once (the same single-use
// pattern #337 already established for lastResearchFocus, so a LATER,
// unrelated page the user navigates to without reopening the popup is never
// silently overridden by a stale choice).
//
// Extracts the REAL override-check block from loadPage() verbatim (not a
// reimplementation), isolated via the same brace-counting technique used
// elsewhere in this suite for pulling one specific `if` block out of a
// larger function.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

function exists(v) { return typeof v !== 'undefined' && v !== null; }

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

// Brace-counts the manualFocusOverride `if` block out of loadPage(), using
// its own unique anchor comment to locate it precisely regardless of
// surrounding code.
function extractManualFocusOverrideBlock() {
    const anchor = '// #349 (live-reported, Dan - Opera auto-picked the wrong Geni';
    const anchorPos = src.indexOf(anchor);
    if (anchorPos === -1) throw new Error('#349 override block anchor not found in loadPage()');
    const ifStart = src.indexOf('if (!profilechanged && exists(manualFocusOverride)', anchorPos);
    if (ifStart === -1) throw new Error('#349 override if-statement not found after its own anchor comment');
    const braceStart = src.indexOf('{', ifStart);
    let depth = 0, i = braceStart;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(ifStart, i + 1);
}

// The real block ends with `loadPage(request); return;` when an override
// IS applied - that `return` exits this whole wrapper early, same as it
// exits the real loadPage(). Captured via the mock loadPage() itself
// (called right before that return fires) rather than a trailing return
// statement of this function's own, which the override case would never
// reach; the no-override case falls through to the same capture repeated
// at the end instead.
function runOverrideCheck(manualFocusOverrideValue) {
    var captured = {};
    var fn = new Function('exists', 'chrome', 'request', 'captured', `
        var focusid = undefined;
        var profilechanged = false;
        var manualFocusOverride = ${JSON.stringify(manualFocusOverrideValue)};
        var loadPageCalls = 0;
        function snapshot() {
            captured.focusid = focusid;
            captured.profilechanged = profilechanged;
            captured.manualFocusOverride = manualFocusOverride;
            captured.loadPageCalls = loadPageCalls;
        }
        function loadPage(r) { loadPageCalls++; snapshot(); }
        ${extractManualFocusOverrideBlock()}
        snapshot();
    `);
    var chrome = { storage: { local: { remove: function (key) { } } } };
    fn(exists, chrome, {}, captured);
    return captured;
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- #349: a set override is applied and consumed ---
{
    var result = runOverrideCheck('profile-g6000000012345678');
    assertEqual(result.focusid, 'profile-g6000000012345678', "#349: the override value is applied as focusid");
    assertEqual(result.profilechanged, true, "#349: profilechanged is set so the rest of loadPage() treats this as resolved");
    assertEqual(result.manualFocusOverride, "", "#349: the override is cleared (consumed) immediately after use - single-use, same as #337's lastResearchFocus");
    assertEqual(result.loadPageCalls, 1, "#349: loadPage() is re-invoked to actually act on the newly-set focusid");
}

// --- Safety: no override set - nothing happens, falls through to the normal auto-resolution checks below it ---
{
    var result = runOverrideCheck(null);
    assertEqual(result.focusid, undefined, "Safety: with no override set, focusid is left untouched for the normal resolution checks further down to handle");
    assertEqual(result.profilechanged, false, "Safety: profilechanged stays false - this block must not claim resolution it didn't actually do");
    assertEqual(result.loadPageCalls, 0, "Safety: loadPage() is not re-invoked when there's nothing to apply");
}
{
    var result = runOverrideCheck("");
    assertEqual(result.profilechanged, false, "Safety: an empty-string override (already consumed, or never set) is treated the same as no override");
}

// --- Structural: the override check runs BEFORE the buildhistory match (ordering matters - explicit user intent beats any guess) ---
{
    const overrideAnchorPos = src.indexOf('if (!profilechanged && exists(manualFocusOverride)');
    const buildhistoryAnchorPos = src.indexOf('if (!profilechanged && focusURLid !== "" &&');
    const okPositive = overrideAnchorPos !== -1 && buildhistoryAnchorPos !== -1 && overrideAnchorPos < buildhistoryAnchorPos;
    if (okPositive) { pass++; console.log('PASS:', "#349: the manual override check is positioned before the buildhistory auto-match in loadPage() - explicit user choice takes priority"); }
    else { fail++; console.log('FAIL:', "#349: the manual override check is positioned before the buildhistory auto-match in loadPage() - explicit user choice takes priority"); }
}

// --- Structural: the storage load / race-avoidance gate is wired up the same way lastResearchFocus already is ---
{
    const checks = [
        ['var manualFocusOverrideLoaded = false;', "manualFocusOverrideLoaded flag is declared"],
        ['domReady && geonoticeLoaded && lastFocusLoaded && manualFocusOverrideLoaded', "maybeStartLogin()'s gate includes manualFocusOverrideLoaded, so get_tab() can't run before it's loaded"],
        ["chrome.storage.local.get('manualFocusOverride', function (result) {", "manualFocusOverride is loaded from chrome.storage.local at startup"],
        ['manualFocusOverrideLoaded = true;', "the loaded flag is set once the storage read completes"]
    ];
    checks.forEach(function (c) {
        if (src.indexOf(c[0]) !== -1) { pass++; console.log('PASS:', c[1]); }
        else { fail++; console.log('FAIL:', c[1]); }
    });
}

// --- Structural: applyManualFocusChange() validates via the real getProfile(), shows an inline error on failure, and persists+reloads on success ---
{
    const fnSrc = extractFunction(src, 'applyManualFocusChange');
    assertEqual(fnSrc.indexOf('getProfile($(\'#changefocusinput\')[0].value)') !== -1, true,
        "#349: applyManualFocusChange() parses the input through the real getProfile(), same as every other manual-entry path");
    assertEqual(fnSrc.indexOf("$('#changefocuserror').text(\"Invalid Profile Id - Try Again\")") !== -1, true,
        "#349: an unparseable entry shows the same inline error text the existing manual-entry flow (loadSelectPage) already uses");
    assertEqual(fnSrc.indexOf("chrome.storage.local.set({manualFocusOverride:") !== -1, true,
        "#349: a valid entry persists manualFocusOverride to chrome.storage.local");
    assertEqual(fnSrc.indexOf('window.location.reload()') !== -1, true,
        "#349: a valid entry reloads the popup so loadPage() picks up the override from a guaranteed-clean state");
}

// --- #349 follow-up (live-reported, Dan, before even testing the base feature): the link's own text should reflect what clicking it will do - "Change focus profile" when closed, "Cancel change of focus" once open. ---
{
    // Brace-counts the real addEventListener('click', function () {...})
    // body out of its unique anchor - same technique used elsewhere in
    // this suite for isolating one specific anonymous handler.
    function extractClickHandlerBody(srcText, anchor) {
        const anchorPos = srcText.indexOf(anchor);
        if (anchorPos === -1) throw new Error('anchor not found: ' + anchor);
        const fnStart = srcText.indexOf('function () {', anchorPos);
        const braceStart = srcText.indexOf('{', fnStart);
        let depth = 0, i = braceStart;
        for (; i < srcText.length; i++) {
            if (srcText[i] === '{') depth++;
            else if (srcText[i] === '}') { depth--; if (depth === 0) break; }
        }
        return srcText.slice(braceStart + 1, i);
    }
    const handlerBody = extractClickHandlerBody(src, "document.getElementById('changefocuslink').addEventListener('click', ");

    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!DOCTYPE html><html><body>' +
        '<span id="changefocuslink">Change focus profile</span>' +
        '<div id="changefocusrow" style="display: none;"><input id="changefocusinput"><div id="changefocuserror" style="display: none;"></div></div>' +
        '</body></html>');
    const $dom = require(path.join(ROOT, 'jquery.js'))(dom.window);
    const clickHandler = new Function('$', 'return function () {' + handlerBody + '};')($dom);
    const link = dom.window.document.getElementById('changefocuslink');

    // jQuery's slideToggle() is an animation (relies on a real layout
    // engine jsdom doesn't have) - stubbed to a plain instant show/hide
    // toggle, since this test is about the TEXT changing correctly, not
    // the animation itself (which has no logic of its own to verify).
    $dom.fn.slideToggle = function () {
        return this.each(function () {
            this.style.display = (this.style.display === 'none' || this.style.display === '') ? 'block' : 'none';
        });
    };

    clickHandler.call(link);
    assertEqual($dom(link).text(), "Cancel change of focus",
        "#349: clicking the link while the box is closed opens it and changes the text to 'Cancel change of focus'");
    assertEqual($dom('#changefocusrow').css('display'), 'block',
        "#349: the box is now visible after the first click");

    clickHandler.call(link);
    assertEqual($dom(link).text(), "Change focus profile",
        "#349: clicking it again while open closes the box and reverts the text to 'Change focus profile'");
    assertEqual($dom('#changefocusrow').css('display'), 'none',
        "#349: the box is hidden again after the second click - this is the 'Cancel' action, no profile change is submitted");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
