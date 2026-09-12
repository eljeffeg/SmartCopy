// Verifies the marriage-via-spouse footnote fix (live-reported): marriage/
// divorce data submits through a shared union endpoint, not either
// spouse's own profile endpoint - every entry in spouselist is a partner
// OF THE FOCUS PERSON, so updating a spouse's marriage record genuinely
// changes the focus person's own marriage data too, even when nothing on
// the focus person's own form was checked. Previously that meant the
// focus person's About never got a footnote documenting it at all.
//
// buildFocusReferenceAboutMe() was extracted from the focus profile's own
// (pre-existing, heavily live-hardened) submission block so both the
// normal path and this new deferred path share identical footnote logic -
// this file both verifies the extraction didn't change behavior AND
// verifies the new deferred call site is wired correctly.
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

// --- Minimal fakes for buildFocusReferenceAboutMe()'s outer-scope deps ---
var focusabout = "";
var recordtype = "FamilySearch Genealogy";
var moment = function () {
    return { format: function () { return "Jan 1 2026, 12:00:00"; } };
};
moment.utc = moment;

function mergeAboutText(existingAbout, newContent) {
    if (!exists(newContent) || newContent === "") {
        return existingAbout || "";
    }
    if (!exists(existingAbout) || existingAbout === "") {
        return newContent;
    }
    return existingAbout + "\n" + newContent;
}
function footnoteLabel(url, baseRecordtype) { return baseRecordtype; }
function isLastLineFromSameSource(text, token) {
    if (!exists(text) || text === "") { return false; }
    var lines = text.split("\n").filter(function (l) { return l.trim() !== ""; });
    return lines.length > 0 && lines[lines.length - 1].indexOf(token) !== -1;
}
function footnoteBulletPrefix(existingAbout) {
    if (!exists(existingAbout) || existingAbout === "") { return "*"; }
    var lines = existingAbout.split("\n").filter(function (l) { return l.trim() !== ""; });
    if (lines.length === 0) { return "*"; }
    var m = lines[lines.length - 1].trim().match(/^(\*+)/);
    return exists(m) ? m[1] + "*" : "*";
}

const buildFocusReferenceAboutMeSrc = extractFunction(src, 'buildFocusReferenceAboutMe');
const buildFocusReferenceAboutMe = new Function(
    'exists', 'mergeAboutText', 'footnoteLabel', 'isLastLineFromSameSource', 'footnoteBulletPrefix',
    'moment', 'recordtype', 'focusabout',
    'return ' + buildFocusReferenceAboutMeSrc
)(exists, mergeAboutText, footnoteLabel, isLastLineFromSameSource, footnoteBulletPrefix, moment, recordtype, focusabout);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// --- buildFocusReferenceAboutMe(): the deferred case (no new content, just a footnote) ---
var result1 = buildFocusReferenceAboutMe("", "https://example.com/person/1", ["marriage"]);
assertTrue(exists(result1), "Deferred case (blank newAboutContent) still produces a footnote to write");
assertTrue(result1.indexOf("(this update: marriage)") !== -1, "The deferred footnote correctly summarizes 'marriage' as the touched category");
assertTrue(result1.trim().startsWith("*"), "The deferred footnote starts as a plain top-level bullet when About was empty");

// --- buildFocusReferenceAboutMe(): normal case with new about content ---
var result2 = buildFocusReferenceAboutMe("Some new scraped bio text\n", "https://example.com/person/1", ["birth", "gender"]);
assertTrue(result2.indexOf("Some new scraped bio text") !== -1, "New about content is preserved in the merged result");
assertTrue(result2.indexOf("(this update: birth, gender)") !== -1, "Multiple touched categories are summarized correctly");

// --- buildFocusReferenceAboutMe(): already-referenced (reference spam suppression) ---
var alreadyReferencedAbout = "* '''[https://example.com/person/1 FamilySearch Genealogy]''' - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''Jan 1 2026, 12:00:00 UTC''\n";
var result3 = buildFocusReferenceAboutMe("", "https://example.com/person/1", ["marriage"]);
// (Re-run against a focusabout that already ends with this exact source's footnote line - simulated by
// passing it as newAboutContent merged onto nothing, since focusabout is fixed at "" in this harness.)
var buildFocusReferenceAboutMeWithHistory = new Function(
    'exists', 'mergeAboutText', 'footnoteLabel', 'isLastLineFromSameSource', 'footnoteBulletPrefix',
    'moment', 'recordtype', 'focusabout',
    'return ' + buildFocusReferenceAboutMeSrc
)(exists, mergeAboutText, footnoteLabel, isLastLineFromSameSource, footnoteBulletPrefix, moment, recordtype, alreadyReferencedAbout);
var result4 = buildFocusReferenceAboutMeWithHistory("", "https://example.com/person/1", ["marriage"]);
assertEqual(result4, alreadyReferencedAbout, "Back-to-back reference from the same source with nothing new is suppressed (no duplicate footnote)");

// --- getFocusRefUrl() ---
const getFocusRefUrlSrc = extractFunction(src, 'getFocusRefUrl');
function makeGetFocusRefUrl(alldata, tablink) {
    return new Function('exists', 'alldata', 'tablink', 'return ' + getFocusRefUrlSrc)(exists, alldata, tablink);
}
assertEqual(makeGetFocusRefUrl({ profile: { url: "https://real.url/person/1" } }, "https://tab.link/fallback")(),
    "https://real.url/person/1", "getFocusRefUrl() prefers alldata.profile.url when present");
assertEqual(makeGetFocusRefUrl({ profile: {} }, "https://tab.link/fallback")(),
    "https://tab.link/fallback", "getFocusRefUrl() falls back to tablink when profile.url is missing");

// --- Deferred call site wiring (structural checks on the real source) ---
assertTrue(src.indexOf("var focusMarriageFootnoteAdded = false;") !== -1,
    "focusMarriageFootnoteAdded guard variable is declared");
// #303: sourcecheck/profileout used to be read directly here, but both
// are locals of submitform() - a completely different function from
// submitChildren() (where this line lives), which has no closure over
// them. Fixed to read the checkbox directly and a captured module-level
// global instead (see test_303_marriage_footnote_scope_crash.js for the
// full regression coverage of that crash).
assertTrue(src.indexOf("if (!$.isEmptyObject(marriageupdate) && $('#sourceonoffswitch').prop('checked') && focusProfileSubmissionWasEmpty && !focusMarriageFootnoteAdded) {") !== -1,
    "The deferred footnote only fires when: a real marriage/divorce update exists, reference notes are on, the focus person's OWN update didn't already run, and it hasn't already fired this session");
assertTrue(src.indexOf("focusMarriageFootnoteAdded = true;") !== -1,
    "The guard flips to true so a second spouse's marriage update in the same run doesn't add a second footnote");
assertTrue(src.indexOf("summarizeUpdatedCategories({}, false, marriagedates[i]);") !== -1,
    "Categories are derived purely from the marriage/divorce entry - no other fields were touched in this deferred path");
assertTrue(src.indexOf('buildTree({about_me: focusMarriageAboutMe}, "update", focusid);') !== -1,
    "The deferred update submits ONLY about_me for the focus person - no unrelated fields get dragged along");
assertTrue(src.indexOf("updatetotal += 1;\n                        buildTree({about_me: focusMarriageAboutMe}") !== -1,
    "updatetotal is incremented for this extra submission so the progress indicator stays accurate");

// --- Normal-path call site now delegates to the shared helper ---
assertTrue(src.indexOf('var builtAboutMe = buildFocusReferenceAboutMe(about, refurl, updatedCategories);') !== -1,
    "The focus profile's own (normal-path) submission now calls the shared helper instead of duplicating the logic inline");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
