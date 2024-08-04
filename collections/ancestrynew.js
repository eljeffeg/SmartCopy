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

function evaluateBooleanExpressions(str) {
    let retStr = str.replaceAll("'True'", "true");
    retStr = retStr.replaceAll("'true'", "true");
    retStr = retStr.replaceAll("True", "true");
    retStr = retStr.replaceAll("'False'", "false");
    retStr = retStr.replaceAll("'false'", "false");
    retStr = retStr.replaceAll("False", "false");
    retStr = retStr.replaceAll("true === true", "true");
    retStr = retStr.replaceAll("true === false", "false");
    retStr = retStr.replaceAll("false === true", "false");
    retStr = retStr.replaceAll("false === false", "true");
    retStr = retStr.replaceAll("\(true\)", "true");
    retStr = retStr.replaceAll("\(false\)", "false");
    retStr = retStr.replaceAll("true ? true : false", "true");
    retStr = retStr.replaceAll("false ? true : false", "false");
    retStr = retStr.replaceAll("\(true\)", "true");
    retStr = retStr.replaceAll("\(false\)", "false");
    retStr = retStr.replaceAll(/\u0026ndash;'/g, '-');
    return retStr;
}

function extractPersonCardRawJson(inputString) {
    return inputString.replace("var PersonCard = ", "").replace(/};[\s\S]*$/, '};');
}

function sanitizeAndParseJSON(inputString) {
    let sanitizedString = inputString.replaceAll("\t", "").replaceAll("\n", "")

    // Step 0: evaluate boolean expressions
    sanitizedString = evaluateBooleanExpressions(sanitizedString)

    // Step 0.5: remove two single quotes
    sanitizedString = sanitizedString.replaceAll("'' +", "").replaceAll("+ ''", "");

    // Step 1: Replace single quotes with double quotes for property names and string values
    sanitizedString = sanitizedString.replace(/([a-zA-Z0-9_]+)\s*: '([^']*)'/g, '"$1":"$2"');

    // Step 2: Replace unquoted true/false strings with actual booleans
    sanitizedString = sanitizedString.replace(/:\s*'true'/g, ': true');
    sanitizedString = sanitizedString.replace(/:\s*'false'/g, ': false');
    sanitizedString = sanitizedString.replace(/:\s*'True'/g, ': true');
    sanitizedString = sanitizedString.replace(/:\s*'False'/g, ': false');

    // Step 3: Ensure all property names are double quoted
    sanitizedString = sanitizedString.replace(/([a-zA-Z0-9_]+)\s*: /g, '"$1":');

    // Step 4: Remove trailing commas (if any)
    sanitizedString = sanitizedString.replace(/,(\s*})/g, '$1');

    // Step 5: fix "(true")
    sanitizedString = sanitizedString.replaceAll("(true)", "true").replaceAll("(false)", "false");

    // Step 6: remove Modals
    sanitizedString = sanitizedString.replaceAll(/,"modals":.*};/g, "}");

    // Step 7: single quote again
    sanitizedString = sanitizedString.replaceAll(/,"[A-Za-z]+": '.*'/g, "");

    // Step 8: Sanitize HTML elements
    sanitizedString = sanitizedString.replaceAll(/<.*>/g, "");

    return JSON.parse(sanitizedString);
}


function extractPersonFacts(profiledata, personFacts) {
    for(const personFact in personFacts) {
        if (personFact.Value) {
            const value = personFact.Value.trim();
            switch (personFacts.TypeString) {
                case "Name":
                    profiledata["name"] = value;
                    break;
                case "Gender":
                    const gen = value;
                    if (isMale(gen) || isFemale(gen)) {
                        profiledata["gender"] = gen;
                    }
                    break;
                case "Birth":
                    parseAncestryPersonFactDate(profiledata, personFact, "birth");
                    break;
                case "Marriage":
                    parseAncestryPersonFactDate(profiledata, personFact, "marriage");
                    break;
                case "Death":
                    parseAncestryPersonFactDate(profiledata, personFact, "death");
                    break;
                case "Burial":
                    parseAncestryPersonFactDate(profiledata, personFact, "burial");
                    break;
            }
        }
    }
}

function extractPersonFamilyMember(profiledata, familyCategory, familyMember) {
    
}

function parseAncestryNew(htmlstring, familymembers, relation) {
    relation = relation || "";
    if (!exists(htmlstring)) {
        return "";
    }
    var parsed = $(htmlstring.replace(/<img/ig, "<gmi"));
    var par = parsed.find("#personCard");
    var focusperson = par.find(".userCardTitle").text();
    var focusdaterange = par.find(".userCardSubTitle").text().replace("&ndash;", " - ");
    $("#readstatus").html(escapeHtml(focusperson));
    var profiledata = {};
    var genderval = "unknown";
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;
    var aboutdata = "";

    let personCardScript;
    let scripts = parsed.find(".personCardContainer").find("script");
    for (let i = 0; i<scripts.length; i++) {
        const script = scripts[i];
        if (script.innerText && script.innerText.trim().startsWith("var PersonCard")) {
            personCardScript = script.innerText.trim();
            break;
        }
    }

    if (personCardScript) {
        let personCardRawJson = extractPersonCardRawJson(personCardScript);
        let personCard = sanitizeAndParseJSON(personCardRawJson);

        if (personCard) {
            if (isNonEmptyField(personCard, "gender")) {
                let gen = personCard["gender"].trim();
                if (isMale(gen) || isFemale(gen)) {
                    genderval = gen;
                }
            }

            // Dates
            if (isNonEmptyField(personCard, "isLiving")) {
                profiledata["alive"] = personCard["isLiving"];
            }

            parseAncestryPersonCardDate(profiledata, personCard, "birth");
            parseAncestryPersonCardDate(profiledata, personCard, "death");
            if (exists(profiledata["death"])) {
                deathdtflag = true;
            }

            parseAncestryPersonCardDate(profiledata, personCard, "baptism");
            parseAncestryPersonCardDate(profiledata, personCard, "burial");
            if (exists(profiledata["burial"])) {
                for (const burialData in profiledata["burial"]) {
                    if (isNonEmptyField(burialData, "location")) {
                        buriallcflag = true;
                    }
                    if (isNonEmptyField(burialData, "date")) {
                        burialdtflag = true;
                    }
                }
            }
        }
    }


    let personDetailsScript;
    scripts = parsed.find(".personPageFacts").find("script");
    for (let i = 0; i<scripts.length; i++) {
        const script = scripts[i];
        if (script.innerText && script.innerText.trim().startsWith("window.researchData = ")) {
            personDetailsScript = script.innerText.trim().replace("window.researchData = ", "");
            personDetailsScript = personDetailsScript.substring(0, personDetailsScript.length - 1)
            break;
        }
    }

    if (personDetailsScript) {
        const personDetails = JSON.parse(personDetailsScript);

        if (isNonEmptyField(personDetails, "PersonFacts")) {
            extractPersonFacts(profiledata, personDetails["PersonFacts"]);

            if (exists(profiledata["death"])) {
                deathdtflag = true;
            }

            if (exists(profiledata["burial"])) {
                for (const burialData in profiledata["burial"]) {
                    if (isNonEmptyField(burialData, "location")) {
                        buriallcflag = true;
                    }
                    if (isNonEmptyField(burialData, "date")) {
                        burialdtflag = true;
                    }
                }
            }
        }

        if (isNonEmptyField(personDetails, "ResearchFamily")) {
            for (const familyCategory in personDetails.ResearchFamily) {
                for (const familyMember in personDetails.ResearchFamily[familyCategory]) {
                    extractPersonFamilyMember(profiledata, familyCategory, familyMember);
                }
            }
        }


    }

    // else {
        // Preivious behavior
        // var usercard = parsed.find(".factsSection").find(".userCardTitle");
        // if (usercard.length == 0) {
        //     usercard = parsed.find("#toggleNameAndGenderButton").next().find(".userCardTitle");
        // }
        //
        // for (var i = 0; i < usercard.length; i++) {
        //     var entry = $(usercard[i]);
        //     var titlename = entry.text();
        //
        //     if (titlename.contains(" — ")) {
        //         var tsplit = titlename.split(" — ");
        //         titlename = tsplit[1].trim();
        //     }
        //
        //     var encodetitle = encodeURIComponent(titlename);
        //     if (encodetitle.contains("%20%E2%80%94%20")) {
        //         var splittitle = encodetitle.split("%20%E2%80%94%20");
        //         titlename = splittitle[1];
        //     }
        //     if (titlename === "Birth") {
        //         var data = parseAncestryNewDate(entry.next());
        //         if (!$.isEmptyObject(data)) {
        //             profiledata["birth"] = data;
        //         }
        //     } else if (titlename === "Death") {
        //         var data = parseAncestryNewDate(entry.next());
        //         if (!$.isEmptyObject(data)) {
        //             if (exists(getDate(data))) {
        //                 deathdtflag = true;
        //             }
        //             profiledata["death"] = data;
        //         }
        //     } else if (titlename === "Baptism") {
        //         var data = parseAncestryNewDate(entry.next());
        //         if (!$.isEmptyObject(data)) {
        //             profiledata["baptism"] = data;
        //         }
        //     } else if (titlename === "Burial") {
        //         var data = parseAncestryNewDate(entry.next());
        //         if (!$.isEmptyObject(data)) {
        //             if (exists(getDate(data))) {
        //                 burialdtflag = true;
        //             }
        //             if (exists(getLocation(data))) {
        //                 buriallcflag = true;
        //             }
        //             profiledata["burial"] = data;
        //         }
        //     } else if (titlename === "Gender") {
        //         var gen = entry.next().text().toLowerCase();
        //         if (isMale(gen) || isFemale(gen)) {
        //             genderval = gen;
        //         }
        //     } else if (familymembers && titlename === "Marriage") {
        //         var data = parseAncestryNewDate(entry.next());
        //         var mid = parseAncestryNewId(entry.next().next().find("a").attr("href"));
        //         if (!$.isEmptyObject(data) && exists(mid)) {
        //             ancestrymrglist.push({
        //                 "id": mid,
        //                 "event": data
        //             });
        //         }
        //     } else if (!familymembers && titlename === "Marriage" && exists(relation.title) && isPartner(relation.title)) {
        //         var url = entry.next().next().find("a").attr("href");
        //         if (exists(url)) {
        //             var sid = parseAncestryNewId(url);
        //             if (sid === focusURLid) {
        //                 var data = parseAncestryNewDate(entry.next());
        //                 if (!$.isEmptyObject(data)) {
        //                     profiledata["marriage"] = data;
        //                 }
        //             }
        //         }
        //
        //     } else if (!familymembers && titlename === "Marriage" && exists(relation.title) && isParent(relation.title)) {
        //         var url = entry.next().next().find("a").attr("href");
        //         if (exists(url)) {
        //             var sid = parseAncestryNewId(url);
        //             if (parentmarriageid === "") {
        //                 parentmarriageid = sid;
        //             } else if (sid !== parentmarriageid) {
        //                 var data = parseAncestryNewDate(entry.next());
        //                 if (!$.isEmptyObject(data)) {
        //                     profiledata["marriage"] = data;
        //                 }
        //             }
        //         }
        //     }
        // }
        // }

    if (!exists(profiledata["death"]) && parsed.find(".factDeath").text() === "Living") {
        profiledata["alive"] = true;
    }

    if (!familymembers && isPartner(relation.title) && !exists(profiledata["marriage"])) {
        for (var i = 0; i < ancestrymrglist.length; i++) {
            if (ancestrymrglist[i].id === relation.itemId) {
                profiledata["marriage"] = ancestrymrglist[i].event;
                break;
            }
        }
    }
    profiledata["name"] = focusperson;
    profiledata["gender"] = genderval;
    profiledata["status"] = relation.title;

    var usrimg = par.find("gmi");

    if (usrimg.length > 1) {
        var image = $(usrimg[1]).attr("src");
    }

    if (exists(image) && !image.endsWith("puy35qab_original.jpg") && !image.startsWith("data")) {
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
    var siblingparents = [];
    var familydata = parsed.find(".familySection");
    var memberfam = familydata.find("h3");
    var memberfam2 = familydata.find(".toggleSiblings");
    if (memberfam2.length > 0) {
        $(memberfam2[0]).html("siblings " + $(memberfam2[0]).html());
        memberfam.push.apply(memberfam, memberfam2);
    }

    for (var i = 0; i < memberfam.length; i++) {
        var headtitle = $(memberfam[i]).text().toLowerCase();
        if (headtitle.startsWith("siblings")) {
            headtitle = "siblings";
            var person = $(memberfam[i]).find("a");
        } else {
            var person = $(memberfam[i]).next().find("a");
        }

        for (var x = 0; x < person.length; x++) {
            var title = headtitle;
            var url = $(person[x]).attr("href");
            if (title === "spouse & children" || title === "spouse and children") {
                if ($(person[x]).find('h4').length === 1) {
                    title = "spouse";
                } else {
                    title = "child";
                }
            }

            if (exists(url)) {
                var itemid = parseAncestryNewId(url);
                if (familymembers) {
                    var name = $(person[x]).find(".userCardTitle").text();
                    getAncestryNewTreeFamily(famid, itemid, name, title, url);
                    famid++;
                } else if (exists(relation.title)) {
                    if (isChild(relation.title)) {
                        if (isParent(title)) {
                            if (focusURLid !== itemid) {
                                childlist[relation.proid] = $.inArray(itemid, unionurls);
                                profiledata["parent_id"] = $.inArray(itemid, unionurls);
                            }
                        }
                    } else if (isSibling(relation.title)) {
                        if (isParent(title)) {
                            siblingparents.push(itemid);
                        }
                    }
                }
            }
        }
    }
    if (exists(relation.title) && isSibling(relation.title) && siblingparents.length > 0) {
        profiledata["halfsibling"] = !recursiveCompare(parentlist, siblingparents);
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

function isNonEmptyField(obj, field) {
    return obj.hasOwnProperty(field) && obj[field] !== "";
}

function parseAncestryPersonCardDate(profileData, personCard, fieldName) {
    let dateField = fieldName + "Date";
    let placeField = fieldName + "Place";
    parseAncestryDate(profileData, personCard, fieldName, dateField, placeField);
}


function parseAncestryPersonFactDate(profileData, obj, fieldName) {
    let dateField = "Date";
    let placeField = "Place";
    parseAncestryDate(profileData, obj, fieldName, dateField, placeField);
}


function parseAncestryDate(profileData, obj, fieldName, dateField, placeField) {
    let data = [];
    if (isNonEmptyField(obj, dateField)) {
        let date = cleanDate(obj[dateField].trim());
        if (date !== "") {
            data.push({
                date: date
            });
        }
    }

    if (isNonEmptyField(obj, placeField)) {
        let place = obj[placeField].trim();
        if (place !== "") {
            data.push({
                id: geoid,
                location: place
            });
            geoid++;
        }
    }

    if (data.length > 0) {
        profileData[fieldName] = data;
    }
}


function parseAncestryNewDate(vitalinfo) {
    var data = [];
    var dmatch = vitalinfo.find(".factItemDate").text();
    if (exists(dmatch)) {
        dateval = cleanDate(dmatch.trim());
        if (dateval !== "") {
            data.push({
                date: dateval
            });
        }
    }
    var lmatch = vitalinfo.find(".factItemLocation").text();
    if (exists(lmatch)) {
        var eventlocation = lmatch.trim().replace(/^in/, "").trim();
        if (eventlocation !== "") {
            data.push({
                id: geoid,
                location: eventlocation
            });
            geoid++;
        }
    }
    return data;
}

function parseAncestryNewId(url) {
    if (!exists(url)) {
        return null;
    }
    return url.substring(url.lastIndexOf('/') + 1);
}


function getAncestryNewTreeFamily(famid, itemid, name, title, url) {
    var gendersv = "unknown";
    var halfsibling = false;
    if (title === "half siblings") {
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
    if (isParent(title)) {
        parentlist.push(itemid);
    } else if (isPartner(title)) {
        myhspouse.push(famid);
    }
    familystatus.push(famid);
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url,
        variable: subdata
    }, function(response) {
        var arg = response.variable;
        var person = parseAncestryNew(response.source, false, {
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
    });
}
