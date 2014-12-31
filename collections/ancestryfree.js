// Parse Ancestry Free Records
function parseAncestryFree(htmlstring, familymembers, relation) {
    relation = relation || "";

    var parsed = $(htmlstring.replace(/<img/ig, "<gmi"));
    var focusperson = parsed.filter('title').text().trim();
    var focusdaterange = "";
    var frange = parsed.find(".pageCrumb");
    for (var i = 0; i < frange.length; i++) {
        if ($(frange[i]).text().startsWith(focusperson)) {
            var fsplit = $(frange[i]).text().split("(");
            if (fsplit.length > 1) {
                focusdaterange = fsplit[1].replace(")", "").trim();
            }
            break;
        }
    }

    document.getElementById("readstatus").innerText = focusperson;

    var genderval = "unknown";
    var photoclass = parsed.find(".personPhoto ");

    if (photoclass.hasClass("iconMale")) {
        genderval = "male";
    } else if (photoclass.hasClass("iconFemale")) {
        genderval = "female";
    }

    var profiledata = {name: focusperson, gender: genderval, status: relation.title};
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;
    var aboutdata = "";
    // ---------------------- Profile Data --------------------
    var fperson = parsed.find(".personSummary");
    if (exists(fperson[0])) {
        var fsplit = $(fperson[0]).html().replace(/<a .*?<\/a>/g, "").split(".");
        for (var i = 0; i < fsplit.length; i++) {
            if (fsplit[i].contains("Born")) {
                var data = parseAncestryFreeDate(fsplit[i]);
                if (!$.isEmptyObject(data)) {
                    profiledata["birth"] = data;
                }
            } else if (fsplit[i].contains("passed away")) {
                if (genderval === "unknown") {
                    if (fsplit[i].startsWith("He")) {
                        genderval = "male";
                    } else if (fsplit[i].startsWith("She")) {
                        genderval = "female";
                    }
                }
                var data = parseAncestryFreeDate(fsplit[i]);
                if (!$.isEmptyObject(data)) {
                    if (exists(data.date)) {
                        deathdtflag = true;
                    }
                    profiledata["death"] = data;
                }
            }
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
    if (familymembers) {
        var person;
        person = parsed.find(".personFather");
        if (exists(person[0])) {
            processAncestryFamily(person[0], "father", famid);
            famid++;
        }
        person = parsed.find(".personMother");
        if (exists(person[0])) {
            processAncestryFamily(person[0], "mother", famid);
            famid++;
        }
        person = parsed.find(".personSpouses").find("li");
        if (exists(person[0])) {
            for (var i = 0; i < person.length; i++) {
                processAncestryFamily(person[i], "spouse", famid);
                myhspouse.push(famid);
                famid++;
            }
        }
        person = parsed.find(".personChildren").find("li");
        if (exists(person[0])) {
            for (var i = 0; i < person.length; i++) {
                processAncestryFamily(person[i], "child", famid);
                famid++;
            }
        }
    } else if (isParent(relation.title)) {
        if (parentmarriageid === "") {
            parentmarriageid = relation.itemId;
        } else if (relation.itemId !== parentmarriageid) {
            //TODO - Not sure if this Marriage information is provided
        }
    } else if (isChild(relation.title)) {
        var person;
        var url;
        var itemid;
        person = parsed.find(".personFather");
        if (exists(person[0])) {
            url = $(person[0]).find("a").attr("href");
            itemid = getParameterByName("pid", url);
        }
        if (exists(itemid) && focusURLid !== itemid) {
            childlist[relation.proid] = $.inArray(itemid, unionurls);
            profiledata["parent_id"] = $.inArray(itemid, unionurls);
        } else {
            person = parsed.find(".personMother");
            if (exists(person[0])) {
                url = $(person[0]).find("a").attr("href");
                itemid = getParameterByName("pid", url);
                childlist[relation.proid] = $.inArray(itemid, unionurls);
                profiledata["parent_id"] = $.inArray(itemid, unionurls);
            }
        }
    } else if (isSibling(relation.title)) {
        var siblingparents = [];
        var person;
        var url;
        var itemid;
        person = parsed.find(".personFather");
        if (exists(person[0])) {
            url = $(person[0]).find("a").attr("href");
            itemid = getParameterByName("pid", url);
            siblingparents.push(itemid);
        }
        person = parsed.find(".personMother");
        if (exists(person[0])) {
            url = $(person[0]).find("a").attr("href");
            itemid = getParameterByName("pid", url);
            siblingparents.push(itemid);
        }
        if (siblingparents.length > 0) {
            profiledata["halfsibling"] = !recursiveCompare(parentlist, siblingparents);
        }
    }


    // ---------------------- Profile Data --------------------
    if (focusdaterange !== "") {
        profiledata["daterange"] = focusdaterange;
    }

    if (aboutdata !== "") {
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

function processAncestryFamily(person, title, famid) {
    var url = $(person).find("a").attr("href");
    if (exists(url)) {
        if (!exists(alldata["family"][title])) {
            alldata["family"][title] = [];
        }
        var genderimg = $(person).find(".photo");
        var gendersv = "unknown";
        if (isFemale(title) || genderimg.hasClass("iconFemale")) {
            gendersv = "female";
        } else if (isMale(title) || genderimg.hasClass("iconMale")) {
            gendersv = "male";
        }
        var name = $(person).find(".name").text();
        var itemid = getParameterByName("pid", url);
        if (isParent(title)) {
            parentlist.push(itemid);
        }
        var subdata = {name: name, title: title, gender: gendersv, url: url, itemId: itemid, profile_id: famid};
        unionurls[famid] = itemid;
        getAncestryFreeFamily(famid, url, subdata);
    }
}

function parseAncestryFreeDate(vitalstring) {

    var data = [];
    var dmatch = vitalstring.match(/on <b>(.*?)<\/b>/);
    if (exists(dmatch)) {
        var dateval = dmatch[1].trim();
        dateval = dateval.replace(/ABT/i, "Circa");
        dateval = dateval.replace(/BEF/i, "Before");
        dateval = dateval.replace(/AFT/i, "After");
        dateval = dateval.replace(/BET/i, "Between");
        dateval = dateval.replace(/BTW/i, "Between");

        if (dateval.contains(" to ")) {
            dateval = dateval.replace(" to ", " and ");
            if (!dateval.startsWith("Between")) {
                dateval = "Between " + dateval;
            }
        } else if (dateval.contains("-")) {
            dateval = dateval.replace("-", " and ");
            if (!dateval.startsWith("Between")) {
                dateval = "Between " + dateval;
            }
        }
        dateval = dateval.replace(/\d{2}\//,"");
        if (dateval !== "") {
            data.push({date: dateval});
        }
    }
    var lmatch = vitalstring.match(/in <b>(.*?)<\/b>/);
    if (exists(lmatch)) {
        var eventlocation = lmatch[1].trim();
        if (eventlocation !== "") {
            data.push({id: geoid, location: eventlocation});
            geoid++;
        }
    }
    return data;
}

function getAncestryFreeFamily(famid, url, subdata) {
    familystatus.push(famid);
    chrome.extension.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url,
        variable: subdata
    }, function (response) {
        var arg = response.variable;
        var person = parseAncestryFree(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
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