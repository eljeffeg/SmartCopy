// Parse Ancestry Free Records (records.ancestry.com or ancestry.com/genealogy/records)
registerCollection({
    "reload": false,
    "recordtype": "Ancestry Records",
    "prepareUrl": function(url) {
        if (startsWithHTTP(url,"http://www.ancestry.") && !startsWithHTTP(url,"http://www.ancestry.com") && url.contains("/genealogy/records/")) {
            var ancestrystart = tablink.split("www.ancestry.");
            //Replace domain for other countries, such as http://www.ancestry.ca/genealogy/records/abraham-knowlton_17477348
            url = ancestrystart[0] + "www.ancestry.com" + ancestrystart[1].substring(ancestrystart[1].indexOf("/"));
            this.reload = true;
        }
        return url;
    },
    "collectionMatch": function(url) {
        return (startsWithHTTP(url,"http://records.ancestry.") || (startsWithHTTP(url,"http://www.ancestry.") && url.contains("/genealogy/records/")));
    },
    "parseData": function(url) {
        if (startsWithHTTP(url,"http://www.ancestry.com/genealogy/records/") ||
            (startsWithHTTP(url,"http://records.ancestry.com") && url.contains("pid="))){
            focusURLid = getParameterByName('pid', url);
            getPageCode();
        } else {
            document.querySelector('#loginspinner').style.display = "none";
            setMessage(warningmsg, 'Please select one of the Profile pages on this site.');
        }
    },
    "loadPage": function(request) {
        var regex = new RegExp('(?<=window\.__PRELOADED_STATE__ \= ).*?(?=;.*?\<\/script>)', 'gs');
        var match = regex.exec(request.source);
        if (exists(match)) {
            var preload = JSON.parse(match[0]);
        }
        if (!exists(preload) || !exists(preload.person)) {
            return;
        }
        var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        var frange = parsed.find(".pageCrumb");
        for (var i = 0; i < frange.length; i++) {
            if ($(frange[i]).text().startsWith(focusname)) {
                var fsplit = $(frange[i]).text().split("(");
                if (fsplit.length > 1) {
                    focusrange = fsplit[1].replace(")", "").trim();
                }
                break;
            }
        }
        focusname = preload.person.Self.name;
    },
    "parseProfileData": parseAncestryFree
});

function parseAncestryFree(htmlstring, familymembers, relation) {
    relation = relation || "";
    if (!exists(htmlstring)) {
        return;
    }
    var person = null;
    var preload = null;
    if (relation === "") {
        var parsed = $(htmlstring.replace(/<img/ig, "<gmi"));
        var regex = new RegExp('(?<=window\.__PRELOADED_STATE__ \= ).*?(?=;\\s*?<\/script>)', 'gs');
        var match = regex.exec(htmlstring);
        if (exists(match)) {
            preload = JSON.parse(match[0]);
        }

        if (!exists(preload) || !exists(preload.person)) {
            return;
        }
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
        person = preload.person.Self;
    } else {
        person = htmlstring;
    }
    if (!exists(person)) {
        return;
    }

    var focusperson = person.name;


    $("#readstatus").html(escapeHtml(focusperson));

    var genderval = "unknown";
    if (exists(person.gender)) {
        if (person.gender == "F") {
            genderval = "female";
        } else if (person.gender == "M") {
            genderval = "male";
        }
    }

    var profiledata = {name: focusperson, gender: genderval, status: relation.title};
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;
    var aboutdata = "";
    if (exists(person.birth)) {
        var data = parseAncestryFreeNewDate(person.birth);
        if (!$.isEmptyObject(data)) {
            profiledata["birth"] = data;
        }
    }
    if (exists(person.death)) {
        var data = parseAncestryFreeNewDate(person.death);
        if (!$.isEmptyObject(data)) {
            if (exists(getDate(data))) {
                deathdtflag = true;
            }
            profiledata["death"] = data;
        }
    }
    // ---------------------- Profile Data --------------------

    if (relation === "") {
        focusgender = genderval;
    }

    if (familymembers) {
        loadGeniData();
        var famid = 0;
    }

    // ---------------------- Family Data --------------------
    if (familymembers) {
        if (exists(preload.person.Father)) {
            parseAncestryFree(preload.person.Father, false, {"title": "father", "profile_id": famid, "itemId": preload.person.Father.pid});
            famid++;
        }
        if (exists(preload.person.Mother)) {
            parseAncestryFree(preload.person.Mother, false, {"title": "mother", "profile_id": famid, "itemId": preload.person.Mother.pid});
            famid++;
        }
        if (exists(preload.person.Spouses)) {
            for (i=0; i < preload.person.Spouses.length; i++) {
                parseAncestryFree(preload.person.Spouses[i], false, {"title": "spouse", "profile_id": famid, "itemId":preload.person.Spouses[i].pid});
                famid++;
            }
        }
        if (exists(preload.person.Children)) {
            for (i=0; i < preload.person.Children.length; i++) {
                parseAncestryFree(preload.person.Children[i], false, {"title": "child", "profile_id": famid, "itemId": preload.person.Children[i].pid});
                famid++;
            }
        }
    }


    // ---------------------- Profile Data --------------------
    if (focusdaterange !== "") {
        profiledata["daterange"] = focusdaterange;
    }

    if (aboutdata.trim() !== "") {
        profiledata["about"] = cleanHTML(aboutdata);
        // "\n--------------------\n"  Merge separator
    }

    if (familymembers) {
        alldata["profile"] = profiledata;
        alldata["scorefactors"] = smscorefactors;
        updateGeo();
    } else {
        profiledata["url"] = "https://www.ancestry.com/genealogy/records/" + relation.itemId;
        profiledata["profile_id"] = relation.profile_id;
        databyid[relation.profile_id] = profiledata;
        if (!exists(alldata["family"][relation.title])) {
            alldata["family"][relation.title] = [];
        }
        alldata["family"][relation.title].push(profiledata);
    }
    return profiledata;
}

function parseAncestryFreeNewDate(vitalstring) {
    var data = [];
    if (vitalstring.date) {
        data.push({date: vitalstring.date});
    }
    if (vitalstring.place) {
        data.push({id: geoid, location: vitalstring.place});
        geoid++;
    }
    return data;
}
