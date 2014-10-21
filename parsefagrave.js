// Parse FindAGrave
function parseFindAGrave(htmlstring, familymembers, relation) {
    relation = relation || "";
    var parsed = $(htmlstring.replace(/<img[^>]*>/ig,""));
    var focusdaterange = "";
    var title = parsed.filter('title').text().replace(" - Find A Grave Memorial", "");
    if (title.contains("(")) {
        splitrange = title.split("(");
        focusdaterange = splitrange[1];
        focusdaterange = focusdaterange.replace(")","").trim();
    }
    var fperson = parsed.find(".plus2").find("b");
    var focusperson = getPersonName(fperson[0].innerHTML);

    document.getElementById("readstatus").innerText = focusperson;
    var genderval = "unknown";

    if (relation === "") {
        if (focusperson.contains("(born")) {
            genderval = "female";
        }
        focusgender = genderval;
    }
    var aboutdata = "";
    var profiledata = {name: focusperson, gender: genderval, status: relation.title};

    if (familymembers) {
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

    var records = parsed.find(".gr");
    var temprecord = $(records[1]).find("tr");
    while(exists(temprecord[0]) && temprecord[0].hasChildNodes()) {
        temprecord = $(temprecord).find("tr");
        if (exists(temprecord[0])) {
            records = temprecord;
        }
    }

    if (records.length > 0 && records[0].hasChildNodes()) {
        var famid = 0;
        // ---------------------- Profile Data --------------------
        if (focusdaterange !== "") {
            profiledata["daterange"] = focusdaterange;
        }
        var children = []; //records[0].childNodes;
        //var child = children[0];
        var rows = records;
        var burialdtflag = false;
        var buriallcflag = false;
        var deathdtflag = false;
        for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            var data = [];
            var data = [];
            if ($(row).text().toLowerCase().trim().startsWith("birth:")) {
                var cells = $(row).find('td');
                var eventinfo = $(cells[1]).html();
                if (eventinfo.contains("<br>")) {
                    var eventsplit = eventinfo.split("<br>");
                    var dateval = eventsplit.shift().replace(".,", "").replace(/&nbsp;/g, " ").replace("  ", " ").trim();
                    if (dateval !== "unknown") {
                        data.push({date: dateval});
                    }
                    var eventlocation = eventsplit.join(", ");
                    data.push({id: geoid, location: eventlocation});
                    geoid++;
                } else {
                    if (eventinfo !== "unknown") {
                        data.push({date: eventinfo});
                    }
                }
                if (!$.isEmptyObject(data)) {
                    profiledata["birth"] = data;
                }
            } else if ($(row).text().toLowerCase().trim().startsWith("death:")) {
                var cells = $(row).find('td');
                var eventinfo = $(cells[1]).html();
                if (eventinfo.contains("<br>")) {
                    var eventsplit = eventinfo.split("<br>");
                    var dateval = eventsplit.shift().replace(".,", "").replace(/&nbsp;/g, " ").replace("  ", " ").trim();
                    if (dateval !== "unknown") {
                        data.push({date: dateval});
                        deathdtflag = true;
                    }
                    var eventlocation = eventsplit.join(", ");
                    data.push({id: geoid, location: eventlocation});
                    geoid++;
                } else {
                    if (eventinfo !== "unknown") {
                        data.push({date: eventinfo});
                        deathdtflag = true;
                    }
                }
                if (!$.isEmptyObject(data)) {
                    profiledata["death"] = data;
                }
            } else if ($(row).text().toLowerCase().trim().startsWith("burial:")) {
                var cells = $(row).find('td');
                var eventlocation = $(cells[0]).html().replace(/burial:/i, "").replace(/&nbsp;/g, "").replace(/<a[^>]*>/ig, "").replace(/<\/a>/,"").trim();
                var eventsplit = eventlocation.replace(/[\n\r]/g, "").split("<br>");
                if (eventsplit.length > 0) {
                    if (eventsplit[0] === "") {
                        eventsplit.shift();
                    }
                    if (eventsplit[eventsplit.length-1].toLowerCase().startsWith("plot")) {
                        eventsplit[0] += " (" + eventsplit.pop() + ")";
                    }
                    eventlocation = eventsplit.join(", ").trim();
                }
                data.push({id: geoid, location: eventlocation});
                geoid++;
                buriallcflag = true;
                profiledata["burial"] = data;
            } else if ($(row).text().toLowerCase().contains("family links:")) {
                // ---------------------- Family Data --------------------
                var cells = $(row).find('td');
                var familysplit = $(cells[0]).html().split(/family links:/i);
                var familylinks = "";
                if (familysplit.length > 1) {
                    var aboutinfo = familysplit[0].replace(/&nbsp;/g, " ").replace(/<br>/g, "\n").trim();
                    if (aboutinfo !== "") {
                        aboutdata += parseWikiURL(aboutinfo) + "\n";
                    }
                    familylinks = familysplit[1];
                } else {
                    familylinks = familysplit[0];
                }
                familysplit = familylinks.split(/Calculated relationship<\/span><\/font>/i);
                if (familysplit.length > 1) {
                    var aboutinfo = familysplit[1].replace(/&nbsp;/g, " ").replace(/<br>/g, "\n").trim();
                    if (aboutinfo !== "") {
                        aboutdata += parseWikiURL(aboutinfo) + "\n";
                    }
                }

                if (familymembers) {
                    familylinks = familylinks.replace(/&nbsp;/g, "").trim().replace(/<br><br><br>/g, '<br>').replace(/<br><br>/g, '<br>');
                    familymem = familylinks.split("<br>");
                    //familylist = [];
                    var title = "";
                    for (var i=0;i<familymem.length;i++) {
                        var titlename = familymem[i].replace(":","").toLowerCase().trim();
                        if (familymem[i].trim() === "") {
                            continue;
                        } else if (familymem[i].startsWith("<script")) {
                            break;
                        } else if (isParent(titlename) || isSibling(titlename) || isChild(titlename) || isPartner(titlename)) {
                            if (titlename === "spouses") {
                                titlename = "spouse";
                            }
                            title = titlename;
                        } else if (title !== "") {
                            var datarow = familymem[i].trim();
                            if (!exists(alldata["family"][title])) {
                                alldata["family"][title] = [];
                            }
                            var nametrim = datarow.replace(/<a[^>]*>/ig,"").replace("</a>", "").trim();
                            if (nametrim.startsWith("<font color=")) {
                                //indicates it is the focus - color #666666
                                continue;
                            }
                            var name = "";
                            var drange = "";
                            if (nametrim.contains("(")) {
                                nameset = nametrim.split("(");
                                name = nameset[0].trim();
                                drange = getPersonName(nameset[1].replace(")", "")).trim();
                            } else {
                                name = nametrim;
                            }
                            name = getPersonName(name);
                            var gendersv = "unknown";
                            if (isFemale(title)) {
                                gendersv = "female";
                            } else if (isMale(title)) {
                                gendersv = "male";
                            } else if (name.contains("(born")) {
                                gendersv = "female";
                            } else if (isPartner(title)) {
                                gendersv = reverseGender(focusgender);
                            }

                            var urlset = datarow.match('href="(.*)"');
                            var url = "";
                            if (exists(urlset) && exists(urlset[1])) {
                                url = "http://www.findagrave.com/cgi-bin/" + urlset[1];
                                familystatus.push(familystatus.length);
                                var subdata = {name: name, gender: gendersv, title: title};
                                var itemid = getParameterByName('GRid', url);
                                subdata["url"] = url;
                                subdata["itemId"] = itemid;
                                subdata["profile_id"] = famid;
                                unionurls[famid] = itemid;
                                chrome.extension.sendMessage({
                                    method: "GET",
                                    action: "xhttp",
                                    url: url,
                                    variable: subdata
                                }, function (response) {
                                    var arg = response.variable;
                                    var person = parseFindAGrave(response.source, false, {"title": arg.title, "proid": arg.profile_id});
                                    person = updateInfoData(person, arg);
                                    databyid[arg.profile_id] = person;
                                    alldata["family"][arg.title].push(person);
                                    familystatus.pop();
                                });
                                if (isPartner(title)) {
                                    myhspouse.push(famid);
                                }
                                famid++;
                            } else {
                                var profile = {name: name, gender: gendersv, profile_id: famid, title: title};
                                if (drange !== "") {
                                    if (drange.contains(" - ")) {
                                        var splitr = drange.trim().split(" - ");
                                        if (splitr[0] !== "?") {
                                            profile["birth"] = [{date: splitr[0]}];
                                        }
                                        if (splitr[1] !== "?") {
                                            profile["death"] = [{date: splitr[1]}];
                                        }
                                    } else if (!isNaN(drange)) {
                                        //need to verify this on FindAGrave
                                        //profile["birth"] = {date: drange.trim()};
                                    }
                                }
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
            } else {
                var cells = $(row).find('td');
                var aboutinfo = $(cells[0]).html().replace(/&nbsp;/g, " ").trim();
                if (aboutinfo !== "" && !aboutinfo.contains("Edit Virtual Cemetery") &&
                    !aboutinfo.contains("Created by:")) {
                    aboutinfo = aboutinfo.replace(/<br>/g, "\n").trim();
                    aboutdata = parseWikiURL(aboutinfo) + "\n";
                }
            }
        }
        if (!burialdtflag && buriallcflag && deathdtflag && $('#burialonoffswitch').prop('checked')) {
            var data = [];
            var dd = profiledata["death"][0]["date"];
            if (dd.startsWith("Between")) {
                var btsplit = dd.split(" and ");
                if (btsplit.length > 1) {
                    dd = btsplit[1];
                }
            }
            if (dd.startsWith("After Circa") || dd.startsWith("Circa After")) {
                dd = dd.trim();
            } else if (dd.startsWith("After")) {
                dd = dd.replace("After", "After Circa").trim();
            } else if (dd.startsWith("Before Circa") || dd.startsWith("Circa Before") ) {
                dd = dd.trim();
            } else if (dd.startsWith("Before")) {
                dd = dd.replace("Before", "Before Circa").trim();
            } else if (dd.startsWith("Circa")) {
                dd = "After " + dd.trim();
            } else if (!dd.startsWith("Between")) {
                dd = "After Circa " + dd.trim();
            }
            if (!dd.startsWith("Between")) {
                data.push({date: dd});
                data.push(profiledata["burial"][0]);
                profiledata["burial"] = data;
            }
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
    }
    parsed = $(htmlstring.replace(/<img/ig,"<gmi"));
    records = parsed.find(".gr");
    if (records.length > 2) {
        temprecord = $(records[2]).find("tr");
    }
    while(exists(temprecord[0]) && temprecord[0].hasChildNodes()) {
        temprecord = $(temprecord).find("tr");
        if (exists(temprecord[0])) {
            records = temprecord;
        }
    }
    if (exists(records[0]) && !$(records[0]).text().contains("Cemetery Photo")) {
        var imagedata = $(records[0]).find("gmi");
        if (exists(imagedata[0])) {
            var thumb = $(imagedata[0]).attr( "src" );
            if (thumb.startsWith("http://image")) {
                var image = thumb.replace("photos250/", "");
                profiledata["thumb"] = thumb;
                profiledata["image"] = image;
            }
        }
    }
    if (familymembers) {
        alldata["profile"] = profiledata;
        alldata["scorefactors"] = "";
        updateGeo();
    }
    return profiledata;
}

function getPersonName(focusperson) {
    var personborn = focusperson.match("\<i\>(.*)\</i\>");
    if (exists(personborn) && exists(personborn[0])) {
        focusperson = focusperson.replace(personborn[0], "");
        focusperson = focusperson + " (born " + personborn[1] + ")";
    }
    focusperson = focusperson.replace(/(<([^>]+)>)/ig, "");
    return focusperson;
}