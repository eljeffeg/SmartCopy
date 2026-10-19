// Verifies a #332 fix (live-reported, DanCornett): a confirmed console
// stack trace showed a matched CHILD's submission going through the
// brand-new "add-child" path (buildTree(familyout, "add-child", ...)) and
// hitting the #300 "no name selected" skip guard, even though Dan believed
// the child was already matched to an existing Geni profile. His own
// repro sequence: "I explicitly set the Gender to Male, but then
// deselected the Gender" (back to Unknown) - right before the error
// appeared; leaving Gender untouched never reproduced it.
//
// Root cause: the .genderselect 'change' handler (buildform.js,
// updateClassResponse()) rebuilds a family member's entire Action
// dropdown via buildAction(relationship, gender) whenever gender changes
// (so a gendered "son"/"daughter" search can find a more specific match
// than the generic "child" category search) - but this is a full
// `.html()` DOM replace. The fresh <select> it inserts has no 'change'
// handler bound (the real one is attached once, directly and non-
// delegated, inside buildForm() itself - $('.actionselect').on('change',
// ...) - which only ever applies to elements that already existed at
// that moment), and nothing called actionUpdate() for the new selection
// either. So even when buildAction() correctly re-selected the SAME
// matched profile in its fresh HTML, the rest of the row's state (lock
// icons, lock sweep, Geni comparison values via setGeniFamilyData()) was
// never resynced to it - visually "matched" but internally stale,
// exactly the gap that could leave a submission behaving as if nothing
// was ever really selected.
//
// Fixed by re-binding the new <select>'s 'change' handler and
// immediately invoking actionUpdate() on it, right after the HTML
// replace - matching exactly what happens when a user changes the Action
// dropdown by hand.
//
// Uses the real extracted .genderselect handler (not a reimplementation),
// with buildAction() stubbed to return fixed, inspectable markup (its own
// match-finding correctness is already covered by other tests - this
// isolates the specific resync-after-replace gap this fix closes) and a
// spy in place of the real actionUpdate() to verify it's actually invoked
// with the new element, and that a real 'change' event on the new
// dropdown still fires a handler afterward.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

// Brace-counts an anonymous `function () { ... }` starting right after the
// given marker - same technique used elsewhere in this suite
// (test_330_halfsibling_not_reselected.js) for extracting a real,
// non-delegated jQuery click/change handler body on its own.
function extractAnonymousFunctionBody(src, afterMarker) {
    const markerPos = src.indexOf(afterMarker);
    if (markerPos === -1) throw new Error('not found: ' + afterMarker);
    const fnStart = src.indexOf('function () {', markerPos);
    const braceStart = src.indexOf('{', fnStart);
    let depth = 0, i = braceStart;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(braceStart + 1, i);
}

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;
function exists(v) { return typeof v !== 'undefined' && v !== null; }
global.exists = exists;

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// The real .genderselect change handler, extracted via brace-counting
// right after its own unique binding call.
const handlerBody = extractAnonymousFunctionBody(bfSrc, "$('.genderselect').on('change', ");

let actionUpdateCalls = [];
global.actionUpdate = function (el) { actionUpdateCalls.push(el); };
global.buildAction = function (relationship, gender) {
    return '<select name="action" class="actionselect"><option value="add">Add Profile</option><option value="6000000012345" selected>Update: Matched Person</option></select>';
};
global.iconUpdate = function () {};
global.genderColor = function () { return '#fff'; };

const genderChangeHandler = new Function(handlerBody);

function freshRow() {
    $('body').html(`
        <table id="familytable_42">
            <tr><td><select class="genderselect" relationship="child" update="42"><option value="unknown" selected>Unknown</option><option value="male">Male</option></select></td></tr>
            <tr><td id="action42"><select name="action" class="actionselect"><option value="6000000012345" selected>Update: Matched Person</option></select></td></tr>
        </table>
        <div class="membertitle"></div>
        <div class="memberexpand"></div>
    `);
    actionUpdateCalls = [];
}

// --- #332: after a gender change replaces the Action dropdown, actionUpdate() is invoked for the new element. ---
{
    freshRow();
    var genselect = $('.genderselect')[0];
    genderChangeHandler.call(genselect);
    assertEqual(actionUpdateCalls.length, 1, "#332: actionUpdate() is called exactly once after the gender-triggered Action dropdown replace");
    assertTrue(actionUpdateCalls[0] !== undefined && $(actionUpdateCalls[0]).hasClass('actionselect'),
        "#332: actionUpdate() is called with the NEW <select class=\"actionselect\"> element, not something stale");
}

// --- #332: the new dropdown's own 'change' handler is rebound - a later manual selection still triggers a resync, not silently doing nothing. ---
{
    freshRow();
    var genselect = $('.genderselect')[0];
    genderChangeHandler.call(genselect);
    var callsAfterGenderChange = actionUpdateCalls.length;
    $('#action42 select.actionselect').trigger('change');
    assertTrue(actionUpdateCalls.length > callsAfterGenderChange,
        "#332: the freshly-inserted Action dropdown has a working 'change' handler - manually reselecting a match afterward still resyncs the row, instead of being silently inert");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
