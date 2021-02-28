registerCollection({
    "recordtype": "BillionGraves Memorial",
    "prepareUrl": function(url) {
        return url;
    },
    "collectionMatch": function(url) {
        return startsWithHTTP(url, "https://billiongraves.com/");
    },
    "parseData": function(url) {
        if (startsWithHTTP(url,"https://billiongraves.com/grave/")){
            focusURLid = url.substring(url.lastIndexOf('/') + 1);
            getPageCode();
        } else {
            document.querySelector('#loginspinner').style.display = "none";
            setMessage(warningmsg, 'Please select one of the Profile pages on this site.');
        }
    },
    "loadPage": function(request) {
        var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        focusname = parsed.find("h1[itemprop='name']").text();
        let focus = parsed.find("h1[itemprop='name']").next("div")
        if (focus.length > 0) {
            focusrange = focus.text()
        }
    },
    "parseProfileData": parseBillionGraves
});


// Parse FindAGrave
function parseBillionGraves(htmlstring, familymembers, relation) {

    $("#experimentalmessage").text("Note: BillionGraves images will not copy for technical reasons, so the preview has been disabled. This is not a bug. Sorry, you'll have to do that part manually.");
    $("#experimentalmessage").show();
    relation = relation || "";
    var parsed = $(htmlstring.replace(/<img[^>]*>/ig,""));
    
    var focusdaterange = "";
    let focus = parsed.find("h1[itemprop='name']").next("div")
    if (focus.length > 0) {
        focusdaterange = focus.text()
    }
    var focusperson = parsed.find("h1[itemprop='name']").text();
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
    profiledata = addEvent(profiledata, "birth", parsed.find("time[itemprop='birthDate']").text(), "");
    profiledata = addEvent(profiledata, "death", parsed.find("time[itemprop='deathDate']").text(), "");
    cemname = parsed.find(".CemeteryName").text();
    cemeteryplace = parsed.find(".CemeteryAddress").html();
    let locsplit = []
    if (exists(cemeteryplace)) {
        let cemsplit = cemeteryplace.replace('"', "").split("<br>");
        for (var i = 0; i < cemsplit.length; i++) {
            if (cemsplit[i].trim() !== "") {
                locsplit[i] = cemsplit[i].trim();
            }
        }
    }
    locsplit.unshift(cemname);
    const cemetery = locsplit.join(", ");
    profiledata = addEvent(profiledata, "burial", "", cemetery.trim());

    // ---------------------- Profile Continued --------------------
    parsed = $(htmlstring.replace(/<img/ig,"<gmi"));

    profiledata["alive"] = false; //assume deceased
    const imagedata = parsed.find("gmi");
    
    for (var i = 0; i < imagedata.length; i++) {
        let src = $(imagedata[i]).attr( "src" );
        if (src.startsWith("https://s3.amazonaws.com/images.billiongraves.com/headstones/images")) {
            // profiledata["image"] = src;
            // profiledata["thumb"] = src.replace("/images/", "/thumbnails/");
            // Haven't figure out how to allow image loading
        }
    }

    const imagecredit = parsed.find("amp-img[alt='Photographer']");
    if (exists(imagecredit)) {
        profiledata["imagecredit"] = $(imagecredit[0]).next().find("h2").text();
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
