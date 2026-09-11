// Verifies the #248 follow-up fix: stripRedundantPlaceSuffix() (shared.js)
// removes a trailing word-run from Place that duplicates part of a compound
// City value. Live-reported case: "Adath Israel Price Hill, Cincinnati,
// United States" - City correctly resolves to "Price Hill, Cincinnati" (a
// neighborhood folded into its enclosing city, #234), but Place showed
// "Adath Israel Price Hill" verbatim, duplicating "Price Hill".
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const sharedSrc = fs.readFileSync('' + ROOT + '/shared.js', 'utf8');

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

const PLACE_SEGMENT_QUALIFIER_PATTERN = eval(sharedSrc.match(/var PLACE_SEGMENT_QUALIFIER_PATTERN = (.*?);/)[1]);
const PLACE_SEGMENT_EQUIVALENTS = eval('(' + sharedSrc.match(/var PLACE_SEGMENT_EQUIVALENTS = (\{[\s\S]*?\});/)[1] + ')');
function expandBurialVenueAbbreviation(text) {
    var expanded = String(text || "").replace(/\bcemetary\b/i, "Cemetery");
    expanded = expanded.replace(/\bmem\.?(\s+(?:garden|park))/i, "Memorial$1");
    return expanded.replace(/\bcem\.?(?![a-z])/i, "Cemetery");
}
const normalizePlaceSegmentForMatch = new Function('PLACE_SEGMENT_QUALIFIER_PATTERN', 'PLACE_SEGMENT_EQUIVALENTS', 'expandBurialVenueAbbreviation', 'return ' + extractFunction(sharedSrc, 'normalizePlaceSegmentForMatch'))(PLACE_SEGMENT_QUALIFIER_PATTERN, PLACE_SEGMENT_EQUIVALENTS, expandBurialVenueAbbreviation);
const stripRedundantPlaceSuffix = new Function('exists', 'normalizePlaceSegmentForMatch', 'return ' + extractFunction(sharedSrc, 'stripRedundantPlaceSuffix'))(exists, normalizePlaceSegmentForMatch);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label, '->', JSON.stringify(actual)); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// The live-reported case itself.
assertEqual(
    stripRedundantPlaceSuffix("Adath Israel Price Hill", { city: "Price Hill, Cincinnati", county: "Hamilton County", state: "Ohio", country: "United States" }),
    "Adath Israel",
    "Live case: 'Price Hill' stripped from the end, 'Adath Israel' survives"
);

// A cemetery-keyword venue name, closer to what real scraped text usually
// looks like (the earlier "Adath Israel Cemetery" example from this same
// project's history).
assertEqual(
    stripRedundantPlaceSuffix("Adath Israel Cemetery Price Hill", { city: "Price Hill, Cincinnati", county: "", state: "Ohio", country: "United States" }),
    "Adath Israel Cemetery",
    "Multi-word venue text with 'Cemetery' in it also survives intact"
);

// No duplication at all - nothing should change.
assertEqual(
    stripRedundantPlaceSuffix("Oak Hill Cemetery", { city: "Springfield", county: "Sangamon County", state: "Illinois", country: "United States" }),
    "Oak Hill Cemetery",
    "No overlap with any field - placeText returned unchanged"
);

// Single-word field part (plain city, no internal comma) still matches.
assertEqual(
    stripRedundantPlaceSuffix("Saint Mary Springfield", { city: "Springfield", county: "", state: "Illinois", country: "United States" }),
    "Saint Mary",
    "Trailing match against a plain (non-compound) city value"
);

// Guard: placeText that IS EXACTLY the redundant fragment strips down to ""
// (a fully redundant place is correctly empty, not left duplicated).
assertEqual(
    stripRedundantPlaceSuffix("Price Hill", { city: "Price Hill, Cincinnati", county: "", state: "Ohio", country: "United States" }),
    "",
    "Place text that IS entirely the redundant fragment strips to empty, not blocked by the word-count guard (2 words vs 2-word field part - equal, not stripped)"
);

// Empty/missing inputs degrade safely.
assertEqual(stripRedundantPlaceSuffix("", { city: "Price Hill, Cincinnati" }), "", "Empty placeText returns empty");
assertEqual(stripRedundantPlaceSuffix("Adath Israel", undefined), "Adath Israel", "Missing geo returns placeText unchanged");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
