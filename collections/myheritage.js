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
        return (startsWithMH(url,"person-") || startsWithMH(url,"member-") || startsWithMH(url,"site-family-tree-") || startsWithMH(url,"profile-"));
    },
    "parseData": function(url) {
        if (startsWithHTTP(url,"https://www.myheritage.com/site-family-tree-") && !url.endsWith("-info")) {
            document.querySelector('#loginspinner').style.display = "none";
            setMessage(warningmsg, 'Unable to read in tree view.  Please select the Profile page instead.');
        } else {
            if (url.contains("#!profile-")) {
                focusURLid = url.substring(url.indexOf('#!profile-') + 10);
                focusURLid = focusURLid.substring(0, focusURLid.indexOf('-'));
            } else if (url.contains("/profile-")) {
                focusURLid = url.substring(url.indexOf('/profile-') + 9)
                focusURLid = focusURLid.substring(0, focusURLid.indexOf("/"))
                focusURLid = focusURLid.substring(focusURLid.indexOf('-') + 1); // <Site-Id>-<Profile-Id>
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
            setMessage(warningmsg, 'SmartCopy can work with the various country-based sites of MyHeritage, but you must first sign into the main english website.<br/><a href="https://www.myheritage.com/" target="_blank">Please login to MyHeritage.com</a>');
            this.parseProfileData = "";
            return;
        }
        const parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        const fperson = parsed.find("span.FL_LabelxxLargeBold");
        focusname = fperson.text();
        focusrange = "";
    },
    "parseProfileData": parseMyHeritage
});

function parseMyHeritage(htmlstring, familymembers, relation) {
    relation = relation || "";
    const parsed = $(htmlstring.replace(/<img/ig, "<gmi"));
    // let splitdata = htmlstring.replace(/<img/ig, "<gmi").split("Immediate family");
    // let parsed = $(splitdata[0]);
    // while (splitdata.length > 2) {
    //     splitdata[1] += splitdata.pop();
    // }

    const header = parsed.find("div.profile_page_header");

    const aboutdata = "";
    const profiledata = {};
    const focusdaterange = "";

    let fperson = header.find("div.person_name");

    const focusperson = fperson.text();
    $("#readstatus").html(escapeHtml(focusperson));
    let genderval = "unknown";

    let photo_element = parsed.find(".profile_page_header").find(".person_photo").find(".profile_photo_element.svg_silhouette")
    if (photo_element.length === 1) {
        if (photo_element[0].classList.contains("svg_silhouette_F_A")) {
            genderval = "female";
        } else if (photo_element[0].classList.contains("svg_silhouette_M_A")) {
            genderval = "male";
        }
    }

    if (!genderval) {
        if (focusperson.contains("(born")) {
            genderval = "female";
        } else if (isPartner(relation.title)) {
            genderval = reverseGender(focusgender);
        }
    }

    const photoWrapper = header.find(".profile_photo_wrapper");

    const imagedata = photoWrapper.find(".profile_photo_element.actual_photo");
    if (exists(imagedata[0])) {
        const styleAttribute = $(photoWrapper[0]).attr('style');

        if (exists(styleAttribute[0])) {
            const imglink = styleAttribute.match(/url\((.*?)\)/)[1].replace(/['"]/g, '');
            const thumb = imglink;
            let image = thumb;
            if (!thumb.endsWith("spacer.gif")) {
                if (htmlstring.contains("profilePhotoFullUrl")) {
                    const imgtemp = htmlstring.match(/profilePhotoFullUrl = '(.*?)';/i);
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
    const burialdtflag = false;
    let buriallcflag = false;
    let deathdtflag = false;

    const events = header.find(".events").find(".event")
    const eventsDic = []

    events.each(function(index, element) {
        const label = element.getElementsByClassName("label")[0].textContent.replaceAll(":", "").trim();
        const dateElements = element.getElementsByClassName("date");
        let date = null;
        if (dateElements && dateElements.length > 0) {
            date = dateElements[0].textContent;
        }

        const placeElements = element.getElementsByClassName("place");
        let place = null;
        if (placeElements && placeElements.length > 0) {
            place = placeElements[0].textContent;
        }

        eventsDic.push({label: label, date: date, place: place});
    });

    eventsDic.forEach((value) => {

        let label = value.label.toLowerCase();
        let date = value.date;
        let place = value.place;

        data = [];
        if (exists(date)) {
            if (date.indexOf("(") !== -1) {
                date = date.substring(0, date.indexOf("("));
            }
            date = cleanDate(date);
            if (date !== "") {
                data.push({date: date});
            }
        }
        if (exists(place) && place.length > 0) {
            data.push({id: geoid, location: place});
            geoid++;
        }
        if (label.startsWith("born")) {
            if (!$.isEmptyObject(data)) {
                profiledata["birth"] = data;
            }
        } else if (label.startsWith("died")) {
            if (!$.isEmptyObject(data)) {
                if (exists(getDate(data))) {
                    deathdtflag = true;
                }
                profiledata["death"] = data;
            }
        } else if (label.startsWith("burial")) {
            if (!$.isEmptyObject(data)) {
                if (exists(getLocation(data))) {
                    buriallcflag = true;
                }
                profiledata["burial"] = data;
            }
        } else if (label.startsWith("baptism") || label.startsWith("christening")) {
            if (!$.isEmptyObject(data)) {
                profiledata["baptism"] = data;
            }
        }
    });

    profiledata["name"] = focusperson;
    profiledata["status"] = relation.title;

    if (familymembers) {
        loadGeniData();
        var famid = 0;
    }

    const siblingparents = [];
    const immediateFamily = parsed.find("div.immediate_family");

    if (exists(immediateFamily[0])) {
        // ---------------------- Family Data --------------------
        const relatives = immediateFamily[0].getElementsByClassName("family_relative")

        for (let value of relatives) {
            const name = value.getElementsByClassName("relative_name")[0].textContent.trim();
            const relationship = value.getElementsByClassName("relative_relationship")[0].textContent.replace("His", "").replace("Her", "").trim().toLowerCase();
            const years = value.getElementsByClassName("relative_years")[0].textContent.trim();
            const url = ""; // How to get URLs?
            let itemid;
            if (url.contains("#!profile-")) {
                itemid = url.substring(url.indexOf('#!profile-') + 10);
                itemid = itemid.substring(0, itemid.indexOf('-'));
            } else if (url.contains("rootIndivudalID=")) {
                itemid = getParameterByName('rootIndivudalID', url);
            } else {
                itemid = decodeURIComponent(url.substring(url.indexOf('-') + 1));
                itemid = itemid.substring(focusURLid.indexOf('-') + 1, focusURLid.indexOf('/'))
            }

            if (exists(relationship)) {
                if (familymembers) {
                    if (isParent(relationship) || isSibling(relationship) || isChild(relationship) || isPartner(relationship)) {
                        if (exists(url)) {
                            if (!exists(alldata["family"][relationship])) {
                                alldata["family"][relationship] = [];
                            }
                            const subdata = {name: name, title: relationship};
                            subdata["url"] = url;
                            subdata["itemId"] = itemid;
                            subdata["profile_id"] = famid;
                            if (isParent(relationship)) {
                                parentlist.push(itemid);
                            } else if (isPartner(relationship)) {
                                myhspouse.push(famid);
                            }
                            unionurls[famid] = itemid;
                            getMyHeritageFamily(famid, url, subdata);
                            famid++;
                        }
                    }
                } else if (isChild(relation.title)) {
                    if (isParent(relationship)) {
                        if (focusURLid !== itemid) {
                            childlist[relation.proid] = $.inArray(itemid, unionurls);
                            profiledata["parent_id"] = $.inArray(itemid, unionurls);
                            return;
                        }
                    }
                } else if (isSibling(relation.title)) {
                    if (isParent(relationship)) {
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
        const arg = response.variable;
        let person = parseMyHeritage(response.source, false, {
            "title": arg.title,
            "proid": arg.profile_id,
            "itemId": arg.itemId
        });
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