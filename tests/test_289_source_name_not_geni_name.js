// Verifies #289 (live-reported, DanCornett): the SC panel header should
// show the SOURCE page's own name for the focus person, not Geni's name
// pulled from the "In my Geni tree" sidebar widget. smartmatch.js's
// loadPage() used to overwrite focusname with
// .individualInformationName (Geni's own name) whenever the sidebar
// widget existed at all - correct for the specific case it was built
// for (a marriage record's title naming BOTH people), wrong for an
// ordinary single-person record where .recordTitle already correctly
// names just that one person. Fixed by scoping the override to
// isAmbiguousFocusPage() - the same "does this record's title name
// multiple people" signal already used elsewhere in this file. Loads
// the real extension files into a jsdom window and calls the real
// collection.loadPage() directly - not a reimplementation.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');

function buildEnv() {
    const popupHtml = fs.readFileSync('' + ROOT + '/popup.html', 'utf8');
    const dom = new JSDOM(popupHtml, { runScripts: 'outside-only', url: 'https://example.com/popup.html' });
    const window = dom.window;

    window.chrome = {
        runtime: {
            sendMessage: function () {},
            onMessage: { addListener: function () {} },
            onInstalled: { addListener: function () {} },
            onStartup: { addListener: function () {} },
            getURL: function (p) { return p; }
        },
        storage: { local: { get: function (k, cb) { if (cb) cb({}); }, set: function (o, cb) { if (cb) cb(); } } },
        tabs: {
            query: function (q, cb) { if (cb) cb([]); },
            get: function (id, cb) { if (cb) cb(undefined); },
            onActivated: { addListener: function () {} },
            onUpdated: { addListener: function () {} }
        },
        action: { setIcon: function () {}, setBadgeText: function () {} }
    };

    function loadScript(path) { window.eval(fs.readFileSync(path, 'utf8')); }
    loadScript('' + ROOT + '/jquery.js');
    loadScript('' + ROOT + '/locale_fallback_en.js');
    loadScript('' + ROOT + '/shared.js');
    loadScript('' + ROOT + '/popup.js');
    loadScript('' + ROOT + '/parse-location.js');
    loadScript('' + ROOT + '/parse-names.js');
    loadScript('' + ROOT + '/collections/smartmatch.js');
    loadScript('' + ROOT + '/moment.js');
    loadScript('' + ROOT + '/buildform.js');

    window.updateLinks = function () {};
    window.buildhistory = [];
    window.profilechanged = false;
    window.focusid = undefined;
    window.tablink = '';

    return window;
}

function sidebarHtml(individualName, geniProfileId) {
    return '<div class="value_add_score_factors_container">SmartMatch</div>' +
        '<a class="individualInformationProfileLink" href="https://www.geni.com/' + geniProfileId + '"></a>' +
        '<div class="individualInformationName">' + individualName + '</div>';
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- Case 1: ordinary single-person record (a census entry) - source name must win ---
const window1 = buildEnv();
window1.focusid = undefined;
const individualHtml = '<html><head><title>Barbara C Kenney - 1950 United States Federal Census - MyHeritage</title></head><body>' +
    '<div class="recordTitle">Barbara C Kenney</div>' +
    sidebarHtml('Barbara Kenney (Geni)', 'people/Barbara-Kenney/6000000000000000001') +
    '</body></html>';
// The synthetic focusid resolved here is never a real Geni id known to
// popup.js's own global loadPage()/collection state - that call throws
// past the point focusname is already set, same as it would for any
// unmocked downstream step this test doesn't care about.
try { window1.collections[0].loadPage({ source: individualHtml }); } catch (e) { /* expected past this point */ }
assertEqual(window1.focusname, 'Barbara C Kenney',
    "Ordinary single-person record: focusname stays the SOURCE page's own name, not Geni's sidebar name (the #289 bug)");

// --- Case 2: marriage record - title names BOTH people, sidebar override still correctly applies ---
const window2 = buildEnv();
window2.focusid = undefined;
const marriageHtml = '<html><head><title>Joseph F. Tramuta and Rita Motta in New York City Marriages - MyHeritage</title></head><body>' +
    '<div class="recordTitle">Joseph F. Tramuta &amp; Rita Motta (born Charette)</div>' +
    sidebarHtml('Rita Motta Tramuta', 'people/Rita-Motta-Tramuta/6000000227475181826') +
    '</body></html>';
try { window2.collections[0].loadPage({ source: marriageHtml }); } catch (e) { /* expected past this point */ }
assertEqual(window2.focusname, 'Rita Motta Tramuta',
    "Marriage record (title names both people): sidebar's specific matched name is still correctly used, unchanged baseline behavior for the case #35 was built for");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
