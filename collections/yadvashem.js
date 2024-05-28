// Parse YadVaShem.me Records
registerCollection({
    reload: false,
    recordtype: "YadVaShem record",
    prepareUrl: function(url) {
        if (startsWithHTTP(url,"https://collections.yadvashem.org"))
            return url;
    },
    collectionMatch: function(url) {
        return startsWithHTTP(url,"https://collections.yadvashem.org") && getYadVaShemUrlItemId(url);
    },
    parseData: function(url) {
        if (startsWithHTTP(url,"https://collections.yadvashem.org") && getYadVaShemUrlItemId(url)) {
            focusURLid = getYadVaShemUrlItemId(url);
            getPageCode();
        } else {
            document.querySelector('#loginspinner').style.display = "none";
            setMessage(warningmsg, 'Please select one of the Profile pages on this site.');
        }
    },
    loadPage: function(request) {
        let parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        focusname = parsed.find(".header_title").first().text().trim();
    },
    parseProfileData: parseYadVaShem
});

const yadvashemAPIurl = "https://yv360.yadvashem.org/api/Names/GetSingleFullDetails?source=Page%20of%20Testemony";

function getItemIdStr() {
    const lang = getLang();
    switch (lang) {
        case "en":
            return EN_TRANSLATIONS.get(item_id_str);
        case "he":
            return HE_TRANSLATIONS.get(item_id_str);
        case "ru":
            return RU_TRANSLATIONS.get(item_id_str);
        case "es":
            return ES_TRANSLATIONS.get(item_id_str);
        case "de":
            return DE_TRANSLATIONS.get(item_id_str);
        case "fr":
            return FR_TRANSLATIONS.get(item_id_str);
        default:
            return "Item ID";
    }
}

const item_id_str = "item_id";
const EN_TRANSLATIONS = new Map([
    [item_id_str, "Item ID"]
]);

const HE_TRANSLATIONS = new Map([
    [item_id_str,  "מספר פריט"]
]);

const RU_TRANSLATIONS = new Map([
    [item_id_str, "Идентификационный номер"]
]);

const ES_TRANSLATIONS = new Map([
    [item_id_str,  "Número de registro"]
]);

const DE_TRANSLATIONS = new Map([
    [item_id_str, "Datensatznummer"]
]);

const FR_TRANSLATIONS = new Map([
    [item_id_str,  "Numéro identifiant"]
]);


function parseYadVaShemJson(ys_person, focusperson, familymembers, relation) {
    let focusdaterange = "";
    let genderval = "unknown";

    let genderField = ys_person.gender;
    if (genderField) {
        genderval = genderField.toLowerCase();
    }

    if (relation === "") {
        focusgender = genderval;
    } else if (exists(relation.genderval) && genderval === "unknown") {
        genderval = relation.genderval
    }

    let name = focusperson;
    if (ys_person.firstName && ys_person.lastName) {
        name = ys_person.firstName + " " + ys_person.lastName;
        if (ys_person.maidenName) {
            name += " (" + ys_person.maidenName + ")";
        }
    }
    let profiledata = {name: name, gender: genderval, status: relation.title, url: tablink};

    let famid = 0;
    if (familymembers) {
        loadGeniData();
    }

    // ---------------------- Profile Data --------------------
    if (focusdaterange !== "") {
        profiledata["daterange"] = focusdaterange;
    }

    if (exists(ys_person.dateOfBirth)) {
        let placeOfBirth = ys_person.placeOfBirth;
        profiledata = addEvent(profiledata, "birth", cleanDate(ys_person.dateOfBirth), placeOfBirth);
    }

    if (exists(ys_person.dateOfDeath)) {
        let placeOfDeath = ys_person.placeOfDeath;
        profiledata = addEvent(profiledata, "death", cleanDate(ys_person.dateOfBirth), placeOfDeath);
    }

    if (exists(ys_person.fathersFirstName)) {
        let fm_title = "father";
        let fm_name = ys_person.fathersFirstName + " " + ys_person.lastName;
        let fm_gender = "male";

        addFamilyMember(fm_name, fm_gender, fm_title, famid)

        famid++;
    }

    if (exists(ys_person.mothersFirstName)) {
        let fm_title = "mother";
        let fm_name = ys_person.mothersFirstName + " " + ys_person.mothersMaidenName;
        let fm_gender = "female";

        addFamilyMember(fm_name, fm_gender, fm_title, famid)

        famid++;
    }

    if (exists(ys_person.spoucesFirstName)) {

        let fm_name = ys_person.spoucesFirstName;
        if (exists(ys_person.spoucesMaidenName)) {
            fm_name += " " + ys_person.spoucesMaidenName;
        } else {
            fm_name += " " + ys_person.lastName;
        }

        let fm_gender;
        let fm_title;
        if (genderval === "male") {
            fm_gender = "female";
            fm_title = "wife";
        } else {
            fm_gender = "male";
            fm_title = "husband";
        }

        addFamilyMember(fm_name, fm_gender, fm_title, famid)

        famid++;
    }

    return profiledata;
}

function addFamilyMember(name, gender, title, famid) {
    let subdata = {name: name, title: title};
    subdata["url"] = tablink;
    subdata["itemId"] = "";
    subdata["profile_id"] = famid;

    parentlist.push(famid);

    let familyMember = {name: name, gender: gender, status: title, alive: false}
    familyMember = updateInfoData(familyMember, subdata);

    if (!exists(alldata["family"][title])) {
        alldata["family"][title] = [];
    }
    alldata["family"][title].push(familyMember);
}

function parseYadVaShem(htmlstring, familymembers, relation) {
    let parsed = $(htmlstring.replace(/<img/ig, "<gmi"));
    relation = relation || "";

    let focusperson = parsed.find(".header_title").first().text().trim();
    let records = parsed.find(".mat-mdc-tab-body-active").first().find(".record_row");

    let record_id;

    const itemIdStr = getItemIdStr();
    for (let i = records.length - 1; i >= 0; i--) {
        if (records[i].getElementsByClassName("names_details_title")[0].innerText === itemIdStr) {
            record_id = records[i].getElementsByClassName("names_details")[0].innerText;
            break;
        }
    }

    let url = yadvashemAPIurl;
    url = updateUrlParam(url, "lang", getLang());
    url = updateUrlParam(url, "id", record_id);

    let profiledata = {};

    familystatus.push("about");
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url
    }, function (response) {

        let json_obj = JSON.parse(response.source);

        const ys_person = json_obj.details.reduce((acc, detail) => {
            // Take first value for each field
            if (acc[fieldNameToLabelMap.get(detail.id)]) {
                return acc;
            }

            acc[fieldNameToLabelMap.get(detail.id)] = detail.value;
            return acc;
        }, {});

        profiledata = parseYadVaShemJson(ys_person, focusperson, familymembers, relation);

        alldata["profile"] = profiledata;
        alldata["scorefactors"] = smscorefactors;
        updateGeo();

        familystatus.pop();
        // let person = parseFindAGrave(response.source, familymembers, response.variable);
        // person = updateInfoData(person, arg);
        // databyid[arg.profile_id] = person;
        // alldata["family"][arg.title].push(person);
        // familystatus.pop();
    });



    // ---------------------- Profile Continued --------------------

    return profiledata;
}

const urlRegex = /\/([a-z]{2})\/names\/(\d+)/;

function getLang() {
    const match = tablink.match(urlRegex);
    if (match) {
        return match[1];
    }
    return null;
}

function getYadVaShemUrlItemId(url) {
    const match = url.match(urlRegex);

    if (match) {
        return match[2];
    }

    return null;
}

const fieldNameToLabelMap = new Map([
    ["GENDER", "gender"],
    ["YSLN", "lastName"],
    ["YSFN", "firstName"],
    ["YSMN", "maidenName"],
    ["AGE", "age"],
    ["YSODB", "dateOfBirth"],
    ["YSPB", "placeOfBirth"],
    ["YSFTHN", "fathersFirstName"],
    ["YSMTHN", "mothersFirstName"],
    ["YSMMN", "mothersMaidenName"],
    ["YSFST", "maritalStatus"],
    ["YSSPN", "spoucesFirstName"],
    ["YSSMN", "spoucesMaidenName"],
    ["YSPLD", "placeOfDeath"],
    ["YSDD", "dateOfDeath"],
    ["YSPLP", "permanentPlaceOfResidence"],
    ["YSPLW", "placeDuringTheWar"],
    ["YSSBN", "submitterName"],
    ["YSFR", "relationshipToVictim"],
    ["PROF", "profession"],
    ["LIF_391", "causeOfDeath"],
    ["LIF_676", "statusAccordingToSource"]
]);