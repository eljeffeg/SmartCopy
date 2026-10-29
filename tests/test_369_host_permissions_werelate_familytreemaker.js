// Verifies #369 (found during a full pre-release code review): two
// collection parsers make background chrome.runtime.sendMessage/xhttp
// fetches to their own source site's domain to pull in additional family
// members, but neither domain was declared in manifest.json's
// host_permissions - the exact class of bug CLAUDE.md's own MV3
// guardrails section already documents from #202 ("Host permissions are
// required for background fetches to a domain, separately from that
// domain appearing in a content script's matches"). Without the
// permission, the background fetch is silently blocked - no error shown
// anywhere, family members for that source just never populate.
//
// collections/werelate.js's own collectionMatch() only ever recognizes
// www.werelate.org; collections/familytreemaker.js's recognizes both
// familytreemaker.genealogy.com and www.genealogy.com - both covered by
// a single *://*.genealogy.com/ wildcard entry.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const hostPermissions = manifest.host_permissions;

assertTrue(Array.isArray(hostPermissions) && hostPermissions.length > 0,
    "manifest.json has a real, non-empty host_permissions array");

// Chrome's "*.domain" match-pattern prefix matches the bare domain AND
// any subdomain - a wildcard entry alone is sufficient, but this project's
// own existing list consistently pairs each wildcard entry with an
// explicit bare-domain entry too (see geni.com/filae.com/toldot.ru/etc.),
// so both are checked here to match that established convention.
function hasWildcardAndBareEntry(domain) {
    var wildcard = '*://*.' + domain + '/';
    var bare = '*://' + domain + '/';
    return hostPermissions.indexOf(wildcard) !== -1 && hostPermissions.indexOf(bare) !== -1;
}

assertTrue(hasWildcardAndBareEntry('werelate.org'),
    "#369: werelate.org has both a wildcard and bare host_permissions entry, matching this project's existing per-site convention - collections/werelate.js's background family-member fetch can now actually run");
assertTrue(hasWildcardAndBareEntry('genealogy.com'),
    "#369: genealogy.com has both a wildcard and bare host_permissions entry - covers both familytreemaker.genealogy.com and www.genealogy.com, the two domains collections/familytreemaker.js's own collectionMatch() recognizes");

// Regression: every pre-existing entry this project already relied on is still present, untouched.
["geni.com", "findagrave.com", "familysearch.org", "wikitree.com", "billiongraves.com",
    "ancestry.com", "myheritage.com", "filae.com", "gravez.me", "toldot.ru", "yadvashem.org",
    "geneanet.org", "bezikaron.co.il", "online-ofb.de"].forEach(function (domain) {
    assertTrue(hostPermissions.some(function (p) { return p.indexOf(domain) !== -1; }),
        "Regression: the existing " + domain + " entry is still present, unaffected by this addition");
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
