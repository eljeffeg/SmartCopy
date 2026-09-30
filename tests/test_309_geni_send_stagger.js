// Verifies #309 (live-reported, DanCornett): adding several family members
// at once (e.g. a batch of siblings) occasionally produced a spurious/
// ambiguous error even though the data had genuinely already gone through.
// Dan's own question - "what about the batch size of API calls?" - turned
// out to be right: buildTree()'s callers fire every member's request in a
// tight, synchronous loop with zero spacing between them, a fully
// concurrent burst rather than anything throttled. scheduleGeniSend() adds
// a minimum spacing between consecutive dispatches as a cheap defensive
// measure - this doesn't claim to fix a specific confirmed root cause
// (that lives on Geni's side), just reduces how concurrent the burst is.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

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
function extractVarStatement(srcText, name) {
    const marker = 'var ' + name + ' =';
    const start = srcText.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    const semi = srcText.indexOf(';', start);
    return srcText.slice(start, semi + 1);
}

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- Structural: both real dispatch sites inside buildTree() route through scheduleGeniSend() ---
const buildTreeSrc = extractFunction(src, 'buildTree');
assertEqual((buildTreeSrc.match(/scheduleGeniSend\(function \(\) \{/g) || []).length, 2,
    "buildTree() wraps both its chrome.runtime.sendMessage() dispatch sites (the normal field-update path and the add-photo path) in scheduleGeniSend()");
assertTrue(/submitstatus\.pop\(\);\s*\n\s*\}\s*\n\s*\} else if \(!\$\.isEmptyObject\(data\) && exists\(sendid\) && devblocksend\)/.test(buildTreeSrc),
    "#309: the add-photo branch's submitstatus.pop() stays OUTSIDE/after scheduleGeniSend()'s delay - unaffected by the stagger, matching its pre-existing synchronous timing");

// --- Behavioral: real scheduleGeniSend(), a burst of calls spreads out at the configured minimum spacing ---
const spacingSrc = extractVarStatement(src, 'GENI_SEND_MIN_SPACING_MS');
const lastSendSrc = extractVarStatement(src, 'lastGeniSendTime');
const scheduleGeniSendSrc = extractFunction(src, 'scheduleGeniSend');

let fakeNow = 1000000;
let scheduledDelays = [];
const ctx = new Function('setTimeout', 'Date',
    lastSendSrc + '\n' + spacingSrc + '\n' + scheduleGeniSendSrc + '\nreturn scheduleGeniSend;'
)(
    function (fn, delay) { scheduledDelays.push(delay); fn(); },
    { now: function () { return fakeNow; } }
);

// A single, isolated call fires immediately (delay 0) - a lone submission is never held back.
scheduledDelays = [];
ctx(function () {});
assertEqual(scheduledDelays.length, 0, "A single isolated call fires immediately, with no setTimeout at all");

// A tight burst (5 calls, no time passing between them - matching the real
// unthrottled loop) gets staggered at the configured minimum spacing.
scheduledDelays = [];
fakeNow = 2000000;
for (let i = 0; i < 5; i++) {
    ctx(function () {});
}
assertEqual(scheduledDelays.length, 4, "First call in a burst fires immediately (no setTimeout); the other 4 get staggered");
assertTrue(scheduledDelays.every(function (d) { return d > 0; }), "Every staggered call gets a real, positive delay");
const spacing = Number(spacingSrc.match(/=\s*(\d+)/)[1]);
for (let i = 0; i < scheduledDelays.length; i++) {
    assertEqual(scheduledDelays[i], spacing * (i + 1), "Call " + (i + 2) + " in the burst is delayed by exactly " + (i + 1) + "x the minimum spacing");
}

// Once real time has already passed the minimum spacing, a later call
// doesn't get artificially held back further.
scheduledDelays = [];
fakeNow = 2000000 + spacing * 10;
ctx(function () {});
assertEqual(scheduledDelays.length, 0, "A call arriving well after the previous burst has already cleared fires immediately, not delayed by stale state");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
