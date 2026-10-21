// Verifies #324 (live-reported, DanCornett): viewing a Geni Tree "index"
// URL - https://www.geni.com/family-tree/index/<tree-node-id>?graph_node_id=
// profile-<id> - and trying to add the focus profile to SC History produced
// "Invalid Profile Id - Try Again". Stripping the "?..." query string
// worked around it.
//
// Root cause: getProfile() (shared.js) detects a "profile-" marker anywhere
// in the URL and then grabs everything after the URL's LAST "/" - correct
// when "profile-gNNNN" is its own path segment, but this URL has no "/"
// between the path and the query string at all, so it grabbed the
// unrelated tree-index number with the whole unparsed query string tacked
// onto it ("342767165550013942?graph_node_id=profile-6391249"), which
// never validates as numeric and falls through to "" (no profile
// detected). The real profile id Dan actually wanted is sitting in the
// graph_node_id query parameter the whole time, never even looked at.
//
// Fixed by checking for graph_node_id= explicitly, before any of the
// generic path-based handling runs, and using its value directly when
// present.
//
// Extracts the REAL getProfile() function verbatim (not a reimplementation).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');

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

// getProfile() references the global `tablink` in one fallback branch -
// not exercised by any case below (every URL here has a "profile-" marker
// of some kind), but declared so the function can be constructed without
// throwing on an unrelated ReferenceError.
function runGetProfile(url) {
    var fn = new Function('tablink', `
        ${extractFunction(src, 'getProfile')}
        return getProfile(tablink);
    `);
    return fn(url);
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- #324 (2026-10-20): Dan's exact URL ---
assertEqual(runGetProfile('https://www.geni.com/family-tree/index/342767165550013942?graph_node_id=profile-6391249'),
    '?profile=profile-6391249',
    "#324: a graph-node Tree index URL resolves to the profile id from graph_node_id=, not the unrelated tree-index path number");

// --- Regression: existing, already-working URL forms are unaffected ---
assertEqual(runGetProfile('https://www.geni.com/people/John-Smith/profile-g6000000012345678'),
    '?profile=profile-g6000000012345678',
    "Regression: an ordinary /people/.../profile-gNNNN URL still resolves exactly as before");
assertEqual(runGetProfile('https://www.geni.com/people/John-Smith/6000000002107278790?through=6000000010985379345'),
    '?profile=profile-g6000000002107278790',
    "Regression: the existing '?through=' handling (navigated-through form, this function's own documented example) still works, unaffected by the new graph_node_id check running first");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
