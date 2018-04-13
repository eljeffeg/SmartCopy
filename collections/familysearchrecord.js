// Parse FamilySearch Records
registerCollection({
    "reload": false,
    "recordtype": "FamilySearch Record",
    "prepareUrl": function(url) {
        url = url.replace("://www.", "://");
        if (startsWithHTTP(url,"https://familysearch.org/ark:") && url.contains("/1:1:")) {
            var urlparts= url.split('?');
            focusURLid = urlparts[0].substring(url.lastIndexOf(':') + 1);
            url = hostDomain(url) + "/platform/records/personas/" + focusURLid + ".json";
            this.reload = true;
        } else if (startsWithHTTP(url,"https://familysearch.org/ark:") && url.contains("/2:2:")) {
            var urlparts= url.split('?');
            focusURLid = urlparts[0].substring(url.lastIndexOf('/') + 1);
            url = hostDomain(url) + "/platform/genealogies/persons/" + focusURLid + ".json";
            this.reload = true;
        } else if (startsWithHTTP(url,"https://familysearch.org/platform/records/")) {
            focusURLid = url.substring(url.lastIndexOf('/') + 1).replace(".json", "");
        }
        return url;
    },
    "collectionMatch": function(url) {
        url = url.replace("://www.", "://");
        return (
            startsWithHTTP(url, "https://familysearch.org/platform") ||
            startsWithHTTP(url,"https://familysearch.org/search/") ||
            (startsWithHTTP(url,"https://familysearch.org/ark:") && url.contains("/1:1:")) ||
            (startsWithHTTP(url,"https://familysearch.org/ark:") && url.contains("/2:2:"))
            );
    },
    "parseData": function(url) {
        if (startsWithHTTP(url,"https://familysearch.org/search/")) {
            document.querySelector('#loginspinner').style.display = "none";
            setMessage(warningmsg, 'SmartCopy does not work on Search pages.  Please open the <b>Details</b> page for a specific record.');
        } else {
            getPageCode();
        }
    },
    "loadPage": function(request) {
        var parsed = "";
        try {
            parsed = JSON.parse(request.source);
        } catch(err) {
            setMessage(warningmsg, "There was a problem retrieving FamilySearch data.<br>Please verify you are logged in " +
                "<a href='https://familysearch.org' target='_blank'>https://familysearch.org</a>");
            document.getElementById("top-container").style.display = "block";
            document.getElementById("submitbutton").style.display = "none";
            document.getElementById("loading").style.display = "none";
            return;
        }

        var focusperson = getFSRecordName(getFSFocus(parsed, focusURLid));
        if (!focusperson) {
            return;
        }
        if (focusperson.match(/\s\/\w+\//g, '')) {
            focusperson = focusperson.replace(/\//g, "");
        }
        focusname = focusperson;
    },
    "parseProfileData": parseFamilySearchRecord
});

var fsfamid = 0;
function parseFamilySearchRecord(htmlstring, familymembers, relation) {
    relation = relation || "";
    var parsed = null;
    var focusRecord = null;
    var focusRecordId = null;
    var focusrelation = null;
    if ($.type( htmlstring ) === "string") {
        try {
            parsed = JSON.parse(htmlstring);
            if (!exists(parsed)) {
                return "";
            }

            if (familymembers) {
                focusRecord = getFSFocus(parsed, focusURLid);
                focusrelation = getFSRecordRelation(focusRecord);
            } else {
                focusRecord = getFSFocus(parsed, relation.itemId);
            }
            focusRecordId = focusRecord["id"];
        } catch(err) {
            console.log(err);
            setMessage(warningmsg, "There was a problem retrieving FamilySearch data.<br>Please verify you are logged in " +
                "<a href='https://familysearch.org' target='_blank'>https://familysearch.org</a>");
            document.getElementById("top-container").style.display = "block";
            document.getElementById("submitbutton").style.display = "none";
            document.getElementById("loading").style.display = "none";
            return;
        }
    } else {
        focusRecord = htmlstring;
    }

    var profiledata = getFSProfileData(focusRecord, "");

    if (familymembers) {
        loadGeniData();
    }

    if (parsed) {
        for (var i = 0; i < parsed["persons"].length; i++) {
            var person = parsed["persons"][i];
            if (checkNested(person, "links","persona","href") && !person["links"]["persona"]["href"].contains(focusURLid)) {
                var title = relationshipToHead(focusrelation, getFSRecordRelation(person));

                var profileRecordId = person["id"];
                var mdata = [];
                var ddata = [];
                if (title === "notfound" && exists(parsed["relationships"])) {
                    for (var x = 0; x < parsed["relationships"].length; x++) {
                        var rel = parsed["relationships"][x];
                        var p1 = rel["person1"]["resourceId"];
                        var p2 = rel["person2"]["resourceId"];
                        if ((p1 === focusRecordId || p2 === focusRecordId) && (p1 === profileRecordId || p2 === profileRecordId)) {
                            var type = rmGED(rel["type"]);
                            if (type === "couple") {
                                title = "partner";
                                if (checkNested(rel, "facts", 0)) {
                                    for(var y = 0; y < rel["facts"].length; y++) {
                                        if (rmGED(rel["facts"][y]["type"]) === "marriage") {
                                            mdata = parseFSJSONDate(rel["facts"][y]);
                                        } else if (rmGED(rel["facts"][y]["type"]) === "divorce") {
                                            ddata = parseFSJSONDate(rel["facts"][y]);
                                        }
                                    }
                                }
                            } else if (type === "parentchild") {
                                if (profileRecordId === p1) {
                                    title = "parent";
                                } else {
                                    title = "child";
                                }
                            }
                            break;
                        }
                    }
                    if (title === "notfound") {
                        title = "exclude";
                    }
                }
                if (title === "notfound") {
                    title = "unknown";
                }
                if (title !== "exclude") {
                    var itemid = getFSRecordId(person);
                    var pdata = getFSProfileData(person, title);
                    pdata["profile_id"] = fsfamid;
                    pdata["itemId"] = itemid;
                    if (!$.isEmptyObject(mdata)) {
                        pdata["marriage"] = mdata;
                        pdata["mstatus"] = "spouse";
                    }
                    if (!$.isEmptyObject(ddata)) {
                        pdata["divorce"] = ddata;
                        pdata["mstatus"] = "ex-spouse";
                    }
                    if (!exists(alldata["family"][title])) {
                        alldata["family"][title] = [];
                    }
                    if (isParent(title)) {
                        parentlist.push(itemid);
                    }
                    if (isPartner(title)) {
                        myhspouse.push(fsfamid);
                    }
                    unionurls[fsfamid] = itemid;
                    databyid[fsfamid] = pdata;
                    alldata["family"][title].push(pdata);
                    fsfamid++;
                }

            }
            if (checkNested(person, "links","person","href")) {
                if (relation === ""){
                    var title = relationshipToHead(focusrelation, getFSRecordRelation(person));

                    var profileRecordId = person["id"];
                    var mdata = [];
                    var ddata = [];
                    if (title === "notfound" && exists(parsed["relationships"])) {
                        for (var x = 0; x < parsed["relationships"].length; x++) {
                            var rel = parsed["relationships"][x];
                            var url = "";
                            var itemid = "";
                            var p1 = rel["person1"]["resourceId"];
                            var p2 = rel["person2"]["resourceId"];
                            if ((p1 === focusRecordId || p2 === focusRecordId) && (p1 === profileRecordId || p2 === profileRecordId)) {
                                var type = rmGED(rel["type"]);
                                if (type === "couple") {
                                    title = "partner";
                                    if (checkNested(rel, "facts", 0)) {
                                        for(var y = 0; y < rel["facts"].length; y++) {
                                            if (rmGED(rel["facts"][y]["type"]) === "marriage") {
                                                mdata = parseFSJSONDate(rel["facts"][y]);
                                            } else if (rmGED(rel["facts"][y]["type"]) === "divorce") {
                                                ddata = parseFSJSONDate(rel["facts"][y]);
                                            }
                                        }
                                    }
                                    if (profileRecordId !== p1) {
                                        url = rel["person1"]["resource"];
                                        itemid = p1;
                                    } else {
                                        url = rel["person2"]["resource"];
                                        itemid = p2;
                                    }
                                } else if (type === "parentchild") {
                                    if (profileRecordId !== p1) {
                                        title = "parent";
                                        url = rel["person1"]["resource"];
                                        itemid = p1;
                                    } else {
                                        title = "child";
                                        url = rel["person2"]["resource"];
                                        itemid = p2;
                                    }
                                }

                                if (title === "notfound") {
                                    title = "exclude";
                                }

                                if (title !== "exclude" && itemid !== "") {
                                    if (!exists(alldata["family"][title])) {
                                        alldata["family"][title] = [];
                                    }
                                    if (isParent(title)) {
                                        parentlist.push(itemid);
                                    }
                                    if (isPartner(title)) {
                                        myhspouse.push(fsfamid);
                                    }
                                    var gendersv = "unknown";
                                    if (isFemale(title)) {
                                        gendersv = "female";
                                    } else if (isMale(title)) {
                                        gendersv = "male";
                                    } else if (isPartner(title)) {
                                        gendersv = reverseGender(focusgender);
                                    }
                                    var subdata = {title: title, gender: gendersv};
                                    subdata["url"] = url;
                                    subdata["itemId"] = itemid;
                                    subdata["profile_id"] = fsfamid;
                                    unionurls[fsfamid] = itemid;
                                    familystatus.push(fsfamid);
                                    chrome.runtime.sendMessage({
                                        method: "GET",
                                        action: "xhttp",
                                        url: url,
                                        variable: subdata
                                    }, function (response) {
                                        var arg = response.variable;
                                        var person = parseFamilySearchRecord(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
                                        if (person === "") {
                                            familystatus.pop();
                                            return;
                                        }

                                        arg.url = person.url;
                                        person = updateInfoData(person, arg);
                                        databyid[arg.profile_id] = person;
                                        alldata["family"][arg.title].push(person);
                                        familystatus.pop();
                                    });

                                    fsfamid++;

                                }
                            }
                        }

                    }
                } else if (isParent(relation.title)) {
                    if (parentmarriageid === "") {
                        parentmarriageid = relation.itemId;
                    } else if (relation.itemId !== parentmarriageid) {
                        var mdata = [];
                        var ddata = [];
                        if (exists(parsed["relationships"])) {
                            for (var x = 0; x < parsed["relationships"].length; x++) {
                                var rel = parsed["relationships"][x];
                                var type = rmGED(rel["type"]);
                                if (type === "couple") {
                                    var p1 = rel["person1"]["resourceId"];
                                    var p2 = rel["person2"]["resourceId"];
                                    if (p1 === parentmarriageid || p2 === parentmarriageid) {
                                        if (checkNested(rel, "facts", 0)) {
                                            for(var y = 0; y < rel["facts"].length; y++) {
                                                if (rmGED(rel["facts"][y]["type"]) === "marriage") {
                                                    mdata = parseFSJSONDate(rel["facts"][y]);
                                                    if (!$.isEmptyObject(mdata)) {
                                                        profiledata["marriage"] = mdata;
                                                    }
                                                } else if (rmGED(rel["facts"][y]["type"]) === "divorce") {
                                                    ddata = parseFSJSONDate(rel["facts"][y]);
                                                    if (!$.isEmptyObject(ddata)) {
                                                        profiledata["divorce"] = ddata;
                                                    }
                                                }
                                            }
                                        }
                                        break;
                                    }
                                }
                            }

                        }
                    }
                    //This doesn't list sibling relationships - look at child relations of parent
                    for (var x = 0; x < parsed["relationships"].length; x++) {
                        var rel = parsed["relationships"][x];
                        var type = rmGED(rel["type"]);

                        if (type === "parentchild") {
                            var p1 = rel["person1"]["resourceId"];
                            var p2 = rel["person2"]["resourceId"];
                            var url = "";
                            var itemid = "";
                            var title = "";
                            if (relation.itemId !== p1) {
                                title = "parent";
                                url = rel["person1"]["resource"];
                                itemid = p1;
                            } else {
                                title = "child";
                                url = rel["person2"]["resource"];
                                itemid = p2;
                            }

                            if (title === "child" && itemid !== focusURLid && siblinglist.indexOf(itemid) === -1) {
                                siblinglist.push(itemid);
                                if (!exists(alldata["family"]["sibling"])) {
                                    alldata["family"]["sibling"] = [];
                                }

                                var subdata = {title: "sibling"};
                                subdata["url"] = url;
                                subdata["itemId"] = itemid;
                                subdata["profile_id"] = fsfamid;
                                unionurls[fsfamid] = itemid;
                                familystatus.push(fsfamid);
                                chrome.runtime.sendMessage({
                                    method: "GET",
                                    action: "xhttp",
                                    url: url,
                                    variable: subdata
                                }, function (response) {
                                    var arg = response.variable;
                                    var person = parseFamilySearchRecord(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
                                    if (person === "") {
                                        familystatus.pop();
                                        return;
                                    }

                                    arg.url = person.url;
                                    person = updateInfoData(person, arg);
                                    databyid[arg.profile_id] = person;
                                    alldata["family"][arg.title].push(person);
                                    familystatus.pop();
                                });

                                fsfamid++;
                            }
                        }
                    }
                } else if (isPartner(relation.title)) {
                    var mdata = [];
                    var ddata = [];
                    if (exists(parsed["relationships"])) {
                        for (var x = 0; x < parsed["relationships"].length; x++) {
                            var rel = parsed["relationships"][x];
                            var type = rmGED(rel["type"]);
                            if (type === "couple") {
                                var p1 = rel["person1"]["resourceId"];
                                var p2 = rel["person2"]["resourceId"];
                                if (p1 === focusURLid || p2 === focusURLid) {
                                    if (checkNested(rel, "facts", 0)) {
                                        for(var y = 0; y < rel["facts"].length; y++) {
                                            if (rmGED(rel["facts"][y]["type"]) === "marriage") {
                                                mdata = parseFSJSONDate(rel["facts"][y]);
                                                if (!$.isEmptyObject(mdata)) {
                                                    profiledata["marriage"] = mdata;
                                                }
                                            } else if (rmGED(rel["facts"][y]["type"]) === "divorce") {
                                                ddata = parseFSJSONDate(rel["facts"][y]);
                                                if (!$.isEmptyObject(ddata)) {
                                                    profiledata["divorce"] = ddata;
                                                }
                                            }
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                    }
                } else if (isChild(relation.title)) {
                    if (exists(parsed["relationships"])) {
                        for (var x = 0; x < parsed["relationships"].length; x++) {
                            var rel = parsed["relationships"][x];
                            var type = rmGED(rel["type"]);
                            if (type === "parentchild") {
                                var itemid = rel["person1"]["resourceId"];
                                if (relation.itemId !== itemid && itemid !== focusURLid) {
                                    childlist[relation.proid] = $.inArray(itemid, unionurls);
                                    profiledata["parent_id"] = $.inArray(itemid, unionurls);
                                    break;
                                }
                            }
                        }
                    }
                } else if (isSibling(relation.title)) {
                    if (exists(parsed["relationships"])) {
                        var siblingparents = [];
                        for (var x = 0; x < parsed["relationships"].length; x++) {
                            var rel = parsed["relationships"][x];
                            var type = rmGED(rel["type"]);
                            if (type === "parentchild") {
                                var itemid = rel["person1"]["resourceId"];
                                if (relation.itemId !== itemid) {
                                    siblingparents.push(itemid);
                                }
                            }
                        }
                        if (siblingparents.length > 0) {
                            profiledata["halfsibling"] = !recursiveCompare(parentlist, siblingparents);
                        }
                    }
                }
            }

        }
    }


    var obj = alldata["family"];
    for (var relationship in obj) if (obj.hasOwnProperty(relationship)) {
        if (isChild(relationship)) {
            for (var i = 0; i < obj[relationship].length; i++) {
                if (!exists(obj[relationship][i]["parent_id"]) || obj[relationship][i]["parent_id"] === -1) {
                    if (myhspouse.length === 1) {
                        var spouse = myhspouse[0];
                        obj[relationship][i]["parent_id"] = spouse;
                        childlist[obj[relationship][i]["profile_id"]] = spouse;
                    } else {
                        obj[relationship][i]["parent_id"] = -1;
                        childlist[obj[relationship][i]["profile_id"]] = -1;
                    }
                }
            }
        }
    }

    $("#readstatus").text("");
    if (familymembers) {
        alldata["profile"] = profiledata;
        alldata["scorefactors"] = smscorefactors;
        updateGeo();
    }

    return profiledata;
}

function getFSRecordGender(person) {
    if (checkNested(person, "gender","type")) {
        return rmGED(person["gender"]["type"]);
    }
    return "unknown";
}

function getFSFocus(personlist, focus) {
    for (var i = 0; i < personlist["persons"].length; i++) {
        var person = personlist["persons"][i];
        if (checkNested(person, "links","persona","href")) {
            if (person["links"]["persona"]["href"].contains(focus)) {
                return person;
            }
        } else if (checkNested(person, "links","person","href")) {
            if (person["links"]["person"]["href"].contains(focus)) {
                return person;
            }
        }
    }
    return "";
}


function getFSRecordRelation(person) {
    if (checkNested(person, "fields")) {
        for (var i = 0; i < person["fields"].length; i++) {
            var type = rmGED(person["fields"][i]["type"]);
            if (type === "relationshiptohead" && checkNested(person["fields"][i],"values",0,"text")) {
                return person["fields"][i]["values"][0]["text"].toLowerCase();
            }
        }
        for (var i = 0; i < person["fields"].length; i++) {
            var type = rmGED(person["fields"][i]["type"]);
            if (type === "relationshiptoheadcode" && checkNested(person["fields"][i],"values",0,"text")) {
                return person["fields"][i]["values"][0]["text"].toLowerCase();
            }
        }
    }
    return "notfound";
}

function getFSRecordName(person) {
    if (checkNested(person, "names",0,"nameForms",0,"fullText")) {
        return person["names"][0]["nameForms"][0]["fullText"];
    }
    return "";
}

function getFSRecordId(person) {
    if (checkNested(person, "links","persona","href")) {
        var profileid = person["links"]["persona"]["href"];
        profileid = profileid.replace("https://familysearch.org/platform/records/personas/", "").replace(".json", "").trim();
        return profileid;
    } else if (checkNested(person, "links","person","href")) {
        var profileid = person["links"]["person"]["href"];
        profileid = profileid.replace("https://familysearch.org/platform/genealogies/persons/", "").replace(".json", "").trim();
        return profileid;
    }
    return "";
}

function rmGED(ged) {
    if (!exists(ged)) {
        return "";
    }
    return ged.replace("http://gedcomx.org/", "").replace("http://familysearch.org/types/fields/", "").toLowerCase();
}


function checkNested(obj /*, level1, level2, ... levelN*/) {
    var args = Array.prototype.slice.call(arguments, 1);

    for (var i = 0; i < args.length; i++) {
        if (!obj || !obj.hasOwnProperty(args[i])) {
            return false;
        }
        obj = obj[args[i]];
    }
    return true;
}

function getFSProfileData(focusRecord, relation) {
    var focusperson = getFSRecordName(focusRecord) || "";
    var genderval = getFSRecordGender(focusRecord) || "unknown";
    var focusdaterange = "";

    $("#readstatus").html(escapeHtml(focusperson));

    var profiledata = {name: focusperson, gender: genderval, status: relation.title};
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;
    var aboutdata = "";

    if (focusRecord["identifiers"] && focusRecord["identifiers"]["http://gedcomx.org/Persistent"]) {
        profiledata["url"] = focusRecord["identifiers"]["http://gedcomx.org/Persistent"][0];
    } else {
        profiledata["url"] = tablink;
    }

    if (focusRecord["facts"]) {
        var facts = focusRecord["facts"];
        for (var i = 0; i < facts.length; i++) {
            var eventinfo = facts[i];
            var type = rmGED(eventinfo["type"]);
            if (type === "birth") {
                var data = parseFSJSONDate(eventinfo);
                if (!$.isEmptyObject(data)) {
                    data = fsMerge(profiledata["birth"], data);
                    profiledata["birth"] = data;
                }
            } else if (type === "christening") {
                var data = parseFSJSONDate(eventinfo);
                if (!$.isEmptyObject(data)) {
                    data = fsMerge(profiledata["baptism"], data);
                    profiledata["baptism"] = data;
                }
            } else if (type === "death") {
                var data = parseFSJSONDate(eventinfo);
                if (!$.isEmptyObject(data)) {
                    if (exists(getDate(data))) {
                        deathdtflag = true;
                    }
                    data = fsMerge(profiledata["death"], data);
                    profiledata["death"] = data;
                }
            } else if (type === "burial") {
                var data = parseFSJSONDate(eventinfo);
                if (!$.isEmptyObject(data)) {
                    if (exists(getDate(data))) {
                        burialdtflag = true;
                    }
                    if (exists(getLocation(data))) {
                        buriallcflag = true;
                    }
                    data = fsMerge(profiledata["burial"], data);
                    profiledata["burial"] = data;
                }
            } else if (type === "occupation") {
                if ("value" in eventinfo) {
                    profiledata["occupation"] = eventinfo["value"];
                }
            } else if (type === "census") {
                var data = parseFSJSONDate(eventinfo);
                if (!$.isEmptyObject(data)) {
                    var abt = "* '''Residence''': ";
                    var locval = null;
                    var dateval = null;
                    if (checkNested(data,1,"location")) {
                        locval = data[1]["location"];
                    }
                    if (checkNested(data,0,"date")) {
                        dateval = data[0]["date"];
                    }
                    if (locval) {
                        abt = abt + locval;
                        if (dateval) {
                            abt = abt + " - " + dateval;
                        }
                        aboutdata += abt + "\n";
                    }
                }
            }
        }
    }

    if (!exists(profiledata["birth"]) || !exists(profiledata["birth"]["date"])) {
        if (focusRecord["fields"]) {
            var facts = focusRecord["fields"];
            for (var i = 0; i < facts.length; i++) {
                var eventinfo = facts[i];
                var type = rmGED(eventinfo["type"]);
                if (type === "estimatedbirthyear") {
                    var data = [];
                    data.push({date: "Circa " + cleanDate(eventinfo["values"][0]["text"])});
                    profiledata["birth"] = data;
                }
            }
        }
    }

    if (relation === "") {
        focusgender = genderval;
    } else if (genderval === "unknown" && exists(relation.gender)) {
        genderval = relation.gender;
        profiledata["gender"] = genderval;
    }

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
    return profiledata;
}

function fsMerge(data1, data2) {
    //Sometimes the date and location are in separate entries - merge them
    if (!exists(data1)) {
        return data2;
    } else if (!exists(data2)) {
        return data1;
    } else {
        if (exists(data1[0].date) && !exists(data2[0].date)) {
            data2[0]["date"] = data1[0].date;
        }
        if (exists(data1[0].place) && !exists(data2[0].place)) {
            data2[0]["place"] = data1[0].place;
        }
        return data2;
    }
}