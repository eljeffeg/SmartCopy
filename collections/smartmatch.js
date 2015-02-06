// Parse MyHeritage Tree from Smart Match
function parseSmartMatch(htmlstring, familymembers, relation) {
    try{
        if ($(htmlstring).filter('title').text().contains("Marriages")) {
            document.getElementById("loading").style.display = "none";
            document.getElementById("top-container").style.display = "none";
            setMessage("#f8ff86", 'This MyHeritage collection is not yet supported by SmartCopy.');
            return "";
        }
    } catch(e){
        noerror = false;
        setMessage("#f9acac", 'There was a problem reading the SmartMatch page.');
        console.log(e); //error in the above string(in this case,yes)!
        return;
    }
    relation = relation || "";
    var parsed = $('<div>').html(htmlstring.replace(/<img[^>]*>/ig, ""));

    var focusperson = parsed.find(".recordTitle").text().trim();
    document.getElementById("readstatus").innerText = focusperson;
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
    if (relation === "") {
        focusgender = genderval;
    }
    var aboutdata = "";
    var profiledata = {name: focusperson, gender: genderval, status: relation.title};

    var imagebox = $(htmlstring).find(".recordImageBoxContainer");
    var thumb = imagebox.find('img.recordImage').attr('src');
    if (exists(thumb)) {
        var imageref = imagebox.find('a');
        if (exists(imageref[0])) {
            if (!thumb.startsWith("http://recordsthumbnail.myheritageimages.com")) {
                var image = imageref[0].href;
                if (image.startsWith("http://www.findagrave.com")) {
                    profiledata["image"] = thumb.replace("http://records.myheritageimages.com/wvrcontent/findagrave_photos", "http://image1.findagrave.com");
                } else if (image.startsWith("http://billiongraves.com")) {
                    profiledata["image"] = thumb.replace("thumbnails", "images")
                } else {
                    profiledata["image"] = image;
                }
                profiledata["thumb"] = thumb;
            }
        } else {
            //var photobox = parsed.find(".recordRelatedPhotosContainer");  Area for multiple pics
            //example:http://www.myheritage.com/research/collection-1/myheritage-family-trees?action=showRecord&itemId=187339442-1-500348&groupId&indId=externalindividual-60b8fd397ede07a7734908636547b649&callback_token=aJ246ziA8CCB8WycR8ujZxNXfJpZjcXsgCkoDd6U&mrid=0fcad2868a0e76a3fa94f97921debb00
            var paperclip = parsed.find(".paperClip");
            if (exists(paperclip[0])) {
                profiledata["image"] = thumb;
                profiledata["thumb"] = thumb;
            }
        }
    }

    var records = parsed.find(".recordFieldsContainer");
    if (familymembers) {
        loadGeniData();
        //Parses pages like Census that have entries at the bottom in Household section
        var household = parsed.find('.groupTable').find('tr');
        if (household.length > 0) {
            var housearray = [];
            for (var i = 0; i < household.length; i++) {
                var hv = $(household[i]).find('td');
                for (var x = 0; x < hv.length; x++) {
                    var urlval = $(hv[x]).find('a');
                    if (urlval.length > 0) {
                        housearray.push({name: $(hv[x]).text(), url: urlval[0].href});
                    }
                }
            }
        }
    }

    if (records.length > 0 && records[0].hasChildNodes()) {
        var famid = 0;
        // ---------------------- Profile Data --------------------
        if (focusdaterange !== "") {
            profiledata["daterange"] = focusdaterange;
        }
        var children = records[0].childNodes;
        var child = children[0];
        var rows = $(child).find('tr');
        var burialdtflag = false;
        var buriallcflag = false;
        var deathdtflag = false;
        for (var r = 0; r < rows.length; r++) {

            // console.log(row);
            var row = rows[r];
            var title = $(row).find(".recordFieldLabel").text().toLowerCase().replace(":", "").trim();
            if (title === "gender") {
                if (exists($(row).find(".recordFieldValue").contents().get(0))) {
                    genderval = $(row).find(".recordFieldValue").contents().get(0).nodeValue.toLowerCase();
                    profiledata["gender"] = genderval;
                }
                continue;
            }
            if (familymembers && (isParent(title) || isSibling(title) || isChild(title) || isPartner(title))) {
                //This is for Census pages that don't contain the Family members section
                if (exists($(row).find(".recordFieldValue").contents().get(0))) {
                    if (!exists(alldata["family"][title])) {
                        alldata["family"][title] = [];
                    }
                    var gendersv = "unknown";
                    if (isFemale(title)) {
                        gendersv = "female";
                    } else if (isMale(title)) {
                        gendersv = "male";
                    }
                    var listrow = $(row).find(".recordFieldValue").contents();
                    var checklist = false;
                    if (listrow.length > 1) {
                        checklist = true;
                    } else if (listrow.length == 1 && exists($(listrow[0]).attr("href"))) {
                        checklist = true;
                    }
                    if (checklist) {
                        for (var lr =0;lr < listrow.length; lr++) {
                            var listrowval = listrow[lr];
                            if (listrowval.className !== "eventSeparator" && listrowval.nodeValue !== null) {
                                var name = listrowval.nodeValue.trim();
                                if (name.replace(",","").length > 1) {
                                    var profile = {name: name, gender: gendersv, profile_id: famid, title: title};
                                    alldata["family"][title].push(profile);
                                    databyid[famid] = profile;
                                    if (isPartner(title)) {
                                        myhspouse.push(famid);
                                    }
                                }
                            } else if (listrowval.className !== "eventSeparator") {
                                var urlval = $(listrowval).attr("href");
                                if (exists(urlval) && urlval !== "") {
                                    familystatus.push(familystatus.length);
                                    var subdata = {name: $(listrowval).text().trim(), gender: gendersv, title: title};
                                    var shorturl = urlval.substring(0, urlval.indexOf('showRecord') + 10);
                                    var itemid = getParameterByName('itemId', shorturl);
                                    subdata["url"] = urlval;
                                    subdata["itemId"] = itemid;
                                    subdata["profile_id"] = famid;
                                    if (isParent(title)) {
                                        parentlist.push(itemid);
                                    } else if (isPartner(title)) {
                                        myhspouse.push(famid);
                                    }
                                    unionurls[famid] = itemid;
                                    chrome.extension.sendMessage({
                                        method: "GET",
                                        action: "xhttp",
                                        url: shorturl,
                                        variable: subdata
                                    }, function (response) {
                                        var arg = response.variable;
                                        var person = parseSmartMatch(response.source, false, {"title": arg.title, "proid": arg.profile_id});
                                        person = updateInfoData(person, arg);
                                        databyid[arg.profile_id] = person;
                                        alldata["family"][arg.title].push(person);
                                        familystatus.pop();
                                    });
                                }
                            }
                            famid++;
                        }
                    } else {
                        var splitlrnv = $(row).find(".recordFieldValue").contents().get(0).nodeValue;
                        if (exists(splitlrnv)) {
                            var splitlr = splitlrnv.split(",");
                            for (var lr =0;lr < splitlr.length; lr++) {
                                if (NameParse.is_suffix(splitlr[lr]) && lr !== 0) {
                                    splitlr[lr-1] += "," + splitlr[lr];
                                    splitlr.splice(lr, 1);
                                }
                            }
                            for (var lr =0;lr < splitlr.length; lr++) {
                                var splitval = splitlr[lr];
                                if (exists(housearray)) {
                                    for (var i = 0; i < housearray.length; i++) {
                                        if (housearray[i].name === splitval.trim()) {
                                            familystatus.push(familystatus.length);
                                            var subdata = {name: splitval.trim(), gender: gendersv, title: title};
                                            var urlval = housearray[i].url;
                                            var shorturl = urlval.substring(0, urlval.indexOf('showRecord') + 10);
                                            var itemid = getParameterByName('itemId', shorturl);
                                            subdata["url"] = urlval;
                                            subdata["itemId"] = itemid;
                                            subdata["profile_id"] = famid;
                                            if (isParent(title)) {
                                                parentlist.push(itemid);
                                            } else if (isPartner(title)) {
                                                myhspouse.push(famid);
                                            }
                                            unionurls[famid] = itemid;
                                            chrome.extension.sendMessage({
                                                method: "GET",
                                                action: "xhttp",
                                                url: shorturl,
                                                variable: subdata
                                            }, function (response) {
                                                var arg = response.variable;
                                                var person = parseSmartMatch(response.source, false, {"title": arg.title, "proid": arg.profile_id});
                                                person = updateInfoData(person, arg);
                                                databyid[arg.profile_id] = person;
                                                alldata["family"][arg.title].push(person);
                                                familystatus.pop();
                                            });
                                            housearray.splice(i, 1);
                                            break;
                                        }
                                    }
                                } else {
                                    var profile = {name: splitval.trim(), gender: gendersv,  profile_id: famid, title: title, status: title};
                                    alldata["family"][title].push(profile);
                                    databyid[famid] = profile;
                                    if (isPartner(title)) {
                                        myhspouse.push(famid);
                                    }
                                }

                                famid++;
                            }
                        }
                    }
                }
                continue;
            }
            if (title.startsWith("info") || title.startsWith("notes") || title.startsWith("military") || title.startsWith("immigration") ||
                title.startsWith("visa") || title === "emigration" || title === "ethnicity" || title === "race" || title === "residence" ||
                title === "census" || title === "politics" || title === "religion" || title === "ostracized" || title === "family death" ||
                title === "family reunion") {
                var aboutinfo = $(row).find(".recordFieldValue").html();
                if (exists(aboutinfo)) {
                    aboutinfo = aboutinfo.replace('<div class="eventSeparator"></div>',' - ');
                    aboutinfo = $('<div>').html(aboutinfo).text();
                    if (aboutinfo.contains("jQuery(function()")) {
                        var splitinfo = aboutinfo.split("jQuery(function()");
                        aboutinfo = splitinfo[0];
                        aboutinfo = aboutinfo.trim();
                    }
                    var aboutdash = aboutinfo.split(' - \n');
                    if (aboutdash.length > 1) {
                        aboutinfo = aboutdash[0] + " - " + aboutdash[1].trim();
                    }
                    aboutdata += "* '''" + capFL(title) + "''': " + aboutinfo + "\n";
                }
                continue;
            }

            if (title !== 'birth' && title !== 'death' && title !== 'baptism' && title !== 'burial'
                && title !== 'occupation' && title !== 'cemetery' && title !== 'christening'
                && !(title === 'marriage' && (relation === "" || isParent(relation.title)))) {
                /*
                 This will exclude residence, since the API seems to only support current residence.
                 It also will remove Military Service and any other entry not explicitly defined above.
                 */
                continue;  //move to the next entry
            }

            if (title === "occupation") {
                if (exists($(row).find(".recordFieldValue").contents().get(0))) {
                    profiledata[title] = $(row).find(".recordFieldValue").contents().get(0).nodeValue;
                }
                continue;
            }
            if (title === "cemetery") {
                title = "burial";
            }
            if (title === "christening") {
                title = "baptism";
            }
            var valdate = "";
            var vallocal = $(row).find(".map_callout_link").text().trim();
            var valplace = "";
            //var vdate = $(row).find(".recordFieldValue");
            //var valdate = vdate.clone().children().remove().end().text().trim();
            var data = [];
            var fielddata = $(row).find(".recordFieldValue").contents();
            dance:
                for (var i=0; i < fielddata.length; i++) {
                    if (exists(fielddata.get(i))) {
                        valdate = fielddata.get(i).nodeValue;
                        var verifydate = moment(valdate, dateformatter, true).isValid();
                        if (!verifydate) {
                            if (valdate !== null && (valdate.startsWith("Circa") || valdate.startsWith("After") || valdate.startsWith("Before") || valdate.startsWith("Between"))) {
                                break;
                            }
                            else if (valdate !== null && checkPlace(valdate) !== "") {
                                valplace = checkPlace(valdate);
                            } else if (valdate !== null && valdate.toLowerCase().startsWith("marriage to")) {
                                data.push({name: valdate.replace("Marriage to: ","")});
                            } else {
                                if (fielddata.get(i).hasChildNodes()) {
                                    var checkchild = fielddata.get(i).childNodes;
                                    for (var x=0; x < checkchild.length; x++) {
                                        valdate = checkchild[x].nodeValue;
                                        verifydate = moment(valdate, dateformatter, true).isValid();
                                        if (!verifydate) {
                                            if (valdate !== null && (valdate.startsWith("Circa") || valdate.startsWith("After") || valdate.startsWith("Before") || valdate.startsWith("Between"))) {
                                                break dance;
                                            }
                                            valdate = "";
                                        } else {
                                            break dance;
                                        }
                                    }
                                } else {
                                    valdate = "";
                                }
                            }
                        } else {
                            break;
                        }
                    }
                }

            if (valdate !== "") {
                data.push({date: valdate});
            }

            if (vallocal !== "") {
                data.push({id: geoid, location: vallocal, place: valplace});
                geoid++;
            }
            if (exists(profiledata[title]) && profiledata[title].length >= data.length) {
                continue;
            }
            if (title === "burial" && valdate !== "") {
                burialdtflag = true;
            } else if (title === "death" && valdate !== "") {
                deathdtflag = true;
            }
            if (title === "burial" && valdate === "" && vallocal !== "") {
                buriallcflag = true;
            }

            if (title !== 'marriage') {
                profiledata[title] = data;
            } else if (!$.isEmptyObject(data)) {
                if (relation === "") {
                    //focus profile
                    marriagedata.push(data);
                } else {
                    //parent profiles
                    if (!parentflag) {
                        parentmarset.push(data);
                    } else {
                        //attempt to match up parent with multiple spouses via matching date / location
                        for (var pm = 0; pm < parentmarset.length; pm++) {
                            var pmd = true;
                            var pml = true;
                            var pmp = true;
                            var pmatch = parentmarset[pm];
                            for (var pid = 0; pid < pmatch.length; pid++) {

                                if(exists(pmatch[pid].date)) {
                                    pmd = exists(data[pid]) && exists(data[pid].date) && pmatch[pid].date === data[pid].date;
                                } else if (exists(pmatch[pid].location)) {
                                    pml = exists(data[pid]) && exists(data[pid].location) && pmatch[pid].location === data[pid].location;
                                } else if (exists(pmatch[pid].place)) {
                                    pmp = exists(data[pid]) && exists(data[pid].place) && pmatch[pid].place === data[pid].place;
                                }
                            }
                            if (pmd && pml && pmp) {
                                parentmarriage = pmatch;
                                profiledata["marriage"] = pmatch;
                                break;
                            }
                        }
                    }
                }
            }
        }
        if (!burialdtflag && buriallcflag && deathdtflag && $('#burialonoffswitch').prop('checked')) {
            profiledata = checkBurial(profiledata);
        }
        if (relation !== "" && isParent(relation.title)) {
            parentflag = true;
        }
        var setmarriage = false;
        if (marriagedata.length > 0 && familymembers && children.length > 2) {
            child = children[2];
            var pcount = 0;
            var rows = $(child).find('tr');
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                var title = $(row).find(".recordFieldLabel").text().toLowerCase().replace(":", "").trim();
                if (isPartner(title)) {
                    //TODO Checking could be done if one profile is private and another not
                    pcount++;
                }
            }
            if (marriagedata.length === 1 && pcount === 1) {
                setmarriage = true;
            }
        }
        if (aboutdata !== "") {
            profiledata["about"] = aboutdata;
            // "\n--------------------\n"  Merge separator
        }

        // ---------------------- Family Data --------------------

        if (familymembers && children.length > 2) {
            //This section is only run on the focus profile
            alldata["profile"] = profiledata;
            alldata["scorefactors"] = smscorefactors;

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
                    var subdata = parseInfoData(row);
                    if (isPartner(title)) {
                        if (genderval === "unknown") {
                            //Sets the focus profile gender if unknown
                            if (title === "wife" || title === "ex-wife") {
                                genderval = "male";
                            } else if (title === "husband" || title === "ex-husband") {
                                genderval = "female";
                            }
                            focusgender = genderval;
                            profiledata["gender"] = genderval;
                        }
                        if (marriagedata.length > 0) {
                            if (setmarriage) {
                                subdata["marriage"] = marriagedata[0];
                            } else {
                                for (var m=0; m < marriagedata.length; m++) {
                                    if (exists(marriagedata[m][0]) && exists(marriagedata[m][0].name)) {
                                        if (marriagedata[m][0].name === subdata.name) {
                                            subdata["marriage"] = marriagedata[m];
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    subdata["title"] = title;
                    //console.log(subdata);
                    var urlval = $(row).find(".individualListBodyContainer a").attr("href");
                    var shorturl = urlval.substring(0, urlval.indexOf('showRecord') + 10);
                    var itemid = getParameterByName('itemId', shorturl);
                    if (isParent(title)) {
                        parentlist.push(itemid);
                    }
                    subdata["url"] = urlval;
                    subdata["itemId"] = itemid;
                    subdata["profile_id"] = famid;
                    unionurls[famid] = itemid;
                    famid ++;
                    //Grab data from the profile's page as it contains more detailed information
                    chrome.extension.sendMessage({
                        method: "GET",
                        action: "xhttp",
                        url: urlval,
                        variable: subdata
                    }, function (response) {
                        var arg = response.variable;
                        var person = parseSmartMatch(response.source, false, {"title": arg.title, "proid": arg.profile_id});
                        person = updateInfoData(person, arg);
                        databyid[arg.profile_id] = person;
                        alldata["family"][arg.title].push(person);
                        familystatus.pop();
                    });
                }
            }
            if (genderval === "unknown") {
                //last attempt to determine gender - check if the lastname != birthname, assume female
                var nametest = NameParse.parse(focusperson);
                if (nametest.suffix !== "") {
                    genderval = "male";
                    focusgender = genderval;
                    profiledata["gender"] = genderval;
                } else if (nametest.birthName !== "" && nametest.lastName !== nametest.birthName) {
                    genderval = "female";
                    focusgender = genderval;
                    profiledata["gender"] = genderval;
                }
            }
            updateGeo(); //Poll until all family requests have returned and continue there
        } else if (children.length > 2 && exists(relation.title)) {
            if (isChild(relation.title)) {
                var itemid = getParameterByName('itemId', tablink);
                child = children[2];
                var rows = $(child).find('tr');
                for (var i = 0; i < rows.length; i++) {
                    var row = rows[i];
                    var relationship = $(row).find(".recordFieldLabel").text().toLowerCase().replace(":", "").trim();
                    if (isParent(relationship)) {
                        var valfamily = $(row).find(".recordFieldValue");
                        var famlist = $(valfamily).find(".individualsListContainer");
                        for (var r = 0; r < famlist.length; r++) {
                            var row = famlist[r];
                            var urlval = getParameterByName('itemId', $(row).find(".individualListBodyContainer a").attr("href"));
                            if (urlval !== itemid) {
                                childlist[relation.proid] = $.inArray(urlval, unionurls);
                                profiledata["parent_id"] = $.inArray(urlval, unionurls);
                            }
                        }
                    }
                }
            } else if (isPartner(relation.title)) {
                myhspouse.push(relation.proid);
            } else if (isParent(relation.title)) {
                child = children[2];
                var rows = $(child).find('tr');
                for (var i = 0; i < rows.length; i++) {
                    var row = rows[i];
                    var title = $(row).find(".recordFieldLabel").text().toLowerCase().replace(":", "").trim();
                    if (isPartner(title)){
                        profiledata["mstatus"] = title;
                        break;
                    }
                }
            } else if (isSibling(relation.title)) {
                var siblingparents = [];
                child = children[2];
                var rows = $(child).find('tr');
                for (var i = 0; i < rows.length; i++) {
                    var row = rows[i];
                    var relationship = $(row).find(".recordFieldLabel").text().toLowerCase().replace(":", "").trim();
                    if (isParent(relationship)) {
                        var valfamily = $(row).find(".recordFieldValue");
                        var famlist = $(valfamily).find(".individualsListContainer");
                        for (var r = 0; r < famlist.length; r++) {
                            var row = famlist[r];
                            var urlval = getParameterByName('itemId', $(row).find(".individualListBodyContainer a").attr("href"));
                            siblingparents.push(urlval);
                        }
                    }
                }
                if (siblingparents.length > 0) {
                    profiledata["halfsibling"] = !recursiveCompare(parentlist, siblingparents);
                }
            }
            if (genderval === "unknown") {
                child = children[2];
                var rows = $(child).find('tr');
                for (var i = 0; i < rows.length; i++) {
                    var row = rows[i];
                    var title = $(row).find(".recordFieldLabel").text().toLowerCase().replace(":", "").trim();
                    if (isPartner(title) && isFemale(title)) {
                        genderval = "male";
                        profiledata["gender"] = genderval;
                        break;
                    } else if (isPartner(title) && isMale(title)) {
                        genderval = "female";
                        profiledata["gender"] = genderval;
                        break;
                    }
                }
            }
            if (genderval === "unknown") {
                //last attempt to determine gender - check if the lastname != birthname, assume female
                var nametest = NameParse.parse(focusperson);
                if (nametest.suffix !== "") {
                    genderval = "male";
                    focusgender = genderval;
                    profiledata["gender"] = genderval;
                } else if (nametest.birthName !== "" && nametest.lastName !== nametest.birthName) {
                    genderval = "female";
                    profiledata["gender"] = genderval;
                }
            }
        } else if (relation === "") {
            alldata["profile"] = profiledata;
            alldata["scorefactors"] = parsed.find(".value_add_score_factors_container").text().trim();
            if (!familymembers) {
                //revisit - not sure when this would actually run as it's run above when familymembers is true
                familystatus.push("about");
                var abouturl = "http://historylink.herokuapp.com/smartsubmit?fields=about_me&profile=" + focusid;
                chrome.extension.sendMessage({
                    method: "GET",
                    action: "xhttp",
                    url: abouturl
                }, function (response) {
                    var about_return = JSON.parse(response.source);
                    if (!$.isEmptyObject(about_return) && exists(about_return.about_me)) {
                        focusabout = about_return.about_me;
                    }
                    familystatus.pop();
                });
            }
            updateGeo();
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

