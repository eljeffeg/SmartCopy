// Verifies #280 (cemetery abbreviation kept alongside its own expanded
// form, and/or swallowing the following city into Place) and #282
// (inserting an assumed comma after a recognized burial-venue keyword so
// FamilySearch's own query doesn't bundle the next jurisdiction segment
// into the venue name) in parse-location.js/shared.js.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const sharedSrc = fs.readFileSync('' + ROOT + '/shared.js', 'utf8');
const plSrc = fs.readFileSync('' + ROOT + '/parse-location.js', 'utf8');

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

const expandSrc = extractFunction(sharedSrc, 'expandBurialVenueAbbreviation');
const expandBurialVenueAbbreviation = new Function('exists', 'return ' + expandSrc)(exists);

const keywordPatternSrc = extractVar(plSrc, 'PLACE_NAME_KEYWORD_PATTERN');
const isPlaceNameSegmentSrc = extractFunction(plSrc, 'isPlaceNameSegment');
const numericPatternSrc = extractVar(plSrc, 'PLACE_NAME_NUMERIC_PATTERN');
const isPlaceNameSegment = new Function(keywordPatternSrc + '\n' + numericPatternSrc + '\n' + isPlaceNameSegmentSrc + '\nreturn isPlaceNameSegment;')();

const trailingPatternSrc = extractVar(plSrc, 'BURIAL_VENUE_KEYWORD_TRAILING_TEXT_PATTERN');
const normalizeCemeteryAbbreviationSrc = extractFunction(plSrc, 'normalizeCemeteryAbbreviation');
const normalizeCemeteryAbbreviation = new Function('exists', 'expandBurialVenueAbbreviation',
    trailingPatternSrc + '\n' + normalizeCemeteryAbbreviationSrc + '\nreturn normalizeCemeteryAbbreviation;')(exists, expandBurialVenueAbbreviation);

const extractPlaceNameSegmentsSrc = extractFunction(plSrc, 'extractPlaceNameSegments');
const extractPlaceNameSegments = new Function(
    keywordPatternSrc + '\n' + numericPatternSrc + '\n' + isPlaceNameSegmentSrc + '\n' +
    trailingPatternSrc + '\n' + 'function exists(v){return v!==undefined&&v!==null&&v!=="";}\n' +
    'function expandBurialVenueAbbreviation(text){' + expandSrc.slice(expandSrc.indexOf('{') + 1, expandSrc.lastIndexOf('}')) + '}\n' +
    normalizeCemeteryAbbreviationSrc + '\n' +
    extractPlaceNameSegmentsSrc + '\nreturn extractPlaceNameSegments;'
)();

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// --- expandBurialVenueAbbreviation() ---
assertEqual(expandBurialVenueAbbreviation("Liberty Cem"), "Liberty Cemetery", "'Cem' at end of string expands to 'Cemetery'");
assertEqual(expandBurialVenueAbbreviation("Liberty Cem."), "Liberty Cemetery", "'Cem.' (with period) expands to 'Cemetery'");
assertEqual(expandBurialVenueAbbreviation("Liberty Cem Dresden"), "Liberty Cemetery Dresden", "'Cem' glued to more text expands without corrupting the trailing text");
assertEqual(expandBurialVenueAbbreviation("Liberty Cemetary"), "Liberty Cemetery", "Misspelled 'Cemetary' expands to 'Cemetery'");
assertEqual(expandBurialVenueAbbreviation("Mount Vernon Cemetery Sharon"), "Mount Vernon Cemetery Sharon", "An already-correctly-spelled 'Cemetery' is left untouched (no corruption from the 'cem' rule)");
assertEqual(expandBurialVenueAbbreviation("Mem. Park Dresden"), "Memorial Park Dresden", "'Mem.' before 'Park' expands to 'Memorial'");
assertEqual(expandBurialVenueAbbreviation("Mem Gardens"), "Memorial Gardens", "'Mem' (no period) before 'Gardens' expands to 'Memorial'");
assertEqual(expandBurialVenueAbbreviation("Memphis"), "Memphis", "A bare word merely starting with 'mem' (Memphis) is never touched - no false positive");
assertEqual(expandBurialVenueAbbreviation("member of the church"), "member of the church", "'member' is never mistaken for the 'mem' abbreviation");

// --- normalizeCemeteryAbbreviation(): abbreviation expansion + comma insertion ---
assertEqual(normalizeCemeteryAbbreviation("Liberty Cem"), "Liberty Cemetery", "Nothing follows: expands with no comma inserted");
assertEqual(normalizeCemeteryAbbreviation("Liberty Cem Dresden"), "Liberty Cemetery, Dresden", "#282: glued abbreviation gets expanded AND comma-separated from the jurisdiction text that follows");
assertEqual(normalizeCemeteryAbbreviation("Mount Vernon Cemetery Sharon"), "Mount Vernon Cemetery, Sharon", "#282: an already-spelled-out keyword glued to more text also gets the assumed comma");
assertEqual(normalizeCemeteryAbbreviation("Mem. Park Dresden"), "Memorial Park, Dresden", "#280: 'Mem. Park' expands and gets comma-separated from the city that follows");
assertEqual(normalizeCemeteryAbbreviation("Liberty Cem, Dresden"), "Liberty Cem, Dresden".replace("Cem", "Cemetery"), "A source that already separates with a comma is expanded but not double-commaed");
assertEqual(normalizeCemeteryAbbreviation("Liberty Graveyard"), "Liberty Graveyard", "A keyword with nothing following needs no comma inserted");

// --- PLACE_NAME_KEYWORD_PATTERN / isPlaceNameSegment(): new #280 keywords recognized ---
["Oak Hill Memorial Park", "Oak Hill Memorial Gardens", "Oak Hill Mem. Park", "Oak Hill Burial Ground",
    "Oak Hill Burial Grounds", "Oak Hill Graveyard"].forEach(function (segment) {
    assertTrue(isPlaceNameSegment(segment), "'" + segment + "' is recognized as a burial-venue segment");
});
assertTrue(!isPlaceNameSegment("Dignity Memorial"), "A bare 'memorial' is NOT recognized alone (avoids the 'Dignity Memorial'-style false positive DanCornett flagged)");
assertTrue(!isPlaceNameSegment("Memorial Heights"), "A bare 'memorial' not followed by 'garden(s)'/'park' is NOT recognized alone");

// --- extractPlaceNameSegments(): the actual #280/#282 end-to-end city-loss bug ---
// "Mount Vernon Cemetery Sharon, Weakley County, Tennessee" - WITHOUT the
// #282 fix, "Sharon" (the real city) gets swallowed whole into the leading
// placeName segment along with "Mount Vernon Cemetery", instead of
// surviving as its own segment for the FamilySearch query to resolve as
// City. This test operates on already pre-normalized input (matching what
// queryFamilySearchPlaces() now feeds it, having normalized the whole raw
// string before ever splitting on commas - see that function's own
// comment) since extractPlaceNameSegments() itself only ever receives an
// already-split segments array, never the raw joined string.
(function () {
    var normalizedWhole = normalizeCemeteryAbbreviation("Mount Vernon Cemetery Sharon, Weakley County, Tennessee");
    var segments = normalizedWhole.split(",").map(function (s) { return s.trim(); }).filter(function (s) { return s !== ""; });
    var extracted = extractPlaceNameSegments(segments);
    assertEqual(extracted.remaining.join(", "), "Sharon, Weakley County, Tennessee",
        "#282: after pre-normalizing the whole string, 'Sharon' survives as its own segment for the FamilySearch query instead of being swallowed into Place");
    assertEqual(extracted.placeName, "Mount Vernon Cemetery",
        "#282: the venue name itself is correctly isolated without the city glued onto it");
})();
(function () {
    var normalizedWhole = normalizeCemeteryAbbreviation("Liberty Cem Dresden, Weakley County, Tennessee");
    var segments = normalizedWhole.split(",").map(function (s) { return s.trim(); }).filter(function (s) { return s !== ""; });
    var extracted = extractPlaceNameSegments(segments);
    assertEqual(extracted.remaining.join(", "), "Dresden, Weakley County, Tennessee",
        "#280/#282: a glued abbreviated venue keyword no longer swallows the city into Place either");
    assertEqual(extracted.placeName, "Liberty Cemetery",
        "#280: the abbreviation is expanded in the isolated placeName with no leftover duplicate");
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
