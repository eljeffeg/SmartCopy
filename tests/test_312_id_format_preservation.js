// Verifies #312 (live-reported, DanCornett - "wrong focus profile picked").
// Root cause, confirmed via the diagnostic logging added in v4.17.3.39/.42:
// selecting "Katharina Geiser" from SmartCopy's History dropdown loaded a
// completely unrelated profile ("Noah Kennedy") instead. The stored/
// selected id was "profile-4395669" (no "g"), while a direct paste of her
// real Geni URL (https://www.geni.com/people/Katharina-Geiser/4395669)
// correctly resolves via "profile-g4395669" (with "g").
//
// isNodeNumberId()/isGuidFormatId()/toProfileId() used to classify an id as
// guid-format vs. node-number-format purely by counting digits (<=16 vs
// >16), discarding whatever prefix the id actually arrived with. Katharina
// Geiser's real guid is only 7 digits (an old profile, likely assigned
// before Geni's guids got longer) - short enough to be misclassified as a
// "node number," so pickPrimaryId() (called when History stores/merges an
// entry) silently stripped the "g". "profile-g4395669" and
// "profile-4395669" are NOT two forms of the same profile - they're two
// entirely different Geni ids that happen to share a numeric value, and
// Geni's API resolves them to two different people.
//
// Fix: an id that already explicitly carries a "profile-g"/"profile-"
// prefix keeps it exactly as given, never re-derived from digit length.
// Only a genuinely bare, unprefixed digit string (e.g. a node_number
// scraped directly off a page, which never carries a prefix) falls back
// to the length guess - safe, since that's a real, confirmed alternate id
// for that specific profile, not a guessed reinterpretation.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

function exists(v) { return typeof v !== 'undefined' && v !== null; }

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
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

const normalizeProfileId = new Function('return ' + extractFunction(src, 'normalizeProfileId'))();
const isNodeNumberId = new Function('normalizeProfileId', 'return ' + extractFunction(src, 'isNodeNumberId'))(normalizeProfileId);
const isGuidFormatId = new Function('normalizeProfileId', 'return ' + extractFunction(src, 'isGuidFormatId'))(normalizeProfileId);
const toProfileId = new Function('normalizeProfileId', 'return ' + extractFunction(src, 'toProfileId'))(normalizeProfileId);
const pickPrimaryId = new Function('isNodeNumberId', 'toProfileId', 'return ' + extractFunction(src, 'pickPrimaryId'))(isNodeNumberId, toProfileId);
const pickDisplayId = new Function('isGuidFormatId', 'toProfileId', 'return ' + extractFunction(src, 'pickDisplayId'))(isGuidFormatId, toProfileId);

// ============================================================
// The exact #312 scenario: a short guid must never be reclassified
// ============================================================
assertEqual(isNodeNumberId("profile-g4395669"), false,
    "#312: an explicitly guid-tagged id is never treated as a node number, no matter how short its digits are");
assertEqual(isGuidFormatId("profile-g4395669"), true,
    "#312: an explicitly guid-tagged id is always recognized as guid-format");
assertEqual(toProfileId("profile-g4395669"), "profile-g4395669",
    "#312: toProfileId() preserves an explicit guid prefix exactly, never re-deriving it from digit count");
assertEqual(pickPrimaryId(["profile-g4395669"]), "profile-g4395669",
    "#312: the exact bug - pickPrimaryId() with only Katharina Geiser's short guid as a candidate must keep the 'g', not silently produce a different profile's id");

// ============================================================
// Regression: a genuinely bare, scraped node_number (no prefix at all) is
// still correctly recognized and preferred - the original purpose of this
// whole mechanism (Geni's submit API needs the node_number form).
// ============================================================
assertEqual(isNodeNumberId("34758447241"), true,
    "A bare, unprefixed digit string (e.g. scraped directly from a page's own node_number field) is still recognized as a node number");
assertEqual(toProfileId("34758447241"), "profile-34758447241",
    "toProfileId() still correctly adds the 'profile-' prefix to a genuinely bare node_number");
assertEqual(pickPrimaryId(["profile-g4395669", "34758447241"]), "profile-34758447241",
    "Regression: once a REAL node_number is confirmed (scraped from the page), it's still correctly preferred as primary over the guid form - unchanged original behavior, just no longer reachable via a guessed reinterpretation of the guid's own digits");

// ============================================================
// Regression: a genuinely long guid (the common case) still works exactly as before
// ============================================================
assertEqual(isGuidFormatId("profile-g6000000012535411918"), true,
    "A long guid (the common case) is still correctly recognized, whether via its explicit prefix or (redundantly) its length");
assertEqual(pickPrimaryId(["profile-g6000000012535411918", "6000000012535411918"]), "profile-g6000000012535411918",
    "Regression: when a candidate's OWN prefix already says guid, and no separately-scraped node_number differs, the guid stays primary - matches pre-#312 behavior for the common (long-guid) case");

// ============================================================
// Regression: a bare digit string with no prefix at all still falls back
// to the length heuristic exactly as before (nothing else to go on).
// ============================================================
assertEqual(isNodeNumberId("6000000012535411918"), false,
    "A bare 19-digit string with no prefix at all is still correctly classified as guid-format via the length fallback (no prefix info available to do better)");
assertEqual(toProfileId("6000000012535411918"), "profile-g6000000012535411918",
    "toProfileId() still correctly adds 'profile-g' via the length fallback for a genuinely bare long digit string");

// ============================================================
// pickDisplayId(): unaffected in the common case, but must also respect an
// explicit prefix for the same reason as pickPrimaryId().
// ============================================================
assertEqual(pickDisplayId({ id: "profile-4395669", aliasIds: ["profile-g4395669"] }), "profile-g4395669",
    "pickDisplayId() still prefers the guid form for display when one is available, respecting its explicit prefix");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
