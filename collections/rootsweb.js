// Parse RootsWeb
registerCollection({
    "reload": false,
    "recordtype": "RootsWeb's WorldConnect",
    "experimental": true,
    "prepareUrl": function(url) {
        if (getParameterByName("op", url).toLowerCase() === "ped") {
            url = url.replace(/op=PED/i, "op=GET");
            reload = true;
        }
        return url;
    },
    "collectionMatch": function(url) {
        return (startsWithHTTP(url, "http://worldconnect.rootsweb.ancestry.com/") || startsWithHTTP(url, "http://wc.rootsweb.ancestry.com/"));
    },
    "parseData": function(url) {
        if (!url.toLowerCase().contains("op=") || !url.toLowerCase().contains("id=")) {
            document.querySelector('#loginspinner').style.display = "none";
            setMessage(warningmsg, 'Please select one of the Profile pages on this site.');
        } else {
            focusURLid = getParameterByName('id', url);
            getPageCode();
        }
    },
    "loadPage": function(request) {
        var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        var fperson = parsed.find("li");
        focusname = parseRootsName(fperson);
        focusrange = "";
    },
    "parseProfileData": parseRootsWeb
});

function parseRootsWeb(htmlstring, familymembers, relation) {
    relation = relation || "";
    var parseid = "";
    if (relation === "") {
        parseid = focusURLid;
    } else {
        parseid = relation.itemId;
    }
    var htmlarray = htmlstring.split('id="' + parseid + '"');
    var parsed = $(htmlarray[0].replace(/<img/ig, "<gmi"));
    var focusdaterange = "";
    var title = parsed.filter('title').text();

    var fperson = parsed.find("li");
    var focusperson = parseRootsName(fperson);
    $("#readstatus").html(escapeHtml(focusperson));
    var genderval = "unknown";
    var profiledata = {name: focusperson, gender: genderval, status: relation.title};
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;
    var aboutdata = "";
    // ---------------------- Profile Data --------------------
    for (var i = 0; i < fperson.length; i++) {
        var row = parseRootsRow(fperson[i]);
        if (exists(row) && row.length > 1) {
            var fieldname = row[0].toLowerCase().trim();
            if (fieldname == "sex") {
                var sexval = row[1].toLowerCase().trim();
                if (sexval === "f") {
                    genderval = "female";
                } else if (sexval === "m") {
                    genderval = "male";
                }
                profiledata["gender"] = genderval;
            } else if (fieldname === "birth") {
                var data = parseRootsDate(row[1]);
                if (!$.isEmptyObject(data)) {
                    profiledata["birth"] = data;
                }
            } else if (fieldname === "death") {
                var data = parseRootsDate(row[1]);
                if (!$.isEmptyObject(data)) {
                    if (exists(getDate(data))) {
                        deathdtflag = true;
                    }
                    profiledata["death"] = data;
                }
            } else if (fieldname === "christening") {
                var data = parseRootsDate(row[1]);
                if (!$.isEmptyObject(data)) {
                    profiledata["baptism"] = data;
                }
            } else if (fieldname === "burial") {
                var data = parseRootsDate(row[1]);
                if (!$.isEmptyObject(data)) {
                    if (exists(getDate(data))) {
                        burialdtflag = true;
                    }
                    if (exists(getLocation(data))) {
                        buriallcflag = true;
                    }
                    profiledata["burial"] = data;
                }
            } else if (fieldname === "note") {
                if (exists(row[1]) && row[1].trim() !== "") {
                    if (aboutdata.trim() !== "") {
                        aboutdata += '\n';
                    }
                    aboutdata += row[1];
                }
            } else if (fieldname === "change date") {
                //break;
                //Caused a problem with these pages: http://wc.rootsweb.ancestry.com/cgi-bin/igm.cgi?op=GET&db=swissvol&id=I2905
                //looking for father, mother, married instead
            } else if (fieldname === "father") {
                break;
            } else if (fieldname === "mother") {
                break;
            } else if (fieldname === "married") {
                break;
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

    if (htmlarray.length > 1) {
        parsed = $("<div " + htmlarray[1].replace(/<img/ig, "<gmi"));
    }

    // ---------------------- Family Data --------------------
    if (familymembers) {
        for (var i = 0; i < parsed.length; i++) {
            var ptext = $(parsed[i]).text().trim();
            if (ptext !== "") {
                if (ptext.startsWith("Father") || ptext.startsWith("Mother")) {
                    var title = "";
                    if (ptext.startsWith("Father")) {
                        title = "father";
                    } else {
                        title = "mother";
                    }
                    if (!exists(alldata["family"][title])) {
                        alldata["family"][title] = [];
                    }
                    var entry = $(parsed[i]).next("a");
                    var url = hostDomain(tablink) + entry.attr("href");
                    var name = parseNameString(entry.text().trim());
                    var itemid = getParameterByName("id", url);
                    var subdata = {name: name, title: title};
                    subdata["url"] = url;
                    subdata["itemId"] = itemid;
                    subdata["profile_id"] = famid;
                    parentlist.push(itemid);
                    unionurls[famid] = itemid;
                    getRootFamily(famid, url, subdata);
                    famid++;
                } else if (ptext.startsWith("Marriage")) {
                    var title = "spouse";
                    if (!exists(alldata["family"][title])) {
                        alldata["family"][title] = [];
                    }
                    var entry = $(parsed[i]).next("a");
                    if (exists(entry) && entry.length > 0) {
                        var url = hostDomain(tablink) + entry.attr("href");
                        var name = parseNameString(entry.text().trim());
                        var itemid = getParameterByName("id", url);
                        var subdata = {name: name, title: title};
                        var daterow = parseRootsRow(entry.next("ul"));
                        if (daterow.length > 1) {
                            var data = parseRootsDate(daterow[1]);
                            if (!$.isEmptyObject(data)) {
                                subdata["marriage"] = data;
                            }
                        }
                        subdata["url"] = url;
                        subdata["itemId"] = itemid;
                        subdata["profile_id"] = famid;
                        unionurls[famid] = itemid;
                        myhspouse.push(famid);
                        getRootFamily(famid, url, subdata);
                        famid++;
                    }
                } else if (ptext.startsWith("Children")) {
                    var title = "child";
                    if (!exists(alldata["family"][title])) {
                        alldata["family"][title] = [];
                    }
                    var children = $(parsed[i]).next("ol").find("a");
                    for (var c = 0; c < children.length; c++) {
                        var entry = $(children[c]);
                        var url = hostDomain(tablink) + entry.attr("href");
                        var name = parseNameString(entry.text().trim());
                        var itemid = getParameterByName("id", url);
                        var subdata = {name: name, title: title};
                        subdata["url"] = url;
                        subdata["itemId"] = itemid;
                        subdata["profile_id"] = famid;
                        unionurls[famid] = itemid;
                        getRootFamily(famid, url, subdata);
                        famid++;
                    }
                }
            }
        }
    } else if (isParent(relation.title)) {
        if (parentmarriageid === "") {
            parentmarriageid = relation.itemId;
        } else if (relation.itemId !== parentmarriageid) {
            for (var i = 0; i < parsed.length; i++) {
                var ptext = $(parsed[i]).text().trim();
                if (ptext !== "" && ptext.startsWith("Marriage")) {
                    var entry = $(parsed[i]).next("a");
                    var url = hostDomain(tablink) + entry.attr("href");
                    var itemid = getParameterByName("id", url);
                    if (itemid === parentmarriageid) {
                        var daterow = parseRootsRow(entry.next("ul"));
                        if (daterow.length > 1) {
                            var data = parseRootsDate(daterow[1]);
                            if (!$.isEmptyObject(data)) {
                                profiledata["marriage"] = data;
                            }
                        }
                    }
                }
            }
        }
    } else if (isChild(relation.title)) {
        for (var i = 0; i < parsed.length; i++) {
            var ptext = $(parsed[i]).text().trim();
            if (ptext !== "") {
                if (ptext.startsWith("Father") || ptext.startsWith("Mother")) {
                    var entry = $(parsed[i]).next("a");
                    var url = hostDomain(tablink) + entry.attr("href");
                    var itemid = getParameterByName("id", url);
                    if (focusURLid !== itemid) {
                        childlist[relation.proid] = $.inArray(itemid, unionurls);
                        profiledata["parent_id"] = $.inArray(itemid, unionurls);
                        break;
                    }
                }
            }
        }
    } else if (isSibling(relation.title)) {
        var siblingparents = [];
        for (var i = 0; i < parsed.length; i++) {
            var ptext = $(parsed[i]).text().trim();
            if (ptext !== "") {
                if (ptext.startsWith("Father") || ptext.startsWith("Mother")) {
                    var entry = $(parsed[i]).next("a");
                    var url = hostDomain(tablink) + entry.attr("href");
                    var itemid = getParameterByName("id", url);
                    siblingparents.push(itemid);
                }
            }
        }
        if (siblingparents.length > 0) {
            profiledata["halfsibling"] = !recursiveCompare(parentlist, siblingparents);
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

function getRootFamily(famid, url, subdata) {
    familystatus.push(famid);
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url,
        variable: subdata
    }, function (response) {
        var arg = response.variable;
        var person = parseRootsWeb(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
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

function parseRootsName(fperson) {
    var focusperson = "";
    var surname = "";
    var givenname = "";
    var mname = "";
    for (var i = 0; i < fperson.length; i++) {
        var row = parseRootsRow(fperson[i]);
        if (exists(row) && row.length > 1) {
            var fieldname = row[0].toLowerCase().trim();
            if (fieldname == "name" && focusperson === "") {
                focusperson = parseNameString(row[1].trim());
            } else if (fieldname == "surname") {
                surname = row[1].trim();
            } else if (fieldname == "given name") {
                givenname = row[1].trim();
            } else if (fieldname == "_marnm") {
                mname = row[1].trim();
            } else if (fieldname === "change date") {
                break;
            }
        }
    }
    if (givenname !== "" && surname !== "") {
        if (mname !== "") {
            focusperson = givenname + " " + mname + " (born " + surname + ")";
        } else {
            focusperson = givenname + " " + surname;
        }
    }
    return focusperson;
}

function parseNameString(focusperson) {
    var surname = focusperson.match(/^[A-Z]*/);
    if (exists(surname) && surname.length > 0 && surname[0].length > 1) {
        focusperson = focusperson.replace(surname[0], "").trim() + " " + NameParse.fix_case(surname[0]);
    } else {
        var focussplit = focusperson.split(" ");
        for (var i = 0; i < focussplit.length; i++) {
            focussplit[i] = NameParse.fix_case(focussplit[i]);
        }
        focusperson = focussplit.join(" ");
    }
    return focusperson;
}

function parseRootsDate(vitalstring) {
    var data = [];
    var datesplit = [];
    if (vitalstring.contains("\n")) {
        var splitvital = vitalstring.split("\n");
        if (splitvital.length > 1 && splitvital[1].startsWith(" in ")) {
            vitalstring = splitvital[0] + splitvital [1];
        } else {
            vitalstring = splitvital[0];
        }
    }
    var vitalinfo = vitalstring.replace(/Quality:.*/i, "").trim();
    if (vitalinfo.toLowerCase() === "y") {
        return data;
    }
    if (vitalinfo.startsWith("in ")) {
        datesplit[0] = "";
        datesplit[1] = vitalinfo.replace(/^in /, "");
    } else if (vitalinfo.contains(" in ")) {
        datesplit = vitalinfo.split(" in ");
    } else if (vitalinfo.toLowerCase().startsWith("bet") || vitalinfo.toLowerCase().startsWith("btw") ||
        vitalinfo.toLowerCase().startsWith("est") || vitalinfo.toLowerCase().startsWith("abt") ||
        vitalinfo.toLowerCase().startsWith("bef") || vitalinfo.toLowerCase().startsWith("aft")) {
        datesplit[0] = vitalinfo;
    } else {
        var verifydate = moment(vitalinfo, getDateFormat(vitalinfo), true).isValid();
        if (!verifydate) {
            var i = vitalinfo.substr(i).search(/\d{4}/);
            if (i == -1 || vitalstring.length < i + 5) {
                datesplit = ["", vitalinfo ];
            } else {
                datesplit = [ vitalinfo.substr(0, i + 4).trim(), vitalinfo.substr(i + 4).trim() ];
            }
        } else {
            datesplit = [vitalinfo, "" ];
        }
    }

    if (datesplit.length > 0) {
        var dateval = datesplit[0].trim();
        dateval = cleanDate(dateval);
        if (dateval !== "") {
            data.push({date: dateval});
        }
        if (datesplit.length > 1) {
            var eventlocation = datesplit[1].trim();
            if (eventlocation !== "") {
                data.push({id: geoid, location: eventlocation});
                geoid++;
            }
        }
    }
    return data;
}

function parseRootsRow(fperson) {
    var rowdata = $(fperson).html();
    var strArr = [];
    if (exists(rowdata)) {
        rowdata = rowdata.replace(/<br>/ig, "\n").replace(/Quality:.*/i, "").trim();

        rowdata = cleanHTML(rowdata);
        var i = rowdata.indexOf(":");

        if (i == -1) {
            strArr = [ rowdata ];
        } else {
            strArr = [ rowdata.substr(0, i).trim(), rowdata.substr(i + 1).trim() ];
        }
    }
    return strArr;
}