// Parse MyHeritage
function parseMyHeritage(htmlstring, familymembers, relation) {
    relation = relation || "";
    var parsed = $(htmlstring.replace(/<img/ig, "<gmi"));
    var focusdaterange = "";
    var fperson = parsed.find("span.FL_LabelxxLargeBold");
    var focusperson = fperson.text();
    document.getElementById("readstatus").innerText = focusperson;
    var imageflag = false;
    var genderval = "unknown";



    if (relation === "") {
        focusgender = genderval;
    }

    var aboutdata = "";
    var profiledata = {name: focusperson, gender: genderval, status: relation.title};



    if (familymembers) {
        loadGeniData();
        var famid = 0;
    }

    // ---------------------- Profile Data --------------------
    if (focusdaterange !== "") {
        profiledata["daterange"] = focusdaterange;
    }
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;

    fperson = parsed.find('td.FL_LabelBold');
    for (var i = 0; i < fperson.length; i++) {

        var rowtitle = $(fperson[i]).text().toLowerCase();
        var dateval = $(fperson[i]).next('td').text();
        if (dateval.indexOf("(") !== -1) {
            dateval = dateval.substring(0, dateval.indexOf("("));
        }
        if (rowtitle.startsWith("born")) {
            data = parseWikiEvent(dateval);
            if (!$.isEmptyObject(data)) {
                profiledata["birth"] = data;
            }
        } else if (rowtitle.startsWith("died")) {
            data = parseWikiEvent(dateval);
            if (!$.isEmptyObject(data)) {
                if (exists(data.date)) {
                    deathdtflag = true;
                }
                profiledata["death"] = data;
            }
        } else if (rowtitle.startsWith("burial:")) {
            //TODO Not sure where this is at yet
            buriallcflag = true;
        }
    }


    if (aboutdata !== "") {
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