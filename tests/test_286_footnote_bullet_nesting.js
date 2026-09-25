// Verifies #286/#235, simplified back to basics per explicit request after
// the nesting/dedup logic grew too tangled (footnoteBulletPrefix() removed
// entirely). The rule now: two things ever happen to a person's About -
// (1) real scraped content gets merged in, unless it's already there
// (mergeAboutText(), unchanged); (2) IF something genuinely changed this
// run, a single plain "*" citation documents the run/source. No nesting,
// no "what changed" history tracking. Shared by both the focus profile
// and family members via one function, buildReferenceAboutMe() -
// previously two divergent implementations.
//
// #286 follow-up (live-reported, DanCornett): isLastLineFromSameSource()
// was narrowly reintroduced for one specific case - a BARE citation (no
// new content alongside it) should never duplicate if the last thing in
// the About is already a citation from that same source. Real new content
// is never subject to this check.
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
const isLastLineFromSameSource = new Function('exists', 'return ' + extractFunction(src, 'isLastLineFromSameSource'))(exists);
const buildReferenceAboutMe = new Function('exists', 'moment', 'isAboutContentPresent', 'footnoteLabel', 'isLastLineFromSameSource', 'recordtype',
    'return ' + extractFunction(src, 'buildReferenceAboutMe'))(exists, moment, isAboutContentPresent, footnoteLabel, isLastLineFromSameSource, 'FamilySearch Family Tree');

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

// --- (live-reported, stbodie): a "----" separator goes BETWEEN separate runs, never inside one -
// a run's own content and its own footnote stick together as a single block, only a blank line
// between them, no rule. ---
{
    const existingAbout = "* '''Residence''': Rapids City, Illinois - 1880\n* '''[https://familysearch.org/record/1 FamilySearch]''' - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''Sep 13 2026, 12:40:07 UTC''\n";
    const result = buildReferenceAboutMe("* '''Residence''': 1920 - La Salle, Illinois", existingAbout, "https://myheritage.com/record/2", ["about"]);
    const dashIndex = result.indexOf("----");
    assertTrue(dashIndex !== -1, "A '----' separator is present when appending onto a non-empty existing About");
    assertTrue(result.substring(0, dashIndex).indexOf("Rapids City") !== -1 && result.substring(0, dashIndex).indexOf("FamilySearch]") !== -1,
        "The separator comes AFTER the entire prior run (its content AND its own footnote both stay before the '----')");
    assertTrue(result.substring(dashIndex).indexOf("1920 - La Salle") !== -1 && result.substring(dashIndex).indexOf("myheritage.com/record/2") !== -1,
        "The separator comes BEFORE the entire new run (its content AND its own footnote both stay after the '----')");
    const newRunSection = result.substring(result.indexOf("1920 - La Salle"));
    assertTrue(newRunSection.indexOf("----") === -1,
        "No second '----' appears between this run's own content and its own footnote - they stick together as one block");
}
{
    // No existing About at all - nothing to separate from, no stray leading "----".
    const result = buildReferenceAboutMe("* '''Residence''': Chicago, Illinois - 1920", "", "https://example.com/record/1", []);
    assertTrue(result.indexOf("----") === -1, "No separator at all when there's no prior About content to separate from");
}
{
    // Marriage-only style update (blank content, just a footnote) onto a non-empty About still gets separated from what came before.
    const existingAbout = "* '''[https://myheritage.com/record/9 MyHeritage]''' - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''Jan 1 2020, 0:00:00 UTC''\n";
    const result = buildReferenceAboutMe("", existingAbout, "https://example.com/record/2", ["marriage"]);
    assertTrue(result.indexOf("----") !== -1, "A bare footnote-only addition (e.g. marriage-only) still gets separated from whatever About already had");
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
// (live-reported, DanCornett - #286 follow-up): a bare citation (no new
// content) should never duplicate a citation from the same source that's
// already the last thing in the About - e.g. deliberately forcing a
// "reviewed against this source" note onto an already-matching profile,
// repeated more than once.
// ============================================================
{
    const existingAbout = "* '''Residence''': Chicago, Illinois - 1920\n* '''[https://example.com/record/1 FamilySearch Family Tree]''' - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''Jan 1 2020, 0:00:00 UTC'' (this update: gender)\n";
    const result = buildReferenceAboutMe("", existingAbout, "https://example.com/record/1", ["gender"]);
    assertEqual(result, undefined, "#286 follow-up: a bare citation from the SAME source, with nothing new to add, is skipped - the last thing already there is already this exact citation");
}
{
    // Different source this time - still gets its own bare citation, no false suppression.
    const existingAbout = "* '''Residence''': Chicago, Illinois - 1920\n* '''[https://example.com/record/1 FamilySearch Family Tree]''' - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''Jan 1 2020, 0:00:00 UTC'' (this update: gender)\n";
    const result = buildReferenceAboutMe("", existingAbout, "https://myheritage.com/record/9", ["birth"]);
    assertTrue(exists(result), "A bare citation from a DIFFERENT source than the last one is still correctly written, not suppressed");
    assertTrue(result.indexOf("myheritage.com/record/9") !== -1, "The new citation is present");
}
{
    // Real new content from the SAME source as the last citation still gets its own citation - the dedup check never applies when content is genuinely new.
    const existingAbout = "* '''[https://example.com/record/1 FamilySearch Family Tree]''' - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''Jan 1 2020, 0:00:00 UTC''\n";
    const result = buildReferenceAboutMe("* '''Residence''': Detroit, Michigan - 1930", existingAbout, "https://example.com/record/1", ["about"]);
    assertTrue(exists(result), "Regression: real new content from the same source as the last citation still gets written and cited - the same-source dedup only ever applies to BARE citations");
    assertTrue(result.indexOf("Detroit") !== -1, "The new content itself is present");
}

// ============================================================
// Structural: the old nesting machinery is gone, and both call sites
// (focus profile's own submission + the family-member Add/Update paths)
// route through the one shared function.
// ============================================================
assertEqual(src.indexOf("function footnoteBulletPrefix"), -1, "#286 simplified: footnoteBulletPrefix() is removed entirely - no more nesting");
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
