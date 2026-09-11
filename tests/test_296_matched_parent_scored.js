// Verifies #296 (live-reported, DanCornett, with screenshot): a parent
// already confidently matched to an existing Geni person (both father
// AND mother already exist on Geni, so neither the empty-category nor
// empty-slot branches fire) still gets scored=true, so genuinely
// different field data (a birth name, an AKA, etc. that the source has
// and Geni doesn't) becomes eligible for pre-checking instead of being
// uniformly suppressed just because the overall match wasn't flagged by
// scorefactors.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', expected, 'got', actual); }
}

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

// --- Structural: the new branches exist with the right conditions ---
assertTrue(src.indexOf('} else if (members[member].gender === "male" && geniHas("father")) {\n                    scored = true;\n                } else if (members[member].gender === "female" && geniHas("mother")) {\n                    scored = true;\n                }') !== -1,
    "New scored=true branches exist for a confirmed male/female parent match, appended after the existing empty-slot checks");

// --- Behavioral: reconstruct the exact decision truth table using the
// real geniHas() function extracted from source, matching Dan's exact
// screenshot scenario (Geni already has BOTH father and mother). ---
const geniHasSrc = extractFunction(src, 'geniHas');
function exists(v) { return v !== undefined && v !== null; }
function makeGeniHas(genifamily, genifamilydata) {
    return new Function('exists', 'genifamily', 'genifamilydata', 'return ' + geniHasSrc)(exists, genifamily, genifamilydata);
}

function computeParentScored(scorefactorsContainsFather, scorefactorsContainsMother, memberGender, geniHasFather, geniHasMother) {
    var genifamilydata = {};
    if (geniHasFather) { genifamilydata['f'] = { get: function (k) { return k === 'relation' ? 'father' : undefined; } }; }
    if (geniHasMother) { genifamilydata['m'] = { get: function (k) { return k === 'relation' ? 'mother' : undefined; } }; }
    var geniHas = makeGeniHas(true, genifamilydata);
    var scorefactors = { contains: function (s) { return s === 'father' ? scorefactorsContainsFather : (s === 'mother' ? scorefactorsContainsMother : false); } };
    var member = { gender: memberGender };
    var scored = false;
    // Mirrors the real decision block verbatim.
    if (scorefactors.contains("father") && !geniHas("father") && member.gender !== "female") {
        scored = true;
    } else if (scorefactors.contains("mother") && !geniHas("mother") && member.gender !== "male") {
        scored = true;
    } else if (member.gender === "male" && geniHas("father")) {
        scored = true;
    } else if (member.gender === "female" && geniHas("mother")) {
        scored = true;
    }
    return scored;
}

// Dan's exact scenario: Geni already has both father and mother, source
// scorefactors doesn't flag "father" as a match factor for this record,
// member is male ("Louie William Silvis").
assertEqual(computeParentScored(false, false, "male", true, true), true,
    "#296: a male parent already matched to Geni's existing father now scores true, even with no scorefactor signal");
assertEqual(computeParentScored(false, false, "female", true, true), true,
    "#296: same for a female parent already matched to Geni's existing mother");

// Regression: the pre-existing branches still work exactly as before.
assertEqual(computeParentScored(true, false, "male", false, false), true,
    "Regression: scorefactor-flagged father with an empty slot still scores true");
assertEqual(computeParentScored(false, false, "male", false, true), false,
    "Regression: a male parent with no scorefactor signal and Geni's father slot still empty does NOT score true (nothing to confirm the match against)");
assertEqual(computeParentScored(false, false, "unknown", true, true), false,
    "An unknown-gender parent isn't assumed to match either existing slot - stays unscored rather than guessing");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
