// Verifies the #325 "reversed toggle" (live-reported, DanCornett,
// 2026-10-12/13): after using the pencil "Edit Location" flow, a
// location's own top checkbox and the person's/focus's top checkbox got
// into what looked like a reversed relationship - clicking one set the
// other instead of clearing both. Dan: "I'm fearful this may be more than
// cosmetic."
//
// Root cause: setLocationFieldChecked() (the "Update Location" flow) sets
// EVERY location row's checked state - both the flat "Place" row and the
// full structured City/County/State/Country/Latitude/Longitude breakdown -
// regardless of which view is actually visible. Whichever view ISN'T
// active is marked "geohidden" and excluded from submission entirely
// (parseForm()), but its checkbox can still be checked underneath. Two
// functions counted checked state without excluding hidden rows, unlike
// every other bulk checkbox operation in this codebase (the .checkall
// handler, applySelectAllState(), isFieldEmptyForCheckAll()), which all
// already skip display:none rows:
//
// 1. syncTopLevelIndicators() - a hidden checked row kept the person's/
//    focus's own top-level checkbox stuck checked even when nothing
//    VISIBLE was selected (Dan's first symptom: "it looks like there
//    ought to be fields to update... but then they spend time opening
//    those details and not finding anything").
// 2. syncGeotopcheckState() - after a bulk "uncheck everything" pass
//    correctly skipped the hidden row (leaving it still checked), this
//    function recomputed the location's own top checkbox from ALL
//    children regardless of visibility, flipping it back ON (Dan's
//    second symptom: "clicking on the top-level tick-box clears that
//    one, but sets the Birth location top-level tick-box").
//
// Uses a real jsdom DOM shaped like the actual flat/structured location
// markup and the REAL extracted functions (not reimplementations).
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
    ${extractFunction(bfSrc, 'hasVisibleCheckedField')}
    ${extractFunction(bfSrc, 'syncTopLevelIndicators')}
    ${extractFunction(bfSrc, 'syncGeotopcheckState')}
    return { syncTopLevelIndicators, syncGeotopcheckState };
`)($, exists);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// Real markup shape: a location block with a hidden flat "Place" row
// (checked, leftover from a pencil-edit correction that set it regardless
// of visibility) and a visible structured breakdown, all unchecked.
function freshLocationBlock() {
    $('body').html(`
        <div class="membertitle"><input type="checkbox" class="checkslide" id="personslide"></div>
        <div class="memberexpand">
            <table>
                <tr id="birth_location"><td><input type="checkbox" class="geotopcheck" id="geotop"></td></tr>
                <tr class="geoplace" style="display:none"><td><input type="checkbox" class="checknext" id="flatplace" checked></td></tr>
                <tr class="geoloc" style="display:table-row"><td><input type="checkbox" class="checknext" id="city"></td></tr>
                <tr class="geoloc" style="display:table-row"><td><input type="checkbox" class="checknext" id="county"></td></tr>
                <tr class="geoloc" style="display:table-row"><td><input type="checkbox" class="checknext" id="state"></td></tr>
                <tr class="geoloc" style="display:table-row"><td><input type="checkbox" class="checknext" id="country"></td></tr>
                <tr class="geoloc" style="display:table-row"><td><input type="checkbox" class="checknext" id="lat"></td></tr>
                <tr class="geoloc" style="display:table-row"><td><input type="checkbox" class="checknext" id="lon"></td></tr>
            </table>
        </div>
    `);
}

// --- #325 symptom 1: a hidden checked row must not keep the person/focus top box checked. ---
{
    freshLocationBlock();
    ctx.syncTopLevelIndicators($('#geotop')[0]);
    assertEqual($('#personslide').prop('checked'), false,
        "#325: a hidden (geohidden) checked location row does NOT count toward the person's own top-level checkbox - nothing visible is selected");
}

// --- #325 symptom 1, safety: a VISIBLE checked row still correctly sets the top box. ---
{
    freshLocationBlock();
    $('#city')[0].checked = true;
    ctx.syncTopLevelIndicators($('#geotop')[0]);
    assertEqual($('#personslide').prop('checked'), true,
        "Safety: a genuinely visible checked field still correctly sets the person's top-level checkbox");
}

// --- #325 symptom 2: a bulk uncheck that skips hidden rows must not leave geotopcheck stuck checked afterward. ---
{
    freshLocationBlock();
    // Mirrors the real .checkall/applySelectAllState bulk-uncheck behavior
    // exactly - it deliberately skips hidden rows (the whole reason this
    // project has that convention: a hidden row is never submitted anyway).
    $('.memberexpand [type="checkbox"]').not('.geotopcheck').each(function () {
        if ($(this).closest('tr').css('display') === 'none') { return; }
        $(this).prop('checked', false);
    });
    assertEqual($('#flatplace').prop('checked'), true, "Sanity: the hidden row is indeed left untouched by the bulk uncheck, same as the real handlers");
    ctx.syncGeotopcheckState($('.memberexpand'));
    assertEqual($('#geotop').prop('checked'), false,
        "#325: the location's own top checkbox (geotopcheck) does NOT snap back checked just because a hidden row was never touched by the bulk uncheck");
}

// --- Safety: a genuinely visible checked child still correctly keeps geotopcheck checked. ---
{
    freshLocationBlock();
    $('#flatplace')[0].checked = false;
    $('#city')[0].checked = true;
    ctx.syncGeotopcheckState($('.memberexpand'));
    assertEqual($('#geotop').prop('checked'), true,
        "Safety: a genuinely visible checked child still correctly keeps geotopcheck checked");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
