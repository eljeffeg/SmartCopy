// Parse FindMyPast
registerCollection({
    "reload": false,
    "experimental": true,
    "recordtype": "FindMyPast Genealogy",
    "prepareUrl": function(url) {
        if (startsWithHTTP(url, "http://tree.findmypast.com/#/trees/") && !url.endsWith("/all-people")){
            if (!url.endsWith("/profile")) {
                url = url.replace("/family", "/profile");
                url = url.replace("/facts-events", "/profile");
                url = url.replace("/relations", "/profile");
                url = url.replace("/media", "/profile");
                url = url.replace("/notes", "/profile");
                url = url.replace("/hints", "/profile");
                url = url.replace("/pedigree", "/profile");
                url = url.replace("/immediate", "/profile");
                this.reload = true;
            }
        } else {
            document.querySelector('#loginspinner').style.display = "none";
            setMessage(warningmsg, 'Unable to read the profile data.  Please select a Profile page on the site.');
            return;
        }
        return url;
    },
    "collectionMatch": function(url) {
        return (startsWithHTTP(url,"http://tree.findmypast.com/"));
    },
    "parseData": function(url) {
        var shorturl = url.replace("/profile", "");
        focusURLid = shorturl.substring(shorturl.lastIndexOf('/') + 1);
        getPageCode();
    },
    "loadPage": function(request) {
        var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        var treefocus = parsed.find(".tree-focus-nav").find("a");
        focusrange =  $(treefocus[1]).find("span").text();
        focusname = $(treefocus[1]).text().replace(focusrange, "").trim();
    },
    "parseProfileData": parseFindMyPast
});

function parseFindMyPast(htmlstring, familymembers, relation) {
    relation = relation || "";
    var parsed = $(htmlstring.replace(/<img /ig,"<gmi "));

    var title = parsed.filter('title').text();
    var treefocus = parsed.find(".tree-focus-nav").find("a");
    if (relation.title === "father") {
        console.log(htmlstring);
    }


    var focusdaterange = $(treefocus[1]).find("span").text();
    var focusperson = $(treefocus[1]).text().replace(focusdaterange, "").trim();
    if (focusperson === "" && relation !== "") {
        focusperson = relation.name;
    }

    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;
    var genderval = "unknown";
    var aboutdata = "";
    var profiledata = {};
    var imageflag = false;

    if (relation !== "") {
        if (isMale(relation.title)) {
            genderval = "male";
        } else if (isFemale(relation.title)) {
            genderval = "female";
        } else if (relation.gender !== "unknown") {
            genderval = relation.gender;
        } else if (isPartner(relation.title)) {
            genderval = reverseGender(focusgender);
        }
    }

    document.getElementById("readstatus").innerHTML = escapeHtml(focusperson);

    var timeline = parsed.find(".timeline").find("li");

    // ---------------------- Profile Data --------------------

    for (var i=0;i<timeline.length; i++) {
        var event = timeline[i];
        var title = $(event).text().trim();

        if (title.toLowerCase().startsWith("born")) {
            profiledata["birth"] = parseFMPEvent("born", event);
        } else if (title.toLowerCase().contains("baptised")) {
            profiledata["baptism"] = parseFMPEvent("baptised", event);
        } else if (title.toLowerCase().startsWith("died")) {
            profiledata["death"] = parseFMPEvent("died", event);
        } else if (title.toLowerCase().contains("buried")) {
            profiledata["burial"] = parseFMPEvent("buried", event);
        } else if (title.toLowerCase().contains("married")) {
            //skip
        } else {

        }
    }

    profiledata["name"] = focusperson;
    profiledata["gender"] = genderval;
    profiledata["status"] = relation.title;

    if (familymembers) {
        loadGeniData();
        var famid = 0;
    }

    // ---------------------- Family Data --------------------
    var fperson = $(parsed).find(".profile-relatives").find("a");

    for (var i=0; i<fperson.length; i++) {
        if (exists($(fperson[i]).attr("data-pid"))) {
            var title = $(fperson[i]).attr("tree-node-relationship");
            if (exists(title)) {
                title = title.toLowerCase();
                if (familymembers) {
                    if (isParent(title) || isSibling(title) || isChild(title) || isPartner(title)) {
                        var itemid = $(fperson[i]).attr("data-pid");
                        var url = tablink.replace(focusURLid, itemid);
                        var name = $(fperson[i]).find("h2").text();
                        var genderval = "unknown";
                        var genimg = $(fperson[i]).find("gmi").attr("src");
                        if (genimg.endsWith("icon_male.png")) {
                            genderval = "male";
                        } else if (genimg.endsWith("icon_female.png")) {
                            genderval = "female";
                        }
                        console.log(url);
                        if (exists(url)) {
                            if (!exists(alldata["family"][title])) {
                                alldata["family"][title] = [];
                            }
                            var subdata = {name: name, title: title, gender: genderval};
                            subdata["url"] = url;
                            subdata["itemId"] = itemid;
                            subdata["profile_id"] = famid;
                            if (isParent(title)) {
                                parentlist.push(itemid);
                            } else if (isPartner(title)) {
                                myhspouse.push(famid);
                            }
                            unionurls[famid] = itemid;
                            getFMPFamily(famid, url, subdata);
                            famid++;
                        }
                    }
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

function parseFMPEvent(title, event) {
    var eventsplit = $.map($(event).text().trim().split("\n"), $.trim);
    var dmatch = [];
    for (var i=0; i < eventsplit.length; i++) {
        if (eventsplit[i].contains(title + " on ")) {
            var split1 = eventsplit[i].replace(/\.$/, "").split(title + " on ");
            dmatch = split1[1].split(" in ");
            break;
        } else if (eventsplit[i].contains(title + " in ")) {
            var split1 = eventsplit[i].replace(/\.$/, "").split(title + " in ");
            dmatch = split1[1].split(" in ");
            break;
        }
    }
    var data = [];
    if (dmatch.length > 0) {
        var dateval = cleanDate(dmatch[0].trim());
        if (dateval !== "") {
            dateval = dateval.replace(/ at age.*/, "");
            data.push({date: dateval});
        }
        if (exists(dmatch[1])) {
            var eventlocation = dmatch[1].trim();
            if (eventlocation !== "") {
                data.push({id: geoid, location: eventlocation});
                geoid++;
            }
        }
    }
    return data;
}

function getFMPFamily(famid, url, subdata) {
    familystatus.push(famid);
    chrome.extension.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url,
        variable: subdata
    }, function (response) {
        var arg = response.variable;
        var person = parseFindMyPast(response.source, false, {"name": arg.name, "title": arg.title, "gender": arg.gender, "proid": arg.profile_id, "itemId": arg.itemId});
        if (person === "") {
            familystatus.pop();
            return;
        }
        person = updateInfoData(person, arg);
        databyid[arg.profile_id] = person;
        alldata["family"][arg.title].push(person);
        familystatus.pop();
    });
}