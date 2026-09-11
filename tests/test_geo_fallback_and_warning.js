// Verifies two fixes from the DanCornett location-fallback discussion:
// (1) queryGeoGoogle()'s disabled-Google early-return now carries the raw
// scraped text forward as `place` (and sets count=0) instead of returning
// a fully blank result; (2) a new dateMismatch signal - when NONE of the
// FamilySearch candidates actually returned have a date range covering
// the record's year, that's now surfaced as a specific warningReason
// string instead of silently accepting the best-scored (wrong-era) match.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const plSrc = fs.readFileSync('' + ROOT + '/parse-location.js', 'utf8');
const bfSrc = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');

function extractFunction(src, name) {
    const marker = 'function ' + name + '(';
    const start = src.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    let depth = 0, i = src.indexOf('{', start);
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(start, i + 1);
}
function extractVar(src, name) {
    const marker = 'var ' + name + ' =';
    const start = src.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    const end = src.indexOf(';\n', start);
    return src.slice(start, end + 1);
}

function exists(v) { return v !== undefined && v !== null && v !== ""; }
function isValue(v) { return v !== ""; }

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// --- fsSelectionHadTemporalMismatch() ---
const parseFsTemporalYearSrc = extractFunction(plSrc, 'parseFsTemporalYear');
const isYearWithinFsTemporalRangeSrc = extractFunction(plSrc, 'isYearWithinFsTemporalRange');
const fsSelectionHadTemporalMismatchSrc = extractFunction(plSrc, 'fsSelectionHadTemporalMismatch');
const fsSelectionHadTemporalMismatch = new Function(
    'exists',
    parseFsTemporalYearSrc + '\n' + isYearWithinFsTemporalRangeSrc + '\n' + fsSelectionHadTemporalMismatchSrc +
    '\nreturn fsSelectionHadTemporalMismatch;'
)(exists);

function entry(formal) {
    return { content: { gedcomx: { places: [{ temporalDescription: formal ? { formal: formal } : undefined }] } } };
}

assertEqual(fsSelectionHadTemporalMismatch([entry("+1854/")], undefined), false, "No year known at all - never a mismatch (nothing to compare against)");
assertEqual(fsSelectionHadTemporalMismatch([entry("+1854/")], 2026), false, "At least one candidate's range covers the year - not a mismatch");
assertEqual(fsSelectionHadTemporalMismatch([entry("+1776/+1854")], 2026), true, "Every candidate's range excludes the year - genuine mismatch");
assertEqual(fsSelectionHadTemporalMismatch([entry("+1776/+1854"), entry("+1854/")], 2026), false, "Mismatch only when NONE of several candidates cover the year - one match is enough");
assertEqual(fsSelectionHadTemporalMismatch([entry(undefined)], 2026), false, "A candidate with no temporalDescription at all counts as unrestricted (always valid), never a mismatch");

// --- familySearchPlaceToGeoLocation(): warningReason construction ---
function fakePlace() {
    return [{ names: [{ value: "Test Place" }], id: "1", display: { name: "Test Place", fullName: "Test Place", type: "Town" } }];
}
// Minimal stand-ins for the many outer-scope deps this function touches -
// only warningReason/ambiguous/count/query/place are under test here.
function makeFamilySearchPlaceToGeoLocation() {
    const deps = {
        exists: exists, isValue: isValue,
        FS_SETTLEMENT_ANCESTOR_TYPES: [], FS_BROAD_PLACE_TYPES: [],
        applyCountySuffix: function () {}, stripRedundantPlaceSuffix: function (p) { return p; }
    };
    const body = extractFunction(plSrc, 'familySearchPlaceToGeoLocation');
    return new Function(Object.keys(deps).join(','), 'return ' + body).apply(null, Object.values(deps));
}
const familySearchPlaceToGeoLocation = makeFamilySearchPlaceToGeoLocation();

var neitherResult = familySearchPlaceToGeoLocation(fakePlace(), "q", "", false, false);
assertEqual(neitherResult.warningReason, "", "Neither ambiguous nor dateMismatch - blank warningReason");

var ambiguousResult = familySearchPlaceToGeoLocation(fakePlace(), "q", "", true, false);
assertTrue(ambiguousResult.warningReason.length > 0, "Ambiguous alone produces a non-blank warningReason");
assertTrue(ambiguousResult.warningReason.indexOf("Multiple equally-likely") !== -1, "Ambiguous reason text is specific, not generic");

var mismatchResult = familySearchPlaceToGeoLocation(fakePlace(), "q", "", false, true);
assertTrue(mismatchResult.warningReason.indexOf("date range doesn't include this record's year") !== -1, "dateMismatch reason text explains the actual problem");

var bothResult = familySearchPlaceToGeoLocation(fakePlace(), "q", "", true, true);
assertTrue(bothResult.warningReason.indexOf("Multiple equally-likely") !== -1 && bothResult.warningReason.indexOf("date range doesn't include") !== -1,
    "Both conditions true - both reasons appended, matching DanCornett's own proposed 'append to the warning string' design");

// --- queryGeoGoogle(): disabled-Google fallback carries the raw text forward ---
const queryGeoGoogleBody = extractFunction(plSrc, 'queryGeoGoogle');
assertTrue(queryGeoGoogleBody.indexOf('var disabledResult = parseGoogle("", exists(locationset.location) ? locationset.location : "");') !== -1,
    "Disabled-Google path now passes the raw scraped text as the query, instead of parseGoogle(\"\") alone");
assertTrue(queryGeoGoogleBody.indexOf('disabledResult.place = disabledResult.query;') !== -1,
    "Disabled-Google path sets place = query, matching GeoLocation()'s own 'all blank -> use query text' fallback");
assertTrue(queryGeoGoogleBody.indexOf('disabledResult.count = 0;') !== -1,
    "Disabled-Google path explicitly sets count=0, so the red 'lookup failed' pin now correctly triggers (previously count was left undefined, so neither pin state ever fired)");

// --- buildform.js: warningReason takes priority over the generic text at both render call sites ---
const warningReasonCheckCount = (bfSrc.match(/if \((?:geovar1|geovar2)\.warningReason\) \{/g) || []).length;
assertEqual(warningReasonCheckCount, 2, "Both the focus-profile and family-member render sites check warningReason first, got " + warningReasonCheckCount);
assertTrue(bfSrc.indexOf('pintitle = geovar1.warningReason;') !== -1, "Focus-profile site uses the specific reason as the tooltip when present");
assertTrue(bfSrc.indexOf('pintitle = geovar2.warningReason;') !== -1, "Family-member site uses the specific reason as the tooltip when present");
assertTrue(bfSrc.indexOf("title=\"' + escapeHtml(geovar2.warningReason) + '\"'") !== -1,
    "Family-member site's aggregate pin HTML is built with the specific reason too, escaped for safe HTML attribute insertion");
// The existing generic-text branches must still exist unchanged, for the
// plain Google-ambiguous case (which never builds a warningReason string).
assertEqual((bfSrc.match(/pintitle = "Location lookup may be incorrect";/g) || []).length, 2,
    "The original generic fallback text is still present at both sites for the non-FamilySearch-specific case");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
