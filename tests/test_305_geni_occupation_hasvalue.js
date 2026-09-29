// Verifies #305 (live-reported, DanCornett): a Geni field with a real
// value, but nothing scraped for it this run, wasn't shown even after
// "Show all fields" - reported on a MyHeritage US census record (no
// occupation typically comes through structured census parsing the way
// SmartCopy expects it, but Geni already had one).
//
// Root cause, confirmed by direct code reading: Occupation's own
// "nothing scraped" fallback row (buildform.js) already displays Geni's
// real value in its disabled genislideinput companion - but passed a
// hardcoded `false` as hiddenRowAttrs()'s hasValue, so the row always
// started collapsed under "Hide Empty Fields" regardless of whether Geni
// actually had something there. Every other field with this same
// fallback shape (Title, Middle Name, Birth Name, Suffix, Display Name,
// Nicknames) already computes hasValue as isValue(scraped) || Geni-has-a-
// value - Occupation just never got that treatment.
//
// Photo was ruled OUT as a fix target for this issue on purpose: it has
// no manual-entry path (a hidden input, not a text field) and is purely
// additive (Geni never overwrites an existing photo), so a row with
// nothing scraped would be permanently non-interactive - nothing to type,
// nothing to check, nothing to protect. Showing it would just be a
// decoration the user can never act on, which is exactly the kind of
// unnecessary complexity this fix deliberately avoids adding.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- Structural: the two hardcoded `false` hasValue calls are gone ---
assertTrue(!/hiddenRowAttrs\(hidden, false\) \+ ' id="occupation"/.test(src),
    "Focus profile's occupation fallback no longer hardcodes hasValue to false");
assertTrue(src.indexOf("hiddenRowAttrs(hidden, isValue(genifocusdata.get(\"occupation\")))") !== -1,
    "Focus profile's occupation fallback now checks Geni's real value, same pattern as every other secondary field");
assertTrue(src.indexOf("hiddenRowAttrs(hidden, memberGeniOccupationHasValue)") !== -1,
    "Family member's occupation fallback now checks the deterministic pre-match candidate's real value");
assertTrue(src.indexOf('var memberGeniOccupationHasValue = exists(matchedCandidateForEstimate) && isValue(String(matchedCandidateForEstimate.get("occupation") || ""));') !== -1,
    "memberGeniOccupationHasValue reuses the same matchedCandidateForEstimate lookup the name fields already use, not new machinery");

// --- Structural: Photo deliberately untouched - it has no fallback branch, confirming it wasn't turned into a fake fix ---
assertTrue(!/id="photo">/.test(src) || src.match(/id="photo">/g).length === src.match(/exists\((alldata\["profile"\]\["thumb"\]|members\[member\]\["thumb"\])\)/g).length,
    "Photo still has no 'nothing scraped, show Geni's anyway' fallback row - left alone since there's nothing a user could act on there");

// --- Behavioral: real hiddenRowAttrs()/isHidden(), confirming the actual display/data-hasvalue output ---
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
function isValue(v) { return v !== ''; }
function geoAnySourceEnabled() { return false; }
const isHidden = new Function('geoAnySourceEnabled', 'return ' + extractFunction(src, 'isHidden'))(geoAnySourceEnabled);
const hiddenRowAttrs = new Function('isHidden', 'return ' + extractFunction(src, 'hiddenRowAttrs'))(isHidden);

assertEqual(hiddenRowAttrs(true, isValue('')), 'data-hasvalue="false" style="display: none;" class="hiddenrow"',
    "Nothing scraped, Geni also blank - still correctly starts hidden (display:none) under Hide Empty Fields (unchanged baseline)");
assertEqual(hiddenRowAttrs(true, isValue('Farmer')), 'data-hasvalue="true" style="display: table-row;" class="hiddenrow"',
    "#305: nothing scraped, but Geni has a real occupation - now correctly starts VISIBLE (table-row) under Hide Empty Fields instead of collapsed");
assertEqual(hiddenRowAttrs(false, isValue('Farmer')), 'data-hasvalue="true" style="display: table-row;" class="hiddenrow"',
    "Hide Empty Fields off - row is visible regardless, unaffected by this fix");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
