// Parse WikiTree
registerCollection({
    "reload": false,
    "recordtype": "WikiTree Genealogy",
    "prepareUrl": function(url) {
        if (startsWithHTTP(url,"https://www.wikitree.com/genealogy/")) {
            url = url.replace("genealogy/", "wiki/").replace("-Family-Tree", "");
            this.reload = true;
        }
        return url;
    },
    "collectionMatch": function(url) {
        return (startsWithHTTP(url, "https://www.wikitree.com"));
    },
    "parseData": function(url) {
        focusURLid = url.substring(url.lastIndexOf('/') + 1).replace("-Family-Tree", "");
        getPageCode();
    },
    "loadPage": function(request) {
        var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
        var personinfo = parsed.find(".VITALS");
        var focusperson = "";
        if (exists(personinfo[0])) {
            focusperson = $(personinfo[0]).text().replace(/[\n\r]/g, " ").replace(/\s+/g, " ").trim();
            if (focusperson.contains("formerly")) {
                focusperson = focusperson.replace("formerly", "(born") + ")";
            } else if (focusperson.contains("formerly") && focusperson.contains("[surname unknown]")) {
                focusperson = focusperson.replace("formerly", "").replace("[surname unknown]", "").trim();
            }
            focusname = focusperson;
        }
        var title = parsed.filter('title').text();
        var focusrangearray = title.match(/\d* - \d*/);
        if (exists(focusrangearray) && focusrangearray.length > 0) {
            focusrange = focusrangearray[0].trim();
            if (focusrange.endsWith("-")) {
                focusrange += " ?";
            }
            if (focusrange.startsWith("-")) {
                focusrange = "? " + focusrange;
            }
        }
    },
    "parseProfileData": parseWikiTree
});

function parseWikiTree(htmlstring, familymembers, relation) {
    relation = relation || "";
    var parsed = $(htmlstring.replace(/<img/ig, "<gmi"));
    var focusdaterange = "";
    var title = parsed.filter('title').text();
    var focusrangearray = title.match(/\d* - \d*/);
    if (exists(focusrangearray) && focusrangearray.length > 0) {
        focusdaterange = focusrangearray[0].trim();
        if (focusdaterange.endsWith("-")) {
            focusdaterange += " ?";
        }
        if (focusdaterange.startsWith("-")) {
            focusdaterange = "? " + focusdaterange;
        }
    }

    var personinfo = parsed.find(".VITALS");
    var focusperson = "";
    if (exists(personinfo[0])) {
        $(personinfo[0]).html($(personinfo[0]).html().replace(/<strong>/gi, " "));
        focusperson = $(personinfo[0]).text().replace(/[\n\r]/g, " ").replace(/\s+/g, " ").trim();
        focusperson = focusperson.replace("[family name unknown]", "");
        if (focusperson.contains("formerly") && !focusperson.contains("[surname unknown]")) {
            focusperson = focusperson.replace("formerly", "(born") + ")";
        } else if (focusperson.contains("formerly") && focusperson.contains("[surname unknown]")) {
            focusperson = focusperson.replace("formerly", "").replace("[surname unknown]", "").trim();
        }
    }
    $("#readstatus").html(escapeHtml(focusperson));
    var imageflag = false;
    var genderval = "unknown";
    if (htmlstring.contains("www.wikitree.com/images/icons/female.gif")) {
        genderval = "female";
    } else if (htmlstring.contains("www.wikitree.com/images/icons/female.gif")) {
        genderval = "male";
    } else if (exists(relation.gender) && relation.gender !== "unknown") {
        genderval = relation.gender;
        imageflag = true;
    } else {
        if (relation === "" && focusperson.contains("(born")) {
            genderval = "female";
        }
        imageflag = true;
    }
    if (relation === "") {
        focusgender = genderval;
    }
    var aboutdata = "";
    var profiledata = {name: focusperson, gender: genderval, status: relation.title};
    if (imageflag) {
        var imagedata = parsed.find(".alpha");
        if (exists(imagedata[0])) {
            var imglink = $(imagedata[0]).find('a');
            var imgthumb = $(imagedata[0]).find('gmi');
            if (exists(imglink[0]) && exists(imgthumb)) {
                var thumb = hostDomain(tablink) + $(imgthumb[0]).attr("src");
                var image = thumb.substring(0, thumb.lastIndexOf("/")).replace("thumb/", "");
                profiledata["thumb"] = thumb;
                profiledata["image"] = image;
            }
        }
    } else {
        var imagep = parsed.find("p");
        for (var r = 0; r < imagep.length; r++) {
            if ($(imagep[r]).text().startsWith("Images:")) {
                var imagedata = $(imagep[r]).next('div').find('gmi');
                if (exists(imagedata[0])) {
                    var imgurl = $(imagedata[0]).attr("src");
                    if (exists(imgurl) && imgurl.startsWith("/photo")) {
                        thumb = hostDomain(tablink) + imgurl;
                        if (imgurl.contains("/300px-")) {
                            imgurl = imgurl.substring(0, imgurl.lastIndexOf("/"));
                        }
                        image = hostDomain(tablink) + imgurl.replace("thumb/", "");
                        profiledata["thumb"] = thumb;
                        profiledata["image"] = image;
                        break;
                    }
                }

            }
        }
    }
    if (familymembers) {
        loadGeniData();
        var famid = 0;
    }

    // ---------------------- Profile Data --------------------
    if (focusdaterange !== "") {
        profiledata["daterange"] = focusdaterange;
    }
    var burialdtflag = false;
    var buriallcflag = false;
    var deathdtflag = false;
    for (var r = 1; r < personinfo.length; r++) {
        var row = personinfo[r];
        var data = [];
        var rowtitle = $(row).text().toLowerCase().trim();
        if (rowtitle.startsWith("born")) {
            data = parseWikiEvent($(row).text().replace("Born", ""));
            if (!$.isEmptyObject(data)) {
                profiledata["birth"] = data;
            }
        } else if (rowtitle.startsWith("died")) {
            data = parseWikiEvent($(row).text().replace("Died", ""));
            if (!$.isEmptyObject(data)) {
                if (exists(getDate(data))) {
                    deathdtflag = true;
                }
                profiledata["death"] = data;
            }
        } else if (rowtitle.startsWith("burial:")) {
            //TODO Not sure where this is at yet
            buriallcflag = true;
        } else {
            if (familymembers) {
                // ---------------------- Family Data --------------------

                var cells = $(row).find("span");

                for (var i = 0; i < cells.length; i++) {
                    var urlset = $(cells[i]).find('a');
                    if (exists(urlset)) {
                        var url = hostDomain(tablink) + $(urlset[0]).attr('href');
                        var title = $(cells[i]).attr('itemprop');
                        var name = $(urlset[0]).text();
                        if (exists(name)) {
                            name = name.replace("(", "(born ");
                        }
                        if (exists(title) && title !== "" && title != "name") {
                            if (title.contains(" ")) {
                                title = title.substring(0, title.indexOf(" "));
                            }
                            if (!exists(alldata["family"][title])) {
                                alldata["family"][title] = [];
                            }
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


                            var subdata = {name: name, gender: gendersv, title: title};
                            var itemid = url.substring(url.lastIndexOf('/') + 1);
                            subdata["url"] = url;
                            subdata["itemId"] = itemid;
                            subdata["profile_id"] = famid;
                            unionurls[famid] = itemid;

                            if (isPartner(title)) {
                                myhspouse.push(famid);
                                if (exists(cells[2])) {
                                    data = parseWikiEvent($(cells[2]).text());
                                    if (!$.isEmptyObject(data)) {
                                        subdata["marriage"] = data;
                                    }
                                }
                            }
                            if (isParent(title)) {
                                parentlist.push(itemid);
                            }
                            familystatus.push(famid);
                            chrome.runtime.sendMessage({
                                method: "GET",
                                action: "xhttp",
                                url: url,
                                variable: subdata
                            }, function (response) {
                                var arg = response.variable;
                                var person = parseWikiTree(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
                                if (person === "") {
                                    familystatus.pop();
                                    return;
                                }
                                person = updateInfoData(person, arg);
                                databyid[arg.profile_id] = person;
                                alldata["family"][arg.title].push(person);
                                familystatus.pop();
                            });

                            famid++;
                        }
                    }
                }
            } else if (isParent(relation.title)) {
                if (parentmarriageid === "") {
                    parentmarriageid = relation.itemId;
                } else if (relation.itemId !== parentmarriageid) {
                    var cells = $(row).find("span");
                    for (var i = 0; i < cells.length; i++) {
                        if (exists(cells[i])) {
                            var urlset = $(cells[i]).find('a');
                            if (exists(urlset)) {
                                var title = $(urlset[0]).attr('title');
                                if (exists(title) && isPartner(title)) {
                                    var url = $(urlset[0]).attr('href');
                                    var itemid = url.substring(url.lastIndexOf('/') + 1);
                                    if (itemid === parentmarriageid) {
                                        if (exists(cells[2])) {
                                            data = parseWikiEvent($(cells[2]).text());
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
            } else if (isChild(relation.title)) {
                var cells = $(row).find("span");
                for (var i = 0; i < cells.length; i++) {
                    if (exists(cells[i])) {
                        var urlset = $(cells[i]).find('a');
                        if (exists(urlset)) {
                            var title = $(urlset[0]).attr('title');
                            if (exists(title) && isParent(title)) {
                                var url = $(urlset[0]).attr('href');
                                var itemid = url.substring(url.lastIndexOf('/') + 1);
                                if (focusURLid !== itemid) {
                                    childlist[relation.proid] = $.inArray(itemid, unionurls);
                                    profiledata["parent_id"] = $.inArray(itemid, unionurls);
                                    break;
                                }
                            }
                        }
                    }
                }
            } else if (isSibling(relation.title)) {
                var siblingparents = [];
                var cells = $(row).find("span");
                for (var i = 0; i < cells.length; i++) {
                    if (exists(cells[i])) {
                        var urlset = $(cells[i]).find('a');
                        if (exists(urlset)) {
                            var title = $(urlset[0]).attr('title');
                            if (exists(title) && isParent(title)) {
                                var url = $(urlset[0]).attr('href');
                                var itemid = url.substring(url.lastIndexOf('/') + 1);
                                siblingparents.push(itemid);
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
    if (!burialdtflag && buriallcflag && deathdtflag && $('#burialonoffswitch').prop('checked')) {
        profiledata = checkBurial(profiledata);
    }

    var bio = htmlstring.replace(/(\r\n|\n|\r)/gm, "").match('Biography \<\/span\>\<\/h2\>(.*?)\<a name');

    if (familymembers) {
        if (exists(bio) && bio.length > 1) {
            var atdata = bio[1];
            atdata = atdata.replace(/<sup.*?<\/sup>/ig, "");
            atdata = atdata.replace(/<p>/gi, "");
            atdata = atdata.replace(/<\/p>/gi, "\n");
            if (atdata.contains("<i>")) {
                var splitatdata = atdata.split("<i>");
                atdata = splitatdata[0];
            }
            aboutdata = atdata.trim();
        }
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

function parseWikiEvent(vitalstring) {
    var data = [];
    var vitalinfo = vitalstring.trim().replace("[location unknown]", "").replace("[date unknown]", "");
    var datesplit = vitalinfo.split(" in ");
    if (datesplit.length > 0) {
        var dateval = datesplit[0].trim();
        dateval = cleanDate(dateval);
        if (dateval !== "") {
            data.push({date: dateval});
        }
        if (datesplit.length > 1) {
            var eventlocation = datesplit[1].trim();
            if (eventlocation !== "") {
                data.push({id: geoid, location: eventlocation});
                geoid++;
            }
        }
    }
    return data;
}