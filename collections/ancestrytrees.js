// Parse Ancestry (trees.ancestry.com)
function parseAncestryTrees(htmlstring, familymembers, relation) {
    relation = relation || "";

    var parsed = $(htmlstring.replace(/<img/ig, "<gmi"));
    var focusperson = parsed.find(".pageTitle").text();
    var focusdaterange = "";

    document.getElementById("readstatus").innerHTML = escapeHtml(focusperson);
    var profiledata = {};
    var genderval = "unknown";
    var ctprefix = "ctl43_ctl00_";
    if (!htmlstring.contains(ctprefix)) {
        //Ancestry changed from ctl42 to ctl43, so this checks for an increment
        for (var i = 41; i < 100 ; i++) {
            ctprefix = "ctl" + i + "_ctl00_";
            if (htmlstring.contains(ctprefix)) {
                break;
            }
        }
    }

    var photoclass = parsed.find("#" + ctprefix + "pImg");

    if (photoclass.hasClass("pImgMale")) {
        genderval = "male";
        var image = parsed.find("#" + ctprefix + "profile_picture160").attr("src");
        if (exists(image) && !image.startsWith("data")) {
            profiledata["thumb"] = image;
            profiledata["image"] = image;
        }
    } else if (photoclass.hasClass("pImgFemale")) {
        genderval = "female";
        var image = parsed.find("#" + ctprefix + "profile_picture160").attr("src");
        if (exists(image) && !image.startsWith("data")) {
            profiledata["thumb"] = image;
            profiledata["image"] = image;
        }
    } else {
        photoclass = photoclass.find(".photoSize6");
        if (photoclass.hasClass("iconFemale")) {
            genderval = "female";
        } else if (photoclass.hasClass("iconMale")) {
            genderval = "male";
        }
    }

    profiledata["name"] = focusperson;
    profiledata["gender"] = genderval;
    profiledata["status"] = relation.title;
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;
    var aboutdata = "";
    // ---------------------- Profile Data --------------------

    var birthinfo = parsed.find("#" + ctprefix + "birthDetails");
    var deathinfo = parsed.find("#" + ctprefix + "deathDetails");
    if (exists(birthinfo[0])) {
        var data = parseAncestryTreesDate(birthinfo);
        if (!$.isEmptyObject(data)) {
            profiledata["birth"] = data;
        }
    }
    if (exists(deathinfo[0])) {
        var data = parseAncestryTreesDate(deathinfo);
        if (!$.isEmptyObject(data)) {
            if (exists(getDate(data))) {
                deathdtflag = true;
            }
            profiledata["death"] = data;
        }
    }

    if (relation === "") {
        focusgender = genderval;
    }

    if (familymembers) {
        loadGeniData();
        var famid = 0;
    }

    var parentset = ["father", "mother"];
    var siblingparents = [];
    // ---------------------- Family Data --------------------
    for (var i = 0; i < parentset.length; i++) {
        var pobject = parsed.find("#" + parentset[i] + "Name");
        if (exists(pobject)) {
            var title = parentset[i];
            var url = $(pobject).attr("href");
            if (exists(url)) {
                var itemid = parseAncestryId(url);

                if (familymembers) {
                    var name = $(pobject).text();
                    getAncestryTreeFamily(famid, itemid, name, title);
                    famid++;
                } else if (exists(relation.title) && isChild(relation.title)) {
                    if (focusURLid !== itemid) {
                        childlist[relation.proid] = $.inArray(itemid, unionurls);
                        profiledata["parent_id"] = $.inArray(itemid, unionurls);
                    }
                } else if (exists(relation.title) && isSibling(relation.title)) {
                    siblingparents.push(itemid);
                }
            }

        }
    }

    if (siblingparents.length > 0) {
        profiledata["halfsibling"] = !recursiveCompare(parentlist, siblingparents);
    }

    pobject = parsed.find(".SpouseChild").find("li");
    if (pobject) {
        for (var i = 0; i < pobject.length; i++) {
            if ($(pobject[i]).hasClass("ancCol")) {
                continue;
            }
            var titleinfo = $(pobject[i]).find(".link").attr("id");
            if (exists(titleinfo)) {
                var title = null;
                if (titleinfo.toLowerCase().startsWith("spouse")) {
                    var title = "spouse";
                } else if (titleinfo.toLowerCase().startsWith("child")) {
                    var title = "child";
                }
                if (exists(title)) {
                    var plink = $(pobject[i]).find("a");
                    var url = plink.attr("href");
                    if (exists(url)) {
                        var itemid = parseAncestryId(url);
                        if (familymembers) {
                            var name = $(plink).text();
                            getAncestryTreeFamily(famid, itemid, name, title);
                            famid++;
                        }
                    }
                }
            }
        }
    }

    if (familymembers) {
        var url = tablink + "/overview/familymembers/siblings";
        chrome.extension.sendMessage({
            method: "GET",
            action: "xhttp",
            url: url
        }, function (response) {
            pobject = $(response.source.replace(/<img/ig, "<gmi")).find("a");
            if (pobject) {
                for (var i = 0; i < pobject.length; i++) {
                    var href = $(pobject[i]).attr("href");
                    var itemid = href.substring(href.lastIndexOf('/') + 1);
                    var name = $(pobject[i]).text();
                    var title = "sibling";
                    getAncestryTreeFamily(famid, itemid, name, title);
                    famid++;
                }
            }
        });
    }

    var events = parsed.find(".eventDefinition").find("dl");
    for (var i = 0; i < events.length; i++) {
        var eventstr = $(events[i]).text().trim().toLowerCase();
        if (eventstr.startsWith("baptism")) {
            var data = parseAncestryEventDate(events[i]);
            if (!$.isEmptyObject(data)) {
                profiledata["baptism"] = data;
            }
        } else if (eventstr.startsWith("final resting place")) {
            var data = parseAncestryEventDate(events[i]);
            if (!$.isEmptyObject(data)) {
                if (exists(getDate(data))) {
                    burialdtflag = true;
                }
                if (exists(getLocation(data))) {
                    buriallcflag = true;
                }
                profiledata["burial"] = data;
            }
        } else if (!familymembers && eventstr.startsWith("marriage") && exists(relation.title) && isPartner(relation.title)) {
            var name = $(events[i]).find("a").text();
            if (exists(name)) {
                name = name.replace(/Marriage to /i, "").trim();
                if (name === focusname) {
                    var data = parseAncestryEventDate(events[i]);
                    if (!$.isEmptyObject(data)) {
                        profiledata["marriage"] = data;
                    }
                }
            }

        } else if (!eventstr.startsWith("birth") && !eventstr.startsWith("death")) {
            var name = $(events[i]).find("a").text();
            var data = parseAncestryEventDate(events[i]);
            var age = $(events[i]).find(".eventAge").text().trim();
            var edata = "";
            if (!$.isEmptyObject(data)) {
                if (exists(getDate(data))) {
                    edata += "(" + getDate(data);
                    if (!(exists(age) && age !== "")) {
                        edata += ") "
                    } else {
                        edata += " ";
                    }
                }
                if (exists(age) && age !== "") {
                    if (!exists(getDate(data))) {
                        edata += "(";
                    }
                    edata += age + ") ";
                }
                if (exists(getLocation(data))) {
                    edata += getLocation(data) + " ";
                }
            }
            if (edata !== "") {
                aboutdata += "\n* " + name + ": " + edata.trim();
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

function parseAncestryEventDate(vitalinfo) {
    var data = [];
    var vmatch = null;
    var dmatch = $(vitalinfo).find(".eventDay").text();
    var ymatch = $(vitalinfo).find(".eventYear").text();
    if (dmatch.startsWith("-")) {
        vmatch = ymatch + dmatch;
    } else {
        vmatch = dmatch + " " + ymatch;
    }
    if (exists(vmatch)) {
        var dateval = vmatch.replace(",", "").replace(".", "").trim();
        if (dateval !== "") {
            data.push({date: dateval});
        }
    }
    var eventlocation = $(vitalinfo).find(".eventPlace").text();
    if (exists(eventlocation) && eventlocation !== "") {
        data.push({location: eventlocation});
    }
    return data;
}

function parseAncestryTreesDate(vitalinfo) {
    var data = [];
    var dmatch = $(vitalinfo).find(".date").text();
    if (exists(dmatch)) {
        var dateval = dmatch.replace(",", "").replace(".", "").trim();
        dateval = cleanDate(dateval);
        if (dateval !== "") {
            data.push({date: dateval});
        }
    }
    var lmatch = $(vitalinfo).find(".place").text();
    if (exists(lmatch)) {
        var eventlocation = lmatch.trim().replace(/^in/, "").trim();
        if (eventlocation !== "") {
            data.push({id: geoid, location: eventlocation});
            geoid++;
        }
    }
    return data;
}

function parseAncestryId(url) {
    return url.substring(url.lastIndexOf(",") + 1, url.lastIndexOf(")"));
}


function getAncestryTreeFamily(famid, itemid, name, title) {
    var urlroot = tablink.substring(0, tablink.lastIndexOf('/') + 1);
    var url = urlroot + itemid;
    var gendersv = "unknown";
    var subdata = {name: name, title: title, gender: gendersv, url: url, itemId: itemid, profile_id: famid};
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
    chrome.extension.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url,
        variable: subdata
    }, function (response) {
        var arg = response.variable;
        var person = parseAncestryTrees(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
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