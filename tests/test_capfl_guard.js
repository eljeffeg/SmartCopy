// Verifies capFL(): (1) no longer throws on undefined/null input, and
// (2) normalizes a genuinely all-one-case source value ("JOHN") to proper
// case while leaving a legitimately mixed-case value ("McDonald")
// completely untouched. Both found/refined while reviewing
// pquenee/SmartCopy - his version force-lowercased the remainder
// unconditionally, which fixed ALL-CAPS source data but corrupted any
// mixed-case name it touched (e.g. "McDonald" -> "Mcdonald").
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync('' + ROOT + '/popup.js', 'utf8');

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

function exists(v) { return typeof v !== "undefined" && v !== null; }
const capFL = new Function('exists', 'return ' + extractFunction(src, 'capFL'))(exists);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

assertEqual(capFL(undefined), "", "capFL(undefined) no longer throws, returns blank");
assertEqual(capFL(null), "", "capFL(null) no longer throws, returns blank");
assertEqual(capFL(""), "", "capFL('') still returns blank");
assertEqual(capFL("male"), "Male", "Regression: normal lowercase capitalization still works");
assertEqual(capFL("JOHN"), "John", "An all-caps source value is normalized to proper case");
assertEqual(capFL("SMITH"), "Smith", "Another all-caps example, confirms it's not a one-off");
assertEqual(capFL("MALE"), "Male", "All-caps gender text is also normalized");
assertEqual(capFL("McDonald"), "McDonald", "A genuinely mixed-case surname is left completely untouched, not force-lowercased");
assertEqual(capFL("DiCaprio"), "DiCaprio", "Another mixed-case example, confirms it's not a one-off");
assertEqual(capFL("O'Brien"), "O'Brien", "A mixed-case name with a non-letter character (apostrophe) is also left untouched");
assertEqual(capFL("123"), "123", "A numeric-only remainder is never mistaken for 'all uppercase' and left untouched");
assertEqual(capFL("A"), "A", "A single-character string has no remainder to touch");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
