// Live-reported (#378): BillionGraves parsing crashed with
// "TypeError: Cannot read properties of undefined (reading 'contains')"
// at collections/billiongraves.js:66 - focusperson.contains("(born") where
// focusperson = data.name was undefined.
//
// Root cause: getData() extracts a page's <script type="application/
// ld+json"> block and returns {} whenever that script tag is missing,
// its JSON fails to parse, or (since BillionGraves' redesign emits an
// array of JSON-LD blocks rather than a single Person object) no entry
// with @type "Person" is found in that array - any of which leaves
// data.name undefined. That was used completely unguarded in both
// loadPage() and parseBillionGraves(), so a page that doesn't carry the
// expected JSON-LD shape (a different BillionGraves page template,
// network truncation, etc.) crashed outright instead of degrading
// gracefully - the same "never throws, degrade to blank" bug class
// already fixed for FindAGrave (#379) and YadVashem/loadGeniData (#368).
//
// Fixed by defaulting focusperson/focusname to "" wherever data.name is
// read, rather than guarding every later .contains()/string-method call
// site individually. Extracts the real functions verbatim.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
const src = fs.readFileSync(path.join(ROOT, 'collections/billiongraves.js'), 'utf8');

function extractFunction(name) {
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
if (!String.prototype.contains) {
    String.prototype.contains = function () { return String.prototype.indexOf.apply(this, arguments) !== -1; };
}

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));

function addEvent(profiledata) { return profiledata; }
function cleanHTML(html) { return html; }
function parseDate() { return {}; }
function displayDate() { return ""; }

function freshParseBillionGraves() {
    return new Function(
        '$', 'exists', 'addEvent', 'cleanHTML', 'parseDate', 'displayDate', 'dateFormat',
        extractFunction('getData') + '\n' +
        extractFunction('parseBillionGraves') + '\n' +
        'return parseBillionGraves;'
    )($, exists, addEvent, cleanHTML, parseDate, displayDate, 'YYYY-MM-DD');
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- A page with no JSON-LD block at all (getData() returns {}) ---
(function () {
    const parseBillionGraves = freshParseBillionGraves();
    var threw = false;
    var result;
    try {
        result = parseBillionGraves('<html><body>No structured data here</body></html>', false, "");
    } catch (e) { threw = true; }
    assertEqual(threw, false, "parseBillionGraves(): a page with no JSON-LD block at all no longer throws");
    assertEqual(result.name, "", "parseBillionGraves(): degrades to a blank name rather than undefined");
    assertEqual(result.gender, "unknown", "parseBillionGraves(): gender stays 'unknown' rather than crashing before it can be set");
})();

// --- A JSON-LD array with no Person entry (BillionGraves' redesign shape, confirmed in getData()'s own comment) ---
(function () {
    const parseBillionGraves = freshParseBillionGraves();
    const html = '<html><body><script type="application/ld+json">' +
        JSON.stringify([{ "@type": "BreadcrumbList" }]) +
        '</script></body></html>';
    var threw = false;
    var result;
    try {
        result = parseBillionGraves(html, false, "");
    } catch (e) { threw = true; }
    assertEqual(threw, false, "parseBillionGraves(): a JSON-LD array with no Person entry no longer throws");
    assertEqual(result.name, "", "parseBillionGraves(): degrades to a blank name for this shape too");
})();

// --- Regression: a normal page with a real Person JSON-LD block still works ---
(function () {
    const parseBillionGraves = freshParseBillionGraves();
    const html = '<html><body><script type="application/ld+json">' +
        JSON.stringify({ "@type": "Person", "name": "Jane Doe" }) +
        '</script></body></html>';
    const result = parseBillionGraves(html, false, "");
    assertEqual(result.name, "Jane Doe", "parseBillionGraves(): a normal, valid Person JSON-LD block still parses the name correctly (success path unaffected)");
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
