// Verifies #286/#235, simplified back to basics per explicit request after
// the nesting/dedup logic grew too tangled (footnoteBulletPrefix(),
// isLastLineFromSameSource() - both removed entirely). The rule now: two
// things ever happen to a person's About - (1) real scraped content gets
// merged in, unless it's already there (mergeAboutText(), unchanged); (2)
// IF that merge actually added something new, a single plain "*" footnote
// documents the run/source. No nesting, no "what changed" history
// tracking, no bare-footnote-only re-adds when nothing changed. Shared by
// both the focus profile and family members via one function,
// buildReferenceAboutMe() - previously two divergent implementations.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

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
function extractVarStatement(srcText, name) {
    const marker = 'var ' + name + ' =';
    const start = srcText.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    const semi = srcText.indexOf(';', start);
    return srcText.slice(start, semi + 1);
}

function exists(v) { return typeof v !== "undefined" && v !== null; }
const moment = require(path.join(ROOT, 'moment.js'));

const isAboutContentPresent = new Function('exists', extractFunction(src, 'normalizeAboutForComparison') + '\n' + extractFunction(src, 'isAboutContentPresent') + '\nreturn isAboutContentPresent;')(exists);
const mergeAboutText = new Function('exists', 'isAboutContentPresent', 'return ' + extractFunction(src, 'mergeAboutText'))(exists, isAboutContentPresent);
// footnoteLabel()/recordtype are read as real globals by buildReferenceAboutMe() -
// recordtype is a plain module-level var elsewhere in popup.js; stubbed here
// the same way other tests stub out unrelated global state.
const footnoteLabel = new Function('exists', 'return ' + extractFunction(src, 'footnoteLabel'))(exists);
const buildReferenceAboutMe = new Function('exists', 'moment', 'mergeAboutText', 'footnoteLabel', 'recordtype',
    'return ' + extractFunction(src, 'buildReferenceAboutMe'))(exists, moment, mergeAboutText, footnoteLabel, 'FamilySearch Family Tree');

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// ============================================================
// buildReferenceAboutMe(newAboutContent, existingAbout, refurl, updatedCategories)
// ============================================================

// --- Genuinely new content: merged in, footnote appended (always plain "*") ---
{
    const result = buildReferenceAboutMe("* '''Residence''': Chicago, Illinois - 1920", "", "https://example.com/record/1", ["about"]);
    assertTrue(exists(result), "New content on an otherwise-blank About returns a real value, not undefined");
    assertTrue(result.indexOf("* '''Residence''': Chicago, Illinois - 1920") !== -1, "The real scraped content is present");
    assertTrue(/\n\* '''\[https:\/\/example\.com\/record\/1 /.test(result), "The footnote is a plain single '*' - never nested, regardless of what came before it");
    assertTrue(result.indexOf("(this update: about)") !== -1, "The updatedCategories summary is still included");
}

// --- Genuinely new content added to a NON-EMPTY existing About - footnote still plain "*", not nested under whatever Geni's own last line is ---
{
    const existingAbout = "* '''[https://myheritage.com/record/9 MyHeritage Family Tree]''' - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''Jan 1 2020, 0:00:00 UTC''\n";
    const result = buildReferenceAboutMe("* '''Residence''': Detroit, Michigan - 1930", existingAbout, "https://familysearch.org/record/2", ["about"]);
    assertTrue(result.indexOf(existingAbout.trim()) !== -1, "Geni's existing About is preserved");
    assertTrue(result.indexOf("* '''Residence''': Detroit, Michigan - 1930") !== -1, "The new content is merged in");
    const footnoteLine = result.split("\n").filter(function (l) { return l.trim() !== ""; }).pop();
    assertEqual(footnoteLine.trim().match(/^\*+/)[0], "*", "#286 (live-reported, DanCornett): the new footnote is a plain single '*' even though Geni's existing About ends with an unrelated MyHeritage footnote - nesting is never based on Geni's own side");
}

// --- Content already present verbatim AND no other field changed: no footnote at all, nothing to submit ---
{
    const existingAbout = "* '''Residence''': Chicago, Illinois - 1920\n* '''[https://example.com/record/1 FamilySearch]''' - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''Jan 1 2020, 0:00:00 UTC''\n";
    const result = buildReferenceAboutMe("* '''Residence''': Chicago, Illinois - 1920", existingAbout, "https://example.com/record/1", []);
    assertEqual(result, undefined, "#286 (live-reported, DanCornett): nothing genuinely new was merged in and no other field changed - no footnote gets written, about_me isn't touched at all");
}

// --- Nothing scraped this run AND no other field changed: no footnote, regardless of what Geni's About already ends with ---
{
    const existingAbout = "* '''[https://myheritage.com/record/9 MyHeritage Family Tree]''' - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''Jan 1 2020, 0:00:00 UTC''\n* '''[https://familysearch.org/record/5 FamilySearch]''' - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''Jan 2 2020, 0:00:00 UTC''\n";
    const result = buildReferenceAboutMe("", existingAbout, "https://familysearch.org/record/6", []);
    assertEqual(result, undefined, "#286 (live-reported, DanCornett): a blank scraped About with nothing else changed never gets a bare 'just checking in' footnote, no matter how many unrelated footnotes already sit at the end of Geni's own About");
}

// --- (live-reported, stbodie - #286 follow-up): a marriage/divorce update genuinely changes this
// person's data even though it has no About text of its own to merge in - a footnote SHOULD still
// document it, since updatedCategories reflects a real change, not a no-op re-run (the #304
// pre-selection fix already guarantees a field only gets this far when it's genuinely different). ---
{
    const existingAbout = "* '''[https://myheritage.com/record/9 MyHeritage Family Tree]''' - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''Jan 1 2020, 0:00:00 UTC''\n";
    const result = buildReferenceAboutMe("", existingAbout, "https://familysearch.org/record/6", ["marriage"]);
    assertTrue(exists(result), "A marriage-only update (blank scraped About, but a real changed category) still writes a footnote");
    assertTrue(result.indexOf("(this update: marriage)") !== -1, "The footnote correctly documents 'marriage' as the touched category");
    assertTrue(result.indexOf(existingAbout.trim()) !== -1, "Geni's existing About content is preserved unchanged - only the new footnote is appended");
}

// --- Blank existing About (a brand-new profile) with real new content still works ---
{
    const result = buildReferenceAboutMe("* '''Residence''': Chicago, Illinois - 1920", undefined, "https://example.com/record/1", []);
    assertTrue(exists(result), "A brand-new profile (no existing About at all) with real content still gets one");
    assertTrue(result.indexOf("(this update:") === -1, "No parenthetical when updatedCategories is empty");
}

// ============================================================
// Structural: the old nesting/dedup machinery is gone, and both call sites
// (focus profile's own submission + the family-member Add/Update paths)
// route through the one shared function.
// ============================================================
assertEqual(src.indexOf("function footnoteBulletPrefix"), -1, "#286 simplified: footnoteBulletPrefix() is removed entirely - no more nesting");
assertEqual(src.indexOf("function isLastLineFromSameSource"), -1, "#286 simplified: isLastLineFromSameSource() is removed entirely - superseded by 'only write a footnote when content actually changed'");
assertTrue(src.indexOf("function buildFocusReferenceAboutMe(newAboutContent, refurl, updatedCategories") !== -1,
    "buildFocusReferenceAboutMe() still exists with its original signature, for its two existing call sites (main focus submission + marriage-via-spouse follow-up)");
assertTrue(/buildReferenceAboutMe\(newAboutContent, focusabout, refurl, updatedCategories\)/.test(src),
    "buildFocusReferenceAboutMe() delegates to the shared buildReferenceAboutMe()");
assertTrue(/buildReferenceAboutMe\(rawAbout, "", fdata\.url, updatedCategories\)/.test(src),
    "A brand-new family-member 'Add' resolves its about_me immediately via the shared function - existingAbout is blank, nothing to wait for");
assertTrue(/buildReferenceAboutMe\(rawAbout, geni_return\.about_me, response\.variable\.refurl, response\.variable\.updatedCategories\)/.test(src),
    "A family-member 'Update' defers to the shared function until Geni's REAL existing About is fetched, then resolves the same way the focus profile always has");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
