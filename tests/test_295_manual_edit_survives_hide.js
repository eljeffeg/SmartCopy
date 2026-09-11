// Verifies #295 (live-reported, DanCornett): text typed into a field
// after clicking "Show all fields" used to get hidden again the next
// time "Hide unused fields" ran, because that toggle only ever checked
// the row's static data-hasvalue attribute (a snapshot taken at render
// time) - it never reflected a manual edit made afterward. Confirmed via
// a real jsdom DOM: the OLD logic (bare '.hiddenrow[data-hasvalue="false"]'
// selector) hides a manually-typed value; the fix re-checks the row's own
// current text/textarea value first and only re-collapses genuinely-
// still-blank rows.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
const bfSrc = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');

function extractShowHideHandler(src) {
    const marker = "$('.showhide').on('click', function () {";
    const start = src.indexOf(marker);
    if (start === -1) throw new Error('showhide handler not found');
    const bodyStart = src.indexOf('{', start);
    let depth = 0, i = bodyStart;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(bodyStart, i + 1);
}

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require('' + ROOT + '/jquery.js');

const SHOW_LESS_LABEL = "Hide unused fields";
const SHOW_ALL_LABEL = "Show all fields";
function geoAnySourceEnabled() { return false; }

const handlerBody = extractShowHideHandler(bfSrc);
const clickHandler = new Function('$', 'SHOW_LESS_LABEL', 'SHOW_ALL_LABEL', 'geoAnySourceEnabled',
    'return function () ' + handlerBody
)($, SHOW_LESS_LABEL, SHOW_ALL_LABEL, geoAnySourceEnabled);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

$('body').html(`
    <table>
        <tr><td><span class="showhide">${SHOW_ALL_LABEL}</span></td></tr>
        <tr class="hiddenrow" data-hasvalue="false" style="display: none;">
            <td><input type="text" name="middle_name" value=""></td>
        </tr>
        <tr class="hiddenrow" data-hasvalue="false" style="display: none;">
            <td><textarea name="about_me"></textarea></td>
        </tr>
        <tr class="hiddenrow" data-hasvalue="false" style="display: none;">
            <td><input type="text" name="suffix" value=""></td>
        </tr>
        <tr class="hiddenrow" data-hasvalue="false" style="display: none;">
            <td><input type="text" class="formtext genislideinput" value="Geni's own comparison text" disabled>
                <input type="text" name="maiden_name" value=""></td>
        </tr>
    </table>
`);

const toggle = $('.showhide')[0];
clickHandler.call(toggle); // Show all fields

$('input[name="middle_name"]').val('William');
$('textarea[name="about_me"]').val('Some manually-typed biography text.');
// maiden_name row's OWN editable field stays blank - only its unrelated
// .genislideinput companion (Geni's read-only comparison value) has text.

clickHandler.call(toggle); // Hide unused fields

assertEqual($('input[name="middle_name"]').closest('tr').css('display'), 'table-row',
    "A manually-typed text value (Dan's own example: Middle Name) survives 'Hide unused fields'");
assertEqual($('textarea[name="about_me"]').closest('tr').css('display'), 'table-row',
    "A manually-typed textarea value (About) also survives");
assertEqual($('input[name="suffix"]').closest('tr').css('display'), 'none',
    "A row nobody touched (Suffix) still correctly re-collapses");
assertEqual($('input[name="maiden_name"]').closest('tr').css('display'), 'none',
    "The read-only .genislideinput companion's own text doesn't count as 'has a value' - only the row's real editable field does");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
