// Parse Filae (https://www.filae.com/individualsheet?filaeDocId=<id>)
//
// Like MyHeritage's new page design (collections/myheritagenew.js), Filae's
// profile page is rendered entirely client-side by React - the server
// response is an empty <div id="root"></div>, confirmed via a raw fetch of
// the page (see issue #28). So this only works because SmartCopy reads the
// live tab DOM after React has rendered it (see getPageCode()'s
// parseProfileData branch), not a raw background fetch - and for the same
// reason, the recursive per-relative fetch in getFilaeFamily() below almost
// always comes back empty too.
//
// Filae is built with Material-UI; most of its CSS classes are compiled
// per-build hashes (e.g. "css-17hnfda") that are expected to change on
// Filae's next deploy - confirmed directly against a real page load, not
// assumed. Selectors here deliberately avoid those hashes wherever possible
// and anchor instead on: real <a href="...filaeDocId=..."> links, the
// semantic (non-hashed) "avatar" / "fs-sm" / "person-link" / "break-word"
// classes, and text-content matching against known English labels
// ("Birth", "Death", "Marriage", "Parents", "Brother or sister", "Spouse or
// child", ...). Built from real page/DOM samples gathered against a live
// account (issue #28), not iteratively tested against a running copy of
// this file - the family sidebar card parsing is the most solid part (real
// links, consistent structure); the Events-tab date/place sentence
// parsing and the "which cards belong to which spouse" grouping under
// "Spouse or child" are the most likely to need live-test correction.
//
// Filae's UI text was captured in English for the account this was
// researched against, even though the page itself declares
// <html lang="fr">. If Filae renders these same labels in French for a
// different account's language setting, the text-matching below (event
// labels, section headers) will need French variants added - not
// attempted here since that wasn't observed directly.
registerCollection({
    "reload": false,
    "recordtype": "Filae Genealogy",
    "prepareUrl": function(url) {
        return url;
    },
    "collectionMatch": function(url) {
        return startsWithHTTP(url, "https://www.filae.com/individualsheet");
    },
    "parseData": function(url) {
        focusURLid = extractFilaeProfileId(url);
        getPageCode();
    },
    "parseProfileData": parseFilae
});

function extractFilaeProfileId(url) {
    return getParameterByName('filaeDocId', url);
}

// Family card hrefs come straight from Filae's React Router links, which are
// relative ("/individualsheet?filaeDocId=..."), not absolute. That's fine
// for extractFilaeProfileId() (just reads the query string), but this same
// value is also carried through as the family member's "url" and used
// verbatim to build the Geni About-reference link for that person (see
// popup.js submitform()'s family-member reference path) - a relative path
// there produces a broken/non-clickable reference instead of a real link.
// Same fix as resolveAncestryUrl() in ancestrynew.js.
function resolveFilaeUrl(url) {
    if (exists(url) && url.startsWith("/")) {
        return "https://www.filae.com" + url;
    }
    return url;
}

// Gender is encoded as an avatar background color, not a semantic class or
// attribute - see annotateFilaeAvatars.js, which stamps the resolved color
// onto each ".avatar-content" element as data-smartcopy-avatar-color before
// this file ever sees the page. Confirmed against 8 live samples (4 male, 4
// female) spanning parent/sibling/child roles and two spouse-branches, with
// an exact, unvarying split - see issue #28.
var FILAE_MALE_RGB = [102, 204, 204];
var FILAE_FEMALE_RGB = [255, 136, 136];
// Both reference colors are ~150 apart per channel - a generous per-channel
// tolerance still safely rejects a genuinely different color rather than
// forcing everything into one of the two known buckets. Filae's data model
// may have a third "unknown gender" state neither confirmed sample covered
// (see issue #28) - this intentionally falls through to "unknown" for any
// color that isn't a close match to either reference, rather than assuming
// the binary is exhaustive.
var FILAE_GENDER_COLOR_TOLERANCE = 40;

function parseFilaeRgb(colorStr) {
    if (!exists(colorStr)) {
        return null;
    }
    var match = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!match) {
        return null;
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function classifyFilaeGenderColor(colorStr) {
    var rgb = parseFilaeRgb(colorStr);
    if (rgb === null) {
        return "unknown";
    }
    function channelDist(a, b) {
        return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
    }
    var maleDist = channelDist(rgb, FILAE_MALE_RGB);
    var femaleDist = channelDist(rgb, FILAE_FEMALE_RGB);
    if (maleDist <= FILAE_GENDER_COLOR_TOLERANCE && maleDist < femaleDist) {
        return "male";
    }
    if (femaleDist <= FILAE_GENDER_COLOR_TOLERANCE && femaleDist < maleDist) {
        return "female";
    }
    return "unknown";
}

// Avatar circle -> gender, for either the main profile header's avatar or a
// family sidebar card's avatar - both use the same avatar/avatar-content
// structure, just at different positions in the page.
function filaeAvatarGender(avatarContainer) {
    if (!avatarContainer || !avatarContainer.length) {
        return "unknown";
    }
    var color = avatarContainer.find(".avatar-content").attr("data-smartcopy-avatar-color");
    return classifyFilaeGenderColor(color);
}

// Sidebar section headers are matched by exact text content, not by class -
// Filae's own class names for these headers weren't captured in the
// samples this was built from.
var FILAE_SECTION_PARENTS = "parents";
var FILAE_SECTION_SIBLINGS = "brother or sister";
var FILAE_SECTION_SPOUSE_OR_CHILD = "spouse or child";

// Birth/death/marriage/etc. dates and places on Filae's Events tab are one
// free-text sentence per event, not separate fields, e.g.:
//   "The 21st of March 1845, Waibstadt, Baden-Württemberg, Germany"
//   "In August 1918, Jüdische Friedhöfe at Bergfriedhof Cemetery"
// This pulls the leading date phrase out and treats everything after the
// first comma as place. Ordinal suffixes (1st/2nd/3rd/4th...21st) and the
// "The"/"In" lead-in are both optional, since burial/marriage sentences
// seen in the samples don't always include an ordinal day.
function parseFilaeEventSentence(sentence) {
    var result = {};
    if (!exists(sentence) || sentence.trim() === "") {
        return result;
    }
    sentence = sentence.trim();
    var parts = sentence.split(",");
    var datePart = parts[0].trim();
    // Strip a leading "The"/"In" and an ordinal day ("21st of ") so what's
    // left is a plain "{Month} {Year}" or "{Day} {Month} {Year}" moment.js
    // can parse via cleanDate/getDateFormat, matching how every other
    // collection in this codebase hands dates off.
    datePart = datePart.replace(/^(The|In)\s+/i, "");
    datePart = datePart.replace(/^(\d+)(st|nd|rd|th)\s+of\s+/i, "$1 ");
    datePart = datePart.replace(/\s+of\s+/i, " ");
    var cleanedDate = cleanDate(datePart);
    if (cleanedDate !== "") {
        result.date = cleanedDate;
    }
    if (parts.length > 1) {
        var place = parts.slice(1).join(",").trim();
        if (place !== "") {
            result.place = place;
        }
    }
    return result;
}

function buildFilaeEventData(sentence) {
    var parsed = parseFilaeEventSentence(sentence);
    var data = [];
    if (exists(parsed.date)) {
        data.push({date: parsed.date});
    }
    if (exists(parsed.place)) {
        data.push({id: geoid, location: parsed.place});
        geoid++;
    }
    return data;
}

function parseFilae(htmlstring, familymembers, relation) {
    relation = relation || "";
    if (!exists(htmlstring)) {
        return "";
    }
    var parsed = $(htmlstring.replace(/<img/ig, "<gmi"));

    var profiledata = {};
    var aboutdata = "";
    var buriallcflag = false;
    var deathdtflag = false;

    // ---------------------- Name / header --------------------
    // The page has more than one "first non-empty paragraph" candidate
    // before the real profile header - a global account-menu avatar/name in
    // the site's own nav, and a compact name-only repeat in a "tree
    // breadcrumb bar" above the actual profile card (confirmed directly
    // against a live rendered page - see issue #28). An earlier version of
    // this file picked up the site's own "My alerts" notification text
    // instead of the profile name because of this.
    //
    // The life-dates line ("1845  - 1918 ", a bare year-range with no other
    // text) reliably identifies the real header instead: it's the first
    // such paragraph in document order, before any family sidebar card's
    // own year-range paragraph, and its immediately preceding sibling <p>
    // is the name paragraph, which nests any nickname as a
    // <span class="nickname"> rather than a separate paragraph.
    var focusperson = "";
    var focusBirthYearFromHeader, focusDeathYearFromHeader;
    var lifeDatesPara = parsed.find("p").filter(function () {
        return /^\d{4}\s*-\s*\d{0,4}\s*$/.test($(this).text().trim()) && !$(this).closest("a").length;
    }).first();
    var nameEl = lifeDatesPara.length ? lifeDatesPara.prev("p") : $();
    if (nameEl.length) {
        var yearMatch = lifeDatesPara.text().trim().match(/^(\d{4})\s*-\s*(\d{4})?/);
        if (yearMatch) {
            focusBirthYearFromHeader = yearMatch[1];
            focusDeathYearFromHeader = yearMatch[2];
        }
        var nickname = nameEl.find(".nickname").text().replace(/\s+/g, " ").trim();
        var nameClone = nameEl.clone();
        nameClone.find(".nickname").remove();
        focusperson = nameClone.text().replace(/\s+/g, " ").trim();
        if (nickname !== "") {
            // Wrapped in quotes so the existing NameParse-based pipeline
            // (already used by every other collection in this codebase)
            // picks it up as an alias/nickname the same way it would for a
            // source that embeds it in the raw name string directly.
            focusperson += ' "' + nickname + '"';
        }
    }
    if (focusperson === "") {
        // Fall back to whatever page <title> Filae sets, if the header
        // lookup above doesn't find anything on this particular page
        // layout - better than showing nothing, though this won't include
        // a nickname.
        focusperson = parsed.find("title").text().trim();
    }
    $("#readstatus").html(escapeHtml(focusperson));

    // The main profile avatar immediately precedes the name/dates wrapper
    // (nameEl's parent) in the header - see annotateFilaeAvatars.js for how
    // the color it reads here gets there.
    var genderval = nameEl.length ? filaeAvatarGender(nameEl.parent().prev()) : "unknown";
    if (genderval === "unknown" && relation !== "" && isPartner(relation.title)) {
        // Fallback for the rare case the avatar color didn't resolve
        // (e.g. annotation script didn't run) - opposite of the focus
        // person's own gender for a known spouse relation, same as every
        // other collection in this codebase does when a site doesn't
        // expose gender directly.
        genderval = reverseGender(focusgender);
    }
    if (relation === "") {
        focusgender = genderval;
    }

    // ---------------------- Events tab --------------------
    // Each event is a <li data-testid="TimelineEventItem"> - a real,
    // semantic (non-hash) attribute, confirmed against 5 byte-exact live
    // cards (see issue #28), used here instead of walking every
    // .break-word on the page and guessing at card boundaries (the
    // earlier version of this code did that and got it wrong).
    //
    // Only cards with an Edit control (data-testid="EditMenu") are this
    // person's own timeline entries - cards without one are read-only
    // cross-references to a relative's own event (e.g. "Death of his
    // mother X", "Birth of a child Y with Z" - that's Y's own birth, just
    // surfaced here for context, not this person's event). Confirmed
    // structurally, not inferred from label wording: "Marriage with X" DOES
    // have the edit control (it's this person's own marriage, the label
    // just names the spouse), while "Birth of a child X" does NOT (it's the
    // child's own birth). Label-text alone can't tell these apart reliably;
    // presence of the edit control can.
    var eventCards = parsed.find('li[data-testid="TimelineEventItem"]');
    for (var c = 0; c < eventCards.length; c++) {
        var card = $(eventCards[c]);
        if (card.find('[data-testid="EditMenu"]').length === 0) {
            continue;
        }
        var contentBreakWords = card.find('[data-testid="TimelineEventContent"] .break-word');
        if (contentBreakWords.length < 2) {
            continue;
        }
        // First .break-word is the event type label ("Birth", "Death",
        // "Marriage with <span>Name</span>") - matched by leading word
        // rather than exact text, since marriage/burial labels can carry
        // a trailing name.
        var labelText = $(contentBreakWords[0]).text().trim().toLowerCase();
        var matchedField = null;
        if (labelText === "birth") {
            matchedField = "birth";
        } else if (labelText === "death") {
            matchedField = "death";
        } else if (labelText.indexOf("burial") === 0) {
            matchedField = "burial";
        } else if (labelText.indexOf("baptism") === 0 || labelText.indexOf("christening") === 0) {
            matchedField = "baptism";
        } else if (labelText.indexOf("marriage") === 0) {
            matchedField = "marriage";
        }
        if (matchedField === null) {
            continue;
        }
        // Second .break-word is the date(+place) sentence for this event.
        var data = buildFilaeEventData($(contentBreakWords[1]).text());
        if ($.isEmptyObject(data)) {
            continue;
        }
        if (matchedField === "death") {
            if (exists(getDate(data))) {
                deathdtflag = true;
            }
            profiledata["death"] = data;
        } else if (matchedField === "burial") {
            if (exists(getLocation(data))) {
                buriallcflag = true;
            }
            profiledata["burial"] = data;
        } else if (!exists(profiledata[matchedField])) {
            // Birth/baptism/marriage: only take the first match - a
            // second marriage would otherwise overwrite the first.
            profiledata[matchedField] = data;
        }
    }

    // Fall back to the header's own "birth - death" year range for
    // whichever of these the Events tab didn't already provide - coarser
    // (year only, no place) but better than nothing.
    if (!exists(profiledata["birth"]) && exists(focusBirthYearFromHeader)) {
        profiledata["birth"] = [{date: focusBirthYearFromHeader}];
    }
    if (!exists(profiledata["death"]) && exists(focusDeathYearFromHeader)) {
        profiledata["death"] = [{date: focusDeathYearFromHeader}];
    }

    // ---------------------- Family sidebar cards --------------------
    // The cleanest, most parser-friendly part of the page: one repeated
    // card per relative, each a real <a href="...filaeDocId=...">
    // containing an .avatar-content (initials) and an .fs-sm block with
    // three stacked <p> tags: primary name, alt/nickname name, "birth -
    // death" years. Grouped under section headers matched by exact text
    // ("Parents" / "Brother or sister" / "Spouse or child") rather than by
    // class, since the header markup itself wasn't captured in the
    // samples this was built from.
    var familyLinks = [];
    var currentSection = null;
    parsed.find("*").each(function () {
        var el = $(this);
        // Section headers: plain text nodes, matched exactly (case-
        // insensitive) so this doesn't accidentally match inside an
        // unrelated paragraph that merely contains one of these phrases.
        if (el.children().length === 0) {
            var headingText = el.text().trim().toLowerCase();
            if (headingText === FILAE_SECTION_PARENTS) {
                currentSection = "parent";
                return;
            } else if (headingText === FILAE_SECTION_SIBLINGS) {
                currentSection = "sibling";
                return;
            } else if (headingText === FILAE_SECTION_SPOUSE_OR_CHILD) {
                currentSection = "spouse-or-child";
                return;
            }
        }
        // Family card: a real link to another profile, containing the
        // avatar/fs-sm structure - matched on the href pattern plus the
        // presence of .avatar, not on any hash class.
        var href = el.attr("href");
        if (!exists(href) || href.indexOf("filaeDocId=") === -1 || el.find(".avatar").length === 0) {
            return;
        }
        href = resolveFilaeUrl(href);
        if (currentSection === null) {
            return;
        }
        var nameParas = el.find(".fs-sm p");
        if (nameParas.length === 0) {
            return;
        }
        var cardName = $(nameParas[0]).text().trim();
        if (cardName === "") {
            return;
        }
        // Cards vary in paragraph count - name + years (2) when there's no
        // alt/nickname name, or name + alt-name + years (3) when there is.
        // Assuming years is always the 3rd paragraph (nameParas.length > 2)
        // missed anyone on a 2-paragraph card entirely - confirmed live
        // (Benno's mother has no alt-name shown, so her years were never
        // even attempted). Checking every paragraph after the name for a
        // year-range match, regardless of position, handles both cases.
        var cardYears = {};
        for (var np = 1; np < nameParas.length; np++) {
            var yearRangeMatch = $(nameParas[np]).text().trim().match(/^(\d{4})\s*-\s*(\d{4})?\s*$/);
            if (yearRangeMatch) {
                cardYears.birth = [{date: yearRangeMatch[1]}];
                if (exists(yearRangeMatch[2])) {
                    cardYears.death = [{date: yearRangeMatch[2]}];
                }
                break;
            }
        }
        var cardItemId = extractFilaeProfileId(href);
        var cardGender = filaeAvatarGender(el);
        if (currentSection === "parent") {
            familyLinks.push($.extend({title: "parent", name: cardName, url: href, itemId: cardItemId, gender: cardGender}, cardYears));
        } else if (currentSection === "sibling") {
            familyLinks.push($.extend({title: "sibling", name: cardName, url: href, itemId: cardItemId, gender: cardGender}, cardYears));
        } else if (currentSection === "spouse-or-child") {
            // Structural signal, confirmed against real markup for 3
            // spouses (1, 1, and 3 children respectively) - see issue #28.
            // Each spouse's card is a direct, unwrapped child of a
            // <div class=""> (empty class attribute); every child card in
            // that same group is instead wrapped in a
            // <div class="css-lm8b0f e117obkx0">. An earlier version of
            // this code just assumed "first card after the heading is the
            // spouse, everything else is that one spouse's children,"
            // which collapsed every spouse's children into the first
            // spouse's group - this checks each card's own immediate
            // parent instead, so a new spouse is correctly detected
            // wherever one actually starts.
            var isSpouseCard = (el.parent().attr("class") || "") === "";
            if (isSpouseCard) {
                familyLinks.push($.extend({title: "partner", name: cardName, url: href, itemId: cardItemId, gender: cardGender}, cardYears));
            } else {
                familyLinks.push($.extend({title: "child", name: cardName, url: href, itemId: cardItemId, gender: cardGender}, cardYears));
            }
        }
    });

    profiledata["name"] = focusperson;
    profiledata["status"] = relation.title;

    if (familymembers) {
        loadGeniData();
        var famid = 0;
        for (var k = 0; k < familyLinks.length; k++) {
            var rel = familyLinks[k];
            if (!exists(alldata["family"][rel.title])) {
                alldata["family"][rel.title] = [];
            }
            var subdata = {name: rel.name, title: rel.title, url: rel.url, itemId: rel.itemId, profile_id: famid, birth: rel.birth, death: rel.death, gender: rel.gender};
            if (isPartner(rel.title)) {
                myhspouse.push(famid);
            } else if (isParent(rel.title)) {
                parentlist.push(rel.itemId);
            }
            unionurls[famid] = rel.itemId;
            getFilaeFamily(famid, rel.url, subdata);
            famid++;
        }
    }

    profiledata["gender"] = genderval;

    if (aboutdata.trim() !== "") {
        profiledata["about"] = cleanHTML(aboutdata);
    }

    if (familymembers) {
        alldata["profile"] = profiledata;
        alldata["scorefactors"] = smscorefactors;
        updateGeo();
    }
    return profiledata;
}

function getFilaeFamily(famid, url, subdata) {
    familystatus.push(famid);
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url,
        variable: subdata
    }, function (response) {
        // familystatus.pop() must run no matter what happens above it -
        // updateGeo() polls familystatus.length and never moves past
        // "Reading Family Data..." if even one push here is never matched
        // by a pop. A relative/incomplete url (background.js's fetch
        // failing) or any other unexpected response leaves
        // response.source undefined, and parseFilae()'s first line calls
        // .replace() on it unconditionally - that throw used to happen
        // above the pop, hanging the whole import. try/finally guarantees
        // the pop happens regardless of whether parsing below succeeds.
        try {
            var arg = response.variable;
            // The recursive fetch almost always comes back empty (Filae's
            // page is entirely client-rendered, same as MyHeritage's new
            // design - see file header comment) - confirmed live: it isn't
            // a rare edge case here, it's the normal outcome. Dropping the
            // family member entirely when that happens (as an earlier
            // version of this function did, to fix a hang caused by an
            // unguarded .replace() on an undefined response) was wrong -
            // it silently threw away everyone whose recursive fetch didn't
            // pan out, which in practice was everyone. Falling back to a
            // person built from arg - the name/url/itemId/birth/death
            // already gathered from the sidebar card before this fetch
            // was even made - instead of dropping them.
            var person = exists(response.source) ? parseFilae(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId}) : "";
            if (person === "") {
                // url/itemId/profile_id specifically (not just
                // name/birth/death) - these are what
                // popup.js's "Add reference to Geni's About section"
                // logic reads via databyid[profile_id].url when building
                // each family member's own submission. Without them, the
                // reference silently has nothing to link to for anyone who
                // took this fallback path - confirmed live: Benno's own
                // reference worked (a different, focus-profile-specific
                // code path that doesn't depend on this), his wife's did
                // not.
                person = {name: arg.name, status: arg.title, url: arg.url, itemId: arg.itemId, profile_id: arg.profile_id};
            } else {
                person = updateInfoData(person, arg);
            }
            if (!exists(person.name) || person.name === "") {
                person.name = arg.name;
            }
            if (!exists(person.birth) && exists(arg.birth)) {
                person.birth = arg.birth;
            }
            if (!exists(person.death) && exists(arg.death)) {
                person.death = arg.death;
            }
            // arg.gender comes from this person's own sidebar-card avatar
            // color on the focus person's page (see the family-card loop
            // above) - a real per-person source, not a guess, so it's
            // preferred over whatever the (almost always empty) recursive
            // fetch determined.
            if ((!exists(person.gender) || person.gender === "unknown") && exists(arg.gender) && arg.gender !== "unknown") {
                person.gender = arg.gender;
            }
            databyid[arg.profile_id] = person;
            alldata["family"][arg.title].push(person);
        } finally {
            familystatus.pop();
        }
    });
}
