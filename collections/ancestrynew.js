// Parse Ancestry (person.ancestry.com & trees.ancestry.com)
registerCollection({
    "reload": false,
    "recordtype": "Ancestry Genealogy",
    "prepareUrl": function(url) {
        if (startsWithHTTP(url, "http://trees.ancestry.") || url.contains("/family-tree/tree/") || url.contains("/family-tree/person/tree/")) {
            if (url.endsWith("/family") || url.endsWith("/family/familyview") || url.endsWith("/family/pedigree")) {
                document.querySelector('#loginspinner').style.display = "none";
                setMessage(warningmsg, 'SmartCopy was unable to identify the Ancestry focus profile.  Please select a focus profile in the tree.');
                return;
            } else {
                url = url.replace("family/familyview", "family")
                url = url.replace("/family-tree/tree/", "/family-tree/person/tree/")
                url = url.replace("/family/", "/");
                url = url.replace("family?fpid=", "person/");
                url = url.replace("family?cfpid=", "person/");
                url = url.replace("pedigree?fpid=", "person/");
                url = url.replace("pedigree?cfpid=", "person/");
                url = url.split("&")[0];
                url = url.replace("trees.ancestry.", "person.ancestry.");
                
                url = url.replace("/community/potential", "");
                if (isNaN(url.slice(-1))) {
                    url = url.substring(0, url.lastIndexOf('/'));
                }
                if (!url.endsWith("/facts")) {
                    url += "/facts";
                }
                this.reload = true;
            }
        } else if (startsWithHTTP(url, "http://person.ancestry.") || url.contains("/family-tree/person/")) {
            if (!url.contains("/facts")) {
                url = url.replace("/story", "/facts");
                url = url.replace("/gallery", "/facts");
                url = url.replace(/\/hints.*/, "/facts");
                this.reload = true;
            }
        }
        if (startsWithHTTP(url, "http://person.ancestry.") && !startsWithHTTP(url, "http://person.ancestry.com/")) {
            url = url.replace(/person\.ancestry\..*?\//i, "person.ancestry.com/");
            this.reload = true;
        }
        if (startsWithHTTP(url, "http://www.ancestry.") && !startsWithHTTP(url, "http://www.ancestry.com/")) {
            url = url.replace(/www\.ancestry\..*?\//i, "www.ancestry.com/");
            this.reload = true;
        }
        if (startsWithHTTP(url, "http://trees.ancestry.") && !startsWithHTTP(url, "http://trees.ancestry.com/")) {
            url = url.replace(/trees\.ancestry\..*?\//i, "trees.ancestry.com/");
            this.reload = true;
        }
        return url;
    },
    "collectionMatch": function(url) {
        return (
            startsWithHTTP(url, "http://person.ancestry.") || startsWithHTTP(url, "http://trees.ancestry.") || ((startsWithHTTP(url, "http://www.ancestry.") || startsWithHTTP(url, "http://www.ancestrylibrary.")) && url.contains("/family-tree/")));
    },
    "parseData": function(url) {
        if (url.contains("/fact")) {
            url = url.substring(0, url.lastIndexOf("/fact"));
        }
        focusURLid = url.substring(url.lastIndexOf('/') + 1);
        getPageCode();
    },
    "loadPage": async function(request) {
        var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        if (parsed.text().contains("Please sign in for secure access to your Ancestry account")) {
            document.getElementById("smartcopy-container").style.display = "none";
            document.getElementById("loading").style.display = "none";
            setMessage(warningmsg, 'SmartCopy can work with the various country-based sites of Ancestry, but you must first sign into the main english website.<br/><a href="https://www.ancestry.com/" target="_blank">Please login to Ancestry.com</a>');
            this.parseProfileData = "";
            return;
        }
        // #personCard/.userCardTitle predate the #person-data page-structure
        // migration and no longer match current Ancestry pages (they always
        // returned "", silently clearing focusname before the real copy ever
        // reads it). Use the same extraction parseAncestryNew relies on.
        var data = await extractAncestryPersonData(request.source);
        focusname = data.name;
        focusrange = data.daterange;
    },
    "parseProfileData": parseAncestryNew
});

var ancestrymrglist = [];

function resolveAncestryUrl(url) {
    return resolveRelativeUrl(url, "https://www.ancestry.com");
}

// Ancestry (as of 2026) embeds all person data as a single JSON blob in
// <script id="person-data" type="application/json">. Older trees/pages may
// still be served with the legacy inline `var PersonCard = {...}` script
// plus a separate `researchData = {...}` blob, so fall back to that if the
// new block isn't found.
function extractNewPersonData(htmlstring) {
    var marker = '<script id="person-data" type="application/json">';
    var start = htmlstring.indexOf(marker);
    if (start === -1) {
        return null;
    }
    start += marker.length;
    var end = htmlstring.indexOf("</script>", start);
    if (end === -1) {
        return null;
    }
    var pageData;
    try {
        pageData = JSON.parse(htmlstring.substring(start, end));
    } catch (err) {
        console.warn("Ancestry: failed to parse #person-data JSON", err);
        return null;
    }
    var personCard = (pageData.person && pageData.person.PersonCard) || {};
    var personResearch = (pageData.person && pageData.person.PersonResearch) || {};
    var family = personResearch.PersonFamily || {};
    return {
        name: exists(personCard.FullName) ? personCard.FullName.trim() : "",
        daterange: exists(personCard.LifeRange) ? personCard.LifeRange.replace("&ndash;", " - ") : "",
        isLiving: !!personCard.IsLiving,
        imageUrl: resolveAncestryUrl(personCard.PrimaryImageUrl) || "",
        genderHint: "",
        personId: pageData.personId,
        facts: personResearch.PersonFacts || [],
        family: {
            Children: family.Children || [],
            HalfSiblings: family.HalfSiblings || [],
            Siblings: family.Siblings || [],
            Fathers: family.Fathers || [],
            Mothers: family.Mothers || [],
            Spouses: family.Spouses || []
        }
    };
}

async function extractLegacyPersonData(htmlstring) {
    var personCard = {};
    try {
        var foundScript = $("script:contains('var PersonCard')", htmlstring).text();
        if (foundScript) {
            foundScript = foundScript.substring(0, foundScript.indexOf("};") + 2) + "PersonCard;";
            personCard = await chrome.runtime.sendMessage({
                action: "eval",
                variable: foundScript
            }) || {};
        }
    } catch (err) {
        personCard = {};
    }

    var facts = [];
    var family = {};
    var pfStart = htmlstring.indexOf("researchData = ");
    if (pfStart !== -1) {
        var pfEnd = htmlstring.indexOf("};", pfStart);
        if (pfEnd !== -1) {
            try {
                var researchData = JSON.parse(htmlstring.substring(pfStart + 14, pfEnd + 1));
                facts = researchData.PersonFacts || [];
                family = researchData.ResearchFamily || {};
            } catch (err) {
                console.warn("Ancestry: failed to parse legacy researchData JSON", err);
            }
        }
    }

    var imageUrl = "";
    if (exists(personCard.photo)) {
        var imgSrc = $("img", personCard.photo).attr("src");
        if (exists(imgSrc)) {
            imageUrl = imgSrc;
        }
    }

    return {
        name: exists(personCard.name) ? personCard.name.trim() : "",
        daterange: exists(personCard.lifeYearRange) ? personCard.lifeYearRange.replace("&ndash;", " - ") : "",
        isLiving: !!personCard.isLiving,
        imageUrl: imageUrl,
        genderHint: exists(personCard.gender) ? personCard.gender : "",
        personId: personCard.personId,
        facts: facts,
        family: {
            Children: family.Children || [],
            HalfSiblings: family.HalfSiblings || [],
            Siblings: family.Siblings || [],
            Fathers: family.Fathers || [],
            Mothers: family.Mothers || [],
            Spouses: family.Spouses || []
        }
    };
}

async function extractAncestryPersonData(htmlstring) {
    var data = extractNewPersonData(htmlstring);
    if (data) {
        return data;
    }
    console.warn("Ancestry: #person-data block not found, falling back to legacy page format");
    return await extractLegacyPersonData(htmlstring);
}

async function parseAncestryNew(htmlstring, familymembers, relation) {
    relation = relation || "";
    if (!exists(htmlstring)) {
        return "";
    }

    var data = await extractAncestryPersonData(htmlstring);
    var focusPersonId = data.personId;

    let focusperson = data.name;
    let focusdaterange = data.daterange;

    $("#readstatus").html(escapeHtml(focusperson));
    var profiledata = {};
    var genderval = getAncestryGender(data.facts, data.genderHint);
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;
    var aboutdata = "";

    profiledata["gender"] = genderval;
    if (data.isLiving) {
        profiledata["alive"] = data.isLiving;
    }

    profiledata["name"] = focusperson;
    profiledata["status"] = relation.title;

    // Loop through important life events
    // Ancestry marks exactly one fact per type as primary (IsAlternate:
    // false) - the rest are alternates (e.g. an estimated birth year pulled
    // from an unrelated record). Track whether the currently-stored value
    // for each field is itself an alternate, so a later primary fact can
    // still replace it - but a later alternate never displaces an already-
    // stored primary just because it comes later in data.facts.
    var birthIsAlternate, baptismIsAlternate, burialIsAlternate, deathIsAlternate, marriageIsAlternate;
    for(var i = 0; i < data.facts.length; i++) {
        const fact = data.facts[i];
        // we only want to examine FactType 0 which apply to this person
        if (fact.FactType != 0) continue;
        switch(fact.TypeString) {
            case 'Birth':
                if (!exists(profiledata["birth"]) || (!fact.IsAlternate && birthIsAlternate)) {
                    profiledata["birth"] = setFactData(fact);
                    birthIsAlternate = !!fact.IsAlternate;
                }
                break;
            case 'Baptism':
                if (!exists(profiledata["baptism"]) || (!fact.IsAlternate && baptismIsAlternate)) {
                    profiledata["baptism"] = setFactData(fact);
                    baptismIsAlternate = !!fact.IsAlternate;
                }
                break;
            case 'Burial':
                if (!exists(profiledata["burial"]) || (!fact.IsAlternate && burialIsAlternate)) {
                    profiledata["burial"] = setFactData(fact);
                    burialIsAlternate = !!fact.IsAlternate;
                    if (fact.Date) burialdtflag = true;
                    if (fact.Place) buriallcflag = true;
                }
                break;
            case 'Death':
                if (!exists(profiledata["death"]) || (!fact.IsAlternate && deathIsAlternate)) {
                    profiledata["death"] = setFactData(fact);
                    deathIsAlternate = !!fact.IsAlternate;
                }
                break;
            case 'Marriage':
                // TODO handle marriage
                if (!exists(profiledata["marriage"]) || (!fact.IsAlternate && marriageIsAlternate)) {
                    profiledata["marriage"] = setFactData(fact);
                    marriageIsAlternate = !!fact.IsAlternate;
                }
                if (familymembers && fact.FactTargetPerson && fact.FactTargetPerson.Id) {
                    var mid = fact.FactTargetPerson.Id;
                    var mrgIdx = -1;
                    for (var m = 0; m < ancestrymrglist.length; m++) {
                        if (ancestrymrglist[m].id === mid) {
                            mrgIdx = m;
                            break;
                        }
                    }
                    if (mrgIdx === -1) {
                        ancestrymrglist.push({
                            "id": mid,
                            "event": setFactData(fact),
                            "isAlternate": !!fact.IsAlternate
                        });
                    } else if (!fact.IsAlternate && ancestrymrglist[mrgIdx].isAlternate) {
                        ancestrymrglist[mrgIdx].event = setFactData(fact);
                        ancestrymrglist[mrgIdx].isAlternate = false;
                    }
                }
                break;
        }
    }
    if (!familymembers && isPartner(relation.title) && !exists(profiledata["marriage"])) {
        for (var i = 0; i < ancestrymrglist.length; i++) {
            if (ancestrymrglist[i].id === relation.itemId) {
                profiledata["marriage"] = ancestrymrglist[i].event;
                break;
            }
        }
    }

    if (data.imageUrl !== "") {
        var image = data.imageUrl;
        profiledata["thumb"] = image.replace("&maxHeight=280", "&maxWidth=152");
        profiledata["image"] = image.replace("&maxHeight=280", "");
    }

    if (relation === "") {
        focusgender = genderval;
    }

    if (familymembers) {
        loadGeniData();
        var famid = 0;
    }

    // ---------------------- Family Data --------------------
    // Spouses are fetched (and registered into unionurls/myhspouse) before
    // Children: a child's parent_id gets resolved by looking up its other
    // parent's id in unionurls, via a recursive fetch of the child's own
    // page. Since these are true sequential `await`s (not fire-and-forget,
    // unlike the older collection parsers), that lookup would otherwise
    // run before the spouse it needs to find was ever added.
    for(var i = 0; i < data.family.Spouses.length; i++) {
        var spouse = data.family.Spouses[i];
        if (spouse.FullName.trim().toLowerCase() == "no spouse") continue;
        if (familymembers && exists(spouse.ClickUrl)) {
            myhspouse.push(famid);
            await getAncestryNewTreeFamily(famid++, spouse.Id, spouse.FullName.trim(), "spouse", spouse.ClickUrl);
        }
    }
    for(var x = 0; x < data.family.Children.length; x++) {
        var childgroup = data.family.Children[x];
        if (!exists(childgroup)) continue;
        var children = Array.isArray(childgroup) ? childgroup : [childgroup];
        if (!Array.isArray(childgroup)) {
            console.warn("Ancestry: Children entry was not an array, wrapping it", childgroup);
        }
        for(var i = 0; i < children.length; i++) {
            var child = children[i]
            if (familymembers && exists (child.ClickUrl)) {
                await getAncestryNewTreeFamily(famid++, child.Id, child.FullName.trim(), "child", child.ClickUrl);
            }
        }
    }
    for(var i = 0; i < data.family.HalfSiblings.length; i++) {
        var halfsibling = data.family.HalfSiblings[i];
        if (familymembers && exists(halfsibling.ClickUrl)) {
            await getAncestryNewTreeFamily(famid++, halfsibling.Id, halfsibling.FullName.trim(), "halfsibling", halfsibling.ClickUrl);
        }
    }
    for(var i = 0; i < data.family.Siblings.length; i++) {
        var sibling = data.family.Siblings[i];
        if (familymembers && exists(sibling.ClickUrl)) {
            await getAncestryNewTreeFamily(famid++, sibling.Id, sibling.FullName.trim(), "sibling", sibling.ClickUrl);
        }
    }
    for(var i = 0; i < data.family.Fathers.length; i++) {
        var father = data.family.Fathers[i];
        if (familymembers) {
            if (exists(father.ClickUrl)) {
                await getAncestryNewTreeFamily(famid++, father.Id, father.FullName.trim(), "father", father.ClickUrl);
            }
        } else if (exists(relation.title)) {
            if (isChild(relation.title)) {
                if (String(focusPersonId) !== String(father.Id)) {
                    childlist[relation.proid] = $.inArray(father.Id, unionurls);
                    profiledata["parent_id"] = $.inArray(father.Id, unionurls);
                }
            }
        }
    }
    for(var i = 0; i < data.family.Mothers.length; i++) {
        var mother = data.family.Mothers[i];
        if (familymembers) {
            if (exists(mother.ClickUrl)) {
                await getAncestryNewTreeFamily(famid++, mother.Id, mother.FullName.trim(), "mother", mother.ClickUrl);
            }
        } else if (exists(relation.title)) {
            if (isChild(relation.title)) {
                if (String(focusPersonId) !== String(mother.Id)) {
                    childlist[relation.proid] = $.inArray(mother.Id, unionurls);
                    profiledata["parent_id"] = $.inArray(mother.Id, unionurls);
                }
            }
        }
    }
    // ---------------------- Profile Data --------------------
    if (focusdaterange !== "") {
        profiledata["daterange"] = focusdaterange;
    }

    if (!burialdtflag && buriallcflag && deathdtflag && $('#burialonoffswitch').prop('checked')) {
        profiledata = checkBurial(profiledata);
    }

    if (aboutdata.trim() !== "") {
        profiledata["about"] = cleanHTML(aboutdata);
        // "\n--------------------\n"  Merge separator
    }

    if (familymembers) {
        alldata["profile"] = profiledata;
        alldata["scorefactors"] = smscorefactors;
        updateGeo();
    }

    return profiledata;
}

function setFactData(fact) {
    var data = [];
    if (fact.Date) {
        var dateval = cleanDate(fact.Date);
        data.push({
            date: dateval
        });
    }
    if (fact.Place) {
        data.push({
            id: geoid,
            location: fact.Place
        });
        geoid++;
    }
    return data;
}


async function getAncestryNewTreeFamily(famid, itemid, name, title, url) {
    if (url.startsWith("/")) {
        url = "https://www.ancestry.com" + url;
    }
    return new Promise((resolve, reject) => {
        var gendersv = "unknown";
        var halfsibling = false;
        if (title === "halfsibling") {
            halfsibling = true;
            title = "sibling";
        }
        var subdata = {
            name: name,
            title: title,
            halfsibling: halfsibling,
            gender: gendersv,
            url: url,
            itemId: itemid,
            profile_id: famid
        };
        if (!exists(alldata["family"][title])) {
            alldata["family"][title] = [];
        }
        unionurls[famid] = itemid;
        familystatus.push(famid);

        chrome.runtime.sendMessage({
            method: "GET",
            action: "xhttp",
            url: url,
            variable: subdata
        }, async function(response) {
            try {
                await response;
                var arg = response.variable;
                var person = await parseAncestryNew(response.source, false, {
                    "title": arg.title,
                    "proid": arg.profile_id,
                    "itemId": arg.itemId
                });
                if (person === "") {
                    familystatus.pop();
                    resolve(false);
                    return;
                }
                if (arg.halfsibling) {
                    person["halfsibling"] = true;
                }
                person = updateInfoData(person, arg);
                databyid[arg.profile_id] = person;
                alldata["family"][arg.title].push(person);
                familystatus.pop();
                resolve(true);
            } catch (err) {
                console.error("getAncestryNewTreeFamily failed for", url, err);
                familystatus.pop();
                resolve(false);
            }
        });
    });
}

function getAncestryGender(facts, genderHint) {
    let genderval = 'unknown';
    if (Array.isArray(facts)) {
        for (var i = 0; i < facts.length; i++) {
            var fact = facts[i];
            if (fact.TypeString === 'Gender' && exists(fact.Value) && (isFemale(fact.Value) || isMale(fact.Value))) {
                genderval = fact.Value.toLowerCase();
                break;
            }
        }
    }
    if (genderval === 'unknown' && exists(genderHint) && (isFemale(genderHint) || isMale(genderHint))) {
        genderval = genderHint.toLowerCase();
    }
    if (genderval === 'f') {
        genderval = 'female';
    } else if (genderval === 'm') {
        genderval = 'male';
    }
    return genderval;
}