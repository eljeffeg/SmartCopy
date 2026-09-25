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
//
// #235/#286 follow-up (live-reported, DanCornett - simplified): the actual
// footnote-building logic now lives in the shared buildReferenceAboutMe()
// (focus AND family members both use it); buildFocusReferenceAboutMe() is
// a thin wrapper threading the focus profile's own `focusabout` through.
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

// --- Minimal fakes for buildReferenceAboutMe()'s outer-scope deps ---
var recordtype = "FamilySearch Genealogy";
var moment = function () {
    return { format: function () { return "Jan 1 2026, 12:00:00"; } };
};
moment.utc = moment;

function isAboutContentPresent(existingAbout, content) {
    if (!exists(content) || content === "") { return true; }
    if (!exists(existingAbout) || existingAbout === "") { return false; }
    var normalized = content.replace(/\s+/g, " ").trim();
    return normalized !== "" && (existingAbout || "").replace(/\s+/g, " ").trim().indexOf(normalized) !== -1;
}
function footnoteLabel(url, baseRecordtype) { return baseRecordtype; }

const buildReferenceAboutMeSrc = extractFunction(src, 'buildReferenceAboutMe');
function makeBuildReferenceAboutMe() {
    return new Function('exists', 'moment', 'isAboutContentPresent', 'footnoteLabel', 'recordtype',
        'return ' + buildReferenceAboutMeSrc)(exists, moment, isAboutContentPresent, footnoteLabel, recordtype);
}
const buildReferenceAboutMe = makeBuildReferenceAboutMe();

const buildFocusReferenceAboutMeSrc = extractFunction(src, 'buildFocusReferenceAboutMe');
function makeBuildFocusReferenceAboutMe(focusabout) {
    return new Function('buildReferenceAboutMe', 'focusabout', 'return ' + buildFocusReferenceAboutMeSrc)(buildReferenceAboutMe, focusabout);
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// --- buildFocusReferenceAboutMe(): the deferred case (no new content, just documenting the marriage change) ---
// #235/#286 follow-up (live-reported, stbodie): a marriage-only update never
// touches About text (newAboutContent is ""), but it IS a genuine data
// change - updatedCategories reflects that, so a footnote still gets
// written to document it, even though About's own free text is untouched.
var buildFocusReferenceAboutMe1 = makeBuildFocusReferenceAboutMe("");
var result1 = buildFocusReferenceAboutMe1("", "https://example.com/person/1", ["marriage"]);
assertTrue(exists(result1), "A marriage-only update (blank newAboutContent) still writes a footnote, since a real category genuinely changed");
assertTrue(result1.indexOf("(this update: marriage)") !== -1, "The deferred footnote correctly summarizes 'marriage' as the touched category");
assertTrue(result1.trim().startsWith("*"), "The deferred footnote starts as a plain top-level bullet when About was empty");

// --- buildFocusReferenceAboutMe(): truly nothing changed - no content, no categories - no footnote ---
var buildFocusReferenceAboutMe1b = makeBuildFocusReferenceAboutMe("");
var result1b = buildFocusReferenceAboutMe1b("", "https://example.com/person/1", []);
assertEqual(result1b, undefined, "#286 simplified: blank content AND no changed categories writes nothing at all - the genuine no-op case");

// --- buildFocusReferenceAboutMe(): normal case with new about content ---
var buildFocusReferenceAboutMe2 = makeBuildFocusReferenceAboutMe("");
var result2 = buildFocusReferenceAboutMe2("Some new scraped bio text\n", "https://example.com/person/1", ["birth", "gender"]);
assertTrue(result2.indexOf("Some new scraped bio text") !== -1, "New about content is preserved in the merged result");
assertTrue(result2.indexOf("(this update: birth, gender)") !== -1, "Multiple touched categories are summarized correctly");
assertTrue(result2.trim().split("\n").pop().startsWith("*"), "The footnote is a plain top-level bullet");

// --- buildFocusReferenceAboutMe(): content already present AND nothing else changed - no duplicate footnote ---
var alreadyPresentAbout = "Some new scraped bio text\n* '''[https://example.com/person/1 FamilySearch Genealogy]''' - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''Jan 1 2026, 12:00:00 UTC''\n";
var buildFocusReferenceAboutMe3 = makeBuildFocusReferenceAboutMe(alreadyPresentAbout);
var result3 = buildFocusReferenceAboutMe3("Some new scraped bio text\n", "https://example.com/person/1", []);
assertEqual(result3, undefined, "Re-submitting the exact same content already present in the About, with nothing else changed, produces no change and no duplicate footnote");

// --- buildFocusReferenceAboutMe(): content already present BUT another field genuinely changed - footnote still written ---
var buildFocusReferenceAboutMe3b = makeBuildFocusReferenceAboutMe(alreadyPresentAbout);
var result3b = buildFocusReferenceAboutMe3b("Some new scraped bio text\n", "https://example.com/person/1", ["gender"]);
assertTrue(exists(result3b), "(live-reported, stbodie - #286 follow-up) Even though the About content is a repeat, a genuinely changed category (gender) still gets documented with a footnote");

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
