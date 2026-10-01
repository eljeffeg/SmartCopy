// Verifies a real UX bug (live-reported, DanCornett: "a couple of red
// errors flashed quickly on the screen... they did NOT get created"):
// noerror - the flag submitWait() uses to decide whether to hide the
// message banner once the "Geni Tree Updated" recap screen shows - was
// only ever set to false from an actual Geni API error response
// (buildTree()'s own chrome.runtime.sendMessage callback). Every
// client-side skip (no name selected on a new "Add," no update/add/photo
// permission - see #300 and #230) called updateMessage(errormsg, ...)
// correctly, showing the red message for a moment, but never flipped
// this flag - so a real, substantive skip was shown briefly and then
// silently hidden at the final screen, with no way to read it afterward.
//
// Fixed by centralizing this in updateMessage() itself: any call with the
// error color now marks the run as having had a real problem, regardless
// of which of the many call sites raised it - so no future error path can
// forget to flag it either.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
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

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="message" style="display:none;"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;

const errormsg = "#f9acac";
const warningmsg = "#f8ff86";
const updateMessageSrc = extractFunction(src, 'updateMessage');

// Builds a fresh instance each time, with its own noerror starting true -
// mirroring the real module-level var declared elsewhere in popup.js, and
// exposing its final value for assertions (the real function only ever
// mutates the outer noerror as a side effect, same as production).
function freshUpdateMessage() {
    document.getElementById('message').innerHTML = '';
    document.getElementById('message').style.display = 'none';
    var state = { noerror: true };
    var fn = new Function('$', 'document', 'errormsg', 'state',
        'var noerror = state.noerror;\n' +
        updateMessageSrc + '\n' +
        'return { updateMessage: updateMessage, getNoerror: function () { return noerror; } };'
    )($, document, errormsg, state);
    return fn;
}

// --- A single client-side skip (no API error) now correctly flags noerror ---
{
    var ctx = freshUpdateMessage();
    ctx.updateMessage(errormsg, "Skipped creating a new profile with no name selected - check at least First or Last Name before adding: 123");
    assertEqual(ctx.getNoerror(), false,
        "#304/#300 UX fix: a client-side skip message (no Geni API error involved at all) now correctly sets noerror to false");
    assertTrue(document.getElementById('message').innerHTML.indexOf("no name selected") !== -1,
        "The message text itself is still shown, same as before this fix");
}

// --- Multiple accumulated error messages (several skipped members) still only need to flag noerror once ---
{
    var ctx = freshUpdateMessage();
    ctx.updateMessage(errormsg, "Skipped creating a new profile with no name selected - check at least First or Last Name before adding: 111");
    ctx.updateMessage(errormsg, "Geni permission denied - No add permission on: 222");
    assertEqual(ctx.getNoerror(), false, "Multiple accumulated skips still correctly leave noerror false");
    assertTrue(document.getElementById('message').innerHTML.indexOf("111") !== -1 && document.getElementById('message').innerHTML.indexOf("222") !== -1,
        "Both messages are still accumulated in the banner (existing append behavior, unaffected by this fix)");
}

// --- A warning-colored message (not an error) does NOT flag noerror - distinct severity levels stay distinct ---
{
    var ctx = freshUpdateMessage();
    ctx.updateMessage(warningmsg, "Leaving this window before completion could result in an incomplete data copy.");
    assertEqual(ctx.getNoerror(), true,
        "A warning-colored message (not an error) does not affect noerror - only the error color means something genuinely didn't happen");
}

// --- No message at all - noerror stays true, matching a genuinely clean run ---
{
    var ctx = freshUpdateMessage();
    assertEqual(ctx.getNoerror(), true, "A clean run with no updateMessage(errormsg, ...) calls at all leaves noerror true, same as before");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
