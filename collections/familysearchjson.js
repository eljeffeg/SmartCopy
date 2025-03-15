// Parse FamilySearch Genealogies
registerCollection({
    reload: false,
    recordtype: "FamilySearch Genealogy",
    prepareUrl: function (url) {
        url = url.replace("://www.", "://");
        if (ftUrlMatches(url, ["https://familysearch.org/{locale}/pal:"])) {
            var urlparts = url.split("?");
            focusURLid = urlparts[0].substring(url.lastIndexOf("/") + 1);
            url =
                hostDomain(url) +
                getFtUrlLocale(url) +
                "/service/tree/tree-data/person/" +
                focusURLid +
                "/all?locale=en";
            this.reload = true;
        } else if (
            ftUrlMatches(url, ["https://familysearch.org/{locale}/tree/"]) &&
            !ftUrlMatches(url, ["https://familysearch.org/{locale}/tree/find"])
        ) {
            focusURLid = getParameterByName("person", url);
            if (focusURLid === "") {
                url = url
                    .replace("/details", "")
                    .replace("/memories", "")
                    .replace("/landscape", "")
                    .replace("/portrait", "")
                    .replace("/fanchart", "")
                    .replace("/descendancy", "");
                focusURLid = url.substring(url.lastIndexOf("/") + 1);
                if (exists(focusURLid) && focusURLid.contains("?")) {
                    focusURLid = focusURLid.substring(
                        0,
                        focusURLid.lastIndexOf("?"),
                    );
                }
            }
            url =
                hostDomain(url) +
                getFtUrlLocale(url) +
                "/service/tree/tree-data/person/" +
                focusURLid +
                "/all";
            this.reload = true;
        } else if (
            ftUrlMatches(url, "https://familysearch.org/{locale}/ark:") &&
            !url.contains("/1:1:")
        ) {
            var urlparts = url.split("?");
            focusURLid = urlparts[0].substring(url.lastIndexOf(":") + 1);
            url =
                hostDomain(url) +
                getFtUrlLocale(url) +
                "/service/tree/tree-data/person/" +
                focusURLid +
                "/all";
            this.reload = true;
        } else if (
            ftUrlMatches(url, [
                "https://familysearch.org/{locale}/service/tree/tree-data/",
            ])
        ) {
            var focussplit = url.split("/");
            if (focussplit.length > 1) {
                focusURLid = focussplit[focussplit.length - 2];
            }
        }
        return url;
    },
    collectionMatch: function (url) {
        url = url.replace("://www.", "://");
        return (
            ftUrlMatches(url, [
                "https://familysearch.org/{locale}/service/tree",
                "https://familysearch.org/{locale}/tree-data",
                "https://familysearch.org/{locale}/tree/",
                "https://familysearch.org/{locale}/pal:",
            ]) ||
            (ftUrlMatches(url, ["https://familysearch.org/{locale}/ark:"]) &&
                !url.contains("/1:1:") &&
                !url.contains("/2:2:"))
        );
    },
    parseData: function (url) {
        if (
            ftUrlMatches(url, ["https://familysearch.org/{locale}/tree/find"])
        ) {
            document.querySelector("#loginspinner").style.display = "none";
            setMessage(
                warningmsg,
                "SmartCopy does not work on Search pages.  Please select one of the Profile pages on this site.",
            );
        } else {
            getPageCode();
        }
    },
    loadPage: function (request) {
        var parsed = "";
        try {
            parsed = JSON.parse(request.source);
        } catch (err) {
            setMessage(
                warningmsg,
                "There was a problem retrieving FamilySearch data.<br>Please verify you are logged in " +
                    "<a href='https://familysearch.org' target='_blank'>https://familysearch.org</a>",
            );
            document.getElementById("top-container").style.display = "block";
            document.getElementById("submitbutton").style.display = "none";
            document.getElementById("loading").style.display = "none";
            return;
        }
        if (parsed["status"] !== "OK") {
            setMessage(
                warningmsg,
                'There was a problem reading this FamilySearch profile.<br>Unable to retrive the data via the id "' +
                    '<a href="' +
                    tablink +
                    '" target="_blank">' +
                    focusURLid +
                    '</a>".',
            );
            document.getElementById("top-container").style.display = "block";
            document.getElementById("submitbutton").style.display = "none";
            document.getElementById("loading").style.display = "none";
            return;
        }

        var focusperson;
        if (
            parsed["data"]["nameConclusion"] &&
            parsed["data"]["nameConclusion"]["details"] &&
            parsed["data"]["nameConclusion"]["details"]["nameForms"]
        ) {
            focusperson = NameParse.parse(parsed["data"]["name"], mnameonoff);
            if (focusperson.lastName !== "") {
                focusperson.lastName = NameParse.cleanName(
                    parsed["data"]["nameConclusion"]["details"]["nameForms"][0][
                        "familyPart"
                    ],
                );
                if (focusperson.lastName.contains(focusperson.middleName)) {
                    focusperson.middleName = "";
                }
            }
        } else {
            focusperson = parsed["data"]["name"];
        }
        focusURLid = parsed["data"]["id"]; //In case it is merged with another profile - update
        focusname = focusperson;
        focusrange = parsed["data"]["lifeSpan"] || "";
    },
    parseProfileData: parseFamilySearchJSON,
});

function ftUrlMatches(url, urlPatterns) {
    return urlPatterns.some((pattern) => {
        // If pattern contains {locale} template
        if (pattern.includes("{locale}")) {
            // Try each supported locale
            return supportedLocales.some((locale) => {
                const resolvedPattern = pattern.replace("{locale}", locale);
                return startsWithHTTP(url, resolvedPattern);
            });
        } else {
            // Direct match for patterns without locale template
            return startsWithHTTP(url, pattern);
        }
    });
}

function getFtUrlLocale(url) {
    const prefix = hostDomain(url);
    urlPath = url.replace(prefix + "/", "");
    const maybeLocale = urlPath.split("/")[0];
    if (supportedLocales.includes(maybeLocale)) {
        return "/" + maybeLocale;
    } else return "";
}

const supportedLocales = [
    "en",
    "ar",
    "cs",
    "da",
    "de",
    "es",
    "es-mx",
    "et",
    "fi",
    "fr",
    "he",
    "hi",
    "id",
    "it",
    "ja",
    "ko",
    "ms",
    "nl",
    "no",
    "pl",
    "pt",
    "pt-br",
    "ru",
    "sv",
    "th",
    "uk",
    "vi",
    "zh-hk",
    "zh-hans",
    "zh-hant",
    "zh-tw",
    "zh",
];

function parseFamilySearchJSON(htmlstring, familymembers, relation) {
    relation = relation || "";
    var parsed = null;
    try {
        var parsed = JSON.parse(htmlstring);
    } catch (err) {
        document.getElementById("top-container").style.display = "block";
        document.getElementById("submitbutton").style.display = "none";
        document.getElementById("loading").style.display = "none";
        setMessage(
            errormsg,
            "SmartCopy was unable to retrieve the FamilySearch data.  Please refresh the page and try again.",
        );
        console.log(err);
    }

    if (!exists(parsed)) {
        return "";
    }
    var focusperson;
    if (
        parsed["data"]["nameConclusion"] &&
        parsed["data"]["nameConclusion"]["details"] &&
        parsed["data"]["nameConclusion"]["details"]["nameForms"]
    ) {
        focusperson = NameParse.parse(parsed["data"]["name"], mnameonoff);
        if (focusperson.lastName !== "") {
            var familyPart =
                parsed["data"]["nameConclusion"]["details"]["nameForms"][0][
                    "familyPart"
                ];
            if (exists(familyPart)) {
                focusperson.lastName = NameParse.cleanName(familyPart);
                if (focusperson.lastName.contains(focusperson.middleName)) {
                    focusperson.middleName = "";
                }
            } else if (focusperson.lastName != "") {
                if (focusperson.firstName !== focusperson.lastName) {
                    focusperson.firstName += " " + focusperson.lastName;
                }
                focusperson.lastName = "";
            }
        }
        $("#readstatus").html(escapeHtml(focusperson.displayname));
    } else {
        focusperson = parsed["data"]["name"];
        $("#readstatus").html(escapeHtml(focusperson));
    }
    var focusdaterange = parsed["data"]["lifeSpan"] || "";

    var genderval = String(parsed["data"]["gender"] || "unknown").toLowerCase();
    var profiledata = {
        name: focusperson,
        gender: genderval,
        status: relation.title,
    };
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;
    var aboutdata = "";
    var fsspouselist = [];
    var alive = parsed["data"]["isLiving"] || null;
    if (alive !== null) {
        profiledata["alive"] = alive;
    }

    if (parsed["data"]["birthConclusion"]) {
        var eventinfo = parsed["data"]["birthConclusion"];
        var data = parseFSJSONDate(eventinfo);
        if (!$.isEmptyObject(data)) {
            profiledata["birth"] = data;
        }
    }
    if (parsed["data"]["christeningConclusion"]) {
        var eventinfo = parsed["data"]["christeningConclusion"];
        var data = parseFSJSONDate(eventinfo);
        if (!$.isEmptyObject(data)) {
            profiledata["baptism"] = data;
        }
    }
    if (parsed["data"]["deathConclusion"]) {
        var eventinfo = parsed["data"]["deathConclusion"];
        var data = parseFSJSONDate(eventinfo);
        if (!$.isEmptyObject(data)) {
            if (exists(getDate(data))) {
                deathdtflag = true;
            }
            profiledata["death"] = data;
        }
    }
    if (parsed["data"]["burialConclusion"]) {
        var eventinfo = parsed["data"]["burialConclusion"];
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
    }
    if (parsed["data"]["otherConclusions"]) {
        var eventinfo = parsed["data"]["otherConclusions"];
        var nicknames = "";
        //* '''Residence''': Clark County, KY - 1800
        for (var i = 0; i < eventinfo.length; i++) {
            var evt = eventinfo[i];
            var type = evt["type"].toLowerCase();
            if (
                type === "residence" ||
                type === "military_service" ||
                type === "naturalization"
            ) {
                var abt = "* '''" + NameParse.fix_case(type) + "''': ";
                var residence = evt["details"];
                if (residence["place"] && residence["place"]["originalText"]) {
                    abt = abt + residence["place"]["originalText"];
                    if (
                        residence["date"] &&
                        residence["date"]["originalText"]
                    ) {
                        abt = abt + " - " + residence["date"]["originalText"];
                    }
                    aboutdata += abt + "\n";
                }
            } else if (type === "alternate_name") {
                var evt = eventinfo[i];
                if (evt["details"] && evt["details"]["fullText"]) {
                    var altname = evt["details"]["fullText"]
                        .replace(/,/g, "")
                        .replace(/&quot;/g, '"')
                        .trim();
                    if (!nicknames.contains(altname)) {
                        if (nicknames !== "") {
                            nicknames += ",";
                        }
                        nicknames += altname;
                    }
                }
            }
        }
        if (nicknames !== "") {
            profiledata["nicknames"] = nicknames;
        }
    }

    if (familymembers) {
        loadGeniData();
        var famid = 0;
    }

    if (familymembers) {
        profiledata["url"] =
            hostDomain(tablink) + "/tree/person/details/" + focusURLid;
    } else {
        profiledata["url"] =
            hostDomain(tablink) + "/tree/person/details/" + relation.itemId;
    }

    // ---------------------- Family Data --------------------
    if (familymembers) {
        familystatus.push(famid);
        var url =
            hostDomain(tablink) +
            "/service/tree/tree-data/r9/family-members/person/" +
            focusURLid +
            "?includePhotos=true&locale=en";
        chrome.runtime.sendMessage(
            {
                method: "GET",
                action: "xhttp",
                url: url,
                variable: profiledata,
            },
            function (response) {
                if (response.status == 400) {
                    setMessage(
                        warningmsg,
                        "There was a problem retrieving FamilySearch data.<br>Please verify you are logged in " +
                            "<a href='https://familysearch.org' target='_blank'>https://familysearch.org</a>",
                    );
                    document.getElementById("top-container").style.display =
                        "block";
                    document.getElementById("submitbutton").style.display =
                        "none";
                    document.getElementById("loading").style.display = "none";
                    return;
                }
                var source = JSON.parse(response.source);
                var jsonrel = source["parents"];
                var parentset;
                if (jsonrel) {
                    for (var x = 0; x < jsonrel.length; x++) {
                        if (jsonrel[x]["children"]) {
                            var childset = jsonrel[x]["children"];
                            for (var i = 0; i < childset.length; i++) {
                                let child = childset[i]["child"];
                                if (child["id"] === focusURLid) {
                                    parentset = jsonrel[x]["coupleId"];
                                    var image = child["portraitUrl"] || "";
                                    if (
                                        image !== "" &&
                                        image.startsWith("http")
                                    ) {
                                        profiledata["image"] = image;
                                        profiledata["thumb"] = image;
                                    }
                                    var parents = parentset.split("_");
                                    var {data_m,data_d} = parseFSJSONUnion(
                                        jsonrel[x]["event"],
                                    );
                                    for (var y = 0; y < parents.length; y++) {
                                        var parentid = parents[y];
                                        var image = "";
                                        if (
                                            jsonrel[x]["parent1"] &&
                                            jsonrel[x]["parent1"]["id"] ===
                                                parentid
                                        ) {
                                            image =
                                                jsonrel[x]["parent1"][
                                                    "portraitUrl"
                                                ] || "";
                                        } else if (
                                            jsonrel[x]["parent2"] &&
                                            jsonrel[x]["parent2"]["id"] ===
                                                parentid
                                        ) {
                                            image =
                                                jsonrel[x]["parent2"][
                                                    "portraitUrl"
                                                ] || "";
                                        }
                                        if (y === 0) {
                                            processFamilySearchJSON(
                                                parentid,
                                                "parents",
                                                famid,
                                                image,
                                                data_m,
                                                data_d
                                            );
                                        } else {
                                            processFamilySearchJSON(
                                                parentid,
                                                "parents",
                                                famid,
                                                image,
                                            );
                                        }
                                        famid++;
                                    }
                                    break;
                                }
                            }
                        }
                    }
                    for (var x = 0; x < jsonrel.length; x++) {
                        if (jsonrel[x]["children"]) {
                            var childset = jsonrel[x]["children"];
                            var coupleid = jsonrel[x]["coupleId"];
                            for (var i = 0; i < childset.length; i++) {
                                let child = childset[i]["child"];
                                if (child["id"] !== focusURLid) {
                                    var relation = "sibling";
                                    if (parentset !== coupleid) {
                                        relation = "halfsibling";
                                    }
                                    var image = child["portraitUrl"] || "";
                                    processFamilySearchJSON(
                                        child["id"],
                                        relation,
                                        famid,
                                        image,
                                    );
                                    famid++;
                                }
                            }
                        }
                    }
                }

                var jsonrel = source["spouses"];
                if (jsonrel) {
                    for (var x = 0; x < jsonrel.length; x++) {
                        var spouse = jsonrel[x]["id"];
                        var image = jsonrel[x]["portraitUrl"] || "";
                        if (
                            jsonrel[x]["parent2"] &&
                            jsonrel[x]["parent2"]["id"] !== focusURLid
                        ) {
                            spouse = jsonrel[x]["parent2"]["id"];
                            image = jsonrel[x]["parent2"]["portraitUrl"] || "";
                        } else if (
                            jsonrel[x]["parent1"] &&
                            jsonrel[x]["parent1"]["id"] !== focusURLid
                        ) {
                            spouse = jsonrel[x]["parent1"]["id"];
                            image = jsonrel[x]["parent1"]["portraitUrl"] || "";
                        }
                        if (spouse) {
                            var {data_m,data_d} = parseFSJSONUnion(jsonrel[x]["event"]);
                            var valid = processFamilySearchJSON(
                                spouse,
                                "spouse",
                                famid,
                                image,
                                data_m,
                                data_d
                            );
                            if (valid) {
                                fsspouselist.push(spouse);
                                myhspouse.push(famid);
                                famid++;
                            }
                        }
                    }

                    // ---------------------- Children --------------------
                    if (fsspouselist.length > 0) {
                        for (var x = 0; x < fsspouselist.length; x++) {
                            var spouse = fsspouselist[x];
                            familystatus.push(famid);
                            //https://familysearch.org/en/tree-data/family-members/couple/LKKN-H49_LH2H-51B/children?focusPersonId=LH2H-51B&includePhotos=true&locale=en
                            var url =
                                hostDomain(tablink) +
                                getFtUrlLocale(tablink) +
                                "/service/tree/tree-data/r9/family-members/couple/" +
                                spouse +
                                "_" +
                                focusURLid +
                                "/children?focusPersonId=" +
                                focusURLid +
                                "&includePhotos=true&locale=en";
                            var subdata = { spouse: spouse };
                            chrome.runtime.sendMessage(
                                {
                                    method: "GET",
                                    action: "xhttp",
                                    url: url,
                                    variable: subdata,
                                },
                                function (response) {
                                    if (response.status == 400) {
                                        setMessage(
                                            warningmsg,
                                            "There was a problem retrieving FamilySearch data.<br>Please verify you are logged in " +
                                                "<a href='https://familysearch.org' target='_blank'>https://familysearch.org</a>",
                                        );
                                        document.getElementById(
                                            "top-container",
                                        ).style.display = "block";
                                        document.getElementById(
                                            "submitbutton",
                                        ).style.display = "none";
                                        document.getElementById(
                                            "loading",
                                        ).style.display = "none";
                                        return;
                                    }
                                    var arg = response.variable;
                                    var childset = JSON.parse(response.source);
                                    for (var i = 0; i < childset.length; i++) {
                                        var child = childset[i]["child"];
                                        var itemid = child["id"];
                                        var image = child["portraitUrl"] || "";
                                        childlist[famid] = $.inArray(
                                            arg.spouse,
                                            unionurls,
                                        );
                                        processFamilySearchJSON(
                                            itemid,
                                            "child",
                                            famid,
                                            image,
                                        );
                                        famid++;
                                    }
                                    familystatus.pop();
                                },
                            );
                        }
                    }
                }
                familystatus.pop();
            },
        );
    }

    if (focusdaterange !== "") {
        profiledata["daterange"] = focusdaterange;
    }

    if (
        !burialdtflag &&
        buriallcflag &&
        deathdtflag &&
        $("#burialonoffswitch").prop("checked")
    ) {
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

function parseFSJSONUnion(eventinfo) {
    
    var data_m = [];
    var data_d = [];
    var dateval = "";
    var eventlocation = "";
//console.log("Eventinfo",eventinfo);
    if (eventinfo &&
 eventinfo["type"] &&
 eventinfo["type"].toLowerCase() === "marriage") {
       
        if (eventinfo.details.date) {
            dateval = eventinfo.details.date.normalizedText;
        }
        if (dateval !== "") {
            data_m.push({date: cleanDate(dateval)});
        }
        if (eventinfo.details.place){  
            if (eventinfo.details.place.normalizedText){
            eventlocation = eventinfo.details.place.normalizedText.trim()
            }
            if (eventinfo.details.place.originalText && eventlocation == "" ){
                eventlocation = eventinfo.details.place.originalText.trim()
            }
            if (eventlocation == ""){
                console.log("LocalizedText",eventinfo.details.place.localizedText);
            }
        }
        if (eventlocation !== "") {
            data_m.push({id: geoid, location: eventlocation});
            geoid++;
        }
    }
    if (eventinfo && eventinfo["type"] && eventinfo["type"].toLowerCase() === "divorce") {
        dateval = "";
        eventlocation = "";
        if (eventinfo.details.date) {    
            dateval = eventinfo.details.date.normalizedText;
        }
        if (dateval !== "") {
            data_d.push({date: cleanDate(dateval)});
        }
       
        if (eventinfo.details.place){ 
            eventlocation = eventinfo.details.place.normalizedText.trim()
        }
        if (eventlocation !== "") {
            data_d.push({id: geoid, location: eventlocation});
            geoid++;
        }
    }
    return {data_m,data_d};
}

function parseFSJSONDate(eventinfo) {
    var data = [];
    var details = [];
    if (eventinfo["details"]) {
        details = eventinfo["details"];
    } else {
        details = eventinfo;
    }

    if (details["date"]) {
        var dateval = "";
        if (details["date"]["localizedText"]) {
            dateval = details["date"]["localizedText"];
        } else if (details["date"]["normalizedText"]) {
            dateval = details["date"]["normalizedText"];
        } else if (details["date"]["originalText"]) {
            dateval = details["date"]["originalText"];
        } else if (details["date"]["original"]) {
            dateval = details["date"]["original"];
        }
        if (
            details["date"]["modifier"] &&
            !dateval
                .toLowerCase()
                .startsWith(details["date"]["modifier"].toLowerCase())
        ) {
            dateval = details["date"]["modifier"] + " " + dateval;
        }
        if (checkNested(details["date"], "fields", 0, "values", 0, "labelId")) {
            if (
                details["date"]["fields"][0]["values"][0]["labelId"].contains(
                    "EST",
                )
            ) {
                dateval = "Circa " + dateval;
            }
        }
        if (dateval !== "") {
            data.push({ date: cleanDate(dateval) });
        }
    }
    if (details["place"]) {
        var eventlocation = "";
        if (details["place"]["localizedText"]) {
            eventlocation = details["place"]["localizedText"].trim();
        } else if (details["place"]["normalizedText"]) {
            eventlocation = details["place"]["normalizedText"].trim();
        } else if (details["place"]["originalText"]) {
            eventlocation = details["place"]["originalText"].trim();
        } else if (details["place"]["original"]) {
            eventlocation = details["place"]["original"].trim();
        }
        if (eventlocation !== "") {
            data.push({ id: geoid, location: eventlocation });
            geoid++;
        }
    }
    return data;
}

function getFamilySearchJSON(famid, url, subdata) {
    familystatus.push(famid);
    chrome.runtime.sendMessage(
        {
            method: "GET",
            action: "xhttp",
            url: url,
            variable: subdata,
        },
        function (response) {
            var arg = response.variable;
            var person = parseFamilySearchJSON(response.source, false, {
                title: arg.title,
                proid: arg.profile_id,
                itemId: arg.itemId,
            });
            if(!person){
                familystatus.pop();
                return;
            }
            if (arg.halfsibling) {
                person["halfsibling"] = true;
            }
            if (arg.marriage) {
                person["marriage"] = arg.marriage;
            }
            if (arg.divorce) {
                person["divorce"] = arg.divorce;
            }
            if (arg.parent_id) {
                person["parent_id"] = arg.parent_id;
            }
            if (arg.image) {
                person["image"] = arg.image;
                person["thumb"] = arg.image;
            }
            //person = updateInfoData(person, arg);
            person["itemId"] = arg.itemId;
            person["profile_id"] = arg.profile_id;
            databyid[arg.profile_id] = person;
            alldata["family"][arg.title].push(person);
            familystatus.pop();
        },
    );
}

function processFamilySearchJSON(itemid, title, famid, image, data_m, data_d) {
    // Case of one of the two parents unknown (not referenced)
    if (itemid ==="UNKNOWN"){
        return false;
    }
    if (itemid === focusURLid) {
        return false;
    }
    var url =
        hostDomain(tablink) +
        getFtUrlLocale(tablink) +
        "/service/tree/tree-data/person/" +
        itemid +
        "/all";
    if (!exists(alldata["family"][title])) {
        alldata["family"][title] = [];
    }
    if (isParent(title)) {
        parentlist.push(itemid);
    }

    var subdata = {title: title, url: url, itemId: itemid, profile_id: famid};
    if (!$.isEmptyObject(data_m)) {
        subdata["marriage"] = data_m;
    }
    if (!$.isEmptyObject(data_d)) {
        subdata["divorce"] = data_d;
    }
    if (title === "halfsibling") {
        subdata["halfsibling"] = true;
    }
    if (title === "child") {
        subdata["parent_id"] = childlist[famid];
    }
    if (image !== "") {
        subdata["image"] = image;
    }
    unionurls[famid] = itemid;
    getFamilySearchJSON(famid, url, subdata);
    return true;
}
