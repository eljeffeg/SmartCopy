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
    // #35 follow-up (live-reported): buildhistory's own "same URL means
    // the same person" assumption breaks for a multi-person record like a
    // marriage record - the same URL legitimately gets revisited for the
    // groom, the bride, or a parent mentioned only as a sub-field, on
    // different occasions. getMHURLId() (below) only ever derives the
    // RECORD's own id, never a person-specific one, so a prior submission
    // for this URL as one person was silently reused for a later, totally
    // different search intent, with no picker ever offered. popup.js's
    // OWN generic buildhistory fallback (loadPage(), around its "#218/
    // #227" comment) has no way to know this on its own - it works
    // identically across every collection - so it asks each collection
    // via this hook rather than special-casing MyHeritage marriages
    // directly in generic code.
    "isAmbiguousFocusPage": function(htmlSource) {
        return exists(htmlSource) && $(htmlSource).filter('title').text().contains("Marriages");
    },
    "parseData": function(url) {
        if (startsWithMH(url, "matchingresult") || startsWithMH(url, "research\\?")) {
            document.querySelector('#loginspinner').style.display = "none";
            setMessage(warningmsg, _('Please_select_one_of_the_Matches'));
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
            setMessage(warningmsg, 'SmartCopy can work with the various language sites of MyHeritage, but you must have an authenticated session with the English website.<br/><a href="https://www.myheritage.com/">Please login to MyHeritage.com</a>');
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
                            // #35 follow-up (live-reported): focusname above
                            // was read from .recordTitle, the WHOLE page's
                            // title - fine for a single-person record, but
                            // a marriage record's title names BOTH people
                            // ("Leo Hamlisch & Henrietta Flesdrager"),
                            // wrongly showing/submitting the pair as if it
                            // were one person's name. .individualInformationName
                            // (the same "In my Geni tree" sidebar widget
                            // focusid was just read from) names the ONE
                            // person actually matched - prefer it whenever
                            // present, same technique loadSelectPage()
                            // (popup.js) already uses for this exact widget.
                            var matchedName = parsed.find(".individualInformationName").text().trim();
                            if (matchedName !== "") {
                                focusname = matchedName;
                            }
                            updateLinks("?profile=" + focusid);
                            profilechanged = true;
                            loadPage(request);
                        }
                    }
                // #35 follow-up (live-reported): buildhistory assumes one
                // record URL always means the same person, which holds for
                // an ordinary profile page (its own URL only ever refers to
                // that one person) but not for a multi-person record like a
                // marriage - the same URL legitimately gets visited for the
                // groom, the bride, or (live-reported) a parent mentioned
                // only as a sub-field, on different occasions. focusURLid
                // here is the RECORD's own id (getMHURLId() - a path/
                // itemId, never person-specific), so a prior submission for
                // this exact URL as one person silently auto-resolved to
                // that SAME person again, with no picker ever offered, even
                // when the current search was for someone else entirely
                // mentioned in the same record. Skip the auto-resolve for a
                // page titled "...Marriages" specifically - falls through
                // to popup.js's other resolution paths (opener chain, then
                // the manual "Set Geni Destination Profile" picker) instead
                // of silently trusting a mapping that isn't reliable for
                // this record type.
                } else if (focusURLid !== "" && !this.isAmbiguousFocusPage(request.source)) {
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
    // A failed recursive fetch (any of the four call sites below that pass
    // response.source straight into this function) used to reach the
    // Captcha check's htmlstring.contains(...) below unconditionally and
    // throw uncaught there -
    // above the familystatus.pop() in each of those callbacks, hanging
    // "Reading Family Data..." forever (updateGeo() in buildform.js polls
    // familystatus.length and never proceeds while any push is unmatched by
    // a pop). Same hang-causing bug class already fixed this session in
    // collections/geneanet.js, collections/filae.js, and
    // collections/myheritagenew.js - see issue #196.
    if (!exists(htmlstring)) {
        return "";
    }
    // #35 follow-up (live-reported): this function used to unconditionally
    // refuse ANY record whose page title contains "Marriages" (present
    // since this file's original 2014 commit) - a marriage record names
    // two people (bride/groom) with no inherent "this is the focus" the
    // way a person profile page has, so this existed to avoid silently
    // attributing the wrong person's data to Geni.
    //
    // It's obsolete now, not just cautious: parseSmartMatch() is only ever
    // reached from popup.js's loadPage() after a definite focusid has
    // already been resolved - parseProfileData is called exclusively from
    // inside loadPage()'s profilechanged-true branch (see loadPage()'s own
    // structure), which by the time we get here has already succeeded via
    // one of: the "In my Geni tree" sidebar match
    // (.individualInformationProfileLink, collection.loadPage() above), a
    // prior SmartCopy submission history match, the tab's opener chain, or
    // the user's own manual "Set Destination" entry. Every one of those is
    // exactly as trustworthy for a marriage record as for any other record
    // type this file already parses unconditionally - refusing here threw
    // away that already-resolved focus for no remaining reason. Live-
    // reported case: a MyHeritage marriage record with a Geni Smart Match
    // sidebar naming the searched person (Leo Hamlisch) was still refused
    // outright despite that match already being known.
    //
    // What's UNVERIFIED: whether this record type's specific field labels
    // (e.g. a bare "Marriage:" row vs the spouse's own name/relationship,
    // if MyHeritage renders one as a separate field at all) get recognized
    // by the generic field-parsing loop below as cleanly as birth/death
    // records do - that needs a live test against an actual marriage
    // record page, not something safe to assume from source alone.
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

    // #35 follow-up (live-confirmed): .recordImageBoxContainer only ever
    // holds a small thumbnail (live-reported as "tiny" - the source has
    // "/thumb/" in its path and "96x" in the filename). The genuine
    // full-resolution scan lives in a separate "document viewer" widget
    // elsewhere on the SAME page (#documentViewerMainContainer >
    // .document_viewer_image), confirmed present in the raw page source
    // itself (not something only generated after a user interaction, so
    // a plain background fetch - what this whole function works from -
    // does see it). Its src is a cryptographically signed, time-limited
    // URL (a base64 k=/s=/e= token: key type, a 256-bit signature, a
    // Unix expiry) that MyHeritage's own server generates - not something
    // derivable from the thumbnail URL by pattern, so this reads it
    // directly rather than trying to transform the thumbnail path.
    // .first() - a multi-page record (confirmed live: this one had 2
    // pages, paginated via #documentViewer0_0/documentViewer0_1 etc.) -
    // only the first page's scan is used, matching how this whole
    // function only ever tracks a single photo per profile already.
    var fullImage = $(htmlstring).find('.document_viewer_image').first().attr('src');
    if (exists(fullImage) && fullImage !== "") {
        profiledata["image"] = fullImage;
        profiledata["thumb"] = exists(thumb) ? thumb : fullImage;
    } else if (exists(thumb)) {
        var imageref = imagebox.find('a');
        if (exists(imageref[0])) {
            if (!thumb.startsWith("https://recordsthumbnail.myheritageimages.com") && !thumb.startsWith("http://recordsthumbnail.myheritageimages.com")) {
                var image = imageref[0].href;
                if (startsWithHTTP(image, "https://www.findagrave.com")) {
                    profiledata["image"] = thumb.replace("https://records.myheritageimages.com/wvrcontent/findagrave_photos", "https://image1.findagrave.com");
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
                    // try/finally guarantees the pop below regardless of
                    // what throws inside - a failed fetch (e.g. the
                    // FamilySearch image proxy timing out or 404ing) leaves
                    // response.responseURL undefined, and thumb.contains(...)
                    // on undefined used to throw uncaught here, above the
                    // pop - see issue #196.
                    try {
                        var thumb = response.responseURL;
                        var imgurl = response.variable;
                        if (exists(thumb) && imgurl.startsWith("http") && !thumb.contains("myheritageimages.com") && !thumb.contains("mhcache.com") && !thumb.contains("myheritage.com")) {
                            //https://www.myheritage.com/research/collection-40001/familysearch-family-tree?itemId=149064846&action=showRecord
                            //https://www.myheritage.com/research/collection-40001/familysearch-family-tree?itemId=337043845&action=showRecord
                            profiledata["image"] = imgurl;
                            profiledata["thumb"] = imgurl;
                            fsimage[imgurl] = thumb;
                        }
                    } finally {
                        familystatus.pop();
                    }
                });
            } else {
                // #35 follow-up (live-reported): a plain record image with
                // no enclosing <a> link at all (unlike every case the
                // branches above were built for - a paperclip-marked
                // attachment, a non-MyHeritage-hosted thumbnail, or a
                // FamilySearch image-proxy URL) fell through every one of
                // them and never got set as profiledata["image"] -
                // confirmed on the Leo Hamlisch marriage record's own
                // .recordImageBoxContainer > img.recordImage, hosted on
                // myheritageimages.com with no <a> wrapper. No full-size
                // URL is reachable without one (nothing to transform the
                // thumbnail path into, unlike billiongraves' thumbnails->
                // images swap above), so this uses the thumbnail directly -
                // the same "no better alternative" fallback the
                // non-MyHeritage-hosted branch above already accepts.
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
                            focustitle = title.trim();
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
        // #35 follow-up: pre-scan BOTH the Groom's and Bride's own "Name:"
        // sub-fields ONCE here, before the main per-row loop below, to
        // determine which specific role (if either) matches the ALREADY-
        // resolved focus profile (genifocusdata - see loadPage() above).
        // Doing this once up front, by NAME, is what lets a "neither
        // matches" outcome stay a safe no-op instead of a misattribution -
        // e.g. the resolved focus is actually a THIRD person only
        // mentioned as a Father/Mother sub-field within one of these two
        // groups (a bride's father, live-questioned as a real scenario).
        // Matching by gender alone per-row (an earlier draft of this fix
        // did exactly that) would have matched that third party against
        // whichever of Groom/Bride happens to share his gender purely by
        // coincidence, not identity - concretely, it would have written
        // the GROOM's own birth/parents onto the FATHER's real Geni
        // profile just because both are male.
        var marriageFocusRole = "";
        if (exists(genifocusdata)) {
            var focusNameLower = String(genifocusdata.get("name")).toLowerCase();
            var roleNames = {};
            rows.filter('[data-field-id$="name-as-groom"], [data-field-id$="name-as-bride"]').each(function () {
                var roleRow = $(this);
                var roleTitle = roleRow.find(".recordFieldLabel").text().toLowerCase().replace(":", "").trim();
                var roleName = roleRow.find(".recordFieldValue table td.infoGroup").filter(function () {
                    return $(this).text().toLowerCase().replace(":", "").trim() === "name";
                }).first().next("td").text().trim();
                roleNames[roleTitle] = roleName;
                if (roleName !== "" && roleName.toLowerCase() === focusNameLower) {
                    marriageFocusRole = roleTitle;
                }
            });
            // #35 follow-up (live-reported): the exact-name match above
            // fails whenever the manually-set focus IS the bride herself,
            // specifically because her OWN marriage record almost always
            // names her under her MAIDEN surname (that's the whole point
            // of the record - it's the event where it changed), while her
            // Geni profile - visited directly and set as focus, live-
            // confirmed via https://www.geni.com/people/Henrietta-Hamlisch/...
            // - is recorded under her married surname. Only tried when
            // the exact match above found nothing, and requires BOTH a
            // first-name match (a name marriage doesn't change) AND the
            // Geni focus's last name matching the OTHER role's own
            // surname (confirms she's recorded under her spouse's name
            // specifically, not just any coincidental first-name match) -
            // deliberately narrower than a bare first-name match alone,
            // for the same "don't misattribute a coincidental match"
            // reasoning as the exact-match design above.
            if (marriageFocusRole === "" && exists(roleNames["groom"]) && exists(roleNames["bride"])) {
                var focusParsed = NameParse.parse(genifocusdata.get("name"), mnameonoff);
                ["groom", "bride"].forEach(function (roleTitle) {
                    if (marriageFocusRole !== "" || roleNames[roleTitle] === "") {
                        return;
                    }
                    var otherRole = (roleTitle === "groom") ? "bride" : "groom";
                    var roleParsed = NameParse.parse(roleNames[roleTitle], mnameonoff);
                    var otherParsed = NameParse.parse(roleNames[otherRole], mnameonoff);
                    if (exists(focusParsed.firstName) && focusParsed.firstName !== "" &&
                        exists(roleParsed.firstName) && roleParsed.firstName !== "" &&
                        focusParsed.firstName.toLowerCase() === roleParsed.firstName.toLowerCase() &&
                        exists(focusParsed.lastName) && focusParsed.lastName !== "" &&
                        exists(otherParsed.lastName) && otherParsed.lastName !== "" &&
                        focusParsed.lastName.toLowerCase() === otherParsed.lastName.toLowerCase()) {
                        marriageFocusRole = roleTitle;
                    }
                });
            }
        }
        for (var r = 0; r < rows.length; r++) {

            // console.log(row);
            var row = rows[r];
            var title = $(row).find(".recordFieldLabel").text().toLowerCase().replace(":", "").trim();
            if (title === "gender") {
                if (exists($(row).find(".recordFieldValue").contents().get(0))) {
                    genderval = $(row).find(".recordFieldValue").contents().get(0).nodeValue.toLowerCase().trim();
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
                                        // try/finally guarantees the pop
                                        // below regardless of what throws
                                        // inside - see issue #196. person
                                        // becomes "" (not a throw) when
                                        // response.source is undefined,
                                        // thanks to the guard at the top of
                                        // parseSmartMatch(); updateInfoData()
                                        // already falls back to arg (the
                                        // name/url/itemId/gender already
                                        // scraped from the list before this
                                        // fetch) whenever person is "".
                                        try {
                                            var arg = response.variable;
                                            var person = exists(response) ? parseSmartMatch(response.source, false, {"title": arg.title, "proid": arg.profile_id, "url": arg.url}) : "";
                                            person = updateInfoData(person, arg);
                                            databyid[arg.profile_id] = person;
                                            alldata["family"][arg.title].push(person);
                                        } finally {
                                            familystatus.pop();
                                        }
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
            // #35 follow-up (live-reported): MyHeritage marriage records
            // group each side's own data (Name/Birth/Father/Mother/Marital
            // status, sometimes Age) into a NESTED table under a single
            // "Groom:"/"Bride:" row, rather than the flat one-field-per-row
            // shape every other record type here uses - live-reported that
            // none of that nested detail was reachable at all before this,
            // since neither "groom" nor "bride" matched anything the
            // generic loop below recognized (they'd just hit the
            // catch-all `continue` further down and vanish).
            //
            // Which side (if either) is the FOCUS was already resolved
            // once, by name, in the pre-scan above (marriageFocusRole) -
            // see its own comment for why gender alone isn't a safe way to
            // decide this per-row.
            if ((title === "groom" || title === "bride") && relation === "" && familymembers) {
                var subvalues = {};
                $(row).find(".recordFieldValue > table tr").each(function () {
                    var sublabel = $(this).find("td.infoGroup").text().toLowerCase().replace(":", "").trim();
                    var subcell = $(this).find("td").eq(1);
                    if (sublabel === "birth") {
                        var subyearnode = subcell.contents().get(0);
                        subvalues["birthyear"] = exists(subyearnode) ? String(subyearnode.nodeValue).trim() : "";
                        subvalues["birthplace"] = subcell.find(".map_callout_link").text().trim();
                    } else if (sublabel !== "") {
                        subvalues[sublabel] = subcell.text().trim();
                    }
                });
                var groupGender = (title === "groom") ? "male" : "female";
                if (marriageFocusRole === title) {
                    // #35 follow-up: profiledata.name was initialized above
                    // from .recordTitle - the WHOLE page's title, which for
                    // a marriage record names both people ("Leo Hamlisch &
                    // Henrietta Flesdrager"). Now that this side is
                    // confirmed to be the actual focus, replace it with
                    // just their own name from the Groom/Bride group.
                    if (exists(subvalues["name"]) && subvalues["name"] !== "") {
                        profiledata["name"] = subvalues["name"];
                        // #35 follow-up (live-reported): setting
                        // profiledata.name alone left the popup's OWN
                        // "$('#focusname')" header still showing the
                        // combined title text - that header is rendered
                        // (from the module-global focusname, sourced from
                        // .recordTitle) BEFORE parseProfileData ever runs
                        // (see loadPage(), popup.js), so correcting the
                        // variable this late doesn't retroactively fix
                        // what's already on screen. Re-render it directly,
                        // same markup loadPage() itself uses.
                        focusname = subvalues["name"];
                        $("#focusname").html('<span id="genilinkdesc"><a href="' + 'https://www.geni.com/' + focusid + '" target="_blank" style="color:inherit; text-decoration: none;">' + escapeHtml(getProfileName(focusname)) + "</a></span>");
                    }
                    if (exists(subvalues["birthyear"]) && subvalues["birthyear"] !== "" && !exists(profiledata["birth"])) {
                        var birthdata = [{date: cleanDate(subvalues["birthyear"])}];
                        if (exists(subvalues["birthplace"]) && subvalues["birthplace"] !== "") {
                            birthdata.push({id: geoid, location: subvalues["birthplace"], place: ""});
                            geoid++;
                        }
                        profiledata["birth"] = birthdata;
                    }
                    ["father", "mother"].forEach(function (parentTitle) {
                        if (exists(subvalues[parentTitle]) && subvalues[parentTitle] !== "") {
                            if (!exists(alldata["family"][parentTitle])) {
                                alldata["family"][parentTitle] = [];
                            }
                            var parentprofile = {name: subvalues[parentTitle], gender: isMale(parentTitle) ? "male" : "female", profile_id: famid, title: parentTitle};
                            alldata["family"][parentTitle].push(parentprofile);
                            databyid[famid] = parentprofile;
                            famid++;
                        }
                    });
                } else if (marriageFocusRole !== "" && exists(subvalues["name"]) && subvalues["name"] !== "") {
                    // Only reached when the OTHER role was confirmed as
                    // focus above (marriageFocusRole !== "" and it isn't
                    // this row) - this row is therefore the focus's real
                    // spouse, not a guess. When marriageFocusRole is ""
                    // (neither Groom's nor Bride's name matched the
                    // resolved focus - e.g. focus is a third person, like a
                    // parent, only mentioned as a nested sub-field), this
                    // branch deliberately does nothing for either row -
                    // safe no-op rather than misattributing either
                    // principal's data.
                    var spouseTitle = (groupGender === "male") ? "husband" : "wife";
                    if (!exists(alldata["family"][spouseTitle])) {
                        alldata["family"][spouseTitle] = [];
                    }
                    var spouseprofile = {name: subvalues["name"], gender: groupGender, profile_id: famid, title: spouseTitle};
                    // #35 follow-up (live-reported): the spouse's own
                    // birth year/place are right there in the same nested
                    // table (subvalues, already extracted above) - no
                    // reason to leave them out just because this side
                    // isn't the focus. buildform.js's family-member
                    // rendering already reads members[member]["birth"] in
                    // this exact shape for every other collection.
                    if (exists(subvalues["birthyear"]) && subvalues["birthyear"] !== "") {
                        var spousebirthdata = [{date: cleanDate(subvalues["birthyear"])}];
                        if (exists(subvalues["birthplace"]) && subvalues["birthplace"] !== "") {
                            spousebirthdata.push({id: geoid, location: subvalues["birthplace"], place: ""});
                            geoid++;
                        }
                        spouseprofile["birth"] = spousebirthdata;
                    }
                    // #35 follow-up (live-reported, "marriage date is
                    // nowhere to be found"): buildform.js's own per-member
                    // render loop only ever shows a Marriage Date/Location
                    // row when reading members[member]["marriage"] AND
                    // relationship==="partner" (see its own comment,
                    // "Skip marriage date fields if not partner") - it
                    // never reads profiledata["marriage"]/alldata.profile
                    // .marriage at all for display purposes (that field is
                    // real and used elsewhere, by the birth-year
                    // estimator's marriage-date anchor, just never
                    // rendered as its own row). marriagedata[0] was
                    // already populated by the time this runs - the
                    // Marriage: row (DOM order: Marriage, then Groom, then
                    // Bride) is processed earlier in this same per-row
                    // loop.
                    if (exists(marriagedata[0])) {
                        spouseprofile["marriage"] = marriagedata[0];
                    }
                    alldata["family"][spouseTitle].push(spouseprofile);
                    databyid[famid] = spouseprofile;
                    myhspouse.push(famid);
                    famid++;
                }
                continue;
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
                    // #245: the source page's own HTML indentation (tabs,
                    // newlines between nested elements in .recordFieldValue)
                    // survives jQuery's .text() extraction verbatim, so a
                    // field like a census record's location can come through
                    // as "value - \n\t\t\tLocation" and render on its own
                    // indented line in the About text instead of flowing
                    // as one line. Collapse every run of whitespace
                    // (including the eventSeparator " - \n" case the old
                    // split-based fix only handled) into a single space.
                    aboutinfo = aboutinfo.replace(/\s+/g, ' ').trim();
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
                if (title.includes("/")) {
                    title = title.split("/")[0]
                }
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
                        if (exists(valdate)) {
                            valdate = valdate.trim();
                        }
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
                        // try/finally guarantees the pop below regardless of
                        // what throws inside - see issue #196.
                        try {
                            var arg = response.variable;
                            var person = exists(response) ? parseSmartMatch(response.source, false, {"title": arg.title, "proid": arg.profile_id, "url": arg.url}) : "";
                            person = updateInfoData(person, arg);
                            databyid[arg.profile_id] = person;
                            alldata["family"][arg.title].push(person);
                        } finally {
                            familystatus.pop();
                        }
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
                    // try/finally guarantees the pop below regardless of
                    // what throws inside - this is the census household
                    // loop, i.e. the spouse/children processing path from
                    // issue #196's second reported symptom (parent matches
                    // but spouse/children can't be updated) - a failed
                    // fetch for even one household member used to hang the
                    // whole read, not just skip that one person.
                    try {
                        var arg = response.variable;
                        var person = exists(response) ? parseSmartMatch(response.source, false, {"title": arg.title, "proid": arg.profile_id, "url": arg.url}) : "";
                        person = updateInfoData(person, arg);
                        databyid[arg.profile_id] = person;
                        if (!exists(alldata["family"][arg.title])) {
                            alldata["family"][arg.title] = [];
                        }
                        alldata["family"][arg.title].push(person);
                    } finally {
                        familystatus.pop();
                    }
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
            // #35 follow-up (live-reported): the marriagedata->
            // profiledata["marriage"] reconciliation right above only ran
            // inside the OTHER branch (isPartner(relation.title)) - built
            // for a recursive fetch of a SPOUSE's own separate SmartMatch
            // page, not for a marriage record's own top-level parse
            // (relation === "" is exactly what a marriage record's
            // top-level call is - see the new Groom/Bride handling
            // above). marriagedata was being populated correctly the
            // whole time (the plain "Marriage:" row already matches the
            // pre-existing title==='marriage' handling further up), it
            // just never reached profiledata for this branch - the
            // marriage date/location were parsed and then silently
            // discarded.
            if (marriagedata.length === 1 && !exists(profiledata["marriage"])) {
                profiledata["marriage"] = marriagedata[0];
            }
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
                    // try/finally guarantees the pop below regardless of
                    // what throws inside - JSON.parse(undefined) throws if
                    // this fetch fails, same risk class as the other four
                    // call sites fixed for issue #196, even though this
                    // particular branch's own reachability is uncertain
                    // (see the comment above).
                    try {
                        var about_return = JSON.parse(response.source);
                        if (!$.isEmptyObject(about_return) && exists(about_return.about_me)) {
                            focusabout = about_return.about_me;
                        }
                    } finally {
                        familystatus.pop();
                    }
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

