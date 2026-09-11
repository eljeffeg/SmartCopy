// Verifies the "Fix All" bulk case-fix button in updateQMessage()
// (content.js) - an idea borrowed from reviewing pquenee/SmartCopy's fork,
// reimplemented as a text link (matching this UI's existing convention
// for per-person fix actions) with sequenced clicks instead of firing
// every consistency-check [fixCase] link at once.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync('' + ROOT + '/content.js', 'utf8');
const en = JSON.parse(fs.readFileSync('' + ROOT + '/_locales/en/messages.json', 'utf8'));

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
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

assertTrue(en.hasOwnProperty('Fix_All_Case_Issues'), "en/messages.json has a 'Fix_All_Case_Issues' key");

const body = extractFunction(src, 'updateQMessage');

assertTrue(body.indexOf('consistencymessage.indexOf("fixcase") !== -1') !== -1,
    "The button only renders when at least one .fixcase link actually exists this render");
assertTrue(body.indexOf("id='fixallcases'") !== -1, "The button element exists with the expected id");
assertTrue(body.indexOf("_(\"Fix_All_Case_Issues\")") !== -1, "The button label goes through the i18n helper, not a hardcoded string");

assertTrue(body.indexOf("$('#fixallcases').on('click', function (e) {\n            e.preventDefault();") !== -1,
    "The button's click handler prevents default navigation (matches the href='#' pattern used elsewhere)");
assertTrue(body.indexOf("document.querySelectorAll('a.fixcase')") !== -1,
    "Takes a static snapshot of every .fixcase link, not a live collection that would shrink mid-loop as links get replaced");
assertTrue(body.indexOf("fixCaseLinks[index].click()") !== -1,
    "Fires each link via a real DOM .click() (triggers jQuery's delegated handler the same as a genuine user click)");
assertTrue(/setTimeout\(clickNextFixCase, 200\)/.test(body),
    "Clicks are sequenced with a delay between each, not fired all at once in a tight loop");

// Placement: the button must be inserted INSIDE the html() call that
// builds #consistencyck's content (a variable spliced into that string),
// not appended as a separate DOM operation after the fact - otherwise it
// would either never render or would be wiped by the very next
// consistency-check re-render.
assertTrue(body.indexOf('$("#consistencyck").html("<span') !== -1 && body.indexOf('" + fixAllButton + "<img') !== -1,
    "The button variable is spliced directly into the #consistencyck HTML build, not bolted on afterward");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
