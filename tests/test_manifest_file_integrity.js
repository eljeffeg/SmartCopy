// manifest.json integrity check - not tied to any one issue. Confirms
// every file manifest.json itself references actually exists on disk and
// that manifest.json is well-formed JSON - the class of mistake that's
// easy to make (a typo'd filename, a forgotten rename, a dangling
// reference left behind after deleting a file) and easy to miss by eye,
// since manifest.json is rarely read top-to-bottom. The project's own
// build-release-zip.js script already spot-checks SOME of this
// informally via `unzip -l` after building - this makes the check
// explicit, automated, and exhaustive rather than an ad hoc spot-check.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

let manifest;
try {
    manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
    pass++;
    console.log('PASS:', 'manifest.json parses as valid JSON');
} catch (e) {
    fail++;
    console.log('FAIL:', 'manifest.json does not parse as valid JSON: ' + e.message);
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(1);
}

function assertFileExists(relPath, label) {
    const exists = fs.existsSync(path.join(ROOT, relPath));
    assertTrue(exists, label + ' ("' + relPath + '" exists on disk)');
}

// A glob with a single trailing "*" segment (the only kind manifest.json
// actually uses here, web_accessible_resources' "images/content_*.png") -
// checks that at least one real file in that directory matches, rather
// than requiring an exact literal match.
function assertGlobMatchesSomething(globPath, label) {
    const dir = path.dirname(globPath);
    const filePattern = path.basename(globPath);
    const regex = new RegExp('^' + filePattern.split('*').map(function (s) {
        return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }).join('.*') + '$');
    let matched = false;
    try {
        matched = fs.readdirSync(path.join(ROOT, dir)).some(function (f) { return regex.test(f); });
    } catch (e) {
        matched = false;
    }
    assertTrue(matched, label + ' (glob "' + globPath + '" matches at least one real file)');
}

// --- icons ---
assertTrue(!!manifest.icons && Object.keys(manifest.icons).length > 0, "manifest.json declares at least one icon");
Object.keys(manifest.icons || {}).forEach(function (size) {
    assertFileExists(manifest.icons[size], "icons[\"" + size + "\"]");
});

// --- background ---
assertTrue(!!manifest.background, "manifest.json declares a background section");
if (manifest.background) {
    assertFileExists(manifest.background.service_worker, "background.service_worker");
    (manifest.background.scripts || []).forEach(function (f, i) {
        assertFileExists(f, "background.scripts[" + i + "]");
    });
}

// --- action ---
assertTrue(!!manifest.action, "manifest.json declares an action section");
if (manifest.action) {
    assertFileExists(manifest.action.default_icon, "action.default_icon");
    assertFileExists(manifest.action.default_popup, "action.default_popup");
}

// --- web_accessible_resources ---
(manifest.web_accessible_resources || []).forEach(function (entry, i) {
    (entry.resources || []).forEach(function (r) {
        if (r.indexOf('*') !== -1) {
            assertGlobMatchesSomething(r, "web_accessible_resources[" + i + "].resources");
        } else {
            assertFileExists(r, "web_accessible_resources[" + i + "].resources");
        }
    });
    assertTrue(Array.isArray(entry.matches) && entry.matches.length > 0,
        "web_accessible_resources[" + i + "] declares at least one match pattern");
});

// --- content_scripts ---
assertTrue(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0,
    "manifest.json declares at least one content script block");
(manifest.content_scripts || []).forEach(function (entry, i) {
    (entry.js || []).forEach(function (f, j) {
        assertFileExists(f, "content_scripts[" + i + "].js[" + j + "]");
    });
    assertTrue(Array.isArray(entry.matches) && entry.matches.length > 0,
        "content_scripts[" + i + "] declares at least one match pattern");
});

// --- sandbox ---
if (manifest.sandbox) {
    (manifest.sandbox.pages || []).forEach(function (f, i) {
        assertFileExists(f, "sandbox.pages[" + i + "]");
    });
}

// --- host_permissions: well-formed match patterns, not file paths, but still worth a sanity shape check ---
const MATCH_PATTERN = /^(\*|https?|wss?):\/\/(\*|(\*\.)?[^/*]+)\/.*$/;
(manifest.host_permissions || []).forEach(function (p, i) {
    assertTrue(MATCH_PATTERN.test(p), "host_permissions[" + i + "] (\"" + p + "\") is a well-formed match pattern");
});

// --- version field sanity ---
assertTrue(typeof manifest.version === 'string' && /^\d+(\.\d+){1,3}$/.test(manifest.version),
    "manifest.json's version (\"" + manifest.version + "\") is a plain dotted-number string, matching Chrome's own requirement");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
