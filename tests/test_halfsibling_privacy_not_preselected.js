// Verifies a real gap found while investigating a #304/#300 report
// (live-reported, DanCornett): for an unmatched half-sibling, the
// person-bar correctly shows the half-sibling icon and the Action
// dropdown correctly defaults to "Add Profile" with nothing pre-selected -
// EXCEPT Privacy, which still pre-checked and set itself to Public. Since
// no Name field was ever selected, submitting silently tripped the #300
// guard - but the person-bar indicator had already lit up as if this
// sibling would be copied, which is exactly backwards from the point of
// the half-sibling caution (scored forced false since 2014 - see
// isSibling()'s own comment).
//
// Root cause: buildPrivacySelect() is a wholly separate system from the
// generic isChecked()/isEnabled() every other field goes through - it has
// never known about `scored` or the half-sibling caution at all. Its own
// independent ">150 years old -> default Public, stay enabled" rule fired
// regardless of whether the person was otherwise confidently identified.
//
// Fixed in two places: (1) the initial render now gates Privacy's
// checked/enabled state on `scored`, same as every other field; (2)
// refreshPrivacySelect() - which runs automatically for every member
// right after initial render - now respects the SAME decision (carried
// forward via a data-scored attribute) while still unmatched, so it can't
// immediately undo fix (1) the moment the page finishes loading. The
// caution still correctly lifts once a real Geni match is picked, exactly
// like every other field.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');
const sharedSrc = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');

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

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- Structural: the initial render gates Privacy on scored, and records it for later ---
assertTrue(bfSrc.indexOf('var memberPrivacyEditable = scored && memberPrivacy.enabled;') !== -1,
    "Initial render: Privacy's checked/enabled state is now gated on scored, same as every other field");
assertTrue(bfSrc.indexOf('data-scored="\' + scored + \'"') !== -1,
    "Initial render: scored is recorded as a data attribute for refreshPrivacySelect() to read later");

// --- Behavioral: real refreshPrivacySelect() + buildPrivacySelect() + getGeniData(), real jsdom DOM ---
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;
function exists(v) { return typeof v !== 'undefined' && v !== null; }
global.exists = exists;

const buildPrivacySelect = new Function('return ' + extractFunction(bfSrc, 'buildPrivacySelect'))();
global.buildPrivacySelect = buildPrivacySelect;
const getGeniData = new Function('exists', 'geniPhoto', 'genifamilydata', 'return ' + extractFunction(sharedSrc, 'getGeniData'))(
    exists, function () { return 'images/no_photo_u.gif'; }, {}
);
global.getGeniData = getGeniData;

const refreshPrivacySelectSrc = extractFunction(bfSrc, 'refreshPrivacySelect');
const refreshPrivacySelect = new Function('$', 'exists', 'buildPrivacySelect', 'getGeniData',
    'return ' + refreshPrivacySelectSrc)($, exists, buildPrivacySelect, getGeniData);

const memberId = 'half1';
// A long-deceased (>150yo) candidate - exactly the real-world case
// (Lucille/Richard, born early 1900s) that triggers buildPrivacySelect()'s
// own unconditional ">150 years old -> Public" rule.
function freshDom(scoredAttr, actionValue) {
    $('body').html(`
        <div class="membertitle"><input type="checkbox" class="checkslide"></div>
        <div class="memberexpand">
            <table id="familytable_${memberId}">
                <tr><td><select class="actionselect"><option value="add" selected>Add Profile</option></select></td></tr>
                <tr><td><select name="is_alive" class="livingselect" update="${memberId}"><option value="false" selected>Deceased</option></select></td></tr>
            </table>
            <select class="formselect privacyselect" update="${memberId}" data-birthyear="1850" data-scored="${scoredAttr}">
                <option value="" selected>Auto</option>
            </select>
            <input id="${memberId}_public_checkbox" type="checkbox">
        </div>
    `);
    if (exists(actionValue)) {
        $('.actionselect').val(actionValue);
    }
}

// --- Case 1: unmatched (still "add"), scored=false (the half-sibling caution) - Privacy must NOT enable ---
freshDom("false");
refreshPrivacySelect(memberId);
assertEqual($('#' + memberId + '_public_checkbox').prop('checked'), false,
    "#304: an unmatched half-sibling (scored=false) does NOT get Privacy re-enabled by the automatic post-render resync, even though buildPrivacySelect()'s own >150-years-old rule would otherwise say Public");
assertEqual($('.privacyselect').prop('disabled'), true,
    "The Privacy dropdown itself also stays disabled, not just unchecked");

// --- Case 2: unmatched, scored=true (a normal new sibling, e.g. empty category or scorefactors) - Privacy behaves normally ---
freshDom("true");
refreshPrivacySelect(memberId);
assertEqual($('#' + memberId + '_public_checkbox').prop('checked'), true,
    "A normal (non-halfsibling-cautioned) new sibling still gets Privacy's usual >150-years-old Public default");

// --- Case 3: a REAL Geni match gets picked later - the caution lifts even though data-scored is still stale "false" ---
freshDom("false", "123456");
refreshPrivacySelect(memberId);
assertTrue($('#' + memberId + '_public_checkbox').prop('checked'),
    "#304: once a real Geni match is selected (profile !== \"add\"), the caution correctly lifts - same as every other field once confirmed - even though data-scored is a stale snapshot from the unmatched render");

// --- Case 4: explicit Select All still overrides the caution, same as every other no-op-looking field ---
freshDom("false");
$('.checkslide').prop('checked', true).attr('data-select-all-active', 'true');
refreshPrivacySelect(memberId);
assertTrue($('#' + memberId + '_public_checkbox').prop('checked'),
    "An explicit Select All click still overrides the half-sibling caution for Privacy too, consistent with how Select All already behaves for other fields");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
