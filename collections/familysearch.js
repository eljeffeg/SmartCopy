// Parse FamilySearch
function parseFamilySearch(htmlstring, familymembers, relation) {
    relation = relation || "";
    var parsed = $(htmlstring.replace(/<img/ig, "<gmi"));
    var focusdaterange = "";

    var fname = parsed.find('.name');
    var focusperson = parseFamilyName($(fname[0]).text());

    document.getElementById("readstatus").innerText = focusperson;

    var genderval = "unknown";
    var profiledata = {name: focusperson, gender: genderval, status: relation.title};
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;
    var aboutdata = "";
    var ftable = parsed.find(".facts");
    if (!exists(ftable[0])) {
        return {};
    }

    var fperson = $(ftable[0]).find(".factLabel");
    // ---------------------- Profile Data --------------------
    for (var i = 0; i < fperson.length; i++) {
        var row = $(fperson[i]).text();
        if (exists(row) && row.length > 1) {
            var fieldname = row.toLowerCase().trim();
            if (fieldname.startsWith("gender:")) {
                genderval = $($(fperson[i]).next("td")).text();
                profiledata["gender"] = genderval;
            } else if (fieldname.startsWith("birth:")) {
                var data = parseFamilyDate($($(fperson[i]).next("td")).html());
                if (!$.isEmptyObject(data)) {
                    profiledata["birth"] = data;
                }
            } else if (fieldname.startsWith("death:")) {
                var data = parseFamilyDate($($(fperson[i]).next("td")).html());
                if (!$.isEmptyObject(data)) {
                    if (exists(data.date)) {
                        deathdtflag = true;
                    }
                    profiledata["death"] = data;
                }
            } else if (fieldname.startsWith("christening:") || fieldname.startsWith("baptism:")) {
                var data = parseFamilyDate($($(fperson[i]).next("td")).html());
                if (!$.isEmptyObject(data)) {
                    profiledata["baptism"] = data;
                }
            } else if (fieldname.startsWith("burial:")) {
                var data = parseFamilyDate($($(fperson[i]).next("td")).html());
                if (!$.isEmptyObject(data)) {
                    if (exists(data.date)) {
                        burialdtflag = true;
                    }
                    if (exists(data.location)) {
                        buriallcflag = true;
                    }
                    profiledata["burial"] = data;
                }
            } else if (fieldname === "note") {
                if ($($(fperson[i]).next("td")).text() !== "") {
                    if (aboutdata !== "") {
                        aboutdata += '\n';
                    }
                    aboutdata += $($(fperson[i]).next("td")).text();
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
        for (var x = 1; x < ftable.length; x++) {
            var fperson = $(ftable[x]).find(".factLabel");
            for (var i = 0; i < fperson.length; i++) {
                var row = $(fperson[i]).text();
                if (exists(row) && row.length > 1) {
                    var fieldname = row.toLowerCase().trim();
                    if (fieldname.startsWith("father:")) {
                        processFamilySearch($(fperson[i]).next("td"), "father", famid);
                        famid++;
                    } else if (fieldname.startsWith("mother:")) {
                        processFamilySearch($(fperson[i]).next("td"), "mother", famid);
                        famid++;
                    } else if (fieldname.startsWith("spouse:")) {
                        var data = [];
                        var spouse = $(fperson[i]).next("td");
                        i++;
                        if (exists(fperson[i]) && $(fperson[i]).text().toLowerCase().startsWith("marriage")) {
                            data = parseFamilyDate($(fperson[i]).next("td").html());
                        }
                        processFamilySearch(spouse, "spouse", famid, data);
                        myhspouse.push(famid);
                        famid++;
                    } else if (fieldname.startsWith("child")) {
                        processFamilySearch($(fperson[i]).next("td"), "child", famid);
                        famid++;
                    }
                }
            }
        }
    } else if (isParent(relation.title)) {
        if (parentmarriageid === "") {
            parentmarriageid = relation.itemId;
        } else if (relation.itemId !== parentmarriageid) {
            for (var x = 1; x < ftable.length; x++) {
                var fperson = $(ftable[x]).find(".factLabel");
                for (var i = 0; i < fperson.length; i++) {
                    var row = $(fperson[i]).text();
                    if (exists(row) && row.length > 1) {
                        var fieldname = row.toLowerCase().trim();
                        if (fieldname.startsWith("spouse:")) {
                            var url = $($(fperson[i]).next("td")).find("a").attr("href");
                            if (exists(url)) {
                                url = url.replace("?view=details", "").replace("?view=basic", "");
                                var itemid = url.substring(url.lastIndexOf('/') + 1);
                                if (itemid === parentmarriageid) {
                                    i++;
                                    if (exists(fperson[i]) && $(fperson[i]).text().toLowerCase().startsWith("marriage")) {
                                        profiledata["marriage"] = parseFamilyDate($(fperson[i]).next("td").html());
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } else if (isChild(relation.title)) {
        for (var x = 1; x < ftable.length; x++) {
            var fperson = $(ftable[x]).find(".factLabel");
            for (var i = 0; i < fperson.length; i++) {
                var row = $(fperson[i]).text();
                if (exists(row) && row.length > 1) {
                    var fieldname = row.toLowerCase().trim();
                    if (fieldname.startsWith("father:") || fieldname.startsWith("mother:")) {
                        var url = $($(fperson[i]).next("td")).find("a").attr("href");
                        if (exists(url)) {
                            url = url.replace("?view=details", "").replace("?view=basic", "");
                            var itemid = url.substring(url.lastIndexOf('/') + 1);
                            if (focusURLid !== itemid) {
                                childlist[relation.proid] = $.inArray(itemid, unionurls);
                                profiledata["parent_id"] = $.inArray(itemid, unionurls);
                                break;
                            }
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
        var data = [];
        var dd = profiledata["death"][0]["date"];
        if (dd.startsWith("Between")) {
            var btsplit = dd.split(" and ");
            if (btsplit.length > 1) {
                dd = btsplit[1];
            }
        }
        if (dd.startsWith("After Circa") || dd.startsWith("Circa After")) {
            dd = dd.trim();
        } else if (dd.startsWith("After")) {
            dd = dd.replace("After", "After Circa").trim();
        } else if (dd.startsWith("Before Circa") || dd.startsWith("Circa Before")) {
            dd = dd.trim();
        } else if (dd.startsWith("Before")) {
            dd = dd.replace("Before", "Before Circa").trim();
        } else if (dd.startsWith("Circa")) {
            dd = "After " + dd.trim();
        } else if (!dd.startsWith("Between")) {
            dd = "After Circa " + dd.trim();
        }
        if (!dd.startsWith("Between")) {
            data.push({date: dd});
            data.push(profiledata["burial"][0]);
            profiledata["burial"] = data;
        }
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


function parseFamilyDate(vitalstring) {

    var data = [];
    var dmatch = vitalstring.replace(/<a .*?<\/a>/g, "").split("<br>");
    if (exists(dmatch) && dmatch.length > 0) {
        var dateval = cleanHTML(dmatch[0]).trim();
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
        if (dateval !== "") {
            data.push({date: dateval});
        }
    }
    if (exists(dmatch) && dmatch.length > 1) {
        var eventlocation = cleanHTML(dmatch[1]).trim();
        if (eventlocation !== "") {
            data.push({id: geoid, location: eventlocation});
            geoid++;
        }
    }
    return data;
}

function parseFamilyName(focusperson) {
    if (focusperson.match(/\s\/\w+\//g,'')) {
        focusperson = focusperson.replace(/\//g, "");
    }
    return focusperson;
}

function getFamilySearch(famid, url, subdata) {
    familystatus.push(famid);
    chrome.extension.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url,
        variable: subdata
    }, function (response) {
        var arg = response.variable;
        var person = parseFamilySearch(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
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

function processFamilySearch(person, title, famid, data) {
    var url = $(person).find("a").attr("href");
    if (exists(url)) {
        url = url.replace("?view=details", "");
        url += "?view=basic";
        if (!exists(alldata["family"][title])) {
            alldata["family"][title] = [];
        }

        var gendersv = "unknown";
        if (isFemale(title)) {
            gendersv = "female";
        } else if (isMale(title)) {
            gendersv = "male";
        } else if (isPartner(title)) {
            gendersv = reverseGender(focusgender);
        }
        var name = parseFamilyName($(person).find("a").text());
        var itemid = url.substring(url.lastIndexOf('/') + 1).replace("?view=basic", "");
        var subdata = {name: name, title: title, gender: gendersv, url: url, itemId: itemid, profile_id: famid};
        if (!$.isEmptyObject(data)) {
            subdata["marriage"] = data;
        }
        unionurls[famid] = itemid;
        getFamilySearch(famid, url, subdata);
    }
}