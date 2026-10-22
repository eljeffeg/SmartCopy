// Verifies a #335 further follow-up, live-reported directly by the user:
// "much worse than the current store version... didn't get a full copy of
// the data for the spouse, used estimates when real data was there...
// didn't capture the gender of the siblings." Confirmed via a live
// diagnostic (15 family-member fetches in one run, every one coming back
// as a ~5.4KB response with zero occurrences of "person-data") AND by
// rebuilding the exact v4.17.3.49 store release and testing it against
// live Ancestry in a second browser - it showed the identical symptom.
// Not a regression this session introduced: getAncestryNewTreeFamily()
// fetches each family member's own page via a raw background `xhttp`
// request, a mechanism nothing in this session's earlier #335 work ever
// touched - Ancestry's /facts pages are rendered client-side across the
// board now, so a raw fetch can never see real content for a family
// member any more than it could for the focus profile (already fixed by
// reading the live tab's DOM instead - but a family member isn't the open
// tab, so that fix alone doesn't reach them).
//
// Fixed the same way MyHeritage's identical problem was already solved
// for its own React-rendered redesigned profile page
// (collections/myheritagenew.js's fetchMHFamilyViaTab()/runMHTabFetch()) -
// a quiet background tab actually runs the page's JS, gets polled until
// real content has rendered, captured, then closed. isAncestryPageReady()
// is the shared "has this actually rendered yet" check, reused by both
// getPageCode()'s own isPageReady hook (the focus profile's live-tab
// capture) and fetchAncestryPersonViaTab()'s polling loop (family
// members).
//
// chrome.tabs/chrome.scripting can't be meaningfully exercised outside a
// real browser (same reason MyHeritage's own tab-fetch mechanism has no
// unit test either) - covers what CAN be tested in isolation
// (isAncestryPageReady() itself, real function verbatim) plus structural
// checks that the family-fetch path was actually rewired to use it rather
// than the old xhttp call, and that usesDeepResearch is set so the
// existing "Skip Deep Research for this run" escape hatch applies here too.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'collections/ancestrynew.js'), 'utf8');

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

function exists(v) { return typeof v !== 'undefined' && v !== null; }
const isAncestryPageReady = new Function('exists', 'return ' + extractFunction(src, 'isAncestryPageReady'))(exists);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

// --- isAncestryPageReady(): the exact empty-shell case confirmed live (both by the user's own fetch and the rebuilt v4.17.3.49 test) ---
assertEqual(isAncestryPageReady('<!DOCTYPE html><html><head></head><body><div id="app-root">Loading...</div></body></html>'), false,
    "#335: an empty client-rendered shell (no person-data, no legacy PersonCard) is correctly NOT ready - this is the exact failure mode confirmed live");
assertEqual(isAncestryPageReady(undefined), false, "Safety: undefined/not-yet-captured content is never ready");
assertEqual(isAncestryPageReady(''), false, "Safety: an empty string is never ready");

// --- Real content, either format ---
assertEqual(isAncestryPageReady('<!DOCTYPE html><html><body><script id="person-data" type="application/json">{}</script></body></html>'), true,
    "The modern #person-data block being present means the page is ready");
assertEqual(isAncestryPageReady('<!DOCTYPE html><html><body><script>var PersonCard = {};</script></body></html>'), true,
    "The legacy var PersonCard script being present also means the page is ready");

// --- The "not signed in" page is a stop-waiting case, not a "still loading" case ---
assertEqual(isAncestryPageReady('<html><body>Please sign in for secure access to your Ancestry account</body></html>'), true,
    "The 'please sign in' page is treated as ready - no amount of retrying fixes a login wall, so don't waste the retry budget on it");

// --- Structural: getAncestryNewTreeFamily() no longer uses the raw xhttp fetch for family members ---
{
    const fnSrc = extractFunction(src, 'getAncestryNewTreeFamily');
    assertTrue(fnSrc.indexOf('action: "xhttp"') === -1,
        "#335: getAncestryNewTreeFamily() no longer fetches a family member's page via the raw background xhttp mechanism");
    assertTrue(fnSrc.indexOf('fetchAncestryPersonViaTab(url,') !== -1,
        "#335: getAncestryNewTreeFamily() now fetches each family member via fetchAncestryPersonViaTab() (real tab capture)");
}

// --- Structural: usesDeepResearch is set, so the existing Skip Deep Research control becomes available for Ancestry too ---
assertTrue(src.indexOf('"usesDeepResearch": true') !== -1,
    "#335: Ancestry opts into usesDeepResearch, matching the other tab-capture collections (MyHeritage/Filae/Geneanet/OnlineOFB) - the family fetch is now genuinely slower, so the same skip escape hatch should be available");

// --- Structural: the registered isPageReady hook delegates to the same shared check fetchAncestryPersonViaTab() polls with ---
assertTrue(src.indexOf('"isPageReady": function(htmlstring) {\n        return isAncestryPageReady(htmlstring);\n    }') !== -1,
    "#335: the focus profile's own isPageReady hook and the family-member tab-capture polling share the exact same readiness check, not two independent copies");

// --- Structural: fetchAncestryPersonViaTab() respects the Skip Deep Research toggle, same contract as MyHeritage's version ---
{
    const fnSrc = extractFunction(src, 'fetchAncestryPersonViaTab');
    assertTrue(fnSrc.indexOf('if (!deepResearchOn || deepResearchSkipRun)') !== -1,
        "#335: fetchAncestryPersonViaTab() skips the tab-capture (treats it as 'nothing fetched', same as any other failed fetch) when Deep Research is off or skipped for this run");
    assertTrue(fnSrc.indexOf('active: false') !== -1,
        "#335: the background tab is opened inactive - never steals focus from whatever the user is looking at");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
