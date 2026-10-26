// Verifies #355 (live-reported, DanCornett): "Divorce & Baptism locations
// preselected with no values present on either side ... and can't be
// deselected specifically." Dan later found the exact mechanism, reported
// independently in the same issue: "Toggling the Marriage Date ALSO
// toggles the Baptism location tick-box. Toggling the Death Date ALSO
// toggles the Divorce location tick-box. Those two toggle in lock-step."
//
// Both reports are the SAME root cause. syncGeotopcheckState() walks
// FORWARD from a location's own header row (id="<member>_<title>") through
// sibling <tr> elements, treating everything as "this location's own
// children" until it reaches a sibling that has a real id - the next
// title's own location header row. But a family member's DATE row (built
// by buildDateFieldRow() via three separate call sites in buildform.js,
// one per code branch) was NEVER given its own id at all - only the focus
// profile's date row was (rowIdAttr: ' id="' + title + 'date"'). So the
// walk from one title's location header never stopped at the NEXT title's
// date row - it kept going, silently absorbing that date row as if it
// were one of ITS OWN location's children, and stopped only once it
// reached the NEXT title's own location header.
//
// Concretely: Baptism's own "any child checked" walk continued straight
// through Baptism's own (unchecked, nothing-scraped) location rows and
// into Marriage's date row - and if Marriage's date happened to be
// genuinely pre-selected (a real, differing scraped date), Baptism's
// geotopcheck read that as "something under me is checked" and showed
// checked too, right from initial render (setGeniFamilyData() already
// runs syncTopLevelIndicators()/syncGeotopcheckState() for every
// auto-matched member via iconUpdate() -> actionUpdate() at page-build
// time, not just on a manual Action-dropdown switch). Clicking Baptism's
// own geotopcheck to clear it re-triggered the same walk immediately
// afterward, finding Marriage's date still checked and flipping it right
// back - "can't be deselected specifically." Only unchecking Marriage's
// own date (e.g. via a bulk deselect) actually fixed it, matching Dan's
// own observation.
//
// Fixed by giving every family-member date row a real, member-namespaced
// id (id="<member>_<title>date", matching the focus profile's own
// "<title>date" convention) at all three render call sites, so the walk
// correctly stops there instead of swallowing it.
//
// Uses the REAL extracted syncGeotopcheckState() against markup shaped
// exactly like the real two-title sequence (Baptism's own location block
// immediately followed by Marriage's date row then Marriage's own
// location block) - not a reimplementation.
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

const syncGeotopcheckState = new Function('$', 'exists', 'return ' + extractFunction(bfSrc, 'syncGeotopcheckState'))($, exists);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// --- Structural: all three family-member date-row render call sites now emit a member-namespaced row id. ---
assertTrue(bfSrc.indexOf("rowIdAttr: ' id=\"' + i + '_' + title + 'date\"'") !== -1,
    "#355: the buildDateFieldRow() call site (obj[item].date exists branch) now passes a real rowIdAttr");
assertEqual((bfSrc.match(/'<tr id="' \+ i \+ '_' \+ title \+ 'date" ' \+ hiddenRowAttrs/g) || []).length, 2,
    "#355: both raw-string fallback branches (!dateadded, and the obj-doesn't-exist-at-all else branch) now open their <tr> with the same real id");

// Real markup shape: member "2"'s Baptism location block (header with real
// id, then unchecked geoloc children with NO id - exactly like the real
// render), immediately followed by that SAME member's Marriage date row.
// The dateRowIdAttr param lets the test reproduce both the buggy (no id)
// and fixed (real id) shapes with the real syncGeotopcheckState() unchanged.
function freshTwoTitleSequence(dateRowIdAttr, marriageDateChecked) {
    $('body').html(`
        <table>
            <tr id="2_baptism"><td><input type="checkbox" class="geotopcheck" id="baptismgeotop"></td></tr>
            <tr class="geoloc"><td><input type="checkbox" class="checknext" id="baptismcity"></td></tr>
            <tr class="geoloc"><td><input type="checkbox" class="checknext" id="baptismstate"></td></tr>
            <tr${dateRowIdAttr}><td><input type="checkbox" class="checknext" id="marriagedate" ${marriageDateChecked ? 'checked' : ''}></td></tr>
            <tr id="2_marriage"><td><input type="checkbox" class="geotopcheck" id="marriagegeotop"></td></tr>
            <tr class="geoloc"><td><input type="checkbox" class="checknext" id="marriagecity"></td></tr>
        </table>
    `);
}

// --- #355: Marriage's date row, correctly given its own id (the fix), stops Baptism's walk from swallowing it. ---
{
    freshTwoTitleSequence(' id="2_marriagedate"', true);
    syncGeotopcheckState($('table'));
    assertEqual($('#baptismgeotop').prop('checked'), false,
        "#355: with the fix (Marriage's date row has its own id), Baptism's geotopcheck walk correctly stops before reaching Marriage's date row - no longer reads as 'something under Baptism is checked' just because Marriage's own date is checked");
    assertEqual($('#marriagegeotop').prop('checked'), false,
        "Safety: Marriage's own geotopcheck is correctly unaffected too - Marriage's own location children (just marriagecity here) are genuinely unchecked");
}

// --- #355 bug reproduction: Marriage's date row WITHOUT an id (the pre-fix shape) gets silently swallowed into Baptism's walk. ---
{
    freshTwoTitleSequence('', true);
    syncGeotopcheckState($('table'));
    assertEqual($('#baptismgeotop').prop('checked'), true,
        "#355 bug reproduction: without an id on Marriage's date row, Baptism's 'any child checked' walk incorrectly continues past Baptism's own (unchecked) children into Marriage's date row and reads it as checked - exactly Dan's 'Baptism location preselected with no values present' symptom, and exactly why toggling Marriage's date also flipped Baptism's own checkbox");
}

// --- Safety: with the fix, Baptism's geotopcheck still correctly reflects its OWN genuinely checked children. ---
{
    freshTwoTitleSequence(' id="2_marriagedate"', false);
    $('#baptismcity')[0].checked = true;
    syncGeotopcheckState($('table'));
    assertEqual($('#baptismgeotop').prop('checked'), true,
        "Safety: Baptism's geotopcheck still correctly shows checked when one of its OWN real children (baptismcity) is checked - the fix only stops the walk at the right boundary, it doesn't break the normal case");
}

// --- Safety: with the fix, nothing checked anywhere (including Marriage's date) leaves Baptism's geotopcheck correctly unchecked. ---
{
    freshTwoTitleSequence(' id="2_marriagedate"', false);
    syncGeotopcheckState($('table'));
    assertEqual($('#baptismgeotop').prop('checked'), false,
        "Safety: with Marriage's date genuinely unchecked too, Baptism's geotopcheck correctly stays unchecked - matches Dan's own observation that once Marriage's date is cleared, Baptism's location 'is properly handled' from then on");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
