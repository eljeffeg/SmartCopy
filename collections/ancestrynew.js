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
    "loadPage": function(request) {
        var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        if (parsed.text().contains("Please sign in for secure access to your Ancestry account")) {
            document.getElementById("smartcopy-container").style.display = "none";
            document.getElementById("loading").style.display = "none";
            setMessage(warningmsg, 'SmartCopy can work with the various country-based sites of Ancestry, but you must first sign into the main english website.<br/><a href="https://www.ancestry.com/" target="_blank">Please login to Ancestry.com</a>');
            this.parseProfileData = "";
            return;
        }
        var par = parsed.find("#personCard");
        focusname = par.find(".userCardTitle").text();
        focusrange = par.find(".userCardSubTitle").text().replace("&ndash;", " - ");
    },
    "parseProfileData": parseAncestryNew
});

var ancestrymrglist = [];

async function readPersonCard(htmlstring) {
    var foundScript = $("script:contains('var PersonCard')", htmlstring).text();
    
    return new Promise((resolve, reject) => {
        // TODO assign the return of this to the PersonCard object
        if (foundScript) {
            // truncate the end
            foundScript = foundScript.substring(0, foundScript.indexOf("};") + 2) + "PersonCard;";
            chrome.runtime.sendMessage({
                action: "eval",
                variable: foundScript
            }).then((resp) => {
                // TODO - need to figure out how to use this
                resolve(resp);
            });
        } else {
            reject("PersonCard not found");
        }
    });

}

async function parseAncestryNew(htmlstring, familymembers, relation) {
    relation = relation || "";
    if (!exists(htmlstring)) {
        return "";
    }
    // TODO - figure out where the parsing issues are
    var personCard = await readPersonCard(htmlstring);

    // get personFacts
    var pfStart = htmlstring.indexOf("researchData = ");
    var pfEnd = htmlstring.indexOf("};", pfStart);

    var personFacts = JSON.parse(htmlstring.substring(pfStart + 14, pfEnd + 1));
    
    // useful for debugging Ancestry calls
    // console.log("Ancestry new - entering with PersonCard: {} personFacts: {} familymembers: {} relation: {}", personCard, personFacts, familymembers, relation);
    var focusperson = personCard.name.trim();
    var focusdaterange = personCard.lifeYearRange.replace("&ndash;", " - ");
    $("#readstatus").html(escapeHtml(focusperson));
    var profiledata = {};
    var genderval = "unknown";
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;
    var aboutdata = "";
    
    if (personCard.gender && (isFemale(personCard.gender) || isMale(personCard.gender))) {
            profiledata["gender"] = personCard.gender.toLowerCase();
    }
    if (personCard.isLiving) {
        profiledata["alive"] = personCard.isLiving;
    }

    profiledata["name"] = focusperson;
    profiledata["status"] = relation.title;

    // Loop through important life events
    for(var i = 0; i < personFacts.PersonFacts.length; i++) {
        const fact = personFacts.PersonFacts[i];
        // we only want to examine FactType 0 which apply to this person
        if (fact.FactType != 0) continue;
        switch(fact.TypeString) {
            case 'Birth':
                profiledata["birth"] = setFactData(fact);
                break;
            case 'Baptism':
                profiledata["baptism"] = setFactData(fact);
                break;
            case 'Burial':
                profiledata["burial"] = setFactData(fact);
                if (fact.Date) burialdtflag = true;
                if (fact.Place) buriallcflag = true;
                break;
            case 'Death':
                profiledata["death"] = setFactData(fact);
                break;
            case 'Marriage':
                // TODO handle marriage 
                profiledata["marriage"] = setFactData(fact);
                if (familymembers && fact.FactTargetPerson && fact.FactTargetPerson.Id) {
                    var mid = fact.FactTargetPerson.Id;
                    ancestrymrglist.push({
                        "id": mid,
                        "event": setFactData(fact)
                    }); 
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

    if (exists(personCard.photo)) {
        var image = $("img", personCard.photo).attr("src");
        if (exists(image)) {
            profiledata["thumb"] = image.replace("&maxHeight=280", "&maxWidth=152");
            profiledata["image"] = image.replace("&maxHeight=280", "");
        }
    }

    if (relation === "") {
        focusgender = genderval;
    }

    if (familymembers) {
        loadGeniData();
        var famid = 0;
    }

    // ---------------------- Family Data --------------------

    for(var i = 0; i < personFacts.ResearchFamily.Children.length; i++) {
        var child = personFacts.ResearchFamily.Children[i];
        if (familymembers && exists (child.ClickUrl)) {
            await getAncestryNewTreeFamily(famid++, child.Id, child.FullName.trim(), "child", child.ClickUrl);
        }
    }
    for(var i = 0; i < personFacts.ResearchFamily.HalfSiblings.length; i++) {
        var halfsibling = personFacts.ResearchFamily.HalfSiblings[i];
        if (familymembers && exists(halfsibling.ClickUrl)) {
            await getAncestryNewTreeFamily(famid++, halfsibling.Id, halfsibling.FullName.trim(), "halfsibling", halfsibling.ClickUrl);
        }
    }
    for(var i = 0; i < personFacts.ResearchFamily.Siblings.length; i++) {
        var sibling = personFacts.ResearchFamily.Siblings[i];
        if (familymembers && exists(sibling.ClickUrl)) {
            await getAncestryNewTreeFamily(famid++, sibling.Id, sibling.FullName.trim(), "sibling", sibling.ClickUrl);
        }
    }
    for(var i = 0; i < personFacts.ResearchFamily.Fathers.length; i++) {
        var father = personFacts.ResearchFamily.Fathers[i];
        if (familymembers) {
            if (exists(father.ClickUrl)) {
                await getAncestryNewTreeFamily(famid++, father.Id, father.FullName.trim(), "father", father.ClickUrl);
            }
        } else if (exists(relation.title)) {
            if (isChild(relation.tite)) {
                if (personCard.personId !== father.Id) {
                    childlist[relation.proid] = $.inArray(father.Id, unionurls);
                    profiledata["parent_id"] = $.inArray(father.Id, unionurls);
                }
            }
        }
    }
    for(var i = 0; i < personFacts.ResearchFamily.Mothers.length; i++) {
        var mother = personFacts.ResearchFamily.Mothers[i];
        if (familymembers) {
            if (exists(mother.ClickUrl)) {
                await getAncestryNewTreeFamily(famid++, mother.Id, mother.FullName.trim(), "mother", mother.ClickUrl);
            }
        } else if (exists(relation.title)) {
            if (isChild(relation.tite)) {
                if (personCard.personId !== mother.Id) {
                    childlist[relation.proid] = $.inArray(mother.Id, unionurls);
                    profiledata["parent_id"] = $.inArray(mother.Id, unionurls);
                }
            }
        }
    }
    for(var i = 0; i < personFacts.ResearchFamily.Spouses.length; i++) {
        var spouse = personFacts.ResearchFamily.Spouses[i];
        if (spouse.FullName.trim().toLowerCase() == "no spouse") continue;
        if (familymembers && exists(spouse.ClickUrl)) {
            myhspouse.push(spouse.Id);
            await getAncestryNewTreeFamily(famid++, spouse.Id, spouse.FullName.trim(), "spouse", spouse.ClickUrl);
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
            await response;
            var arg = response.variable;
            var person = await parseAncestryNew(response.source, false, {
                "title": arg.title,
                "proid": arg.profile_id,
                "itemId": arg.itemId
            });
            if (person === "") {
                familystatus.pop();
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
        });
    });
}