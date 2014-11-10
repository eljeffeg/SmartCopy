// Parse WikiTree
function parseWikiTree(htmlstring, familymembers, relation) {
    relation = relation || "";
    var parsed = $(htmlstring.replace(/<img/ig,"<gmi"));
    var focusdaterange = "";
    var title = parsed.filter('title').text();
    var focusrangearray = title.match(/\d* - \d*/);
    if (exists(focusrangearray) && focusrangearray.length > 0) {
        focusdaterange = focusrangearray[0].trim();
        if (focusdaterange.endsWith("-")) {
            focusdaterange += " ?";
        }
        if (focusdaterange.startsWith("-")) {
            focusdaterange = "? " + focusrange;
        }
    }

    var personinfo = parsed.find(".VITALS");
    var focusperson = "";
    if (exists(personinfo[0])) {
        focusperson = personinfo[0].innerText.replace(/[\n\r]/g, "").replace(/\s+/g, " ").trim();
        if (focusperson.contains("formerly")) {
            focusperson = focusperson.replace("formerly", "(born") + ")";
        }
    }
    document.getElementById("readstatus").innerText = focusperson;
    var imageflag = false;
    var genderval = "unknown";
    if (htmlstring.contains("http://www.wikitree.com/images/icons/female.gif")) {
        genderval = "female";
    } else if (htmlstring.contains("http://www.wikitree.com/images/icons/female.gif")) {
        genderval = "male";
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
        var imagedata = parsed.find( ".alpha" );
        if (exists(imagedata[0])) {
            var imglink = $(imagedata[0]).find('a');
            var imgthumb = $(imagedata[0]).find('gmi');
            if (exists(imglink[0]) && exists(imgthumb)) {
                var image = $(imglink[0]).attr("href");
                var thumb = $(imgthumb[0]).attr("src");
                image = "http://www.wikitree.com/photo.php/0/00/" + image.replace("/photo/", "");
                thumb = "http://www.wikitree.com/" + thumb;
                profiledata["thumb"] = thumb;
                profiledata["image"] = image;
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
            data = parseWikiEvent($(row).text());
            if (!$.isEmptyObject(data)) {
                profiledata["birth"] = data;
            }
        } else if (rowtitle.startsWith("died")) {
            data = parseWikiEvent($(row).text());
            if (!$.isEmptyObject(data)) {
                if (exists(data.date)) {
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
                        var url = "http://www.wikitree.com" + $(urlset[0]).attr('href');
                        var title = $(urlset[0]).attr('title');
                        var name = $(urlset[0]).text();
                        if (exists(name)) {
                            name = name.replace("(", "(born ");
                        }
                        if (exists(title) && title !== "") {
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
                            familystatus.push(famid);
                            chrome.extension.sendMessage({
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
                if (wikiparentmarriage === "") {
                    wikiparentmarriage = relation.itemId;
                } else if (relation.itemId !== wikiparentmarriage) {
                    var cells = $(row).find("span");
                    for (var i = 0; i < cells.length; i++) {
                        if (exists(cells[i])) {
                            var urlset = $(cells[i]).find('a');
                            if (exists(urlset)) {
                                var title = $(urlset[0]).attr('title');
                                if (exists(title) && isPartner(title)) {
                                    var url = $(urlset[0]).attr('href');
                                    var itemid = url.substring(url.lastIndexOf('/') + 1);
                                    if (itemid === wikiparentmarriage) {
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

    var bio = htmlstring.replace(/(\r\n|\n|\r)/gm,"").match('Biography \<\/span\>\<\/h2\>(.*?)\<a name');

    if (familymembers) {
        if (exists(bio) && bio.length > 1) {
            var atdata = bio[1];
            atdata = atdata.replace(/\<p\>/gi, "");
            atdata = atdata.replace(/\<\/p\>/gi, "\n");
            aboutdata = atdata.trim();
        }
    }


    if (aboutdata !== "") {
        profiledata["about"] = cleanHTML(aboutdata);
        // "\n--------------------\n"  Merge separator
    }

    if (familymembers) {
        alldata["profile"] = profiledata;
        alldata["scorefactors"] = "";
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
        dateval = dateval.replace("about", "Circa");
        dateval = dateval.replace("before", "Before");
        dateval = dateval.replace("after", "After");
        if (dateval.contains(" to ")) {
            dateval = dateval.replace(" to ", " and ");
            dateval = "Between " + dateval;
        }
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