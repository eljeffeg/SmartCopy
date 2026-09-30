// Verifies the two #286 design decisions Dan explicitly asked to be made
// intentionally, both confirmed with his own test evidence:
//
// (1) Citation freshness - "I'm inclined to desire the 'most recent'
//     citation, not the first." A suppressed bare-citation repeat used to
//     leave the existing citation completely untouched, forever carrying
//     whichever timestamp it got the first time. refreshLastCitationTimestamp()
//     now rewrites just the timestamp in place on every genuine
//     re-verification - still exactly one citation line, just current.
//
// (2) Dedup scope - "is this scraped content already present" used to
//     search the ENTIRE About history. Dan's own testing proved this
//     wrong: switching to a DIFFERENT source (Filae) for content that
//     happened to textually match something an earlier, unrelated
//     FamilySearch run had added caused the Filae content to be silently
//     dropped - only its citation got added. getLastAboutBlock() now
//     scopes the comparison to just the MOST RECENT block, and only
//     bothers comparing at all when that block's own citation is from the
//     SAME source - a different source's last block never counts as
//     "already documented from our source."
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
const footnoteLabel = new Function('exists', 'return ' + extractFunction(src, 'footnoteLabel'))(exists);
const getLastAboutBlock = new Function('exists', 'return ' + extractFunction(src, 'getLastAboutBlock'))(exists);
const isLastLineFromSameSource = new Function('exists', 'return ' + extractFunction(src, 'isLastLineFromSameSource'))(exists);
const refreshLastCitationTimestamp = new Function('exists', 'moment',
    extractVarStatement(src, 'ABOUT_CITATION_TIMESTAMP_PATTERN') + '\nreturn ' + extractFunction(src, 'refreshLastCitationTimestamp') + ';')(exists, moment);
const buildReferenceAboutMe = new Function('exists', 'moment', 'isAboutContentPresent', 'footnoteLabel', 'getLastAboutBlock', 'isLastLineFromSameSource', 'refreshLastCitationTimestamp', 'recordtype',
    'return ' + extractFunction(src, 'buildReferenceAboutMe'))(exists, moment, isAboutContentPresent, footnoteLabel, getLastAboutBlock, isLastLineFromSameSource, refreshLastCitationTimestamp, 'FamilySearch Family Tree');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// ============================================================
// Decision 1: getLastAboutBlock() itself
// ============================================================
assertEqual(JSON.stringify(getLastAboutBlock("")), JSON.stringify({ content: "", citationLine: "" }),
    "Empty About - no block at all");
{
    var oneBlock = "Some content\n* '''[http://x Source]''' - SmartCopy: ''Jan 1 2020''\n";
    var block = getLastAboutBlock(oneBlock);
    assertEqual(block.content, "Some content", "Single block: content is everything before the citation line");
    assertEqual(block.citationLine, "* '''[http://x Source]''' - SmartCopy: ''Jan 1 2020''", "Single block: citationLine is the last line");
}
{
    var twoBlocks = "Old content\n* '''[http://old Source]''' - SmartCopy: ''Jan 1 2020''\n\n----\n\nNew content\n* '''[http://new Source]''' - SmartCopy: ''Jan 2 2020''\n";
    var block = getLastAboutBlock(twoBlocks);
    assertEqual(block.content, "New content", "Two blocks: only the MOST RECENT block's content is returned, older block ignored");
    assertEqual(block.citationLine, "* '''[http://new Source]''' - SmartCopy: ''Jan 2 2020''", "Two blocks: citationLine is the most recent block's own citation");
}
{
    // A bare citation with no content at all (e.g. a marriage-only update) - content is "".
    var bareBlock = "Some content\n* '''[http://old Source]''' - SmartCopy: ''Jan 1 2020''\n\n----\n\n* '''[http://new Source]''' - SmartCopy: ''Jan 2 2020'' (this update: marriage)\n";
    var block = getLastAboutBlock(bareBlock);
    assertEqual(block.content, "", "A bare-citation-only most recent block has no content");
}

// ============================================================
// Decision 1: refreshLastCitationTimestamp() itself
// ============================================================
{
    var text = "Some content\n* '''[http://x Source]''' - SmartCopy: ''Jan 1 2020, 0:00:00 UTC'' (this update: about)\n";
    var refreshed = refreshLastCitationTimestamp(text);
    assertTrue(refreshed.indexOf("Jan 1 2020, 0:00:00 UTC") === -1, "The stale timestamp is gone");
    assertTrue(refreshed.indexOf("Some content") !== -1, "The content itself is untouched");
    assertTrue(refreshed.indexOf("(this update: about)") !== -1, "The categories suffix is untouched - only the timestamp changes");
    assertEqual((refreshed.match(/\* '''\[/g) || []).length, 1, "Still exactly one citation line - nothing duplicated");
}

// ============================================================
// Decision 1 end-to-end: a same-source, same-category repeat refreshes in place
// ============================================================
{
    var refurl = "https://familysearch.org/tree/person/details/ABCD-123";
    var run1 = buildReferenceAboutMe("", "", refurl, ["gender"]);
    assertTrue(exists(run1), "Run 1 writes a bare citation for a real category change");
    // Simulate time passing, then repeat with nothing new.
    var run2 = buildReferenceAboutMe("", run1, refurl, ["gender"]);
    assertTrue(exists(run2), "#286 freshness: run 2 (same source, same category, nothing new) still produces a result");
    assertEqual((run2.match(/\* '''\[/g) || []).length, 1, "#286 freshness: still exactly one citation - refreshed, not duplicated");
}

// ============================================================
// Decision 2 end-to-end: Dan's own Filae repro - a different source's
// coincidentally-matching content must NOT suppress genuinely new content
// ============================================================
{
    var fsUrl = "https://familysearch.org/tree/person/details/LTSG-Z7Z";
    var filaeUrl = "https://filae.com/some-record/12345";

    // Run 1: FamilySearch adds "Test".
    var afterFs = buildReferenceAboutMe("Test\n", "", fsUrl, ["about"]);
    assertTrue(afterFs.indexOf("Test") !== -1, "FamilySearch run writes 'Test'");

    // Run 2: Filae ALSO scrapes "Test" (coincidentally identical text, unrelated source).
    var afterFilae = buildReferenceAboutMe("Test\n", afterFs, filaeUrl, ["about"]);
    assertTrue(exists(afterFilae), "#286 fix (Dan's Filae repro): a different source's submission still produces a result");
    var filaeBlock = getLastAboutBlock(afterFilae);
    assertTrue(filaeBlock.content.indexOf("Test") !== -1,
        "#286 fix (Dan's Filae repro): the content 'Test' IS included in Filae's own block, not silently dropped just because FamilySearch already added the same word elsewhere");
    assertTrue(filaeBlock.citationLine.indexOf(encodeURI(filaeUrl)) !== -1,
        "The most recent block's citation is genuinely from Filae");
}

// Regression control: the SAME source repeating identical content still
// correctly dedupes (scope-narrowing shouldn't break the original,
// intentional same-source protection).
{
    var refurl = "https://familysearch.org/tree/person/details/ABCD-123";
    var afterFirst = buildReferenceAboutMe("Test\n", "", refurl, ["about"]);
    var afterRepeat = buildReferenceAboutMe("Test\n", afterFirst, refurl, ["about"]);
    var block = getLastAboutBlock(afterRepeat);
    assertEqual((afterRepeat.match(/Test/g) || []).length, 1,
        "Regression: the SAME source repeating identical content still only has ONE copy of the content - not duplicated");
}

// Regression control: content genuinely present in the SAME source's most
// recent block, with an unrelated OTHER category also changing, still
// correctly dedupes the content (while the citation freshness still
// applies from Decision 1).
{
    var refurl = "https://familysearch.org/tree/person/details/ABCD-123";
    var afterFirst = buildReferenceAboutMe("Test\n", "", refurl, ["about"]);
    var afterCategoryChange = buildReferenceAboutMe("Test\n", afterFirst, refurl, ["about", "alias"]);
    assertEqual((afterCategoryChange.match(/Test/g) || []).length, 1,
        "Same source, same content, but ALSO a genuinely new category - content still correctly recognized as already present (not duplicated), only the citation reflects the new category");
    assertTrue(afterCategoryChange.indexOf("alias") !== -1, "The new 'alias' category is documented in the (refreshed) citation");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
