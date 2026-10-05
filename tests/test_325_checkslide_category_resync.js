// Verifies #325 (live-reported, DanCornett): clicking a person's own
// top-level .checkslide checkbox directly - not a field underneath them -
// never recomputed the category .checkall header (Parents/Siblings/
// Partners/Children) above it. Reported two ways: clearing the last
// checked child left the category header stuck checked, and manually
// checking a person didn't tick the category header at all.
//
// Root cause: syncTopLevelIndicators()'s only branch keyed off
// $(clickedElement).closest('.memberexpand').length > 0 - which matches a
// field/location click (those live INSIDE .memberexpand), but a
// .checkslide itself lives in the sibling .membertitle, never inside
// .memberexpand, so a direct .checkslide click fell through the function
// entirely and recomputed nothing. test_304_indicator_tiers.js already
// covers the .memberexpand branch (field clicks); this file covers the
// new .checkslide branch and the real click-handler wiring that calls it.
//
// Uses a real jsdom DOM shaped like the actual family panel markup and the
// real extracted syncTopLevelIndicators(), not a reimplementation - same
// convention as test_304_indicator_tiers.js.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
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

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;
function exists(v) { return typeof v !== 'undefined' && v !== null; }
global.exists = exists;

const ctx = new Function('$', 'exists', `
    ${extractFunction(bfSrc, 'syncTopLevelIndicators')}
    return { syncTopLevelIndicators };
`)($, exists);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// Real popup.html/buildform.js markup shape: a category div (Children)
// containing the .checkall header and a fieldset with two people.
function freshChildrenGroup() {
    $('body').html(`
        <div id="children">
            <input type="checkbox" class="checkall" id="addchildck">
            <fieldset class="fieldeffect">
                <div id="childrenval" class="familydiv">
                    <div class="membertitle"><input type="checkbox" class="checkslide" id="p1slide"></div>
                    <div class="memberexpand">
                        <tr><input type="checkbox" class="checknext" id="p1f1"></tr>
                    </div>
                    <div class="membertitle"><input type="checkbox" class="checkslide" id="p2slide"></div>
                    <div class="memberexpand">
                        <tr><input type="checkbox" class="checknext" id="p2f1"></tr>
                    </div>
                </div>
            </fieldset>
        </div>
    `);
}

// --- #325: directly checking a person's own .checkslide ticks the category header ---
{
    freshChildrenGroup();
    var p1slide = $('#p1slide')[0];
    p1slide.checked = true;
    ctx.syncTopLevelIndicators(p1slide);
    assertEqual($('#addchildck').prop('checked'), true,
        "#325: manually checking one person's own checkslide ticks the category header - previously never recomputed at all");
}

// --- #325: clearing the ONLY checked person's checkslide un-ticks the category header ---
{
    freshChildrenGroup();
    var p1slide = $('#p1slide')[0];
    p1slide.checked = true;
    ctx.syncTopLevelIndicators(p1slide);
    assertEqual($('#addchildck').prop('checked'), true, "Sanity: category header checked after person 1 checked");

    p1slide.checked = false;
    ctx.syncTopLevelIndicators(p1slide);
    assertEqual($('#addchildck').prop('checked'), false,
        "#325: clearing the last checked child's own checkslide correctly clears the category header too - this was the exact reported bug (Ralph's own tick-box cleared, Children header stayed checked)");
}

// --- #325: category header stays checked while a DIFFERENT person underneath is still checked ---
{
    freshChildrenGroup();
    var p1slide = $('#p1slide')[0];
    var p2slide = $('#p2slide')[0];
    p1slide.checked = true;
    ctx.syncTopLevelIndicators(p1slide);
    p2slide.checked = true;
    ctx.syncTopLevelIndicators(p2slide);
    assertEqual($('#addchildck').prop('checked'), true, "Both people checked directly - category header checked");

    p1slide.checked = false;
    ctx.syncTopLevelIndicators(p1slide);
    assertEqual($('#addchildck').prop('checked'), true,
        "#325 safety: clearing person 1 directly does NOT clear the category header while person 2 is still checked");
}

// --- #325 safety: a .checkslide click outside any fieldset (shouldn't happen in real markup, but must not throw) ---
{
    $('body').html('<input type="checkbox" class="checkslide" id="orphanslide">');
    var orphan = $('#orphanslide')[0];
    orphan.checked = true;
    let threw = false;
    try { ctx.syncTopLevelIndicators(orphan); } catch (e) { threw = true; }
    assertEqual(threw, false, "#325 safety: a .checkslide with no enclosing fieldset doesn't throw");
}

// ============================================================
// Structural: the real .checkslide click handler in buildform.js actually
// calls syncTopLevelIndicators(this) - same verification convention as
// test_304_indicator_tiers.js's checks on handleChecknextClick/.geotopcheck.
// ============================================================
function extractBetween(src, startMarker, endMarker, fromIndex) {
    const start = src.indexOf(startMarker, fromIndex || 0);
    if (start === -1) throw new Error('not found: ' + startMarker);
    const end = src.indexOf(endMarker, start);
    if (end === -1) throw new Error('end marker not found: ' + endMarker);
    return src.slice(start, end);
}

const checkslideHandler = extractBetween(bfSrc, "$('.checkslide').on('click'", "$('.geoicon').off();");
assertEqual(checkslideHandler.indexOf('syncTopLevelIndicators(this)') !== -1, true,
    "#325: the real .checkslide click handler calls syncTopLevelIndicators(this)");

const syncFnSrc = extractFunction(bfSrc, 'syncTopLevelIndicators');
assertEqual(syncFnSrc.indexOf("hasClass('checkslide')") !== -1, true,
    "#325: syncTopLevelIndicators() has a branch that recognizes a directly-clicked .checkslide (not just a field inside .memberexpand)");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
