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
// #333 (live-reported, DanCornett): gpsEffectivelyMatches() is now a
// shared, top-level function (promoted out of updateGeoLocation()'s own
// closure so the focus profile's initial render, a family member's GPS
// resync, and Select All can all use the same precision-tolerant
// comparison) - extracted directly from the full source now, not from
// inside updateGeoLocation()'s own body.
const gpsEffectivelyMatches = new Function('exists', 'isValue', 'return ' + extractFunction(src, 'gpsEffectivelyMatches'))(exists, isValue);

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
// #304 follow-up (consolidation pass): now compares via valuesAreEquivalent()
// (case-insensitive, whitespace-collapsed) instead of a plain !==, closing
// a gap where a pencil-edit correction differing from Geni only by case or
// spacing still pre-checked as if it were a real change - see
// tests/test_304_pre_selection_comparison.js for direct valuesAreEquivalent()
// coverage; this just confirms the real call site actually uses it.
assertTrue(updateGeoLocationBody.indexOf('!valuesAreEquivalent(sourceValue, geniInput.value)') !== -1,
    "Non-GPS fields compare against the row's own rendered Geni value using the shared case/whitespace-insensitive comparator, not a plain !== or just a non-blank check");

// --- Behavioral: updateFieldDiffersFromGeni() itself, real jQuery/jsdom, not just reading the source ---
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));
const valuesAreEquivalent = new Function('return ' + extractFunction(src, 'valuesAreEquivalent'))();
const updateFieldDiffersFromGeni = new Function('$', 'exists', 'isValue', 'valuesAreEquivalent',
    'return ' + extractFunction(updateGeoLocationBody, 'updateFieldDiffersFromGeni'))($, exists, isValue, valuesAreEquivalent);

function makeRow(geniValue) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><input type="text" class="genislideinput" disabled></td>';
    tr.querySelector('.genislideinput').value = geniValue;
    return $(tr);
}
assertTrue(!updateFieldDiffersFromGeni(makeRow('Natrona'), 'NATRONA'),
    "#304 follow-up: a pencil-edit correction differing from Geni only by case is no longer treated as a real difference");
assertTrue(!updateFieldDiffersFromGeni(makeRow('Allegheny  County'), 'Allegheny County'),
    "Same for whitespace - multiple spaces collapse before comparing");
assertTrue(updateFieldDiffersFromGeni(makeRow('Pittsburgh'), 'Natrona'),
    "A genuinely different value is still correctly flagged as differing");

// #346 follow-up: City/County/State/Country's checks now also OR in
// `&& !locationSpecificityDowngrade` (wrapped in an extra paren) - this
// regex only requires the forceAllGeoFields/Differs pairing still be
// present somewhere in each expression, not that it's the only thing there.
// #357 redesign (live-reported by the user): Place dropped out of this
// count entirely - it no longer uses a differs-from-Geni check at all,
// since it never pre-selects regardless of content (hardcoded false).
const nonGpsFieldChecks = (updateGeoLocationBody.match(/forceAllGeoFields \|\| \(?\w+Differs\b/g) || []).length;
assertTrue(nonGpsFieldChecks === 4, "All 4 remaining non-GPS fields (City/County/State/Country) use the differs-from-Geni check, got " + nonGpsFieldChecks);

// #333 further follow-up (re-opened, live-reported, DanCornett): this
// used to require anyNonGpsFieldDiffers be false too - removed, since
// locationSpecificityDowngrade (see test_346_347_pencil_edit_location_precision.js)
// now protects the same concern (a less-detailed correction) precisely,
// without blocking a same-or-better-precision GPS correction that happens
// alongside a text-field change, which the old blunt rule did.
assertTrue(updateGeoLocationBody.indexOf('anyNonGpsFieldDiffers') === -1,
    "#333: gpsFieldDiffersFromGeni() no longer blocks GPS purely because another field also differs - anyNonGpsFieldDiffers is gone entirely");
assertTrue(updateGeoLocationBody.indexOf('function gpsFieldDiffersFromGeni(row, sourceValue) {\n            if (!isValue(sourceValue)) {\n                return false;\n            }') !== -1,
    "#333: gpsFieldDiffersFromGeni() now only short-circuits on a blank scraped value, evaluating GPS purely on its own merits otherwise");
// #346 follow-up: same - locationSpecificityDowngrade is now OR'd in here too.
assertTrue(updateGeoLocationBody.indexOf('forceAllGeoFields || (gpsFieldDiffersFromGeni(eventrow, locationdata.latitude)') !== -1,
    "Latitude row uses the GPS-specific differs check");
assertTrue(updateGeoLocationBody.indexOf('forceAllGeoFields || (gpsFieldDiffersFromGeni(eventrow, locationdata.longitude)') !== -1,
    "Longitude row uses the GPS-specific differs check");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
