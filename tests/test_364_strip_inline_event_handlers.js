// Verifies #364 (live-reported, DanCornett): parsing a source page's raw
// HTML through jQuery logged a Content Security Policy violation in
// popup.html's own console - "Executing inline event handler violates...
// script-src 'self'". A real source page's markup regularly carries at
// least one element with an inline on* handler (typical for ad/tracking/
// consent widgets); jQuery's HTML-string parsing builds real DOM nodes to
// use the browser's own parser, which is exactly what triggers Chrome to
// compile (and the extension's strict CSP to block) that handler.
// Harmless in practice - nothing here ever executes or needs it - but
// noisy, and surfaced as a scary-looking error every time.
//
// First reported against collections/findagrave.js alone (v4.17.3.95) -
// Dan's follow-up showed it ALSO happens from popup.js's own
// loadSelectPage() (a full stack trace pointed straight at its
// $('<div>').html(request.source...) call, well before the first fix
// even runs), confirming this needed a function more than one file could
// share, not a findagrave.js-only patch. stripInlineEventHandlers() now
// lives in shared.js for exactly that reason. Extracts the real function
// verbatim.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const sharedSrc = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
const fagSrc = fs.readFileSync(path.join(ROOT, 'collections/findagrave.js'), 'utf8');
const popupSrc = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

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

const stripInlineEventHandlers = new Function('return ' + extractFunction(sharedSrc, 'stripInlineEventHandlers'))();

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

assertEqual(stripInlineEventHandlers('<div onclick="doStuff()">text</div>'), '<div>text</div>',
    "Strips a double-quoted onclick handler");
assertEqual(stripInlineEventHandlers("<gmi onerror='fallback()' src=\"x.jpg\">"), '<gmi src="x.jpg">',
    "Strips a single-quoted handler (e.g. an <img> tag already renamed to <gmi> by findagrave.js's own existing image-stripping pass) without touching its real src attribute");
assertEqual(stripInlineEventHandlers('<body onload=init()>'), '<body>',
    "Strips an unquoted handler value");
assertEqual(stripInlineEventHandlers('<div ONCLICK="doStuff()">text</div>'), '<div>text</div>',
    "Case-insensitive - a source page's own markup isn't guaranteed to use lowercase attribute names");
assertEqual(stripInlineEventHandlers('<a href="#" onclick="a()" onmouseover="b()">link</a>'), '<a href="#">link</a>',
    "Strips multiple different handler attributes on the same tag");

// --- Safety: don't strip real content that merely CONTAINS the letters "on" ---
assertEqual(stripInlineEventHandlers('<a href="https://example.com/onward" title="Turn on notifications">link</a>'),
    '<a href="https://example.com/onward" title="Turn on notifications">link</a>',
    "A URL containing \"onward\" and a title containing \"Turn on\" are both left untouched - neither is a standalone on* attribute");
assertEqual(stripInlineEventHandlers('<div data-onclick-id="5">text</div>'), '<div data-onclick-id="5">text</div>',
    "A real (non-event) attribute whose name merely ends in \"onclick\" (data-onclick-id) is left untouched - \"on\" isn't preceded by whitespace there");

// --- Wiring: every real raw-HTML-to-jQuery parse site calls it ---
const fagCallCount = (fagSrc.match(/stripInlineEventHandlers\(/g) || []).length;
assertEqual(fagCallCount, 3, "collections/findagrave.js calls it at all 3 of its own raw-HTML parse sites (loadPage, parseFindAGrave's first parse, parseFindAGrave's second <gmi> parse) - got " + fagCallCount + " occurrences");
assertEqual(fagSrc.indexOf('function stripInlineEventHandlers'), -1,
    "findagrave.js no longer defines its own copy - it's shared.js's now, so there's exactly one implementation to keep correct");

assertEqual((popupSrc.match(/var parsed = \$\('<div>'\)\.html\(exists\(request\.source\) \? stripInlineEventHandlers\(request\.source\.replace/g) || []).length, 1,
    "popup.js's loadSelectPage() - the actual call site in Dan's full stack trace (popup.js:1172, well before findagrave.js's own parsing ever runs) - also calls it");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
