// Parse WeRelate
function parseWeRelate(htmlstring, familymembers, relation) {
    relation = relation || "";
    var parsed = $(htmlstring.replace(/<img[^>]*>/ig, ""));
    var focusdaterange = "";
    var title = parsed.filter('title').text();

    var focusperson = "";
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;
    var genderval = "unknown";
    var aboutdata = "";
    var profiledata = {};
    var infotable = parsed.find(".wr-infotable").find("tr");
    // ---------------------- Profile Data --------------------

    for (var i=0;i<infotable.length; i++) {
        var cell = $(infotable[i]).find("td");
        var title = cleanHTML($(cell[0]).html().replace(/<sup.*<\/sup>/ig, ""));
        if (title.toLowerCase() === "name") {
            focusperson = $(cell[1]).text();
            document.getElementById("readstatus").innerText = focusperson;
        } else if (title.toLowerCase().startsWith("gender")) {
            genderval = $(cell[1]).text().toLowerCase();
        } else if (title.toLowerCase().startsWith("birth")) {
            profiledata["birth"] = parseRelateDate(cell);
        } else if (title.toLowerCase().startsWith("christening")) {
            profiledata["baptism"] = parseRelateDate(cell);
        } else if (title.toLowerCase().startsWith("death")) {
            profiledata["death"] = parseRelateDate(cell);
        } else if (title.toLowerCase().startsWith("burial")) {
            profiledata["burial"] = parseRelateDate(cell);
        } else if (title.toLowerCase().startsWith("marriage")) {
            //skip
        } else {
            if (cell.length > 1) {
                var aboutstring = "* '''" + title + "''': " + $(cell[1]).text() + ", " + $(cell[2]).text().replace("Citation needed", "") + "\n";
                aboutdata += aboutstring.replace("\n\n", "\n").replace(": ,", ": ").replace("to ", " to ");
            }
        }
    }

    profiledata["name"] = focusperson;
    profiledata["gender"] = genderval;
    profiledata["status"] = relation.title;

    if (familymembers) {
        loadGeniData();
        var famid = 0;
    }

    // ---------------------- Family Data --------------------
    var fperson = parsed.find("span");
    if (familymembers) {
        for (var i = 0; i < fperson.length; i++) {
            if ($(fperson[i]).attr("itemscope") === "") {
                var title = $(fperson[i]).attr("itemprop");
                if (exists(title)) {
                    title = title.replace(/s$/,"");
                    if (isParent(title) || isSibling(title) || isChild(title) || isPartner(title)) {
                        var name = "";
                        var url;
                        var personval = $(fperson[i]).find("meta");
                        for (var x = 0; x < personval.length; x++) {
                            if ($(personval[x]).attr("itemprop") === "name") {
                                name = $(personval[x]).attr("content");
                            } else if ($(personval[x]).attr("itemprop") === "url") {
                                url = $(personval[x]).attr("content");
                            }
                        }
                        if (exists(url)) {
                            if (!exists(alldata["family"][title])) {
                                alldata["family"][title] = [];
                            }
                            var itemid = decodeURIComponent(url.substring(url.lastIndexOf(':') + 1));
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
                            getRelateFamily(famid, url, subdata);
                            famid++;
                        }
                    }
                }
            }
        }
    } else if (isChild(relation.title)) {
        for (var i = 0; i < fperson.length; i++) {
            if ($(fperson[i]).attr("itemscope") === "") {
                var title = $(fperson[i]).attr("itemprop");
                if (exists(title) && isParent(title)) {
                    var url;
                    var personval = $(fperson[i]).find("meta");
                    for (var x = 0; x < personval.length; x++) {
                        if ($(personval[x]).attr("itemprop") === "url") {
                            url = $(personval[x]).attr("content");
                        }
                    }
                    var itemid = decodeURIComponent(url.substring(url.lastIndexOf(':') + 1));
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
        for (var i = 0; i < fperson.length; i++) {
            if ($(fperson[i]).attr("itemscope") === "") {
                var title = $(fperson[i]).attr("itemprop");
                if (exists(title) && isParent(title)) {
                    var url;
                    var personval = $(fperson[i]).find("meta");
                    for (var x = 0; x < personval.length; x++) {
                        if ($(personval[x]).attr("itemprop") === "url") {
                            url = $(personval[x]).attr("content");
                        }
                    }
                    var itemid = decodeURIComponent(url.substring(url.lastIndexOf(':') + 1));
                    siblingparents.push(itemid);
                }
            }
        }
        profiledata["halfsibling"] = !recursiveCompare(parentlist, siblingparents);
    } else if (isPartner(relation.title)) {
        for (var i=0;i<infotable.length; i++) {
            var cell = $(infotable[i]).find("td");
            var title = cleanHTML($(cell[0]).html().replace(/<sup.*<\/sup>/ig, ""));
            if (title.toLowerCase() === "marriage") {
                if (cell.length > 2) {
                    var cellsplit = $(cell[2]).html().split("to ");
                    if (cellsplit.length > 1) {
                        var url = $(cellsplit[1]).attr("href");
                        var itemid = decodeURIComponent(url.substring(url.lastIndexOf(':') + 1));
                        if (itemid === focusURLid) {
                            cell[2].innerHTML = cellsplit[0];
                            var data = parseRelateDate(cell);
                            if (!$.isEmptyObject(data)) {
                                profiledata["marriage"] = data;
                            }
                        }
                    }
                }
            }
        }
    } else if (isParent(relation.title)) {
        if (parentmarriageid === "") {
            parentmarriageid = relation.itemId;
        } else if (relation.itemId !== parentmarriageid) {
            for (var i=0;i<infotable.length; i++) {
                var cell = $(infotable[i]).find("td");
                var title = cleanHTML($(cell[0]).html().replace(/<sup.*<\/sup>/ig, ""));
                if (title.toLowerCase() === "marriage") {
                    if (cell.length > 2) {
                        var cellsplit = $(cell[2]).html().split("to ");
                        if (cellsplit.length > 1) {
                            var url = $(cellsplit[1]).attr("href");
                            var itemid = decodeURIComponent(url.substring(url.lastIndexOf(':') + 1));
                            if (itemid === parentmarriageid) {
                                cell[2].innerHTML = cellsplit[0];
                                var data = parseRelateDate(cell);
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


    // ---------------------- Profile Data --------------------
    if (focusdaterange !== "") {
        profiledata["daterange"] = focusdaterange;
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
        } else if (dd.startsWith("Before Circa") || dd.startsWith("Circa Before")) {
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

    if (aboutdata !== "") {
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

function parseRelateDate(dmatch) {

    var data = [];
    if (exists(dmatch[1])) {
        var dateval = cleanHTML($(dmatch[1]).html()).trim();
        dateval = dateval.replace(/ABT/i, "Circa");
        dateval = dateval.replace(/BEF/i, "Before");
        dateval = dateval.replace(/AFT/i, "After");
        dateval = dateval.replace(/BET/i, "Between");
        dateval = dateval.replace(/BTW/i, "Between");

        if (dateval.contains(" to ")) {
            dateval = dateval.replace(" to ", " and ");
            if (!dateval.startsWith("Between")) {
                dateval = "Between " + dateval;
            }
        } else if (dateval.contains("-")) {
            dateval = dateval.replace("-", " and ");
            if (!dateval.startsWith("Between")) {
                dateval = "Between " + dateval;
            }
        }
        dateval = dateval.replace(/\d{2}\//,"");
        if (dateval !== "") {
            data.push({date: dateval});
        }
    }
    if (exists(dmatch[2])) {
        var eventlocation = cleanHTML($(dmatch[2]).html()).trim();
        if (eventlocation !== "") {
            data.push({id: geoid, location: eventlocation});
            geoid++;
        }
    }
    return data;
}

function getRelateFamily(famid, url, subdata) {
    familystatus.push(famid);
    chrome.extension.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url,
        variable: subdata
    }, function (response) {
        var arg = response.variable;
        var person = parseWeRelate(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
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