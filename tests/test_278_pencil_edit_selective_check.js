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

// #357 redesign (live-reported by the user): Place is no longer part of
// this uniform gating at all - it never pre-selects, period, so its own
// setLocationFieldChecked() call now hardcodes false rather than using
// (forceAllGeoFields || <something>). The other 6 rows (City/County/
// State/Country/Latitude/Longitude) are unaffected.
const gatedFieldChecks = (body.match(/setLocationFieldChecked\([^,]+, \(forceAllGeoFields \|\|/g) || []).length;
assertTrue(gatedFieldChecks === 6, "All 6 remaining sub-fields (City/County/State/Country/Latitude/Longitude) are gated, got " + gatedFieldChecks);
assertTrue(body.indexOf('setLocationFieldChecked($(eventrow).find("input[type=checkbox]")[0], false);') !== -1,
    "#357: Place's own checkbox is hardcoded to never pre-select, deliberately excluded from the forceAllGeoFields gating every other row uses");

// The raw location text row at the top still legitimately uses plain
// geoon directly (untouched by any of this) - it's the one genuinely
// unrelated checkbox, never part of the #278/#287 bug.
assertTrue(body.indexOf('setLocationFieldChecked($(eventrow).find("input[type=checkbox]")[0], geoon);') !== -1,
    "The unrelated query-row checkbox still uses plain geoon");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
