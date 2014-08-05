var alldata = {};
var familystatus = [];
// Parse MyHeritage Tree from Smart Match
function parseSmartMatch(htmlstring, familymembers) {
    var parsed = $('<div>').html(htmlstring.replace(/<img[^>]*>/g,""));
    var focusperson = parsed.find(".recordTitle").text().trim();
    var focusdaterange = parsed.find(".recordSubtitle").text().trim();
    //console.log(focusperson);
    var genderdiv = parsed.find(".recordImage");
    var genderimage = $(genderdiv).find('.PK_Silhouette');
    var genderval = "unknown";
    if ($(genderimage).hasClass('PK_Silhouette_S_150_M_A_LTR')) {
        genderval = "male";
    } else if ($(genderimage).hasClass('PK_Silhouette_S_150_F_A_LTR')) {
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
            var title = $(row).find(".recordFieldLabel").text().toLowerCase().replace(":","").trim();
            var valdate = "";
            var vallocal = $(row).find(".map_callout_link").text().trim();

            //var vdate = $(row).find(".recordFieldValue");
            //var valdate = vdate.clone().children().remove().end().text().trim();
            if (exists($(row).find(".recordFieldValue").contents().get(0))) {
                valdate = $(row).find(".recordFieldValue").contents().get(0).nodeValue;
                if (valdate !== null && valdate.toLowerCase().startsWith("parent")) {
                    if (exists($(row).find(".recordFieldValue").contents().get(2))) {
                        valdate = $(row).find(".recordFieldValue").contents().get(2).nodeValue;
                    }
                } else if (valdate === null) {
                    valdate = "";
                }
            }

            if (title !== "birth" && title !== 'death' && title !== 'baptism' && title !== 'burial') {
                /*
                 This will exclude residence, since the API seems to only support current residence.
                 It will also exclude Marriage and Partner dates as I see no way to add this via the API.
                 It also will remove Military Service and any other entry not explicitly defined in the parser.
                 */
                continue;  //move to the next entry
            }
            //console.log(title);
            //console.log(valdate);
            var data = [];
            if (valdate !== "") {
                data.push({date: valdate});
            }
            if (vallocal !== "") {
                data.push({location: vallocal});
            }
            profiledata[title] = data;
        }

        // ---------------------- Family Data --------------------
        if (familymembers && children.length > 2) {
            //This section is only run on the focus profile
            var scorefactors = parsed.find(".value_add_score_factors_container").text().trim();
            alldata["scorefactors"] = scorefactors;
            alldata["family"] = {};
            child = children[2];

            var rows = $(child).find('tr');

            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                var title = $(row).find(".recordFieldLabel").text().toLowerCase().replace(":","").trim();
                var valfamily = $(row).find(".recordFieldValue");
                var famlist = $(valfamily).find(".individualsListContainer");
                alldata["family"][title] = [];

                for (var r = 0; r < famlist.length; r++) {
                    familystatus.push(r);
                    var row = famlist[r];
                    var urlval = $(row).find(".individualListBodyContainer a").attr("href");
                    var shorturl = urlval.substring(0, urlval.indexOf('showRecord')+10);

                    //Grab data from the profile's page as it contains more detailed information
                    chrome.extension.sendMessage({
                        method: "GET",
                        action: "xhttp",
                        url: shorturl,
                        variable: title
                    }, function(response) {
                        var person = parseSmartMatch(response.html,false);
                        alldata["family"][response.variable].push(person);
                        familystatus.pop();
                    });
                }
            }
            updateFamily(); //Poll until all family requests have returned and continue there
        }
    }
    return profiledata;
}

function updateFamily() {
    if (familystatus.length > 0) {
        setTimeout(updateFamily, 300);
    } else {
        document.getElementById("loading").style.display = "none";
        console.log("Family Processed...");
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
    for (var list in listvalues) {
        var title = listvalues[list];
        obj = alldata["profile"][title];
        if (exists(obj)) {
            if (x > 0) {
                $("#"+title+"separator")[0].style.display = "block";
            }
            x++;
            for (var item in obj) {
                if(exists(obj[item].date)){
                    var div =  $("#"+title+"date");
                    div[0].innerHTML = '<td style="font-weight: bold; font-size: 90%; vertical-align: middle;"><input type="checkbox" />' +
                        capFL(title) + ' Date:</td><td style="float:right;"><input type="text" name="date" value="' + obj[item].date + '"></td>';
                    if (scorefactors.contains(title+" date")) {
                        div.find("input:checkbox").prop('checked', true);
                        ck++;
                    }
                    //div[0].style.display = "block";

                    var bd = new Date(obj[item].date);
                    //console.log(bd.getFullYear());

                }
                if(exists(obj[item].location)) {
                    var div = $("#"+title+"location");
                    div[0].innerHTML = '<td style="font-weight: bold; font-size: 90%; vertical-align: middle;"><input type="checkbox" " />' +
                        capFL(title) + ' Place:</td><td style="float:right;"><input type="text" name="loc" value="' + obj[item].location + '"></td>';
                    if (scorefactors.contains(title+" place")) {
                        div.find("input:checkbox").prop('checked', true);
                        ck++;
                    }
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
    for (var relationship in obj) {
        var members = obj[relationship];
        //Use a common naming scheme
        if (relationship === "sibling") {
            relationship = "siblings";
        }
        else if (relationship === "father" || relationship === "mother") {
            relationship = "parents";
        }
        else if (relationship === "wife" || relationship === "husband" || relationship === "partner" || relationship === "husbands" || relationship === "wives") {
            relationship = "partners";
        }

        var div = $("#"+relationship);
        div[0].style.display = "block";

        for (var member in members) {
            var entry = $("#"+relationship+"val")[0];
            var nameval = NameParse.parse(members[member].name);
            var membersstring = entry.innerHTML;
            membersstring = membersstring + '<div class="membertitle"><table cellpadding="0" cellspacing="0" width="100%"><tr>' +
                '<td style="font-size: 90%;"><input type="checkbox" name="checkbox'+ i + relationship + '"><a name="' + i + relationship + '">' + escapeHtml(members[member].name) + '</a></td>' +
                '<td style="font-size: 130%; float: right; padding-right: 5px; padding-left: 5px;"><a name="' + i + relationship + '">&#9662;</a></td></tr></table></div>' +
                '<div id="slide' + i + relationship + '" class="memberexpand" style="display: none; padding-bottom: 6px; padding-left: 15px;"><table cellpadding="0" cellspacing="0" width="100%">' +
                '<tr><td style="font-weight: bold; font-size: 90%; vertical-align: middle;">First Name: </td><td style="float:right;"><input type="text" name="fname" value="' + nameval.firstName + '"></td></tr>'+
                '<tr><td style="font-weight: bold; font-size: 90%; vertical-align: middle;">Middle Name: </td><td style="float:right;"><input type="text" name="mname" value="' + nameval.middleName + '"></td></tr>' +
                '<tr><td style="font-weight: bold; font-size: 90%; vertical-align: middle;">Last Name: </td><td style="float:right;"><input type="text" name="lname" value="' + nameval.lastName + '"></td></tr>'+
                '<tr><td style="font-weight: bold; font-size: 90%; vertical-align: middle;">Birth Name: </td><td style="float:right;"><input type="text" name="bname" value="' + nameval.birthName + '"></td></tr>' +
                '<tr><td style="font-weight: bold; font-size: 90%; vertical-align: middle;">Suffix: </td><td style="float:right;"><input type="text" name="sname" value="' + nameval.suffix + '"></td></tr>';

            for (var list in listvalues) {
                var title = listvalues[list];
                var memberobj = members[member][title];
                if (exists(memberobj)) {
                    membersstring = membersstring + '<tr><td colspan="2"><div class="separator"></div></td></tr>';
                    for (var item in memberobj) {
                        if (exists(memberobj[item].date)) {
                            membersstring = membersstring +
                                '<tr><td style="font-weight: bold; font-size: 90%; vertical-align: middle;">' + capFL(title) + ' Date: </td><td style="float:right;"><input type="text" name="bname" value="' + memberobj[item].date + '"></td></tr>';
                        }
                        if (exists(memberobj[item].location)) {
                            var place = "table-row";
                            var geoauto = "none";
                            if ($('#geoonoffswitch').prop('checked')) {
                                place = "none";
                                geoauto = "table-row";
                            }
                                membersstring = membersstring +
                                    '<tr class="geoplace" style="display: ' + place + ';"><td style="font-weight: bold; font-size: 90%; vertical-align: middle;">' + capFL(title) + ' Place: </td><td style="float:right;"><input type="text" name="bname" value="' + memberobj[item].location + '"></td></tr>'+
                                    '<tr class="geoloc" style="display: ' + geoauto + ';"><td style="font-weight: bold; font-size: 90%; vertical-align: middle;">' + capFL(title) + ' City: </td><td style="float:right;"><input type="text" name="bname"></td></tr>' +
                                    '<tr class="geoloc" style="display: ' + geoauto + ';"><td style="font-weight: bold; font-size: 90%; vertical-align: middle;">' + capFL(title) + ' State: </td><td style="float:right;"><input type="text" name="bname"></td></tr>' +
                                    '<tr class="geoloc" style="display: ' + geoauto + ';"><td style="font-weight: bold; font-size: 90%; vertical-align: middle;">' + capFL(title) + ' Country: </td><td style="float:right;"><input type="text" name="bname"></td></tr>';

                        }
                    }
                }
            }

            membersstring = membersstring + '</table></div>';
            entry.innerHTML = membersstring;

            console.log("  " + members[member].name);
            i++;
        }
    }
    document.getElementById("familydata").style.display = "block";

}


//"birth":{"date":{"day":26,"month":9,"year":1974},"location":{"city":"Milford","state":"Massachusetts","country":"US","country_code":"US","latitude":42.14294,"longitude":-71.51654}}





