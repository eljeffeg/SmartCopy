// Verifies a follow-up to #300 (live-reported, DanCornett): the "no name
// selected" skip message always showed the shared focus-profile or union
// id - never the specific person - so two skipped siblings in the same
// run produced the exact same message text twice, with no way to tell
// them apart or know which person needed attention. databyid[id] still
// carries the original scraped name even though no Name field was ever
// checked (that's the whole reason the guard fires), so it's reused here
// to give each skip its own identifiable text, plus a direct hint at the
// most common real-world cause (an undiscovered half/step-sibling - #322).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

function exists(v) { return typeof v !== "undefined" && v !== null; }
function getProfileName(profile) {
    if (typeof profile === 'object') {
        if (profile.displayname) return profile.displayname;
        if (profile.display_name) return profile.display_name;
        if (profile.displayName) return profile.displayName;
    }
    return profile;
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// Extract the real skippedName resolution line verbatim.
const marker = 'var skippedName = ';
const start = src.indexOf(marker);
assertTrue(start !== -1, "The skippedName resolution line exists in popup.js");
const end = src.indexOf(';', start);
const skippedNameExprSrc = src.slice(start, end + 1);

function computeSkippedName(databyid, id, sendid) {
    return new Function('exists', 'getProfileName', 'databyid', 'id', 'sendid',
        skippedNameExprSrc + '\nreturn skippedName;')(exists, getProfileName, databyid, id, sendid);
}

// --- The scraped name is used when available, even though no Name field was ever checked ---
assertEqual(computeSkippedName({ 5: { name: "Lucille Ann Nebel" } }, 5, "profile-34862946802"),
    "Lucille Ann Nebel", "Uses the original scraped name from databyid when available");

// --- A second, different skipped person in the same run gets their OWN distinct name ---
assertEqual(computeSkippedName({ 6: { name: "Richard Edward Paul Lauer" } }, 6, "profile-34862946802"),
    "Richard Edward Paul Lauer", "A different person (different databyid id) resolves to their own distinct name, not the same shared id as another skip");

// --- Falls back to sendid when no scraped name is available at all (e.g. a totally blank record) ---
assertEqual(computeSkippedName({}, 5, "profile-34862946802"), "profile-34862946802",
    "Falls back to the old sendid-based identifier when databyid has nothing for this id at all");
assertEqual(computeSkippedName({ 5: {} }, 5, "profile-34862946802"), "profile-34862946802",
    "Falls back to sendid when the databyid entry exists but has no name field");

// --- An object-shaped name (displayname form) still resolves through getProfileName() correctly ---
assertEqual(computeSkippedName({ 5: { name: { displayname: "Lucille Ann Nebel" } } }, 5, "profile-34862946802"),
    "Lucille Ann Nebel", "An object-shaped scraped name (displayname form) still resolves to plain text via getProfileName()");

// --- Structural: the message includes the workaround hint for the most common real-world cause ---
assertTrue(src.indexOf('": skipped, no name selected. Step/half-sibling? Sync the shared parent\'s other spouse first, then retry."') !== -1,
    "The skip message names the likely cause (undiscovered half/step-sibling) and the workaround directly");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
