// Verifies the #335 fix (live-reported via the Geni discussion board, then
// independently reproduced and conclusively diagnosed by GaryKoven, who
// attached actual saved Ancestry/Geni page source to the issue):
// Ancestry's parser logged "Ancestry: #person-data block not found,
// falling back to legacy page format" and failed to parse the focus
// profile's own fields AND all family data, even on 4.17.3.57 (which
// already included a first attempt at this fix).
//
// That first attempt matched the script tag via jQuery's
// `$(selector, htmlString)` instead of an exact literal string, reasoning
// it would tolerate attribute changes (a CSP nonce, reordered attributes).
// It did NOT fix the real bug. Testing directly against GaryKoven's actual
// saved page source made it provable, and the exact trigger was then
// isolated with a minimal synthetic reproduction (see CLAUDE.md's own
// "Parsing a raw HTML string from a source page" guardrail for the full
// writeup): jQuery's HTML-string parsing flattens any element that is a
// DIRECT CHILD of `<head>` or `<body>` out to the top level of the parsed
// result, instead of keeping it nested where it actually is in the
// document. `.find(selector)` searches descendants and never reaches it;
// `.filter(selector)` against that same parsed result finds it
// immediately, because it's sitting right there at the top level. An
// element nested inside anything else first (a <div>, any other real
// container) parses and queries normally - which is exactly why this
// matters: a real page's main content script is routinely a direct child
// of <body> or <head> (it was, for Ancestry's #person-data block), so
// this isn't an edge case, it's the common case. The identical bug
// existed in extractLegacyPersonData()'s
// `$("script:contains('var PersonCard')", htmlString)` call too.
//
// Fixed by using DOMParser instead - it parses a full HTML document
// properly (it isn't building an innerHTML fragment, so there's nothing
// to flatten) and is available here (popup.html, not the background
// service worker), same as every other DOM-dependent helper in this file.
//
// The fixture below places the target script as a direct child of <body>
// (deliberately NOT wrapped in a div) specifically to exercise this exact
// shape - an earlier version of this test wrapped it in a div "to look
// more realistic" and, without realizing it, tested a shape that can
// never actually fail, letting the original broken fix pass clean.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');
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

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
function exists(v) { return typeof v !== 'undefined' && v !== null; }
global.exists = exists;

const extractNewPersonData = new Function('DOMParser', 'exists', 'resolveAncestryUrl', `
    ${extractFunction(src, 'extractNewPersonData')}
    return extractNewPersonData;
`)(global.DOMParser, exists, function (u) { return u; });

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

function samplePersonDataJson() {
    return JSON.stringify({
        personId: "12345",
        person: {
            PersonCard: { FullName: "Jane Smith", LifeRange: "1850&ndash;1920", IsLiving: false },
            PersonResearch: {
                PersonFacts: [{ TypeString: "Birth", FactType: 0 }],
                PersonFamily: { Children: [{ name: "John Smith" }], Fathers: [], Mothers: [], Siblings: [], HalfSiblings: [], Spouses: [] }
            }
        }
    });
}

// A realistic full-document shape - doctype, a real <head> with other
// scripts/meta tags, a <body> with unrelated surrounding content - with
// the target script placed as a direct child of <body>, the one specific
// shape that actually triggers jQuery's flattening bug (see the file
// header comment). The surrounding bulk isn't what matters here; the
// script's own direct-child placement is.
function realisticPage(scriptTagOpen) {
    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
        '<title>Person Page</title>' +
        '<script src="https://example.com/some-bundle.js"></script>' +
        '<script>window.someGlobalConfig = {a: 1, b: 2};</script>' +
        '</head><body>' +
        '<nav><div class="header"><ul><li>Home</li><li>Trees</li></ul></div></nav>' +
        '<div id="app-root"><div class="person-overview"><div class="toolbar"><button>Edit</button></div>' +
        '<div class="content-panel"><p>Some unrelated page content here.</p></div></div></div>' +
        scriptTagOpen + samplePersonDataJson() + '</script>' +
        '<footer><div>Some footer content</div></footer>' +
        '</body></html>';
}

// --- #335 fix: the real failure mode - a realistic FULL document, original tag format. ---
{
    var html = realisticPage('<script id="person-data" type="application/json">');
    var result = extractNewPersonData(html);
    assertTrue(result !== null, "#335: the #person-data block is found on a realistic full HTML document (the actual failure mode jQuery's string-context selector couldn't handle)");
    assertEqual(result.name, "Jane Smith", "#335: name parses correctly from a realistic full document");
    assertEqual(result.family.Children.length, 1, "#335: family data parses correctly from a realistic full document");
}

// --- #335 fix: a CSP nonce (or any other extra attribute) on the same tag must not break detection either. ---
{
    var html = realisticPage('<script id="person-data" type="application/json" nonce="aBc123XyZ==">');
    var result = extractNewPersonData(html);
    assertTrue(result !== null, "#335: a script#person-data tag with an added CSP nonce attribute is still found on a realistic full document");
    assertEqual(result.name, "Jane Smith", "#335: name still parses correctly with the nonce attribute present");
}

// --- #335 fix: reordered attributes must not break detection either. ---
{
    var html = realisticPage('<script type="application/json" id="person-data">');
    var result = extractNewPersonData(html);
    assertTrue(result !== null, "#335: reordered attributes on the tag are still found (id-based selection, not a fixed attribute order)");
}

// --- Safety: a genuinely absent block must still correctly return null, allowing the legacy fallback to run. ---
{
    var html = '<!DOCTYPE html><html><head><title>t</title></head><body><div id="app-root"><p>No person data here</p></div></body></html>';
    var result = extractNewPersonData(html);
    assertEqual(result, null, "Safety: a page with no #person-data block at all still correctly returns null (legacy fallback still runs)");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
