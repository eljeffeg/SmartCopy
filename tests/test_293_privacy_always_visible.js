// Verifies #293: the Privacy row (focus profile and family member) is
// always visible, never hidden by the #281 "source or Geni has a value"
// check. That check is correct for genuinely-blank-able scraped fields
// (names, gender), but Privacy is a COMPUTED field - buildPrivacySelect()
// always resolves a real Public/Private/Auto decision - so gating its
// visibility on "does an existing Geni match already have an explicit
// value" hid the row entirely for any brand-new group (no parents/
// siblings/etc at all yet on Geni), live-reported across multiple
// relationship categories.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', expected, 'got', actual); }
}

// Focus profile's Privacy row.
assertTrue(src.indexOf("membersstring = membersstring + '<tr ' + hiddenRowAttrs(hidden, true) + '><td class=\"profilediv\"><input type=\"checkbox\" class=\"checknext\" ' + (publiclocked ? 'disabled ' : '') + (focusPrivacy.enabled") !== -1,
    "Focus profile's Privacy row always passes hasValue=true to hiddenRowAttrs()");

// Family-member Privacy row.
assertTrue(src.indexOf("membersstring = membersstring + '<tr ' + hiddenRowAttrs(hidden, true) + '><td class=\"profilediv\"><input id=\"' + i + '_public_checkbox\"") !== -1,
    "Family-member Privacy row always passes hasValue=true to hiddenRowAttrs()");

// Regression: the old broken gate must not remain anywhere.
assertEqual(src.indexOf('genifocusdata.get("public") === true || genifocusdata.get("public") === false'), -1,
    "The old Geni-only visibility check for the focus Privacy row is gone");
assertEqual(src.indexOf('var memberGeniPublicHasValue'), -1,
    "The old memberGeniPublicHasValue variable (Geni-match-only check) is gone");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
