// Verifies #330 (live-reported, DanCornett): a half-sibling is correctly
// excluded from pre-selection at initial render (buildform.js already sets
// scored=false for one), but re-checking a whole category via its
// top-level .checkall header (e.g. clearing "Siblings" then clicking it
// back on) ignored that caution entirely and selected every half-sibling
// right along with full siblings. Dan: "re-selecting by using the
// 'category' tick-box, ALL siblings are selected ... even the
// half-siblings... I think this action should look like the initial
// pre-select screen." Clearing the category (unchecking) was already
// correct and must stay that way - only the CHECK direction needed fixing.
//
// Root cause: the category-wide .checkall click handler (popup.js) force-
// checks every non-excluded checkbox in the fieldset - person-level
// .checkslide included - with no awareness of half-sibling status at all,
// only a blank/no-op exclusion (isFieldEmptyForCheckAll()) that doesn't
// apply to a .checkslide row (it has no value fields of its own to be
// blank). Fixed by stamping data-halfsibling on each .checkslide at
// render time (buildform.js) and excluding it from the force-check pass
// specifically when selectingAll is true.
//
// Uses a real jsdom DOM shaped like the actual category markup and the
// REAL extracted .checkall click handler (not a reimplementation) - same
// convention as test_304_indicator_tiers.js/test_325_checkslide_category_resync.js
// for this exact handler.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

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

// Brace-counts an anonymous `function () { ... }` starting at the given
// marker, same technique extractFunction() uses for named functions -
// returns just the body between the outer braces (not including them),
// ready to splice directly into a new Function(...) wrapper.
function extractAnonymousFunctionBody(src, afterMarker) {
    const markerPos = src.indexOf(afterMarker);
    if (markerPos === -1) throw new Error('not found: ' + afterMarker);
    const fnStart = src.indexOf('function () {', markerPos);
    if (fnStart === -1) throw new Error('no anonymous function found after marker');
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

// Real isFieldEmptyForCheckAll() - for a .checkslide's own row (no value
// fields of its own), it returns false immediately without ever touching
// its buildform.js dependencies, so those don't need to be wired in here.
global.isFieldEmptyForCheckAll = new Function('exists', 'return ' + extractFunction(popupSrc, 'isFieldEmptyForCheckAll'))(exists);
// Not under test here (already covered by its own .geotopcheck tests) -
// stubbed so the real handler's own trailing call to it doesn't throw.
global.syncGeotopcheckState = function () {};

// The real category-wide .checkall click handler.
const checkallHandlerBody = extractAnonymousFunctionBody(popupSrc, "$('.checkall').on('click', ");
const checkallHandler = new Function(checkallHandlerBody);

// Rebinds the real handler to whatever .checkall currently exists - must
// run AFTER each freshSiblingGroup() rebuild, since replacing body.html()
// destroys the old elements (and their listeners) and creates brand new
// ones that nothing is bound to yet. The real app only ever builds this
// markup once per popup open, so this ordering requirement is purely a
// test-harness artifact, not something the real code has to handle.
function bindCheckallHandler() {
    $('.checkall').on('click', checkallHandler);
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// Real popup.html/buildform.js markup shape: a Siblings category with the
// .checkall header and a fieldset holding one full sibling and one half
// sibling, each with their own data-halfsibling attribute exactly as
// buildForm() now stamps it.
function freshSiblingGroup() {
    $('body').html(`
        <div id="sibling">
            <input type="checkbox" class="checkall" id="addsiblingck">
            <fieldset class="fieldeffect">
                <div id="siblingval" class="familydiv">
                    <table><tr><td><input type="checkbox" class="checkslide" id="fullslide" data-halfsibling="false"></td></tr></table>
                    <table><tr><td><input type="checkbox" class="checkslide" id="halfslide" data-halfsibling="true"></td></tr></table>
                </div>
            </fieldset>
        </div>
    `);
    bindCheckallHandler();
}

// --- #330: category re-check selects the full sibling, excludes the half-sibling ---
// Starts unchecked (fresh markup default) - a real .trigger('click') natively
// toggles it to checked=true BEFORE the bound handler runs (same ordering
// #287 established), exactly like an actual user click. Never chain a
// .prop('checked', X) immediately before .trigger('click') on the same
// element - the native toggle fires after the prop and silently overrides it.
{
    freshSiblingGroup();
    $('#addsiblingck').trigger('click');
    assertEqual($('#fullslide').prop('checked'), true, "#330: re-checking the category selects a full sibling, as before");
    assertEqual($('#halfslide').prop('checked'), false,
        "#330: re-checking the category does NOT select a half-sibling - the exact reported bug (previously both got checked)");
}

// --- #330 safety: clearing the category still clears EVERYONE, half-siblings included (Dan confirmed this direction already worked) ---
{
    freshSiblingGroup();
    $('#fullslide').prop('checked', true);
    $('#halfslide').prop('checked', true);
    $('#addsiblingck')[0].checked = true; // setup only, no event - starts in the "checked" state a real click will toggle off
    $('#addsiblingck').trigger('click');
    assertEqual($('#fullslide').prop('checked'), false, "Deselecting the category clears the full sibling");
    assertEqual($('#halfslide').prop('checked'), false,
        "#330 safety: deselecting the category still clears the half-sibling too - this direction must stay unaffected by the fix");
}

// --- #330 safety: a half-sibling can still be checked individually, just not via the bulk category action ---
{
    freshSiblingGroup();
    $('#halfslide').prop('checked', true);
    assertEqual($('#halfslide').prop('checked'), true,
        "#330 safety: directly checking a half-sibling's own box still works - only the category-wide bulk action excludes them");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
