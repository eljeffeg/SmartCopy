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
        var data = getData(request.source);
        focusname = data.name;

        var dates = []
        if (exists(data.birthDate)){
            dates.push(parseBillionGravesDate(data.birthDate).getFullYear());
        }
        if (exists(data.deathDate)){
            dates.push(parseBillionGravesDate(data.deathDate).getFullYear());
        }

        if (dates.length > 0) {
            focusrange = dates.join("-")
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
    var data = getData(htmlstring);

    var dates = []
    if (exists(data.birthDate)){
        dates.push(parseBillionGravesDate(data.birthDate).getFullYear());
    }
    if (exists(data.deathDate)){
        dates.push(parseBillionGravesDate(data.deathDate).getFullYear());
    }

    var focusdaterange = "";
    if (dates.length > 0) {
        focusdaterange = dates.join("-")
    }
    

    var focusperson = data.name;
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
    profiledata = addEvent(profiledata, "birth", parseBillionGravesDate(data.birthDate).toLocaleDateString("en-UK"), '');
    profiledata = addEvent(profiledata, "death", parseBillionGravesDate(data.deathDate).toLocaleDateString("en-UK"), "");
    cemname = data.deathPlace.name;
    cemeteryplace = data.deathPlace.address;
    let locsplit = []
    if (exists(cemeteryplace)) {
        const cemAddressTypes = Object.keys(data.deathPlace.address).filter((key) => { return !key.startsWith("@")})
        for (const cemAddressType in cemAddressTypes) {
            if (cemeteryplace[cemAddressType[i]] && cemeteryplace[cemAddressType[i]].trim() !== "") {
                locsplit[i] = cemeteryplace[cemAddressType[i]].trim();
            }
        }
    }
    locsplit.unshift(cemname);
    const cemetery = locsplit.join(", ");
    profiledata = addEvent(profiledata, "burial", "", cemetery.trim());

    // ---------------------- Profile Continued --------------------
    parsed = $(htmlstring.replace(/<img/ig,"<gmi"));

    profiledata["alive"] = false; //assume deceased
    const imagesdata = parsed.find("gmi");
    
    for (var i = 0; i < imagesdata.length; i++) {
        let src = imagesdata[i].attributes["src"].value;
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

function getData(htmlstring) {
    return JSON.parse(htmlstring.split('<script type="application/ld+json">')[1].split('</script>')[0]);
}

function parseBillionGravesDate(date) {
    return new Date(date);
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
