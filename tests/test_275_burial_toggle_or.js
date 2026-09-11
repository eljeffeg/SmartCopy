// Verifies #275: burial-date estimation fires when EITHER the master
// "Estimate birth/marriage/death/burial years" toggle OR the specific
// "Est. burial date from death if location" toggle is on (an OR),
// not requiring both together (the #263 fix's original AND, which
// DanCornett asked to loosen).
//
// #283 follow-up nested a stricter AND *inside* the burialonoffswitch-only
// branch (require an actual burial location when the master switch is
// off) - the top-level structure is still `masterSwitch || (burialSwitch
// && hasLocation)`, so the master switch's own OR-branch stays fully
// unrestricted, matching #275's original ask. Match across the (now
// multi-line) gate rather than requiring it on a single line.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

const gatePattern = /\$\('#estimatebirthyearsonoffswitch'\)\.prop\('checked'\) \|\|\s*\n\s*\(\$\('#burialonoffswitch'\)\.prop\('checked'\)/g;
const gateMatches = src.match(gatePattern) || [];

assertTrue(gateMatches.length === 2, "Found both burial-estimate gate call sites (focus profile + family member), got " + gateMatches.length);
assertTrue(src.indexOf("fillMissingDeathOrBurialDate(alldata[\"profile\"])") !== -1 &&
    src.indexOf("fillMissingDeathOrBurialDate(members[member])") !== -1,
    "Both call sites still invoke fillMissingDeathOrBurialDate() when their gate passes");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
