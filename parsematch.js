var alldata = {};
var familystatus = [];
var geostatus = [];
var geoid = 0;
var geolocation = [];
var parsecomplete = false;
// Parse MyHeritage Tree from Smart Match
function parseSmartMatch(htmlstring, familymembers) {
    var parsed = $('<div>').html(htmlstring.replace(/<img[^>]*>/g, ""));
    var focusperson = parsed.find(".recordTitle").text().trim();
    var focusdaterange = parsed.find(".recordSubtitle").text().trim();
    //console.log(focusperson);
    var genderdiv = parsed.find(".recordImage");
    var genderimage = $(genderdiv).find('.PK_Silhouette');
    var genderval = "unknown";
    if ($(genderimage).hasClass('PK_Silhouette_S_150_M_A_LTR') || $(genderimage).hasClass('PK_Silhouette_S_150_M_C_LTR')) {
        genderval = "male";
    } else if ($(genderimage).hasClass('PK_Silhouette_S_150_F_A_LTR') || $(genderimage).hasClass('PK_Silhouette_S_150_F_C_LTR')) {
        genderval = "female";
    }
    var profiledata = {name: focusperson, gender: genderval};
    var records = parsed.find(".recordFieldsContainer");
    if (records.length > 0 && records[0].hasChildNodes()) {

        // ---------------------- Profile Data --------------------
        if (focusdaterange !== "") {
            profiledata["daterange"] = focusdaterange;
        }
        var children = records[0].childNodes;
        var child = children[0];
        var rows = $(child).find('tr');

        for (var r = 0; r < rows.length; r++) {

            // console.log(row);
            var row = rows[r];
            var title = $(row).find(".recordFieldLabel").text().toLowerCase().replace(":", "").trim();

            if (title !== "birth" && title !== 'death' && title !== 'baptism' && title !== 'burial') {
                /*
                 This will exclude residence, since the API seems to only support current residence.
                 It also will remove Military Service and any other entry not explicitly defined above.
                 */
                //TODO Look at Marriage and Partner dates - uses the Union API.
                continue;  //move to the next entry
            }
            //TODO Get Place Names as well
            //console.log(title);
            //console.log(valdate);

            var valdate = "";
            var vallocal = $(row).find(".map_callout_link").text().trim();
            var valplace = "";

            //var vdate = $(row).find(".recordFieldValue");
            //var valdate = vdate.clone().children().remove().end().text().trim();
            if (exists($(row).find(".recordFieldValue").contents().get(0))) {
                //console.log($(row).find(".recordFieldValue").contents());
                valdate = $(row).find(".recordFieldValue").contents().get(0).nodeValue;
                //console.log(valdate);
                var verifydate = moment(valdate, ["MMM D YYYY", "MMM YYYY", "YYYY", "MMM", "MMM D"]).isValid();
                if (!verifydate) {
                    if (valdate !== null && !valdate.toLowerCase().startsWith("parent")) {
                        valplace = valdate.trim();
                    }
                    if (exists($(row).find(".recordFieldValue").contents().get(2))) {
                        valdate = $(row).find(".recordFieldValue").contents().get(2).nodeValue;
                    }
                    verifydate = moment(valdate, ["MMM D YYYY", "MMM YYYY", "YYYY", "MMM", "MMM D"]).isValid();
                    if (!verifydate) {
                        valdate = "";
                    }
                }
            }


            var data = [];
            if (valdate !== "") {
                data.push({date: valdate});
            }
            if (vallocal !== "") {
                data.push({location: vallocal, geolocation: geoid, geoplace: valplace});
                geoid++;
            }
            profiledata[title] = data;
        }

        // ---------------------- Family Data --------------------
        if (familymembers && children.length > 2) {
            //This section is only run on the focus profile
            alldata["scorefactors"] = parsed.find(".value_add_score_factors_container").text().trim();
            alldata["family"] = {};
            child = children[2];

            var rows = $(child).find('tr');

            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                var title = $(row).find(".recordFieldLabel").text().toLowerCase().replace(":", "").trim();
                var valfamily = $(row).find(".recordFieldValue");
                var famlist = $(valfamily).find(".individualsListContainer");
                alldata["family"][title] = [];

                for (var r = 0; r < famlist.length; r++) {
                    familystatus.push(r);
                    var row = famlist[r];
                    //var subdata = parseInfoData(row);
                    //console.log(subdata);
                    var urlval = $(row).find(".individualListBodyContainer a").attr("href");
                    var shorturl = urlval.substring(0, urlval.indexOf('showRecord') + 10);

                    //Grab data from the profile's page as it contains more detailed information
                    chrome.extension.sendMessage({
                        method: "GET",
                        action: "xhttp",
                        url: shorturl,
                        variable: title
                    }, function (response) {
                        var person = parseSmartMatch(response.html, false);
                        alldata["family"][response.variable].push(person);
                        familystatus.pop();
                    });
                }
            }
            updateGeo(); //Poll until all family requests have returned and continue there
        }
    }
    return profiledata;
}

function parseInfoData(row) {
    var obj = {};
    var name = $(row).find(".individualNameLink").text();
    if (!name.startsWith("\<Private\>")) {
        obj["name"] = name.trim();
    }
    var drange = $(row).find(".immediateMemberDateRange").text();
    if (drange.length > 0) {
        if (drange.contains(" - ")) {
            var splitr = drange.trim().split(" - ");
            if (splitr[0] !== "?") {
                obj["birthyear"] = splitr[0];
            }
            if (splitr[1] !== "?") {
                obj["deathyear"] = splitr[1];
            }
        } else if (!isNaN(drange)) {
            obj["birthyear"] = drange.trim();
        }
    }
    var genderimage = $(row).find('.PK_Silhouette');
    var genderval = "unknown";
    if ($(genderimage).hasClass('PK_Silhouette_S_30_M_A_LTR') || $(genderimage).hasClass('PK_Silhouette_S_30_M_C_LTR')) {
        genderval = "male";
    } else if ($(genderimage).hasClass('PK_Silhouette_S_30_F_A_LTR') || $(genderimage).hasClass('PK_Silhouette_S_30_F_C_LTR')) {
        genderval = "female";
    }
    if (genderval.trim() !== "unknown") {
        obj["gender"] = genderval.trim();
    }
    return obj;
}

function updateGeo() {
    if (familystatus.length > 0) {
        setTimeout(updateGeo, 300);
    } else {
        document.getElementById("loading").style.display = "none";
        console.log("Family Processed...");
        var listvalues = ["birth", "baptism", "death", "burial"];
        for (var list in listvalues) if (listvalues.hasOwnProperty(list)) {
            var title = listvalues[list];
            var memberobj = alldata["profile"][title];

            if (exists(memberobj)) {
                for (var item in memberobj) if (memberobj.hasOwnProperty(item)) {
                    if (exists(memberobj[item].location)) {
                        geostatus.push(geostatus.length);
                        var url = "http://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(memberobj[item].location);
                        chrome.extension.sendMessage({
                            method: "GET",
                            action: "xhttp",
                            url: url,
                            variable: {geoid: memberobj[item].geolocation, geoplace: memberobj[item].geoplace}
                        }, function (response) {
                            var result = jQuery.parseJSON(response.html);
                            var georesult = new GeoLocation(result);
                            if (response.variable.geoplace !== "") {
                                georesult.place = response.variable.geoplace;
                            }
                            geolocation[response.variable.geoid] = georesult;
                            geostatus.pop();
                        });
                    }
                }
            }
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
                            if (exists(memberobj[item].location)) {
                                geostatus.push(geostatus.length);
                                var url = "http://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(memberobj[item].location);
                                chrome.extension.sendMessage({
                                    method: "GET",
                                    action: "xhttp",
                                    url: url,
                                    variable: memberobj[item].geolocation
                                }, function (response) {
                                    var result = jQuery.parseJSON(response.html);
                                    geolocation[response.variable] = new GeoLocation(result);
                                    geostatus.pop();
                                });
                            }
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
        setTimeout(updateFamily, 300);
    } else {
        document.getElementById("loading").style.display = "none";
        console.log("Geo Processed...");
        buildForm();
    }
}

function buildForm() {
    var obj;
    var listvalues = ["birth", "baptism", "death", "burial"];
    var scorefactors = alldata["scorefactors"];

    var x = 0;
    var ck = 0;
    // ---------------------- Profile Data --------------------
    for (var list in listvalues) if (listvalues.hasOwnProperty(list)) {
        var title = listvalues[list];
        obj = alldata["profile"][title];
        if (exists(obj)) {
            if (x > 0) {
                var div = $("#profiletable");
                div[0].innerHTML = div[0].innerHTML + '<tr><td colspan="2" style="padding: 0;"><div class="separator"></div></td></tr>';
                // $("#"+title+"separator")[0].style.display = "block";
            }
            x++;
            for (var item in obj) if (obj.hasOwnProperty(item)) {
                if (exists(obj[item].date)) {
                    var scored = false;
                    if (scorefactors.contains(title + " date")) {
                        scored = true;
                        //div.find("input:checkbox").prop('checked', true);
                        ck++;
                    }
                    var div = $("#profiletable"); //"$("#"+title+"date");
                    var membersstring = div[0].innerHTML;
                    var dateval = obj[item].date;
                    membersstring = membersstring +
                        '<tr id="birthdate"><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(dateval, scored) + '>' +
                        capFL(title) + ' Date:</td><td style="float:right;padding: 0;"><input type="text" name="' + title + ':date" value="' + dateval + '" ' + isEnabled(place, scored) + '></td></tr>';
                    div[0].innerHTML = membersstring;

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
                    var geovar1 = geolocation[obj[item].geolocation];
                    var placegeo = geovar1.place;
                    var city = geovar1.city;
                    var county = geovar1.county;
                    var state = geovar1.state;
                    var country = geovar1.country;
                    var geoplace = "table-row";
                    var geoauto = "none";
                    if ($('#geoonoffswitch').prop('checked')) {
                        geoplace = "none";
                        geoauto = "table-row";
                    }
                    var div = $("#profiletable");
                    var membersstring = div[0].innerHTML;
                    membersstring = membersstring +
                        '<tr class="geoplace"style="display: ' + geoplace + ';"><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(place, scored) + '>' + capFL(title) + ' Place:</td><td style="float:right;padding: 0;"><input type="text" name="' + title + ':location:place_name" value="' + place + '" ' + isEnabled(place, scored) + '></td></tr>' +
                        '<tr class="geoloc" style="display: ' + geoauto + ';"><td colspan="2" style="font-size: 90%;padding: 0;"><div class="membertitle" style="margin-top: 4px; margin-left: 3px; margin-right: 2px; padding-left: 5px;"><strong>&#x276f; </strong>' + capFL(title) + ' Location: &nbsp;' + place + '</div></td></tr>' +
                        '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(placegeo, scored) + '>Place: </td><td style="float:right;padding: 0;"><input type="text" name="' + title + ':location:place_name_geo" value="' + placegeo + '" ' + isEnabled(placegeo, scored) + '></td></tr>' +
                        '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(city, scored) + '>City: </td><td style="float:right;padding: 0;"><input type="text" name="' + title + ':location:city" value="' + city + '" ' + isEnabled(city, scored) + '></td></tr>' +
                        '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(county, scored) + '>County: </td><td style="float:right;padding: 0;"><input type="text" name="' + title + ':location:county" value="' + county + '" ' + isEnabled(county, scored) + '></td></tr>' +
                        '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(state, scored) + '>State: </td><td style="float:right;padding: 0;"><input type="text" name="' + title + ':location:state" value="' + state + '" ' + isEnabled(state, scored) + '></td></tr>' +
                        '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(country, scored) + '>Country: </td><td style="float:right;padding: 0;"><input type="text" name="' + title + ':location:country" value="' + country + '" ' + isEnabled(country, scored) + '></td></tr>';

                    div[0].innerHTML = membersstring;

                    //div[0].style.display = "block";
                }
            }

        }
    }
    if (ck > 0) {
        $('#updateprofile').prop('checked', true);
    }
    document.getElementById("profiledata").style.display = "block";

    // ---------------------- Family Data --------------------
    obj = alldata["family"];
    //console.log("");
    //console.log(JSON.stringify(obj));
    var i = 0;
    for (var relationship in obj) if (obj.hasOwnProperty(relationship)) {
        var members = obj[relationship];
        var scored = false;
        //Use a common naming scheme
        if (relationship === "siblings" || relationship === "sibling") {
            if (scorefactors.contains("sibling")) {
                scored = true;
                $('#addsiblingck').prop('checked', true);
            }
            relationship = "sibling";
        } else if (relationship === "children" || relationship === "child" || relationship === "son" || relationship === "daughter") {
            if (scorefactors.contains("child")) {
                scored = true;
                $('#addchildck').prop('checked', true);
            }
            relationship = "child";
        }
        else if (relationship === "parents" || relationship === "father" || relationship === "mother" || relationship === "parent") {
            if (scorefactors.contains("parent")) {
                scored = true;
                $('#addparentck').prop('checked', true);
            }
            relationship = "parent";
        }
        else if (relationship === "partners" || relationship === "wife" || relationship === "husband" || relationship === "partner" || relationship === "husbands" || relationship === "wives") {
            if (scorefactors.contains("spouse")) {
                scored = true;
                $('#addpartnerck').prop('checked', true);
            }
            relationship = "partner";
        }

        var div = $("#" + relationship);
        div[0].style.display = "block";
        var parentscore = scored;
        var skipprivate = $('#privateonoffswitch').prop('checked');
        for (var member in members) if (members.hasOwnProperty(member)) {
            scored = parentscore;
            var entry = $("#" + relationship + "val")[0];
            var fullname = members[member].name;
            if (skipprivate && fullname.startsWith("\<Private\>")) {
                scored = false;
            }
            var nameval = NameParse.parse(fullname);
            var gender = members[member].gender;
            var membersstring = entry.innerHTML;
            membersstring = membersstring + '<div class="membertitle"><table style="border-spacing: 0px; border-collapse: separate; width: 100%;"><tr>' +
                '<td style="font-size: 90%; padding: 0px;"><input type="checkbox" class="checkslide" name="checkbox' + i + "-" + relationship + '" ' + isChecked(fullname, scored) + '><a name="' + i + "-" + relationship + '">' + escapeHtml(fullname) + '</a></td>' +
                '<td style="font-size: 130%; float: right; padding: 0px 5px;"><a name="' + i + "-" + relationship + '">&#9662;</a></td></tr></table></div>' +
                '<div id="slide' + i + "-" + relationship + '" class="memberexpand" style="display: none; padding-bottom: 6px; padding-left: 12px;"><table style="border-spacing: 0px; border-collapse: separate; width: 100%;">' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.firstName, scored) + '>First Name:</td><td style="float:right; padding: 0px;"><input type="text" name="first_name" value="' + nameval.firstName + '" ' + isEnabled(nameval.firstName, scored) + '></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.middleName, scored) + '>Middle Name:</td><td style="float:right; padding: 0px;"><input type="text" name="middle_name" value="' + nameval.middleName + '" ' + isEnabled(nameval.middleName, scored) + '></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.lastName, scored) + '>Last Name:</td><td style="float:right; padding: 0px;"><input type="text" name="last_name" value="' + nameval.lastName + '" ' + isEnabled(nameval.lastName, scored) + '></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.birthName, scored) + '>Birth Name:</td><td style="float:right; padding: 0px;"><input type="text" name="maiden_name" value="' + nameval.birthName + '" ' + isEnabled(nameval.birthName, scored) + '></td></tr>' +
                '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(nameval.suffix, scored) + '>Suffix: </td><td style="float:right; padding: 0px;"><input type="text" name="suffix" value="' + nameval.suffix + '" ' + isEnabled(nameval.suffix, scored) + '></td></tr>' +
                '<tr><td class="profilediv" style="padding-top: 2px;"><input type="checkbox" class="checknext" ' + isChecked(gender, scored) + '>Gender: </td><td style="float:right; padding-top: 2px;"><select style="width: 151px; height: 24px; margin-right: 1px; -webkit-appearance: menulist-button;" name="gender" ' + isEnabled(gender, scored) + '>' +
                '<option value="male" '+ setGender("male", gender) + '>Male</option><option value="female" '+ setGender("female", gender) + '>Female</option><option value="unknown" '+ setGender("unknown", gender) + '>Unknown</option></select></td></tr>';

            for (var list in listvalues) if (listvalues.hasOwnProperty(list)) {
                var title = listvalues[list];
                var memberobj = members[member][title];
                if (exists(memberobj)) {
                    membersstring = membersstring + '<tr><td colspan="2"><div class="separator"></div></td></tr>';
                    for (var item in memberobj) if (memberobj.hasOwnProperty(item)) {
                        if (exists(memberobj[item].date)) {
                            var dateval = memberobj[item].date;
                            membersstring = membersstring +
                                '<tr><td style="font-weight: bold; font-size: 90%; vertical-align: middle;"><input type="checkbox" class="checknext" ' + isChecked(dateval, scored) + '>' + capFL(title) + ' Date: </td><td style="float:right;"><input type="text" name="' + title + ':date" value="' + dateval + '" ' + isEnabled(dateval, scored) + '></td></tr>';
                        }
                        if (exists(memberobj[item].location)) {
                            var place = memberobj[item].location;
                            var geovar2 = geolocation[memberobj[item].geolocation];
                            var placegeo = geovar2.place;
                            var city = geovar2.city;
                            var county = geovar2.county;
                            var state = geovar2.state;
                            var country = geovar2.country;
                            var geoplace = "table-row";
                            var geoauto = "none";
                            if ($('#geoonoffswitch').prop('checked')) {
                                geoplace = "none";
                                geoauto = "table-row";
                            }
                            membersstring = membersstring +
                                '<tr class="geoplace" style="display: ' + geoplace + ';"><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(place, scored) + '>' + capFL(title) + ' Place: </td><td style="float:right;"><input type="text" name="'+title+':location:place_name" value="' + place + '" ' + isEnabled(place, scored) + '></td></tr>' +
                                '<tr class="geoloc" style="display: ' + geoauto + ';"><td colspan="2" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-right: 2px; padding-left: 5px;"><strong>&#x276f; </strong>' + capFL(title) + ' Location: &nbsp;' + place + '</div></td></tr>' +
                                '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(placegeo, scored) + '>Place: </td><td style="float:right;"><input type="text" name="'+title+':location:place_name_geo" value="' + placegeo + '" ' + isEnabled(placegeo, scored) + '></td></tr>' +
                                '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(city, scored) + '>City: </td><td style="float:right;"><input type="text" name="'+title+':location:city" value="' + city + '" ' + isEnabled(city, scored) + '></td></tr>' +
                                '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(county, scored) + '>County: </td><td style="float:right;"><input type="text" name="'+title+':location:county" value="' + county + '" ' + isEnabled(country, scored) + '></td></tr>' +
                                '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(state, scored) + '>State: </td><td style="float:right;"><input type="text" name="'+title+':location:state" value="' + state + '" ' + isEnabled(state, scored) + '></td></tr>' +
                                '<tr class="geoloc" style="display: ' + geoauto + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + isChecked(country, scored) + '>Country: </td><td style="float:right;"><input type="text" name="'+title+':location:country" value="' + country + '" ' + isEnabled(country, scored) + '></td></tr>';

                        }
                    }
                }
            }

            membersstring = membersstring + '</table></div>';
            entry.innerHTML = membersstring;

            //log("  " + members[member].name);
            i++;
        }
    }

    $(function () {
        $('.checknext').on('click', function () {
            $(this).closest('tr').find("input:text,select").attr("disabled", !this.checked);
        });
    });
    $(function () {
        $('.checkslide').on('click', function () {
            var fs = $("#" + this.name.replace("checkbox", "slide"));
            fs.find(':checkbox').prop('checked', this.checked);
            fs.find('input:text,select').attr('disabled', !this.checked);
        });
    });
    document.getElementById("familydata").style.display = "block";
    parsecomplete = true;
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

function setGender(gender,value) {
    if (gender === value) {
        return "selected";
    }
    return "";
}

function isChecked(value, score) {
    if (score && isValue(value)) {
        return "checked";
    } else {
        return "";
    }
}


//"birth":{"date":{"day":26,"month":9,"year":1974},"location":{"city":"Milford","state":"Massachusetts","country":"US","country_code":"US","latitude":42.14294,"longitude":-71.51654}}





