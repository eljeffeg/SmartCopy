// Live-reported, Dan Bodenheimer: a family with several members came back
// with multiple of them falling back to blank/slug-only data at once (no
// maiden name, no dates, no gender) - person.name came back blank, so
// updateInfoData() fell back to the crude URL-slug guess, for more than
// one family member in the same import. getFindAGraveFamily() fires a
// fetch per family member in a tight loop with zero spacing between
// them - a burst of fully concurrent requests to findagrave.com, not a
// throttled batch - and findagrave.com was independently confirmed (live,
// via a browser view-source attempt) to be actively serving a Cloudflare
// bot-challenge page for at least some requests. Same defensive stagger
// #309 already uses for Geni's own API (scheduleGeniSend, popup.js) -
// cheap for a single request, unobtrusive for a real batch. Extracts the
// real scheduleFindAGraveSend() verbatim.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'collections/findagrave.js'), 'utf8');

function extractFunction(name) {
    const marker = 'function ' + name + '(';
    const start = src.indexOf(marker);
    if (start === -1) throw new Error('not found: ' + name);
    let depth = 0, i = src.indexOf('{', start);
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(start, i + 1);
}

function extractVar(name) {
    const marker = 'var ' + name + ' = ';
    const start = src.indexOf(marker);
    if (start === -1) throw new Error('not found: var ' + name);
    const end = src.indexOf(';', start);
    return src.slice(start, end + 1);
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) { assertEqual(!!cond, true, label); }

function freshScheduler(fakeNow) {
    let scheduledDelays = [];
    const fakeSetTimeout = function (fn, delay) { scheduledDelays.push(delay); fn(); };
    const fn = new Function(
        'Date', 'setTimeout',
        extractVar('lastFindAGraveSendTime') + '\n' +
        extractVar('FINDAGRAVE_SEND_MIN_SPACING_MS') + '\n' +
        extractFunction('scheduleFindAGraveSend') + '\n' +
        'return { scheduleFindAGraveSend: scheduleFindAGraveSend, getLastSendTime: function () { return lastFindAGraveSendTime; } };'
    )({ now: fakeNow.next }, fakeSetTimeout);
    return { scheduleFindAGraveSend: fn.scheduleFindAGraveSend, getLastSendTime: fn.getLastSendTime, scheduledDelays: scheduledDelays };
}

// --- A burst of calls fired with zero real spacing still gets staggered ---
// Measured via the scheduler's own notion of "when was the last call
// effectively scheduled to fire" (getLastSendTime), not by intercepting
// setTimeout - the real code calls sendFn() directly (no setTimeout at
// all) whenever delay is 0, so a mock that only records setTimeout calls
// would silently miss that case entirely.
(function () {
    let fakeTime = 1000;
    const fakeNow = { next: function () { return fakeTime; } };
    const ctx = freshScheduler(fakeNow);
    let callOrder = [];
    for (let i = 0; i < 4; i++) {
        ctx.scheduleFindAGraveSend(function () { callOrder.push(i); });
    }
    assertEqual(callOrder.length, 4, "scheduleFindAGraveSend(): all 4 calls in the burst still eventually fire (nothing gets dropped)");
    assertEqual(callOrder.join(','), '0,1,2,3', "scheduleFindAGraveSend(): calls still fire in the order they were scheduled");
    assertTrue(ctx.getLastSendTime() > fakeTime,
        "scheduleFindAGraveSend(): after a 4-call burst with zero real time passing, the last call's effective schedule time is pushed meaningfully into the future - this is what actually spreads the requests out instead of firing them all at once");
    assertEqual(ctx.getLastSendTime(), fakeTime + 3 * 400,
        "scheduleFindAGraveSend(): the stagger is exactly 3 spacing intervals past the first call for a 4-call burst (1st immediate, then one minimum-spacing interval added per subsequent call)");
})();

// --- The very first call in a fresh scheduler fires with no artificial delay ---
(function () {
    let fakeTime = 1500;
    const fakeNow = { next: function () { return fakeTime; } };
    const ctx = freshScheduler(fakeNow);
    let fired = false;
    ctx.scheduleFindAGraveSend(function () { fired = true; });
    assertTrue(fired, "scheduleFindAGraveSend(): the very first call on a fresh scheduler fires synchronously, not deferred");
    assertEqual(ctx.getLastSendTime(), fakeTime, "scheduleFindAGraveSend(): the first call gets no artificial delay at all");
})();

// --- Calls that are already naturally spaced out (e.g. slow network) don't get an unnecessary extra delay ---
(function () {
    let fakeTime = 2000;
    const fakeNow = { next: function () { return fakeTime; } };
    const ctx = freshScheduler(fakeNow);
    ctx.scheduleFindAGraveSend(function () {});
    fakeTime += 1000; // plenty of real time has passed since the last call
    let fired = false;
    ctx.scheduleFindAGraveSend(function () { fired = true; });
    assertTrue(fired, "scheduleFindAGraveSend(): a naturally-spaced-out call still fires synchronously");
    assertEqual(ctx.getLastSendTime(), fakeTime,
        "scheduleFindAGraveSend(): a call that's already naturally spaced out past the minimum doesn't get an unnecessary extra delay tacked on");
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
