// Parse Gravez.me Records
registerCollection({
    "reload": false,
    "recordtype": "Gravez.me Records",
    "prepareUrl": function(url) {
        if (startsWithHTTP(url,"http://www.gravez.me/en")) {
            url = url.replace("/en/", "/");
        }
        return url;
    },
    "collectionMatch": function(url) {
        var regex = new RegExp('[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$', 'i');
        return (startsWithHTTP(url,"http://gravez.me") && regex.test(url));
    },
    "parseData": function(url) {
        var regex = new RegExp('[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$', 'i');
        if (startsWithHTTP(url,"http://gravez.me") && regex.test(url)) { 
            focusURLid = regex.exec(url)[0];
            getPageCode();
        } else {
            document.querySelector('#loginspinner').style.display = "none";
            setMessage(warningmsg, 'Please select one of the Profile pages on this site.');
        }
    },
    "loadPage": function(request) {
        var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        focusname = parsed.find(".name").text().split(" ז\"ל ")[0];
    },
    "parseProfileData": parseGravezMe
});


// Parse FindAGrave
function parseGravezMe(htmlstring, familymembers, relation) {

    var parsed = $(htmlstring.replace(/<img[^>]*>/ig,""));
    
    var focusdaterange = "";

    var focusperson = parsed.find(".name").text().split(" ז\"ל ")[0];
    var genderval = "unknown";

    if (relation === "") {
        focusgender = genderval;
    } else if (exists(relation.genderval) && genderval === "unknown") {
        genderval = relation.genderval
    }

    if (parsed.find(".name").text().split(" ז\"ל ").length == 2) {
        const prefix = parsed.find(".name").text().split(" ז\"ל ")[1].substring(0,2)

        if (prefix == "בן"){
            genderval = "male";
        } else if (prefix == "בת") {
            genderval = "female";
        }
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

    profiledata = addEvent(profiledata, "death", parsed.find("h6:contains('תאריך פטירה')").next("span").first().text().split("|")[1].trim(), "");
    profiledata = addEvent(profiledata, "burial", parsed.find("h6:contains('תאריך קבורה')").next("span").first().text().split("|")[1].trim(), "");

    cemname = parsed.find(".location-wrap").find("span").first().text();
    profiledata = addEvent(profiledata, "burial", "", cemname);

    // ---------------------- Profile Continued --------------------
    profiledata["alive"] = false; //assume deceased
    const imagedata = parsed.find(".deceased-image").find("img");
    
    for (var i = 0; i < imagedata.length; i++) {
        let src = $(imagedata[i]).attr( "src" );
        profiledata["image"] = src;
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

