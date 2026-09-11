// Verifies #286: footnoteBulletPrefix() counts however many "*" already
// lead the About text's own last non-blank line and returns one more than
// that, instead of the old fixed "*"/"**" binary choice - and reads from
// the FULLY MERGED About text (including any manually user-added content,
// "for any source type" per the issue), not just this update's own
// newly-scraped content.
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

const footnoteBulletPrefix = new Function('exists', 'return ' + extractFunction(src, 'footnoteBulletPrefix'))(exists);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

assertEqual(footnoteBulletPrefix(""), "*", "Empty About starts fresh at a plain top-level bullet");
assertEqual(footnoteBulletPrefix(undefined), "*", "Undefined About starts fresh at a plain top-level bullet");
assertEqual(footnoteBulletPrefix("Some plain prose with no bullet at all"), "*",
    "A last line with no leading '*' at all still gets a plain top-level bullet");
assertEqual(footnoteBulletPrefix("* First fact scraped this round"), "**",
    "A single '*' leading bullet nests one level deeper to '**'");
assertEqual(footnoteBulletPrefix("* First fact\n** An existing nested footnote"), "***",
    "#286: an existing '**' (already nested once) nests one level deeper to '***', not collapsed back to '**'");
assertEqual(footnoteBulletPrefix("* First fact\n** Nested once\n*** Nested twice"), "****",
    "#286: nesting keeps growing by exactly one star each time, however deep it already is");
assertEqual(footnoteBulletPrefix("* A user manually typed this bullet themselves"), "**",
    "#286: a manually user-added bulleted line (not from any scrape) is honored the same as a scraped one");
assertEqual(footnoteBulletPrefix("Some intro text\n\n* Last real line is bulleted\n\n"), "**",
    "Trailing/interior blank lines are ignored - the check uses the last NON-blank line");

// The call site must read from the fully merged `about` variable (which
// includes the existing About plus this update's own content already
// merged in), not a separate this-update-only snapshot - #286's whole
// point is picking up content the user themselves added, which a
// this-update-only snapshot could never see.
assertEqual(src.indexOf("var newAboutContentThisUpdate"), -1,
    "#286: the old this-update-only snapshot variable is removed, not left dangling unused");
assertEqual(/var bulletPrefix = footnoteBulletPrefix\(about\);/.test(src), true,
    "#286: the call site passes the fully merged `about` text, not a this-update-only snapshot");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
