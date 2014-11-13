var alldata = {};
var familystatus = [];
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
var parentflag = false;
var hideprofile = false;
var genispouse = [];
var myhspouse = [];
var focusgender = "unknown";
var focusabout = "";
var focusnicknames = "";
var wikiparentmarriage = "";
alldata["family"] = {};

function updateGeo() {
    if (familystatus.length > 0) {
        setTimeout(updateGeo, 200);
    } else {
        console.log("Family Processed...");
        document.getElementById("readstatus").innerHTML = "Determining Locations";
        var listvalues = ["birth", "baptism", "marriage", "death", "burial"];
        for (var list in listvalues) if (listvalues.hasOwnProperty(list)) {
            var title = listvalues[list];
            var memberobj = alldata["profile"][title];
            if (exists(memberobj)) {
                for (var item in memberobj) if (memberobj.hasOwnProperty(item)) {
                    queryGeo(memberobj[item]);
                }
            }
        }
        if (locationtest) {
            $.get('location-test.txt', function(data) {
                var lines = data.split("\n");
                $.each(lines, function(n, location) {
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
                            queryGeo(memberobj[item]);
                        }
                    }
                }
            }
        }
        updateFamily();
    }
}

function updateFamily() {
    if (geostatus.length > 0) {
        setTimeout(updateFamily, 200);
    } else {
        console.log("Geo Processed...");
        document.getElementById("readstatus").innerHTML = "";
        updateGenders();
        buildForm();
        document.getElementById("loading").style.display = "none";
    }
}

function updateGenders() {
    var obj = alldata["family"];
    var parentgender;
    var spousegender;
    for (var relationship in obj) if (obj.hasOwnProperty(relationship)) {
        if (isParent(relationship)) {
            parentgender = obj[relationship];
        } else if(isPartner(relationship)) {
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
    var membersstring = div[0].innerHTML;
    var nameval = NameParse.parse(focusname, $('#mnameonoffswitch').prop('checked'));
    var displayname = "";
    if (nameval.prefix !== "") {
        displayname = nameval.displayname;
    }
    var namescore = scorefactors.contains("middle name");
    if (namescore) {
        membersstring +=
            '<tr><td class="profilediv"><input type="checkbox" class="checknext">First Name:</td><td style="float:right; padding: 0px;"><input type="text" name="first_name" value="' + nameval.firstName + '" disabled></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext" checked>Middle Name:</td><td style="float:right; padding: 0px;"><input type="text" name="middle_name" value="' + nameval.middleName + '"></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext">Last Name:</td><td style="float:right; padding: 0px;"><input type="text" name="last_name" value="' + nameval.lastName + '" disabled></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext">Birth Name:</td><td style="float:right; padding: 0px;"><input type="text" name="maiden_name" value="' + nameval.birthName + '" disabled></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext">Suffix: </td><td style="float:right; padding: 0px;"><input type="text" name="suffix" value="' + nameval.suffix + '" disabled></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext">Also Known As: </td><td style="float:right; padding: 0px;"><input type="text" name="nicknames" value="' + nameval.nickName + '" disabled></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext">Display Name: </td><td style="float:right; padding: 0px;"><input type="text" name="display_name" value="' + displayname + '" disabled></td></tr>' +
                '<tr><td colspan="2" style="padding: 0;"><div class="separator"></div></td></tr>';
    } else {
        membersstring +=
            '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">First Name:</td><td style="float:right; padding: 0px;"><input type="text" name="first_name" value="' + nameval.firstName + '" disabled></td></tr>' +
                '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Middle Name:</td><td style="float:right; padding: 0px;"><input type="text" name="middle_name" value="' + nameval.middleName + '" disabled></td></tr>' +
                '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Last Name:</td><td style="float:right; padding: 0px;"><input type="text" name="last_name" value="' + nameval.lastName + '" disabled></td></tr>' +
                '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Birth Name:</td><td style="float:right; padding: 0px;"><input type="text" name="maiden_name" value="' + nameval.birthName + '" disabled></td></tr>' +
                '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Suffix: </td><td style="float:right; padding: 0px;"><input type="text" name="suffix" value="' + nameval.suffix + '" disabled></td></tr>' +
                '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Also Known As: </td><td style="float:right; padding: 0px;"><input type="text" name="nicknames" value="' + nameval.nickName + '" disabled></td></tr>' +
                '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext">Display Name: </td><td style="float:right; padding: 0px;"><input type="text" name="display_name" value="' + displayname + '" disabled></td></tr>' +
                '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td colspan="2" style="padding: 0;"><div class="separator"></div></td></tr>';
    }
    div[0].innerHTML = membersstring;
    if (exists(alldata["profile"]["thumb"])) {
        membersstring = div[0].innerHTML;
        var title = "photo";
        var scorephoto = false;
        if (scorefactors.contains(title) && $('#photoonoffswitch').prop('checked')) {
            scorephoto = true;
            ck++;
        }
        var thumbnail = alldata["profile"]["thumb"];
        var image = alldata["profile"]["image"];
        membersstring = membersstring +
            '<tr id="photo"><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(thumbnail, scorephoto) + '>' +
            capFL(title) + ':</td><td style="float:right;padding: 0;"><input type="hidden" class="photocheck" name="' + title + '" value="' + image + '" ' + isEnabled(thumbnail, scorephoto) + '><img style="max-width: 158px" src="' + thumbnail + '"></td></tr>';
        div[0].innerHTML = membersstring;
    }
    if (exists(alldata["profile"]["occupation"])) {
        membersstring = div[0].innerHTML;
        if (x > 0) {
            membersstring = membersstring + '<tr><td colspan="2" style="padding: 0;"><div class="separator"></div></td></tr>';
        }
        x += 1;
        var title = "occupation";
        var scoreoccupation = false;
        if (scorefactors.contains(title)) {
            scoreoccupation = true;
            ck++;
        }
        var occupation = alldata["profile"]["occupation"];
        membersstring = membersstring +
            '<tr id="occupation"><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(occupation, scoreoccupation) + '>' +
            capFL(title) + ':</td><td style="float:right;padding: 0;"><input type="text" name="' + title + '" value="' + occupation + '" ' + isEnabled(occupation, scoreoccupation) + '></td></tr>';
        div[0].innerHTML = membersstring;
    } else {
        membersstring = div[0].innerHTML;
        membersstring = membersstring +
            '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow" id="occupation"><td style="font-weight: bold; font-size: 90%; vertical-align: middle;"><input type="checkbox" class="checknext">Occupation: </td><td style="float:right;"><input type="text" name="occupation" disabled></td></tr>' +
            '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td colspan="2" style="padding: 0;"><div class="separator"></div></td></tr>';
        div[0].innerHTML = membersstring;
    }
    if (exists(alldata["profile"].about)) {
        membersstring = div[0].innerHTML;
        if (x > 0) {
            membersstring = membersstring + '<tr><td colspan="2" style="padding: 0;"><div class="separator"></div></td></tr>';
        }
        x += 1;
        var scoreabout = true;
        if (focusabout.contains(alldata["profile"].about)) {
            scoreabout = false;
        }
        var about = alldata["profile"].about;
        membersstring = membersstring + '<tr><td colspan="2"><div class="profilediv" style="font-size: 80%;"><input type="checkbox" class="checknext" ' + isChecked(about, scoreabout) + '>About:</div><div style="padding-left:4px; padding-right:6px;"><textarea rows="4" name="about_me" style="width:100%;" ' + isEnabled(about, scoreabout) + '>' + about + '</textarea></div></td></tr>';
        div[0].innerHTML = membersstring;
    } else {
        membersstring = div[0].innerHTML;
        membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow" id="about"><td colspan="2"><div class="profilediv"><input type="checkbox" class="checknext">About:</div><div style="padding-top: 2px; padding-left:4px; padding-right:6px;"><textarea rows="4" name="about_me" style="width:100%;"  disabled></textarea></div></td></tr>';
        div[0].innerHTML = membersstring;
    }
    var geoplace = "table-row";
    var geoauto = "none";
    var geoicon = "geooff.png";
    if ($('#geoonoffswitch').prop('checked')) {
        geoplace = "none";
        geoauto = "table-row";
        geoicon = "geoon.png";
    }
    // ---------------------- Profile Data --------------------
    for (var list in listvalues) if (listvalues.hasOwnProperty(list)) {
        var title = listvalues[list];
        obj = alldata["profile"][title];
        membersstring = div[0].innerHTML;
        if (exists(obj)) {
            if (x > 0) {
                membersstring = membersstring + '<tr><td colspan="2" style="padding: 0;"><div class="separator"></div></td></tr>';
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
                    membersstring = membersstring +
                        '<tr id="birthdate"><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(dateval, scored) + '>' +
                        capFL(title) + ' Date:</td><td style="float:right;padding: 0;"><input type="text" name="' + title + ':date" value="' + dateval + '" ' + isEnabled(dateval, scored) + '></td></tr>';
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
                    var placegeo = geovar1.place;
                    var city = geovar1.city;
                    var county = geovar1.county;
                    var state = geovar1.state;
                    var country = geovar1.country;
                    locationval = locationval +
                        '<tr><td colspan="2" style="font-size: 90%;padding: 0;"><div class="membertitle" style="margin-top: 4px; margin-left: 3px; margin-right: 2px; padding-left: 5px; padding-right: 2px;">' +
                        '<img class="geoicon" style="cursor: pointer; float:left; padding-top: 2px; padding-right: 4px;" alt="Toggle Geolocation" title="Toggle Geolocation" src="images/' + geoicon + '" height="14px">' + capFL(title) + ' Location: &nbsp;' + place + '</div></td></tr>' +
                        '<tr class="geoplace"style="display: ' + geoplace + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(place, scored) + '>' + capFL(title) + ' Place:</td><td style="float:right;padding: 0;"><input type="text" name="' + title + ':location:place_name" value="' + place + '" ' + isEnabled(place, scored) + '></td></tr>' +
                        '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(placegeo, scored) + '>Place: </td><td style="float:right;padding: 0;"><input type="text" name="' + title + ':location:place_name_geo" value="' + placegeo + '" ' + isEnabled(placegeo, scored) + '></td></tr>' +
                        '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(city, scored) + '>City: </td><td style="float:right;padding: 0;"><input type="text" name="' + title + ':location:city" value="' + city + '" ' + isEnabled(city, scored) + '></td></tr>' +
                        '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(county, scored) + '>County: </td><td style="float:right;padding: 0;"><input type="text" name="' + title + ':location:county" value="' + county + '" ' + isEnabled(county, scored) + '></td></tr>' +
                        '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(state, scored) + '>State: </td><td style="float:right;padding: 0;"><input type="text" name="' + title + ':location:state" value="' + state + '" ' + isEnabled(state, scored) + '></td></tr>' +
                        '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(country, scored) + '>Country: </td><td style="float:right;padding: 0;"><input type="text" name="' + title + ':location:country" value="' + country + '" ' + isEnabled(country, scored) + '></td></tr>';
                    locationadded = true;
                    //div[0].style.display = "block";
                }
            }
            if (!dateadded) {
                membersstring = membersstring +
                    '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td style="font-weight: bold; font-size: 90%; vertical-align: middle;"><input type="checkbox" class="checknext">' + capFL(title) + ' Date: </td><td style="float:right;"><input type="text" name="' + title + ':date" disabled></td></tr>';
            }
            if(title === "death") {
                membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td style="font-weight: bold; font-size: 90%; vertical-align: middle;"><input type="checkbox" class="checknext">Death Cause: </td><td style="float:right;"><input type="text" name="cause_of_death" disabled></td></tr>';
            }
            if (!locationadded) {
                locationval = locationval +
                    '<tr class="hiddenrow" style="display: ' + isHidden(hidden) +';"><td colspan="2" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-right: 2px; padding-left: 5px;">' +
                    '<img class="geoicon" style="cursor: pointer; float:left; padding-top: 2px; padding-right: 4px;" src="images/' + geoicon + '" alt="Toggle Geolocation" title="Toggle Geolocation" height="14px">' + capFL(title) + ' Location: &nbsp;Unknown</div></td></tr>' +
                    '<tr class="geoplace hiddenrow" style="display: ' + isHidden(hidden, "place") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">' + capFL(title) + ' Place: </td><td style="float:right;"><input type="text" name="'+title+':location:place_name" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Place: </td><td style="float:right;"><input type="text" name="'+title+':location:place_name_geo" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">City: </td><td style="float:right;"><input type="text" name="'+title+':location:city" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">County: </td><td style="float:right;"><input type="text" name="'+title+':location:county" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">State: </td><td style="float:right;"><input type="text" name="'+title+':location:state" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Country: </td><td style="float:right;"><input type="text" name="'+title+':location:country" disabled></td></tr>';
            }
            membersstring = membersstring + locationval;
        } else {
            if (x > 0) {
                membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td colspan="2"><div class="separator"></div></td></tr>';
            }

            membersstring = membersstring +
                '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td style="font-weight: bold; font-size: 90%; vertical-align: middle;"><input type="checkbox" class="checknext">' + capFL(title) + ' Date: </td><td style="float:right;"><input type="text" name="' + title + ':date" disabled></td></tr>';
            if(title === "death") {
                membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td style="font-weight: bold; font-size: 90%; vertical-align: middle;"><input type="checkbox" class="checknext">Death Cause: </td><td style="float:right;"><input type="text" name="cause_of_death" disabled></td></tr>';
            }
            membersstring = membersstring +
                '<tr class="hiddenrow" style="display: ' + isHidden(hidden) +';"><td colspan="2" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-right: 2px; padding-left: 5px;">' +
                '<img class="geoicon" style="cursor: pointer; float:left; padding-top: 2px; padding-right: 4px;"  alt="Toggle Geolocation" title="Toggle Geolocation"  src="images/' + geoicon + '" height="14px">' + capFL(title) + ' Location: &nbsp;Unknown</div></td></tr>' +
                '<tr class="geoplace hiddenrow" style="display: ' + isHidden(hidden, "place") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">' + capFL(title) + ' Place: </td><td style="float:right;"><input type="text" name="'+title+':location:place_name" disabled></td></tr>' +
                '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Place: </td><td style="float:right;"><input type="text" name="'+title+':location:place_name_geo" disabled></td></tr>' +
                '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">City: </td><td style="float:right;"><input type="text" name="'+title+':location:city" disabled></td></tr>' +
                '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">County: </td><td style="float:right;"><input type="text" name="'+title+':location:county" disabled></td></tr>' +
                '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">State: </td><td style="float:right;"><input type="text" name="'+title+':location:state" disabled></td></tr>' +
                '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Country: </td><td style="float:right;"><input type="text" name="'+title+':location:country" disabled></td></tr>';

        }
        div[0].innerHTML = membersstring;
    }
    if (ck > 0) {
        $('#updateprofile').prop('checked', true);
    }
    if (x > 0) {
        document.getElementById("profiledata").style.display = "block";
    } else if (!hidden) {
        document.getElementById("profiledata").style.display = "block";
        hideprofile = true;
    } else {
        hideprofile = true;
    }

    // ---------------------- Family Data --------------------
    listvalues = ["birth", "baptism", "marriage", "death", "burial"];
    obj = alldata["family"];
    //console.log("");
    //console.log(JSON.stringify(obj));
    var i = 0;
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
        else if (isPartner(relationship)) {
            if (scorefactors.contains("spouse")) {
                scored = true;
                partnerck = true;
            }
            relationship = "partner";
        }

        var div = $("#" + relationship);
        if (members.length > 0 && exists(div[0])) {
            div[0].style.display = "block";
        }
        var parentscore = scored;
        var skipprivate = $('#privateonoffswitch').prop('checked');
        for (var member in members) if (members.hasOwnProperty(member)) {
            scored = parentscore;
            var entry = $("#" + relationship + "val")[0];
            var fullname = members[member].name;
            var living = false;
            if (!scored && relationship === "parent") {
                //used !== to also select unknown gender
                if (scorefactors.contains("father") && members[member].gender !== "female") {
                    scored = true;
                    $('#addparentck').prop('checked', true);
                } else if (scorefactors.contains("mother") && members[member].gender !== "male") {
                    scored = true;
                    $('#addparentck').prop('checked', true);
                }
            }
            if (skipprivate && fullname.startsWith("\<Private\>")) {
                scored = false;
            } else {
                scoreused = true;
            }
            if (exists(members[member].alive)){
                living = members[member].alive;
            } else if (fullname.startsWith("\<Private\>")) {
                living = true;
            }
            var nameval = NameParse.parse(fullname, $('#mnameonoffswitch').prop('checked'));
            if($('#birthonoffswitch').prop('checked')) {
                if ((relationship === "child" || relationship === "sibling") && nameval.birthName === "") {
                    nameval.birthName = nameval.lastName;
                } else if (relationship === "parent" && members[member].gender === "male") {
                    nameval.birthName = nameval.lastName;
                } else if (relationship === "partner" && members[member].gender === "male") {
                    nameval.birthName = nameval.lastName;
                }
            }
            var displayname = "";
            if (nameval.prefix !== "") {
                displayname = nameval.displayname;
            }
            var gender = members[member].gender;
            var bgcolor = genderColor(gender);
            var membersstring = entry.innerHTML;
            membersstring += '<div class="membertitle" style="background-color: ' + bgcolor + '"><table style="border-spacing: 0px; border-collapse: separate; width: 100%;"><tr>' +
                '<td><input type="checkbox" class="checkslide" name="checkbox' + i + '-' + relationship + '" ' + isChecked(fullname, scored) + '></td>' +
                '<td class="expandcontrol" name="' + i + '-' + relationship + '"  style="cursor: pointer; width: 100%;"><span style="font-size: 90%;">' + escapeHtml(fullname) + '</span>';
            if (!living) {
                membersstring += '<span style="float: right; position: relative; margin-right: -10px; margin-bottom: -5px; right: 8px; top: -3px; margin-left: -8px;"><img src="/images/deceased.png"></span>';
            }
            membersstring += '<span style="font-size: 130%; float: right; padding: 0px 8px;">&#9662;</span></td></tr></table></div>' +
                '<div id="slide' + i + '-' + relationship + '" class="memberexpand" style="display: none; padding-bottom: 6px; padding-left: 12px;"><table style="border-spacing: 0px; border-collapse: separate; width: 100%;">' +
                '<tr><td colspan="2"><input type="hidden" name="profile_id" value="' + members[member].profile_id + '" ' + isEnabled(members[member].profile_id, scored) + '></td></tr>';
            if (isChild(relationship)) {
                var parentrel = "Parent";
                if (focusgender === "male") {
                    parentrel = "Mother";
                } else if (focusgender === "female") {
                    parentrel = "Father";
                }
                membersstring += '<tr><td class="profilediv" colspan="2" style="padding-bottom: 2px;"><span style="margin-top: 3px; float: left;">&nbsp;' + parentrel + ':</span>' + buildParentSelect(members[member].parent_id) + '</td></tr>';
            }
            if (exists(members[member]["thumb"])) {
                var thumbnail = members[member]["thumb"];
                var image = members[member]["image"];
                membersstring = membersstring +
                    '<tr id="photo"><td class="profilediv"><input type="checkbox" class="checknext photocheck" ' + isChecked(thumbnail, (scored && photoscore)) + '>' +
                    "Photo" + ':</td><td style="float:right;padding: 0;"><input type="hidden" class="photocheck" name="photo" value="' + image + '" ' + isEnabled(thumbnail, (scored && photoscore)) + '><img style="max-width: 158px"  src="' + thumbnail + '"></td></tr>';
            }
            membersstring +=
                '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.firstName, scored) + '>First Name:</td><td style="float:right; padding: 0px;"><input type="text" name="first_name" value="' + nameval.firstName + '" ' + isEnabled(nameval.firstName, scored) + '></td></tr>' +
                    '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.middleName, scored) + '>Middle Name:</td><td style="float:right; padding: 0px;"><input type="text" name="middle_name" value="' + nameval.middleName + '" ' + isEnabled(nameval.middleName, scored) + '></td></tr>' +
                    '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.lastName, scored) + '>Last Name:</td><td style="float:right; padding: 0px;"><input type="text" name="last_name" value="' + nameval.lastName + '" ' + isEnabled(nameval.lastName, scored) + '></td></tr>' +
                    '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.birthName, scored) + '>Birth Name:</td><td style="float:right; padding: 0px;"><input type="text" name="maiden_name" value="' + nameval.birthName + '" ' + isEnabled(nameval.birthName, scored) + '></td></tr>' +
                    '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.suffix, scored) + '>Suffix: </td><td style="float:right; padding: 0px;"><input type="text" name="suffix" value="' + nameval.suffix + '" ' + isEnabled(nameval.suffix, scored) + '></td></tr>' +
                    '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.nickName, scored) + '>Also Known As: </td><td style="float:right; padding: 0px;"><input type="text" name="nicknames" value="' + nameval.nickName + '" ' + isEnabled(nameval.nickName, scored) + '></td></tr>' +
                    '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(displayname, scored) + '>Display Name: </td><td style="float:right; padding: 0px;"><input type="text" name="display_name" value="' + displayname + '" ' + isEnabled(displayname, scored) + '></td></tr>';
            if (exists(members[member]["occupation"])) {
                var occupation = members[member]["occupation"];
                membersstring = membersstring + '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(occupation, scored) + '>Occupation: </td><td style="float:right; padding: 0px;"><input type="text" name="occupation" value="' + occupation + '" ' + isEnabled(occupation, scored) + '></td></tr>';
            } else {
                membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow" id="occupation"><td style="font-weight: bold; font-size: 90%; vertical-align: middle;"><input type="checkbox" class="checknext">Occupation: </td><td style="float:right;"><input type="text" name="occupation" disabled></td></tr>';
            }
            membersstring = membersstring + '<tr><td class="profilediv" style="padding: 2px; 0px;"><input type="checkbox" class="checknext" ' + isChecked(gender, scored) + '>Gender: </td><td style="float:right; padding-top: 2px;"><select class="genderselect" style="width: 151px; height: 24px; margin-right: 1px; -webkit-appearance: menulist-button;" name="gender" ' + isEnabled(gender, scored) + '>' +
                '<option value="male" '+ setGender("male", gender) + '>Male</option><option value="female" '+ setGender("female", gender) + '>Female</option><option value="unknown" '+ setGender("unknown", gender) + '>Unknown</option></select></td></tr>' +
                '<tr><td class="profilediv" style="padding: 2px; 0px;"><input type="checkbox" class="checknext" ' + isChecked(living, scored) + '>Vital: </td><td style="float:right; padding-top: 2px;"><select style="width: 151px; height: 24px; margin-right: 1px; -webkit-appearance: menulist-button;" name="is_alive" ' + isEnabled(living, scored) + '>' +
                '<option value=false '+ setLiving("deceased", living) + '>Deceased</option><option value=true '+ setLiving("living", living) + '>Living</option></select></td></tr>';
            if (exists(members[member].about)) {
                var about = members[member].about;
                membersstring = membersstring + '<tr><td colspan="2"><div class="profilediv" style="font-size: 80%;"><input type="checkbox" class="checknext" ' + isChecked(about, scored) + '>About:</div><div style="padding-left:4px; padding-right:6px;"><textarea rows="4" name="about_me" style="width:100%;" ' + isEnabled(about, scored) + '>' + about + '</textarea></div></td></tr>';
            } else {
                membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow" id="about"><td colspan="2"><div class="profilediv"><input type="checkbox" class="checknext">About:</div><div style="padding-top: 2px; padding-left:4px; padding-right:6px;"><textarea rows="4" name="about_me" style="width:100%;"  disabled></textarea></div></td></tr>';
            }
            for (var list in listvalues) if (listvalues.hasOwnProperty(list)) {
                var title = listvalues[list];
                if ((relationship !== "partner" && relationship !== "parent") && title === "marriage") {
                    continue;  //Skip marriage date fields if not partner
                }
                var memberobj = members[member][title];
                if (exists(memberobj)) {
                    membersstring = membersstring + '<tr><td colspan="2"><div class="separator"></div></td></tr>';

                    var dateadded = false;
                    var locationadded = false;
                    var locationval = "";
                    for (var item in memberobj) if (memberobj.hasOwnProperty(item)) {
                        if (exists(memberobj[item].date)) {
                            var dateval = memberobj[item].date;
                            membersstring = membersstring +
                                '<tr><td style="font-weight: bold; font-size: 90%; vertical-align: middle;"><input type="checkbox" class="checknext" ' + isChecked(dateval, scored) + '>' + capFL(title) + ' Date: </td><td style="float:right;"><input type="text" name="' + title + ':date" value="' + dateval + '" ' + isEnabled(dateval, scored) + '></td></tr>';
                            dateadded = true;
                        }
                        if (exists(memberobj[item].location)) {
                            var place = memberobj[item].location;
                            var geovar2 = geolocation[memberobj[item].id];
                            var placegeo = geovar2.place;
                            var city = geovar2.city;
                            var county = geovar2.county;
                            var state = geovar2.state;
                            var country = geovar2.country;
                            locationval = locationval +
                                '<tr><td colspan="2" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-right: 2px; padding-left: 5px;">' +
                                '<img class="geoicon" style="cursor: pointer; float:left; padding-top: 2px; padding-right: 4px;" alt="Toggle Geolocation" title="Toggle Geolocation" src="images/' + geoicon + '" height="14px">' + capFL(title) + ' Location: &nbsp;' + place + '</div></td></tr>' +
                                '<tr class="geoplace" style="display: ' + geoplace + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(place, scored) + '>' + capFL(title) + ' Place: </td><td style="float:right;"><input type="text" name="'+title+':location:place_name" value="' + place + '" ' + isEnabled(place, scored) + '></td></tr>' +
                                '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(placegeo, scored) + '>Place: </td><td style="float:right;"><input type="text" name="'+title+':location:place_name_geo" value="' + placegeo + '" ' + isEnabled(placegeo, scored) + '></td></tr>' +
                                '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(city, scored) + '>City: </td><td style="float:right;"><input type="text" name="'+title+':location:city" value="' + city + '" ' + isEnabled(city, scored) + '></td></tr>' +
                                '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(county, scored) + '>County: </td><td style="float:right;"><input type="text" name="'+title+':location:county" value="' + county + '" ' + isEnabled(county, scored) + '></td></tr>' +
                                '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(state, scored) + '>State: </td><td style="float:right;"><input type="text" name="'+title+':location:state" value="' + state + '" ' + isEnabled(state, scored) + '></td></tr>' +
                                '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(country, scored) + '>Country: </td><td style="float:right;"><input type="text" name="'+title+':location:country" value="' + country + '" ' + isEnabled(country, scored) + '></td></tr>';
                            locationadded = true;
                        }
                    }
                    if (!dateadded) {
                        membersstring = membersstring +
                            '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td style="font-weight: bold; font-size: 90%; vertical-align: middle;"><input type="checkbox" class="checknext">' + capFL(title) + ' Date: </td><td style="float:right;"><input type="text" name="' + title + ':date" disabled></td></tr>';

                    }
                    if (title === "death") {
                        membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td style="font-weight: bold; font-size: 90%; vertical-align: middle;"><input type="checkbox" class="checknext">Death Cause: </td><td style="float:right;"><input type="text" name="cause_of_death"></td></tr>';
                    }
                    if (!locationadded) {
                        locationval = locationval +
                            '<tr class="hiddenrow" style="display: ' + isHidden(hidden) +';"><td colspan="2" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-right: 2px; padding-left: 5px;">' +
                            '<img class="geoicon" style="cursor: pointer; float:left; padding-top: 2px; padding-right: 4px;" src="images/' + geoicon + '" alt="Toggle Geolocation" title="Toggle Geolocation" height="14px">' + capFL(title) + ' Location: &nbsp;Unknown</div></td></tr>' +
                            '<tr class="geoplace hiddenrow" style="display: ' + isHidden(hidden, "place") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">' + capFL(title) + ' Place: </td><td style="float:right;"><input type="text" name="'+title+':location:place_name" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Place: </td><td style="float:right;"><input type="text" name="'+title+':location:place_name_geo" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">City: </td><td style="float:right;"><input type="text" name="'+title+':location:city" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">County: </td><td style="float:right;"><input type="text" name="'+title+':location:county" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">State: </td><td style="float:right;"><input type="text" name="'+title+':location:state" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Country: </td><td style="float:right;"><input type="text" name="'+title+':location:country" disabled></td></tr>';

                    }
                    membersstring = membersstring + locationval;
                } else {
                    membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td colspan="2"><div class="separator"></div></td></tr>';

                    membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td style="font-weight: bold; font-size: 90%; vertical-align: middle;"><input type="checkbox" class="checknext">' + capFL(title) + ' Date: </td><td style="float:right;"><input type="text" name="' + title + ':date" disabled></td></tr>';
                    if (title === "death") {
                        membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) +';" class="hiddenrow"><td style="font-weight: bold; font-size: 90%; vertical-align: middle;"><input type="checkbox" class="checknext">Death Cause: </td><td style="float:right;"><input type="text" name="cause_of_death" disabled></td></tr>';
                    }
                    membersstring = membersstring +
                        '<tr class="hiddenrow" style="display: ' + isHidden(hidden) +';"><td colspan="2" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-right: 2px; padding-left: 5px;">' +
                        '<img class="geoicon" style="cursor: pointer; float:left; padding-top: 2px; padding-right: 4px;" src="images/' + geoicon + '" alt="Toggle Geolocation" title="Toggle Geolocation" height="14px">' + capFL(title) + ' Location: &nbsp;Unknown</div></td></tr>' +
                        '<tr class="geoplace hiddenrow" style="display: ' + isHidden(hidden, "place") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">' + capFL(title) + ' Place: </td><td style="float:right;"><input type="text" name="'+title+':location:place_name" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Place: </td><td style="float:right;"><input type="text" name="'+title+':location:place_name_geo" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">City: </td><td style="float:right;"><input type="text" name="'+title+':location:city" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">County: </td><td style="float:right;"><input type="text" name="'+title+':location:county" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">State: </td><td style="float:right;"><input type="text" name="'+title+':location:state" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow" style="display: ' + isHidden(hidden, "loc") +';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Country: </td><td style="float:right;"><input type="text" name="'+title+':location:country" disabled></td></tr>';

                }
            }

            membersstring = membersstring + '</table></div>';
            entry.innerHTML = membersstring;

            //log("  " + members[member].name);
            i++;
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

    $(function () {
        $('.genderselect').on('change', function() {
            var genselect = $(this);
            var gendercolor = genderColor(genselect[0].options[genselect[0].selectedIndex].value);
            genselect.closest('.memberexpand').prev('.membertitle').css('background-color', gendercolor);
        });
    });

    $(function () {
        $('.expandcontrol').on('click', function() {
            expandFamily($(this).attr("name"));
        });
    });

    $(function () {
        $('.checknext').on('click', function () {
            $(this).closest('tr').find("input:text,select,input:hidden,textarea").attr("disabled", !this.checked);
            if (this.checked) {
                var personslide = $(this).closest('.memberexpand').prev('.membertitle');
                personslide.find('.checkslide').prop('checked', true);
                personslide.find('input:hidden').attr('disabled', false);
            }
        });
    });
    $(function () {
        $('.checkslide').on('click', function () {
            var fs = $("#" + this.name.replace("checkbox", "slide"));
            var ffs = fs.find(':checkbox');
            var photoon = $('#photoonoffswitch').prop('checked');
            ffs.filter(function(item) {
                return !(!photoon && $(ffs[item]).hasClass("photocheck") && !this.checked);
            }).prop('checked', this.checked);
            ffs = fs.find('input:text,select,input:hidden,textarea');
            ffs.filter(function(item) {
                return !((ffs[item].type === "checkbox") || (!photoon && $(ffs[item]).hasClass("photocheck") && !this.checked));
            }).attr('disabled', !this.checked);
        });
    });
    $(function () {
        $('.geoicon').on('click', function () {
            var fs = $(this);
            if (fs.attr("src") === "images/geoon.png") {
                fs.attr("src", "images/geooff.png");
                var tb = $(this).closest('tr').next();
                tb[0].style.display = "table-row";
                tb = tb.next();
                tb[0].style.display = "none"; //place
                tb = tb.next();
                tb[0].style.display = "none"; //city
                tb = tb.next();
                tb[0].style.display = "none"; //county
                tb = tb.next();
                tb[0].style.display = "none"; //state
                tb = tb.next();
                tb[0].style.display = "none"; //country
            } else {
                fs.attr("src", "images/geoon.png");
                var tb = $(this).closest('tr').next();
                tb[0].style.display = "none";
                tb = tb.next();
                tb[0].style.display = "table-row"; //place
                tb = tb.next();
                tb[0].style.display = "table-row"; //city
                tb = tb.next();
                tb[0].style.display = "table-row"; //county
                tb = tb.next();
                tb[0].style.display = "table-row"; //state
                tb = tb.next();
                tb[0].style.display = "table-row"; //country
            }
        });
    });

    if (i > 0) {
        document.getElementById("familydata").style.display = "block";
    }
    document.getElementById("bottomsubmit").style.display = "block";
    parsecomplete = true;
    console.log("Process Complete...");
}

function isValue(object) {
    return (object !== "");
}

function isEnabled(value, score) {
    if (score && isValue(value)) {
        return "";
    } else {
        return "disabled";
    }
}

function isFemale(title) {
    title = title.replace(" (implied)", "");
    return (title === "wife" || title === "ex-wife" || title === "mother" || title === "sister" || title === "daughter");
}

function isMale(title) {
    title = title.replace(" (implied)", "");
    return (title === "husband" || title === "ex-husband" || title === "father" || title === "brother" || title === "son");
}

function isSibling(relationship) {
    relationship = relationship.replace(" (implied)", "");
    return (relationship === "siblings" || relationship === "sibling" || relationship === "brother" || relationship === "sister");
}

function isChild(relationship) {
    relationship = relationship.replace(" (implied)", "");
    return (relationship === "children" || relationship === "child" || relationship === "son" || relationship === "daughter");
}

function isParent(relationship) {
    relationship = relationship.replace(" (implied)", "");
    return (relationship === "parents" || relationship === "father" || relationship === "mother" || relationship === "parent");
}

function isPartner(relationship) {
    relationship = relationship.replace(" (implied)", "");
    return (relationship === "wife" || relationship === "husband" || relationship === "partner" || relationship === "ex-husband" || relationship === "ex-wife" || relationship === "ex-partner" || relationship === "spouse" || relationship === "spouses");
}

function isHidden(value, geo) {
    var hidden = $('#geoonoffswitch').prop('checked');
    if (geo === "place" && hidden) {
        return "none";
    } else if(geo === "loc" && !hidden) {
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

function setGender(gender,value) {
    if (gender === value) {
        return "selected";
    }
    return "";
}

function setLiving(living,value) {
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

function isChecked(value, score) {
    if (score && isValue(value)) {
        return "checked";
    } else {
        return "";
    }
}

function buildParentSelect(id) {
    var geniselect = "";
    var scorefactors = alldata["scorefactors"];
    var spousescore = scorefactors.contains("spouse");
    var geniparent = $('#geniparentonoffswitch').prop('checked');
    var pselect = '<select name="parent" style="width: 215px; float: right; height: 24px; margin-right: 1px; -webkit-appearance: menulist-button;" >';
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
            pselect += '<option value="' + myhspouse[key] + '" ' + isSelected(id, myhspouse[key]) + '>MyH: ' + databyid[myhspouse[key]].name.replace("born ", "") + '</option>';
        }
    }
    for (var key in genispouse) if (genispouse.hasOwnProperty(key)) {
        pselect += '<option value="' + genispouse[key].union + '"' + geniselect + '>Geni: ' + genispouse[key].name + '</option>';
    }
    pselect += '</select>';
    return pselect;
}


function updateInfoData(person, arg) {
    person["url"] = arg["url"];
    person["itemId"] = arg["itemId"];
    person["profile_id"] = arg["profile_id"];

    if (exists(arg.name)) {
        //This compares the data on the focus profile to the linked profile and uses most complete
        //Sometimes more information is shown on the SM, but when you click the link it goes <Private>
        var mname = $('#mnameonoffswitch').prop('checked');
        var tempname = NameParse.parse(person.name, mname);
        var argname = NameParse.parse(arg.name, mname);
        if (person.name.startsWith("\<Private\>") && !arg.name.startsWith("\<Private\>")) {
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
            person["alive"] = true;
        }
        if (argname.suffix !== "" && tempname.suffix === "") {
            person.name += ", " + argname.suffix;
        }
        if (tempname.lastName !== argname.lastName && tempname.lastName.toLowerCase() === argname.lastName.toLowerCase()) {
            //Check if one is CamelCase
            var tlast = tempname.lastName.substring(1, tempname.lastName.length);
            var alast = argname.lastName.substring(1, argname.lastName.length);
            if(!NameParse.is_camel_case(tlast) && NameParse.is_camel_case(alast)){
                person.name = person.name.replace(tempname.lastName, argname.lastName);
            }
        }
        if (tempname.birthName !== argname.birthName && tempname.birthName.toLowerCase() === argname.birthName.toLowerCase()) {
            //Check if one is CamelCase
            var tlast = tempname.birthName.substring(1, tempname.birthName.length);
            var alast = argname.birthName.substring(1, argname.birthName.length);
            if(!NameParse.is_camel_case(tlast) && NameParse.is_camel_case(alast)){
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
            person["birth"] = [{"date": arg.birthyear}];
        }
        if (exists(arg.deathyear) && !exists(person.death)) {
            person["death"] = [{"date": arg.deathyear}];
        }
        if (!tablink.contains("/collection-1/") && !exists(person["death"]) && exists(person["birth"])) {
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
        if (exists(arg.marriage)) {
            delete arg["marriage"][0].name;
            person["marriage"] = arg["marriage"];
        }
    }
    return person;
}

function parseWikiURL(wikistring) {
    wikistring = wikistring.replace(/<a href="(.*?)"*>/mg, '[$1 ').replace(/<\/a>/g, "]");
    return wikistring;
}

function cleanHTML(html) {
    var div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
}

function loadGeniData() {
    familystatus.push("family");
    var familyurl = "http://historylink.herokuapp.com/smartsubmit?family=spouse&profile=" + focusid;
    chrome.extension.sendMessage({
        method: "GET",
        action: "xhttp",
        url: familyurl
    }, function (response) {
        genispouse = JSON.parse(response.source);
        familystatus.pop();
    });
    familystatus.push("about");
    var abouturl = "http://historylink.herokuapp.com/smartsubmit?fields=about_me,nicknames&profile=" + focusid;
    chrome.extension.sendMessage({
        method: "GET",
        action: "xhttp",
        url: abouturl
    }, function (response) {
        var geni_return = JSON.parse(response.source);
        if (!$.isEmptyObject(geni_return)){
            if (exists(geni_return.about_me)) {
                focusabout = geni_return.about_me;
            }
            if (exists(geni_return.nicknames)){
                focusnicknames = geni_return.nicknames;
            }
        }
        familystatus.pop();
    });
}