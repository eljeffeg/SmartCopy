// Verifies #333 (live-reported, DanCornett): GPS fields that were
// correctly pre-selected before an "Edit Location" correction LOST their
// pre-selection afterward, even though the underlying coordinates hadn't
// really changed. Dan's own diagnosis: "It is acting like the 'first
// time' pre-selection of detailed location fields differs from the
// pre-selection process after an 'Edit location'."
//
// Root cause: gpsEffectivelyMatches() - the precision-tolerant comparator
// #288 added specifically because FamilySearch and Geni report GPS
// coordinates at different decimal precision - lived ONLY inside the
// pencil "Edit Location" flow's own closure. Every OTHER place that
// decides whether a GPS field pre-selects (the focus profile's own
// initial render, a family member's post-match resync via
// refreshFieldCheckState(), and Select All's own no-op check) still
// compared GPS through the generic, precision-blind valuesAreEquivalent() -
// so a pure decimal-precision difference (e.g. Geni "42.6" vs. a scraped
// "42.64863", the same point at different precision) read as "different"
// at render time and pre-selected GPS, then correctly stopped being
// pre-selected the moment a pencil-edit recomputed it through the
// tolerant comparator. Two logically identical questions, answered two
// different ways, exactly the kind of drift this codebase has
// repeatedly had.
//
// Fixed by promoting gpsEffectivelyMatches() to a shared, top-level
// function and routing every comparison point through it (directly for
// the focus profile's own inline render computation, and via a new "gps"
// fieldType branch in valuesAreEquivalentForFieldType() for the family
// resync and Select All paths, which both already dispatch on fieldType).
//
// Extracts the REAL functions (not reimplementations).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

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

function exists(v) { return typeof v !== 'undefined' && v !== null; }
function isValue(v) { return exists(v) && v !== ''; }

// valuesAreEquivalentForFieldType() references datesAreEquivalent()/
// nicknamesAreEquivalent()/isAboutContentPresent()/valuesAreEquivalent()
// for its OTHER branches - none of those are called here since the "gps"
// branch returns first, so they're deliberately left unstubbed (same
// convention other tests in this suite use when only one branch of a
// multi-branch dispatch function is under test).
const ctx = new Function('exists', 'isValue', `
    ${extractFunction(bfSrc, 'gpsEffectivelyMatches')}
    ${extractFunction(bfSrc, 'valuesAreEquivalentForFieldType')}
    return { gpsEffectivelyMatches, valuesAreEquivalentForFieldType };
`)(exists, isValue);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- The exact live-observed shape of the bug: same point, different precision. ---
assertEqual(ctx.gpsEffectivelyMatches("42.64863", "42.6"), true,
    "#333: a FamilySearch-precision coordinate and Geni's own shorter-precision value for the same point are recognized as matching");
assertEqual(ctx.gpsEffectivelyMatches("42.64863", "43.1"), false,
    "Safety: genuinely different coordinates still correctly register as different");

// --- The actual fix: valuesAreEquivalentForFieldType("gps", ...) - the one
// dispatch point refreshFieldCheckState() (family resync) and
// isFieldEmptyForCheckAll() (Select All) both now route GPS through -
// uses the tolerant comparator, not the generic one. ---
assertEqual(ctx.valuesAreEquivalentForFieldType("42.64863", "42.6", "gps"), true,
    "#333: the shared fieldType dispatch recognizes a precision-only GPS difference as equivalent, closing the gap for family-member resync and Select All");
assertEqual(ctx.valuesAreEquivalentForFieldType("42.64863", "43.1", "gps"), false,
    "Safety: the shared dispatch still correctly flags a genuine GPS difference");

// --- Structural: the focus profile's own initial-render computation (which computes
// its own inline sameAsGeni, not through the fieldType dispatch) calls the real
// shared function directly, not the old generic valuesAreEquivalent(). ---
assertEqual(/checkedAttr: isChecked\(latitude, geoScored, geoone, genifocusdata\.get\(title, "location\.latitude"\), locationlocked, gpsEffectivelyMatches\(latitude, genifocusdata\.get\(title, "location\.latitude"\)\)\)/.test(bfSrc), true,
    "#333: the focus profile's own Latitude row computes sameAsGeni via the shared gpsEffectivelyMatches(), not the generic valuesAreEquivalent()");
assertEqual(/checkedAttr: isChecked\(longitude, geoScored, geoone, genifocusdata\.get\(title, "location\.longitude"\), locationlocked, gpsEffectivelyMatches\(longitude, genifocusdata\.get\(title, "location\.longitude"\)\)\)/.test(bfSrc), true,
    "#333: the focus profile's own Longitude row computes sameAsGeni via the shared gpsEffectivelyMatches() too");

// --- Structural: refreshFieldCheckState() (buildform.js) and isFieldEmptyForCheckAll()
// (popup.js) both now classify a GPS field name as fieldType "gps". ---
assertEqual(bfSrc.indexOf('(fieldName.endsWith(":location:latitude") || fieldName.endsWith(":location:longitude")) ? "gps"') !== -1, true,
    "#333: refreshFieldCheckState()'s fieldType dispatch recognizes GPS field names");
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');
assertEqual(popupSrc.indexOf('(fieldName.endsWith(":location:latitude") || fieldName.endsWith(":location:longitude")) ? "gps"') !== -1, true,
    "#333: isFieldEmptyForCheckAll()'s fieldType dispatch (Select All) recognizes GPS field names too");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
