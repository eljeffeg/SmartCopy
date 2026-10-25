// Verifies #356 (live-reported, DanCornett): "The current 'Store' version
// lets Curators update locked values; the updates submitted to Geni also
// allow such updates. The only thing which the UI should prevent Curators
// from updating are Private (a.k.a. Living) profiles to which they have
// no access on Geni either... they should be able to update locked
// fields via SC. We'll get a lot of flack if that isn't the default."
//
// Root cause: focusFieldLocked()/getGeniFieldLocked() (buildform.js) have
// always folded two different concerns into one boolean (#78) - a real
// Geni-side field lock (locked_fields) and a missing update/update-basics
// permission (no access to this profile at all) - since both have the
// same practical consequence of disabling the field. But they aren't the
// same thing: Geni's own curators CAN override a locked field when
// submitting directly, so disabling it in SmartCopy's own UI regardless
// of curator status was stricter than Geni's real permission model - a
// genuine regression from the shipped store version's own behavior.
//
// Fixed by having accountinfo.curator (the logged-in user's own account
// flag, already fetched at login - see loadLogin(), popup.js) bypass
// ONLY the locked_fields check. The missing-permission check (no access
// to this profile at all - a Private/Living profile not shared with the
// user) still applies unconditionally, even for a curator, matching
// Dan's own explicit carve-out.
//
// Extracts the REAL focusFieldLocked()/getGeniFieldLocked() and the REAL
// GeniPerson class (shared.js) verbatim - not reimplementations.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const bfSrc = fs.readFileSync(path.join(ROOT, 'buildform.js'), 'utf8');
const sharedSrc = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');

function extractFunction(src, name) {
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

function exists(v) { return typeof v !== 'undefined' && v !== null; }
function checkNested(obj, ...keys) {
    for (const k of keys) {
        if (!obj || !obj.hasOwnProperty(k)) { return false; }
        obj = obj[k];
    }
    return true;
}
function geniPhoto() { return 'images/no_photo_u.gif'; }

const GeniPerson = new Function('exists', 'checkNested', 'geniPhoto', 'return ' + extractFunction(sharedSrc, 'GeniPerson'))(exists, checkNested, geniPhoto);

let pass = 0, fail = 0;
function assertEqual(actual, expected, label) {
    if (actual === expected) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label, '- expected', JSON.stringify(expected), 'got', JSON.stringify(actual)); }
}

// --- focusFieldLocked(): a genuinely locked field, full write access to the profile otherwise. ---
const lockedFocusPerson = new GeniPerson({
    id: 'focus1',
    actions: ['update', 'update-basics'],
    locked_fields: { occupation: true },
    names: {}
});

function callFocusFieldLocked(person, account, path, subpath) {
    const fn = new Function('exists', 'genifocusdata', 'accountinfo', 'return ' + extractFunction(bfSrc, 'focusFieldLocked'))(exists, person, account);
    return fn(path, subpath);
}
function callGetGeniFieldLocked(familydata, account, profile, value, subvalue) {
    const fn = new Function('exists', 'genifamilydata', 'accountinfo', 'return ' + extractFunction(bfSrc, 'getGeniFieldLocked'))(exists, familydata, account);
    return fn(profile, value, subvalue);
}

assertEqual(callFocusFieldLocked(lockedFocusPerson, { curator: false }, 'occupation'), true,
    "#356 safety: a non-curator still correctly sees a Geni-locked field as locked/disabled, same as before this fix");
assertEqual(callFocusFieldLocked(lockedFocusPerson, { curator: true }, 'occupation'), false,
    "#356: a curator is no longer blocked from a Geni-locked field that they otherwise have full write access to");

// --- focusFieldLocked(): curator status must NOT bypass a genuine access/permission problem. ---
const noAccessFocusPerson = new GeniPerson({
    id: 'focus2',
    actions: ['add-photo'], // no "update"/"update-basics" - no write access to this profile at all
    locked_fields: {},
    names: {}
});
assertEqual(callFocusFieldLocked(noAccessFocusPerson, { curator: true }, 'occupation'), true,
    "#356 safety (Dan's explicit carve-out): a curator with NO write access to this specific profile (e.g. a Private/Living profile not shared with them) still correctly stays locked, regardless of curator status");
assertEqual(callFocusFieldLocked(noAccessFocusPerson, { curator: false }, 'occupation'), true,
    "Safety: same no-access case for a non-curator - unaffected by this fix, as before");

// --- focusFieldLocked(): a field that was never locked in the first place is unaffected either way. ---
const unlockedFocusPerson = new GeniPerson({
    id: 'focus3',
    actions: ['update', 'update-basics'],
    locked_fields: {},
    names: {}
});
assertEqual(callFocusFieldLocked(unlockedFocusPerson, { curator: true }, 'occupation'), false,
    "Safety: an unlocked field with full access stays unlocked for a curator");
assertEqual(callFocusFieldLocked(unlockedFocusPerson, { curator: false }, 'occupation'), false,
    "Safety: an unlocked field with full access stays unlocked for a non-curator too");

// --- getGeniFieldLocked() (family members): same three cases, same curator override, same access carve-out. ---
const familydata = {
    lockedMember: new GeniPerson({ id: 'fam1', actions: ['update', 'update-basics'], locked_fields: { occupation: true }, names: {} }),
    noAccessMember: new GeniPerson({ id: 'fam2', actions: ['add-photo'], locked_fields: {}, names: {} })
};
assertEqual(callGetGeniFieldLocked(familydata, { curator: false }, 'lockedMember', 'occupation'), true,
    "#356: family member equivalent - a non-curator still sees a Geni-locked field as locked");
assertEqual(callGetGeniFieldLocked(familydata, { curator: true }, 'lockedMember', 'occupation'), false,
    "#356: family member equivalent - a curator can now override a Geni-locked field on a family member they otherwise have write access to");
assertEqual(callGetGeniFieldLocked(familydata, { curator: true }, 'noAccessMember', 'occupation'), true,
    "#356 safety: family member equivalent of Dan's carve-out - no write access to this specific family member stays locked even for a curator");

// --- getGeniFieldLocked(): a brand-new "Add" candidate is never locked, curator or not (no Geni data to lock at all) - unaffected by this fix. ---
assertEqual(callGetGeniFieldLocked(familydata, { curator: true }, 'add', 'occupation'), false,
    "Safety: a brand-new 'Add' candidate (not yet matched to any existing Geni person) is never locked, same as before this fix");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
