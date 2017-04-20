// Parse FamilyTreeMaker from Genealogy.com
registerCollection({
    "reload": false,
    "recordtype": "FamilyTreeMaker Genealogy",
    "experimental": true,
    "prepareUrl": function(url) {
        return url;
    },
    "collectionMatch": function(url) {
        return (startsWithHTTP(url, "http://familytreemaker.genealogy.com/") || startsWithHTTP(url, "http://www.genealogy.com/"));
    },
    "parseData": function(url) {
        focusURLid = url.substring(url.lastIndexOf('/') + 1).replace(".html", "");
        if (focusURLid.startsWith("GENE")) {
            document.querySelector('#loginspinner').style.display = "none";
            setMessage(warningmsg, 'FamilyTreeMaker "Descendants of" generation pages are not supported by SmartCopy.');
        } else {
            getPageCode();
        }
    },
    "loadPage": function(request) {
        var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        var fperson = parsed.find("h3");
        var title = $(fperson[0]).text();
        if (title.contains("(")) {
            var splitrange = title.split("(");
            focusname = splitrange[0].trim();
            if (splitrange.length > 2) {
                focusname = focusname + " (" + splitrange[1].trim();
                focusrange = splitrange[2];
            } else {
                focusrange = splitrange[1];
            }
            focusrange = focusrange.replace(")", "").replace(", ", " - ").trim();
        } else {
            focusname = title;
        }
    },
    "parseProfileData": parseFamilyTreeMaker
});

function parseFamilyTreeMaker(htmlstring, familymembers, relation) {
    relation = relation || "";
    var parsed = $(htmlstring.replace(/<img/ig, "<gmi"));
    var fperson = parsed.find("h3");
    var focusperson = "";
    var focusdaterange = "";
    var title = $(fperson[0]).text();
    if (title.contains("(")) {
        var splitrange = title.split("(");
        focusperson = splitrange[0].trim();
        if (splitrange.length > 2) {
            focusperson = focusperson + " (" + splitrange[1].trim();
            focusdaterange = splitrange[2];
        } else {
            focusdaterange = splitrange[1];
        }
        focusdaterange = focusdaterange.replace(")", "").replace(", ", " - ").trim();
        focusdaterange = focusdaterange.replace("date unknown", "?").replace("b. ", "").replace("d. ", "");
    } else {
        focusperson = title;
    }
    var genderval = "unknown";
    var famid = 0;
    var urlroot = tablink.substring(0, tablink.lastIndexOf('/') + 1);
    $("#readstatus").html(escapeHtml(focusperson));
    var profiledata = {};
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;
    var aboutdata = "";

    var fsplit = htmlstring.replace(/<img/ig, "<gmi").split(/<\/h3>/i);
    var fsplit2 = [];
    if (fsplit.length > 1) {
        fsplit2 = fsplit[1].split(/<APPLET/i);
    } else {
        fsplit2 = fsplit;
    }
    var fhtml = fsplit2[0].replace(/<sup.*?<\/sup>/ig, "").replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    fsplit = fhtml.split("Notes for"); //What if Notes don't exist
    var header = fsplit[0];
    var imagetable = header.match(/<td><gmi src.*?<\/td>/i);
    if (exists(imagetable)) {
        var div = $(document.createElement("div"));
        div.html(imagetable[0]);
        var imagedata = $(div).find("gmi");
        if (exists(imagedata[0])) {
            var image = urlroot + $(imagedata[0]).attr( "src" );
            profiledata["thumb"] = image;
            profiledata["image"] = image;
        }
    }
    if (header.contains("(son of") || header.contains("(daughter of")) {
        if (header.contains("(son of")) {
            genderval = "male";
        } else {
            genderval = "female";
        }
        var pinfo = header.match(/\((.*?)<br>/i);

        if (exists(pinfo) && pinfo.length > 1) {
            pinfo = pinfo[1].match(/(.*)\)/);
        }
        if (exists(pinfo) && pinfo.length > 1) {
            var div = $(document.createElement("div"));
            if (pinfo[1].contains("She married")) {
                var pinfosp = pinfo[1].split("She married");
                pinfo[1] = pinfosp[0];
            } else if (pinfo[1].contains("He married")) {
                var pinfosp = pinfo[1].split("He married");
                pinfo[1] = pinfosp[0];
            }
            div.html(pinfo[1]);
            var parents = div.find("a");
            for (var i = 0; i < parents.length; i++) {
                var url = urlroot + $(parents[i]).attr("href");
                var itemid = $(parents[i]).attr("href").replace(".html", "");
                if (exists(url)) {
                    if (familymembers) {
                        var title = "parent";
                        if (!exists(alldata["family"][title])) {
                            alldata["family"][title] = [];
                        }
                        var gendersv = "unknown";
                        var name = $(parents[i]).text();

                        parentlist.push(itemid);
                        var subdata = {name: name, title: title, gender: gendersv, url: url, itemId: itemid, profile_id: famid};
                        unionurls[famid] = itemid;
                        getFamilyTreeMaker(famid, url, subdata);
                        famid++;
                    } else if (isChild(relation.title)) {
                        if (focusURLid !== itemid) {
                            childlist[relation.proid] = $.inArray(itemid, unionurls);
                            profiledata["parent_id"] = $.inArray(itemid, unionurls);
                            break;
                        }
                    }
                }
            }
        }
    }
    if (header.contains("She married") || header.contains("He married")) {
        if (genderval === "unknown") {
            if (header.contains("She married")) {
                genderval = "female";
            } else {
                genderval = "male";
            }
        }
        var mcheck = header.match(/(married.*?)<BR>/i);
        if (exists(mcheck) && mcheck.length > 1) {
            var msplit = mcheck[1].split("married");
            for (var m = 1; msplit.length > m; m++) {
                if (msplit[m].contains(", son of")) {
                    msplit[m] = msplit[m].substring(0, msplit[m].indexOf(", son of"));
                } else if (msplit[m].contains(", daughter of")) {
                    msplit[m] = msplit[m].substring(0, msplit[m].indexOf(", daughter of"));
                }
                var div = $(document.createElement("div"));
                div.html(msplit[m]);
                var spouses = div.find("a");
                for (var i = 0; i < spouses.length; i++) {
                    var url = urlroot + $(spouses[i]).attr("href");
                    var itemid = $(spouses[i]).attr("href").replace(".html", "");
                    if (exists(url)) {
                        if (familymembers) {
                            var title = "spouse";
                            if (!exists(alldata["family"][title])) {
                                alldata["family"][title] = [];
                            }
                            var gendersv = reverseGender(genderval);
                            var name = $(spouses[i]).text();

                            myhspouse.push(famid);
                            var subdata = {name: name, title: title, gender: gendersv, url: url, itemId: itemid, profile_id: famid};
                            unionurls[famid] = itemid;
                            getFamilyTreeMaker(famid, url, subdata);
                            famid++;
                        } else if (isPartner(relation.title)) {
                            if (itemid === focusURLid) {
                                var next = $(spouses[i])[0].nextSibling;
                                if (exists(next)) {
                                    var mdate = next.nodeValue;
                                    var dcheck = mdate.match(/on(.*?)(, and|\.|$)/i);
                                    if (exists(dcheck) && dcheck.length > 1) {
                                        var data = parseFamilyTreeDate(dcheck[1]);
                                        if (!$.isEmptyObject(data)) {
                                            profiledata["marriage"] = data;
                                        }
                                    }
                                }
                            }
                        } else if (isParent(relation.title)) {
                            if (parentmarriageid === "") {
                                parentmarriageid = relation.itemId;
                            } else if (relation.itemId !== parentmarriageid) {
                                var next = $(spouses[i])[0].nextSibling;
                                if (exists(next)) {
                                    var mdate = next.nodeValue;
                                    var dcheck = mdate.match(/on(.*?)(, and|\.|$)/i);
                                    if (exists(dcheck) && dcheck.length > 1) {
                                        var data = parseFamilyTreeDate(dcheck[1]);
                                        if (!$.isEmptyObject(data)) {
                                            profiledata["marriage"] = data;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    profiledata["name"] = focusperson;
    profiledata["gender"] = genderval;
    profiledata["status"] = relation.title;

    if (relation === "") {
        focusgender = genderval;
    }

    if (header.contains("was born")) {
        var dcheck = header.match(/was born(.*?)(, and|\.|$)/);
        if (exists(dcheck) && dcheck.length > 1) {
            var data = parseFamilyTreeDate(dcheck[1]);
            if (!$.isEmptyObject(data)) {
                profiledata["birth"] = data;
            }
        }
    }
    if (header.contains("died")) {
        var dcheck = header.match(/died(.*?)(\.|$)/);
        if (exists(dcheck) && dcheck.length > 1) {
            var data = parseFamilyTreeDate(dcheck[1]);
            if (!$.isEmptyObject(data)) {
                if (exists(getDate(data))) {
                    deathdtflag = true;
                }
                profiledata["death"] = data;
            }
        }
    }

    var hsplit = fhtml.split(/<BR>Children of/i);
    if (hsplit.length > 1) {
        var div = $(document.createElement("div"));
        div.html(hsplit[1]);
        var children = div.find("li");
        for (var i = 0; i < children.length; i++) {
            var child = $(children[i]).find("a");
            var url = urlroot + $(child).attr("href");
            var itemid = $(child).attr("href").replace(".html", "");
            if (exists(url)) {
                if (familymembers) {
                    var title = "child";
                    if (!exists(alldata["family"][title])) {
                        alldata["family"][title] = [];
                    }
                    var gendersv = "unknown";
                    var name = $(child).text();
                    var subdata = {name: name, title: title, gender: gendersv, url: url, itemId: itemid, profile_id: famid};
                    unionurls[famid] = itemid;
                    getFamilyTreeMaker(famid, url, subdata);
                    famid++;
                }
            }
        }
        hsplit = hsplit[0].split(/<BR><BR>More About/i);
    } else {
        hsplit = fhtml.split(/<BR><BR>More About/i);
    }

    if (fsplit.length > 1) {
        //Notes for...
        fsplit2 = fsplit[1].split(/<BR><BR>More About/i);
        fsplit2 = fsplit2[0].split(/<BR><BR>Children of/i);
        fsplit2 = fsplit2[0].split(/<\/li>/i);
        aboutdata += fsplit2[0].replace(/^.*?<br>/i, "").replace(/<br>/ig, "\n").trim();
        aboutdata = cleanHTML(aboutdata.replace("\n\n\n\n\n", ""));
    }

    if (hsplit.length > 1) {
        //More about...
        for (var i = 1; i < hsplit.length; i++) {
            aboutdata += "\n*" + hsplit[i].replace(/<br>/ig, "\n** ");
        }
    }

    if (familymembers) {
        loadGeniData();
    }

    // ---------------------- Profile Data --------------------
    if (focusdaterange !== "") {
        profiledata["daterange"] = focusdaterange;
    }

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

function parseFamilyTreeDate(vitalstring) {
    var data = [];
    var dmatch = vitalstring.replace(/date unknown/ig, "").split(" in ");

    if (exists(dmatch)) {
        var dateval = dmatch[0].trim();
        dateval = cleanDate(dateval);
        if (dateval !== "") {
            data.push({date: dateval});
        }
        if (dmatch.length > 1) {
            var eventlocation = dmatch[1].trim();
            if (eventlocation !== "") {
                data.push({id: geoid, location: eventlocation});
                geoid++;
            }
        }
    }
    return data;
}

function getFamilyTreeMaker(famid, url, subdata) {
    familystatus.push(famid);
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url,
        variable: subdata
    }, function (response) {
        var arg = response.variable;
        var person = parseFamilyTreeMaker(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
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