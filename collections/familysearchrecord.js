// Parse FamilySearch Records
function parseFamilySearchRecord(htmlstring, familymembers, relation) {
    relation = relation || "";
    var parsed = null;
    var focusRecord = null;
    var focusRecordid = null;
    if ($.type( htmlstring ) === "string") {
        try {
            parsed = JSON.parse(htmlstring);
            if (!exists(parsed)) {
                return "";
            }
            focusRecord = getFSFocus(parsed);
            focusRecordId = focusRecord["id"];
            focusrelation = getFSRecordRelation(focusRecord);
        } catch(err) {
            console.log(err);
        }
    } else {
        focusRecord = htmlstring;
    }

    var profiledata = getFSProfileData(focusRecord, "");

    if (familymembers) {
        loadGeniData();
        var famid = 0;
    }

    if (parsed) {
        for (var i = 0; i < parsed["persons"].length; i++) {
            var person = parsed["persons"][i];
            if (checkNested(person, "links","persona","href")) {
                if (!person["links"]["persona"]["href"].contains(focusURLid)) {
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
                        pdata["profile_id"] = famid;
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
                            myhspouse.push(famid);
                        }
                        unionurls[famid] = itemid;
                        databyid[famid] = pdata;
                        alldata["family"][title].push(pdata);
                        famid++;
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

    document.getElementById("readstatus").innerText = "";
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

function getFSFocus(personlist) {
    for (var i = 0; i < personlist["persons"].length; i++) {
        var person = personlist["persons"][i];
        if (checkNested(person, "links","persona","href")) {
            if (person["links"]["persona"]["href"].contains(focusURLid)) {
                return person;
            }
        }
    }
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

    document.getElementById("readstatus").innerText = focusperson;

    var profiledata = {name: focusperson, gender: genderval, status: relation.title};
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;
    var aboutdata = "";


    if (focusRecord["facts"]) {
        var facts = focusRecord["facts"];
        for (var i = 0; i < facts.length; i++) {
            var eventinfo = facts[i];
            var type = rmGED(eventinfo["type"]);
            if (type === "birth") {
                var data = parseFSJSONDate(eventinfo);
                if (!$.isEmptyObject(data)) {
                    profiledata["birth"] = data;
                }
            } else if (type === "christening") {
                var data = parseFSJSONDate(eventinfo);
                if (!$.isEmptyObject(data)) {
                    profiledata["baptism"] = data;
                }
            } else if (type === "death") {
                var data = parseFSJSONDate(eventinfo);
                if (!$.isEmptyObject(data)) {
                    if (exists(getDate(data))) {
                        deathdtflag = true;
                    }
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
                    profiledata["burial"] = data;
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