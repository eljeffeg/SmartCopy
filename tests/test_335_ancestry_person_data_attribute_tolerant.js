// Verifies a #335 fix (live-reported via the Geni discussion board):
// Ancestry's parser logged "Ancestry: #person-data block not found,
// falling back to legacy page format" and then failed to parse family
// data at all. Reproduced inconsistently across profiles, not every time -
// the signature of a gradually-rolled-out page template rather than a
// one-time breaking change. Ancestry's own corporate blog, fetched during
// this investigation, confirms person pages are currently in an active,
// partial rollout ("buttons have moved, new banners are popping up... a
// redesign is coming soon to the person profile page").
//
// extractNewPersonData() used to locate Ancestry's embedded JSON blob via
// an EXACT literal string match - `<script id="person-data"
// type="application/json">` - which breaks the instant that tag gains any
// other attribute (a CSP nonce is the most common real-world cause of
// exactly this kind of breakage on a page mid-redesign), gets its
// attributes reordered, or picks up a single extra space - none of which
// mean the block itself is actually gone. This couldn't be confirmed
// against a live, currently-affected Ancestry page (no login available in
// this environment, and the Geni discussion thread linked from the issue
// wasn't fetchable), so the exact current cause remains unconfirmed - but
// this hardens the one clearly brittle part of the detection regardless:
// it now selects by id via jQuery, tolerating any other attribute changes
// to the tag, the same pattern extractLegacyPersonData() already uses
// elsewhere in this file for exactly this reason.
//
// Uses the real extracted function (not a reimplementation), run against
// three real-shaped HTML fragments: the exact original format (must still
// work - a pure regression check), the same tag with an added nonce
// attribute (the fix), and a genuinely absent block (must still correctly
// fall back to legacy parsing, not silently break).
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
const $ = require(path.join(ROOT, 'jquery.js'));
global.$ = $;
function exists(v) { return typeof v !== 'undefined' && v !== null; }
global.exists = exists;

const extractNewPersonData = new Function('$', 'exists', 'resolveAncestryUrl', `
    ${extractFunction(src, 'extractNewPersonData')}
    return extractNewPersonData;
`)($, exists, function (u) { return u; });

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

// --- Regression: the exact original tag format must still work. ---
{
    var html = '<html><body><div id="wrapper"><p>Some other page content</p><script id="person-data" type="application/json">' + samplePersonDataJson() + '</script></div></body></html>';
    var result = extractNewPersonData(html);
    assertTrue(result !== null, "Regression: the original exact tag format is still found");
    assertEqual(result.name, "Jane Smith", "Regression: name parses correctly from the original tag format");
    assertEqual(result.family.Children.length, 1, "Regression: family data parses correctly from the original tag format");
}

// --- #335 fix: a CSP nonce (or any other extra attribute) on the same tag must not break detection. ---
{
    var html = '<html><body><div id="wrapper"><p>Some other page content</p><script id="person-data" type="application/json" nonce="aBc123XyZ==">' + samplePersonDataJson() + '</script></div></body></html>';
    var result = extractNewPersonData(html);
    assertTrue(result !== null, "#335: a script#person-data tag with an added CSP nonce attribute is still found");
    assertEqual(result.name, "Jane Smith", "#335: name still parses correctly with the nonce attribute present");
    assertEqual(result.family.Children.length, 1, "#335: family data still parses correctly with the nonce attribute present");
}

// --- #335 fix: reordered attributes must not break detection either. ---
{
    var html = '<html><body><div id="wrapper"><p>Some other page content</p><script type="application/json" id="person-data">' + samplePersonDataJson() + '</script></div></body></html>';
    var result = extractNewPersonData(html);
    assertTrue(result !== null, "#335: reordered attributes on the tag are still found (id-based selection, not a fixed attribute order)");
}

// --- Safety: a genuinely absent block must still correctly return null, allowing the legacy fallback to run. ---
{
    var html = '<html><body><div id="wrapper"><p>Some other page content</p><div>No person data here</div></div></body></html>';
    var result = extractNewPersonData(html);
    assertEqual(result, null, "Safety: a page with no #person-data block at all still correctly returns null (legacy fallback still runs)");
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
