// Parse MyHeritage (new "profile-<site>-<id>" page design)
//
// MyHeritage rolled out a redesigned profile page using a different URL
// shape (https://www.myheritage.com/profile-<site>-<id>/<slug>) and a
// React-rendered layout with different CSS classes throughout. This is
// registered as a *separate* collection from collections/myheritage.js
// (which continues to handle the older "person-"/"member-"/
// "site-family-tree-" URL shapes) rather than modified in place, so the
// still-working legacy path is untouched and this can be iterated on
// independently.
//
// The new page's profile content (#profile-page-root) is rendered entirely
// client-side - the server response is an empty shell - so this only works
// because SmartCopy reads the live tab DOM after React has rendered it
// (see getPageCode()'s parseProfileData branch), not a raw background fetch.
//
// Family linking: the "Immediate Family" cards have no <a href> - they're
// not plain links (see #133) - the Facts section does expose real profile
// links for spouse ("Marriage to:") and children ("Birth of son/daughter:"),
// which are read directly from the DOM here. Parents (and siblings, if
// MyHeritage ever renders that card) aren't linked anywhere in the rendered
// HTML at all - their only link lives in a React prop (link_in_profile_page)
// that never reaches the DOM. getPagesSource.js pulls that out of React's
// internal fiber tree and stamps it onto the card as a
// data-smartcopy-profile-link attribute before serializing the page; this
// file reads that attribute for the "Immediate Family" cards it can't get a
// plain href from.
registerCollection({
    "reload": false,
    "recordtype": "MyHeritage Genealogy",
    "prepareUrl": function(url) {
        if (startsWithMH(url, "") && !startsWithHTTP(url, "https://www.myheritage.com/")) {
            url = url.replace(/https?:\/\/www\.myheritage\..*?\//i, "https://www.myheritage.com/");
            this.reload = true;
        }
        return url;
    },
    "collectionMatch": function(url) {
        return startsWithMH(url, "profile-");
    },
    "parseData": function(url) {
        if (url.contains("/profile-")) {
            focusURLid = extractMHProfileId(url);
        } else if (url.contains("rootIndivudalID=")) {
            focusURLid = getParameterByName('rootIndivudalID', url);
        }
        getPageCode();
    },
    "loadPage": function(request) {
        if (request.source.indexOf('SearchPlansPageManager') !== -1) {
            document.getElementById("smartcopy-container").style.display = "none";
            document.getElementById("loading").style.display = "none";
            setMessage(warningmsg, 'SmartCopy can work with the various country-based sites of MyHeritage, but you must first sign into the main english website.<br/><a href="https://www.myheritage.com/" target="_blank">Please login to MyHeritage.com</a>');
            this.parseProfileData = "";
            return;
        }
        var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        var fperson = parsed.find("div.profile_page_header").find("div.person_name");
        focusname = fperson.text();
        focusrange = "";
    },
    "parseProfileData": parseMyHeritageNew
});

// The Immediate Family cards show only a coarse "1881 - 1968" / "Born: 1937"
// / "1905 - Deceased" year summary (no month/day, no place) - much less than
// the Facts section gives for the focus person, but it's the only vital
// info available at all for parents/siblings/spouse (children get a real
// date+place from their own "Birth of son/daughter:" fact instead).
function parseRelativeYearsToData(yearsText) {
    var result = {};
    var rangeMatch = yearsText.match(/^(\d{4})\s*-\s*(\d{4}|Deceased)$/i);
    if (rangeMatch) {
        result.birth = [{date: rangeMatch[1]}];
        if (/^\d{4}$/.test(rangeMatch[2])) {
            result.death = [{date: rangeMatch[2]}];
        }
        return result;
    }
    var bornMatch = yearsText.match(/^Born:\s*(\d{4})$/i);
    if (bornMatch) {
        result.birth = [{date: bornMatch[1]}];
    }
    return result;
}

function extractMHProfileId(url) {
    if (!exists(url) || !url.contains("/profile-")) {
        return "";
    }
    var id = url.substring(url.indexOf('/profile-') + 9);
    id = id.substring(0, id.indexOf("/"));
    id = id.substring(id.indexOf('-') + 1); // <Site-Id>-<Profile-Id> -> Profile-Id
    return id;
}

function parseMyHeritageNew(htmlstring, familymembers, relation) {
    relation = relation || "";
    var parsed = $(htmlstring.replace(/<img/ig, "<gmi"));
    var header = parsed.find("div.profile_page_header");

    var aboutdata = "";
    var profiledata = {};
    var focusdaterange = "";

    var fperson = header.find("div.person_name");
    var focusperson = fperson.text();
    $("#readstatus").html(escapeHtml(focusperson));

    // The gender_F/gender_M class lives on the photo wrapper itself, whether
    // the person has a real photo or a silhouette placeholder - checking the
    // silhouette classes alone (as an earlier version of this file did) misses
    // every profile that has an actual photo.
    var genderval = "unknown";
    var photoWrapper = header.find(".profile_photo_wrapper");
    if (photoWrapper.length >= 1) {
        var wrapperClasses = photoWrapper[0].className;
        if (/\bgender_F\b/.test(wrapperClasses)) {
            genderval = "female";
        } else if (/\bgender_M\b/.test(wrapperClasses)) {
            genderval = "male";
        }
    }
    if (genderval === "unknown") {
        if (focusperson.contains("(born")) {
            genderval = "female";
        } else if (isPartner(relation.title)) {
            genderval = reverseGender(focusgender);
        }
    }

    var imagedata = photoWrapper.find(".profile_photo_element.actual_photo");
    if (exists(imagedata[0])) {
        var styleAttribute = $(photoWrapper[0]).attr('style');
        if (exists(styleAttribute) && styleAttribute.contains("url(")) {
            var urlMatch = styleAttribute.match(/url\((.*?)\)/);
            if (exists(urlMatch) && urlMatch.length > 1) {
                var thumb = urlMatch[1].replace(/['"]/g, '');
                var image = thumb;
                if (!thumb.endsWith("spacer.gif")) {
                    if (htmlstring.contains("profilePhotoFullUrl")) {
                        var imgtemp = htmlstring.match(/profilePhotoFullUrl = '(.*?)';/i);
                        if (exists(imgtemp) && imgtemp.length > 1) {
                            image = imgtemp[1];
                        }
                    }
                    profiledata["thumb"] = thumb;
                    profiledata["image"] = image;
                }
            }
        }
    }

    if (relation === "") {
        focusgender = genderval;
    }

    // ---------------------- Profile Data --------------------
    if (focusdaterange !== "") {
        profiledata["daterange"] = focusdaterange;
    }
    var buriallcflag = false;
    var deathdtflag = false;

    // The header's own ".events" summary is sparse (and its inner classes are
    // CSS-module-hashed and inconsistent between events - e.g. the death
    // event's place has no class at all). The Facts section below the header
    // has the same information via stable classes (fact_name/fact_date/
    // fact_place), plus - critically - real <a href> links to spouse and
    // children, so it's used for both events and family linking.
    // Built once, up front, so both the Facts loop (spouse/children) and the
    // Immediate Family loop (parents/siblings) below can fill in birth/death
    // years for a relative without a second pass over the same cards.
    var relativeYearsByName = {};
    var yearsCards = parsed.find(".profile_page_section.immediate_family .family_relative");
    for (var y = 0; y < yearsCards.length; y++) {
        var yearsCard = $(yearsCards[y]);
        var yearsName = yearsCard.find(".relative_name").text().trim();
        var yearsText = yearsCard.find(".relative_years").text().trim();
        if (yearsName !== "" && yearsText !== "") {
            relativeYearsByName[yearsName] = parseRelativeYearsToData(yearsText);
        }
    }

    var facts = parsed.find(".profile_page_section.facts .fact");
    var familyLinks = [];
    for (var f = 0; f < facts.length; f++) {
        var factEl = $(facts[f]);
        var factLabel = factEl.find(".fact_name").first().text().trim().toLowerCase();

        var dateval = factEl.find(".fact_date").first().text().trim();
        var placeval = factEl.find(".fact_place").first().text().trim();
        var data = [];
        if (dateval !== "") {
            if (dateval.indexOf("(") !== -1) {
                dateval = dateval.substring(0, dateval.indexOf("("));
            }
            dateval = cleanDate(dateval);
            if (dateval !== "") {
                data.push({date: dateval});
            }
        }
        if (placeval !== "") {
            data.push({id: geoid, location: placeval});
            geoid++;
        }

        if (factLabel === "birth") {
            if (!$.isEmptyObject(data)) {
                profiledata["birth"] = data;
            }
        } else if (factLabel === "death") {
            if (!$.isEmptyObject(data)) {
                if (exists(getDate(data))) {
                    deathdtflag = true;
                }
                profiledata["death"] = data;
            }
        } else if (factLabel.startsWith("burial")) {
            if (!$.isEmptyObject(data)) {
                if (exists(getLocation(data))) {
                    buriallcflag = true;
                }
                profiledata["burial"] = data;
            }
        } else if (factLabel.startsWith("baptism") || factLabel.startsWith("christening")) {
            if (!$.isEmptyObject(data)) {
                profiledata["baptism"] = data;
            }
        } else if (factLabel === "marriage to:") {
            if (!$.isEmptyObject(data)) {
                profiledata["marriage"] = data;
            }
        }

        // Only facts describing this person's own spouse/children carry a
        // direct relationship to the focus person - "Marriage of son:" etc.
        // link a child's spouse, not this person's, so those are skipped.
        var relTitle = null;
        if (factLabel === "marriage to:") {
            relTitle = "";
        } else if (factLabel === "birth of son:") {
            relTitle = "son";
        } else if (factLabel === "birth of daughter:") {
            relTitle = "daughter";
        }
        if (relTitle !== null) {
            var anchors = factEl.find(".fact_relatives a.fact_relative");
            for (var r = 0; r < anchors.length; r++) {
                var a = $(anchors[r]);
                var relurl = a.attr("href");
                if (!exists(relurl)) {
                    continue;
                }
                var relname = a.find(".relative_name").text().trim();
                if (relname === "") {
                    relname = a.text().trim();
                }
                var title = relTitle;
                if (title === "") {
                    var relWrapper = a.find(".profile_photo_wrapper");
                    if (relWrapper.length && /\bgender_M\b/.test(relWrapper[0].className)) {
                        title = "husband";
                    } else if (relWrapper.length && /\bgender_F\b/.test(relWrapper[0].className)) {
                        title = "wife";
                    }
                }
                if (!exists(title) || title === "") {
                    continue;
                }
                var relEntry = {title: title, name: relname, url: relurl, itemId: extractMHProfileId(relurl)};
                // "Birth of son/daughter:"/"Marriage to:" already carry this
                // same fact's own date+place - the child's own birth, or the
                // marriage this spouse shares with the focus person - so use
                // it directly instead of falling back to the coarser
                // year-only data below.
                if ((title === "son" || title === "daughter") && !$.isEmptyObject(data)) {
                    relEntry.birth = data;
                } else if ((title === "husband" || title === "wife") && !$.isEmptyObject(data)) {
                    relEntry.marriage = data;
                }
                var relYears = relativeYearsByName[relname];
                if (relYears) {
                    if (!exists(relEntry.birth) && relYears.birth) {
                        relEntry.birth = relYears.birth;
                    }
                    if (relYears.death) {
                        relEntry.death = relYears.death;
                    }
                }
                familyLinks.push(relEntry);
            }
        }
    }

    // Parents (and siblings, if MyHeritage ever renders that card class) are
    // not linked anywhere in the Facts section - the "Immediate Family" cards
    // are the only place they appear, and those cards have no <a href> at all
    // (see file header comment). getPagesSource.js stamps a
    // data-smartcopy-profile-link attribute onto these cards before the page
    // is serialized, using a link it pulls out of React's internal props, so
    // that's used here instead. Spouse/children are skipped here since the
    // Facts loop above already captured them via a real <a href>.
    var immediateFamily = parsed.find(".profile_page_section.immediate_family .family_relative");
    for (var m = 0; m < immediateFamily.length; m++) {
        var card = $(immediateFamily[m]);
        var cardUrl = card.attr("data-smartcopy-profile-link");
        if (!exists(cardUrl)) {
            continue;
        }
        var cardTitle = card.find(".relative_relationship").text().trim().replace(/^(His|Her|Your)\s+/i, "").trim().toLowerCase();
        if (!isParent(cardTitle) && !isSibling(cardTitle)) {
            continue;
        }
        var cardName = card.find(".relative_name").text().trim();
        var cardEntry = {title: cardTitle, name: cardName, url: cardUrl, itemId: extractMHProfileId(cardUrl)};
        var cardYears = relativeYearsByName[cardName];
        if (cardYears) {
            if (cardYears.birth) {
                cardEntry.birth = cardYears.birth;
            }
            if (cardYears.death) {
                cardEntry.death = cardYears.death;
            }
        }
        familyLinks.push(cardEntry);
    }

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
            var subdata = {name: rel.name, title: rel.title, url: rel.url, itemId: rel.itemId, profile_id: famid, birth: rel.birth, death: rel.death, marriage: rel.marriage};
            if (isPartner(rel.title)) {
                myhspouse.push(famid);
            } else if (isParent(rel.title)) {
                parentlist.push(rel.itemId);
            }
            unionurls[famid] = rel.itemId;
            getMyHeritageNewFamily(famid, rel.url, subdata);
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

function getMyHeritageNewFamily(famid, url, subdata) {
    familystatus.push(famid);
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url,
        variable: subdata
    }, function (response) {
        var arg = response.variable;
        var person = parseMyHeritageNew(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
        if (person === "") {
            familystatus.pop();
            return;
        }
        person = updateInfoData(person, arg);
        // The recursive fetch above almost always comes back empty (the new
        // page design is entirely client-rendered, so a raw background
        // fetch never sees React's output - see file header comment), so
        // birth/death already gathered from the focus person's own page
        // (Facts section dates for children, Immediate Family years for
        // everyone else) are carried over here rather than lost.
        if (!exists(person.birth) && exists(arg.birth)) {
            person.birth = arg.birth;
        }
        if (!exists(person.death) && exists(arg.death)) {
            person.death = arg.death;
        }
        if (!exists(person.marriage) && exists(arg.marriage)) {
            person.marriage = arg.marriage;
        }
        databyid[arg.profile_id] = person;
        alldata["family"][arg.title].push(person);
        familystatus.pop();
    });
}
