registerCollection({
    "reload": false,
    "experimental": true,
    "recordtype": "TNG Genealogy",
    "prepareUrl": function(url) {
        if (!url.contains("getperson.php")) {
            var prefix = url.substring(0, url.lastIndexOf("/"));
            var suffix = url.replace(/.*(\/.*?\.php\?)/ig, "/getperson.php?");
            url = prefix + suffix;
            this.reload = true;
        }
        return url;
    },
    "collectionMatch": function(url) {
        if (url.contains(".php?personID=")) {
            //Checks could be added here to eval the source code
            return true;
        } else {
            return false;
        }
    },
    "parseData": function(url) {
        focusURLid = getTNGItemId(url);
        getPageCode();
    },
    "loadPage": function(request) {
        var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        var language = parsed.find("#newlanguage1 option:selected");
        var tabcheck = parsed.find("#a0").text();
        var tabcheck2 = parsed.find("#a1").text();
        if (language.length > 0 || (tabcheck !== "Individual" && tabcheck2 !== "Ancestors")) {
            if (language.text() !== "English") {
                document.getElementById("top-container").style.display = "block";
                document.getElementById("submitbutton").style.display = "none";
                document.getElementById("loading").style.display = "none";
                document.querySelector('#loginspinner').style.display = "none";
                document.querySelector('#experimentalmessage').style.display = "none";
                setMessage(warningmsg, 'SmartCopy can only read the page in English.  If possible, please change the language of the page.');
                this.parseProfileData = "";
            }
        }
        focusname = getTNGName(parsed);
    },
    "parseProfileData": parseTNG
});

var tngfamid = 0;
function parseTNG(htmlstring, familymembers, relation) {
    relation = relation || "";
    var parsed = $(htmlstring.replace(/<img /ig, "<track "));

    var focusperson = getTNGName(parsed);
    var genderval = getTNGFieldText(parsed, "Gender").toLowerCase();

    $("#readstatus").html(escapeHtml(focusperson));

    var profiledata = {name: focusperson, gender: genderval, status: relation.title};
    var header = parsed.find("h1.header");
    if (exists(header[0])) {
        var img = $(header[0]).prev().find("track").attr("src");
        if (exists(img) && img.startsWith("photo")) {
            var prefix = tablink.substring(0, tablink.lastIndexOf("/"));
            profiledata["thumb"] = prefix + "/" + img;
            if (img.contains("thumb_")) {
                profiledata["image"] = prefix + "/" + img.replace("thumb_", "");
            }
        }
    }

    profiledata["birth"] = parseTNGDate(parsed, "Born");
    profiledata["death"] = parseTNGDate(parsed, "Died");

    var occupation = getTNGFieldText(parsed, "OCCU");
    if (occupation !== "") {
        profiledata["occupation"] = occupation;
    }

    if (checkLiving(focusperson)) {
        profiledata["alive"] = true;
    }
    if (familymembers) {
        loadGeniData();
        var father = getTNGField(parsed, "Father");
        if (exists(father[0])) {
            processTNGFamily(father, "father", tngfamid);
            tngfamid++;
        }

        var mother = getTNGField(parsed, "Mother");
        if (exists(mother[0])) {
            processTNGFamily(mother, "mother", tngfamid);
            tngfamid++;
        }

        var spouses = getTNGField(parsed, "Family");
        if (exists(spouses[0])) {
            for (var i = 0; i < spouses.length; i++) {
                var spouse = spouses[i];
                processTNGFamily(spouse, "spouse", tngfamid);
                tngfamid++;
            }
        }

        var childrensection = getTNGField(parsed, "Children");
        if (exists(childrensection)) {
            var children = childrensection.find("tr span");
            for (var i = 0; i < children.length; i++) {
                var child = children[i];
                processTNGFamily(child, "child", tngfamid);
                tngfamid++;
            }
        }
    } else if (isParent(relation.title)) {
        var childrensection = getTNGField(parsed, "Children");
        if (exists(childrensection)) {
            var children = childrensection.find("tr span");
            for (var i = 0; i < children.length; i++) {
                var child = children[i];
                processTNGFamily(child, "sibling", tngfamid);
                tngfamid++;
            }
        }
        if (parentmarriageid === "") {
            parentmarriageid = relation.itemId;
        } else if (relation.itemId !== parentmarriageid) {
            var spouses = getTNGField(parsed, "Family");
            if (exists(spouses[0])) {
                for (var i = 0; i < spouses.length; i++) {
                    var person = spouses[i];
                    var url = parseTNGURL(person);
                    if (exists(url)) {
                        var pid = getTNGItemId(url);
                        if (pid === parentmarriageid) {
                            var marriageinfo = $(person).closest("tbody");
                            profiledata["marriage"] = parseTNGDate(marriageinfo, "Married");
                            break;
                        }
                    }
                }
            }
        }
    } else if (isChild(relation.title)) {
        var father = getTNGField(parsed, "Father");
        var mother = getTNGField(parsed, "Mother");
        var parents = [];
        if (exists(father[0])) {
            var parent = getTNGItemId(parseTNGURL(father));
            if (parent !== "") {
                parents.push(parent);
            }
        }
        if (exists(mother[0])) {
            var parent = getTNGItemId(parseTNGURL(mother));
            if (parent !== "") {
                parents.push(parent);
            }
        }
        for (var i=0; i<parents.length; i++) {
            var itemid = parents[i];
            if (focusURLid !== itemid) {
                childlist[relation.proid] = $.inArray(itemid, unionurls);
                profiledata["parent_id"] = $.inArray(itemid, unionurls);
                break;
            }
        }
    } else if (isSibling(relation.title)) {
        var siblingparents = [];
        var father = getTNGField(parsed, "Father");
        var mother = getTNGField(parsed, "Mother");
        if (exists(father[0])) {
            var parent = getTNGItemId(parseTNGURL(father));
            if (parent !== "") {
                siblingparents.push(parent);
            }
        }
        if (exists(mother[0])) {
            var parent = getTNGItemId(parseTNGURL(mother));
            if (parent !== "") {
                siblingparents.push(parent);
            }
        }
        if (siblingparents.length > 0) {
            profiledata["halfsibling"] = !recursiveCompare(parentlist, siblingparents);
        }
    }

    if (familymembers) {
        alldata["profile"] = profiledata;
        alldata["scorefactors"] = smscorefactors;
        updateGeo();
    }

    return profiledata;
}


function getTNGField(parsed, name, position) {
    position = position || 1;
    var selector = "td:contains('"+name+"')";
    for (var i = 0; i<position; i++) {
        selector += "+ td";
    }
    var container = parsed.find("ul.nopad");
    if (container.length > 0) {
        var fields = $(container).find(selector);
    } else {
        var fields = parsed.find(selector);
    }
    if (name === "Family") {
        //Exclude rows that start with Family ID
        for (var i = fields.length - 1; i >= 0; i--) {
            var checkid = $(fields[i]).parent().text().trim();
            if (checkid.startsWith("Family ID")) {
                fields.splice(i, 1);
            }
        }
    }
    return fields;
}

function getTNGFieldText(parsed, name, position) {
    var elem = getTNGField(parsed, name, position);
    if (exists(elem)) {
        return elem.text().trim();
    }
    return "";
}

function getTNGName(parsed) {
    var elem = getTNGField(parsed, "Name");
    if (elem.text() !== "") {
        var familyname = elem.find(".family-name").text();
        var givenname = elem.find(".given-name").text();
        return givenname.replace(",", "") + " (" + familyname.replace(",", "") + ")";
    }
    // Less precise, but better than nothing
    var nameheader = removeSources(parsed.find("h1#nameheader").text());
    var header = removeSources(parsed.find("h1.header").text());
    var headfilter = removeSources(parsed.filter("h1.header").text());
    if (nameheader !== "") {
        return tngLastCheck(nameheader);
    } else if (header !== "") {
        return tngLastCheck(header);
    } else if (headfilter !== "") {
        return tngLastCheck(headfilter);
    }
    return "";
}

function tngLastCheck(name) {
    if (name.contains("  ")) {
        //Look for a double space that may separate a two world last name
        var fnamesplit = name.split("  ");
        if (fnamesplit.length === 2) {
            name = fnamesplit[0] + " (" + fnamesplit[1] + ")";
        }
    }
    return name;
}

function removeSources(parsed) {
    if (exists(parsed) && parsed.contains("[")) {
        var splitval = parsed.split("[");
        return splitval[0];
    }
    return parsed;
}

function parseTNGURL(person) {
    var url = $(person).find("a").first().attr("href");
    if (exists(url)) {
        return url;
    }
    return "";
}

function parseTNGDate(parsed, name) {
    var data = [];
    var dateval = cleanDate(getTNGFieldText(parsed, name, 1));
    if (dateval.toLowerCase().startsWith("yes")) {
        return data;
    }
    if (dateval.contains("[")) {
        var datesplit = dateval.split("[");
        dateval = datesplit[0].trim();
    }
    if (dateval !== "") {
        data.push({date: dateval});
    }
    var eventlocation = getTNGFieldText(parsed, name, 2);
    if (eventlocation.contains("[")) {
        var eventsplit= eventlocation.split("[");
        eventlocation = eventsplit[0].trim();
    }
    if (name === "Married" && eventlocation.contains(" - ")) {
        var eventsplit= eventlocation.split(" - ");
        eventlocation = eventsplit[0].trim();
    }
    if (eventlocation !== "") {
        data.push({id: geoid, location: eventlocation});
        geoid++;
    }
    return data;
}

function processTNGFamily(person, title, famid) {
    var url = parseTNGURL(person);
    if (exists(url)) {
        if (!exists(alldata["family"][title])) {
            alldata["family"][title] = [];
        }

        var gendersv = "unknown";
        var name = $(person).find("a").text();
        var itemid = getTNGItemId(url);
        // Get base path
        var basesplit = tablink.split("/");
        basesplit.pop();
        var fullurl = basesplit.join("/") + "/" + url;
        var subdata = {name: name, title: title, gender: gendersv, url: fullurl, itemId: itemid, profile_id: famid};
        if (isSibling(title)) {
            if (itemid !== focusURLid && siblinglist.indexOf(itemid) === -1) {
                siblinglist.push(itemid);
            } else {
                return;
            }
        } else if (isPartner(title)) {
            myhspouse.push(famid);
            // Parse marriage data
            var marriageinfo = $(person).closest("tbody");
            subdata["marriage"] = parseTNGDate(marriageinfo, "Married");
        } else if (isParent(title)) {
            parentlist.push(itemid);
        }

        unionurls[famid] = itemid;
        getTNGFamily(famid, fullurl, subdata);
    }
}

function getTNGFamily(famid, url, subdata) {
    familystatus.push(famid);
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        variable: subdata,
        url: url
    }, function (response) {
        var arg = response.variable;
        var person = parseTNG(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
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

function getTNGItemId(url) {
    if (exists(url) && url !== "") {
        var p = getParameterByName("personID", url);
        var t = getParameterByName("tree", url);
        return "personID="+p+"&tree="+t;
    } else {
        return "";
    }
}
