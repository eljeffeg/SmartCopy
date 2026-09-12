// Verifies a latent gap found while investigating #296: the focus
// profile's Middle Name checked/enabled state (namescore && mnameonoff)
// never checked whether the actually-parsed nameval.middleName has a
// real value - a checked-but-visibly-blank Middle Name box risks
// clearing a real Geni middle name if submitted without noticing it's
// blank. The specific case Dan reported (Barbara C Kenney's census
// record) turned out to be a downstream symptom of #289 (the old, wrong
// Geni-sourced focus name producing a genuinely blank middleName after
// NameParse) rather than this gate itself - confirmed via the real
// record: .recordTitle is "Barbara C Kenney" (middleName parses as "C"),
// while .individualInformationName (the old, wrong source before #289)
// is "Barbara Silvis (born Kenney)" (no middle name at all) - but the
// missing value check here is real regardless and worth closing.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- Structural: the value check is now part of the gate ---
assertTrue(src.indexOf('var middleNameChecked = (namescore && mnameonoff && isValue(nameval.middleName)) ? "checked" : "";') !== -1,
    "middleNameChecked now also requires isValue(nameval.middleName)");
assertTrue(src.indexOf('var middleNameEnabled = (namescore && mnameonoff && isValue(nameval.middleName)) ? "" : "disabled";') !== -1,
    "middleNameEnabled matches the same gate, so a disabled field is never shown checked");

// --- Behavioral: mirror the real gate directly ---
function isValue(v) { return v !== ''; }
function computeMiddleNameChecked(namescore, mnameonoff, middleName) {
    return (namescore && mnameonoff && isValue(middleName)) ? 'checked' : '';
}

assertEqual(computeMiddleNameChecked(true, true, ''), '',
    "#296: a genuinely blank scraped middle name is never checked, even with namescore+mnameonoff both on - the exact bug shape reported (checked box, visibly blank value)");
assertEqual(computeMiddleNameChecked(true, true, 'C'), 'checked',
    "A real scraped middle name ('C', from a correctly-resolved focus name) is still checked as before - no regression to the working case");
assertEqual(computeMiddleNameChecked(false, true, 'C'), '',
    "Still respects namescore - no MyHeritage value-add signal for a middle name means no auto-check even with a real value");
assertEqual(computeMiddleNameChecked(true, false, 'C'), '',
    "Still respects the user's own 'Parse for middle names automatically' setting");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
