registerCollection({
    "recordtype": "Find A Grave Memorial",
    "prepareUrl": function(url) {
        return url;
    },
    "collectionMatch": function(url) {
        return (startsWithHTTP(url, "https://www.findagrave.com") ||
            startsWithHTTP(url, "https://findagrave.com") ||
            startsWithHTTP(url, "https://forum.findagrave.com"));
    },
    "parseData": function(url) {
        if (url.contains("page=gsr")) {
            document.querySelector('#loginspinner').style.display = "none";
            setMessage(warningmsg, 'Please select one of the Matches on this results page.');
        } else {
            focusURLid = getParameterByName('GRid', url);
            getPageCode();
        }
    },
    "loadPage": function(request) {
        var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        var fperson = parsed.find(".plus2").find("b");
        focusname = getFindAGraveName($(fperson[0]).html());
        var title = parsed.filter('title').text().replace(" - Find A Grave Memorial", "");
        if (title.contains("(")) {
            splitrange = title.split("(");
            focusrange = splitrange[1];
            focusrange = focusrange.replace(")", "").trim();
        }
    },
    "parseProfileData": parseFindAGrave
});


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
    if (!exists(fperson[0])) {
        //In case the Memorial has been merged
        fperson = parsed.find(".plus2");
        if (exists(fperson[0]) && $(fperson[0]).html() === "Memorial has been merged.") {
            var click = $(fperson[0]).next('table').find('a');
            var urlset = click[0].outerHTML.match('href="(.*)"');
            var url = "";
            if (exists(urlset) && exists(urlset[1])) {
                url = hostDomain(tablink) + urlset[1];
                familystatus.push(familystatus.length);
                chrome.runtime.sendMessage({
                    method: "GET",
                    action: "xhttp",
                    url: url,
                    variable: relation
                }, function (response) {
                    var arg = response.variable;
                    var person = parseFindAGrave(response.source, familymembers, response.variable);
                    person = updateInfoData(person, arg);
                    databyid[arg.profile_id] = person;
                    alldata["family"][arg.title].push(person);
                    familystatus.pop();
                });
            }
            return "";
        }
    }
    var focusperson = getFindAGraveName($(fperson[0]).html());

    $("#readstatus").html(escapeHtml(focusperson));
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
        loadGeniData();
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
            if ($(row).text().startsWith("Birth:") && $(row).text().contains("Death:")) {
                var temprow = $(row).find("tr");
                if (exists(temprow[0])) {
                    rows = temprow;
                    r = -1;
                    continue;
                }
            }
            if ($(row).text().toLowerCase().contains("family links:")) {
                // ---------------------- Family Data --------------------
                var cells = $(row).find('td');
                var familysplit = $(cells[0]).html().split(/family links:/i);
                var familylinks = "";
                if (familysplit.length > 1) {
                    var aboutinfo = familysplit[0].replace(/&nbsp;/g, " ").replace(/<br>/ig, "\n").trim();
                    if (aboutinfo.trim() !== "") {
                        aboutdata += parseWikiURL(aboutinfo) + "\n";
                    }
                    familylinks = familysplit[1];
                } else {
                    familylinks = familysplit[0];
                }
                familysplit = familylinks.split(/Calculated relationship<\/span><\/font>/i);
                if (familysplit.length > 1) {
                    var aboutinfo = familysplit[1].replace(/&nbsp;/g, " ").replace(/<br>/ig, "\n").trim();
                    if (aboutinfo.trim() !== "" && !aboutinfo.startsWith("<font") && aboutinfo.trim().toLowerCase() !== "note: researching") {
                        aboutdata += parseWikiURL(aboutinfo) + "\n";
                    }
                }
                familylinks = familylinks.replace(/&nbsp;/g, "").trim().replace(/<br><br><br>/ig, '<br>').replace(/<br><br>/ig, '<br>');
                familymem = familylinks.split("<br>");
                var title = "";
                var siblingparents = [];
                for (var i=0;i<familymem.length;i++) {
                    var titlename = familymem[i].replace(":","").toLowerCase().trim();
                    if (familymembers) {
                        if (familymem[i].trim() === "") {
                            continue;
                        } else if (familymem[i].trim().toLowerCase().startsWith("note:") && familymem[i].trim().toLowerCase() !== "note: researching") {
                            aboutdata = aboutdata + parseWikiURL(familymem[i].trim()) + "\n";
                            continue;
                        } else if (familymem[i].startsWith("<script")) {
                            break;
                        } else if (familymem[i].startsWith("Inscription")) {
                            break;
                        } else if (familymem[i].contains("Calculated")) {
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
                            var nametrim = datarow.replace(/<a[^>]*>/ig,"").replace(/<\/a>/ig, "").trim();
                            if (nametrim.startsWith("<font color=")) {
                                //indicates it is the focus - color #666666
                                continue;
                            }
                            var name = "";
                            var drange = "";
                            if (nametrim.contains("(")) {
                                nameset = nametrim.split("(");
                                name = nameset[0].trim();
                                drange = getFindAGraveName(nameset[1].replace(")", "")).trim();
                            } else {
                                name = nametrim;
                            }
                            name = getFindAGraveName(name);
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
                                url = hostDomain(tablink) + "/cgi-bin/" + urlset[1];
                                familystatus.push(familystatus.length);
                                var subdata = {name: name, gender: gendersv, title: title};
                                var itemid = getParameterByName('GRid', url);
                                subdata["url"] = url;
                                subdata["itemId"] = itemid;
                                subdata["profile_id"] = famid;
                                unionurls[famid] = itemid;
                                if (isPartner(title)) {
                                    myhspouse.push(famid);
                                }
                                if (isParent(title)) {
                                    parentlist.push(itemid);
                                }
                                famid++;
                                chrome.runtime.sendMessage({
                                    method: "GET",
                                    action: "xhttp",
                                    url: url,
                                    variable: subdata
                                }, function (response) {
                                    var arg = response.variable;
                                    var person = parseFindAGrave(response.source, false, {"title": arg.title, "proid": arg.profile_id});
                                    if (person === "") {
                                        familystatus.pop();
                                        return;
                                    }
                                    person = updateInfoData(person, arg);
                                    databyid[arg.profile_id] = person;
                                    alldata["family"][arg.title].push(person);
                                    familystatus.pop();
                                });
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
                    } else if (isChild(relation.title) && isParent(titlename)) {
                        i++;
                        for (var i=i;i<familymem.length;i++) {
                            var datarow = familymem[i].trim();
                            if (!datarow.startsWith("<")) {
                                i = familymem.length;
                                break;
                            }
                            var urlset = datarow.match('href="(.*)"');
                            var url = "";
                            if (exists(urlset) && exists(urlset[1])) {
                                url = hostDomain(tablink) + "/cgi-bin/" + urlset[1];
                                var itemid = getParameterByName('GRid', url);
                                if (focusURLid !== itemid) {
                                    childlist[relation.proid] = $.inArray(itemid, unionurls);
                                    profiledata["parent_id"] = $.inArray(itemid, unionurls);
                                    break;
                                }
                            }
                        }
                    } else if (isSibling(relation.title) && isParent(titlename)) {
                        i++;
                        for (var i=i;i<familymem.length;i++) {
                            var datarow = familymem[i].trim();
                            if (!datarow.startsWith("<")) {
                                i = familymem.length;
                                break;
                            }
                            var urlset = datarow.match('href="(.*)"');
                            var url = "";
                            if (exists(urlset) && exists(urlset[1])) {
                                url = hostDomain(tablink) + "/cgi-bin/" + urlset[1];
                                var itemid = getParameterByName('GRid', url);
                                siblingparents.push(itemid);
                            }
                        }
                    }
                }
                if (siblingparents.length > 0) {
                    profiledata["halfsibling"] = !recursiveCompare(parentlist, siblingparents);
                }
            } else if ($(row).text().toLowerCase().trim().startsWith("birth:")) {
                var cells = $(row).find('td');
                var eventinfo = $(cells[1]).html();
                if (exists(eventinfo)) {
                    if (eventinfo.contains("<br>")) {
                        var eventsplit = eventinfo.split("<br>");
                        var dateval = eventsplit.shift().replace(".,", "").replace(/&nbsp;/g, " ").replace("  ", " ").trim();
                        dateval = cleanDate(dateval);
                        if (dateval !== "unknown" && dateval !== "") {
                            data.push({date: dateval});
                        }
                        var eventlocation = eventsplit.join(", ");
                        data.push({id: geoid, location: eventlocation});
                        geoid++;
                    } else if(eventinfo.search(/\d{4}, /) !== -1) {
                        var eventsplit = eventinfo.split(/\d{4}, /);
                        dateval = eventinfo.replace(", " + eventsplit[1], "").replace(".,", "").replace(/&nbsp;/g, " ").replace("  ", " ").trim();
                        var eventlocation = eventsplit[1];
                        dateval = cleanDate(dateval);
                        if (dateval !== "unknown" && dateval !== "") {
                            data.push({date: dateval});
                        }
                        if (exists(eventlocation) && eventlocation !== "") {
                            data.push({id: geoid, location: eventlocation});
                            geoid++;
                        }
                    } else {
                        if (eventinfo !== "unknown") {
                            data.push({date: eventinfo});
                        }
                    }
                    if (!$.isEmptyObject(data)) {
                        profiledata["birth"] = data;
                    }
                }

            } else if ($(row).text().toLowerCase().trim().startsWith("death:")) {
                var cells = $(row).find('td');
                var eventinfo = $(cells[1]).html();
                if (exists(eventinfo)) {
                    if (eventinfo.contains("<br>")) {
                        var eventsplit = eventinfo.split("<br>");
                        var dateval = eventsplit.shift().replace(".,", "").replace(/&nbsp;/g, " ").replace("  ", " ").trim();
                        dateval = cleanDate(dateval);
                        if (dateval !== "unknown" && dateval !== "") {
                            data.push({date: dateval});
                            deathdtflag = true;
                        }
                        var eventlocation = eventsplit.join(", ");
                        data.push({id: geoid, location: eventlocation});
                        geoid++;
                    } else if(eventinfo.search(/\d{4}, /) !== -1) {
                        var eventsplit = eventinfo.split(/\d{4}, /);
                        dateval = eventinfo.replace(", " + eventsplit[1], "").replace(".,", "").replace(/&nbsp;/g, " ").replace("  ", " ").trim();
                        var eventlocation = eventsplit[1];
                        dateval = cleanDate(dateval);
                        if (dateval !== "unknown" && dateval !== "") {
                            data.push({date: dateval});
                            deathdtflag = true;
                        }
                        if (exists(eventlocation) && eventlocation !== "") {
                            data.push({id: geoid, location: eventlocation});
                            geoid++;
                        }
                    } else {
                        if (eventinfo !== "unknown") {
                            data.push({date: eventinfo});
                        }
                    }
                    if (!$.isEmptyObject(data)) {
                        profiledata["death"] = data;
                    }
                }

            } else if ($(row).text().toLowerCase().trim().startsWith("burial:")) {
                var cells = $(row).find('td');
                var eventlocation = $(cells[0]).html().replace(/burial:/i, "").replace(/&nbsp;/g, "").replace(/<a[^>]*>/ig, "").replace(/<\/a>/ig,"").trim();
                var eventsplit = eventlocation.replace(/[\n\r]/g, "").replace(/,/g, "").split("<br>");
                if (eventsplit.length > 0) {
                    if (eventsplit[0] === "") {
                        eventsplit.shift();
                    }
                    if (eventsplit[0].contains("&gt;")) {
                        var fixCRid = eventsplit[0].split("&gt;");
                        eventsplit[0] = fixCRid[fixCRid.length-1];
                    }
                    if (eventsplit[eventsplit.length-1].toLowerCase().startsWith("plot") || eventsplit[eventsplit.length-1].toLowerCase().startsWith("gps")) {
                        if (eventsplit[eventsplit.length-1].toLowerCase().startsWith("gps")) {
                            if (eventsplit[eventsplit.length-2].toLowerCase().startsWith("plot")) {
                                eventsplit[eventsplit.length-2] += " " + eventsplit.pop();
                            }
                        }
                        eventsplit[0] += " (" + eventsplit.pop() + ")";
                    }
                    eventlocation = eventsplit.join(", ").trim();
                }
                data.push({id: geoid, location: eventlocation});
                geoid++;
                buriallcflag = true;
                profiledata["burial"] = data;
            } else {
                var cells = $(row).find('td');
                if (exists(cells[0])) {
                    var aboutinfo = $(cells[0]).html().replace(/&nbsp;/g, " ").trim();
                    if (aboutinfo.trim() !== "" && !aboutinfo.contains("Edit Virtual Cemetery") &&
                        !aboutinfo.contains("Created by:")) {
                        aboutinfo = aboutinfo.replace(/<br>/ig, "\n").trim();
                        aboutdata = aboutdata + parseWikiURL(aboutinfo) + "\n";
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
                    pcount++;
                }
            }
            if (marriagedata.length === 1 && pcount === 1) {
                setmarriage = true;
            }
        }
        if (aboutdata.trim() !== "") {
            profiledata["about"] = cleanHTML(aboutdata);
            // "\n--------------------\n"  Merge separator
        }
    }
    parsed = $(htmlstring.replace(/<img/ig,"<gmi"));
    records = parsed.find(".gr");
    var ri = 2;
    if (records.length > ri) {
        if ($(records[1]).text().trim() === "You are taking a random walk through our online cemetery.") {
            ri++;
        }
        temprecord = $(records[ri]).find("tr");
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
            if (startsWithHTTP(thumb, "http://image") || thumb.contains("find-a-grave-prod/photos")) {
                var image = thumb.replace("photos250/", "");
                profiledata["thumb"] = thumb;
                profiledata["image"] = image;
                var credit = $(records[0]).find(".minus1");
                if (credit.length > 1) {
                    profiledata["imagecredit"] = $(credit[1]).text().trim().replace('"', '').replace("'", "");
                }
            }
        }
    }
    if (familymembers) {
        alldata["profile"] = profiledata;
        alldata["scorefactors"] = smscorefactors;
        updateGeo();
    }
    return profiledata;
}

function getFindAGraveName(focusperson) {
    var personborn = focusperson.match("\<i\>(.*)\</i\>");
    if (exists(personborn) && exists(personborn[0])) {
        focusperson = focusperson.replace(personborn[0], "");
        focusperson = focusperson + " (born " + personborn[1] + ")";
    }
    focusperson = focusperson.replace(/(<([^>]+)>)/ig, "");
    return focusperson;
}
