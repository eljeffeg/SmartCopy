// Verifies #304 (live-reported, DanCornett): checking a Burial location
// field incorrectly checked the DEATH location's own top-box
// (.geotopcheck) instead of Burial's - reproduced exactly as reported
// ("Starting with no Death locations selected... put in a Burial location
// string... notice that the Death Location 'top-box' gets pre-selected").
//
// Root cause: handleChecknextClick()'s backward walk (buildform.js) looks
// for the nearest PREVIOUS <tr> with a real id - the geoplace/geoloc rows
// themselves never have one, only each location block's own title row
// does (id="focus_death"/"focus_burial"/etc.). `ps` started ALREADY one
// step back (this row's immediate previous sibling - which, for the very
// first field in a block, IS that block's own title row) - but the loop's
// first action stepped back AGAIN before ever checking it, skipping
// straight past the correct title row into the PRECEDING location block.
// None of that preceding block's own geoloc/geoplace rows have an id
// either, so the walk kept going until it hit THAT block's title row
// instead - checking the wrong location's geotopcheck entirely.
//
// Fixed by starting the walk at the clicked row itself, not already
// stepped back - matches real buildForm() row markup (title row with
// .geotopcheck, then a flat "geoplace" row, then several "geoloc" rows,
// per location) exactly, with two adjacent blocks (Death immediately
// followed by Burial) to reproduce the cross-contamination precisely.
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
    ${extractFunction(bfSrc, 'handleChecknextClick')}
    return { handleChecknextClick };
`)($, exists);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', expected, 'got', actual); }
}

// Mirrors buildForm()'s real row shape for two adjacent single-instance
// location blocks (Death, then Burial) - separator, title row with its own
// .geotopcheck, one flat "geoplace" row, three "geoloc" rows (enough to
// prove the walk correctly skips id-less rows within a block too).
function freshDom() {
    $('body').html(`
        <table>
            <tr><td><div class="separator"></div></td></tr>
            <tr id="focus_death"><td><div class="membertitle"><input type="checkbox" class="geotopcheck"></div></td></tr>
            <tr class="geoplace"><td><input type="checkbox" class="checknext" id="death_place_cb"></td></tr>
            <tr class="geoloc"><td><input type="checkbox" class="checknext" id="death_city_cb"></td></tr>
            <tr class="geoloc"><td><input type="checkbox" class="checknext" id="death_county_cb"></td></tr>
            <tr><td><div class="separator"></div></td></tr>
            <tr id="focus_burial"><td><div class="membertitle"><input type="checkbox" class="geotopcheck"></div></td></tr>
            <tr class="geoplace"><td><input type="checkbox" class="checknext" id="burial_place_cb"></td></tr>
            <tr class="geoloc"><td><input type="checkbox" class="checknext" id="burial_city_cb"></td></tr>
            <tr class="geoloc"><td><input type="checkbox" class="checknext" id="burial_county_cb"></td></tr>
        </table>
    `);
}

function deathTopChecked() { return $('#focus_death .geotopcheck').prop('checked'); }
function burialTopChecked() { return $('#focus_burial .geotopcheck').prop('checked'); }

// --- The exact reported scenario: check Burial's flat Place field (the first field in that block) ---
{
    freshDom();
    var cb = document.getElementById('burial_place_cb');
    cb.checked = true;
    ctx.handleChecknextClick.call(cb);
    assertEqual(burialTopChecked(), true, "#304: checking Burial's own Place field checks BURIAL's own top-box");
    assertEqual(deathTopChecked(), false, "#304: DEATH's top-box stays unchecked - this was the actual reported bug (it was wrongly getting checked instead)");
}

// --- Checking a LATER field within the same block (city, not the first row) - still finds Burial's own title row correctly ---
{
    freshDom();
    var cb = document.getElementById('burial_city_cb');
    cb.checked = true;
    ctx.handleChecknextClick.call(cb);
    assertEqual(burialTopChecked(), true, "Checking a later field (City) in Burial's block still correctly finds Burial's own title row");
    assertEqual(deathTopChecked(), false, "Death's top-box still stays unchecked");
}

// --- Regression control: checking a Death field still correctly checks Death's own top-box (not, say, nothing at all) ---
{
    freshDom();
    var cb = document.getElementById('death_county_cb');
    cb.checked = true;
    ctx.handleChecknextClick.call(cb);
    assertEqual(deathTopChecked(), true, "Regression control: checking a Death field still correctly checks Death's own top-box");
    assertEqual(burialTopChecked(), false, "Burial's top-box correctly stays unchecked when only a Death field was checked");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
