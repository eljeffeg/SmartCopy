// Parse MyHeritage
registerCollection({
    "reload": false,
    "recordtype": "MyHeritage Genealogy",
    "prepareUrl": function(url) {
        if (startsWithMH(url, "") && !startsWithHTTP(url, "https://www.myheritage.com/")) {
            url = url.replace(/https?:\/\/www\.myheritage\..*?\//i, "https://www.myheritage.com/");
            this.reload = true;
        }
        return url;
    },
    "collectionMatch": function(url) {
        return (startsWithMH(url,"person-") || startsWithMH(url,"member-") || startsWithMH(url,"site-family-tree-"));
    },
    "parseData": function(url) {
        if (startsWithHTTP(url,"https://www.myheritage.com/site-family-tree-") && !url.endsWith("-info")) {
            document.querySelector('#loginspinner').style.display = "none";
            setMessage(warningmsg, 'Unable to read in tree view.  Please select the Profile page instead.');
        } else {
            if (url.contains("#!profile-")) {
                focusURLid = url.substring(url.indexOf('#!profile-') + 10);
                focusURLid = focusURLid.substring(0, focusURLid.indexOf('-'));
            } else if (url.contains("rootIndivudalID=")) {
                focusURLid = getParameterByName('rootIndivudalID', url);
            } else {
                focusURLid = url.substring(url.indexOf('-') + 1);
                focusURLid = focusURLid.substring(0, focusURLid.indexOf('_'));
            }
            getPageCode();
        }
    },
    "loadPage": function(request) {
        if (request.source.indexOf('SearchPlansPageManager') !== -1) {
            document.getElementById("smartcopy-container").style.display = "none";
            document.getElementById("loading").style.display = "none";
            setMessage(warningmsg, 'SmartCopy can work with the various country-based sites of MyHeritage, but you must first sign into the main english website.<br/><a href="http://www.myheritage.com/" target="_blank">Please login to MyHeritage.com</a>');
            this.parseProfileData = "";
            return;
        }
        var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        var fperson = parsed.find("span.FL_LabelxxLargeBold");
        focusname = fperson.text();
        focusrange = "";
    },
    "parseProfileData": parseMyHeritage
});

function parseMyHeritage(htmlstring, familymembers, relation) {
    relation = relation || "";
    var splitdata = htmlstring.replace(/<img/ig, "<gmi").split("Immediate family");
    var parsed = $(splitdata[0]);
    var aboutdata = "";
    var profiledata = {};
    var focusdaterange = "";
    var fperson = parsed.find("span.FL_LabelxxLargeBold");
    var focusperson = fperson.text();
    $("#readstatus").html(escapeHtml(focusperson));
    var genderval = "unknown";
    if (htmlstring.contains("PK_Silhouette PK_SilhouetteSize192 PK_Silhouette_S_192_F_A_LTR") ||
        htmlstring.contains("PK_Silhouette PK_SilhouetteSize150 PK_Silhouette_S_150_F_A_LTR") ||
        htmlstring.contains("PK_Silhouette PK_SilhouetteSize96 PK_Silhouette_S_96_F_A_LTR")) {
        genderval = "female";
    } else if (htmlstring.contains("PK_Silhouette PK_SilhouetteSize192 PK_Silhouette_S_192_M_A_LTR") ||
    htmlstring.contains("PK_Silhouette PK_SilhouetteSize150 PK_Silhouette_S_150_M_A_LTR") ||
        htmlstring.contains("PK_Silhouette PK_SilhouetteSize96 PK_Silhouette_S_96_M_A_LTR")) {
        genderval = "male";
    } else if (focusperson.contains("(born")) {
        genderval = "female";
    } else if (isPartner(relation.title)) {
        genderval = reverseGender(focusgender);
    }
    var imagedata = parsed.find("#profilePhotoImg");
    if (exists(imagedata[0])) {
        var imglink = $(imagedata[0]).attr('src');
        if (exists(imglink[0])) {
            var thumb = imglink;
            var image = thumb;
            if (!thumb.endsWith("spacer.gif")) {
                if (htmlstring.contains("profilePhotoFullUrl")) {
                    var imgtemp = htmlstring.match(/profilePhotoFullUrl = '(.*?)';/i);
                    if (exists(imgtemp) && imgtemp.length > 1) {
                        image = imgtemp[1];
                    }
                }
                profiledata["thumb"] = thumb;
                profiledata["image"] = image;
            }
        }
    }

    if (relation === "") {
        focusgender = genderval;
    }



    // ---------------------- Profile Data --------------------
    if (focusdaterange !== "") {
        profiledata["daterange"] = focusdaterange;
    }
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;

    fperson = parsed.find('tr');
    for (var i = 0; i < fperson.length; i++) {
        var row = $(fperson[i]).find('td.FL_LabelBold');
        if (row.length > 0) {
            var rowtitle = $(row[0]).text().toLowerCase();
            var dateval = $(row[0]).next('td').text().trim();
            var eventval = $(fperson[i]).find('span.map_callout_link');

            data = [];
            if (exists(dateval)) {
                if (dateval.indexOf("(") !== -1) {
                    dateval = dateval.substring(0, dateval.indexOf("("));
                }
                dateval = cleanDate(dateval);
                if (dateval !== "") {
                    data.push({date: dateval});
                }
            }
            if (exists(eventval) && eventval.length > 0) {
                var eventlocation = $(eventval).text().trim();
                if (eventlocation !== "") {
                    data.push({id: geoid, location: eventlocation});
                    geoid++;
                }
            }
            if (rowtitle.startsWith("born")) {
                if (!$.isEmptyObject(data)) {
                    profiledata["birth"] = data;
                }
            } else if (rowtitle.startsWith("died")) {
                if (!$.isEmptyObject(data)) {
                    if (exists(getDate(data))) {
                        deathdtflag = true;
                    }
                    profiledata["death"] = data;
                }
            } else if (rowtitle.startsWith("burial")) {
                if (!$.isEmptyObject(data)) {
                    if (exists(getLocation(data))) {
                        buriallcflag = true;
                    }
                    profiledata["burial"] = data;
                }
            } else if (rowtitle.startsWith("baptism") || rowtitle.startsWith("christening")) {
                if (!$.isEmptyObject(data)) {
                    profiledata["baptism"] = data;
                }
            }
        }
    }

    profiledata["name"] = focusperson;
    profiledata["status"] = relation.title;

    if (familymembers) {
        loadGeniData();
        var famid = 0;
    }

    var siblingparents = [];
    if (exists(splitdata[1])) {
        splitdata = splitdata[1].split("FirstColumn");
        parsed = $(splitdata[0]);
        // ---------------------- Family Data --------------------
        fperson = parsed.find('a.FL_LinkBold');
        for (var i = 0; i < fperson.length; i++) {
            var member = $(fperson[i]);
            var title = member.next('br').next('span.FL_LabelDimmed').text().trim();
            title = title.replace("His", "").replace("Her", "").trim().toLowerCase();
            var url = member.attr("href");
            var itemid = "";
            if (url.contains("#!profile-")) {
                itemid = url.substring(url.indexOf('#!profile-') + 10);
                itemid = itemid.substring(0, itemid.indexOf('-'));
            } else if (url.contains("rootIndivudalID=")) {
                itemid = getParameterByName('rootIndivudalID', url);
            } else {
                itemid = decodeURIComponent(url.substring(url.indexOf('-') + 1));
                itemid = itemid.substring(0, itemid.indexOf('_'));
            }

            if (exists(title)) {
                if (familymembers) {
                    if (isParent(title) || isSibling(title) || isChild(title) || isPartner(title)) {
                        var name = member.text().trim();
                        if (exists(url)) {
                            if (!exists(alldata["family"][title])) {
                                alldata["family"][title] = [];
                            }
                            var subdata = {name: name, title: title};
                            subdata["url"] = url;
                            subdata["itemId"] = itemid;
                            subdata["profile_id"] = famid;
                            if (isParent(title)) {
                                parentlist.push(itemid);
                            } else if (isPartner(title)) {
                                myhspouse.push(famid);
                            }
                            unionurls[famid] = itemid;
                            getMyHeritageFamily(famid, url, subdata);
                            famid++;
                        }
                    }
                } else if (isChild(relation.title)) {
                    if (isParent(title)) {
                        if (focusURLid !== itemid) {
                            childlist[relation.proid] = $.inArray(itemid, unionurls);
                            profiledata["parent_id"] = $.inArray(itemid, unionurls);
                            break;
                        }
                    }
                } else if (isSibling(relation.title)) {
                    if (isParent(title)) {
                        siblingparents.push(itemid);
                    }
                } else if (isPartner(relation.title)) {
                    //marriage data - parse event tab
                } else if (isParent(relation.title)) {
                    //marriage data - parse event tab
                }
            }
        }
    }
    if (exists(relation.title) && isSibling(relation.title) && siblingparents.length > 0) {
        profiledata["halfsibling"] = !recursiveCompare(parentlist, siblingparents);
    }

    profiledata["gender"] = genderval;


    if (aboutdata.trim() !== "") {
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


function getMyHeritageFamily(famid, url, subdata) {
    familystatus.push(famid);
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url,
        variable: subdata
    }, function (response) {
        var arg = response.variable;
        var person = parseMyHeritage(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
        if (person === "") {
            familystatus.pop();
            return;
        }
        person = updateInfoData(person, arg);
        databyid[arg.profile_id] = person;
        alldata["family"][arg.title].push(person);
        familystatus.pop();
    });
}