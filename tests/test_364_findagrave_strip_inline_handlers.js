// Verifies #364 (live-reported, DanCornett): parsing a real FindAGrave
// page's raw HTML through jQuery ($(htmlstring)) logged a Content
// Security Policy violation in popup.html's own console - "Executing
// inline event handler violates... script-src 'self'". FindAGrave's real
// page markup carries at least one element with an inline on* handler
// (typical for ad/tracking/consent widgets); jQuery's HTML-string parsing
// builds real DOM nodes to use the browser's own parser, which is exactly
// what triggers Chrome to compile (and the extension's strict CSP to
// block) that handler. Harmless in practice - SmartCopy never executes or
// needs it - but noisy, and surfaced as a scary-looking error every time.
//
// stripInlineEventHandlers() (collections/findagrave.js) strips any on*
// attribute from the raw string BEFORE jQuery ever parses it, the same
// defensive-regex-on-raw-string approach this file already uses for
// <img> tags (to avoid triggering real image loads during parsing).
// Extracts the real function verbatim.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'collections/findagrave.js'), 'utf8');

function extractFunction(s, name) {
    const marker = 'function ' + name + '(';
    const start = s.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    let depth = 0, i = s.indexOf('{', start);
    for (; i < s.length; i++) {
        if (s[i] === '{') depth++;
        else if (s[i] === '}') { depth--; if (depth === 0) break; }
    }
    return s.slice(start, i + 1);
}

const stripInlineEventHandlers = new Function('return ' + extractFunction(src, 'stripInlineEventHandlers'))();

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

assertEqual(stripInlineEventHandlers('<div onclick="doStuff()">text</div>'), '<div>text</div>',
    "Strips a double-quoted onclick handler");
assertEqual(stripInlineEventHandlers("<gmi onerror='fallback()' src=\"x.jpg\">"), '<gmi src="x.jpg">',
    "Strips a single-quoted handler (e.g. an <img> tag already renamed to <gmi> by the existing image-stripping pass) without touching its real src attribute");
assertEqual(stripInlineEventHandlers('<body onload=init()>'), '<body>',
    "Strips an unquoted handler value");
assertEqual(stripInlineEventHandlers('<div ONCLICK="doStuff()">text</div>'), '<div>text</div>',
    "Case-insensitive - FindAGrave's own markup isn't guaranteed to use lowercase attribute names");
assertEqual(stripInlineEventHandlers('<a href="#" onclick="a()" onmouseover="b()">link</a>'), '<a href="#">link</a>',
    "Strips multiple different handler attributes on the same tag");

// --- Safety: don't strip real content that merely CONTAINS the letters "on" ---
assertEqual(stripInlineEventHandlers('<a href="https://example.com/onward" title="Turn on notifications">link</a>'),
    '<a href="https://example.com/onward" title="Turn on notifications">link</a>',
    "A URL containing \"onward\" and a title containing \"Turn on\" are both left untouched - neither is a standalone on* attribute");
assertEqual(stripInlineEventHandlers('<div data-onclick-id="5">text</div>'), '<div data-onclick-id="5">text</div>',
    "A real (non-event) attribute whose name merely ends in \"onclick\" (data-onclick-id) is left untouched - \"on\" isn't preceded by whitespace there");

// --- Wiring: confirm all three raw-HTML parse sites in this file actually call it ---
const callCount = (src.match(/stripInlineEventHandlers\(/g) || []).length;
assertEqual(callCount, 4, "stripInlineEventHandlers is called at all 3 real parse sites (loadPage, parseFindAGrave's first parse, parseFindAGrave's second <gmi> parse), plus its own function declaration - got " + callCount + " occurrences");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
