registerCollection({
    "recordtype": "Find A Grave Memorial",
    "prepareUrl": function(url) {
        return url;
    },
    "collectionMatch": function(url) {
        return (startsWithHTTP(url, "https://www.findagrave.com") ||
            startsWithHTTP(url, "https://findagrave.com") ||
            startsWithHTTP(url, "https://forum.findagrave.com")||startsWithHTTP(url, "https://fr.findagrave.com")); //TODO filter with all lang prefix
    },
    "parseData": function(url) {
        if (url.contains("page=gsr")) {
            document.querySelector('#loginspinner').style.display = "none";
            setMessage(warningmsg, 'Please select one of the Matches on this results page.');
        } else {
            focusURLid = getFAGID(url);
            getPageCode();
        }
    },
    "loadPage": function(request) {
        let parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        let fperson = parsed.find("#bio-name");
        focusname = getFindAGraveName($(fperson[0]).html()).trim();
        let title = parsed.filter('title').text().replace(" - Find A Grave Memorial", "");
        if (title.contains("(")) {
            splitrange = title.split("(");
            focusrange = splitrange[1];
            focusrange = focusrange.replace(")", "").trim();
        }
    },
    "parseProfileData": parseFindAGrave
});
const regsaut = /[\r\n\t]+/g ;

// Parse FindAGrave
function parseFindAGrave(htmlstring, familymembers, relation) {
    relation = relation || "";
    let parsed = $(htmlstring.replace(/<img[^>]*>/ig,""));
    let focusdaterange = "";
    let title = parsed.filter('title').text().replace(" - Find A Grave Memorial", "");
    if (title.contains("(")) {
        splitrange = title.split("(");
        focusdaterange = splitrange[1];
        focusdaterange = focusdaterange.replace(")","").trim();
    }
    let fperson = parsed.find(".plus2").find("b");
    if (!exists(fperson[0])) {
        //In case the Memorial has been merged
        fperson = parsed.find("#bio-name");
        if (exists(fperson[0]) && $(fperson[0]).html() === "Memorial has been merged.") {
            let click = $(fperson[0]).next('table').find('a');
            let urlset = click[0].outerHTML.match('href="(.*)"');
            let url = "";
            if (exists(urlset) && exists(urlset[1])) {
                url = hostDomain(tablink) + urlset[1];
                familystatus.push(familystatus.length);
                chrome.runtime.sendMessage({
                    method: "GET",
                    action: "xhttp",
                    url: url,
                    variable: relation
                }, function (response) {
                    let arg = response.variable;
                    let person = parseFindAGrave(response.source, familymembers, response.variable);
                    person = updateInfoData(person, arg);
                    databyid[arg.profile_id] = person;
                    alldata["family"][arg.title].push(person);
                    familystatus.pop();
                });
            }
            return "";
        }
    }
    let focusperson = getFindAGraveName($(fperson[0]).html()).trim();
    $("#readstatus").html(escapeHtml(focusperson));
    let genderval = "unknown";
        if (focusperson.contains("(born")) {
            genderval = "female";
        }
    if (relation === "") {
        focusgender = genderval;
    } else if (exists(relation.genderval) && genderval === "unknown") {
        genderval = relation.genderval
    }
    let aboutdata = "";
    let profiledata = {name: focusperson, gender: genderval, status: relation.title};

    if (familymembers) {
        loadGeniData();
    }

    // ---------------------- Profile Data --------------------
    if (focusdaterange !== "") {
        profiledata["daterange"] = focusdaterange;
    }
    
    let abouttemp = parsed.find("#fullBio").html();
    if (exists(abouttemp)) {
        aboutdata = $($.parseHTML(abouttemp.replace(/<br>/g, "\n"))).text().trim();
    }
        profiledata = addEvent(profiledata, "birth", parsed.find("#birthDateLabel").text(), parsed.find("#birthLocationLabel").text().replace(regsaut, '').trim());
    profiledata = addEvent(profiledata, "baptism", parsed.find("#baptismDateLabel").text(), parsed.find("#baptismLocationLabel").text().replace(regsaut, '').trim());
    profiledata = addEvent(profiledata, "death", parsed.find("#deathDateLabel").text(), parsed.find("#deathLocationLabel").text().replace(regsaut, '').trim());
    let cemetery = parsed.find("#burialLocationLabel").text().replace(regsaut, '').trim();
    if (cemetery === "") {
        cemetery = parsed.find("#cemeteryNameLabel").text();
        let placeinfo = parsed.find("#cemeteryNameLabel").closest("div").next();
        let cemeteryplace = [];
        if (placeinfo.length > 0) {
            cemeteryplace = placeinfo[0].childNodes;
        }
        if (cemeteryplace.length > 0) {
            cemetery += ", ";
        }
        for (let i = 0; i < cemeteryplace.length; i++) {
            let item = $(cemeteryplace[i]).text().trim();
            if (item === ",") {
                item += " ";
            }
            if (item !== "Add to Map" && !item.includes("Show Map")) {
                cemetery += item;
            }
        }
    }
    profiledata = addEvent(profiledata, "burial", parsed.find("#burialDateLabel").text(), cemetery.trim());
    
    // ---------------------- Family Data --------------------
    let pid = "";
    let mid = "";
    let parentstrings = parsed.find("#parentsLabel").next().find("a");
    for (const element of parentstrings) {
        let parentstr = $(element).attr("href").replace("/memorial/", "").split("/")[0];
        if (isNaN(parseInt(pid))) {
            pid = parentstr;
        } else if (isNaN(parseInt(mid))) {
            mid = parentstr;
        }
    }

    if (!familymembers && (isNaN(parseInt(pid)) || isNaN(parseInt(mid)))) {
        let familyquery = parsed.find(".member-family");
        for (let i = 0; i < familyquery.length; i++) {
            let title = $(familyquery[i]).prev().text().toLowerCase();
            if (isParent(title)) {
                let group = $(familyquery[i]).find(".name");
                for (let x = 0; x < group.length; x++) {
                    let url = $(group[x]).attr("href");
                    if (exists(url)) {
                        let itemid = getFAGID(url);
                        if (isNaN(parseInt(pid))) {
                            pid = itemid;
                        } else if (isNaN(parseInt(mid)) && pid != itemid) {
                            mid = itemid;
                        }
                    }
                }
            }
        }
    }

    if (familymembers) {
        let famid = 0;
        let familyquery = parsed.find(".member-family");
        for (let i = 0; i < familyquery.length; i++) {
            let title = $(familyquery[i]).prev().text().toLowerCase();
            if (exists(title)) {
                if (title === "half siblings") {
                    title = "siblings";
                }
                let group = $(familyquery[i]).find('a');
                for (let x = 0; x < group.length; x++) {
                    let url = $(group[x]).attr("href");
                    if (exists(url)) {
                        let itemid = getFAGID(url);
                        let name = NameParse.fix_case(url.substring(url.lastIndexOf('/') + 1).replace(/-/g, " "));
                        if (!exists(alldata["family"][title])) {
                            alldata["family"][title] = [];
                        }

                        if (isParent(title)) {
                            if (itemid === pid) {
                                genderval = "male";
                            } else if (itemid === mid) {
                                genderval = "female";
                            }
                            if (isNaN(parseInt(pid))) {
                                pid = itemid;
                            } else if (isNaN(parseInt(mid)) && pid != itemid) {
                                mid = itemid;
                            }
                        }
                        let subdata = {name: name, title: title, genderval: genderval};
                        if (!url.startsWith("http")) {
                            url = "https://www.findagrave.com" + url;
                        }
                        subdata["url"] = url;
                        subdata["itemId"] = itemid;
                        subdata["profile_id"] = famid;
                        if (isParent(title)) {
                            parentlist.push(itemid);
                        } else if (isPartner(title)) {
                            myhspouse.push(famid);
                        }
                        unionurls[famid] = itemid;
                        getFindAGraveFamily(famid, url, subdata);
                        famid++;
                    }
                }
            }
        }
    } else if (isChild(relation.title)) {
        if (pid !== undefined && focusURLid !== pid) {
            childlist[relation.proid] = $.inArray(pid, unionurls);
            profiledata["parent_id"] = $.inArray(pid, unionurls);

        } else if (mid !== undefined && focusURLid !== mid) {
            childlist[relation.proid] = $.inArray(mid, unionurls);
            profiledata["parent_id"] = $.inArray(mid, unionurls);
        }
    } else if (isSibling(relation.title)) {
        let siblingparents = [];

        if (pid !== "") {
            siblingparents.push(pid);
        }
        if (mid !== "") {
            siblingparents.push(mid);
        }
        if (siblingparents.length > 0) {
            profiledata["halfsibling"] = !recursiveCompare(parentlist, siblingparents);
        }
    }




    // ---------------------- Profile Continued --------------------
    parsed = $(htmlstring.replace(/<img/ig,"<gmi"));

    profiledata["alive"] = false; //assume deceased
    let imagedata = parsed.find("#profileImage");
    if (exists(imagedata[0])) {
        let thumb = $(imagedata[0]).attr( "src" );
        if (startsWithHTTP(thumb, "https://images") || thumb.contains("find-a-grave-prod/photos")) {
            let image = thumb.replace("photos250/", "");
            profiledata["thumb"] = thumb;
            profiledata["image"] = image;
            let credit = parsed.find("#main-photo").next().find("a");
            if (credit.length > 1) {
                profiledata["imagecredit"] = $(credit).text().trim().replace('"', '').replace("'", "");
            }
        }
    }

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

function getFindAGraveName(focusperson) {
    focusperson = focusperson.split("\<b class")[0].trim(); //filter veteran from name
    let personborn = focusperson.match("\<i\>(.*)\</i\>");
    if (exists(personborn) && exists(personborn[0])) {
        focusperson = focusperson.replace(personborn[0], "");
        focusperson = focusperson + " (born " + personborn[1] + ")";
    }
    focusperson = focusperson.replace(/(<([^>]+)>)/ig, "");
    return focusperson;
}

function addEvent(profiledata, event, dateval, eventlocation) {
    data = []
    if (exists(dateval) && dateval.contains(" (")) {
        dateval = dateval.split(" (")[0];
    }
    dateval = cleanDate(dateval);
    if (dateval !== "unknown" && dateval !== "") {
        data.push({date: dateval});
    }
    if (eventlocation !== "") {
        eventlocation = eventlocation.replace(regsaut, '').trim();
        data.push({id: geoid, location: eventlocation});
        geoid++;
    }
    if (!$.isEmptyObject(data)) {
        profiledata[event] = data;
    }
    return profiledata;
}

function getFAGID(url) {
    let fagid = url.substring(url.lastIndexOf('memorial/') + 9).replace("#", "");
    if (fagid.contains("/")) {
        fagid = fagid.substring(0, fagid.indexOf('/'));
    }
    return fagid;
}


function getFindAGraveFamily(famid, url, subdata) {
    familystatus.push(famid);
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url,
        variable: subdata
    }, function (response) {
        let arg = response.variable;
        let person = parseFindAGrave(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
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
