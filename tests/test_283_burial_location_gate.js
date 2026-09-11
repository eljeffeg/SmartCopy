// Verifies #283: when only #burialonoffswitch is on (master switch off),
// burial-date estimation should only fire if there's an actual burial
// location on the source or Geni side; an explicit "Unknown" source
// location string should be stripped rather than stored as real data; and
// both toggles should default to unchecked (OFF) for new users.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const buildformSrc = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');
const popupHtml = fs.readFileSync('' + ROOT + '/popup.html', 'utf8');

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

function exists(v) { return v !== undefined && v !== null && v !== ""; }
function isValue(v) { return v !== ""; }

const helperSrc = extractFunction(buildformSrc, 'isUsableLocationValue') + '\n' + extractFunction(buildformSrc, 'hasAnyBurialLocation');
const hasAnyBurialLocation = new Function('exists', 'isValue', helperSrc + '\nreturn hasAnyBurialLocation;')(exists, isValue);

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// --- hasAnyBurialLocation() ---
assertTrue(hasAnyBurialLocation({ burial: [{ location: "Oak Hill Cemetery" }] }, undefined),
    "A real source burial location is recognized");
assertTrue(hasAnyBurialLocation({}, "Oak Hill Cemetery"),
    "A real Geni burial location is recognized even with no source burial array at all");
assertTrue(!hasAnyBurialLocation({ burial: [{ location: "Unknown" }] }, undefined),
    "A literal 'Unknown' source location does not count as a real location");
assertTrue(!hasAnyBurialLocation({ burial: [{ location: "unknown" }] }, "unknown"),
    "Case-insensitive: lowercase 'unknown' on both sides still does not count");
assertTrue(!hasAnyBurialLocation({}, undefined),
    "No burial data at all on either side correctly reports no location");
assertTrue(!hasAnyBurialLocation({ burial: [{ date: "1 January 1900" }] }, ""),
    "A burial entry with a date but no location field at all does not count");
assertTrue(hasAnyBurialLocation({ burial: [{ location: "" }, { location: "Elm Street Cemetery" }] }, undefined),
    "Scans every burial array element, not just the first, for a usable location");

// --- addEvent(): explicit "Unknown" source location strings are stripped ---
assertTrue(buildformSrc.indexOf('eventlocation.trim().toLowerCase() !== "unknown"') !== -1,
    "addEvent() strips a literal 'Unknown' location string instead of storing it as real data");

// --- Call sites: burialonoffswitch-only path requires hasAnyBurialLocation() ---
assertTrue(/\(\$\('#burialonoffswitch'\)\.prop\('checked'\) && hasAnyBurialLocation\(alldata\["profile"\], genifocusdata\.get\("burial", "location_string"\)\)\)/.test(buildformSrc),
    "Focus profile: burialonoffswitch-only firing requires an actual burial location");
assertTrue(/\(\$\('#burialonoffswitch'\)\.prop\('checked'\) && hasAnyBurialLocation\(members\[member\], geniMemberBurialLocation\)\)/.test(buildformSrc),
    "Family member: burialonoffswitch-only firing requires an actual burial location");

// The master switch's own branch must remain unrestricted (still a bare
// prop('checked') check, no location gate attached to it).
assertTrue(/\$\('#estimatebirthyearsonoffswitch'\)\.prop\('checked'\) \|\|\s*\n\s*\(\$\('#burialonoffswitch'\)\.prop\('checked'\)/.test(buildformSrc),
    "Master switch ON still fires burial estimation unconditionally (OR short-circuits before the location gate)");

// --- popup.html: both toggles default to unchecked for new users ---
const burialSwitchMarkup = popupHtml.slice(popupHtml.indexOf('id="burialonoffswitch"') - 20, popupHtml.indexOf('id="burialonoffswitch"') + 40);
assertTrue(burialSwitchMarkup.indexOf('checked') === -1,
    "#burialonoffswitch has no 'checked' attribute (defaults OFF for new users)");
const estimateSwitchMarkup = popupHtml.slice(popupHtml.indexOf('id="estimatebirthyearsonoffswitch"') - 20, popupHtml.indexOf('id="estimatebirthyearsonoffswitch"') + 55);
assertTrue(estimateSwitchMarkup.indexOf('checked') === -1,
    "#estimatebirthyearsonoffswitch has no 'checked' attribute (defaults OFF for new users)");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
