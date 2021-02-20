// Parse MyHeritage Smart Match & Record Match
registerCollection({
    "reload": false,
    "recordtype": "MyHeritage Match",
    "prepareUrl": function(url) {
        if (startsWithMH(url, "") && !startsWithHTTP(url, "https://www.myheritage.com/")) {
            url = url.replace(/https?:\/\/www\.myheritage\..*?\//i, "https://www.myheritage.com/") + "&lang=EN";
            this.reload = true;
        }
        return url;
    },
    "collectionMatch": function(url) {
        return (
            startsWithMH(url, "research/record-") || startsWithMH(url, "research/collection-") ||
            startsWithMH(url, "matchingresult") || startsWithMH(url, "research?")
            );
    },
    "parseData": function(url) {
        if (startsWithMH(url, "matchingresult") || startsWithMH(url, "research\\?")) {
            document.querySelector('#loginspinner').style.display = "none";
            setMessage(warningmsg, 'Please select one of the Matches on this results page.');
        } else {
            focusURLid = getMHURLId(url);
            getPageCode();
        }
    },
    "redirect": function(request) {
        if (tablink.contains("myheritage.com") && recordtype === "WikiTree") {
            var recordurl = request.source.match('www.wikitree.com/wiki/(.*?)"');
            if (exists(recordurl) && exists(recordurl[1])) {
                tablink = "https://www.wikitree.com/wiki/" + recordurl[1];
                for (var i=0; i<collections.length; i++) {
                    if (collections[i].collectionMatch(tablink)) {
                        collection = collections[i];
                        tablink = collection.prepareUrl(tablink);
                        recordtype = collection.recordtype;
                        if (collection.experimental) {
                            $("#experimentalmessage").css("display", "block");
                        }
                        console.log("Collection: " + recordtype);
                        break;
                    }
                }
                profilechanged = true;
                chrome.runtime.sendMessage({
                    method: "GET",
                    action: "xhttp",
                    url: tablink
                }, function (response) {
                    loadPage(response);
                });
                return true;
            }
        }
        return false;
    },
    "loadPage": function(request) {
        /*
         Below checks to make sure the user has not clicked away from the matched profile
         in order to prevent them from copying a family or data to the wrong destination.
         Once you click off the initial match, MH adds a row of tabs - using that as indication.
         */
        if (request.source.indexOf('SearchPlansPageManager') !== -1) {
            document.getElementById("smartcopy-container").style.display = "none";
            document.getElementById("loading").style.display = "none";
            setMessage(warningmsg, 'SmartCopy can work with the various language sites of MyHeritage, but you must have an authenticated session with the English website.<br/><a href="http://www.myheritage.com/">Please login to MyHeritage.com</a>');
            this.parseProfileData = "";
        } else {
            var parsed = $('<div>').html(request.source.replace(/<img[^>]*>/ig, ""));
            focusname = parsed.find(".recordTitle").text().trim();
            if (focusname == "") {
                focusname = $(parsed.find(".record_title")[0]).text().trim();
            }
            
            var shorturl = shorturlreader(tablink);
            focusURLid = getMHURLId(shorturl);
            if (focusURLid === "") {
                focusURLid = getMHURLId(tablink);
            }
            smscorefactors = parsed.find(".value_add_score_factors_container").text().trim();
            recordtypeval = parsed.find(".infoGroupTitle");
            recordtypeval2 = parsed.find(".collection_info_box_title")
            if (exists(recordtypeval[0])) {
                recordtype = $(recordtypeval[0]).text();
            } else if (exists(recordtypeval2[0])) {
                recordtype = $(recordtypeval2[0]).text();
            }
            focusrange = parsed.find(".recordSubtitle").text().trim();
            if (!profilechanged) {
                var smartmatchpage = parsed.find("#nav_tab_901");
                var smartmatchpage2 = parsed.find("#nav_tab_101");
                var smartmatchpage3 = parsed.find(".value_add_score_factors_container");
                var smartmatchpage4 = request.source.contains("window.NREUM");
                var smartmatchpage5 = parsed.find(".Breadcrumbs").text().contains("Smart Matches™");
                if (!exists(smartmatchpage[0]) && !exists(smartmatchpage2[0]) && (exists(smartmatchpage3[0]) || (smartmatchpage4 || smartmatchpage5))) {
                    var focusprofile = parsed.find(".individualInformationProfileLink").attr("href");
                    if (exists(focusprofile)) {
                        focusid = focusprofile.trim().replace("http://www.geni.com/", "").replace("https://www.geni.com/", "");
                        if (exists(focusid) && focusid.contains("myheritage.com")) {
                            if (focusURLid !== "") {
                                for (var i = 0; i < buildhistory.length; i++) {
                                    if (buildhistory[i].itemId === focusURLid) {
                                        focusid = buildhistory[i].id;
                                        profilechanged = true;
                                        loadPage(request);
                                        return;
                                    }
                                }
                            }
                            focusid = null;
                        } else {
                            updateLinks("?profile=" + focusid);
                            profilechanged = true;
                            loadPage(request);
                        }
                    }
                } else if (focusURLid !== "") {
                    for (var i = 0; i < buildhistory.length; i++) {
                        if (buildhistory[i].itemId === focusURLid) {
                            focusid = buildhistory[i].id;
                            profilechanged = true;
                            loadPage(request);
                            return;
                        }
                    }
                }
            }
        }
    },
    "parseProfileData": parseSmartMatch
});

var fsimage = {};
function parseSmartMatch(htmlstring, familymembers, relation) {
    try{
        if ($(htmlstring).filter('title').text().contains("Marriages")) {
            document.getElementById("loading").style.display = "none";
            document.getElementById("top-container").style.display = "none";
            setMessage(warningmsg, 'This MyHeritage collection is not yet supported by SmartCopy.');
            return "";
        }
    } catch(e){
        noerror = false;
        setMessage(errormsg, 'There was a problem reading the SmartMatch page.');
        console.log(e); //error in the above string(in this case,yes)!
        return;
    }
    relation = relation || "";
    if (htmlstring.contains("Please solve the Captcha to prove that you are not a bot")) {
        if (!captcha) {
            captcha = true;
            var url = tablink;
            if (relation !== "") {
                url = relation.url;
            }
            document.getElementById("loading").style.display = "none";
            document.getElementById("top-container").style.display = "none";
            setMessage(warningmsg, 'MyHeritage is requesting that you solve a Captcha to continue.  Please click this <a href="' + url + '">www.myheritage.com</a> link, solve the Captcha, and try again.');
        }
        return;
    }
    var parsed = $('<div>').html(htmlstring.replace(/<img[^>]*>/ig, ""));

    var focusperson = parsed.find(".recordTitle").text().trim();
    if (focusperson == "") {
        focusperson = $(parsed.find(".record_title")[0]).text().trim();
    }
    $("#readstatus").html(escapeHtml(focusperson));
    var focusdaterange = parsed.find(".recordSubtitle").text().trim();
    var genderdiv = parsed.find(".recordImage");
    var genderimage = $(genderdiv).find('.PK_Silhouette');
    var genderval = "unknown";
    if ($(genderimage).hasClass('PK_Silhouette_S_150_M_A_LTR') || $(genderimage).hasClass('PK_Silhouette_S_150_M_C_LTR') || 
        $(genderimage).hasClass('PK_Silhouette_S_96_M_A_LTR') || $(genderimage).hasClass('PK_Silhouette_S_192_M_A_LTR')) {
        genderval = "male";
    } else if ($(genderimage).hasClass('PK_Silhouette_S_150_F_A_LTR') || $(genderimage).hasClass('PK_Silhouette_S_150_F_C_LTR') || 
        $(genderimage).hasClass('PK_Silhouette_S_96_F_A_LTR') || $(genderimage).hasClass('PK_Silhouette_S_192_F_A_LTR')) {
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
            if (!thumb.startsWith("https://recordsthumbnail.myheritageimages.com") && !thumb.startsWith("http://recordsthumbnail.myheritageimages.com")) {
                var image = imageref[0].href;
                if (startsWithHTTP(image, "https://www.findagrave.com")) {
                    profiledata["image"] = thumb.replace("https://records.myheritageimages.com/wvrcontent/findagrave_photos", "http://image1.findagrave.com");
                } else if (startsWithHTTP(image, "https://billiongraves.com")) {
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
            } else if (!thumb.contains("myheritageimages.com") && !thumb.contains("mhcache.com") && !thumb.contains("myheritage.com")) {
                //Not sure this is going to cause issues, but it got this to work.
                // https://www.myheritage.com/research/collection-10146/tributescom?action=showRecord&itemId=8511070-&indId=externalindividual-a927eb4277498b4bbc12570244a4988c&callback_token=5Z7xX1ABYHsR8qV5DXpwK55naXJ6nrC0FXCcCkuq&mrid=3e052f062f497f22bc557d280441ce1a
                profiledata["image"] = thumb;
                profiledata["thumb"] = thumb;
            } else if (thumb.contains("get-fs-image.php")) {
                familystatus.push(familystatus.length);
                var imgurl = thumb.replace(/'/g,"%27").replace(/"/g,"%22");
                chrome.runtime.sendMessage({
                    method: "GET",
                    action: "xhttp",
                    url: imgurl,
                    variable: imgurl
                }, function (response) {
                    var thumb = response.responseURL;
                    var imgurl = response.variable;
                    if (imgurl.startsWith("http") && !thumb.contains("myheritageimages.com") && !thumb.contains("mhcache.com") && !thumb.contains("myheritage.com")) {
                        //https://www.myheritage.com/research/collection-40001/familysearch-family-tree?itemId=149064846&action=showRecord
                        //https://www.myheritage.com/research/collection-40001/familysearch-family-tree?itemId=337043845&action=showRecord
                        profiledata["image"] = imgurl;
                        profiledata["thumb"] = imgurl;
                        fsimage[imgurl] = thumb;
                    }
                    familystatus.pop();
                });
            }
        }
    }



    var records = parsed.find(".recordFieldsContainer");
    if (familymembers) {
        loadGeniData();
        //Parses pages like Census that have entries at the bottom in Household section
        var household = parsed.find('.groupTable').find('tr');
        if (household.length === 0) {
            household = parsed.find('.groupRow');
        }
        if (household.length > 0) {
            var housearray = [];
            var focustitle = "";
            for (var i = 0; i < household.length; i++) {
                var hv = $(household[i]).find('td');
                for (var x = 0; x < hv.length; x++) {
                    var urlval = $(hv[x]).find('a');
                    if (urlval.length > 0) {
                        var hurl = urlval[0].href;
                        var itemid = getMHURLId(hurl);
                        var title = $(hv[0]).text().toLowerCase().replace(" (implied)", "");

                        if (itemid !== focusURLid) {
                            housearray.push({name: $(hv[x]).text(), url: hurl, title: title});
                        } else {
                            focustitle = title;
                            if (focusgender === "unknown") {
                                if (title === "wife") {
                                    genderval = "female";
                                } else if (title === "husband") {
                                    genderval = "male";
                                }
                                focusgender = genderval;
                                profiledata["gender"] = focusgender;
                            }
                        }
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
        for (var i=0; i < children.length; i++) {
            if (children[i].nodeName === "#text") {
                children[i].remove();
                i = i-1;
            }
        }
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
                    if (relation === "") {
                        focusgender = genderval;
                    }
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
                    } else if (listrow.length == 1 && listrow[0].hasChildNodes() && exists($(listrow[0].childNodes[0]).attr("href"))) {
                        checklist = true;
                    }
                    if (checklist) {
                        for (var lr =0;lr < listrow.length; lr++) {
                            var listrowval = listrow[lr];
                            if (listrowval.nodeName === "SPAN" && listrowval.hasChildNodes()) {
                                listrowval = listrowval.childNodes[0];
                                var urlval = $(listrowval).attr("href");
                                if (!exists(urlval) || urlval === "") {
                                    if(household.length > 0 || ($(listrow[lr]).text() === "" && $(listrow[lr]).data("itemId") === "undefined")) {
                                        continue;
                                    }
                                }
                            } else if (listrowval.nodeName === "BR") {
                                continue;
                            }
                            if (listrowval.className !== "eventSeparator" && listrowval.nodeValue !== null) {
                                var name = listrowval.nodeValue.trim();
                                if (name.replace(",","").length > 1) {
                                    var profile = {name: name, gender: gendersv, profile_id: famid, title: title};
                                    alldata["family"][title].push(profile);
                                    databyid[famid] = profile;
                                    if (isPartner(title)) {
                                        myhspouse.push(famid);
                                    }
                                    famid++;
                                }
                            } else if (listrowval.className !== "eventSeparator") {
                                var urlval = $(listrowval).attr("href");
                                if (exists(urlval) && urlval !== "") {
                                    familystatus.push(familystatus.length);
                                    var subdata = {name: $(listrowval).text().trim(), gender: gendersv, title: title};
                                    var shorturl = shorturlreader(urlval);
                                    var itemid = getMHURLId(shorturl);
                                    subdata["url"] = urlval;
                                    subdata["itemId"] = itemid;
                                    subdata["profile_id"] = famid;
                                    if (isParent(title)) {
                                        parentlist.push(itemid);
                                    } else if (isPartner(title)) {
                                        myhspouse.push(famid);
                                    }
                                    unionurls[famid] = itemid;
                                    famid++;
                                    chrome.runtime.sendMessage({
                                        method: "GET",
                                        action: "xhttp",
                                        url: shorturl,
                                        variable: subdata
                                    }, function (response) {
                                        var arg = response.variable;
                                        var person = parseSmartMatch(response.source, false, {"title": arg.title, "proid": arg.profile_id, "url": arg.url});
                                        person = updateInfoData(person, arg);
                                        databyid[arg.profile_id] = person;
                                        alldata["family"][arg.title].push(person);
                                        familystatus.pop();
                                    });
                                }
                            }
                        }
                    } else if (!exists(housearray)) {
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
                                var profile = {name: splitval.trim(), gender: gendersv,  profile_id: famid, title: title, status: title};
                                alldata["family"][title].push(profile);
                                databyid[famid] = profile;
                                if (isPartner(title)) {
                                    myhspouse.push(famid);
                                }
                                famid++;
                            }
                        }
                    }
                }
                continue;
            } else if (!familymembers && isParent(title)) {
                if (exists($(row).find(".recordFieldValue").contents().get(0))) {
                    var listrow = $(row).find(".recordFieldValue").contents();
                    var checklist = false;
                    if (listrow.length > 1) {
                        checklist = true;
                    } else if (listrow.length == 1 && exists($(listrow[0]).attr("href"))) {
                        checklist = true;
                    } else if (listrow.length == 1 && listrow[0].hasChildNodes() && exists($(listrow[0].childNodes[0]).attr("href"))) {
                        checklist = true;
                    }
                    if (checklist) {
                        if (isChild(relation.title)) {
                            for (var lr =0;lr < listrow.length; lr++) {
                                var listrowval = listrow[lr];
                                if (listrowval.nodeName === "SPAN" && listrowval.hasChildNodes()) {
                                    listrowval = listrowval.childNodes[0];
                                } else if (listrowval.nodeName === "BR") {
                                    continue;
                                }
                                if (listrowval.className !== "eventSeparator" && listrowval.nodeValue === null) {
                                    var urlval = $(listrowval).attr("href");
                                    if (exists(urlval) && urlval !== "") {
                                        var shorturl = shorturlreader(urlval);
                                        var itemid = getMHURLId(shorturl);
                                        if (focusURLid !== itemid) {
                                            childlist[relation.proid] = $.inArray(itemid, unionurls);
                                            profiledata["parent_id"] = $.inArray(itemid, unionurls);
                                            break;
                                        }
                                    }
                                }
                            }
                        } else if (isSibling(relation.title)) {
                            var siblingparents = [];
                            for (var lr =0;lr < listrow.length; lr++) {
                                var listrowval = listrow[lr];
                                if (listrowval.nodeName === "SPAN" && listrowval.hasChildNodes()) {
                                    listrowval = listrowval.childNodes[0];
                                } else if (listrowval.nodeName === "BR") {
                                    continue;
                                }
                                if (listrowval.className !== "eventSeparator" && listrowval.nodeValue === null) {
                                    var urlval = $(listrowval).attr("href");
                                    if (exists(urlval) && urlval !== "") {
                                        var shorturl = shorturlreader(urlval);
                                        var itemid = getMHURLId(shorturl);
                                        siblingparents.push(itemid);
                                    }
                                }
                            }
                            if (siblingparents.length > 0) {
                                profiledata["halfsibling"] = !recursiveCompare(parentlist, siblingparents);
                            }
                        }
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
                        if (isChild(relation.title)) {
                            for (var lr =0;lr < splitlr.length; lr++) {
                                var splitval = splitlr[lr];
                                if (exists(housearray)) {
                                    for (var i = 0; i < housearray.length; i++) {
                                        if (housearray[i].name === splitval.trim()) {
                                            var urlval = housearray[i].url;
                                            var shorturl = shorturlreader(urlval);
                                            var itemid = getMHURLId(shorturl);
                                            if (focusURLid !== itemid) {
                                                childlist[relation.proid] = $.inArray(itemid, unionurls);
                                                profiledata["parent_id"] = $.inArray(itemid, unionurls);
                                                continue;
                                            }
                                            break;
                                        }
                                    }
                                }
                            }
                        } else if (isSibling(relation.title)) {
                            var siblingparents = [];
                            for (var lr =0;lr < splitlr.length; lr++) {
                                var splitval = splitlr[lr];
                                if (exists(housearray)) {
                                    for (var i = 0; i < housearray.length; i++) {
                                        if (housearray[i].name === splitval.trim()) {
                                            var urlval = housearray[i].url;
                                            var shorturl = shorturlreader(urlval);
                                            var itemid = getMHURLId(shorturl);
                                            siblingparents.push(itemid);
                                            break;
                                        }
                                    }
                                }
                            }
                            if (siblingparents.length > 0) {
                                profiledata["halfsibling"] = !recursiveCompare(parentlist, siblingparents);
                            }
                        }
                    }
                }
            }
            if (title.startsWith("info") || title.startsWith("notes") || title.startsWith("military") || title.startsWith("immigration") ||
                title.startsWith("visa") || title === "emigration" || title === "ethnicity" || title === "race" || title === "residence" ||
                title === "census" || title === "politics" || title === "religion" || title === "ostracized" || title === "family death" ||
                title === "family reunion") {
                var aboutinfo = $(row).find(".recordFieldValue").html();
                if (exists(aboutinfo)) {
                    aboutinfo = aboutinfo.replace(/<div class="eventSeparator"><\/div>/g,' - ');
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
                    var addaboutinfo = "* '''" + capFL(title) + "''': " + aboutinfo + "\n";
                    if (!aboutdata.contains(addaboutinfo)) {
                        aboutdata += addaboutinfo;
                    }
                }
                continue;
            } else if (familymembers && title === "source") {
                var hlink = $(row).find(".recordFieldValue").find("a").attr("href");
                if (exists(hlink)) {
                    tablink = hlink;
                }
            }
            if (title === "occupations") {
                title = "occupation";
            }
            if (title.startsWith('birth') || title.startsWith('death') || title.startsWith('burial') || title.startsWith('baptism')) {
                title = title.replace("date", "").replace("place","");
                title = title.trim();
            }
            if (title !== 'birth' && title !== 'death' && title !== 'baptism' && title !== 'burial'
                && title !== 'occupation' && title !== 'cemetery' && title !== 'christening' && title !== 'divorce' && title !== 'aliases'
                && !(title === 'marriage' && (relation === "" || isParent(relation.title) || isPartner(relation.title)))) {
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
            if (title === "aliases") {
                if (exists($(row).find(".recordFieldValue").contents().get(0))) {
                    profiledata["nicknames"] = $(row).find(".recordFieldValue").contents().get(0).nodeValue;
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
                        if (exists(valdate) && valdate.startsWith("0/0/")) {
                            valdate = valdate.replace("0/0/", "");
                        }
                        var verifydate = moment(valdate, getDateFormat(valdate), true).isValid();
                        if (!verifydate) {
                            if (valdate !== null && (valdate.startsWith("Circa") || valdate.startsWith("After") || valdate.startsWith("From") || valdate.startsWith("To") || valdate.startsWith("Before") || valdate.startsWith("Between"))) {
                                break;
                            } else if (valdate !== null && checkPlace(valdate) !== "") {
                                valplace = checkPlace(valdate);
                                if (vallocal === "") {
                                    vallocal = valdate;
                                    valdate = "";
                                }
                            } else if (valdate !== null && (valdate.toLowerCase().startsWith("marriage to") || valdate.toLowerCase().startsWith("spouse:"))) {
                                data.push({name: valdate.replace("Marriage to: ","").replace("Spouse: ", "")});
                            } else {
                                if (fielddata.get(i).hasChildNodes()) {
                                    var checkchild = fielddata.get(i).childNodes;
                                    for (var x=0; x < checkchild.length; x++) {
                                        valdate = checkchild[x].nodeValue;
                                        verifydate = moment(valdate, getDateFormat(valdate), true).isValid();
                                        if (!verifydate) {
                                            if (valdate !== null && (valdate.startsWith("Circa") || valdate.startsWith("After") || valdate.startsWith("From") || valdate.startsWith("To") || valdate.startsWith("Before") || valdate.startsWith("Between"))) {
                                                break dance;
                                            }
                                            if (exists(valdate) && vallocal === "" && valdate.contains(",")) {
                                                vallocal = valdate;
                                            }
                                            valdate = "";
                                        } else {
                                            break dance;
                                        }
                                    }
                                } else {
                                    if (exists(valdate) && vallocal === "" && valdate.contains(",")) {
                                        vallocal = valdate;
                                    }
                                    valdate = "";
                                }
                            }
                        } else {
                            break;
                        }
                    }
                }

            if (valdate !== "") {
                data.push({date: cleanDate(valdate)});
            }
            vallocal = vallocal.replace(/Unknown/ig, "");
            vallocal = vallocal.replace(/\[Blank\]/ig, "");
            if (vallocal !== "") {
                data.push({id: geoid, location: vallocal, place: valplace});
                geoid++;
            }
            if (title === "burial" && valdate !== "") {
                profiledata["alive"] = false;
                burialdtflag = true;
            } else if (title === "death" && valdate !== "") {
                profiledata["alive"] = false;
                deathdtflag = true;
            }
            if (title === "burial" && valdate === "" && vallocal !== "") {
                profiledata["alive"] = false;
                buriallcflag = true;
            }
            if (exists(profiledata[title]) && profiledata[title].length >= data.length) {
                if (data.length > 0 && ((valdate === "" && vallocal !== "") || (valdate !== "" && vallocal === ""))) {
                    profiledata[title][0] = $.extend(profiledata[title][0], data[0]);
                }
                continue;
            }

            if (title !== 'marriage') {
                profiledata[title] = data;
            } else if (!$.isEmptyObject(data)) {
                if (relation === "") {
                    //focus profile
                    marriagedata.push(data);
                } else {
                    //parent profiles
                    if (isPartner(relation.title)) {
                        if (exists(data[0].name) && exists(data[0].name === "<Private>")) {
                            //Verify the date in spouse marriage dates
                            for (var i=0; i < marriagedata.length; i++) {
                                if (checkNested(marriagedata[i],1,"date") && checkNested(data,1, "date")) {
                                    if (marriagedata[i][1].date === data[1].date) {
                                        profiledata[title] = data;
                                        break;
                                    }
                                }
                            }
                        }
                    } else if (!parentflag && isParent(relation.title)) {
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
        if (aboutdata.trim() !== "") {
            profiledata["about"] = aboutdata;
            // "\n--------------------\n"  Merge separator
        }

        // ---------------------- Family Data --------------------
        var closeout = false;
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
                    var shorturl = shorturlreader(urlval);
                    var itemid = getMHURLId(shorturl);
                    if (isParent(title)) {
                        parentlist.push(itemid);
                    }
                    subdata["url"] = urlval;
                    subdata["itemId"] = itemid;
                    subdata["profile_id"] = famid;
                    unionurls[famid] = itemid;
                    famid ++;
                    //Grab data from the profile's page as it contains more detailed information
                    chrome.runtime.sendMessage({
                        method: "GET",
                        action: "xhttp",
                        url: urlval,
                        variable: subdata
                    }, function (response) {
                        var arg = response.variable;

                        var person = parseSmartMatch(response.source, false, {"title": arg.title, "proid": arg.profile_id, "url": arg.url});
                        person = updateInfoData(person, arg);
                        if (person.name === "") {
                            console.log(response.source);
                        }
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
        } else if (familymembers && exists(housearray)) {
            for (var i = 0; i < housearray.length; i++) {
                var urlval = housearray[i].url;
                var shorturl = shorturlreader(urlval);
                var itemid = getMHURLId(shorturl);
                if (!urlval.startsWith("http") || itemid === "") {
                    continue;
                }
                var title = relationshipToHead(focustitle, housearray[i].title);
                var gendersv = "unknown";
                if (isFemale(title)) {
                    gendersv = "female";
                } else if (isMale(title)) {
                    gendersv = "male";
                }
                var subdata = {name: housearray[i].name, gender: gendersv, title: title};
                familystatus.push(familystatus.length);
                subdata["url"] = urlval;
                subdata["itemId"] = itemid;
                subdata["profile_id"] = famid;
                if (isParent(title)) {
                    parentlist.push(itemid);
                } else if (isPartner(title)) {
                    myhspouse.push(famid);
                }
                unionurls[famid] = itemid;
                famid++;
                chrome.runtime.sendMessage({
                    method: "GET",
                    action: "xhttp",
                    url: shorturl,
                    variable: subdata
                }, function (response) {
                    var arg = response.variable;
                    var person = parseSmartMatch(response.source, false, {"title": arg.title, "proid": arg.profile_id, "url": arg.url});
                    person = updateInfoData(person, arg);
                    databyid[arg.profile_id] = person;
                    if (!exists(alldata["family"][arg.title])) {
                        alldata["family"][arg.title] = [];
                    }
                    alldata["family"][arg.title].push(person);
                    familystatus.pop();
                });
            }
            closeout = true;
        } else if (children.length > 2 && exists(relation.title)) {
            if (isChild(relation.title)) {
                var itemid = getMHURLId(tablink);
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
                            var urlval = getMHURLId($(row).find(".individualListBodyContainer a").attr("href"));
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
                        profiledata["mstatus"] = reverseRelationship(title);
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
                            var urlval = getMHURLId($(row).find(".individualListBodyContainer a").attr("href"));
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
        } else if (exists(relation) && isPartner(relation.title)) {

            if (marriagedata.length === 1 && !exists(profiledata["marriage"])) {
                profiledata["marriage"] = marriagedata[0];
            } else if (marriagedata.length > 1) {
                for (var m=0; m < marriagedata.length; m++) {
                    if (exists(marriagedata[m][0]) && exists(marriagedata[m][0].name)) {
                        if (marriagedata[m][0].name === profiledata.name) {
                            profiledata["marriage"] = marriagedata[m];
                            break;
                        }
                    }
                }
            }
        } else if (relation === "") {
            closeout = true;
        }
        if (closeout) {
            alldata["profile"] = profiledata;
            alldata["scorefactors"] = parsed.find(".value_add_score_factors_container").text().trim();
            if (!familymembers) {
                //revisit - not sure when this would actually run as it's run above when familymembers is true
                familystatus.push("about");
                var abouturl = smartcopyurl + "/smartsubmit?fields=about_me&profile=" + focusid;
                chrome.runtime.sendMessage({
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

function getMHURLId(urlval) {
    var id = "";
    if (urlval.contains('itemId=')) {
        id = getParameterByName('itemId', urlval);
    } else {
        urlval = urlval.substring(urlval.indexOf('/record-')+8);
        urlval = urlval.substring(0, urlval.indexOf('/'));
        id = urlval.substring(urlval.indexOf('-')).replace(/-/g,'');
    }
    return id;
}

function shorturlreader(urlval) {
    var shorturl = urlval;
    if (urlval.contains('showRecord')) {
        shorturl = urlval.substring(0, urlval.indexOf('showRecord') + 10);
    }
    return shorturl;
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

