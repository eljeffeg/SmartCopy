// Live-reported (#387, DanCornett): a FindAGrave birth location showed up
// with a visible leading space ("            England" - confirmed live,
// William Whiteside memorial/40997957, whose #birthLocationLabel element
// carries significant leading/trailing whitespace from the source page's
// own HTML indentation).
//
// Root cause: addEvent() (buildform.js) - called by every collection
// parser, not just FindAGrave - already trimmed a COPY of eventlocation to
// decide whether to treat it as blank/"Unknown" (the #283 fix), but then
// stored the original, untrimmed string. Fixed by trimming the stored
// value itself. Extracts the real function verbatim.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');

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

function cleanDate(d) { return d; }
const $ = { isEmptyObject: function (o) { return Object.keys(o).length === 0; } };
const moment = function () { return { isValid: function () { return false; } }; };
const addEvent = new Function('cleanDate', '$', 'moment', 'geoid',
    extractFunction('addEvent') + '\nreturn addEvent;'
)(cleanDate, $, moment, 0);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

assertEqual(addEvent({}, 'birth', '', '            England ').birth[0].location, 'England',
    "addEvent(): a location with real-world leading/trailing whitespace (confirmed live on FindAGrave) is trimmed before being stored");
assertEqual(addEvent({}, 'birth', '', 'Oak Hill Cemetery').birth[0].location, 'Oak Hill Cemetery',
    "Regression: a normal, already-clean location is stored unchanged");
assertEqual(addEvent({}, 'burial', '', '  Unknown  ').burial, undefined,
    "Regression: #283's own case - a location that's blank/\"Unknown\" after trimming is still correctly stripped entirely, not stored as whitespace-only text");
assertEqual(addEvent({}, 'birth', '', '').birth, undefined,
    "Regression: a genuinely empty location still results in no location entry at all");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
