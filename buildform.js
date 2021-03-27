var alldata = {};
alldata["family"] = {};
var geostatus = [];
var geoid = 0;
var geolocation = [];
var parsecomplete = false;
var unionurls = [];
var databyid = [];
var childlist = [];
var marriagedata = [];
var parentmarset = [];
var parentmarriage;
var parentlist = [];
var parentflag = false;
var hideprofile = false;
var genispouse = [];
var myhspouse = [];
var focusabout = "";
var focusnicknames = "";
var parentmarriageid = "";
var geounique = [];
var geocleanup = [];

function updateGeo() {
    if (familystatus.length > 0) {
        setTimeout(updateGeo, 50);
    } else if (!captcha) {
        var values = [];
        console.log("Family Processed...");
        $("#readstatus").html("Determining Locations");
        var listvalues = ["birth", "baptism", "marriage", "divorce", "death", "burial"];
        for (var list in listvalues) if (listvalues.hasOwnProperty(list)) {
            var title = listvalues[list];
            var memberobj = alldata["profile"][title];
            if (exists(memberobj)) {
                for (var item in memberobj) if (memberobj.hasOwnProperty(item)) {
                    if (memberobj[item].location !== undefined && !values.includes(memberobj[item].location)) {
                        values.push(memberobj[item].location);
                        geounique.push(memberobj[item]);
                    } else if (memberobj[item].location !== undefined) {
                        geocleanup.push(memberobj[item]);
                    } else {
                        geounique.push(memberobj[item]);
                    }
                }
            }
        }
        if (locationtest) {
            $.get('location-test.txt', function (data) {
                var lines = data.split("\n");
                $.each(lines, function (n, location) {
                    if (location !== "" && !location.startsWith("#")) {
                        var splitloc = location.split("|");
                        var locationset = {id: geoid, location: splitloc[0]};
                        queryGeo(locationset, splitloc[1]);
                        geoid++;
                    }
                });
            });
        }

        var obj = alldata["family"];

        for (var relationship in obj) if (obj.hasOwnProperty(relationship)) {
            var members = obj[relationship];

            for (var member in members) if (members.hasOwnProperty(member)) {
                for (var list in listvalues) if (listvalues.hasOwnProperty(list)) {
                    var title = listvalues[list];

                    var memberobj = members[member][title];
                    if (exists(memberobj)) {
                        for (var item in memberobj) if (memberobj.hasOwnProperty(item)) {
                            if (memberobj[item].location !== undefined && !values.includes(memberobj[item].location)) {
                                values.push(memberobj[item].location);
                                geounique.push(memberobj[item]);
                            } else if (memberobj[item].location !== undefined) {
                                geocleanup.push(memberobj[item]);
                            } else {
                                geounique.push(memberobj[item]);
                            }
                        }
                    }
                }
            }
        }
        for (var i=0; i<geounique.length; i++) {
            queryGeo(geounique[i]);
        }
        updateFamily();
    }
}

function updateFamily() {
    
    if (geostatus.length > 0) {
        setTimeout(updateFamily, 50);
    } else {
        //console.log(geounique);
        for (var i=0; i < geocleanup.length; i++) {
            for (var x=0; x < geounique.length; x++) {
                if (geocleanup[i].location === geounique[x].location) {
                    geolocation[geocleanup[i].id] = geolocation[geounique[x].id];
                    //console.log("Adding " + geounique[x].id + " to " + geocleanup[i].id);
                    //console.log(geocleanup[i].location);
                    continue;
                }
            }
        }
        //console.log(geolocation);
        console.log("Geo Processed...");
        $("#readstatus").html("");
        updateGenders();
        buildForm();
        document.getElementById("loading").style.display = "none";
    }
}

function updateGeoLocation() {
    if (geostatus.length > 0) {
        setTimeout(updateGeoLocation, 50);
    } else {
        var locationdata = geolocation[geoid-1];
        var eventrow = $('#'+googlerequery);
        var pincolor = "clear";
        if (locationdata.ambiguous || locationdata.count > 1) {
            pincolor = "yellow";
        } else if (locationdata.count === 0) {
            pincolor = "red";
        }
        var geoon = $($(eventrow.closest("tr")[0]).find("img")[0]).attr("src") === "images/geoon.png";
        var titleobj = $($(eventrow.closest("tr")[0]).find("img")[2]);
        titleobj.attr("src", "images/" + pincolor + "pin.png");
        var ptable = eventrow.closest("table");
        if (exists(ptable[0].id) && ptable[0].id !== "profiletable") {
            var tableid = ptable[0].id.replace("familytable_", "");
            var geocheck = $(ptable).find(".geopin");
            var red = false;
            var yellow = false;
            for (var i = 0; i < geocheck.length; i++) {
                var link = $(geocheck[i]).attr('src');
                if (link.contains("redpin")) {
                    red = true;
                } else if (link.contains("yellowpin")) {
                    yellow = true;
                }
            }
            if (red) {
                $("#" + tableid + "gpin").attr("src", "images/redpin.png");
                $("#" + tableid + "gpin").attr("title", "Location lookup failed");
            } else if (yellow) {
                $("#" + tableid + "gpin").attr("src", "images/yellowpin.png");
                $("#" + tableid + "gpin").attr("title", "Location lookup may be incorrect");
            } else {
                $("#" + tableid + "gpin").attr("src", "images/clearpin.png");
                $("#" + tableid + "gpin").attr("title", "");
            }
        }
        var globalloc = $('#forcegeoswitch').prop('checked');
        if (globalloc) {
            $($($(eventrow).closest("tr")[0]).find("input[type=checkbox]")[0]).prop("checked", true);
        }
        var titlesplit = titleobj[0].nextSibling.nodeValue.split("Location: ");
        titleobj[0].nextSibling.nodeValue = titlesplit[0] + "Location: " + locationdata.query;
        eventrow = $(eventrow).closest("tr")[0].nextElementSibling;
        $(eventrow).find("input[type=text]")[0].value = locationdata.query;
        $($(eventrow).find("input[type=checkbox]")[0]).prop("checked", geoon).trigger("click");
        eventrow = $(eventrow).closest("tr")[0].nextElementSibling;
        $(eventrow).find("input[type=text]")[0].value = locationdata.place;
        $($(eventrow).find("input[type=checkbox]")[0]).prop("checked", !((locationdata.place !== "" || globalloc) && geoon)).trigger("click");
        eventrow = $(eventrow).closest("tr")[0].nextElementSibling;
        $(eventrow).find("input[type=text]")[0].value = locationdata.city;
        $($(eventrow).find("input[type=checkbox]")[0]).prop("checked", !((locationdata.city !== "" || globalloc) && geoon)).trigger("click");
        eventrow = $(eventrow).closest("tr")[0].nextElementSibling;
        $(eventrow).find("input[type=text]")[0].value = locationdata.county;
        $($(eventrow).find("input[type=checkbox]")[0]).prop("checked", !((locationdata.county !== "" || globalloc) && geoon)).trigger("click");
        eventrow = $(eventrow).closest("tr")[0].nextElementSibling;
        $(eventrow).find("input[type=text]")[0].value = locationdata.state;
        $($(eventrow).find("input[type=checkbox]")[0]).prop("checked", !((locationdata.state !== "" || globalloc) && geoon)).trigger("click");
        eventrow = $(eventrow).closest("tr")[0].nextElementSibling;
        $(eventrow).find("input[type=text]")[0].value = locationdata.country;
        $($(eventrow).find("input[type=checkbox]")[0]).prop("checked", !((locationdata.country !== "" || globalloc) && geoon)).trigger("click");
        $("body").toggleClass("wait");
    }
}

function updateGenders() {
    var obj = alldata["family"];
    var parentgender;
    var spousegender;
    for (var relationship in obj) if (obj.hasOwnProperty(relationship)) {
        if (isParent(relationship)) {
            parentgender = obj[relationship];
        } else if (isPartner(relationship)) {
            spousegender = obj[relationship];
        }
    }
    if (exists(parentgender) && parentgender.length > 1) {
        if (parentgender[0].gender === "unknown" && parentgender[1].gender !== "unknown") {
            parentgender[0].gender = reverseGender(parentgender[1].gender);
        } else if (parentgender[1].gender === "unknown" && parentgender[0].gender !== "unknown") {
            parentgender[1].gender = reverseGender(parentgender[0].gender);
        }
    }
    if (focusgender === "unknown" && exists(spousegender) && spousegender.length > 0) {
        if (spousegender[0].gender !== "unknown") {
            focusgender = reverseGender(spousegender[0].gender);
        }
    }
}

function reverseGender(gender) {
    if (gender === "female") {
        return "male";
    } else if (gender === "male") {
        return "female";
    }
    return "unknown";
}

function buildForm() {
    var obj;
    var listvalues = ["birth", "baptism", "death", "burial"];
    var scorefactors = alldata["scorefactors"];
    var hidden = $('#hideemptyonoffswitch').prop('checked');
    var x = 0;
    var ck = 0;
    var div = $("#profiletable");
    var membersstring = $(div[0]).html();
    var nameval = NameParse.parse(focusname, mnameonoff);
    if (focusgender === "unknown" && alldata["profile"].gender !== "unknown") {
        focusgender = alldata["profile"].gender;
    }
    if ($('#birthonoffswitch').prop('checked') && nameval.birthName === "") {
        if (focusgender === "male") {
            nameval.birthName = nameval.lastName;
        } else if (focusgender === "female" && setBirthName("focus", nameval.lastName, mnameonoff)) {
            nameval.birthName = nameval.lastName;
            nameval.lastName = "";
        }
    }
    if (exists(alldata["profile"].nicknames)) {
        if (nameval.nickName !== "") {
            nameval.nickName += ",";
        }
        nameval.nickName += alldata["profile"].nicknames;
    }
    var displayname = "";
    if (nameval.prefix !== "") {
        //Deprecated due to title field
        //displayname = nameval.displayname;
    }

    var nameimage = genifocusdata.lockIcon("name");
    var namescore = scorefactors.contains("middle name");
    if (namescore && mnameonoff) {
        membersstring +=
            '<tr><td class="profilediv"><input type="checkbox" class="checknext">Title:</td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="title" value="' + nameval.prefix + '" disabled></td><td class="genisliderow"><img src="images/' + nameimage + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("title") + '" disabled></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext">First Name:</td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="first_name" value="' + nameval.firstName + '" disabled></td><td class="genisliderow"><img src="images/' + nameimage + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("first_name") + '" disabled></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext" checked>Middle Name:</td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="middle_name" value="' + nameval.middleName + '"></td><td class="genisliderow"><img src="images/' + nameimage + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("middle_name") + '" disabled></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext">Last Name:</td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="last_name" value="' + nameval.lastName + '" disabled></td><td class="genisliderow"><img src="images/' + nameimage + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("last_name") + '" disabled></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext">Birth Name:</td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="maiden_name" value="' + nameval.birthName + '" disabled></td><td class="genisliderow"><img src="images/' + nameimage + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("maiden_name") + '" disabled></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext">Suffix: </td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="suffix" value="' + nameval.suffix + '" disabled></td><td class="genisliderow"><img src="images/' + nameimage + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("suffix") + '" disabled></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext">Display Name: </td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="display_name" value="' + displayname + '" disabled></td><td class="genisliderow"><img src="images/' + nameimage + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("display_name") + '" disabled></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext">Also Known As: </td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="nicknames" value="' + nameval.nickName + '" disabled></td><td class="genisliderow"><img src="images/append.png" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("nicknames") + '" disabled></td></tr>';
        x += 1;
    } else {
        membersstring +=
            '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Title:</td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="title" value="' + nameval.prefix + '" disabled></td><td class="genisliderow"><img src="images/' + nameimage + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("title") + '" disabled></td></tr>' +
                '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">First Name:</td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="first_name" value="' + nameval.firstName + '" disabled></td><td class="genisliderow"><img src="images/' + nameimage + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("first_name") + '" disabled></td></tr>' +
                '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Middle Name:</td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="middle_name" value="' + nameval.middleName + '" disabled></td><td class="genisliderow"><img src="images/' + nameimage + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("middle_name") + '" disabled></td></tr>' +
                '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Last Name:</td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="last_name" value="' + nameval.lastName + '" disabled></td><td class="genisliderow"><img src="images/' + nameimage + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("last_name") + '" disabled></td></tr>' +
                '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Birth Name:</td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="maiden_name" value="' + nameval.birthName + '" disabled></td><td class="genisliderow"><img src="images/' + nameimage + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("maiden_name") + '" disabled></td></tr>' +
                '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Suffix: </td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="suffix" value="' + nameval.suffix + '" disabled></td><td class="genisliderow"><img src="images/' + nameimage + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("suffix") + '" disabled></td></tr>' +
                '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Display Name: </td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="display_name" value="' + displayname + '" disabled></td><td class="genisliderow"><img src="images/' + nameimage + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("display_name") + '" disabled></td></tr>' +
                '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Also Known As: </td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="nicknames" value="' + nameval.nickName + '" disabled><td class="genisliderow"><img src="images/append.png" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("nicknames") + '" disabled></td></td></tr>';
    }
    $(div[0]).html(membersstring);
    if (exists(alldata["profile"]["thumb"])) {
        membersstring = $(div[0]).html();
        if (x > 0) {
            membersstring = membersstring + '<tr><td colspan="3" style="padding: 0;"><div class="separator"></div></td></tr>';
        } else {
            membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td colspan="3" style="padding: 0;"><div class="separator"></div></td></tr>';
        }
        var title = "photo";
        var scorephoto = false;
        if (scorefactors.contains(title) && $('#photoonoffswitch').prop('checked')) {
            scorephoto = true;
            ck++;
        }
        x += 1;
        var thumbnail = alldata["profile"]["thumb"];
        var image = alldata["profile"]["image"];
        if (Object.getOwnPropertyNames(fsimage).length > 0) {
            for (var imgurl in fsimage) {
                if (imgurl == thumbnail) {
                    thumbnail = fsimage[imgurl];
                    image = thumbnail;
                    break;
                }
            }
        }
        var credit = alldata["profile"]["imagecredit"] || "";
        membersstring = membersstring +
            '<tr id="photo"><td class="profilediv"><input type="checkbox" class="checknext photocheck" ' + isChecked(thumbnail, scorephoto) + '>' +
            capFL(title) + ':</td><td style="padding: 0;"><div style="float: right;"><input type="hidden" class="photocheck" name="' + title + '" value="' + image + '" ' + isEnabled(thumbnail, scorephoto) + ' author="' + credit + '"><img style="max-width: 150px; max-height: 120px; object-fit: contain; padding: 0px;" src="' + thumbnail + '"></div></td><td class="genisliderow" style="vertical-align: middle; padding: 0;"><div style="display: inline-block; vertical-align: middle; padding: 0;"><img src="' + isAppend(genifocusdata.get("photo_urls")) + '" class="genislideimage" style="padding-left: 5px;"></div><div style="display: inline-block; vertical-align: middle; padding: 0;"><img align="right" style="max-width: 150px; max-height: 120px; object-fit: contain; padding: 0px;" src="' + genifocusdata.get("photo_urls") + '"></div></td></tr>';
        membersstring = membersstring + '<tr><td colspan="3" style="padding: 0;"><div class="separator"></div></td></tr>';
        $(div[0]).html(membersstring);
    }

    var sepx = 0;
    if (exists(alldata["profile"]["occupation"])) {
        membersstring = $(div[0]).html();
        sepx++;
        var title = "occupation";
        var scoreoccupation = false;
        if (scorefactors.contains(title)) {
            scoreoccupation = true;
            ck++;
        }
        var occupation = alldata["profile"]["occupation"];
        membersstring = membersstring +
            '<tr id="occupation"><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(occupation, scoreoccupation) + '>' +
            capFL(title) + ': </td><td style="float:right; padding: 0;"><input type="text" class="formtext" name="' + title + '" value="' + occupation + '" ' + isEnabled(occupation, scoreoccupation) + '></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("occupation") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("occupation") + '" disabled></td></tr>';
        $(div[0]).html(membersstring);
    } else {
        membersstring = $(div[0]).html();
        membersstring = membersstring +
            '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow" id="occupation"><td class="profilediv"><input type="checkbox" class="checknext">Occupation: </td><td style="float:right; padding: 0;"><input type="text" class="formtext" name="occupation" disabled></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("occupation") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("occupation") + '" disabled></td></tr>';
        $(div[0]).html(membersstring);
    }
    if (genigender === "unknown" && focusgender !== "unknown") {
        var gender = focusgender;
        sepx++;
        membersstring = $(div[0]).html();
        membersstring = membersstring + '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(gender, true) + '>Gender: </td><td style="float:right; padding: 0;"><select class="formselect" style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="gender" ' + isEnabled(gender, true) + '>' +
            '<option value="male" ' + setGender("male", gender) + '>Male</option><option value="female" ' + setGender("female", gender) + '>Female</option><option value="unknown" ' + setGender("unknown", gender) + '>Unknown</option></select></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("gender") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + capFL(genifocusdata.get("gender")) + '" disabled></td></tr>';
        $(div[0]).html(membersstring);
    } else {
        var gender = focusgender;
        membersstring = $(div[0]).html();
        membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(gender, false) + '>Gender: </td><td style="float:right; padding: 0;"><select class="formselect" style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="gender" ' + isEnabled(gender, false) + '>' +
            '<option value="male" ' + setGender("male", gender) + '>Male</option><option value="female" ' + setGender("female", gender) + '>Female</option><option value="unknown" ' + setGender("unknown", gender) + '>Unknown</option></select></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("gender") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + capFL(genifocusdata.get("gender")) + '" disabled></td></tr>';
        $(div[0]).html(membersstring);
    }
    var living = false;
    if (exists(alldata["profile"].alive)) {
        living = alldata["profile"].alive;
    } else if (!(alldata["profile"]["death"]) && !(alldata["profile"]["burial"]) && (geniliving || !exists(geniliving))) {
        living = true;
        //Focus Profile - If the older than 95, default to deceased
        if (alldata["profile"]["birth"]) {
            var fulldate = null;
            for (var b = 0; b < alldata["profile"]["birth"].length; b++) {
                if (exists(alldata["profile"]["birth"][b].date) && alldata["profile"]["birth"][b].date.trim() !== "") {
                    fulldate = alldata["profile"]["birth"][b].date;
                    break;
                }
            }
            if (fulldate !== null) {
                var birthval = parseDate(fulldate, false);
                var agelimit = moment.utc().format("YYYY") - 95;
                if (exists(birthval.year) && birthval.year < agelimit) {
                    living = false;
                }
            }
        }
    }
    membersstring = $(div[0]).html();
    if (geniliving && !living) {
        sepx++;
        membersstring = membersstring + '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(living, true) + '>Vital: </td><td style="float:right; padding: 0;"><select class="formselect" style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="is_alive" ' + isEnabled(living, true) + '>' +
            '<option value=false ' + setLiving("deceased", living) + '>Deceased</option><option value=true ' + setLiving("living", living) + '>Living</option></select></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("living") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + isAlive(genifocusdata.get("is_alive")) + '" disabled></td></tr>';
    } else {
        if (!geniliving && living) {
            living = geniliving;
        }
        membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(living, false) + '>Vital: </td><td style="float:right; padding: 0;"><select class="formselect" style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="is_alive" ' + isEnabled(living, false) + '>' +
            '<option value=false ' + setLiving("deceased", living) + '>Deceased</option><option value=true ' + setLiving("living", living) + '>Living</option></select></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("living") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + isAlive(genifocusdata.get("is_alive")) + '" disabled></td></tr>';
    }
    if ($('#privacyonoffswitch').prop('checked') && !living) {
        membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Privacy: </td><td style="float:right; padding: 0;"><select class="formselect" style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="public" ' + isEnabled(living, false) + '>' +
        '<option value="">Auto</option><option value=true selected>Public</option><option value=false>Private</option></select></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("public") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + isPublic(genifocusdata.get("public")) + '" disabled></td></tr>';
    } else {
        membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Privacy: </td><td style="float:right; padding: 0;"><select class="formselect" style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="public" ' + isEnabled(living, false) + '>' +
        '<option value="" selected>Auto</option><option value=true>Public</option><option value=false>Private</option></select></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("public") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + isPublic(genifocusdata.get("public")) + '" disabled></td></tr>';
    }
    $(div[0]).html(membersstring);
    if (exists(alldata["profile"].about)) {
        sepx++;
        membersstring = $(div[0]).html();
        var scoreabout = false;
//        if (focusabout.contains(alldata["profile"].about)) {
//            scoreabout = false;
//        }
        var about = alldata["profile"].about;
        membersstring = membersstring + '<tr><td colspan="3" style="padding: 0px;"><div class="profilediv" style="width: 100%;"><input type="checkbox" class="checknext" ' + isChecked(about, scoreabout) + '>About:<img class="genisliderow" src="images/append.png" align="right" style="width: 12px; margin-right: 3px; margin-top: 5px;"></div><div style="padding-left:4px; padding-right:6px;"><textarea rows="4" name="about_me" style="width:100%;" ' + isEnabled(about, scoreabout) + '>' + about + '</textarea></div></td></tr>';
        $(div[0]).html(membersstring);
    } else {
        membersstring = $(div[0]).html();
        membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow" id="about"><td colspan="3" style="padding: 0px;"><div class="profilediv" style="width: 100%;"><input type="checkbox" class="checknext">About:<img class="genisliderow" src="images/append.png" align="right" style="width: 12px; margin-right: 3px; margin-top: 5px;"></div><div style="padding-top: 2px; padding-left:4px; padding-right:6px;"><textarea rows="4" name="about_me" style="width:100%;"  disabled></textarea></div></td></tr>';
        $(div[0]).html(membersstring);
    }
    if (sepx === 0) {
        membersstring = $(div[0]).html();
        membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td colspan="3"><div class="separator"></div></td></tr>';
        $(div[0]).html(membersstring);
    } else {
        membersstring = $(div[0]).html();
        membersstring = membersstring + '<tr><td colspan="3" style="padding: 0;"><div class="separator"></div></td></tr>';
        $(div[0]).html(membersstring);
    }
    sepx = x + sepx;
    x = 0;
    var geoplace = "table-row";
    var geoauto = "none";
    var geoicon = "geooff.png";
    if (geoqueryCheck()) {
        geoplace = "none";
        geoauto = "table-row";
        geoicon = "geoon.png";
    }
    var geoplacehidden = " geohidden";
    var geolochidden = "";
    if (!geoqueryCheck()) {
        geoplacehidden = "";
        geolochidden = " geohidden";
    }
    // ---------------------- Profile Data --------------------
    for (var list in listvalues) if (listvalues.hasOwnProperty(list)) {
        var title = listvalues[list];
        obj = alldata["profile"][title];
        membersstring = $(div[0]).html();
        var dateicon = genifocusdata.lockIcon(title, "date");
        var locationicon = genifocusdata.lockIcon(title, "location");
        if (exists(obj) && obj.length > 0) {
            if (x > 0) {
                membersstring = membersstring + '<tr><td colspan="3" style="padding: 0;"><div class="separator"></div></td></tr>';
                // $("#"+title+"separator")[0].style.display = "block";
            }
            x++;
            var dateadded = false;
            var locationadded = false;
            var locationval = "";
            for (var item in obj) if (obj.hasOwnProperty(item)) {

                if (exists(obj[item].date)) {
                    var scored = false;
                    if (scorefactors.contains(title + " date")) {
                        scored = true;
                        //div.find("input:checkbox").prop('checked', true);
                        ck++;
                    }

                    var dateval = obj[item].date;
                     var dateambig = "";
                        if (dateAmbigous(dateval)) {
                            dateambig = 'style="color: #ff0000;" ';
                        }
                    membersstring = membersstring +
                        '<tr id="' + title + 'date"><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(dateval, scored) + '>' +
                        capFL(title) + ' Date:</td><td style="float:right;padding: 0;"><input type="text" class="formtext dateform" ' + dateambig + 'name="' + title + ':date" value="' + dateval + '" ' + isEnabled(dateval, scored) + '></td><td class="genisliderow"><img src="images/' + dateicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "date.formatted_date") + '" disabled></td></tr>';
                    dateadded = true;

                    //div[0].style.display = "block";
                    //var bd = new Date(obj[item].date);
                    //console.log(bd.getFullYear());

                }
                if (exists(obj[item].location)) {
                    var scored = false;
                    if (scorefactors.contains(title + " place")) {
                        scored = true;
                        //div.find("input:checkbox").prop('checked', true);
                        ck++;
                    }
                    var place = obj[item].location;
                    var geovar1 = geolocation[obj[item].id];
                    var pincolor = "clear";
                    var pintitle = "";
                    if (geovar1 === undefined) {
                        geovar1 = parseGoogle("");
                    }
                    if (geovar1.ambiguous || geovar1.count > 1) {
                        pincolor = "yellow";
                        pintitle = "Location lookup may be incorrect";
                    } else if (geovar1.count === 0) {
                        pincolor = "red";
                        pintitle = "Location lookup failed";
                    }
                    var placegeo = geovar1.place;
                    var city = geovar1.city;
                    var county = geovar1.county;
                    var state = geovar1.state;
                    var country = geovar1.country;
                    var geoone = ($('#forcegeoswitch').prop('checked') && (isValue(city) || isValue(county) || isValue(state) || isValue(country)));
                    locationval = locationval +
                        '<tr id="focus_'+title+'"><td colspan="3" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-left: 2px; padding-left: 5px; padding-right: 2px;"><input style="float: left; margin-left: -1px;" type="checkbox" class="geotopcheck">' +
                        '<img class="geoicon" style="cursor: pointer; float:left; padding-left: 3px; padding-top: 2px; padding-right: 4px;" alt="Toggle Geolocation" title="Toggle Geolocation" src="images/' + geoicon + '" height="14px">'; 
                        if (geoqueryCheck()) {
                            locationval = locationval + '<img src="images/edit.png" title="Edit Location" class="geoUpdateBtn" align="right" style="vertical-align: top; height: 14px; relative; top: 1px; cursor: pointer; margin-top: 2px; margin-right: 3px;">';
                        }
                        locationval = locationval + '<img class="geopin" title="' + pintitle + '" src="images/' + pincolor + 'pin.png" align="right" style="height: 14px;">' + capFL(title) + ' Location: &nbsp;' + place.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</div></td></tr>' +
                        '<tr class="geoplace' + geoplacehidden + '"style="display: ' + geoplace + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(place, scored) + '>' + capFL(title) + ' Place:</td><td style="float:right;padding: 0;"><input type="text" class="formtext" name="' + title + ':location:place_name" value="' + place + '" ' + isEnabled(place, scored) + '></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location_string") + '" disabled></td></tr>' +
                        '<tr class="geoloc' + geolochidden + '" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(placegeo, scored, geoone) + '>Place: </td><td style="float:right;padding: 0;"><input type="text" class="formtext" name="' + title + ':location:place_name_geo" value="' + placegeo + '" ' + isEnabled(placegeo, scored, geoone) + '></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location.place_name") + '" disabled></td></tr>' +
                        '<tr class="geoloc' + geolochidden + '" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(city, scored, geoone) + '>City: </td><td style="float:right;padding: 0;"><input type="text" class="formtext" name="' + title + ':location:city" value="' + city + '" ' + isEnabled(city, scored, geoone) + '></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location.city") + '" disabled></td></tr>' +
                        '<tr class="geoloc' + geolochidden + '" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(county, scored, geoone) + '>County: </td><td style="float:right;padding: 0;"><input type="text" class="formtext" name="' + title + ':location:county" value="' + county + '" ' + isEnabled(county, scored, geoone) + '></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location.county") + '" disabled></td></tr>' +
                        '<tr class="geoloc' + geolochidden + '" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(state, scored, geoone) + '>State: </td><td style="float:right;padding: 0;"><input type="text" class="formtext" name="' + title + ':location:state" value="' + state + '" ' + isEnabled(state, scored, geoone) + '></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location.state") + '" disabled></td></tr>' +
                        '<tr class="geoloc' + geolochidden + '" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(country, scored, geoone) + '>Country: </td><td style="float:right;padding: 0;"><input type="text" class="formtext" name="' + title + ':location:country" value="' + country + '" ' + isEnabled(country, scored, geoone) + '></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location.country") + '" disabled></td></tr>';
                    locationadded = true;
                    //div[0].style.display = "block";
                }
            }
            if (!dateadded) {
                membersstring = membersstring +
                    '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">' + capFL(title) + ' Date: </td><td style="float:right;"><input type="text" class="formtext dateform" name="' + title + ':date" disabled></td><td class="genisliderow"><img src="images/' + dateicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "date.formatted_date") + '" disabled></td></tr>';
            }
            if (title === "death") {
                membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Death Cause: </td><td style="float:right;"><input type="text" class="formtext" name="cause_of_death" disabled></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("cause_of_death") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("cause_of_death") + '" disabled></td></tr>';
            }
            if (!locationadded) {
                locationval = locationval +
                    '<tr id="focus_'+title+'" class="hiddenrow" style="display: ' + isHidden(hidden) + ';"><td colspan="3" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-left: 2px; padding-left: 5px; padding-right: 2px;"><input style="float: left; margin-left: -1px;" type="checkbox" class="geotopcheck"><img class="geoicon" style="cursor: pointer; float:left; padding-left: 3px; padding-top: 2px; padding-right: 4px;" src="images/' + geoicon + '" alt="Toggle Geolocation" title="Toggle Geolocation" height="14px">';
                    if (geoqueryCheck()) {
                        locationval = locationval + '<img src="images/edit.png" title="Edit Location" class="geoUpdateBtn" align="right" style="vertical-align: top; height: 14px; relative; top: 1px; cursor: pointer; margin-top: 2px; margin-right: 3px;">';
                    }
                    locationval = locationval + '<img class="geopin" title="" src="images/clearpin.png" align="right" style="height: 14px;">' + capFL(title) + ' Location: &nbsp;Unknown</div></td><td></td></tr>' +
                    '<tr class="geoplace hiddenrow' + geoplacehidden + '" style="display: ' + isHidden(hidden, "place") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">' + capFL(title) + ' Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location_string") + '" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow' + geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name_geo" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location.place_name") + '" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow' + geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">City: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:city" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location.city") + '" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow' + geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">County: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:county" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location.county") + '" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow' + geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">State: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:state" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location.state") + '" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow' + geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Country: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:country" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location.country") + '" disabled></td></tr>';
            }
            membersstring = membersstring + locationval;
        } else {
            if (x > 0) {
                membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td colspan="3"><div class="separator"></div></td><td></td></tr>';
            }

            membersstring = membersstring +
                '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">' + capFL(title) + ' Date: </td><td style="float:right;"><input type="text" class="formtext dateform" name="' + title + ':date" disabled></td><td class="genisliderow"><img src="images/' + dateicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "date.formatted_date") + '" disabled></td></tr>';
            if (title === "death") {
                membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Death Cause: </td><td style="float:right;"><input type="text" class="formtext" name="cause_of_death" disabled></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("cause_of_death") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("cause_of_death") + '" disabled></td></tr>';
            }
            membersstring = membersstring +
                '<tr id="focus_'+title+'" class="hiddenrow" style="display: ' + isHidden(hidden) + ';"><td colspan="3" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-left: 2px; padding-left: 5px; padding-right: 2px;"><input style="float: left; margin-left: -1px;" type="checkbox" class="geotopcheck"><img class="geoicon" style="cursor: pointer; float:left; padding-left: 3px; padding-top: 2px; padding-right: 4px;"  alt="Toggle Geolocation" title="Toggle Geolocation"  src="images/' + geoicon + '" height="14px">';
                if (geoqueryCheck()) {
                    membersstring = membersstring + '<img src="images/edit.png" title="Edit Location" class="geoUpdateBtn" align="right" style="vertical-align: top; height: 14px; relative; top: 1px; cursor: pointer; margin-top: 2px; margin-right: 3px;">';
                }
                membersstring = membersstring + '<img class="geopin" title="" src="images/clearpin.png" align="right" style="height: 14px;">' + capFL(title) + ' Location: &nbsp;Unknown</div></td><td></td></tr>' +
                '<tr class="geoplace hiddenrow' + geoplacehidden + '" style="display: ' + isHidden(hidden, "place") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">' + capFL(title) + ' Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location_string") + '" disabled></td></tr>' +
                '<tr class="geoloc hiddenrow' + geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name_geo" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location.place_name") + '" disabled></td></tr>' +
                '<tr class="geoloc hiddenrow' + geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">City: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:city" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location.city") + '" disabled></td></tr>' +
                '<tr class="geoloc hiddenrow' + geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">County: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:county" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location.county") + '" disabled></td></tr>' +
                '<tr class="geoloc hiddenrow' + geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">State: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:state" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location.state") + '" disabled></td></tr>' +
                '<tr class="geoloc hiddenrow' + geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Country: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:country" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get(title, "location.country") + '" disabled></td></tr>';

        }
        $(div[0]).html(membersstring);
    }
    x = sepx + x;
    if (ck > 0) {
        $('#updateprofile').prop('checked', true);
    }
    if (x > 0) {
        document.getElementById("profiledata").style.display = "block";
        document.getElementById("genislider").style.display = "block";
    } else if (!hidden) {
        document.getElementById("profiledata").style.display = "block";
        document.getElementById("genislider").style.display = "block";
        hideprofile = true;
    } else {
        hideprofile = true;
    }

    // ---------------------- Family Data --------------------
    listvalues = ["birth", "baptism", "marriage", "divorce", "death", "burial"];
    obj = alldata["family"];
    //console.log("");
    //console.log(JSON.stringify(obj));
    var ambigdatecheck = [];
    var icount = 0;
    var photoscore = $('#photoonoffswitch').prop('checked');
    for (var relationship in obj) if (obj.hasOwnProperty(relationship)) {
        var members = obj[relationship];
        var scored = false;
        var sibcheck = false;
        var childck = false;
        var partnerck = false;
        var parentck = false;
        var scoreused = false;
        //Use a common naming scheme
        if (isSibling(relationship)) {
            if (scorefactors.contains("sibling")) {
                scored = true;
                sibcheck = true;
            }
            relationship = "sibling";
        } else if (isChild(relationship)) {
            if (scorefactors.contains("child")) {
                scored = true;
                childck = true;
            }
            relationship = "child";
        }
        else if (isParent(relationship)) {
            if (scorefactors.contains("parent")) {
                scored = true;
                parentck = true;
            }
            relationship = "parent";
        }
        else if (isPartner(relationship) || relationship.contains("veteran (self)")) {
            if (scorefactors.contains("spouse")) {
                scored = true;
                partnerck = true;
            }
            relationship = "partner";
        } else {
            relationship = "unknown";
        }

        var div = $("#" + relationship);
        if (members.length > 0 && exists(div[0])) {
            div[0].style.display = "block";
        }
        var parentscore = scored;
        var skipprivate = $('#privateonoffswitch').prop('checked');
        for (var member in members) if (members.hasOwnProperty(member)) {
            var i = members[member]["profile_id"];
            if (!exists(i)) {
                i = icount;
                //Just in case a parser misses this in the future, add a nice warning
                console.warn("Family Member lacks profile_id (famid)!  Using fallback count, but this needs to be fixed.");
            }
            scored = parentscore;
            var entry = $("#" + relationship + "val")[0];
            if (!exists(entry)) {
                continue;
            }
            if (!exists(members[member].name)) {
                continue;
            }
            var nameval = NameParse.parse(members[member].name, mnameonoff);
            var fullname = nameval.displayname;
            if (!exists(fullname)) {
                continue;
            } else if (fullname.trim() === "") {
                scored = false;
            }
            var living = false;
            var halfsibling = false;
            if (!scored && relationship === "parent") {
                //used !== to also select unknown gender
                if (scorefactors.contains("father") && !geniHas("father") && members[member].gender !== "female") {
                    scored = true;
                    $('#addparentck').prop('checked', true);
                } else if (scorefactors.contains("mother") && !geniHas("mother")  && members[member].gender !== "male") {
                    scored = true;
                    $('#addparentck').prop('checked', true);
                }
            }
            if (isSibling(relationship) && exists(members[member].halfsibling) && members[member].halfsibling) {
                scored = false;
                halfsibling = true;
            }
            if (skipprivate && checkLiving(fullname)) {
                scored = false;
            } else {
                scoreused = true;
            }
            if (exists(members[member].alive)) {
                living = members[member].alive;
            }
            if ($('#birthonoffswitch').prop('checked') && nameval.birthName === "") {
                if (members[member].gender === "male") {
                    nameval.birthName = nameval.lastName;
                } else if (members[member].gender === "female" && setBirthName(relationship, nameval.lastName, mnameonoff)) {
                    nameval.birthName = nameval.lastName;
                    nameval.lastName = "";
                } else if (members[member].gender === "unknown" && relationship !== "parent") {
                    nameval.birthName = nameval.lastName;
                }
            }
            if (exists(members[member].nicknames)) {
                if (nameval.nickName !== "") {
                    nameval.nickName += ",";
                }
                nameval.nickName += members[member].nicknames;
            }
            var displayname = "";
            if (nameval.prefix !== "") {
                //Deprecated due to title field
                //displayname = nameval.displayname;
            }
            var gender = members[member].gender;
            if (gender === "unknown" && isPartner(relationship) && focusgender !== "unknown") {
                //if unknown, assume spouse is opposite gender
                gender = reverseGender(focusgender);
            }
            var bgcolor = genderColor(gender);

            var actionicon = "add";
            if (isParent(relationship)) {
                if (isMale(gender) && geniHas("father")) {
                    actionicon = "update";
                } else if (isFemale(gender) && geniHas("mother")) {
                    actionicon = "update";
                }
            }
            var checkunknown = "";
            var hideunknown = "table-row";
            if (relationship === "unknown") {
                checkunknown = " disabled";
                hideunknown = "none";
            }
            var expand = true;
            if (exists(members[member]["birth"]) && exists(members[member]["birth"][0]) && exists(members[member]["birth"][0]["date"])) {
                var dt = moment(members[member]["birth"][0]["date"], getDateFormat(members[member]["birth"][0]["date"]));
                var year = dt.get('year');
                if (year < 1600) {
                    checkunknown = " disabled";
                    scored = false;
                    expand = false;
                    actionicon = "disabled";
                }
            } else if (exists(members[member]["death"]) && exists(members[member]["death"][0]) && exists(members[member]["death"][0]["date"])) {
                var dt = moment(members[member]["death"][0]["date"], getDateFormat(members[member]["death"][0]["date"]));
                var year = dt.get('year');
                if (year < 1600) {
                    checkunknown = " disabled";
                    scored = false;
                    expand = false;
                    actionicon = "disabled";
                }
            }

            var membersstring = $(entry).html();
            membersstring += '<div class="membertitle" style="background-color: ' + bgcolor + '"><table style="border-spacing: 0px; border-collapse: separate; width: 100%;"><tr>' +
                '<td><input type="checkbox" class="checkslide" name="checkbox' + i + '-' + relationship + '" ' + isChecked(fullname, scored) + checkunknown + '></td>';
            if (expand) {
                membersstring += '<td class="expandcontrol" name="' + i + '-' + relationship + '"  style="cursor: pointer; width: 100%;">';
            } else {
                membersstring += '<td name="' + i + '-' + relationship + '"  style="width: 100%;" title="pre 1600 - disabled" description="pre 1600 - disabled">';
            }
            membersstring += '<span id="ribbon' + i + '" style="display: ' + isHidden(living) + '; float: right; position: relative; margin-right: -12px; margin-bottom: -5px; right: 8px; top: -3px; margin-left: -8px;"><img src="images/deceased.png" style="width: 18px;"></span>';
            if (expand) {
                membersstring += '<span style="font-size: 130%; float: right; padding-right: 8px; padding-left:2px;"><img src="images/dropdown.png" style="width: 11px;"></span>';
            }
            membersstring += '<span style="font-size: 90%;"><img class="iconaction" style="width: 16px; margin-bottom: -4px; margin-left: -2px; padding-right: 3px;" src="/images/' + actionicon +  '.png" title=' + actionicon + ' description=' + actionicon + '>' + escapeHtml(fullname.replace(/&quot;/g, '"')) + '</span>';
            
            if (halfsibling) {
                membersstring += '<span style="float: right; margin-right: 3px; margin-left: -2px; margin-top: 3px; margin-bottom: -3px;"><img src="images/halfcircle.png" style="width: 14px; margin-top: -2px;" alt="half-sibling" title="half-sibling"></span>';
            }
            if (expand) {
                membersstring += '<span style="float: right; padding-left: 8px;"><img class="geopin" id="' + i + 'gpin" src="images/clearpin.png" style="height: 14px; margin-bottom: -3px;"><img id="' + i + 'errordate" src="images/dateerror.png" style="display: none; height: 13px; margin-bottom: -3px; padding-right: 3px; margin-left: -3px;" title="Ambiguous Date"></span>';
            }
            membersstring += '</td><td></td></tr></table></div>' +
                '<div id="slide' + i + '-' + relationship + '" class="memberexpand" style="display: none; padding-bottom: 6px; padding-left: 12px;"><table id="familytable_' + i + '" style="border-spacing: 0px; border-collapse: separate; width: 100%;">' +
                '<tr><td colspan="3" style="padding: 0px;"><input type="hidden" name="profile_id" value="' + members[member].profile_id + '"></td></tr>';
            if (relationship === "unknown") {
                membersstring += '<tr name="unk" style="display: table-row;"><td class="profilediv" colspan="3" style="padding-bottom: 3px;"><span style="margin-top: 3px; float: left; margin-left: 19px;">Relation:</span><span id="unknownrel' + i + '">' + buildUnknown(gender) + '</span></td></tr>';
            }
            var showimg = "images/show.png";
            var showtitle = "Show All Fields";
            if (!$('#hideemptyonoffswitch').prop('checked')) {
                showimg = "images/hide.png";
                showtitle = "Hide Unused Fields";
            }
            membersstring += '<tr name="act" style="display: ' + hideunknown + ';"><td class="profilediv" colspan="3" style="padding-bottom: 3px;"><img src="' + showimg + '" class="showhide" title="' + showtitle + '" style="width: 24px; position: absolute; left: 20px; cursor: pointer;"><span style="margin-top: 3px; float: left; margin-left: 19px;">Action:</span><span name="buildactionspan" id="action' + i + '">' + buildAction(relationship, gender, i) + '</span></td></tr></span>';

            if (isChild(relationship) || relationship === "unknown") {
                var parentrel = "Parent";
                if (focusgender === "male") {
                    parentrel = "Mother";
                } else if (focusgender === "female") {
                    parentrel = "Father";
                }
                membersstring += '<tr name="parenttr" style="display: ' + hideunknown + ';"><td class="profilediv" colspan="3" style="padding-bottom: 3px; padding-top: 0px;"><span style="margin-top: 3px; float: left; margin-left: 19px;">' + parentrel + ':</span><span>' + buildParentSelect(members[member].parent_id) + '</span></td></tr>';
            }
            if (exists(members[member]["thumb"])) {
                var thumbnail = members[member]["thumb"];
                var image = members[member]["image"];
                if (Object.getOwnPropertyNames(fsimage).length > 0) {
                    for (var imgurl in fsimage) {
                        if (imgurl == thumbnail) {
                            thumbnail = fsimage[imgurl];
                            image = thumbnail;
                            break;
                        }
                    }
                }
                var credit = members[member]["imagecredit"] || "";
                membersstring = membersstring +
                    '<tr id="photo"><td class="profilediv"><input type="checkbox" class="checknext photocheck" ' + isChecked(thumbnail, (scored && photoscore)) + '>' +
                    "Photo" + ':</td><td style="padding: 0;"><div style="float: right;"><input type="hidden" class="photocheck" name="photo" value="' + image + '" ' + isEnabled(thumbnail, (scored && photoscore)) + ' author="' + credit + '"><img style="max-width: 150px; max-height: 120px; object-fit: contain;"  src="' + thumbnail + '"></div></td><td class="genisliderow" style="vertical-align: middle; padding: 0;"><div style="display: inline-block; vertical-align: middle; padding: 0;"><img id="' + i + '_geni_mugshot" src="images/right.png" class="genislideimage" style="padding-left: 5px;"></div><div style="display: inline-block; vertical-align: middle; padding: 0;"><img id="' + i + '_geni_photo_urls" style="max-width: 150px; max-height: 120px; object-fit: contain; padding: 0px;" src="' + geniPhoto(gender) + '"></div></td></tr>';
            }
            membersstring +=
                '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.prefix, scored) + '>Title:</td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="title" value="' + nameval.prefix + '" ' + isEnabled(nameval.prefix, scored) + '></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_title" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                    '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.firstName, scored) + '>First Name:</td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="first_name" value="' + nameval.firstName + '" ' + isEnabled(nameval.firstName, scored) + '></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_first_name" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                    '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.middleName, scored) + '>Middle Name:</td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="middle_name" value="' + nameval.middleName + '" ' + isEnabled(nameval.middleName, scored) + '></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_middle_name" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                    '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.lastName, scored) + '>Last Name:</td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="last_name" value="' + nameval.lastName + '" ' + isEnabled(nameval.lastName, scored) + '></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_last_name" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                    '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.birthName, scored) + '>Birth Name:</td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="maiden_name" value="' + nameval.birthName + '" ' + isEnabled(nameval.birthName, scored) + '></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_maiden_name" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                    '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.suffix, scored) + '>Suffix: </td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="suffix" value="' + nameval.suffix + '" ' + isEnabled(nameval.suffix, scored) + '></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_suffix" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                    '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(displayname, scored) + '>Display Name: </td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="display_name" value="' + displayname + '" ' + isEnabled(displayname, scored) + '></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_display_name" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                    '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.nickName, scored) + '>Also Known As: </td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="nicknames" value="' + nameval.nickName + '" ' + isEnabled(nameval.nickName, scored) + '></td><td class="genisliderow"><img id="' + i + '_geni_nickimage" src="images/right.png" class="genislideimage"><input id="' + i + '_geni_nicknames" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
            if (exists(members[member]["occupation"])) {
                var occupation = members[member]["occupation"];
                membersstring = membersstring + '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(occupation, scored) + '>Occupation: </td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="occupation" value="' + occupation + '" ' + isEnabled(occupation, scored) + '></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_occupation" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
            } else {
                membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow" id="occupation"><td class="profilediv"><input type="checkbox" class="checknext">Occupation: </td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="occupation" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_occupation" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
            }
            membersstring = membersstring + '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(gender, scored) + '>Gender: </td><td style="float:right; padding-bottom: 2px; padding-top: 0px; padding-right: 0px;"><select class="formselect genderselect" update="'+ i + '" relationship="' + relationship + '" style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="gender" ' + isEnabled(gender, scored) + '>' +
                '<option value="male" ' + setGender("male", gender) + '>Male</option><option value="female" ' + setGender("female", gender) + '>Female</option><option value="unknown" ' + setGender("unknown", gender) + '>Unknown</option></select></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_gender" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(living, scored) + '>Vital: </td><td style="float:right; padding-bottom: 2px; padding-top: 0px; padding-right: 0px;"><select class="formselect livingselect" update="'+ i + '"  style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="is_alive" ' + isEnabled(living, scored) + '>' +
                '<option value=false ' + setLiving("deceased", living) + '>Deceased</option><option value=true ' + setLiving("living", living) + '>Living</option></select></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_is_alive" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
            if ($('#privacyonoffswitch').prop('checked') && !living) {
                membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Privacy: </td><td style="float:right; padding: 0;"><select class="formselect" update="'+ i + '" style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="public" ' + isEnabled(living, false) + '>' +
                    '<option value="">Auto</option><option value=true selected>Public</option><option value=false>Private</option></select></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_public" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
            } else {
                membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Privacy: </td><td style="float:right; padding: 0;"><select class="formselect" update="'+ i + '" style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="public" ' + isEnabled(living, false) + '>' +
                    '<option value="" selected>Auto</option><option value=true>Public</option><option value=false>Private</option></select></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_public" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
            }
            if (exists(members[member].about)) {
                var about = members[member].about;
                membersstring = membersstring + '<tr><td colspan="3"><div class="profilediv" style="width: 100%; font-size: 80%;"><input type="checkbox" class="checknext" ' + isChecked(about, scored) + '>About:<img id="' + i + '_geni_about" class="genisliderow" src="images/right.png" align="right" style="width: 12px; margin-right: 3px; margin-top: 5px;"></div><div style="padding-left:4px; padding-right:6px;"><textarea rows="4" name="about_me" style="width:100%;" ' + isEnabled(about, scored) + '>' + about + '</textarea></div></td></tr>';
            } else {
                membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow" id="about"><td colspan="3"><div class="profilediv" style="width: 100%; font-size: 80%;"><input type="checkbox" class="checknext">About:<img id="' + i + '_geni_about" class="genisliderow" src="images/right.png" align="right" style="width: 12px; margin-right: 3px; margin-top: 5px;"></div><div style="padding-top: 2px; padding-left:4px; padding-right:6px;"><textarea rows="4" name="about_me" style="width:100%;"  disabled></textarea></div></td></tr>';
            }
            for (var list in listvalues) if (listvalues.hasOwnProperty(list)) {
                var title = listvalues[list];
                if ((relationship !== "partner" && relationship !== "parent") && (title === "marriage" || title === "divorce")) {
                    continue;  //Skip marriage date fields if not partner
                }
                var memberobj = members[member][title];
                if (exists(memberobj) && memberobj.length > 0) {
                    membersstring = membersstring + '<tr><td colspan="3"><div class="separator"></div></td></tr>';
                    var dateadded = false;
                    var locationadded = false;
                    var locationval = "";
                    for (var item in memberobj) if (memberobj.hasOwnProperty(item)) {
                        if (exists(memberobj[item].date)) {
                            var dateval = memberobj[item].date;
                            var dateambig = "";
                            if (dateAmbigous(dateval)) {
                                dateambig = 'style="color: #ff0000;" ';
                                ambigdatecheck.push(i);
                            }
                            membersstring = membersstring +
                                '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(dateval, scored) + '>' + capFL(title) + ' Date: </td><td style="float:right;"><input type="text" imgid="' + i + '" class="formtext dateform" ' + dateambig + 'name="' + title + ':date" value="' + dateval + '" ' + isEnabled(dateval, scored) + '></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_date" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
                            dateadded = true;
                        }
                        if (exists(memberobj[item].location)) {
                            var place = memberobj[item].location;
                            var geovar2 = geolocation[memberobj[item].id];
                            var pincolor = "clear";
                            var pintitle = "";
                            if (geovar2 === undefined) {
                                geovar2 = parseGoogle("");
                            }
                            if (geovar2.ambiguous || geovar2.count > 1) {
                                pincolor = "yellow";
                                pintitle = "Location lookup may be incorrect";
                                membersstring = membersstring.replace('id="' + i + 'gpin" src="images/clearpin.png"', 'id="' + i + 'gpin" src="images/yellowpin.png" title="Location lookup may be incorrect"');
                            } else if (geovar2.count === 0) {
                                pincolor = "red";
                                pintitle = "Location lookup failed";
                                membersstring = membersstring.replace('id="' + i + 'gpin" src="images/clearpin.png"', 'id="' + i + 'gpin" src="images/redpin.png" title="Location lookup failed"');
                            }
                            var placegeo = geovar2.place;
                            var city = geovar2.city;
                            var county = geovar2.county;
                            var state = geovar2.state;
                            var country = geovar2.country;
                            var geoone = ($('#forcegeoswitch').prop('checked') && (isValue(city) || isValue(county) || isValue(state) || isValue(country)));
                            locationval = locationval +
                                '<tr id="'+ i + "_" +title+'"><td colspan="3" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-right: 2px; padding-left: 5px;"><input style="float: left; margin-left: -1px;" type="checkbox" class="geotopcheck">' +
                                '<img class="geoicon" style="cursor: pointer; float:left; padding-left: 3px; padding-top: 2px; padding-right: 4px;" alt="Toggle Geolocation" title="Toggle Geolocation" src="images/' + geoicon + '" height="14px">';
                                if (geoqueryCheck()) {
                                    locationval = locationval + '<img src="images/edit.png" title="Edit Location" class="geoUpdateBtn" align="right" style="cursor: pointer; height: 14px; margin-top: 2px; margin-right: 3px;">';
                                }
                                locationval = locationval + '<img class="geopin" src="images/' + pincolor + 'pin.png" align="right" title="' + pintitle + '" style="height: 14px; margin-top: 2px;">' + capFL(title) + ' Location: &nbsp;' + place.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</div></td></tr>' +
                                '<tr class="geoplace' +  geoplacehidden + '" style="display: ' + geoplace + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(place, scored) + '>' + Abbr(capFL(title)) + ' Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name" value="' + place + '" ' + isEnabled(place, scored) + '></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_location_string" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                                '<tr class="geoloc' +  geolochidden + '" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(placegeo, scored, geoone) + '>Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name_geo" value="' + placegeo + '" ' + isEnabled(placegeo, scored, geoone) + '></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_place" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                                '<tr class="geoloc' +  geolochidden + '" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(city, scored, geoone) + '>City: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:city" value="' + city + '" ' + isEnabled(city, scored, geoone) + '></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_city" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                                '<tr class="geoloc' +  geolochidden + '" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(county, scored, geoone) + '>County: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:county" value="' + county + '" ' + isEnabled(county, scored, geoone) + '></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_county" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                                '<tr class="geoloc' +  geolochidden + '" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(state, scored, geoone) + '>State: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:state" value="' + state + '" ' + isEnabled(state, scored, geoone) + '></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_state" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                                '<tr class="geoloc' +  geolochidden + '" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(country, scored, geoone) + '>Country: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:country" value="' + country + '" ' + isEnabled(country, scored, geoone) + '></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_country" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
                            locationadded = true;
                        }
                    }
                    if (!dateadded) {
                        var dateambig = "";
                        if (dateAmbigous(dateval)) {
                            dateambig = 'style="color: #ff0000;" ';
                            ambigdatecheck.push(i);
                        }
                        membersstring = membersstring +
                            '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">' + capFL(title) + ' Date: </td><td style="float:right;"><input type="text" imgid="' + i + '" class="formtext dateform" ' + dateambig + 'name="' + title + ':date" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_date" type="text" class="formtext genislideinput" value="" disabled></td></tr>';

                    }
                    if (title === "death") {
                        membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Death Cause: </td><td style="float:right;"><input type="text" class="formtext" name="cause_of_death" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_cause_of_death" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
                    }
                    if (!locationadded) {
                        locationval = locationval +
                            '<tr id="'+ i + "_" +title+'" class="hiddenrow" style="display: ' + isHidden(hidden) + ';"><td colspan="3" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-right: 2px; padding-left: 5px;"><input style="float: left; margin-left: -1px;" type="checkbox" class="geotopcheck">' +
                            '<img class="geoicon" style="cursor: pointer; float:left; padding-left: 3px; padding-top: 2px; padding-right: 4px;" src="images/' + geoicon + '" alt="Toggle Geolocation" title="Toggle Geolocation" height="14px">';
                            if (geoqueryCheck()) {
                                locationval = locationval + '<img src="images/edit.png" title="Edit Location" class="geoUpdateBtn" align="right" style="cursor: pointer; height: 14px; margin-top: 2px; margin-right: 3px;">';
                            }
                            locationval = locationval + '<img class="geopin" src="images/clearpin.png" align="right" title="" style="height: 14px; margin-top: 2px;">' + capFL(title) + ' Location: &nbsp;Unknown</div></td></tr>' +
                            '<tr class="geoplace hiddenrow' +  geoplacehidden + '" style="display: ' + isHidden(hidden, "place") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">' + Abbr(capFL(title)) + ' Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_location_string" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow' +  geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name_geo" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_place" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow' +  geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">City: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:city" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_city" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow' +  geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">County: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:county" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_county" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow' +  geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">State: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:state" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_state" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow' +  geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Country: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:country" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_country" type="text" class="formtext genislideinput" value="" disabled></td></tr>';

                    }
                    membersstring = membersstring + locationval;
                } else {
                    membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td colspan="3"><div class="separator"></div></td></tr>';

                    membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">' + capFL(title) + ' Date: </td><td style="float:right;"><input type="text" imgid="' + i + '" class="formtext dateform" name="' + title + ':date" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_date" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
                    if (title === "death") {
                        membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Death Cause: </td><td style="float:right;"><input type="text" class="formtext" name="cause_of_death" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_cause_of_death" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
                    }
                    membersstring = membersstring +
                        '<tr id="'+ i + "_" +title+'" class="hiddenrow" style="display: ' + isHidden(hidden) + ';"><td colspan="3" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-right: 2px; padding-left: 5px;"><input style="float: left; margin-left: -1px;" type="checkbox" class="geotopcheck">' +
                        '<img class="geoicon" style="cursor: pointer; float:left; padding-left: 3px; padding-top: 2px; padding-right: 4px;" src="images/' + geoicon + '" alt="Toggle Geolocation" title="Toggle Geolocation" height="14px">';
                        if (geoqueryCheck()) {
                            membersstring = membersstring + '<img src="images/edit.png" title="Edit Location" class="geoUpdateBtn" align="right" style="cursor: pointer; height: 14px; margin-top: 2px; margin-right: 3px;">';
                        }
                        membersstring = membersstring +'<img class="geopin" src="images/clearpin.png" align="right" title="" style="height: 14px; margin-top: 2px;">' + capFL(title) + ' Location: &nbsp;Unknown</div></td></tr>' +
                        '<tr class="geoplace hiddenrow' + geoplacehidden + '" style="display: ' + isHidden(hidden, "place") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">' + Abbr(capFL(title)) + ' Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_location_string" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow' +  geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name_geo" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_place" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow' +  geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">City: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:city" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_city" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow' +  geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">County: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:county" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_county" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow' +  geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">State: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:state" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_state" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow' +  geolochidden + '" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Country: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:country" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_country" type="text" class="formtext genislideinput" value="" disabled></td></tr>';

                }
            }

            membersstring = membersstring + '</table></div>';
            $(entry).html(membersstring);
            for (var i=0;i<ambigdatecheck.length;i++) {
                $("#" + ambigdatecheck[i] + "errordate").show();
            }
            //log("  " + members[member].name);
            icount ++;
        }
        if (scoreused) {
            if (childck) {
                $('#addchildck').prop('checked', true);
            } else if (sibcheck) {
                $('#addsiblingck').prop('checked', true);
            } else if (parentck) {
                $('#addparentck').prop('checked', true);
            } else if (partnerck) {
                $('#addpartnerck').prop('checked', true);
            }
        }
    }

    iconUpdate();
    updateClassResponse();
    placementUpdate();
    if ($('#genislideonoffswitch').prop('checked')) {
        $(".genisliderow").not(".genihidden").slideToggle();
    }

    if ($("#parent")[0].style.display === "block") {
        var father = null;
        var mother = null;
        for (var p = 0; p < databyid.length; p++) {
            var relation;
            if (exists(databyid[p])) {
                if (exists(databyid[p].status)) {
                    relation = databyid[p].status;
                } else if (exists(databyid[p].title)) {
                    relation = databyid[p].title;
                }
                if (exists(relation) && isParent(relation)) {
                    if (databyid[p].gender === "male") {
                        father = NameParse.parse(databyid[p].name);
                    } else if (databyid[p].gender === "female") {
                        mother = NameParse.parse(databyid[p].name);
                    } else if (!exists(father)) {
                        father = NameParse.parse(databyid[p].name);
                    } else {
                        mother = NameParse.parse(databyid[p].name);
                    }
                }
            }
        }
        var genisearchurl = "https://www.geni.com/search";
        if (exists(father) && exists(mother)) {
            var mname = "&partner_names=";
            if (mother.birthName !== "" && mother.birthName !== father.lastName) {
                mname += mother.birthName;
            } else if (mother.lastName !== father.lastName) {
                mname += mother.lastName;
            } else {
                mname += mother.firstName;
            }
            genisearchurl += "?names=" + father.firstName + "+" + father.lastName + mname;
        } else if (exists(father)) {
            genisearchurl += "?names=" + father.firstName + "+" + father.lastName;
        } else if (exists(mother)) {
            var mname = "";
            if (mother.birthName !== "") {
                mname = mother.birthName;
            } else {
                mname = mother.lastName;
            }
            genisearchurl += "?names=" + mother.firstName + "+" + mname;
        } else {
            genisearchurl += "/advanced";
        }
        $("#genisearch").attr("href", genisearchurl);
        $("#parentsearch").show();
    }

    if (icount > 0 && accountinfo.user) {
        document.getElementById("familydata").style.display = "block";
        document.getElementById("genislider").style.display = "block";
    }
    document.getElementById("bottomsubmit").style.display = "block";
    parsecomplete = true;
    console.log("Process Complete...");
}

function isValue(object) {
    return (object !== "");
}

/**
 * @return {string}
 */
function Abbr(title) {
    if (title === "Baptism") {
        return "Bapt.";
    } else {
        return title;
    }
}

function iconUpdate() {
    $('.actionselect').off();
    $('.actionselect').on('change', function () {
        actionUpdate(this);
    });
    for (var property in genibuildaction) {
        if (genibuildaction.hasOwnProperty(property)) {
            setGeniFamilyData(genibuildaction[property], property);
        }
    }
    genibuildaction = {};
}

function actionUpdate(object) {
    var id = $(object).closest("table")[0].id.replace("familytable_", "");
    var actionicon = $(document.getElementById("familytable_" + id)).closest("div").prev().find(".iconaction");
    var profile = $(object)[0].value;
    if (profile === "add") {
        actionicon.attr('src','images/add.png');
        actionicon.attr('title','add');
        actionicon.attr('description','add');
    } else {
        actionicon.attr('src','images/update.png');
        actionicon.attr('title','update');
        actionicon.attr('description','update');
    }

    setGeniFamilyData(id, profile);
}

function updateClassResponse() {
    $('.genderselect').off();
    $(function () {
        $('.genderselect').on('change', function () {
            var genselect = $(this);
            if (exists(genselect[0].attributes.relationship)) {
                //Only run it on family members
                var gender = genselect[0].options[genselect[0].selectedIndex].value;
                $('#action'+genselect[0].attributes.update.value).html(buildAction(genselect[0].attributes.relationship.value, gender));
                iconUpdate();
                var gendercolor = genderColor(gender);
                genselect.closest('.memberexpand').prev('.membertitle').css('background-color', gendercolor);
            }
        });
    });

    $('.livingselect').off();
    $(function () {
        $('.livingselect').on('change', function () {
            var livingselect = $(this);
            if (exists(livingselect[0].attributes.update)) {
                var id = livingselect[0].attributes.update.value;
                //Option value is returned as a string, not boolean - will fail if you treat it as boolean
                if (livingselect[0].options[livingselect[0].selectedIndex].value === "true") {
                    $('#ribbon'+ id).hide();
                } else {
                    $('#ribbon'+ id).show();
                }
            }
        });
    });
    $(function () {
        $('.dateform').on('input', function () {
            var datefield = $(this);
            var imgid = $(this).attr("imgid");
            if (dateAmbigous(datefield.val())) {
                $(this).css("color", "#ff0000");
                if (exists(imgid)) {
                    $("#" + imgid + "errordate").show();
                }
            } else {
                $(this).css("color", "#000");
                if (exists(imgid)) {
                    $("#" + imgid + "errordate").hide();
                }
            }
        });
    });
    $('.expandcontrol').off();
    $(function () {
        $('.expandcontrol').on('click', function () {
            expandFamily($(this).attr("name"));
        });
    });

    $('.checknext').off();
    $(function () {
        $('.checknext').on('click', function () {
            $(this).closest('tr').find('input[type="text"],select,input[type="hidden"],textarea').not(".genislideinput").not(".parentselector").attr("disabled", !this.checked);
            if (this.checked) {
                if ($(this).closest('tr').hasClass("geoloc") || $(this).closest('tr').hasClass("geoplace")) {
                    //This checks the geotopcheck when a child location is checked
                    var ps = $(this).closest('tr')[0].previousElementSibling;
                    while (exists(ps)) {
                        ps = $(ps)[0].previousElementSibling;
                        if (exists(ps) && ps.id !== "") {
                            $(ps).find('.geotopcheck').prop('checked', true);
                            break;
                        }
                    }
                }
                var personslide = $(this).closest('.memberexpand').prev('.membertitle');
                personslide.find('.checkslide').prop('checked', true);
                personslide.find('input[type="hidden"]').not(".genislideinput").attr('disabled', false);
                if($($(this).closest("fieldset")[0].parentElement)[0].id === "profileshadowdiv") {
                    $("#updateprofile").prop('checked', true);
                }
            }
        });
    });
    $('.geotopcheck').off();
    $(function () {
        $('.geotopcheck').on('click', function () {
            if (this.checked) {
                //Check the very top box
                var personslide = $(this).closest('.memberexpand').prev('.membertitle');
                personslide.find('.checkslide').prop('checked', true);
                personslide.find('input[type="hidden"]').not(".genislideinput").attr('disabled', false);
                if($($(this).closest("fieldset")[0].parentElement)[0].id === "profileshadowdiv") {
                    $("#updateprofile").prop('checked', true);
                }
            }
            var row = $(this).closest('tr');
            var icon = $(row.find("img")[0]).attr("src");
            row = $(row[0].nextElementSibling);
            if (icon === "images/geooff.png") {
                row.find('input[type="checkbox"]').prop('checked', this.checked);
                row.find('input[type="text"],select,input[type="hidden"],textarea').not(".genislideinput").not(".parentselector").attr("disabled", !this.checked);
            } else {
                row = $(row[0].nextElementSibling);
                row.find('input[type="checkbox"]').prop('checked', this.checked);
                row.find('input[type="text"],select,input[type="hidden"],textarea').not(".genislideinput").not(".parentselector").attr("disabled", !this.checked);
                row = $(row[0].nextElementSibling);
                row.find('input[type="checkbox"]').prop('checked', this.checked);
                row.find('input[type="text"],select,input[type="hidden"],textarea').not(".genislideinput").not(".parentselector").attr("disabled", !this.checked);
                row = $(row[0].nextElementSibling);
                row.find('input[type="checkbox"]').prop('checked', this.checked);
                row.find('input[type="text"],select,input[type="hidden"],textarea').not(".genislideinput").not(".parentselector").attr("disabled", !this.checked);
                row = $(row[0].nextElementSibling);
                row.find('input[type="checkbox"]').prop('checked', this.checked);
                row.find('input[type="text"],select,input[type="hidden"],textarea').not(".genislideinput").not(".parentselector").attr("disabled", !this.checked);
                row = $(row[0].nextElementSibling);
                row.find('input[type="checkbox"]').prop('checked', this.checked);
                row.find('input[type="text"],select,input[type="hidden"],textarea').not(".genislideinput").not(".parentselector").attr("disabled", !this.checked);
            }
        });
    });
    $('.checkslide').off();
    $(function () {
        $('.checkslide').on('click', function () {
            var fs = $("#" + this.name.replace("checkbox", "slide"));
            var ffs = fs.find('[type="checkbox"]');
            var photoon = $('#photoonoffswitch').prop('checked');
            ffs.filter(function (item) {
                if ($(ffs[item]).closest('tr').css("display") === "none") {
                    return false;
                }
                return !(!photoon && $(ffs[item]).hasClass("photocheck") && !this.checked);
            }).prop('checked', this.checked);
            ffs = fs.find('input[type="text"],select,input[type="hidden"],textarea').not(".genislideinput").not(".parentselector");
            ffs.filter(function (item) {
                return !((ffs[item].type === "checkbox") || ($(ffs[item]).closest('tr').css("display") === "none") || (!photoon && $(ffs[item]).hasClass("photocheck") && !this.checked) || ffs[item].name === "action" || ffs[item].name === "profile_id");
            }).attr('disabled', !this.checked);
        });
    });
    $('.geoicon').off();
    $(function () {
        $('.geoicon').on('click', function () {
            var fs = $(this);
            if (fs.attr("src") === "images/geoon.png") {
                fs.attr("src", "images/geooff.png");
                var tb = $(this).closest('tr').next();
                tb[0].style.display = "table-row";
                $(tb[0]).removeClass("geohidden");
                tb = tb.next();
                tb[0].style.display = "none"; //place
                $(tb[0]).addClass("geohidden");
                tb = tb.next();
                tb[0].style.display = "none"; //city
                $(tb[0]).addClass("geohidden");
                tb = tb.next();
                tb[0].style.display = "none"; //county
                $(tb[0]).addClass("geohidden");
                tb = tb.next();
                tb[0].style.display = "none"; //state
                $(tb[0]).addClass("geohidden");
                tb = tb.next();
                tb[0].style.display = "none"; //country
                $(tb[0]).addClass("geohidden");
            } else {
                fs.attr("src", "images/geoon.png");
                var tb = $(this).closest('tr').next();
                tb[0].style.display = "none";
                $(tb[0]).addClass("geohidden");
                tb = tb.next();
                tb[0].style.display = "table-row"; //place
                $(tb[0]).removeClass("geohidden");
                tb = tb.next();
                tb[0].style.display = "table-row"; //city
                $(tb[0]).removeClass("geohidden");
                tb = tb.next();
                tb[0].style.display = "table-row"; //county
                $(tb[0]).removeClass("geohidden");
                tb = tb.next();
                tb[0].style.display = "table-row"; //state
                $(tb[0]).removeClass("geohidden");
                tb = tb.next();
                tb[0].style.display = "table-row"; //country
                $(tb[0]).removeClass("geohidden");
            }
        });
    });
    $('.genimemslide').off();
    $('.genimemslide').on('click', function () {
        $('#'+ this.id + 'slide').slideToggle();
    });
    $('.ctrllink').off();
    $(function () {
        $('.ctrllink').on('click', function (event) {
            var ctrlpressed = (event.ctrlKey || event.metaKey);
            var url = $(this).attr('url');
            chrome.tabs.query({"currentWindow": true, "status": "complete", "windowType": "normal", "active": true}, function (tabs) {
            var tab = tabs[0];
                tabplacement += 1;
                var index = tab.index + tabplacement;
                chrome.tabs.create({'url': url, active: !ctrlpressed, 'index': index});
            });
        });
    });

    $('.geoUpdateBtn').off();
    $(function () {
        $('.geoUpdateBtn').on('click', function () {
            var id = $(this).closest("tr")[0].id;
            $('#georevertbtn').attr("value", getParsedLocation(id));
            var placetr = $(this).closest("tr")[0].nextElementSibling;
            var placevalue = $(placetr).find("input[type=text]")[0].value;
            $('#geoupdatetext').val(placevalue);
            $('#geoupdatetext').attr("reference", id);
            document.getElementById('GeoUpdateModal').style.display = "block";
            $("#geoupdatetext").focus();
        });
    });
    $('.showhide').off();
    $(function () {
        $('.showhide').on('click', function () {
            var value = $($(this)[0]);
            if (value.attr("src") === "images/hide.png") {
                $(this).closest("table").find(".hiddenrow").css("display", "none");
                value.attr("src", "images/show.png");
                value.attr("title", "Show All Fields");
            } else {
                if (geoqueryCheck()) {
                    $(this).closest("table").find(".hiddenrow").not(".geoplace").css("display", "table-row");
                } else {
                    $(this).closest("table").find(".hiddenrow").not(".geoloc").css("display", "table-row");
                }
                value.attr("src", "images/hide.png");
                value.attr("title", "Hide Unused Fields");
            }
        });
    });
}

function getParsedLocation(dataid) {
    var idsplit = dataid.split("_");
    var item = idsplit[1];
    var dataroot;
    if (idsplit[0] === "focus") {
        dataroot = alldata["profile"];
    } else {
        var id = parseInt(idsplit[0]);
        dataroot = databyid[id];
    }
    if (checkNested(dataroot, item, 1, "location")) {
        return dataroot[item][1]["location"];
    } else if (checkNested(dataroot, item, 0, "location")) {
        return dataroot[item][0]["location"];
    } else {
        return "";
    }
}

function placementUpdate() {
    $('.unknownselect').on('change', function () {
        if (this.value !== "unknown") {
            var replacestring = "";
            //this.value
            var div = $("#" + this.value);
            var gender = $(this).attr("gender");
            if (exists(div[0])) {
                div[0].style.display = "block";
                var section1 = $(this).closest("div").prev();
                var section2 = $(this).closest("div");
                var unkop = $(section2).find('[name="unk"]')[0].outerHTML;
                $($(section2).find('[name="buildactionspan"]')[0]).html(buildAction(this.value, gender));
                $(section1.find("input")[0]).prop('disabled', false);
                $(section2.find('[name="act"]')[0]).css('display', "table-row");
                if (this.value === "child") {
                    $(section2.find('[name="parenttr"]')[0]).css('display', "table-row");
                    if (myhspouse.length === 0) {
                        $('.parentselector')
                            .append($("<option/>", {
                                value: -1,
                                text: "Unknown"
                            }));
                    }
                }
                if (this.value === "partner") {
                    //Add the spouse to the list for children pulldowns
                    var famid = parseInt(section2[0].id.replace("-unknown", "").replace("slide", ""));
                    myhspouse.push(famid);
                    $('.parentselector')
                        .append($("<option/>", {
                            value: famid,
                            text: getProfileName(databyid[famid].name).replace("born ", "")
                        }));
                }
                replacestring = section1[0].outerHTML;
                replacestring += section2[0].outerHTML;
                replacestring = replacestring.replace(unkop, "");
                replacestring = replacestring.replace(/-unknown/g, "-" + this.value);
                replacestring = replacestring.replace('relationship="unknown"','relationship="' + this.value + '"');
                section1[0].outerHTML = "";
                section2[0].outerHTML = "";
                var section3 = $("#" + this.value + "val");
                replacestring = $(section3[0]).html() + replacestring;
                $(section3[0]).html(replacestring);

            }
            if ($("#unknownval").is(":empty")) {
                $("#unknown").hide();
            }
            iconUpdate();
            actionUpdate($(this).closest("tbody").find(".actionselect")[0]);
            updateClassResponse();
        }
    });
}

function isEnabled(value, score, force) {
    if (force && score) {
        return "";
    } else if (score && isValue(value)) {
        return "";
    } else {
        return "disabled";
    }
}

function isHidden(value, geo) {
    var hidden = geoqueryCheck();
    if (geo === "place" && hidden) {
        return "none";
    } else if (geo === "loc" && !hidden) {
        return "none";
    }
    if (value) {
        return "none";
    } else {
        return "table-row";
    }
}

function genderColor(gender) {
    var bgcolor = "#c5fac9";
    if (gender === "male") {
        bgcolor = "#d1e3fb";
    } else if (gender === "female") {
        bgcolor = "#fdd4e4";
    }
    return bgcolor;
}

function setGender(gender, value) {
    if (gender === value) {
        return "selected";
    }
    return "";
}

function setLiving(living, value) {
    if (living === "deceased" && !value) {
        return "selected";
    } else if (living === "living" && value) {
        return "selected";
    } else {
        return "";
    }
}

function isSelected(id1, id2) {
    if (id1 === id2) {
        return "selected";
    } else {
        return "";
    }
}

function isChecked(value, score, force) {
    force = force || false;
    if (force && score) {
        return "checked";
    } else if (score && isValue(value)) {
        return "checked";
    } else {
        return "";
    }
}

function setBirthName(relation, lastname, mnameonoff) {
    if (relation === "focus") {
        var obj = alldata["family"];
        for (var relationship in obj) if (obj.hasOwnProperty(relationship)) {
            if (isParent(relationship)) {
                var person = obj[relationship];
                for (var i = 0; i < person.length; i++) {
                    var nameval = NameParse.parse(person[i].name, mnameonoff);
                    if (person[i].gender === "male" && nameval.lastName === lastname) {
                        return false;
                    }
                }
            }
        }
    } else if (isParent(relation)) {
        var obj = alldata["family"];
        for (var relationship in obj) if (obj.hasOwnProperty(relationship)) {
            if (isParent(relationship)) {
                var person = obj[relationship];
                for (var i = 0; i < person.length; i++) {
                    var nameval = NameParse.parse(person[i].name, mnameonoff);
                    if (person[i].gender === "male" && nameval.lastName === lastname) {
                        return false;
                    }
                }
            }
        }
    } else if (isPartner(relation)) {
        var obj = alldata["family"];
        for (var relationship in obj) if (obj.hasOwnProperty(relationship)) {
            if (isPartner(relationship)) {
                var person = obj[relationship];
                for (var i = 0; i < person.length; i++) {
                    var nameval = NameParse.parse(person[i].name, mnameonoff);
                    if (person[i].gender === "male" && nameval.lastName === lastname) {
                        return false;
                    }
                }
            }
        }
    }
    return true;
}

function buildUnknown(gender) {
    var pselect = "";
    pselect += '<option value="unknown" selected>Unknown</option>';
    if (gender === "unknown") {
        pselect += '<option value="parent">Parent</option>';
        pselect += '<option value="sibling">Sibling</option>';
        pselect += '<option value="partner">Spouse</option>';
        pselect += '<option value="child">Child</option>';
    } else if (gender === "male") {
        pselect += '<option value="parent">Father</option>';
        pselect += '<option value="sibling">Brother</option>';
        if (focusgender !== "male") {
            pselect += '<option value="partner">Husband</option>';
        }
        pselect += '<option value="child">Son</option>';
    } else if (gender === "female"){
        pselect += '<option value="parent">Mother</option>';
        pselect += '<option value="sibling">Sister</option>';
        if (focusgender !== "female") {
            pselect += '<option value="partner">Wife</option>';
        }
        pselect += '<option value="child">Daughter</option>';
    }

    pselect = '<select name="unknownsel" class="unknownselect" gender="' + gender + '">' + pselect;
    pselect += '</select>';
    return pselect;
}

function buildAction(relationship, gender, id) {
    var pselect = "";
    var selected = true;
    if (exists(genifamily)) {
        if (isParent(relationship)) {
            if (gender === "male") {
                relationship = "father";
            } else if (gender === "female") {
                relationship = "mother";
            }
        } else if (isSibling(relationship)) {
            if (gender === "male") {
                relationship = "brother";
            } else if (gender === "female") {
                relationship = "sister";
            }
        } else if (isChild(relationship)) {
            if (gender === "male") {
                relationship = "son";
            } else if (gender === "female") {
                relationship = "daughter";
            }
        }
        for (var node in genifamilydata) {
            if (!genifamilydata.hasOwnProperty(node)) continue;
            var familymem = genifamilydata[node];
            if (relationship === "father" && familymem.get("relation") === "father") {
                pselect += '<option value="' + familymem.get("id") + '" selected>Update: ' + familymem.get("name") + '</option>';
                genibuildaction[familymem.get("id")] = id;
                selected = false;
            } else if (relationship === "mother" && familymem.get("relation") === "mother") {
                pselect += '<option value="' + familymem.get("id") + '" selected>Update: ' + familymem.get("name") + '</option>';
                genibuildaction[familymem.get("id")] = id;
                selected = false;
            } else if (relationship === "brother" && familymem.get("relation") === "brother") {
                pselect += '<option value="' + familymem.get("id") + '">Update: ' + familymem.get("name") + '</option>';
            } else if (relationship === "sister" && familymem.get("relation") === "sister") {
                pselect += '<option value="' + familymem.get("id") + '">Update: ' + familymem.get("name") + '</option>';
            } else if (relationship === "son" && familymem.get("relation") === "son") {
                pselect += '<option value="' + familymem.get("id") + '">Update: ' + familymem.get("name") + '</option>';
            } else if (relationship === "daughter" && familymem.get("relation") === "daughter") {
                pselect += '<option value="' + familymem.get("id") + '">Update: ' + familymem.get("name") + '</option>';
            } else if ((isPartner(familymem.get("relation")) && isPartner(relationship)) ||
                (isChild(familymem.get("relation")) && relationship === "child") ||
                (isSibling(familymem.get("relation")) && relationship === "sibling") ||
                (isParent(familymem.get("relation")) && relationship === "parent") ||
                (familymem.get("relation") === "child" && isChild(relationship)) ||
                (familymem.get("relation") === "sibling" && isSibling(relationship)) ||
                (familymem.get("relation")  === "parent" && isParent(relationship))) {
                pselect += '<option value="' + familymem.get("id") + '">Update: ' + familymem.get("name") + '</option>';
            }
        }
    }
    if (selected) {
        pselect = '<option value="add" selected>Add Profile</option>' + pselect;
    } else {
        pselect = '<option value="add">Add Profile</option>' + pselect;
    }
    pselect = '<select name="action" class="actionselect">' + pselect;
    pselect += '</select>';
    return pselect;
}

function geniHas(relationship) {
    if (exists(genifamily)) {
        for (var node in genifamilydata) {
            if (!genifamilydata.hasOwnProperty(node)) continue;
            var familymem = genifamilydata[node];
            if (familymem.get("relation") === relationship) {
                return true;
            }
        }
    }
    return false;
}

function buildParentSelect(id) {
    var geniselect = "";
    var scorefactors = alldata["scorefactors"];
    var spousescore = scorefactors.contains("spouse");
    var geniparent = $('#geniparentonoffswitch').prop('checked');
    var pselect = '<select name="parent" class="parentselector">';
    if (myhspouse.length === 0 && genispouse.length === 1) {
        geniselect = " selected";
    } else if (geniparent && myhspouse.length === 1 && genispouse.length === 1 && !spousescore) {
        id = -1;
        geniselect = " selected";
    } else if (id == -1 && geniparent && genispouse.length === 1) {
        geniselect = " selected";
    } else if (id == -1) {
        pselect += '<option value="-1" selected>Unknown</option>';
    }
    for (var key in myhspouse) if (myhspouse.hasOwnProperty(key)) {
        if (exists(databyid[myhspouse[key]])) {
            pselect += '<option value="' + myhspouse[key] + '" ' + isSelected(id, myhspouse[key]) + '>' + getProfileName(databyid[myhspouse[key]].name).replace("born ", "") + '</option>';
        }
    }
    for (var i = 0; i < genispouse.length; i++) {
        pselect += '<option value="' + getGeniData(genispouse[i], "union") + '"' + geniselect + '>Geni: ' + getGeniData(genispouse[i], "name") + '</option>';
    }
    pselect += '</select>';
    return pselect;
}


function updateInfoData(person, arg) {
    if (!exists(person) || person  === "") {
        return arg;
    }
    person["url"] = arg["url"];
    person["itemId"] = arg["itemId"];
    person["profile_id"] = arg["profile_id"];

    if (exists(arg.name)) {
        //This compares the data on the focus profile to the linked profile and uses most complete
        //Sometimes more information is shown on the SM, but when you click the link it goes <Private>
        if (exists(person.name) && person.name.trim() === "" && arg.name !== "") {
            person.name = arg.name;
        }
        var tempname = NameParse.parse(person.name, mnameonoff);
        var argname = NameParse.parse(arg.name, mnameonoff);
        if (exists(person["alive"])) {
            //leave alone - let parser define it
        } else if (exists(person["death"]) || exists(person["burial"])) {
            person["alive"] = false;
        } else if (checkLiving(person.name) || checkLiving(arg.name)) {
            person["alive"] = true;
        }
        if (checkLiving(person.name) && !checkLiving(arg.name)) {
            if (!arg.name.contains("(born ") && person.name.contains("(born ")) {
                if (arg.name.contains(tempname.birthName)) {
                    if (arg.name.contains(tempname.lastName)) {
                        arg.name = arg.name.replace(tempname.birthName, "(born " + tempname.birthName + ")");
                    } else {
                        arg.name = arg.name.replace(tempname.birthName, tempname.lastName + " (born " + tempname.birthName + ")");
                    }
                } else {
                    arg.name = arg.name.trim() + " (born " + tempname.birthName + ")";
                }
            }
            person.name = arg.name;
        }
        if (argname.suffix !== undefined && argname.suffix !== "" && tempname.suffix === "") {
            person.name += ", " + argname.suffix;
        }
        if (tempname.lasName !== undefined && argname.lastName !== undefined && tempname.lastName !== argname.lastName && tempname.lastName.toLowerCase() === argname.lastName.toLowerCase()) {
            //Check if one is CamelCase
            var tlast = tempname.lastName.substring(1, tempname.lastName.length);
            var alast = argname.lastName.substring(1, argname.lastName.length);
            if (!NameParse.is_camel_case(tlast) && NameParse.is_camel_case(alast)) {
                person.name = person.name.replace(tempname.lastName, argname.lastName);
            }
        }
        if (tempname.birthName !== undefined && argname.birthName !== undefined && tempname.birthName !== argname.birthName && tempname.birthName.toLowerCase() === argname.birthName.toLowerCase()) {
            //Check if one is CamelCase
            var tlast = tempname.birthName.substring(1, tempname.birthName.length);
            var alast = argname.birthName.substring(1, argname.birthName.length);
            if (!NameParse.is_camel_case(tlast) && NameParse.is_camel_case(alast)) {
                person.name = person.name.replace(tempname.birthName, argname.birthName);
            }
        }
        if (exists(arg.gender) && person.gender === "unknown") {
            person.gender = arg.gender;
        }

        if (person.gender === "unknown") {
            //Try another approach based on relationship to focus
            var title = arg.title;
            if (isFemale(title)) {
                person.gender = "female";
            } else if (isMale(title)) {
                person.gender = "male";
            }
        }
        if (person.gender === "unknown" && (argname.suffix !== "" || tempname.suffix !== "")) {
            person.gender = "male";
        }
        if (exists(arg.birthyear) && !exists(person.birth)) {
            person["birth"] = [
                {"date": arg.birthyear}
            ];
        }
        if (exists(arg.deathyear) && !exists(person.death)) {
            person["death"] = [
                {"date": arg.deathyear}
            ];
        }
        if (!exists(person["alive"]) && !tablink.contains("/collection-1/") && exists(person["birth"])) {
            var fulldate = null;
            for (var b = 0; b < person["birth"].length; b++) {
                if (exists(person["birth"][b].date) && person["birth"][b].date.trim() !== "") {
                    fulldate = person["birth"][b].date;
                    break;
                }
            }
            if (fulldate !== null) {
                var birthval = parseDate(fulldate, false);
                var agelimit = moment.utc().format("YYYY") - 95;
                if (exists(birthval.year) && birthval.year >= agelimit) {
                    person["alive"] = true;
                }
            }
        }
        if (exists(arg.marriage) && exists(arg.marriage[0])) {
            delete arg["marriage"][0].name;
            person["marriage"] = arg["marriage"];
        }
        if (exists(arg.divorce) && exists(arg.divorce[0])) {
            delete arg["divorce"][0].name;
            person["divorce"] = arg["divorce"];
        }
    } else if (exists(person.name) && !exists(person["alive"])) {
        if (exists(person["death"]) || exists(person["burial"])) {
            person["alive"] = false;
        } else if (checkLiving(person.name)) {
            person["alive"] = true;
        } else if (exists(person["birth"])) {
            var fulldate = null;
            for (var b = 0; b < person["birth"].length; b++) {
                if (exists(person["birth"][b].date) && person["birth"][b].date.trim() !== "") {
                    fulldate = person["birth"][b].date;
                    break;
                }
            }
            if (fulldate !== null) {
                var birthval = parseDate(fulldate, false);
                var agelimit = moment.utc().format("YYYY") - 95;
                if (exists(birthval.year) && birthval.year >= agelimit) {
                    person["alive"] = true;
                }
            }
        }
    }
    return person;
}

function parseWikiURL(wikistring) {
    wikistring = wikistring.replace(/<a href="(.*?)"*>/mg, '[$1 ').replace(/<\/a>/g, "]");
    return wikistring;
}

function cleanHTML(html) {
    if (!exists(html)) {
        return "";
    }
    html = html.replace(/<sup.*?<\/sup>/ig, "");
    var div = $(document.createElement("div"));
    div.html(html);
    return div.text() || "";
}

function cleanDate(dateval) {
    if (dateval.contains("WFT ") || dateval.contains("Calculated") || dateval.toLowerCase().contains("deceased")) {
        /*
        WFT is an abbreviation for the World Family Tree algorithm, used in cases where the submitter did not provide a date.
        It is used to satisfy the database requirements of the World Family Tree Project and has no basis in fact.
        For genealogical purposes, it is best to ignore these computer assigned WFT dates.
        */
        dateval = "";
    }
    
    dateval = dateval.replace(/–/g,"-");
    dateval = dateval.replace(/ - /g, "-");
    dateval = dateval.replace(/\?/g, "");
    dateval = dateval.replace(/ABT\.? /i, "Circa ");
    dateval = dateval.replace(/EST\.? /i, "Circa ");
    dateval = dateval.replace(/BEF\.? /i, "Before ");
    dateval = dateval.replace(/AFT\.? /i, "After ");
    dateval = dateval.replace(/BET\.? /i, "Between ");
    dateval = dateval.replace(/BTW\.? /i, "Between ");
    dateval = dateval.replace(/about/i, "Circa");
    dateval = dateval.replace(/before/i, "Before");
    dateval = dateval.replace(/after/i, "After");
    dateval = dateval.replace(/from/i, "After");
    dateval = dateval.replace(/^in /i, "");
    if (dateval.contains(".")) {
        if (dateval.search(/\w\./) !== -1) {
            dateval = dateval.replace(/\./g,"");
        } else {
            dateval = dateval.replace(/\./g,"-");
        }
    }

    if (dateval.search(/\d{4}\/\d{4}/) !== -1) {
        dateval = "Between " + dateval.replace("/", " and ");
    } else if (dateval.search(/\d{4}\-\d{4}/) !== -1) {
        var andval = " and ";
        if (dateval.contains("Circa")) {
            andval = andval + "Circa ";
        }
        dateval = "Between " + dateval.replace("-", andval);
    } else if (dateval.search(/\d{4}\/\d{2}/) !== -1) {
        dateval = dateval.replace(/\d{2}\//,"");
    }
 
    dateval = dateval.replace("Between Between", "Between");
    dateval = dateval.replace("Circa Circa","Circa");
    dateval = dateval.replace(/\s?\/\s?/g, "-");

    if (dateval.startsWith("To")) {
        dateval = dateval.replace(/^to/i, "Before");
    }
    if (dateval.contains(" to ")) {
        dateval = dateval.replace(" to ", " and ");
        if (!dateval.startsWith("Between")) {
            dateval = "Between " + dateval;
        }
    } else if (dateval.search(/\d{4}-\d{4}/) === -1 && dateval.search(/\d{2}-\d{4}/) !== -1) {
        // Read as DD-MM-YYYY format
    } else if (dateval.search(/\d{4}-\d{4}/) === -1 && dateval.search(/\d{4}-\d{2}/) !== -1) {
        // Read as YYYY-MM-DD format
    } else if (dateval.search(/\D{3}-\d{4}/)) {
        // Read as MMM-YYYY format
    } else if (dateval.contains("-")) {
        dateval = dateval.replace("-", " and ");
        if (!dateval.startsWith("Between")) {
            dateval = "Between " + dateval;
        }
    }
    if (dateval.search(/\d,\d/) !== -1) {
        dateval = dateval.replace(",", ", ");
    } else if (dateval.search(/\d{1,2} \d{1,2} \d{4}/) !== -1) {
        dateval = dateval.replace(/ /g, "-");
    } else if (dateval.search(/\d{4} \d{1,2} \d{1,2}/) !== -1) {
        dateval = dateval.replace(/ /g, "-");
    } else if (dateval.search(/\D, \d/) !== -1) {
        dateval = dateval.replace(",", "");
    }
    
    /*
    TODO Trying to set the format to MMM D YYYY, can produce Jan 1 YYYY if no month or day is present
    var momentval = moment(dateval.replace("Circa ", ""), getDateFormat(dateval.replace("Circa ", "")), true);
    if (momentval.isValid()) {
        //Try to format this similar to Geni for easy comparision
        if (dateval.startsWith("Circa ")) {
            dateval = "Circa " + momentval.format("MMM D YYYY");
        } else {
            dateval = momentval.format("MMM D YYYY");
        }
    }*/

    return dateval;
}

function loadGeniData() {
    familystatus.push("about");
    var abouturl = "https://www.geni.com/api/" + focusid + "?fields=about_me,nicknames";
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: abouturl
    }, function (response) {
        if (exists(response) && response.source !== "") {
            var geni_return = JSON.parse(response.source);
            if (!$.isEmptyObject(geni_return)) {
                if (exists(geni_return.about_me)) {
                    focusabout = geni_return.about_me;
                }
                if (exists(geni_return.nicknames)) {
                    focusnicknames = geni_return.nicknames;
                }
            }
        }
        familystatus.pop();
    });
}

function checkLiving(name) {
    return (name.startsWith("\<Private\>") || name.startsWith("Private") || name.startsWith("Living"));
}

function recursiveCompare(obj, reference) {
    if (obj === reference) return true;
    if (obj.constructor !== reference.constructor) return false;
    if (obj instanceof Array) {
        if (obj.length !== reference.length) return false;
        obj = obj.sort();
        reference = reference.sort();
        for (var i = 0, len = obj.length; i < len; i++) {
            if (typeof obj[i] == "object" && typeof reference[j] == "object") {
                if (!recursiveCompare(obj[i], reference[i])) return false;
            }
            else if (obj[i] !== reference[i]) return false;
        }
    }
    else {
        var objListCounter = 0;
        var refListCounter = 0;
        for (var i in obj) {
            objListCounter++;
            if (typeof obj[i] == "object" && typeof reference[i] == "object") {
                if (!recursiveCompare(obj[i], reference[i])) return false;
            }
            else if (obj[i] !== reference[i]) return false;
        }
        for (var i in reference) refListCounter++;
        if (objListCounter !== refListCounter) return false;
    }
    return true; //Every object and array is equal
}

function checkBurial(profiledata){
    var data = [];
    var dd = profiledata["death"][0]["date"].trim();
    if (dd.startsWith("Between")) {
        var btsplit = dd.split(" and ");
        if (btsplit.length > 1) {
            dd = btsplit[1];
        }
    }
    if (dd.startsWith("After Circa") || dd.startsWith("Circa After")) {
        dd = dd;
    } else if (dd.startsWith("After")) {
        dd = dd.replace("After", "After Circa");
    } else if (dd.startsWith("Before Circa") || dd.startsWith("Circa Before")) {
        dd = dd;
    } else if (dd.startsWith("Before")) {
        dd = dd.replace("Before", "Before Circa");
    } else if (dd.startsWith("Circa")) {
        dd = dd;
    } else if (!dd.startsWith("Between") && isNaN(dd)) {
        dd = "After " + dd;
    }
    if (!dd.startsWith("Between")) {
        data.push({date: dd});
        data.push(profiledata["burial"][0]);
        profiledata["burial"] = data;
    }

    return profiledata;
}

function getDate(data) {
    if (exists(data[0]) && exists(data[0].date)) {
        return data[0].date;
    } else {
        return null;
    }
}

function getLocation(data) {
    if (exists(data[1]) && exists(data[1].location)) {
        return data[1].location;
    } else if (exists(data[0]) && exists(data[0].location)) {
        return data[0].location;
    } else {
        return null;
    }
}

function emptyEvent(data) {
    if (exists(data)) {
        if (exists(data.date)) {
            var eventdate = data.date;
            for (var key in eventdate){
                var value = eventdate[key];
                if (key === "year" && isNaN(value)) {
                    value = "";
                }
                if (key !== "circa" && value !== "") {
                    return false;
                }
            }
        }
        if (exists(data.location)) {
            var eventlocation = data.location;
            for (var key in eventlocation){
                var value = eventlocation[key];
                if (value !== "") {
                    return false;
                }
            }
        }
    }
    return true;
}

function geniPhoto(gender) {
    if (isMale(gender)) {
        return "images/no_photo_m.gif";
    } else if (isFemale(gender)) {
        return "images/no_photo_f.gif";
    } else {
        return "images/no_photo_u.gif";
    }
}

function setGeniFamilyData(id, profile) {
    var nameicon = getGeniLock(profile, "name");
    $("#" + id + "_geni_photo_urls").attr('src', getGeniData(profile, "photo_urls"));
    $("#" + id + "_geni_mugshot").attr('src', isAppend(getGeniData(profile, "photo_urls")));
    $("#" + id + "_geni_title").val(getGeniData(profile, "title"));
    $("#" + id + "_geni_title").prev().attr('src', nameicon);
    $("#" + id + "_geni_first_name").val(getGeniData(profile, "first_name").replace(/&quot;/g, '"'));
    $("#" + id + "_geni_first_name").prev().attr('src', nameicon);
    $("#" + id + "_geni_middle_name").val(getGeniData(profile, "middle_name").replace(/&quot;/g, '"'));
    $("#" + id + "_geni_middle_name").prev().attr('src', nameicon);
    $("#" + id + "_geni_last_name").val(getGeniData(profile, "last_name"));
    $("#" + id + "_geni_last_name").prev().attr('src', nameicon);
    $("#" + id + "_geni_maiden_name").val(getGeniData(profile, "maiden_name"));
    $("#" + id + "_geni_maiden_name").prev().attr('src', nameicon);
    $("#" + id + "_geni_suffix").val(getGeniData(profile, "suffix"));
    $("#" + id + "_geni_suffix").prev().attr('src', nameicon);
    $("#" + id + "_geni_display_name").val(getGeniData(profile, "display_name").replace(/&quot;/g, '"'));
    $("#" + id + "_geni_display_name").prev().attr('src', nameicon);
    $("#" + id + "_geni_nicknames").val(getGeniData(profile, "nicknames"));
    $("#" + id + "_geni_nickimage").attr('src', isAppend(profile));
    $("#" + id + "_geni_about").attr('src', isAppend(profile));
    $("#" + id + "_geni_occupation").val(getGeniData(profile, "occupation"));
    $("#" + id + "_geni_occupation").prev().attr('src', getGeniLock(profile, "occupation"));
    $("#" + id + "_geni_gender").val(capFL(getGeniData(profile, "gender")));
    $("#" + id + "_geni_gender").prev().attr('src', getGeniLock(profile, "gender"));
    $("#" + id + "_geni_is_alive").val(isAlive(getGeniData(profile, "is_alive")));
    $("#" + id + "_geni_is_alive").prev().attr('src', getGeniLock(profile, "living"));
    $("#" + id + "_geni_public").val(isPublic(getGeniData(profile, "public")));
    $("#" + id + "_geni_public").prev().attr('src', getGeniLock(profile, "public"));
    $("#" + id + "_geni_cause_of_death").val(getGeniData(profile, "cause_of_death"));
    $("#" + id + "_geni_cause_of_death").prev().attr('src', getGeniLock(profile, "cause_of_death"));

    var listvalues = ["birth", "baptism", "marriage", "divorce", "death", "burial"];
    for (var i = 0; i < listvalues.length; i++) {
        var title = listvalues[i];
        var locationicon = getGeniLock(profile, title, "location");
        $("#" + id + "_geni_" + title + "_date").val(getGeniData(profile, title, "date.formatted_date"));
        $("#" + id + "_geni_" + title + "_date").prev().attr('src', getGeniLock(profile, title, "date"));
        $("#" + id + "_geni_" + title + "_location_string").val(getGeniData(profile, title, "location_string"));
        $("#" + id + "_geni_" + title + "_location_string").prev().attr('src', locationicon);
        $("#" + id + "_geni_" + title + "_place").val(getGeniData(profile, title, "location.place_name"));
        $("#" + id + "_geni_" + title + "_place").prev().attr('src', locationicon);
        $("#" + id + "_geni_" + title + "_city").val(getGeniData(profile, title, "location.city"));
        $("#" + id + "_geni_" + title + "_city").prev().attr('src', locationicon);
        $("#" + id + "_geni_" + title + "_county").val(getGeniData(profile, title, "location.county"));
        $("#" + id + "_geni_" + title + "_county").prev().attr('src', locationicon);
        $("#" + id + "_geni_" + title + "_state").val(getGeniData(profile, title, "location.state"));
        $("#" + id + "_geni_" + title + "_state").prev().attr('src', locationicon);
        $("#" + id + "_geni_" + title + "_country").val(getGeniData(profile, title, "location.country"));
        $("#" + id + "_geni_" + title + "_country").prev().attr('src', locationicon);
    }

}

function isAlive(alive) {
    if (alive === "") {
        return "";
    } else if (alive) {
        return "Living";
    } else {
        return "Deceased";
    }
}

function isPublic(privacy) {
    if (privacy) {
        return "Public";
    } else {
        return "Private";
    }
}

function getGeniLock(profile, value, subvalue) {
    if (profile === "add") {
        return "images/right.png";
    }
    var person = genifamilydata[profile];
    if (!exists(person)) {
        return "images/right.png";
    }
    return "images/" + person.lockIcon(value, subvalue);
}

function isAppend(photo) {
    if (photo.startsWith("images/no_photo") || photo === "add") {
        return "images/right.png";
    } else {
        return "images/append.png";
    }
}
