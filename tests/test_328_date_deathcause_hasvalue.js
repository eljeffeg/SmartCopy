// Verifies #328 (live-reported, DanCornett): "All non-blank GENI fields
// should be visible initially and after 'Hide'." Dan: "I regularly have to
// scroll up to click 'Show all fields' then scroll down to see if there is
// a Geni value for a field I might be wondering about (such as 'Is there a
// divorce?'; 'is there an AKA string already?'; 'Is there a burial?')."
//
// AKA (nicknames) already computes hasValue as isValue(scraped) ||
// Geni-has-a-value - this issue was filed and partly addressed before
// this fix (Dan's own screenshot example). The remaining, still-broken
// gap this test covers: the generic Date fallback row (fires for EVERY
// event title with no scraped data at all for this run - birth, death,
// burial, baptism, marriage, divorce, all route through the same shared
// code) and the Death Cause row both still hardcoded hasValue to `false`,
// exactly the same shape of bug #305 already fixed for Occupation - a
// profile with no scraped Burial/Divorce/Death-Cause data this run stayed
// collapsed under "Hide Empty Fields" even when Geni already had a real
// value there, with no way to even see it was present without clicking
// "Show all fields" first every time.
//
// Fixed the same way Occupation/the name fields already were: hasValue
// now checks Geni's real existing value too, not just whether something
// was scraped this run. Focus profile uses genifocusdata.get() directly
// (the already-matched, confirmed profile); family members reuse the
// existing matchedCandidateForEstimate - the same pre-match candidate
// their own date-field pre-selection already reads from - matching
// Occupation's own memberGeniOccupationHasValue precedent rather than
// resolving the match a second time.
//
// About's own two fallback rows (focus and family) are DELIBERATELY left
// hardcoded to `false` here - unlike Occupation/Date/Death Cause, there is
// no genislideinput companion anywhere in that row showing Geni's existing
// About text, so exposing it would show an empty, actionable-looking row
// that reveals nothing new about what Geni already has - the same "don't
// add a field the user can't act on" reasoning Photo was ruled out under
// for #305.
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

// --- Structural: the focus profile's Date/Death Cause fallback rows no longer hardcode hasValue to false. ---
assertTrue(src.indexOf('hiddenRowAttrs(hidden, isValue(genifocusdata.get(title, "date.formatted_date")))') !== -1,
    "#328: focus profile's Date fallback row now checks Geni's real value for this event, same pattern as Occupation's own #305 fix");
assertTrue(src.indexOf('hiddenRowAttrs(hidden, isValue(genifocusdata.get("cause_of_death")))') !== -1,
    "#328: focus profile's Death Cause fallback row now checks Geni's real value too");

// --- Structural: the family-member equivalents reuse matchedCandidateForEstimate, not new machinery. ---
assertTrue(src.indexOf('hiddenRowAttrs(hidden, exists(matchedCandidateForEstimate) && isValue(matchedCandidateForEstimate.get(title, "date.formatted_date")))') !== -1,
    "#328: family member's Date fallback row now checks the pre-match candidate's real value for this event");
assertTrue(src.indexOf('hiddenRowAttrs(hidden, exists(matchedCandidateForEstimate) && isValue(matchedCandidateForEstimate.get("cause_of_death")))') !== -1,
    "#328: family member's Death Cause fallback row now checks the pre-match candidate's real value too");

// --- Structural: all four hardcoded-false Date/Death Cause call sites are gone. ---
assertTrue(src.indexOf('hiddenRowAttrs(hidden, false) + \'><td class="profilediv"><input type="checkbox" class="checknext"\' + (datelocked') === -1,
    "#328: focus profile's Date fallback row no longer hardcodes hasValue to false");
assertTrue(src.indexOf('hiddenRowAttrs(hidden, false) + \'><td class="profilediv"><input type="checkbox" class="checknext"\' + (focusFieldLocked("cause_of_death")') === -1,
    "#328: focus profile's Death Cause fallback row no longer hardcodes hasValue to false");
assertTrue(src.indexOf('hiddenRowAttrs(hidden, false) + \'><td class="profilediv"><input type="checkbox" class="checknext">\' + capFL(title)') === -1,
    "#328: family member's Date fallback row no longer hardcodes hasValue to false");
assertTrue(src.indexOf('hiddenRowAttrs(hidden, false) + \'><td class="profilediv"><input type="checkbox" class="checknext">Death Cause:') === -1,
    "#328: family member's Death Cause fallback row no longer hardcodes hasValue to false");

// --- Structural, safety: About's two fallback rows are deliberately UNCHANGED - this issue shouldn't have touched them (no Geni-value readout exists to expose there). ---
assertEqual((src.match(/hiddenRowAttrs\(hidden, false\) \+ ' id="about"/g) || []).length, 2,
    "Safety: About's own two fallback rows (focus + family) are still hardcoded false on purpose - they have no genislideinput companion to reveal, so exposing them would show nothing new");

// --- Behavioral: real hiddenRowAttrs()/isHidden(), confirming the actual display/data-hasvalue output - same harness as #305's own test. ---
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
function isValue(v) { return v !== ''; }
function exists(v) { return typeof v !== 'undefined' && v !== null; }
function geoAnySourceEnabled() { return false; }
const isHidden = new Function('geoAnySourceEnabled', 'return ' + extractFunction(src, 'isHidden'))(geoAnySourceEnabled);
const hiddenRowAttrs = new Function('isHidden', 'return ' + extractFunction(src, 'hiddenRowAttrs'))(isHidden);

// Focus profile: Burial, nothing scraped this run, but Geni already has a burial date.
assertEqual(hiddenRowAttrs(true, isValue('')), 'data-hasvalue="false" style="display: none;" class="hiddenrow"',
    "Nothing scraped, Geni also blank - still correctly starts hidden under Hide Empty Fields (unchanged baseline)");
assertEqual(hiddenRowAttrs(true, isValue('12 March 1950')), 'data-hasvalue="true" style="display: table-row;" class="hiddenrow"',
    "#328: nothing scraped for this event's date, but Geni has a real one - now correctly starts VISIBLE under Hide Empty Fields instead of collapsed");

// Family member: no matched Geni candidate at all (a brand-new "Add" person) -
// exists(matchedCandidateForEstimate) short-circuits to false before ever
// calling .get() on it, so this must stay hidden, same as before this fix.
var matchedCandidateForEstimate = undefined;
assertEqual(hiddenRowAttrs(true, exists(matchedCandidateForEstimate) && isValue("anything")), 'data-hasvalue="false" style="display: none;" class="hiddenrow"',
    "Safety: a family member with no matched Geni candidate at all (new Add) has nothing to reveal - stays correctly hidden, same as before this fix");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
