// Parse Gravez.me Records
registerCollection({
    "reload": false,
    "recordtype": "Gravez.me Grave",
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
        focusname = parsed.find(".name").first().find("h2").text().replace('ז"ל','').trim();
    },
    "parseProfileData": parseGravezMe
});


// Parse FindAGrave
function parseGravezMe(htmlstring, familymembers, relation) {
    var parsed = $(htmlstring.replace(/<img/ig, "<gmi"));
    relation = relation || "";
    
    var focusdaterange = "";

    var focusperson = parsed.find(".name").first().find("h2").text();
    focusperson = focusperson.replace('ז"ל','').trim();

    var genderval = "unknown";

    if (relation === "") {
        focusgender = genderval;
    } else if (exists(relation.genderval) && genderval === "unknown") {
        genderval = relation.genderval
    }

    if (parsed.find(".name").first().find("h5").text() != "") {
        const prefix = parsed.find(".name").first().find("h5").text().trim().split(" ")[0]

        if (prefix == "בן" || prefix == "Son"){
            genderval = "male";
        } else if (prefix == "בת" || prefix == "Daughter") {
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

    // Herbrew or English
    let deathField = parsed.find("h6:contains('תאריך פטירה')");
    if (deathField.text() == "") {
        deathField = parsed.find("h6:contains('Date of death')")
    }
    if (deathField.text() != "") {
        profiledata = addEvent(profiledata, "death", deathField.next("span").first().text().split("|")[1].trim(), "");
    } 

    // Herbrew or English
    let burialField = parsed.find("h6:contains('תאריך קבורה')");
    if (burialField.text() == "") {
        burialField = parsed.find("h6:contains('Burial date')")
    }
    let burialDate = "";
    if (burialField.text() != "") {
        burialDate = burialField.next("span").first().text().split("|")[1].trim();
    }
    cemname = parsed.find(".location-wrap").find("span").first().text();
    
    if (burialDate != "" || cemname != "") {
        profiledata = addEvent(profiledata, "burial", burialDate, cemname);
    }

    // ---------------------- Profile Continued --------------------
    profiledata["alive"] = false; //assume deceased
    const imagedata = parsed.find(".deceased-image").children();
    
    for (var i = 0; i < imagedata.length; i++) {
        let src = $(imagedata[i]).attr( "src" );
        profiledata["image"] = src;
        profiledata["thumb"] = src.replace("/Medium/", "/Small/");
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

