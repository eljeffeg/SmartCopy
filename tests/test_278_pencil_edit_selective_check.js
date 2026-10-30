// Verifies #278: after a pencil-edit location correction, each sub-field
// (Place/City/County/State/Country/Latitude/Longitude) only pre-checks
// when it actually resolved to a non-blank value, unless the "Location
// edit pre-selects all fields" (#forcegeoswitch) setting is on -
// live-reported: a less-detailed source correction was offering to CLEAR
// richer existing Geni data by force-checking every field regardless of
// its own value.
//
// #287/#288 follow-up tightened this further (see
// test_287_288_pencil_diff_check.js): "non-blank" was replaced with
// "differs from Geni's own value" for Place/City/County/State/Country, and
// GPS fields moved to a precision-tolerant differs-check
// (gpsFieldDiffersFromGeni()).
//
// A LATER #287 follow-up (see test_287_geoon_toggle_bug.js) removed the
// "!geoon &&" gate this file originally checked for - a live jsdom
// reproduction found that gate completely suppressed diff-based checking
// whenever a location was already in geo-breakdown mode before the
// update (the common case), independent of forceAllGeoFields. This file
// keeps checking the one thing from #278 that's still true: the
// forceAllGeoFields override exists and applies to all 7 rows.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');

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

const body = extractFunction(src, 'updateGeoLocation');

assertTrue(body.indexOf("var forceAllGeoFields = $('#forcegeoswitch').prop('checked');") !== -1,
    "updateGeoLocation() now reads the #forcegeoswitch setting");

// #357 redesign (live-reported by the user): Place is not part of this
// uniform forceAllGeoFields gating - City/County/State/Country/Latitude/
// Longitude still use it, unaffected.
const gatedFieldChecks = (body.match(/setLocationFieldChecked\([^,]+, \(forceAllGeoFields \|\|/g) || []).length;
assertTrue(gatedFieldChecks === 6, "All 6 remaining sub-fields (City/County/State/Country/Latitude/Longitude) are gated, got " + gatedFieldChecks);
// #366 follow-up (live-reported, DanCornett): Place's own checkbox used
// to hardcode false unconditionally here - now runs the same
// isPlaceEligibleForPreselection() rule the initial render uses, per
// Dan's own explicit "don't treat pencil-edit flow any differently"
// direction. See test_366_pencil_edit_place_consistency.js for the real
// end-to-end behavior this now produces.
assertTrue(body.indexOf('setLocationFieldChecked($(eventrow).find("input[type=checkbox]")[0],\n            isPlaceEligibleForPreselection(') !== -1,
    "#366 follow-up: Place's own checkbox now runs isPlaceEligibleForPreselection(), not a hardcoded false");

// The raw location text row at the top still legitimately uses plain
// geoon directly (untouched by any of this) - it's the one genuinely
// unrelated checkbox, never part of the #278/#287 bug.
assertTrue(body.indexOf('setLocationFieldChecked($(eventrow).find("input[type=checkbox]")[0], geoon);') !== -1,
    "The unrelated query-row checkbox still uses plain geoon");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
