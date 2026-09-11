// Verifies #290: the "Edit location" pencil modal's description line now
// reflects whichever geocoding source is actually active, instead of
// always naming Google even when FamilySearch is the only source enabled.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const bfSrc = fs.readFileSync('' + ROOT + '/buildform.js', 'utf8');
const htmlSrc = fs.readFileSync('' + ROOT + '/popup.html', 'utf8');
const en = JSON.parse(fs.readFileSync('' + ROOT + '/_locales/en/messages.json', 'utf8'));

let pass = 0, fail = 0;
function assertTrue(cond, label) {
    if (cond) { pass++; console.log('PASS:', label); }
    else { fail++; console.log('FAIL:', label); }
}

assertTrue(htmlSrc.indexOf('<span id="geoUpdateModalDescription" data-i18n="Update_location_resubmit_to_Google">') !== -1,
    "The description text is now a targetable span with a real i18n key as its default");
assertTrue(en.hasOwnProperty('Update_location_resubmit_to_Google'), "The Google-source key exists");
assertTrue(en.hasOwnProperty('Update_location_resubmit_to_FamilySearch'), "The FamilySearch-source key exists");
assertTrue(en['Update_location_resubmit_to_FamilySearch'].message.indexOf('FamilySearch') !== -1,
    "The FamilySearch variant actually names FamilySearch, not Google");

assertTrue(bfSrc.indexOf("$('#geoUpdateModalDescription').text($('#familysearchplacesonoffswitch').prop('checked') ?") !== -1,
    "The click handler swaps the description text based on which source is active");
assertTrue(bfSrc.indexOf('_("Update_location_resubmit_to_FamilySearch") : _("Update_location_resubmit_to_Google")') !== -1,
    "FamilySearch enabled shows the FamilySearch text, otherwise the Google text - both via the i18n lookup, not hardcoded strings");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
