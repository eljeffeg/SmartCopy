registerCollection({
    "recordtype": "Find A Grave Memorial",
    "prepareUrl": function(url) {
        return url;
    },
    "collectionMatch": function(url) {
        return (startsWithHTTP(url, "https://www.findagrave.com") ||
            startsWithHTTP(url, "https://findagrave.com") ||
            startsWithHTTP(url, "https://forum.findagrave.com"));
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
        var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        var fperson = parsed.find("#bio-name");
        focusname = getFindAGraveName($(fperson[0]).html()).trim();
        var title = parsed.filter('title').text().replace(" - Find A Grave Memorial", "");
        if (title.contains("(")) {
            splitrange = title.split("(");
            focusrange = splitrange[1];
            focusrange = focusrange.replace(")", "").trim();
        }
    },
    "parseProfileData": parseFindAGrave
});


// Parse FindAGrave
function parseFindAGrave(htmlstring, familymembers, relation) {
    relation = relation || "";
    var parsed = $(htmlstring.replace(/<img[^>]*>/ig,""));
    var focusdaterange = "";
    var title = parsed.filter('title').text().replace(" - Find A Grave Memorial", "");
    if (title.contains("(")) {
        splitrange = title.split("(");
        focusdaterange = splitrange[1];
        focusdaterange = focusdaterange.replace(")","").trim();
    }
    var fperson = parsed.find(".plus2").find("b");
    if (!exists(fperson[0])) {
        //In case the Memorial has been merged
        fperson = parsed.find("#bio-name");
        if (exists(fperson[0]) && $(fperson[0]).html() === "Memorial has been merged.") {
            var click = $(fperson[0]).next('table').find('a');
            var urlset = click[0].outerHTML.match('href="(.*)"');
            var url = "";
            if (exists(urlset) && exists(urlset[1])) {
                url = hostDomain(tablink) + urlset[1];
                familystatus.push(familystatus.length);
                chrome.runtime.sendMessage({
                    method: "GET",
                    action: "xhttp",
                    url: url,
                    variable: relation
                }, function (response) {
                    var arg = response.variable;
                    var person = parseFindAGrave(response.source, familymembers, response.variable);
                    person = updateInfoData(person, arg);
                    databyid[arg.profile_id] = person;
                    alldata["family"][arg.title].push(person);
                    familystatus.pop();
                });
            }
            return "";
        }
    }
    var focusperson = getFindAGraveName($(fperson[0]).html()).trim();
    $("#readstatus").html(escapeHtml(focusperson));
    var genderval = "unknown";
        if (focusperson.contains("(born")) {
            genderval = "female";
        }
    if (relation === "") {
        focusgender = genderval;
    } else if (exists(relation.genderval) && genderval === "unknown") {
        genderval = relation.genderval
    }
    var aboutdata = "";
    var profiledata = {name: focusperson, gender: genderval, status: relation.title};

    if (familymembers) {
        loadGeniData();
    }

    // ---------------------- Profile Data --------------------
    if (focusdaterange !== "") {
        profiledata["daterange"] = focusdaterange;
    }
    
    abouttemp = parsed.find("#fullBio").html();
    if (exists(abouttemp)) {
        aboutdata = $($.parseHTML(abouttemp.replace(/<br>/g, "\n"))).text().trim();
    }
    profiledata = addEvent(profiledata, "birth", parsed.find("#birthDateLabel").text(), parsed.find("#birthLocationLabel").text());
    profiledata = addEvent(profiledata, "baptism", parsed.find("#baptismDateLabel").text(), parsed.find("#baptismLocationLabel").text());
    profiledata = addEvent(profiledata, "death", parsed.find("#deathDateLabel").text(), parsed.find("#deathLocationLabel").text());
    cemetery = parsed.find("#burialLocationLabel").text();
    if (cemetery === "") {
        cemetery = parsed.find("#cemeteryNameLabel").text();
        placeinfo = parsed.find("#cemeteryNameLabel").closest("div").next();
        cemeteryplace = [];
        if (placeinfo.length > 0) {
            cemeteryplace = placeinfo[0].childNodes;
        }
        if (cemeteryplace.length > 0) {
            cemetery += ", ";
        }
        for (var i = 0; i < cemeteryplace.length; i++) {
            item = $(cemeteryplace[i]).text().trim();
            if (item === ",") {
                item += " ";
            }
            cemetery += item;
        }
    }
    profiledata = addEvent(profiledata, "burial", parsed.find("#burialDateLabel").text(), cemetery.trim());
    
    // ---------------------- Family Data --------------------
    var start = htmlstring.indexOf('paId: "') + 7;
    var parentstrings = htmlstring.substring(start, start+50);
    var pid = parentstrings.substring(0, parentstrings.indexOf('"'));
    start = htmlstring.indexOf('maId: "') + 7;
    parentstrings = htmlstring.substring(start, start+50);
    var mid = parentstrings.substring(0, parentstrings.indexOf('"'));

    if (!familymembers && (isNaN(parseInt(pid)) || isNaN(parseInt(mid)))) {
        var familyquery = parsed.find(".member-family");
        for (var i = 0; i < familyquery.length; i++) {
            var title = $(familyquery[i]).prev().text().toLowerCase();
            if (isParent(title)) {
                var group = $(familyquery[i]).find(".name");
                for (var x = 0; x < group.length; x++) {
                    var url = $(group[x]).attr("href");
                    if (exists(url)) {
                        var itemid = getFAGID(url);
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
        var famid = 0;
        var familyquery = parsed.find(".member-family");
        for (var i = 0; i < familyquery.length; i++) {
            var title = $(familyquery[i]).prev().text().toLowerCase();
            if (exists(title)) {
                if (title === "half siblings") {
                    title = "siblings";
                }
                var group = $(familyquery[i]).find(".name");
                for (var x = 0; x < group.length; x++) {
                    var url = $(group[x]).attr("href");
                    if (exists(url)) {
                        var itemid = getFAGID(url);
                        var name = NameParse.fix_case(url.substring(url.lastIndexOf('/') + 1).replace("-", " "));
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
                        var subdata = {name: name, title: title, genderval: genderval};
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
        var siblingparents = [];

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
    var imagedata = parsed.find("#profileImage");
    if (exists(imagedata[0])) {
        var thumb = $(imagedata[0]).attr( "src" );
        if (startsWithHTTP(thumb, "http://image") || thumb.contains("find-a-grave-prod/photos")) {
            var image = thumb.replace("photos250/", "");
            profiledata["thumb"] = thumb;
            profiledata["image"] = image;
            var credit = parsed.find("#main-photo").next().find("a");
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
    var personborn = focusperson.match("\<i\>(.*)\</i\>");
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
        data.push({id: geoid, location: eventlocation});
        geoid++;
    }
    if (!$.isEmptyObject(data)) {
        profiledata[event] = data;
    }
    return profiledata;
}

function getFAGID(url) {
    var fagid = url.substring(url.lastIndexOf('memorial/') + 9).replace("#", "");
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
        var arg = response.variable;
        var person = parseFindAGrave(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
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