// Verifies #357 follow-up (live-reported by the user): "Empfingen,
// Freudenstädter Landkreis, Baden-Württemberg, Germany" (1923) resolved
// to a completely unrelated "Baden, Baden, Baden, Germany" instead.
//
// Root cause, confirmed via direct queries against the REAL FamilySearch
// Places API (not guessed): the correct "Empfingen, Freudenstadt" match
// has no recorded temporalDescription at all (common for smaller
// places) - isYearWithinFsTemporalRange() (parse-location.js) already
// correctly treats an undated candidate as always valid, but it never
// gets the chance to: FamilySearch's own SERVER silently drops that
// candidate from the result set entirely once `+date:1923` is part of
// the query text, leaving only the one unrelated place that happens to
// have an explicit (and coincidentally matching) date range. The
// identical query WITHOUT the date constraint correctly returns
// "Empfingen, Freudenstadt" as the top-scored match (score 82 vs. 77).
//
// Fixed with a cheap, conditional retry: the dated query still runs
// first and alone in the common case (no extra cost). Only when it
// returns FEWER than the full requested count (FS_SEARCH_RESULT_COUNT)
// - a simple signal the server's own date filtering may have silently
// excluded other valid candidates - does a second, undated query run,
// letting the same, already-correct selection pipeline pick from the
// now-fuller candidate list.
//
// Uses the REAL extracted attemptFamilySearchQuery() and its full real
// dependency chain (shared.js + parse-location.js, loaded together as
// one script, matching the real load order in popup.html) - a mocked
// chrome.runtime.sendMessage() returns realistic responses shaped
// exactly like the real API calls this test is based on, keyed by
// whether the query text contains "+date:".
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const sharedSrc = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
const parseLocationSrc = fs.readFileSync(path.join(ROOT, 'parse-location.js'), 'utf8');

function exists(v) { return typeof v !== 'undefined' && v !== null; }

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// Realistic mock responses, shaped exactly like the real, live-confirmed
// API results for this exact case.
function fsEntry(fullName, type, temporalFormal, score) {
    var place = { display: { name: fullName.split(',')[0], type: type }, names: [{ value: fullName }] };
    if (exists(temporalFormal)) {
        place.temporalDescription = { formal: temporalFormal };
    }
    return { content: { gedcomx: { places: [place] } }, score: score };
}

const datedResponse = { entries: [
    fsEntry('Baden, Baden, Baden, Germany', 'City', '+1871/+1924', 77)
] };
const undatedResponse = { entries: [
    fsEntry('Empfingen, Freudenstadt, Baden-Württemberg, Germany', 'Municipality', undefined, 82),
    fsEntry('Baden-Baden, Baden-Württemberg, Germany', 'City', '+1945/', 71),
    fsEntry('Dettingen, Oberamt Haigerloch, Hohenzollern, Prussia, Germany', 'Municipality', '+1871/+1946', 64)
] };

function buildContext(mockSendMessage) {
    global.chrome = { runtime: { sendMessage: mockSendMessage } };
    return new Function('exists', sharedSrc + '\n' + parseLocationSrc + '\nreturn { attemptFamilySearchQuery: attemptFamilySearchQuery };')(exists);
}

// --- #357 follow-up: the exact reported case - dated query comes back thin, retries undated, and resolves to the CORRECT place. ---
{
    var calls = [];
    var ctx = buildContext(function (msg, callback) {
        calls.push(msg.url);
        var withDate = msg.url.indexOf('%2Bdate') !== -1 || msg.url.indexOf('+date') !== -1;
        var body = withDate ? datedResponse : undatedResponse;
        callback({ source: JSON.stringify(body) });
    });
    var result;
    ctx.attemptFamilySearchQuery('Empfingen, Freudenstädter Landkreis, Baden-Württemberg, Germany', 1923, 'Empfingen, Freudenstädter Landkreis, Baden-Württemberg, Germany', '', function (r) { result = r; });

    assertEqual(calls.length, 2,
        "#357 follow-up: a thin dated response (1 result, fewer than FS_SEARCH_RESULT_COUNT) triggers exactly one undated retry");
    assertTrue(exists(result), "A result was found at all (not undefined)");
    assertEqual(result && result.city, 'Empfingen',
        "#357 follow-up: resolves to the CORRECT place ('Empfingen') via the undated retry, not the unrelated 'Baden' match the dated-only query would have returned");
}

// --- Safety: a dated query that returns the FULL requested count never triggers a retry - no extra cost in the common case. ---
{
    var calls = [];
    var fullResponse = { entries: [
        fsEntry('Place A', 'Municipality', '+1900/', 90),
        fsEntry('Place B', 'Municipality', '+1900/', 85),
        fsEntry('Place C', 'Municipality', '+1900/', 80),
        fsEntry('Place D', 'Municipality', '+1900/', 75),
        fsEntry('Place E', 'Municipality', '+1900/', 70)
    ] };
    var ctx = buildContext(function (msg, callback) {
        calls.push(msg.url);
        callback({ source: JSON.stringify(fullResponse) });
    });
    var result;
    ctx.attemptFamilySearchQuery('Some Place', 1900, 'Some Place', '', function (r) { result = r; });

    assertEqual(calls.length, 1,
        "Safety: a full 5-result dated response never triggers the undated retry - no extra API call in the common, already-working case");
    assertEqual(result && result.city, 'Place A',
        "Safety: the dated query's own top result is used normally when it's not thin");
}

// --- Safety: no year at all - never retries (nothing for a date filter to even exclude). ---
{
    var calls = [];
    var ctx = buildContext(function (msg, callback) {
        calls.push(msg.url);
        callback({ source: JSON.stringify(datedResponse) });
    });
    var result;
    ctx.attemptFamilySearchQuery('Some Place', undefined, 'Some Place', '', function (r) { result = r; });

    assertEqual(calls.length, 1,
        "Safety: with no year at all, there's no date filter to have excluded anything - never retries");
}

// --- Safety: the dated query failing/returning nothing at all still correctly triggers the undated retry too (not just 'thin but nonzero'). ---
{
    var calls = [];
    var ctx = buildContext(function (msg, callback) {
        calls.push(msg.url);
        var withDate = msg.url.indexOf('%2Bdate') !== -1 || msg.url.indexOf('+date') !== -1;
        var body = withDate ? { entries: [] } : undatedResponse;
        callback({ source: JSON.stringify(body) });
    });
    var result;
    ctx.attemptFamilySearchQuery('Empfingen', 1923, 'Empfingen', '', function (r) { result = r; });

    assertEqual(calls.length, 2,
        "Safety: a dated query returning ZERO results (not just 'fewer than 5') still correctly triggers the undated retry");
    assertEqual(result && result.city, 'Empfingen',
        "Safety: the retry still correctly resolves the place in the zero-results case");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
