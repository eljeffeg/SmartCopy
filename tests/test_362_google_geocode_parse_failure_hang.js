// Verifies #362 (live-reported, DanCornett): pasting a GPS coordinate
// pair into the "Edit Location" box and clicking Lookup made the spinner
// hang forever. Root cause, confirmed by direct code tracing and then by
// actually running the real functions below: queryGeoGoogle() (unlike its
// sibling performFamilySearchQuery(), which has always wrapped its own
// equivalent JSON.parse in try/catch per this file's own "never throws,
// degrade to blank" convention) had TWO unguarded `JSON.parse(response.
// source)` calls. A response that isn't valid JSON - any network-level
// failure leaves response.source unset entirely; a non-2xx response can
// also come back as plain text/HTML rather than JSON - threw there,
// uncaught, aborting that callback before it ever reached the
// geostatus.pop() that's supposed to turn the spinner back off (the
// SECOND request's callback is the only place that pop ever happens -
// see queryGeoGoogle()'s own comment). geostatus then never returns to
// empty, so updateGeoLocation()'s poll loop (buildform.js) - which only
// clears the "wait" class once geostatus IS empty - spins forever. This
// is a generic robustness gap, not specific to coordinate text; a
// coordinate pair is simply one concrete, easily-triggered way to reach
// it on a malformed/failed response.
//
// Loads shared.js + parse-location.js together as one real script
// context (eval, not a reimplementation) - same technique
// test_357_fs_date_filter_drops_undated_candidate.js already established
// for this exact file's deep, transitive dependency chain (checkPlace,
// USCheck, GeoLocation, parseGoogle, compareGeo, countGeoFields all stay
// the real, unmodified functions, callable from the real queryGeoGoogle()
// under test) - rather than hand-extracting each one separately.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const sharedSrc = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
const plSrc = fs.readFileSync(path.join(ROOT, 'parse-location.js'), 'utf8');

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// Queues canned chrome.runtime.sendMessage responses in call order and
// invokes each callback SYNCHRONOUSLY (no setTimeout needed) - lets the
// test assert geostatus/geolocation state immediately after
// queryGeoGoogle() returns, with a real try/catch around that call
// itself to prove no exception escapes, not just that one eventually
// got swallowed somewhere.
function makeChrome(responses) {
    var callIndex = 0;
    return {
        runtime: {
            sendMessage: function (msg, callback) {
                // Real background.js always echoes the request's own
                // `variable` payload back onto the response (vartn =
                // {variable: request.variable}, background.js) - queryGeoGoogle()
                // reads id/place/location back off THAT, not off the
                // original msg directly, so the mock needs to do the same
                // merge or every response.variable.* access below throws
                // (a test-harness gap, not something the real fix needs
                // to handle).
                var canned = responses[callIndex] || {};
                callIndex++;
                callback(Object.assign({ variable: msg.variable }, canned));
            }
        }
    };
}

function freshContext(chromeMock) {
    global.chrome = chromeMock;
    global.geoqueryCheck = function () { return true; }; // force the Google path, matching Dan's report
    global.google_api = "fake-test-key";
    global.geolocation = [];
    global.geostatus = [];
    global.verbose = false;
    var combined = sharedSrc + '\n' + plSrc;
    var ctx = new Function(combined + '\nreturn { queryGeoGoogle: queryGeoGoogle };')();
    return ctx;
}

// --- Scenario 1: first response is malformed (not valid JSON) - this is the exact crash point, since response.source is read before the second request is ever sent. ---
(function () {
    var ctx = freshContext(makeChrome([
        { source: "500 Internal Server Error - upstream timeout" } // not valid JSON
    ]));
    var threw = false;
    try {
        ctx.queryGeoGoogle({ id: 0, location: "32.75,-97.33" });
    } catch (e) {
        threw = true;
    }
    assertTrue(!threw, "A malformed first response no longer throws out of queryGeoGoogle() at all");
    assertEqual(global.geostatus.length, 0, "geostatus returns to empty instead of staying stuck - this is what actually stops the spinner");
    assertTrue(global.geolocation[0] !== undefined, "geolocation[id] is still populated with a safe result, not left undefined");
    assertEqual(global.geolocation[0].count, 0, "The safe fallback result correctly reads as 'nothing found' (count 0), not a false match");
})();

// --- Scenario 2: first response is valid JSON (so a SECOND request actually gets sent), but THAT second response is malformed. ---
(function () {
    var validFirstResponse = { source: JSON.stringify({ results: [] }) };
    var malformedSecondResponse = { source: "<html>Bad Gateway</html>" };
    var ctx = freshContext(makeChrome([validFirstResponse, malformedSecondResponse]));
    var threw = false;
    try {
        ctx.queryGeoGoogle({ id: 0, location: "32.75,-97.33" });
    } catch (e) {
        threw = true;
    }
    assertTrue(!threw, "A malformed SECOND response (the one that normally pops geostatus) no longer throws either");
    assertEqual(global.geostatus.length, 0, "geostatus still returns to empty when the failure happens on the second request instead of the first");
    assertTrue(global.geolocation[0] !== undefined, "geolocation[id] stays populated (falls back to the first request's own already-blank result)");
})();

// --- Scenario 3: both responses are undefined.source entirely (the real network-failure shape - background.js's own .catch() path never sets .source at all). ---
(function () {
    var ctx = freshContext(makeChrome([{}, {}]));
    var threw = false;
    try {
        ctx.queryGeoGoogle({ id: 0, location: "Chicago, Illinois, United States" });
    } catch (e) {
        threw = true;
    }
    assertTrue(!threw, "response.source being completely absent (a real network failure, not just a bad body) is handled the same safe way");
    assertEqual(global.geostatus.length, 0, "geostatus still returns to empty");
})();

// --- Scenario 4 (regression safety): a genuinely VALID response on both requests still works exactly as before - the try/catch wrapping didn't change the success path. ---
(function () {
    var validResponse = { source: JSON.stringify({ results: [] }) }; // a real, well-formed "nothing found" Google response
    var ctx = freshContext(makeChrome([validResponse, validResponse]));
    var threw = false;
    try {
        ctx.queryGeoGoogle({ id: 0, location: "Springfield, Illinois, United States" });
    } catch (e) {
        threw = true;
    }
    assertTrue(!threw, "A normal, well-formed empty-results response still completes without error");
    assertEqual(global.geostatus.length, 0, "geostatus empties normally on the success path too");
    assertEqual(global.geolocation[0].count, 0, "A genuinely empty Google result set still correctly reads as count=0, same as always");
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
