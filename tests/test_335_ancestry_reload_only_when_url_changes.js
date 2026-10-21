// Verifies a #335 further follow-up, live-reported by GaryKoven: v4.17.3.62
// (which already contained the verified DOMParser parsing fix) still failed
// identically to the original broken v...57 on all three of his profiles.
// His own diagnostic console output (added in v...61 specifically to chase
// this) showed the real cause:
//
//   SmartCopy [getPageCode]: reload=true tablink="https://www.ancestry.com/
//   family-tree/person/tree/40564031/person/19559416742/facts"
//   Ancestry: #person-data block not found ... htmlstring.length=5448
//   contains literal "person-data" substring=false
//
// `reload=true` on a URL that was ALREADY the final .../facts form (nothing
// for prepareUrl() to actually change) routes getPageCode() through the
// background `xhttp` fetch instead of capturePage()'s live-tab DOM read -
// and that raw background fetch got back a ~5KB response with no person
// data in it at all, consistent with Ancestry's /facts page being rendered
// client-side (the same class of gap already fixed for MyHeritage's
// redesigned profile page - see myheritagenew.js's own file-header comment:
// "the server response is an empty shell - so this only works because
// SmartCopy reads the live tab DOM after React has rendered it ... not a
// raw background fetch").
//
// Root cause in prepareUrl(): the branch handling a /family-tree/person/
// tree/ URL unconditionally set `this.reload = true` at the end, even when
// every one of its own string replacements was a no-op because the URL was
// already in final form - unlike the very next branch (person.ancestry.
// URLs), which only sets reload when `!url.contains("/facts")`, i.e. only
// when a transformation is actually needed. Fixed by applying that same
// "only set reload if the URL actually changed" guard to the first branch
// too.
//
// Extracts the REAL prepareUrl() function verbatim from the registerCollection
// object literal (not a reimplementation) - same brace-counting technique
// used throughout this suite, applied to an object-literal method instead
// of a standalone `function name(...)` declaration.
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

// Brace-counts the "prepareUrl": function(url) { ... } object-literal
// method out of the registerCollection({...}) call at the top of the file.
function extractPrepareUrlBody() {
    const marker = '"prepareUrl": function(url) {';
    const start = src.indexOf(marker);
    if (start === -1) throw new Error('prepareUrl marker not found - has ancestrynew.js changed shape?');
    const braceStart = src.indexOf('{', start);
    let depth = 0, i = braceStart;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(braceStart + 1, i);
}

function exists(v) { return typeof v !== 'undefined' && v !== null; }
// shared.js's own polyfill, needed since this test runs standalone (no
// shared.js loaded) but prepareUrl() uses String.prototype.contains.
if (!String.prototype.contains) {
    String.prototype.contains = function () { return String.prototype.indexOf.apply(this, arguments) !== -1; };
}
const startsWithHTTP = new Function('return ' + extractFunction(fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8'), 'startsWithHTTP'))();

// prepareUrl()'s early-return warning branch touches document/setMessage/
// warningmsg - not exercised by any case below (none of these URLs end in
// /family, /family/familyview, or /family/pedigree), but stubbed so the
// function can be constructed without throwing on an unrelated ReferenceError.
function runPrepareUrl(url) {
    var collectionLike = { reload: false };
    var fn = new Function('url', 'exists', 'startsWithHTTP', 'document', 'setMessage', 'warningmsg', `
        ${extractPrepareUrlBody()}
    `);
    var resultUrl = fn.call(collectionLike, url, exists, startsWithHTTP,
        { querySelector: function () { return { style: {} }; } },
        function () {}, 'warning');
    return { url: resultUrl, reload: collectionLike.reload };
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- #335 (2026-10-19, GaryKoven): a URL that's already the final .../facts form must NOT set reload. ---
{
    var result = runPrepareUrl('https://www.ancestry.com/family-tree/person/tree/40564031/person/19559416742/facts');
    assertEqual(result.reload, false,
        "#335: a /family-tree/person/tree/ URL already ending in /facts does not set reload=true (so getPageCode() uses capturePage()'s live-tab DOM read, not the background fetch that returns an empty client-rendered shell)");
    assertEqual(result.url, 'https://www.ancestry.com/family-tree/person/tree/40564031/person/19559416742/facts',
        "#335: the URL itself is left unchanged when it already was in final form");
}

// --- Regression: a genuine pedigree/family URL that DOES need converting to /facts still sets reload. ---
{
    var result = runPrepareUrl('https://trees.ancestry.com/tree/40564031/family/pedigree?fpid=19559416742');
    assertEqual(result.reload, true,
        "Regression: a pedigree URL that genuinely needs converting to a different person's /facts page still sets reload=true (a real transformation happened)");
    assertEqual(result.url, 'https://person.ancestry.com/tree/40564031/person/19559416742/facts',
        "Regression: the pedigree URL is still correctly converted to the target person's /facts URL");
}

// --- Regression: an already-correct person.ancestry.com /facts URL (the second branch) is unaffected by this change. ---
{
    var result = runPrepareUrl('https://person.ancestry.com/family-tree/person/tree/40564031/person/19559416742/facts');
    assertEqual(result.reload, false,
        "Regression: the second branch's own existing guard (person.ancestry.com URL already on /facts) still correctly leaves reload=false, unchanged by this fix");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
