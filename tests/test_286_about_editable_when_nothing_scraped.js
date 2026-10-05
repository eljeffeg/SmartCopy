// Verifies #286 (live-reported, DanCornett): when a source page has no
// About/bio text at all - e.g. a FindAGrave memorial with no obituary;
// collections/findagrave.js only sets profiledata["about"] when it finds
// non-blank text (`if (aboutdata.trim() !== "") { profiledata["about"] =
// ...; }`), so "nothing scraped" leaves the property genuinely undefined,
// not "" - buildForm() (buildform.js) took the ELSE branch of
// `if (exists(alldata["profile"].about))` / `if (exists(members[member].about))`
// and hand-rolled a <textarea name="about_me"> with a hardcoded `disabled`
// attribute. That's a leftover from before #304's editability/
// pre-selection split: the IF branch (real or blank-string About) already
// renders via isEnabled(), which never locks the focus profile's or a
// family member's About (no `locked` arg is ever passed as true for this
// field) - so the ELSE branch locking it anyway was inconsistent, and
// meant checking the About tick-box could never make the field typeable
// when the source simply had no bio section.
//
// Structural source check, not a function extraction - both broken
// textareas lived inline inside buildForm(), a single multi-thousand-line
// function not practical to extract/execute standalone (same convention
// test_304_indicator_tiers.js already uses for handler wiring it couldn't
// run directly either). Verifies the real buildform.js source rather than
// reimplementing the template.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

const aboutTextareas = bfSrc.match(/<textarea rows="4" name="about_me"[^>]*>/g) || [];

assertEqual(aboutTextareas.length >= 3, true,
    "Sanity: found the expected About textarea templates (focus else-branch, family-member else-branch, buildAboutFieldRow) - if this is 0, the check below would pass vacuously");

aboutTextareas.forEach(function (tag, idx) {
    assertEqual(/\bdisabled\b/.test(tag), false,
        "#286: About textarea #" + idx + " (" + tag + ") must not hardcode `disabled` - About is never actually locked for the focus profile or a family member, so a field with nothing scraped must stay editable, same as every other field under #304's editability/pre-selection split");
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
