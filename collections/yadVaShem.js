// Parse YadVaShem.me Records
registerCollection({
    "reload": false,
    "recordtype": "YadVaShem record",
    "prepareUrl": function(url) {
        if (startsWithHTTP(url,"https://yvng.yadvashem.org/nameDetails.html")) {
            url = updateUrlParam(url, "language", "en");
        }
        return url;
    },
    "collectionMatch": function(url) {
        return startsWithHTTP(url,"https://yvng.yadvashem.org/nameDetails.html") && getUrlParam(url, "itemId");
    },
    "parseData": function(url) {
        if (startsWithHTTP(url,"https://yvng.yadvashem.org/nameDetails.html") && getUrlParam(url, "itemId")) { 
            focusURLid = getUrlParam(url, "itemId");
            getPageCode();
        } else {
            document.querySelector('#loginspinner').style.display = "none";
            setMessage(warningmsg, 'Please select one of the Profile pages on this site.');
        }
    },
    "loadPage": function(request) {
        var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        focusname = parsed.find("#title").first().text().trim();
    },
    "parseProfileData": parseYadVaShem
});


// Parse FindAGrave
function parseYadVaShem(htmlstring, familymembers, relation) {
    var parsed = $(htmlstring.replace(/<img/ig, "<gmi"));
    relation = relation || "";

    var focusperson = parsed.find("#title").first().text().trim();
    var focusdaterange = "";
    var genderval = "unknown";

    var genderField = getYadVaShemData(parsed, "gender");
    if (genderField) {
        genderval = genderField;
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
    
    let birthDate = getYadVaShemData(parsed, "dateOfBirth");
    if (birthDate != "") {
        let placeOfBirth = getYadVaShemData(parsed, "placeOfBirth");
        profiledata = addEvent(profiledata, "birth", birthDate, placeOfBirth);
    }

    let deathDate = getYadVaShemData(parsed, "dateOfDeath");
    if (deathDate != "") {
        let placeOfDeath = getYadVaShemData(parsed, "placeOfDeath");
        profiledata = addEvent(profiledata, "death", deathDate, placeOfDeath);
    }

    // ---------------------- Profile Continued --------------------

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

function getYadVaShemData(parsed, fieldName) {
    if (!fieldNameToLabelMap.has(fieldName)) {
        console.log("Field [" + fieldName + "] is unknown for YadVaShem fields");
        return undefined;
    }

    field = fieldNameToLabelMap.get(fieldName);
    return parsed.find("[id^="+field+"]").text();
}

const fieldNameToLabelMap = new Map([
    ["gender", "lbl_GENDER"],
    ["lastName", "lbl_YSLN"],
    ["firstName", "lbl_YSFN"],
    ["maidenName", "lbl_YSMN"],
    ["age", "lbl_AGE"],
    ["dateOfBirth", "lbl_YSODB"],
    ["placeOfBirth", "lbl_YSPB"],
    ["fathersFirstName", "lbl_YSFTHN"],
    ["mothersFirstName", "lbl_YSMTHN"],
    ["mothersMaidenName", "lbl_YSMMN"],
    ["maritalStatus", "lbl_YSFST"],
    ["spoucesFirstName", "lbl_YSSPN"],
    ["spoucesMaidenName", "lbl_YSSMN"],
    ["placeOfDeath", "lbl_YSPLD"],
    ["dateOfDeath", "lbl_YSDD"]
]);