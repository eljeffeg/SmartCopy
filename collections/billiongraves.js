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
            dates.push(parseDate(data.birthDate, null, dateFormat).year);
        }
        if (exists(data.deathDate)){
            dates.push(parseDate(data.deathDate, null, dateFormat).year);
        }

        if (dates.length > 0) {
            focusrange = dates.join("-")
        }
    },
    "parseProfileData": parseBillionGraves
});

const dateFormat = "YYYY-MM-DD";

// Parse FindAGrave
function parseBillionGraves(htmlstring, familymembers, relation) {

    $("#experimentalmessage").text("Note: BillionGraves images will not copy for technical reasons, so the preview has been disabled. This is not a bug. Sorry, you'll have to do that part manually.");
    $("#experimentalmessage").show();
    relation = relation || "";
    var parsed = $(htmlstring.replace(/<img[^>]*>/ig,""));
    var data = getData(htmlstring);

    var dates = []
    if (exists(data.birthDate)){
        dates.push(parseDate(data.birthDate, null, dateFormat).year);
    }
    if (exists(data.deathDate)){
        dates.push(parseDate(data.deathDate, null, dateFormat).year);
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

    if (exists(data.birthDate)) {
        profiledata = addEvent(profiledata, "birth", displayDate(parseDate(data.birthDate, null, dateFormat)), '');
    }

    if (exists(data.deathDate)) {
        profiledata = addEvent(profiledata, "death", displayDate(parseDate(data.deathDate, null, dateFormat)), "");
    }
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
        const addressComponents = ['addressLocality', 'addressRegion', 'addressCountry'];
        addressComponents.forEach(component => {
            if (cemeteryplace[component] && cemeteryplace[component].trim() !== "") {
                locsplit.push(cemeteryplace[component].trim());
            }
        });
    }
    locsplit.unshift(cemname);
    const cemetery = locsplit.join(", ");
    profiledata = addEvent(profiledata, "burial", "", cemetery.trim());

    // ---------------------- Profile Continued --------------------

    profiledata["alive"] = false; //assume deceased
    if (exists(data.image)) {
        const imageUrl = data.image;
        profiledata["thumb"] = imageUrl;
        profiledata["image"] = imageUrl.replace("&p1=128&p2=0", "");
    }

    // Get Image, to get a full image, ommit the last '&p1=128&p2=0' from:
    // e.g. https://billiongraves.com/api/1.4/selectimage?tkn=med12345&p1=128&p2=0

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

function displayDate(vardate) {
    let formattedDate = ""
    if ("day" in vardate && "month" in vardate && "year" in vardate) {
        let date = moment({year: vardate["year"], month: vardate["month"] - 1, day: vardate["day"]});
        formattedDate = date.format("MMMM D, YYYY");
    } else if ("month" in vardate && "year" in vardate) {
        let date = moment({year: vardate["year"], month: vardate["month"] - 1})
        formattedDate = date.format("MMMM YYYY");
    } else if ("year" in vardate) {
        let date = moment({year: vardate["year"]});
        formattedDate = date.format("YYYY");
    }
    return formattedDate;
}
