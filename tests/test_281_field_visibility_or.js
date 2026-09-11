// Verifies #281: a field's visibility under "Hide Empty Fields" is now an
// OR of "source has a value" and "Geni already has a value" - previously
// it only checked the source side, so e.g. a source name split as "John
// Jay" all into First Name left Geni's own real Middle Name hidden, since
// nothing scraped ever populates that specific field. Structural checks
// (this touches ~20 render call sites across focus/family x name fields/
// gender/privacy - a full behavioral harness would need to mock
// genifocusdata/matchedCandidateForEstimate's entire GeniPerson API
// surface, out of proportion to what's being verified here).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// Focus profile: each of the 6 secondary name fields must OR in a check
// against genifocusdata's own value, not just the source (nameval.X).
const focusNameFields = ["title", "middle_name", "maiden_name", "suffix", "display_name"];
focusNameFields.forEach(function (field) {
    var pattern = new RegExp('isValue\\([^)]*\\)\\s*\\|\\|\\s*isValue\\(String\\(genifocusdata\\.get\\("names", namelang \\+ "\\.' + field + '"\\)');
    assertTrue(pattern.test(src), "Focus '" + field + "' row OR's in genifocusdata's own value");
});
assertTrue(/isValue\(nameval\.nickName\) \|\| isValue\(String\(genifocusdata\.get\("nicknames"\)/.test(src),
    "Focus 'nicknames' row OR's in genifocusdata's own value");

// Family member: each of the 6 secondary name fields must OR in a check
// against matchedCandidateForEstimate's own value.
const memberFieldVars = ["memberGeniTitleHasValue", "memberGeniMiddleNameHasValue", "memberGeniMaidenNameHasValue", "memberGeniSuffixHasValue", "memberGeniDisplayNameHasValue", "memberGeniNicknamesHasValue"];
memberFieldVars.forEach(function (varName) {
    assertTrue(src.indexOf(varName) !== -1, "Family-member helper variable '" + varName + "' exists");
    var usagePattern = new RegExp('isValue\\([^)]*\\)\\s*\\|\\|\\s*' + varName + '\\)');
    assertTrue(usagePattern.test(src), "'" + varName + "' is actually OR'd into its row's hiddenRowAttrs() call");
});
assertTrue(src.indexOf('exists(matchedCandidateForEstimate) && exists(matchedMemberNameLang)') !== -1,
    "Family-member Geni-name lookup safely no-ops for an unmatched member (never calls .get() on undefined)");

// Gender: focus profile's "else" branch (source blank OR Geni blank, not
// both known) must OR in genigender too, not just check the source value.
assertTrue(/hiddenRowAttrs\(hidden, gender !== "unknown" \|\| genigender !== "unknown"\)/.test(src),
    "Focus Gender row OR's in genigender - a real Geni gender keeps the row visible even when source has none");

// Privacy: #293 follow-up (live-reported, DanCornett) superseded this
// part of #281 - gating Privacy's visibility on "Geni already has an
// explicit value" hid the row entirely for any brand-new group (no
// match exists yet, so there's nothing to have a value). Privacy is a
// COMPUTED field (buildPrivacySelect() always resolves a real decision),
// unlike the genuinely-blank-able scraped fields above, so it's always
// visible now regardless of match state - see test_293_privacy_always_
// visible.js for the dedicated coverage.
assertTrue(/hiddenRowAttrs\(hidden, true\) \+ '><td class="profilediv"><input type="checkbox" class="checknext" ' \+ \(publiclocked/.test(src),
    "Focus Privacy row is always visible (hasValue=true), not gated on Geni already having an explicit value");
assertTrue(src.indexOf('hiddenRowAttrs(hidden, true) + \'><td class="profilediv"><input id="\' + i + \'_public_checkbox"') !== -1,
    "Family-member Privacy row is always visible (hasValue=true), not gated on a match existing");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
