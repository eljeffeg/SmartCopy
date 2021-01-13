// Parse Ancestry (person.ancestry.com & trees.ancestry.com)
registerCollection({
    "reload": false,
    "recordtype": "Ancestry Genealogy",
    "prepareUrl": function(url) {
        if (startsWithHTTP(url,"http://trees.ancestry.") || url.contains("/family-tree/tree/")) {
            if (url.endsWith("/family") || url.endsWith("/family/familyview") || url.endsWith("/family/pedigree")) {
                document.querySelector('#loginspinner').style.display = "none";
                setMessage(warningmsg, 'SmartCopy was unable to identify the Ancestry focus profile.  Please select a focus profile in the tree.');
                return;
            } else {
                url = url.replace("/family/", "/");
                url = url.replace("family?fpid=", "person/");
                url = url.replace("family?cfpid=", "person/");
                url = url.replace("pedigree?fpid=", "person/");
                url = url.replace("pedigree?cfpid=", "person/");
                if (!url.endsWith("/facts")) {
                     url += "/facts";
                }
                url = url.replace("trees.ancestry.", "person.ancestry.");
                url = url.replace("&selnode=1", "");
                url = url.replace("/community/potential", "");
                if (isNaN(url.slice(-1))) {
                    url = url.substring(0, url.lastIndexOf('/'));
                }
                this.reload = true;
            }
        } else if (startsWithHTTP(url,"http://person.ancestry.") || url.contains("/family-tree/person/")) {
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
        return (startsWithHTTP(url,"http://person.ancestry.") || startsWithHTTP(url,"http://trees.ancestry.") || (startsWithHTTP(url,"http://www.ancestry.") && url.contains("/family-tree/")));
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
            setMessage(warningmsg, 'SmartCopy can work with the various country-based sites of Ancestry, but you must first sign into the main english website.<br/><a href="http://www.ancestry.com/" target="_blank">Please login to Ancestry.com</a>');
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
    var usercard = parsed.find("#researchListFacts").find(".userCardTitle");
    if (usercard.length == 0) {
        usercard = parsed.find("#toggleNameAndGenderButton").next().find(".userCardTitle");
    }

    for (var i = 0; i < usercard.length; i++) {
        var entry = $(usercard[i]);
        var titlename = entry.text();

        if (titlename.contains(" — ")) {
            var tsplit = titlename.split(" — ");
            titlename = tsplit[1].trim();
        }

        var encodetitle = encodeURIComponent(titlename);
        if (encodetitle.contains("%20%E2%80%94%20")) {
            var splittitle = encodetitle.split("%20%E2%80%94%20");
            titlename = splittitle[1];
        }
        if (titlename === "Birth") {
            var data = parseAncestryNewDate(entry.next());
            if (!$.isEmptyObject(data)) {
                profiledata["birth"] = data;
            }
        } else if (titlename === "Death") {
            var data = parseAncestryNewDate(entry.next());
            if (!$.isEmptyObject(data)) {
                if (exists(getDate(data))) {
                    deathdtflag = true;
                }
                profiledata["death"] = data;
            }
        } else if (titlename === "Baptism") {
            var data = parseAncestryNewDate(entry.next());
            if (!$.isEmptyObject(data)) {
                profiledata["baptism"] = data;
            }
        } else if (titlename === "Burial") {
            var data = parseAncestryNewDate(entry.next());
            if (!$.isEmptyObject(data)) {
                if (exists(getDate(data))) {
                    burialdtflag = true;
                }
                if (exists(getLocation(data))) {
                    buriallcflag = true;
                }
                profiledata["burial"] = data;
            }
        } else if (titlename === "Gender") {
            var gen = entry.next().text().toLowerCase();
            if (isMale(gen) || isFemale(gen)) {
                genderval = gen;
            }
        } else if (familymembers && titlename === "Marriage") {
            var data = parseAncestryNewDate(entry.next());
            var mid = parseAncestryNewId(entry.next().next().find("a").attr("href"));
            if (!$.isEmptyObject(data) && exists(mid)) {
                ancestrymrglist.push({"id": mid, "event": data});
            }
        } else if (!familymembers && titlename === "Marriage" && exists(relation.title) && isPartner(relation.title)) {
            var url = entry.next().next().find("a").attr("href");
            if (exists(url)) {
                var sid = parseAncestryNewId(url);
                if (sid === focusURLid) {
                    var data = parseAncestryNewDate(entry.next());
                    if (!$.isEmptyObject(data)) {
                        profiledata["marriage"] = data;
                    }
                }
            }

        } else if (!familymembers && titlename === "Marriage" && exists(relation.title) && isParent(relation.title)) {
            var url = entry.next().next().find("a").attr("href");
            if (exists(url)) {
                var sid = parseAncestryNewId(url);
                if (parentmarriageid === "") {
                    parentmarriageid = sid;
                } else if (sid !== parentmarriageid) {
                    var data = parseAncestryNewDate(entry.next());
                    if (!$.isEmptyObject(data)) {
                        profiledata["marriage"] = data;
                    }
                }
            }
        }
    }

    if (!exists(profiledata["death"]) && parsed.find(".factDeath").text() === "Living") {
        profiledata["alive"] = true;
    }

    if (!familymembers && isPartner(relation.title) && !exists(profiledata["marriage"])) {
        for (var i=0;i<ancestrymrglist.length;i++) {
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
    var memberfam = familydata.find(".factsSubtitle");
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
            if (title === "spouse & children") {
                if ($(person[x]).prop('outerHTML').contains("ResearchSpouse")) {
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


function parseAncestryNewDate(vitalinfo) {
    var data = [];
    var dmatch = vitalinfo.find(".factItemDate").text();
    if (exists(dmatch)) {
        dateval = cleanDate(dmatch.trim());
        if (dateval !== "") {
            data.push({date: dateval});
        }
    }
    var lmatch = vitalinfo.find(".factItemLocation").text();
    if (exists(lmatch)) {
        var eventlocation = lmatch.trim().replace(/^in/, "").trim();
        if (eventlocation !== "") {
            data.push({id: geoid, location: eventlocation});
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
    var subdata = {name: name, title: title, halfsibling: halfsibling, gender: gendersv, url: url, itemId: itemid, profile_id: famid};
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
    }, function (response) {
        var arg = response.variable;
        var person = parseAncestryNew(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
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