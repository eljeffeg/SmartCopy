// Verifies #331 (live-reported, DanCornett): when a family member (e.g. a
// sibling being Added) has no scraped data at all for an event - no date,
// no location - buildForm() renders a "nothing here" fallback row for that
// event's date/location/cause-of-death fields, revealed by "Show all
// fields". Every one of these fallback textareas/inputs hardcoded
// `disabled` directly in the template, a leftover from before #304's
// editability/pre-selection split - so even after selecting the field (or
// forcing a location in via "Edit Location"), nothing could actually be
// typed, and nothing reached the submitted Geni profile. Dan: "I'm pretty
// sure that would apply to all the other 'non-green' fields (i.e. those
// hidden initially) - they wouldn't get updated on Geni."
//
// Two separate code paths had this bug, for the SAME reason as the
// focus-profile/family-member About fixes earlier this session:
// - The focus profile's own fallback (has a lock variable available at
//   render time - datelocked/locationlocked/focusFieldLocked - and should
//   use it, same as every other focus-profile field).
// - The family-member fallback (no lock concept exists yet at initial
//   render - a match isn't resolved - so these must simply never be
//   disabled at all at render time, matching every other not-yet-matched
//   family field; `cause_of_death`'s own identical-shaped fix for the
//   "has data" branch, already landed earlier this session, was the
//   template for both corrections here).
//
// Structural source check (regex over the actual template strings), not a
// function extraction - this logic lives inline inside buildForm(), a
// single multi-thousand-line function not practical to extract and execute
// standalone, same convention as test_286_about_editable_when_nothing_scraped.js.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// Matches the EDITABLE field's `name="..." disabled>` - never the
// genislideinput companion's `value="..." disabled>` (which has no name=
// attribute at all, and is correctly ALWAYS disabled - a read-only
// comparison display, not a real form field).
const editableFieldPattern = /name="[^"]*"\s+disabled>/g;

const matches = bfSrc.match(editableFieldPattern) || [];
assertEqual(matches.length, 0,
    "#331: no editable field in buildform.js hardcodes `disabled` directly on a `name=` attribute - every remaining instance (" + matches.length + " found: " + JSON.stringify(matches) + ") must instead gate on a real lock check (focus profile) or omit disabled entirely (family member, no lock concept until matched)");

// Regression guard: the genislideinput companions (always, correctly,
// disabled - read-only comparison fields) must be untouched by this fix.
const genislideinputCount = (bfSrc.match(/class="formtext genislideinput"[^>]*disabled>/g) || []).length;
assertEqual(genislideinputCount > 30, true,
    "Sanity: genislideinput companion fields are still present and still disabled (read-only by design) - this fix must not have touched them");

// Spot-check one of each fixed pattern by name, confirming the lock-gated
// (focus) or disabled-free (family) replacement landed where expected.
assertEqual(bfSrc.indexOf('name="\' + title + \':date"\' + (datelocked ? \' disabled\' : \'\') + \'>') !== -1, true,
    "#331: the focus profile's blank-date fallback input is now gated on datelocked, not hardcoded disabled");
assertEqual(bfSrc.indexOf('name="\' + title + \':location:city"\' + (locationlocked ? \' disabled\' : \'\') + \'>') !== -1, true,
    "#331: the focus profile's blank-location fallback (City) is now gated on locationlocked, not hardcoded disabled");
assertEqual(bfSrc.indexOf('class="formtext" name="cause_of_death"></td>') !== -1, true,
    "#331: the family member's blank cause_of_death fallback input is no longer hardcoded disabled (no lock concept exists for an unmatched family member at render time)");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
