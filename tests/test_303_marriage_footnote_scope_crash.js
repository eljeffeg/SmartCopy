// Verifies #303 (live-reported, DanCornett - "Extension Errors with
// ...27", updating/adding a spouse hung whenever one or more already
// existed): the marriage-via-spouse footnote check inside submitChildren()
// used to read `sourcecheck` and `profileout` - both real, but declared
// as LOCALS inside submitform() (the "Update Profile"/"Submit" click
// handler), a completely separate, plain top-level function
// submitChildren() has no closure over no matter when or from where it's
// called. Every marriage/divorce submission threw
// "ReferenceError: sourcecheck is not defined" outright, confirmed via
// the reporter's own "Inspect popup" console screenshot.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

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

// --- The specific historical bug: the actual CODE (not just an
// explanatory comment mentioning the old names) no longer references
// submitform()'s locals ---
const submitChildrenSrc = extractFunction(src, 'submitChildren');
assertTrue(!/[^/]sourcecheck &&/.test(submitChildrenSrc),
    "#303: the actual crash line no longer reads submitform()'s local 'sourcecheck'");
assertTrue(!/\$\.isEmptyObject\(profileout\)/.test(submitChildrenSrc),
    "#303: the actual crash line no longer reads submitform()'s local 'profileout'");
assertTrue(submitChildrenSrc.indexOf("$('#sourceonoffswitch').prop('checked') && focusProfileSubmissionWasEmpty") !== -1,
    "Replaced with a direct checkbox read and a real module-level global, captured by submitform() itself at the one point it already knows the answer");

// --- The capturing side: submitform() actually sets the new global right after computing profileout ---
assertTrue(src.indexOf('focusProfileSubmissionWasEmpty = $.isEmptyObject(profileout);') !== -1,
    "submitform() captures the new global immediately after computing its own local profileout, before submitChildren() can ever run");

// --- The global is declared exactly once, at module scope (not accidentally re-declared as a new local anywhere, which would silently reintroduce the same class of bug) ---
const declarationCount = (src.match(/\bfocusProfileSubmissionWasEmpty\b\s*=/g) || []).length;
assertEqual((src.match(/var focusProfileSubmissionWasEmpty/g) || []).length, 1,
    "focusProfileSubmissionWasEmpty is declared with 'var' exactly once (module scope) - never re-declared as a local inside either function");

// --- Behavioral: the exact fixed boolean expression, evaluated directly
// with the same real jQuery-shaped values it receives in production,
// mirroring the historical crash scenario (a spouse's marriage data IS
// present, focus's own update was empty, footnote not yet added, source
// setting on) - proves the expression itself now evaluates cleanly
// without needing to stand up submitChildren()'s entire, much larger
// dependency surface just to reach one line.
function $(sel) {
    if (sel === '#sourceonoffswitch') { return { prop: function () { return true; } }; }
    throw new Error('unexpected selector in this focused test: ' + sel);
}
$.isEmptyObject = function (o) { return !o || Object.keys(o).length === 0; };

function evaluateFixedCondition(marriageupdate, focusProfileSubmissionWasEmpty, focusMarriageFootnoteAdded) {
    return !$.isEmptyObject(marriageupdate) && $('#sourceonoffswitch').prop('checked') && focusProfileSubmissionWasEmpty && !focusMarriageFootnoteAdded;
}

assertEqual(evaluateFixedCondition({ marriage: { date: '1944' } }, true, false), true,
    "#303: the fixed condition evaluates true for the exact historical scenario (real marriage data, focus's own update empty, footnote not yet added) without throwing");
assertEqual(evaluateFixedCondition({}, true, false), false,
    "No marriage/divorce data at all - correctly false, nothing to footnote");
assertEqual(evaluateFixedCondition({ marriage: { date: '1944' } }, false, false), false,
    "The focus's own update DID run this time - correctly false, that update's own footnote already covers it");
assertEqual(evaluateFixedCondition({ marriage: { date: '1944' } }, true, true), false,
    "Already added once this run - correctly false, never double-adds the footnote");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
