// Verifies two fixes borrowed from a review of pquenee/SmartCopy's
// beta-413-1-9 branch: (1) a broken "MM/ /YYYY" entry in popup.js's
// dateformatter array (a literal space can never match a real day
// number - confirmed dead via moment.js), fixed to "MM/DD/YYYY"; (2)
// content.js's dynamically-built action links used href='javascript:void(0)'
// throughout, which can trip CSP/store-review checks - replaced with
// href='#' plus e.preventDefault() in every corresponding click handler.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const popupSrc = fs.readFileSync('' + ROOT + '/popup.js', 'utf8');
const contentSrc = fs.readFileSync('' + ROOT + '/content.js', 'utf8');
const moment = require('' + ROOT + '/moment.js');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- dateformatter fix ---
assertTrue(popupSrc.indexOf('"MM/ /YYYY"') === -1, "The broken 'MM/ /YYYY' format entry no longer exists");
assertTrue(popupSrc.indexOf('"MM/DD/YYYY"') !== -1, "The fixed 'MM/DD/YYYY' format entry is present");
assertTrue(moment('07/28/2026', 'MM/DD/YYYY', true).isValid(), "'MM/DD/YYYY' actually parses a real numeric date correctly");

// --- javascript:void(0) removal ---
assertEqual((contentSrc.match(/javascript:void\(0\)/g) || []).length, 0,
    "No javascript:void(0) hrefs remain anywhere in content.js");

// Every click handler that replaced a javascript:void(0) href now
// declares its event param and calls preventDefault() as its first
// statement, so the '#' href never actually navigates.
const handlersExpectedToPreventDefault = [
    "$('#addbio').on('click', function (e) {\n            e.preventDefault();",
    "$('#exportProjectProfiles').on('click', function (e) {\n                e.preventDefault();",
    "$('.makepublic').on('click', function (e) {\n            e.preventDefault();",
    "$('.fixspace').on('click', function (e) {\n            e.preventDefault();",
    "$('.fixcase').on('click', function (e) {\n            e.preventDefault();",
    "$('.fixsuffix').on('click', function (e) {\n            e.preventDefault();",
    "$('.clearfield').on('click', function (e) {\n            e.preventDefault();"
];
handlersExpectedToPreventDefault.forEach(function (snippet) {
    assertTrue(contentSrc.indexOf(snippet) !== -1, "Handler calls preventDefault() as its first statement: " + snippet.split("'")[1]);
});

// Every affected link now uses a plain '#' href instead.
["addbio", "exportProjectProfiles"].forEach(function (id) {
    assertTrue(contentSrc.indexOf("id='" + id + "' href='#'") !== -1 || contentSrc.indexOf("id='" + id + "' href='javascript") === -1,
        "'" + id + "' link no longer uses a javascript: href");
});
assertEqual((contentSrc.match(/href='#' class='makepublic'/g) || []).length, 2, "Both makepublic links use href='#'");
assertEqual((contentSrc.match(/class='clearfield' href='#'/g) || []).length, 6, "All 6 clearfield links use href='#'");
assertTrue(contentSrc.indexOf("class='fixspace' href='#'") !== -1, "fixspace link uses href='#'");
assertTrue(contentSrc.indexOf("class='fixcase' href='#'") !== -1, "fixcase link uses href='#'");
assertTrue(contentSrc.indexOf("class='fixsuffix' href='#'") !== -1, "fixsuffix link uses href='#'");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
