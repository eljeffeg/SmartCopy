// Verifies #287 (location fields only pre-check when source differs from
// Geni, not merely when non-blank) and #288 (GPS fields compared with
// precision tolerance, and never pre-checked at all if any other field
// differs) in updateGeoLocation() (buildform.js).
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

function exists(v) { return v !== undefined && v !== null && v !== ""; }
function isValue(v) { return v !== ""; }

const updateGeoLocationBody = extractFunction(src, 'updateGeoLocation');
const gpsEffectivelyMatches = new Function('exists', 'isValue', 'return ' + extractFunction(updateGeoLocationBody, 'gpsEffectivelyMatches'))(exists, isValue);

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label, '->', actual); }
    else { fail++; console.log('FAIL:', label, '- expected', expected, 'got', actual); }
}

// --- #288: gpsEffectivelyMatches() precision tolerance ---
// The exact live-observed case: Geni "42.6", source resolved "42.64863" -
// should be treated as the same point (screenshot showed this correctly
// unchecked).
assertTrue(gpsEffectivelyMatches("42.64863", "42.6"), "'42.64863' vs '42.6' (Geni's coarser precision) match within tolerance");
assertTrue(gpsEffectivelyMatches("40.9747", "40.97"), "A shorter, less-precise Geni value still matches its more precise source counterpart");
assertTrue(!gpsEffectivelyMatches("-85.31667", "-85.290641"), "A genuinely different longitude at similar precision is correctly NOT treated as matching");
assertTrue(!gpsEffectivelyMatches("42.64863", "40.9747"), "Genuinely different coordinates are NOT treated as matching");
assertTrue(gpsEffectivelyMatches("42.5225", "42.5225"), "Identical values match trivially");
assertTrue(!gpsEffectivelyMatches("", "42.6"), "Blank source value never matches (nothing to compare)");
assertTrue(!gpsEffectivelyMatches("42.6", ""), "Blank Geni value never matches (nothing to compare)");

// --- #287/#288 structural checks in updateGeoLocation() ---
assertTrue(updateGeoLocationBody.indexOf('function updateFieldDiffersFromGeni(row, sourceValue)') !== -1,
    "updateFieldDiffersFromGeni() helper exists");
assertTrue(updateGeoLocationBody.indexOf('sourceValue !== geniInput.value') !== -1,
    "Non-GPS fields compare against the row's own rendered Geni value, not just checking non-blank");

const nonGpsFieldChecks = (updateGeoLocationBody.match(/forceAllGeoFields \|\| \w+Differs\)/g) || []).length;
assertTrue(nonGpsFieldChecks === 5, "All 5 non-GPS fields (Place/City/County/State/Country) use the differs-from-Geni check, got " + nonGpsFieldChecks);

assertTrue(updateGeoLocationBody.indexOf('if (anyNonGpsFieldDiffers || !isValue(sourceValue)) {\n                return false;') !== -1,
    "gpsFieldDiffersFromGeni() refuses to pre-select GPS at all when any other field differs");
assertTrue(updateGeoLocationBody.indexOf('forceAllGeoFields || gpsFieldDiffersFromGeni(eventrow, locationdata.latitude)') !== -1,
    "Latitude row uses the GPS-specific differs check");
assertTrue(updateGeoLocationBody.indexOf('forceAllGeoFields || gpsFieldDiffersFromGeni(eventrow, locationdata.longitude)') !== -1,
    "Longitude row uses the GPS-specific differs check");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
