// Parse Toldot.Ru Records
registerCollection({
    "reload": false,
    "recordtype": "Toldot.Ru Grave",
    "prepareUrl": function(url) {
        return url;
    },
    "collectionMatch": function(url) {
        return startsWithHTTP(url,"https://toldot.ru/life/cemetery/graves_");
    },
    "parseData": function(url) {
        if (startsWithHTTP(url,"https://toldot.ru/life/cemetery/graves_")) { 
            focusURLid = url.substring("https://toldot.ru/life/cemetery/graves_".length, url.length - ".html".length);
            getPageCode();
        } else {
            document.querySelector('#loginspinner').style.display = "none";
            setMessage(warningmsg, 'Please select one of the Profile pages on this site.');
        }
    },
    "loadPage": function(request) {
        var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        focusname = parsed.find("h1").first().text().trim();
    },
    "parseProfileData": parseToldotRu
});


// Parse Toldot.Ru
function parseToldotRu(htmlstring, familymembers, relation) {
    var parsed = $(htmlstring.replace(/<img/ig, "<gmi"));
    relation = relation || "";
    
    var focusdaterange = "";

    var focusperson = parsed.find("h1").first().text().trim();

    var genderval = "unknown";

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

    let lifeDates = parsed.find(".grave-years").find(".info").text().trim();
    lifeDates = lifeDates.replace("гг", "");

    if (lifeDates != ""){
        let birthYear = lifeDates.split("—")[0];
        if (birthYear != "" && birthYear != "?") {
            profiledata = addEvent(profiledata, "birth", birthYear, "");   
        }

        if (lifeDates.split("—").length > 1) {
            let deathYear = lifeDates.split("—")[1];
            if (deathYear != "" && deathYear != "?") {
                profiledata = addEvent(profiledata, "death", deathYear, "");   
            }
        }
    }

    cemname = parsed.find(".grave-place").find(".info").html().trim().split("<br>")[0];
    
    if (cemname != "") {
        profiledata = addEvent(profiledata, "burial", "", cemname);
    }

    // ---------------------- Profile Continued --------------------
    profiledata["alive"] = false; //assume deceased
    const imagedata = parsed.find(".grave-photo").attr("href").replace("//", "https://");
    profiledata["image"] = imagedata;

    const thumbImage = parsed.find(".grave-photo").find("gmi").attr("src").replace("//", "https://");
    profiledata["thumb"] = thumbImage;

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

    dateval = cleanDate(dateval.replace("/","-"));
    if (dateval !== "unknown" && dateval !== "") {
        dt = moment(dateval, "DD-MM-YYYY", true);
        if (dt.isValid()) {
            dateval = dt.format('MMMM D, YYYY');
        }
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