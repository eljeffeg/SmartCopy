// Verifies a #306 follow-up (live-reported, DanCornett): a family member's
// About was never actually fetched from Geni at all, so the post-match
// resync (refreshFieldCheckState() -> applyProtectedDisabledState(),
// buildform.js) always compared the scraped About against a blank
// currentValue - "nothing to compare against" means always selectable, so
// About stayed pre-checked forever, even when Geni already had the exact
// same text verbatim (the simplest case #306 was originally filed to fix,
// already shipped via isAboutContentPresent() - but that comparator can
// only work with real data to compare against).
//
// Root cause: the immediate-family API request (popup.js) that populates
// genifamilydata never included "about_me" in its fields list - unlike the
// focus profile, which has its own dedicated about_me/nicknames fetch
// (loadGeniData(), buildform.js). Fixed by adding about_me to that same
// fields list, so getGeniData(profile, "about_me") - the currentValue read
// at buildform.js's refreshFieldCheckState() call site - has real data to
// compare against.
//
// This is a network-request-construction bug, not a comparison-logic bug
// (the comparator itself - isFieldSelectable()/valuesAreEquivalentForFieldType()'s
// about_me branch - was already correct and already tested elsewhere,
// see tests/test_304_pre_selection_comparison.js). A structural check on
// the actual fields string sent over the wire is the right test here, not
// a synthetic jsdom reproduction of the comparator.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

const argsLineMatch = src.match(/var args = "fields=id,guid,name,names,title[^"]*"/);
assertTrue(argsLineMatch !== null, "The immediate-family request's fields list is found in popup.js");
const argsLine = argsLineMatch ? argsLineMatch[0] : "";

assertTrue(argsLine.indexOf(",about_me") !== -1 || argsLine.indexOf("about_me,") !== -1,
    "#306: about_me is now included in the immediate-family fields list, so a family member's real Geni About is available for pre-selection comparison");

// Regression: every field this list already requested is still there -
// confirms this was purely additive, not a field list rewrite.
["nicknames", "occupation", "cause_of_death", "is_alive", "public", "locked_fields", "match_counts"].forEach(function (field) {
    assertTrue(argsLine.indexOf(field) !== -1, "Regression: '" + field + "' is still requested, unchanged");
});

// Sanity: the focus profile's own separate about_me fetch (the thing that
// already made the focus profile's About comparison work) is untouched by
// this change - still its own dedicated request, not merged into this one.
assertTrue(src.indexOf('fields=about_me,nicknames') !== -1,
    "The focus profile's own dedicated about_me/nicknames fetch (loadGeniData()) still exists separately, unchanged");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
