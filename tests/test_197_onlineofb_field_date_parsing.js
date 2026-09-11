// Verifies #197: OnlineOFB's label/value cell lookup (getOFBFieldCell/
// getOFBFieldText) and date+place splitting (parseOFBDateString/
// getOFBDate) in collections/onlineofb.js. Three real bugs were found
// from a single live "berlin" family-report sample:
// 1. An empty spacer <td> between a label symbol and its actual value
//    broke birth/death/baptism extraction entirely - fixed by scanning
//    forward past up to OFB_FORWARD_SCAN_LIMIT empty cells instead of
//    only checking the immediately-next cell.
// 2. Splitting date+place on the first comma cut the place's own city
//    off (the place itself commonly has internal commas) - fixed by
//    splitting on the literal " in " connector instead, falling back to
//    comma-split only when " in " isn't present.
// 3. "No siblings found!" (English) wasn't recognized, only the German
//    text - covered separately by OFB_EMPTY_MARKERS, not this file.
// Extracts the real functions verbatim and loads a real jsdom+jQuery
// table (not a reimplementation) so cell text is read exactly the way
// the real page-parsing code does.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const ofbSrc = fs.readFileSync(path.join(ROOT, 'collections/onlineofb.js'), 'utf8');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
const $ = require(path.join(ROOT, 'jquery.js'));

function exists(v) { return typeof v !== 'undefined' && v !== null; }
if (!String.prototype.contains) {
    String.prototype.contains = function () { return String.prototype.indexOf.apply(this, arguments) !== -1; };
}

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

function extractVarStatement(src, name) {
    const marker = 'var ' + name + ' =';
    const start = src.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    const semi = src.indexOf(';', start);
    return src.slice(start, semi + 1);
}
const monthTranslationVars = extractVarStatement(bfSrc, 'MONTH_NAME_TRANSLATIONS') + '\n' + extractVarStatement(bfSrc, 'ENGLISH_MONTH_NAMES');
const translateForeignMonthNames = new Function('exists', monthTranslationVars + '\nreturn ' + extractFunction(bfSrc, 'translateForeignMonthNames'))(exists);
const cleanDate = new Function('exists', 'translateForeignMonthNames', 'return ' + extractFunction(bfSrc, 'cleanDate'))(exists, translateForeignMonthNames);

const OFB_FORWARD_SCAN_LIMIT = 3;
const OFB_FOOTNOTE_PATTERN = /\s*\[\s*\d+\s*\]\s*$/;
const getOFBFieldCell = new Function('$', 'return ' + extractFunction(ofbSrc, 'getOFBFieldCell'))($);
const getOFBFieldText = new Function('$', 'exists', 'getOFBFieldCell', 'OFB_FORWARD_SCAN_LIMIT', 'return ' + extractFunction(ofbSrc, 'getOFBFieldText'))($, exists, getOFBFieldCell, OFB_FORWARD_SCAN_LIMIT);

let geoid = 0;
function makeParseOFBDateString() {
    return new Function('exists', 'cleanDate', 'OFB_FOOTNOTE_PATTERN', 'geoidRef',
        'return ' + extractFunction(ofbSrc, 'parseOFBDateString').replace('geoid++', 'geoidRef.value++').replace('id: geoid', 'id: geoidRef.value')
    )(exists, cleanDate, OFB_FOOTNOTE_PATTERN, { value: 0 });
}
const parseOFBDateString = makeParseOFBDateString();

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a === e) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', e, 'got', a); }
}

// --- Bug 1: an empty spacer <td> between the label and its value ---
$('body').html('<table><tr><td>&#10022; Birth</td><td width="3"></td><td>06 May 1873 in Friedrichshagen,  Berlin,  Deutschland</td></tr></table>');
let cells = $('table td').toArray();
assertEqual(getOFBFieldText(cells, ['✖ Birth', '✖ Geburt']), '',
    "(sanity) label variant that doesn't match anything real returns blank, not a throw");
assertEqual(getOFBFieldText(cells, ['✪ Birth']), '',
    "(sanity continued)");
let realCells = $('body').html('<table><tr><td>Birth:</td><td width="3"></td><td>06 May 1873 in Friedrichshagen,  Berlin,  Deutschland</td></tr></table>').find('table td').toArray();
assertEqual(getOFBFieldText(realCells, ['Birth:']), '06 May 1873 in Friedrichshagen,  Berlin,  Deutschland',
    "#197 bug 1: scans forward PAST an empty spacer cell to find the real value - checking only the immediately-next cell would have returned blank here");

// --- Forward scan is bounded - a value further than OFB_FORWARD_SCAN_LIMIT away is NOT found ---
$('body').html('<table><tr><td>Birth:</td><td></td><td></td><td></td><td>06 May 1873</td></tr></table>');
cells = $('table td').toArray();
assertEqual(getOFBFieldText(cells, ['Birth:']), '',
    "The forward scan is bounded to OFB_FORWARD_SCAN_LIMIT cells - a value further away than that is correctly NOT picked up as an unrelated later field's value");

// --- Label and value sharing one cell (no scan needed at all) ---
$('body').html('<table><tr><td>Birth: 03 Jul 1850</td></tr></table>');
cells = $('table td').toArray();
assertEqual(getOFBFieldText(cells, ['Birth:']), '03 Jul 1850',
    "Label and value sharing one cell works without any forward scan");

// --- Bug 2: date+place split on " in ", not the first comma (place has its own internal commas) ---
assertEqual(parseOFBDateString('06 May 1873 in Friedrichshagen,  Berlin,  Deutschland'),
    [{ date: '06 May 1873' }, { id: 0, location: 'Friedrichshagen, Berlin, Deutschland' }],
    "#197 bug 2: splits on ' in ', keeping the full multi-part place intact - a first-comma split would have cut off 'Friedrichshagen' and left it stranded on the date side");

// --- Fallback: no " in " present at all - falls back to a first-comma split ---
assertEqual(parseOFBDateString('1846, Metzgerstrasse'),
    [{ date: '1846' }, { id: 1, location: 'Metzgerstrasse' }],
    "When ' in ' isn't present, falls back to a first-comma split rather than treating the whole string as one unsplit date");

// --- Footnote marker stripped even with no place at all ---
assertEqual(parseOFBDateString('1813 [1]'), [{ date: '1813' }],
    "A bare footnoted year with no place strips the footnote and still yields just a date, no stray place entry");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
