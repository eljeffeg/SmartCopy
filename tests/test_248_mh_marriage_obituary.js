// Verifies the remaining two real #248 reports (live-reported,
// DanCornett): a MyHeritage MARRIAGE record and an OBITUARY record, both
// of which used to produce empty/wrong family data. Loads the real
// extension files into a jsdom window exactly like popup.html does and
// calls the real parseSmartMatch() directly against Dan's real saved
// pages - not a reimplementation.
//
// 1. issue248_marriage_real.html - Joseph F. Tramuta & Rita Motta's 1944
//    NYC marriage record. Rita's Geni profile name is "Rita Motta
//    Tramuta" (her married name) but the record lists her under her
//    maiden name "Rita Motta" as the Bride. The fallback role-resolution
//    match compared NameParse's firstName/lastName split on BOTH sides -
//    NameParse splits "Rita Motta Tramuta" as firstName "Rita Motta" /
//    lastName "Tramuta" (not "Rita"/"Tramuta"), so it never matched the
//    record's own cleanly-split bride firstName "Rita", and neither
//    profiledata.name/birth nor her own parents (from the Bride: role's
//    nested sub-table) nor her husband ever got populated.
// 2. issue248_obituary_real.html - Diana Sambuchi's obituary. Relative
//    rows (Daughter/Son/Brother) nest that person's Name/Residence/
//    spouse into a sub-table under the row - the same shape marriage
//    records use for Groom:/Bride: - which neither the individualsList-
//    Container branch nor the plain comma-split branch recognized, so
//    every relative like this silently produced zero family members.
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
function exists(v) { return typeof v !== 'undefined' && v !== null; }

function runAgainst(htmlFile, focusUrl, genifocusdata) {
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

    window.loadGeniData = function () {};
    window.updateGeo = function () {};

    window.alldata = { family: {} };
    window.familystatus = [];
    window.captcha = false;
    window.tablink = focusUrl;
    window.smscorefactors = '';
    window.databyid = {};
    window.parentlist = [];
    window.myhspouse = [];
    window.unionurls = {};
    window.focusgender = 'unknown';
    window.mnameonoff = false;
    window.marriagedates = {};
    window.genifocusdata = genifocusdata;
    window.focusURLid = window.getMHURLId(focusUrl);

    const htmlSource = fs.readFileSync(htmlFile, 'utf8');
    window.parseSmartMatch(htmlSource, true, '');

    return { profile: window.alldata.profile, family: window.alldata.family };
}

// --- Case 1: marriage record, focus resolved to Rita (bride), Geni name is her MARRIED name ---
const marriageUrl = 'https://www.myheritage.com/research/record-20807-2088378-S/joseph-f-tramuta-and-rita-motta-born-charette-in-new-york-city-marriages';
const marriage = runAgainst(
    '' + FIXTURES + '/issue248_marriage_real.html',
    marriageUrl,
    { get: function (key) { return key === 'name' ? 'Rita Motta Tramuta' : ''; } }
);

assertEqual(marriage.profile.name, 'Rita Motta', "Marriage record: focus resolved to Rita specifically (not the combined 'Groom & Bride' page title), despite Geni's name parsing her maiden name as part of a 2-word firstName");
assertTrue(exists(marriage.profile.birth) && marriage.profile.birth[0].date === 'Dec 3 1916', "Rita's own birth date pulled from her Bride sub-table");
assertTrue(exists(marriage.family.husband) && marriage.family.husband[0].name === 'Joseph F. Tramuta', "Rita's husband (Joseph) populated under title 'husband'");
assertTrue(exists(marriage.family.father) && marriage.family.father[0].name === 'Emile Charette', "Rita's own father (from her Bride sub-table) populated - was empty before the fix");
assertTrue(exists(marriage.family.mother) && marriage.family.mother[0].name === 'Louise Levesque', "Rita's own mother populated");

// --- Case 2: obituary record - relative rows with nested Name/Residence/spouse sub-tables ---
const obitUrl = 'https://www.myheritage.com/research/record-12101-4544819-S/diana-sambuchi-in-united-states-obituary-index-from-online-sources';
const obituary = runAgainst(
    '' + FIXTURES + '/issue248_obituary_real.html',
    obitUrl,
    undefined
);

assertTrue(exists(obituary.family.husband) && obituary.family.husband[0].name === 'Ralph A. Sambuchi', "Obituary: plain-text husband still works (unchanged baseline)");
assertEqual(obituary.family.daughter.map(function (d) { return d.name; }), ['Toni Chartrand (born Sambuchi)', 'TerryAnn Croci', 'Stephny Halstead'], "All 3 daughters populated from their nested Name: sub-tables - was empty before the fix");
assertEqual(obituary.family.son.map(function (d) { return d.name; }), ['John Sambuchi', 'Daniel Sambuchi'], "Both sons populated");
assertEqual(obituary.family.brother.map(function (d) { return d.name; }), ['Frederick Horstkotte'], "Brother populated");
assertTrue(obituary.family.daughter.every(function (d) { return d.gender === 'female'; }), "Daughters' gender resolved from the relation title, not the (absent) sub-table gender field");
assertTrue(obituary.family.son.every(function (d) { return d.gender === 'male'; }), "Sons' gender resolved correctly");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
