// Verifies #248 (live-reported, DanCornett/GuyKh): MyHeritage census
// records stopped populating spouse/child (and, on a differently-shaped
// record, parents/siblings) family members entirely. Two real, saved
// MyHeritage pages are used (reconstructed from Dan's actual attachments -
// one a real "Save Page As" DOM snapshot, one reconstructed from a Chrome
// "View Source" syntax-highlighted save):
//
// 1. issue248_rita_census_full.html - Dan's ORIGINAL report. Rita Motta's
//    1940 census page. Husband/Son rendered as bare
//    <span data-item-id="..."> text (no .individualsListContainer, no
//    <a> link at all) - the per-row family loop's famlist stayed empty and
//    nothing ever got added, even though the real people (with real,
//    fetchable URLs) are already sitting in the page's own Household
//    table.
// 2. issue248_census_real.html - a newer report (Barbara C Kenney's 1950
//    census). Same underlying bug PLUS a second, compounding one: an
//    extra scribe-ai widget + a second "Census details" table now sit
//    inside .recordFieldsContainer ahead of the real relatives table,
//    shifting it from children[2] (hardcoded) down to children[0] - so
//    the code was scanning the WRONG table's rows entirely.
//
// This test loads the REAL extension files (jquery/shared/popup/
// smartmatch/buildform/etc.) into a jsdom window exactly like popup.html
// does, and calls the real parseSmartMatch() directly - not a
// reimplementation - against both real pages, asserting on the real
// alldata["family"] result and the real chrome.runtime.sendMessage calls
// that would fetch each family member's own sub-page.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (JSON.stringify(actual) === JSON.stringify(expected)) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

function runAgainst(htmlFile, focusUrl) {
    const popupHtml = fs.readFileSync('' + ROOT + '/popup.html', 'utf8');
    const dom = new JSDOM(popupHtml, { runScripts: 'outside-only', url: 'https://example.com/popup.html' });
    const window = dom.window;

    const sentMessages = [];
    window.chrome = {
        runtime: {
            sendMessage: function (msg) { sentMessages.push(msg); },
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

    function loadScript(path) {
        window.eval(fs.readFileSync(path, 'utf8'));
    }
    loadScript('' + ROOT + '/jquery.js');
    loadScript('' + ROOT + '/locale_fallback_en.js');
    loadScript('' + ROOT + '/shared.js');
    loadScript('' + ROOT + '/popup.js');
    loadScript('' + ROOT + '/parse-location.js');
    loadScript('' + ROOT + '/parse-names.js');
    loadScript('' + ROOT + '/collections/smartmatch.js');
    loadScript('' + ROOT + '/moment.js');
    loadScript('' + ROOT + '/buildform.js');

    window.loadGeniData = function () {};
    window.updateGeo = function () {};
    window.NameParse = { parse: function () { return { suffix: '', birthName: '', lastName: '' }; } };

    window.alldata = { family: {} };
    window.familystatus = [];
    window.captcha = false;
    window.tablink = '';
    window.genifocusdata = undefined;
    window.smscorefactors = '';
    window.databyid = {};
    window.parentlist = [];
    window.myhspouse = [];
    window.unionurls = {};
    window.focusgender = 'unknown';
    window.focusURLid = window.getMHURLId(focusUrl);

    const htmlSource = fs.readFileSync(htmlFile, 'utf8');
    window.parseSmartMatch(htmlSource, true, '');

    return { family: window.alldata.family, sentMessages: sentMessages };
}

// --- Case 1: Dan's original report - Rita Motta, 1940 census ---
const ritaUrl = 'https://www.myheritage.com/research/record-10053-110232673-/rita-motta-in-1940-united-states-federal-census?indId=externalindividual-46f4a34aabf6701b049fd79d90743575&mrid=54a37f440c5a325c96c0b4a04558f9d0';
const rita = runAgainst('' + FIXTURES + '/issue248_rita_census_full.html', ritaUrl);

assertTrue(rita.sentMessages.length === 2,
    "Rita's census: exactly 2 family members (husband + son) queued for fetch - was 0 before the fix");
var ritaHusband = rita.sentMessages.filter(function (m) { return m.variable.title === 'husband'; })[0];
var ritaSon = rita.sentMessages.filter(function (m) { return m.variable.title === 'son'; })[0];
assertTrue(exists(ritaHusband), "Rita's husband (Manuel Motta) queued under title 'husband'");
assertEqual(ritaHusband && ritaHusband.variable.name, 'Manuel Motta', "Husband's name resolved from the Household table, not the bare span");
assertTrue(ritaHusband && ritaHusband.variable.url.indexOf('manuel-motta') !== -1, "Husband's URL is the real, fetchable household record URL");
assertTrue(exists(ritaSon), "Rita's son (Donald Motta) queued under title 'son'");
assertEqual(ritaSon && ritaSon.variable.name, 'Donald Motta', "Son's name resolved correctly");

function exists(v) { return typeof v !== 'undefined' && v !== null; }

// --- Case 2: newer report - Barbara C Kenney, 1950 census (extra scribe-ai/census-detail tables shift the index) ---
const barbaraUrl = 'https://www.myheritage.com/research/record-11006-162667510-/barbara-c-kenney-in-1950-united-states-federal-census?indId=externalindividual-7f7e5a9149e6a8a4cce704759380af75&mrid=cb66ae0a16ee9caa780d2e1ff0358804&tr_id=m_nwp5snrj64_pc8ktpjgq6';
const barbara = runAgainst('' + FIXTURES + '/issue248_census_real.html', barbaraUrl);

assertTrue(barbara.sentMessages.length === 3,
    "Barbara's census: exactly 3 family members (2 parents + 1 brother) queued - was 0 before the fix (children[2] pointed at the wrong table)");
var parents = barbara.sentMessages.filter(function (m) { return m.variable.title === 'parents'; });
var brother = barbara.sentMessages.filter(function (m) { return m.variable.title === 'brother'; })[0];
assertTrue(parents.length === 2, "Both parents (Charles + Ellen Kenney) queued under title 'parents'");
assertTrue(exists(brother), "Brother (Peter C Kenney) queued under title 'brother'");
assertEqual(brother && brother.variable.name, 'Peter C Kenney', "Brother's name resolved correctly");
assertEqual(brother && brother.variable.gender, 'male', "Brother's gender resolved from the relation title (isMale('brother'))");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
