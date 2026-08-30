var alldata = {};
alldata["family"] = {};
var geostatus = [];
var geoid = 0;
var geolocation = [];
var parsecomplete = false;
var unionurls = [];
var databyid = [];
var childlist = [];
var marriagedata = [];
var parentmarset = [];
var parentmarriage;
var parentlist = [];
var parentflag = false;
var genispouse = [];
var myhspouse = [];
var focusabout = "";
var focusnicknames = "";
var parentmarriageid = "";
var geounique = [];
var geocleanup = [];
var datelimit = 1600;

function updateGeo() {
    if (familystatus.length > 0) {
        setTimeout(updateGeo, 50);
    } else if (!captcha) {
        var values = [];
        console.log("Family Processed...");
        $("#readstatus").html("Determining Locations");
        var listvalues = ["birth", "baptism", "marriage", "divorce", "death", "burial"];
        // #224: resolved once for the focus profile - genifocusdata is
        // already loaded by this point (set well before updateGeo() ever
        // runs, from the currently-open Geni page itself), unlike a family
        // member's match, which isn't known until later. focusFsYears.birth
        // also gets reused below as the "focusRealYear" input to a
        // partner-category family member's own Rule 1 spousal estimate.
        var focusFsYears = resolveFsLookupYears(alldata["profile"], function (t, p) { return genifocusdata.get(t, p); }, "focus", undefined);
        for (var list in listvalues) if (listvalues.hasOwnProperty(list)) {
            var title = listvalues[list];
            var memberobj = alldata["profile"][title];
            if (exists(memberobj)) {
                for (var item in memberobj) if (memberobj.hasOwnProperty(item)) {
                    if (memberobj[item].location !== undefined) {
                        attachDateForFsLookup(memberobj, memberobj[item], title === "burial" ? alldata["profile"]["death"] : undefined);
                        applyFsLookupYearFallback(memberobj[item], focusFsYears[title]);
                    }
                    if (memberobj[item].location !== undefined && !values.includes(getGeoDedupKey(memberobj[item]))) {
                        values.push(getGeoDedupKey(memberobj[item]));
                        geounique.push(memberobj[item]);
                    } else if (memberobj[item].location !== undefined) {
                        geocleanup.push(memberobj[item]);
                    } else {
                        geounique.push(memberobj[item]);
                    }
                }
            }
        }
        if (locationtest) {
            $.get('location-test.txt', function (data) {
                var lines = data.split("\n");
                $.each(lines, function (n, location) {
                    if (location !== "" && !location.startsWith("#")) {
                        var splitloc = location.split("|");
                        var locationset = {id: geoid, location: splitloc[0]};
                        queryGeo(locationset, splitloc[1]);
                        geoid++;
                    }
                });
            });
        }

        var obj = alldata["family"];

        for (var relationship in obj) if (obj.hasOwnProperty(relationship)) {
            var members = obj[relationship];

            for (var member in members) if (members.hasOwnProperty(member)) {
                // #224: resolved once per family member. getMatchedGeniFamilyCandidate()
                // is the same pure lookup buildAction() will use one render step
                // later to auto-select the "Update: <name>" dropdown match - safe
                // to call this early since it only reads already-loaded
                // genifamilydata, not anything computed during render. No match
                // found -> memberGeniGetter stays undefined -> resolveFsLookupYears()
                // just skips that one tier, degrading to scrape/estimate only.
                var memberNameval = NameParse.parse(members[member].name, mnameonoff);
                var memberCandidate = getMatchedGeniFamilyCandidate(relationship, members[member].gender, memberNameval, undefined);
                var memberGeniGetter = exists(memberCandidate) ? function (t, p) { return memberCandidate.get(t, p); } : undefined;
                var memberFsYears = resolveFsLookupYears(members[member], memberGeniGetter, relationship, members[member], focusFsYears.birth);
                for (var list in listvalues) if (listvalues.hasOwnProperty(list)) {
                    var title = listvalues[list];

                    var memberobj = members[member][title];
                    if (exists(memberobj)) {
                        for (var item in memberobj) if (memberobj.hasOwnProperty(item)) {
                            if (memberobj[item].location !== undefined) {
                                attachDateForFsLookup(memberobj, memberobj[item], title === "burial" ? members[member]["death"] : undefined);
                                applyFsLookupYearFallback(memberobj[item], memberFsYears[title]);
                            }
                            if (memberobj[item].location !== undefined && !values.includes(getGeoDedupKey(memberobj[item]))) {
                                values.push(getGeoDedupKey(memberobj[item]));
                                geounique.push(memberobj[item]);
                            } else if (memberobj[item].location !== undefined) {
                                geocleanup.push(memberobj[item]);
                            } else {
                                geounique.push(memberobj[item]);
                            }
                        }
                    }
                }
            }
        }
        for (var i=0; i<geounique.length; i++) {
            queryGeo(geounique[i]);
        }
        updateFamily();
    }
}

function updateFamily() {
    
    if (geostatus.length > 0) {
        setTimeout(updateFamily, 50);
    } else {
        //console.log(geounique);
        for (var i=0; i < geocleanup.length; i++) {
            for (var x=0; x < geounique.length; x++) {
                if (getGeoDedupKey(geocleanup[i]) === getGeoDedupKey(geounique[x])) {
                    geolocation[geocleanup[i].id] = geolocation[geounique[x].id];
                    //console.log("Adding " + geounique[x].id + " to " + geocleanup[i].id);
                    //console.log(geocleanup[i].location);
                    continue;
                }
            }
        }
        //console.log(geolocation);
        console.log("Geo Processed...");
        $("#readstatus").html("");
        updateGenders();
        buildForm();
        document.getElementById("loading").style.display = "none";
    }
}

function updateGeoLocation() {
    if (geostatus.length > 0) {
        setTimeout(updateGeoLocation, 50);
    } else {
        var locationdata = geolocation[geoid-1];
        var eventrow = $('#'+googlerequery);
        var pincolor = "clear";
        if (locationdata.ambiguous || locationdata.count > 1) {
            pincolor = "yellow";
        } else if (locationdata.count === 0) {
            pincolor = "red";
        }
        var geoon = $($(eventrow.closest("tr")[0]).find("img")[0]).attr("src") === "images/geoon.png";
        var titleobj = $($(eventrow.closest("tr")[0]).find("img")[2]);
        titleobj.attr("src", "images/" + pincolor + "pin.png");
        var ptable = eventrow.closest("table");
        if (exists(ptable[0].id) && ptable[0].id !== "profiletable") {
            var tableid = ptable[0].id.replace("familytable_", "");
            var geocheck = $(ptable).find(".geopin");
            var red = false;
            var yellow = false;
            for (var i = 0; i < geocheck.length; i++) {
                var link = $(geocheck[i]).attr('src');
                if (link.contains("redpin")) {
                    red = true;
                } else if (link.contains("yellowpin")) {
                    yellow = true;
                }
            }
            if (red) {
                $("#" + tableid + "gpin").attr("src", "images/redpin.png");
                $("#" + tableid + "gpin").attr("title", "Location lookup failed");
            } else if (yellow) {
                $("#" + tableid + "gpin").attr("src", "images/yellowpin.png");
                $("#" + tableid + "gpin").attr("title", "Location lookup may be incorrect");
            } else {
                $("#" + tableid + "gpin").attr("src", "images/clearpin.png");
                $("#" + tableid + "gpin").attr("title", "");
            }
        }
        var globalloc = $('#forcegeoswitch').prop('checked');
        if (globalloc) {
            $($($(eventrow).closest("tr")[0]).find("input[type=checkbox]")[0]).prop("checked", true);
        }
        var titlesplit = titleobj[0].nextSibling.nodeValue.split("Location: ");
        titleobj[0].nextSibling.nodeValue = titlesplit[0] + "Location: " + locationdata.query;
        eventrow = $(eventrow).closest("tr")[0].nextElementSibling;
        $(eventrow).find("input[type=text]")[0].value = locationdata.query;
        $($(eventrow).find("input[type=checkbox]")[0]).prop("checked", geoon).trigger("click");
        // Live-reported: Place/City/County/State/Country/Latitude/Longitude
        // below used to stay UNCHECKED whenever their own resolved value
        // came back blank (the usual "don't auto-check a blank, might
        // silently clear real Geni data" protection) - but this function
        // only ever runs after the user explicitly clicked "Update
        // Location" and typed a correction, an already-explicit action,
        // not a passive render. A field that resolves blank after that
        // correction (e.g. Place, once City/County/State fully account for
        // everything) needs to be submitted as blank too, or a stale prior
        // value is left behind unchecked and never actually cleared. So
        // every field this walks is checked whenever geo parsing applies
        // to this row (geoon) at all, regardless of its own value.
        eventrow = $(eventrow).closest("tr")[0].nextElementSibling;
        $(eventrow).find("input[type=text]")[0].value = locationdata.place;
        $($(eventrow).find("input[type=checkbox]")[0]).prop("checked", !geoon).trigger("click");
        eventrow = $(eventrow).closest("tr")[0].nextElementSibling;
        $(eventrow).find("input[type=text]")[0].value = locationdata.city;
        $($(eventrow).find("input[type=checkbox]")[0]).prop("checked", !geoon).trigger("click");
        eventrow = $(eventrow).closest("tr")[0].nextElementSibling;
        $(eventrow).find("input[type=text]")[0].value = locationdata.county;
        $($(eventrow).find("input[type=checkbox]")[0]).prop("checked", !geoon).trigger("click");
        eventrow = $(eventrow).closest("tr")[0].nextElementSibling;
        $(eventrow).find("input[type=text]")[0].value = locationdata.state;
        $($(eventrow).find("input[type=checkbox]")[0]).prop("checked", !geoon).trigger("click");
        eventrow = $(eventrow).closest("tr")[0].nextElementSibling;
        $(eventrow).find("input[type=text]")[0].value = locationdata.country;
        $($(eventrow).find("input[type=checkbox]")[0]).prop("checked", !geoon).trigger("click");
        // #229 follow-up (found during a full-codebase re-audit): this is
        // the same row-count-drift bug already fixed once in .geotopcheck
        // (0a48a3a) and once in .geoicon (this same audit pass) - a manual
        // "Update Location" re-query (the #geolookupbtn/GeoUpdateModal
        // flow above) re-resolved Latitude/Longitude via the fresh
        // queryGeo() call along with everything else, but this function
        // stopped walking rows after Country and never wrote the new
        // coordinates back - leaving the ORIGINAL (possibly wrong -
        // correcting a bad/ambiguous match is exactly why someone uses
        // this modal) latitude/longitude silently stuck in the form.
        eventrow = $(eventrow).closest("tr")[0].nextElementSibling;
        $(eventrow).find("input[type=text]")[0].value = locationdata.latitude;
        $($(eventrow).find("input[type=checkbox]")[0]).prop("checked", !geoon).trigger("click");
        eventrow = $(eventrow).closest("tr")[0].nextElementSibling;
        $(eventrow).find("input[type=text]")[0].value = locationdata.longitude;
        $($(eventrow).find("input[type=checkbox]")[0]).prop("checked", !geoon).trigger("click");
        $("body").toggleClass("wait");
    }
}

function updateGenders() {
    var obj = alldata["family"];
    var parentgender;
    var spousegender;
    for (var relationship in obj) if (obj.hasOwnProperty(relationship)) {
        if (isParent(relationship)) {
            parentgender = obj[relationship];
        } else if (isPartner(relationship)) {
            spousegender = obj[relationship];
        }
    }
    if (exists(parentgender) && parentgender.length > 1) {
        if (parentgender[0].gender === "unknown" && parentgender[1].gender !== "unknown") {
            parentgender[0].gender = reverseGender(parentgender[1].gender);
        } else if (parentgender[1].gender === "unknown" && parentgender[0].gender !== "unknown") {
            parentgender[1].gender = reverseGender(parentgender[0].gender);
        }
    }
    if (focusgender === "unknown" && exists(spousegender) && spousegender.length > 0) {
        if (spousegender[0].gender !== "unknown") {
            focusgender = reverseGender(spousegender[0].gender);
        }
    }
}

function reverseGender(gender) {
    if (gender === "female") {
        return "male";
    } else if (gender === "male") {
        return "female";
    }
    return "unknown";
}

// #78 follow-up: a field the current user simply lacks permission to save
// must be disabled the same way a Geni-side field lock is - the two have
// identical consequences (this edit can never take effect) even though the
// cause is different. update-basics is the narrower, basics-only grant;
// "update" is a broader permission that implies it (see buildTree()'s own
// "update" -> "update-basics" downgrade fallback in popup.js) - either one
// is sufficient to edit the fields this covers.
function focusFieldLocked(path, subpath) {
    var actions = genifocusdata.get("actions");
    var canEditBasics = exists(actions) && (actions.indexOf("update-basics") !== -1 || actions.indexOf("update") !== -1);
    return genifocusdata.isLocked(path, subpath) || !canEditBasics;
}

function buildForm() {
    var obj;
    var listvalues = ["birth", "baptism", "death", "burial"];
    var scorefactors = alldata["scorefactors"];
    var hidden = $('#hideemptyonoffswitch').prop('checked');
    var x = 0;
    var ck = 0;
    var div = $("#profiletable");
    var membersstring = $(div[0]).html();
    var nameval = NameParse.parse(focusname, mnameonoff);
    if (focusgender === "unknown" && alldata["profile"].gender !== "unknown") {
        focusgender = alldata["profile"].gender;
    }
    // focusLastNameConfirmedMaiden: setBirthName() returns false specifically
    // when nameval.lastName already exactly matches a scraped father's
    // surname - the common "source lists her under her maiden name" case -
    // and deliberately leaves lastName untouched (non-blank) rather than
    // clearing it, since as far as this base feature is concerned there's
    // nothing to move. The #204 block below still needs to know this
    // happened, since a confirmed maiden-name match is exactly the case it
    // should override, even though lastName isn't blank.
    var focusLastNameConfirmedMaiden = false;
    if ($('#birthonoffswitch').prop('checked') && nameval.birthName === "") {
        if (focusgender === "male") {
            nameval.birthName = nameval.lastName;
        } else if (focusgender === "female") {
            if (isCompoundSurname(nameval.lastName)) {
                // #206: a compound surname is already-complete - copy it to
                // Birth Name (same as the male case above) but never clear
                // Last Name or treat it as a confirmed maiden name below.
                nameval.birthName = nameval.lastName;
            } else if (setBirthName("focus", nameval.lastName, mnameonoff)) {
                nameval.birthName = nameval.lastName;
                nameval.lastName = "";
            } else {
                focusLastNameConfirmedMaiden = true;
            }
        }
    }
    // #204: symmetric with the family-member direction below - a female
    // focus person's Last Name gets auto-filled from her spouse's surname
    // too, when there's exactly one spouse. Fires when nameval.lastName is
    // blank (nothing scraped) OR confirmed-maiden (matches her scraped
    // father, per focusLastNameConfirmedMaiden above) - deliberately NOT for
    // any other non-blank value, since some genealogical naming conventions
    // (e.g. Mexican civil-registry names, which are always the birth
    // compound surname and never legally change at marriage) will correctly
    // yield a non-blank, non-father-matching scraped Last Name here, and
    // guessing over it would replace a correct birth surname with a guessed
    // married one. Gated behind its own toggle (#marriednameonoffswitch, on
    // by default) in addition to the existing birthonoffswitch check - this
    // feature is strictly more speculative than the base maiden-name-move it
    // builds on (it derives/guesses a value, not just relocates an existing
    // one), so a user can keep the base feature while opting out of just
    // this.
    if ($('#birthonoffswitch').prop('checked') && $('#marriednameonoffswitch').prop('checked') && focusgender === "female" && (nameval.lastName === "" || focusLastNameConfirmedMaiden)) {
        var focusSpouseSurname = getFocusSpouseSurname(mnameonoff);
        if (focusSpouseSurname !== "" && focusSpouseSurname !== nameval.lastName) {
            if (nameval.birthName === "") {
                nameval.birthName = nameval.lastName;
            }
            nameval.lastName = focusSpouseSurname;
        }
    }
    if (exists(alldata["profile"].nicknames)) {
        if (nameval.nickName !== "") {
            nameval.nickName += ",";
        }
        nameval.nickName += alldata["profile"].nicknames;
    }
    var displayname = "";
    if (nameval.prefix !== "") {
        //Deprecated due to title field
        //displayname = nameval.displayname;
    }

    var nameimage = genifocusdata.lockIcon("name");
    var namelocked = focusFieldLocked("name"); // #78
    var namescore = scorefactors.contains("middle name");
    let namelang = genifocusdata.get("name_language");
    let langtarget = Object.assign({}, $("#language_selector"));
    $(langtarget).find("select").attr("id","profilelanguage");
    let regex = new RegExp('value="' + namelang + '">',"gm");
    membersstring += '<tr><td colspan="2"></td><td>' + $(langtarget).html().replace(regex, "value='" + namelang + "' selected>"); + '</td></tr>'
    var expand = true;
    if (exists(alldata["profile"]["birth"]) && exists(alldata["profile"]["birth"][0]) && exists(alldata["profile"]["birth"][0]["date"])) {
        var dt = moment(alldata["profile"]["birth"][0]["date"], getDateFormat(alldata["profile"]["birth"][0]["date"]));
        var year = dt.get('year');
        if (year < datelimit) {
            expand = false;
            
        }
    } else if (exists(alldata["profile"]["death"]) && exists(alldata["profile"]["death"][0]) && exists(alldata["profile"]["death"][0]["date"])) {
        var dt = moment(alldata["profile"]["death"][0]["date"], getDateFormat(alldata["profile"]["death"][0]["date"]));
        var year = dt.get('year');
        if (year < datelimit) {
            expand = false;
        }
    }
    if (expand) {
        // #219/#220: First and Last Name always render visible - they're
        // the two fields worth seeing at a glance regardless of "Hide
        // Empty Fields," and the true minimum view when nothing else
        // scores. The other six (Title, Middle Name, Birth Name, Suffix,
        // Display Name, Nicknames) are genuinely secondary - they go back
        // to respecting Hide Empty Fields like Occupation/Gender/dates
        // already do, hidden by default, one eyeball click away. x (the
        // "is there anything real to show" panel-visibility signal) still
        // counts this block whenever ANY of the 8 fields has real data -
        // independent of namescore, which only reflects whether middle
        // name specifically happened to be a SmartMatch factor and has no
        // bearing on whether there's real name data at all. namescore &&
        // mnameonoff keeps its original, narrower job: only deciding
        // whether Middle Name itself defaults to checked+enabled.
        var hasNameData = isValue(nameval.prefix) || isValue(nameval.firstName) || isValue(nameval.middleName) ||
            isValue(nameval.lastName) || isValue(nameval.birthName) || isValue(nameval.suffix) ||
            isValue(displayname) || isValue(nameval.nickName);
        var middleNameChecked = (namescore && mnameonoff) ? "checked" : "";
        var middleNameEnabled = (namescore && mnameonoff) ? "" : "disabled";
        // #210: each row now goes through buildTextFieldRow(), which
        // escapes the scraped value before it reaches the value="..."
        // attribute - previously none of these did (the same fix
        // already applied to the family-member equivalent rows).
        // #222: each secondary field now gets its OWN content-aware
        // hiddenRowAttrs() (a populated Title stays visible even while
        // "closed"; a blank Suffix collapses) instead of one shared
        // secondaryNameRowAttrs string applied uniformly regardless of
        // which of these six fields actually has data.
        membersstring +=
            buildTextFieldRow("Title:", "title", nameval.prefix, "", "disabled", "focus_geni_title", null, genifocusdata.get("names", namelang + ".title"), nameimage, ' ' + hiddenRowAttrs(hidden, isValue(nameval.prefix)), namelocked) +
            buildTextFieldRow("First Name:", "first_name", nameval.firstName, "", "disabled", "focus_geni_first_name", null, genifocusdata.get("names", namelang + ".first_name"), nameimage, undefined, namelocked) +
            buildTextFieldRow("Middle Name:", "middle_name", nameval.middleName, middleNameChecked, middleNameEnabled, "focus_geni_middle_name", null, genifocusdata.get("names", namelang + ".middle_name"), nameimage, ' ' + hiddenRowAttrs(hidden, isValue(nameval.middleName)), namelocked) +
            buildTextFieldRow("Last Name:", "last_name", nameval.lastName, "", "disabled", "focus_geni_last_name", null, genifocusdata.get("names", namelang + ".last_name"), nameimage, undefined, namelocked) +
            buildTextFieldRow("Birth Name:", "maiden_name", nameval.birthName, "", "disabled", "focus_geni_maiden_name", null, genifocusdata.get("names", namelang + ".maiden_name"), nameimage, ' ' + hiddenRowAttrs(hidden, isValue(nameval.birthName)), namelocked) +
            buildTextFieldRow("Suffix: ", "suffix", nameval.suffix, "", "disabled", "focus_geni_suffix", null, genifocusdata.get("names", namelang + ".suffix"), nameimage, ' ' + hiddenRowAttrs(hidden, isValue(nameval.suffix)), namelocked) +
            buildTextFieldRow("Display Name: ", "display_name", displayname, "", "disabled", "focus_geni_display_name", null, genifocusdata.get("names", namelang + ".display_name"), nameimage, ' ' + hiddenRowAttrs(hidden, isValue(displayname)), namelocked) +
            buildTextFieldRow("Also Known As: ", "nicknames", nameval.nickName, "", "disabled", "focus_geni_nicknames", null, genifocusdata.get("nicknames"), "append.png", ' ' + hiddenRowAttrs(hidden, isValue(nameval.nickName)));
        if (hasNameData) {
            x += 1;
        }
        $(div[0]).html(membersstring);
        if (exists(alldata["profile"]["thumb"])) {
            membersstring = $(div[0]).html();
            if (x > 0) {
                membersstring = membersstring + '<tr><td colspan="3" style="padding: 0;"><div class="separator"></div></td></tr>';
            } else {
                membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td colspan="3" style="padding: 0;"><div class="separator"></div></td></tr>';
            }
            var title = "photo";
            var scorephoto = false;
            if (scorefactors.contains(title) && $('#photoonoffswitch').prop('checked')) {
                scorephoto = true;
                ck++;
            }
            x += 1;
            var thumbnail = alldata["profile"]["thumb"];
            var image = alldata["profile"]["image"];
            if (Object.getOwnPropertyNames(fsimage).length > 0) {
                for (var imgurl in fsimage) {
                    if (imgurl == thumbnail) {
                        thumbnail = fsimage[imgurl];
                        image = thumbnail;
                        break;
                    }
                }
            }
            var credit = alldata["profile"]["imagecredit"] || "";
            membersstring = membersstring +
                '<tr id="photo"><td class="profilediv"><input type="checkbox" class="checknext photocheck" ' + isChecked(thumbnail, scorephoto) + '>' +
                capFL(title) + ':</td><td style="padding: 0;"><div style="float: right;"><input type="hidden" class="photocheck" name="' + title + '" value="' + image + '" ' + isEnabled(thumbnail, scorephoto) + ' author="' + credit + '"><img style="max-width: 150px; max-height: 120px; object-fit: contain; padding: 0px;" src="' + thumbnail + '"></div></td><td class="genisliderow" style="vertical-align: middle; padding: 0;"><div style="display: inline-block; vertical-align: middle; padding: 0;"><img src="' + isAppend(genifocusdata.get("photo_urls")) + '" class="genislideimage" style="padding-left: 5px;"></div><div style="display: inline-block; vertical-align: middle; padding: 0;"><img align="right" style="max-width: 150px; max-height: 120px; object-fit: contain; padding: 0px;" src="' + genifocusdata.get("photo_urls") + '"></div></td></tr>';
            membersstring = membersstring + '<tr><td colspan="3" style="padding: 0;"><div class="separator"></div></td></tr>';
            $(div[0]).html(membersstring);
        }

        var sepx = 0;
        if (exists(alldata["profile"]["occupation"])) {
            membersstring = $(div[0]).html();
            sepx++;
            var title = "occupation";
            var scoreoccupation = false;
            if (scorefactors.contains(title)) {
                scoreoccupation = true;
                ck++;
            }
            var occupation = alldata["profile"]["occupation"].trim();
            var occlocked = focusFieldLocked("occupation"); // #78
            membersstring = membersstring +
                '<tr id="occupation"><td class="profilediv"><input type="checkbox" class="checknext" ' + (occlocked ? 'disabled ' : '') + isChecked(occupation, scoreoccupation, false, genifocusdata.get("occupation"), occlocked) + '>' +
                capFL(title) + ': </td><td style="float:right; padding: 0;"><input type="text" class="formtext" name="' + title + '" value="' + occupation + '" ' + isEnabled(occupation, scoreoccupation, false, genifocusdata.get("occupation"), occlocked) + '></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("occupation") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("occupation") + '" disabled></td></tr>';
            $(div[0]).html(membersstring);
        } else {
            membersstring = $(div[0]).html();
            membersstring = membersstring +
                '<tr ' + hiddenRowAttrs(hidden, false) + ' id="occupation"><td class="profilediv"><input type="checkbox" class="checknext"' + (focusFieldLocked("occupation") ? ' disabled' : '') + '>Occupation: </td><td style="float:right; padding: 0;"><input type="text" class="formtext" name="occupation" disabled></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("occupation") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("occupation") + '" disabled></td></tr>';
            $(div[0]).html(membersstring);
        }
        var genderlocked = focusFieldLocked("gender"); // #78
        if (genigender === "unknown" && focusgender !== "unknown") {
            var gender = focusgender;
            sepx++;
            membersstring = $(div[0]).html();
            membersstring = membersstring + '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + (genderlocked ? 'disabled ' : '') + isChecked(gender, true, false, undefined, genderlocked) + '>Gender: </td><td style="float:right; padding: 0;"><select class="formselect" style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="gender" ' + isEnabled(gender, true, false, undefined, genderlocked) + '>' +
                '<option value="male" ' + setGender("male", gender) + '>Male</option><option value="female" ' + setGender("female", gender) + '>Female</option><option value="unknown" ' + setGender("unknown", gender) + '>Unknown</option></select></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("gender") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + capFL(genifocusdata.get("gender")) + '" disabled></td></tr>';
            $(div[0]).html(membersstring);
        } else {
            var gender = focusgender;
            membersstring = $(div[0]).html();
            membersstring = membersstring + '<tr ' + hiddenRowAttrs(hidden, gender !== "unknown") + '><td class="profilediv"><input type="checkbox" class="checknext" ' + (genderlocked ? 'disabled ' : '') + isChecked(gender, false, false, undefined, genderlocked) + '>Gender: </td><td style="float:right; padding: 0;"><select class="formselect" style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="gender" ' + isEnabled(gender, false, false, undefined, genderlocked) + '>' +
                '<option value="male" ' + setGender("male", gender) + '>Male</option><option value="female" ' + setGender("female", gender) + '>Female</option><option value="unknown" ' + setGender("unknown", gender) + '>Unknown</option></select></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("gender") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + capFL(genifocusdata.get("gender")) + '" disabled></td></tr>';
            $(div[0]).html(membersstring);
        }
        // #208: fills a genuinely-blank focus-profile birth date with an
        // inferred "Circa <year>" estimate, opt-in and default OFF. Runs
        // BEFORE the 95-year-old deceased check just below (which reads
        // alldata["profile"]["birth"]) and before the profile date-row
        // loop further down, so both pick up the estimate automatically -
        // no separate recompute needed here, unlike the family-member
        // injection point (see there for why that one's different).
        //
        // #208 follow-up: also re-evaluates when Geni's existing value is
        // ITSELF circa (Geni's own "circa" flag on the date, same one
        // cleanDate()/parseDate() set when writing a "Circa <year>"
        // estimate in the first place) - requested live: an existing
        // circa date isn't sourced fact, just an earlier guess (possibly
        // this feature's own, possibly someone else's), and this run may
        // have more/different family data available than whatever
        // produced that original guess. A REAL (non-circa) Geni date is
        // still never touched.
        //
        // #230: always computes and applies the estimate now whenever the
        // scraped side is blank - no longer gated on whether Geni's own
        // birth date is blank or circa first (that was the #208 follow-up
        // #2 reasoning below, now superseded). Whether this ends up
        // pre-checked for submission is purely a render-time decision
        // (see the estimated-field checked-state override in the render
        // loops) - an estimate must never silently overwrite a real Geni
        // date, but it should still be visible and available to manually
        // check even when Geni's side isn't blank. Reapplying is still
        // always safe even when it lands on the same year Geni already
        // has: parseForm() already excludes any field whose value matches
        // Geni's existing one from submission, regardless of checked
        // state.
        if ($('#estimatebirthyearsonoffswitch').prop('checked') &&
            !exists(getBirthYear(alldata["profile"]["birth"]))) {
            var focusEstimate = estimateBirthYear("focus", undefined, focusgender,
                parseInt($('#generationalgapyears').val(), 10), parseInt($('#spousalgapyears').val(), 10));
            if (exists(focusEstimate)) {
                applyEstimatedBirth(alldata["profile"], focusEstimate.year, focusEstimate.cascaded);
            }
        }
        // #208: fills a baptism date ONLY when the scrape already shows a
        // baptism happened (a location on some baptism entry) but no date -
        // never invents the baptism event itself. Runs after the birth
        // block above so getBirthYear() here sees birth's own freshly-
        // resolved value (real or #208-estimated) too. Geni's own baptism
        // date, if any, still wins - same "never overwrite real data" rule
        // as birth, just without the circa-refresh follow-up (not asked
        // for here, and baptism has no equivalent of "this feature wrote
        // it last time" to re-evaluate against).
        if ($('#estimatebirthyearsonoffswitch').prop('checked') && exists(alldata["profile"]["baptism"])) {
            var geniFocusBaptism = genifocusdata.get("baptism", "date.formatted_date");
            if (!exists(geniFocusBaptism) || !isValue(geniFocusBaptism)) {
                var focusBirthYearForBaptism = getBirthYear(alldata["profile"]["birth"]);
                if (exists(focusBirthYearForBaptism)) {
                    attachEstimatedDateToLocationEntry(alldata["profile"]["baptism"], "circa " + focusBirthYearForBaptism);
                }
            }
        }
        // #230 (was #208): focus's own marriage estimate - unlike a family
        // member (below), category="focus" never reaches the widow-
        // remarriage rule (see estimateMarriageYear()'s own comment for
        // why), so this only ever resolves via the couple's own oldest
        // child or the wife's birth+gap fallback. Always computes now
        // regardless of Geni's own marriage date - see the birth block
        // above's comment for the full reasoning (checked-state is a
        // separate, render-time decision).
        if ($('#estimatebirthyearsonoffswitch').prop('checked') &&
            !exists(getBirthYear(alldata["profile"]["marriage"]))) {
            var focusMarriageEstimate = estimateMarriageYear("focus", undefined, focusgender,
                parseInt($('#generationalgapyears').val(), 10), parseInt($('#spousalgapyears').val(), 10));
            if (exists(focusMarriageEstimate)) {
                applyEstimatedDate(alldata["profile"], "marriage", "circa " + focusMarriageEstimate.year);
            }
        }
        if ($('#estimatebirthyearsonoffswitch').prop('checked')) {
            fillMissingDeathOrBurialDate(alldata["profile"]);
        }
        var living = false;
        if (exists(alldata["profile"].alive)) {
            living = alldata["profile"].alive;
        } else if (!(alldata["profile"]["death"]) && !(alldata["profile"]["burial"]) && (geniliving || !exists(geniliving))) {
            living = true;
            //Focus Profile - If the older than 95, default to deceased
            if (alldata["profile"]["birth"]) {
                var fulldate = null;
                for (var b = 0; b < alldata["profile"]["birth"].length; b++) {
                    if (exists(alldata["profile"]["birth"][b].date) && alldata["profile"]["birth"][b].date.trim() !== "") {
                        fulldate = alldata["profile"]["birth"][b].date;
                        break;
                    }
                }
                if (fulldate !== null) {
                    var birthval = parseDate(fulldate, false);
                    var agelimit = moment.utc().format("YYYY") - 95;
                    if (exists(birthval.year) && birthval.year < agelimit) {
                        living = false;
                    }
                }
            }
        }
        membersstring = $(div[0]).html();
        var livinglocked = focusFieldLocked("living"); // #78
        if (geniliving && !living) {
            sepx++;
            membersstring = membersstring + '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + (livinglocked ? 'disabled ' : '') + isChecked(living, true, false, undefined, livinglocked) + '>Vital: </td><td style="float:right; padding: 0;"><select class="formselect" style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="is_alive" ' + isEnabled(living, true, false, undefined, livinglocked) + '>' +
                '<option value=false ' + setLiving("deceased", living) + '>Deceased</option><option value=true ' + setLiving("living", living) + '>Living</option></select></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("living") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + isAlive(genifocusdata.get("is_alive")) + '" disabled></td></tr>';
        } else {
            if (!geniliving && living) {
                living = geniliving;
            }
            membersstring = membersstring + '<tr ' + hiddenRowAttrs(hidden, exists(alldata["profile"].alive)) + '><td class="profilediv"><input type="checkbox" class="checknext" ' + (livinglocked ? 'disabled ' : '') + isChecked(living, false, false, undefined, livinglocked) + '>Vital: </td><td style="float:right; padding: 0;"><select class="formselect" style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="is_alive" ' + isEnabled(living, false, false, undefined, livinglocked) + '>' +
                '<option value=false ' + setLiving("deceased", living) + '>Deceased</option><option value=true ' + setLiving("living", living) + '>Living</option></select></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("living") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + isAlive(genifocusdata.get("is_alive")) + '" disabled></td></tr>';
        }
        var focusBirthYear = undefined;
        if (exists(alldata["profile"]["birth"]) && exists(alldata["profile"]["birth"][0]) && exists(alldata["profile"]["birth"][0]["date"])) {
            focusBirthYear = moment(alldata["profile"]["birth"][0]["date"], getDateFormat(alldata["profile"]["birth"][0]["date"])).get('year');
        }
        var focusPrivacy = buildPrivacySelect(living, focusBirthYear, genifocusdata.get("public") === true);
        var publiclocked = focusFieldLocked("public"); // #78
        membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input type="checkbox" class="checknext" ' + (publiclocked ? 'disabled ' : '') + (focusPrivacy.enabled && !publiclocked ? "checked" : "") + '>Privacy: </td><td style="float:right; padding: 0;"><select class="formselect" style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="public" ' + (focusPrivacy.enabled && !publiclocked ? "" : "disabled") + '>' +
        focusPrivacy.options + '</select></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("public") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + isPublic(genifocusdata.get("public")) + '" disabled></td></tr>';
        $(div[0]).html(membersstring);
        if (exists(alldata["profile"].about)) {
            sepx++;
            membersstring = $(div[0]).html();
            var scoreabout = false;
    //        if (focusabout.contains(alldata["profile"].about)) {
    //            scoreabout = false;
    //        }
            var about = alldata["profile"].about;
            // #210: escapes `about` before it reaches the textarea's text content.
            membersstring = membersstring + buildAboutFieldRow({
                value: about,
                checkedAttr: isChecked(about, scoreabout),
                enabledAttr: isEnabled(about, scoreabout),
                icon: "append.png",
                tdStyle: "padding: 0px;"
            });
            $(div[0]).html(membersstring);
        } else {
            membersstring = $(div[0]).html();
            membersstring = membersstring + '<tr ' + hiddenRowAttrs(hidden, false) + ' id="about"><td colspan="3" style="padding: 0px;"><div class="profilediv" style="width: 100%;"><input type="checkbox" class="checknext">About:<img class="genisliderow" src="images/append.png" align="right" style="width: 12px; margin-right: 3px; margin-top: 5px;"></div><div style="padding-top: 2px; padding-left:4px; padding-right:6px;"><textarea rows="4" name="about_me" style="width:100%;"  disabled></textarea></div></td></tr>';
            $(div[0]).html(membersstring);
        }
        if (sepx === 0) {
            membersstring = $(div[0]).html();
            membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td colspan="3"><div class="separator"></div></td></tr>';
            $(div[0]).html(membersstring);
        } else {
            membersstring = $(div[0]).html();
            membersstring = membersstring + '<tr><td colspan="3" style="padding: 0;"><div class="separator"></div></td></tr>';
            $(div[0]).html(membersstring);
        }
        sepx = x + sepx;
        x = 0;
        var geoplace = "table-row";
        var geoauto = "none";
        var geoicon = "geooff.png";
        if (geoAnySourceEnabled()) {
            geoplace = "none";
            geoauto = "table-row";
            geoicon = "geoon.png";
        }
        var geoplacehidden = " geohidden";
        var geolochidden = "";
        if (!geoAnySourceEnabled()) {
            geoplacehidden = "";
            geolochidden = " geohidden";
        }
        // ---------------------- Profile Data --------------------
        for (var list in listvalues) if (listvalues.hasOwnProperty(list)) {
            var title = listvalues[list];
            obj = alldata["profile"][title];
            membersstring = $(div[0]).html();
            var dateicon = genifocusdata.lockIcon(title, "date");
            var locationicon = genifocusdata.lockIcon(title, "location");
            var datelocked = focusFieldLocked(title, "date"); // #78
            var locationlocked = focusFieldLocked(title, "location"); // #78 - one flag covers all 6 location sub-rows, same as locationicon
            if (exists(obj) && obj.length > 0) {
                if (x > 0) {
                    membersstring = membersstring + '<tr><td colspan="3" style="padding: 0;"><div class="separator"></div></td></tr>';
                    // $("#"+title+"separator")[0].style.display = "block";
                }
                x++;
                var dateadded = false;
                var locationadded = false;
                var locationval = "";
                for (var item in obj) if (obj.hasOwnProperty(item)) {

                    if (exists(obj[item].date)) {
                        var scored = false;
                        if (scorefactors.contains(title + " date")) {
                            scored = true;
                            //div.find("input:checkbox").prop('checked', true);
                            ck++;
                        }
                        // #208: an injected estimate (birth/baptism/marriage/
                        // death/burial via #208)
                        // was never actually scraped, so scorefactors will
                        // never contain "<title> date" for it - without this,
                        // isChecked()/isEnabled() would render it
                        // disabled+unchecked (both require score truthy
                        // before their blank-both-sides branch can fire),
                        // contradicting the "starts checked+enabled"
                        // requirement every other genuinely-blank-both-sides
                        // field already gets. Scoped to just this one field,
                        // not the whole row.
                        if (exists(obj[item].estimated) && obj[item].estimated === true) {
                            scored = true;
                        }

                        var dateval = obj[item].date;
                        var dateambig = "";
                            if (dateAmbigous(dateval)) {
                                dateambig = 'style="color: #ff0000;" ';
                            }
                        // #210: escapes dateval before it reaches value="...".
                        membersstring = membersstring + buildDateFieldRow({
                            label: capFL(title),
                            fieldName: title,
                            value: dateval,
                            checkedAttr: isCheckedDateField(dateval, scored, genifocusdata.get(title, "date.formatted_date"), datelocked, exists(obj[item].estimated) && obj[item].estimated === true),
                            enabledAttr: isEnabled(dateval, scored, false, genifocusdata.get(title, "date.formatted_date"), datelocked),
                            dateambig: dateambig,
                            geniValue: genifocusdata.get(title, "date.formatted_date"),
                            icon: dateicon,
                            rowIdAttr: ' id="' + title + 'date"',
                            tdStyle: "float:right;padding: 0;",
                            locked: datelocked
                        });
                        dateadded = true;

                        //div[0].style.display = "block";
                        //var bd = new Date(obj[item].date);
                        //console.log(bd.getFullYear());

                    }
                    if (exists(obj[item].location)) {
                        var scored = false;
                        if (scorefactors.contains(title + " place")) {
                            scored = true;
                            //div.find("input:checkbox").prop('checked', true);
                            ck++;
                        }
                        var place = obj[item].location;
                        var geovar1 = geolocation[obj[item].id];
                        var pincolor = "clear";
                        var pintitle = "";
                        if (geovar1 === undefined) {
                            geovar1 = parseGoogle("");
                        }
                        if (geovar1.ambiguous || geovar1.count > 1) {
                            pincolor = "yellow";
                            pintitle = "Location lookup may be incorrect";
                        } else if (geovar1.count === 0) {
                            pincolor = "red";
                            pintitle = "Location lookup failed";
                        }
                        var placegeo = geovar1.place;
                        var city = geovar1.city;
                        var county = geovar1.county;
                        var state = geovar1.state;
                        var country = geovar1.country;
                        // #229: real coordinates from whichever geo source
                        // resolved this location (see parseGoogle()/
                        // familySearchPlaceToGeoLocation()'s own comments) -
                        // "" when neither source produced one (isValue()
                        // treats that as blank, same as every other field).
                        var latitude = exists(geovar1.latitude) ? geovar1.latitude : "";
                        var longitude = exists(geovar1.longitude) ? geovar1.longitude : "";
                        // #223/#224 follow-up: previously geoplace/geoauto/
                        // geoicon/geoplacehidden/geolochidden were computed
                        // ONCE per form, purely from whether geocoding was
                        // enabled AT ALL - so a location that genuinely
                        // resolved to real city/county/state/country fields
                        // still defaulted to the flat, unhelpful raw-string
                        // view unless the user manually clicked the toggle
                        // (live-reported: "I think checking birth location
                        // should swap over to the fields... if there ARE
                        // fields, toggle those to be showing"). Now decided
                        // PER LOCATION, from whether THIS specific lookup
                        // actually produced usable fields - shadows the
                        // once-per-form vars for this item only; the
                        // "Unknown"/no-location-scraped-at-all fallback rows
                        // further below are untouched, still governed by the
                        // once-per-form default (nothing to decide from,
                        // since no lookup was ever attempted).
                        var hasGeoFields = isValue(city) || isValue(county) || isValue(state) || isValue(country);
                        var geoone = ($('#forcegeoswitch').prop('checked') && hasGeoFields);
                        var itemGeoplace = hasGeoFields ? "none" : "table-row";
                        var itemGeoauto = hasGeoFields ? "table-row" : "none";
                        var itemGeoicon = hasGeoFields ? "geoon.png" : "geooff.png";
                        var itemGeoplacehidden = hasGeoFields ? " geohidden" : "";
                        var itemGeolochidden = hasGeoFields ? "" : " geohidden";
                        var placeScored = scored && !geoAnySourceEnabled();
                        var geoScored = scored && geoAnySourceEnabled();
                        // #224: once real geo fields exist, suggesting the
                        // FULL raw scraped string for Place Name just
                        // duplicates what city/county/state/country already
                        // say - live-reported as Geni's page showing the
                        // same information twice over. Only whatever isn't
                        // already represented (a dropped middle jurisdiction
                        // level, a historical name that doesn't match the
                        // modern resolved country, an actual venue/address)
                        // survives; "" when nothing does. Never overwrites
                        // Geni's existing value automatically though - still
                        // subject to the SAME isChecked()/isEnabled() "real
                        // Geni data stays protected/unchecked by default"
                        // rule as everything else, so this only takes effect
                        // if the user explicitly checks the box.
                        // #229 follow-up (live-requested): same
                        // parenthesized treatment as Row 1's computed
                        // leftover below, applied here too - live-reported
                        // as inconsistent otherwise ("Jüdischer Friedhof
                        // Storkow" showing unwrapped here, since it's a
                        // confidently-extracted venue name rather than
                        // computed residue, while a DIFFERENT record's
                        // leftover text showed wrapped in Row 1 - from the
                        // user's own perspective both are equally "the
                        // remainder," regardless of which specific Geni
                        // sub-field they end up landing in).
                        if (hasGeoFields && placegeo !== "") {
                            placegeo = "(" + placegeo + ")";
                        }
                        var itemPlaceNameValue = hasGeoFields ? computeLeftoverPlaceName(place, geovar1) : place;
                        // #229 follow-up (live-requested): wrap a non-empty
                        // computed leftover in parentheses - "Potsdam,
                        // Preussen" reads as if it were a literal, precise
                        // continuation of the official address the same
                        // way "Storkow, Beeskow-Storkow, Brandenburg,
                        // Germany" is; it isn't - it's whatever historical/
                        // supplementary text didn't fit into the resolved
                        // fields, genuinely useful context but a different
                        // KIND of information. Only applied to the computed
                        // leftover (hasGeoFields true) - the plain raw
                        // string used when nothing resolved at all is left
                        // unwrapped, since that's not "leftover after
                        // diffing" at all, just the untouched original text.
                        if (hasGeoFields && itemPlaceNameValue !== "") {
                            itemPlaceNameValue = "(" + itemPlaceNameValue + ")";
                        }
                        locationval = locationval +
                            '<tr id="focus_'+title+'"><td colspan="3" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-left: 2px; padding-left: 5px; padding-right: 2px;"><input style="float: left; margin-left: -1px;" type="checkbox" class="geotopcheck">' +
                            '<img class="geoicon" style="cursor: pointer; float:left; padding-left: 3px; padding-top: 2px; padding-right: 4px;" alt="Toggle Geolocation" title="Toggle Geolocation" src="images/' + itemGeoicon + '" height="14px">';
                            if (geoAnySourceEnabled()) {
                                locationval = locationval + '<img src="images/edit.png" title="Edit Location" class="geoUpdateBtn" align="right" style="vertical-align: top; height: 14px; relative; top: 1px; cursor: pointer; margin-top: 2px; margin-right: 3px;">';
                            }
                            locationval = locationval + '<img class="geopin" title="' + pintitle + '" src="images/' + pincolor + 'pin.png" align="right" style="height: 14px;">' + capFL(title) + ' Location: &nbsp;' + place.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</div></td></tr>' +
                            buildLocationFieldRow({
                                trClass: "geoplace" + itemGeoplacehidden, classStyleSep: "", displayVal: itemGeoplace,
                                checkedAttr: isChecked(itemPlaceNameValue, placeScored, false, genifocusdata.get(title, "location_string"), locationlocked),
                                enabledAttr: isEnabled(itemPlaceNameValue, placeScored, false, genifocusdata.get(title, "location_string"), locationlocked),
                                label: capFL(title) + " Place:", tdStyle: "float:right;padding: 0;",
                                fieldName: title + ":location:place_name", value: itemPlaceNameValue, icon: locationicon,
                                geniValue: genifocusdata.get(title, "location_string"), locked: locationlocked
                            }) +
                            buildLocationFieldRow({
                                trClass: "geoloc" + itemGeolochidden, displayVal: itemGeoauto,
                                checkedAttr: isChecked(placegeo, geoScored, geoone, genifocusdata.get(title, "location.place_name"), locationlocked),
                                enabledAttr: isEnabled(placegeo, geoScored, geoone, genifocusdata.get(title, "location.place_name"), locationlocked),
                                label: "Place: ", tdStyle: "float:right;padding: 0;",
                                fieldName: title + ":location:place_name_geo", value: placegeo, icon: locationicon,
                                geniValue: genifocusdata.get(title, "location.place_name"), locked: locationlocked
                            }) +
                            buildLocationFieldRow({
                                trClass: "geoloc" + itemGeolochidden, displayVal: itemGeoauto,
                                checkedAttr: isChecked(city, geoScored, geoone, genifocusdata.get(title, "location.city"), locationlocked),
                                enabledAttr: isEnabled(city, geoScored, geoone, genifocusdata.get(title, "location.city"), locationlocked),
                                label: "City: ", tdStyle: "float:right;padding: 0;",
                                fieldName: title + ":location:city", value: city, icon: locationicon,
                                geniValue: genifocusdata.get(title, "location.city"), locked: locationlocked
                            }) +
                            buildLocationFieldRow({
                                trClass: "geoloc" + itemGeolochidden, displayVal: itemGeoauto,
                                checkedAttr: isChecked(county, geoScored, geoone, genifocusdata.get(title, "location.county"), locationlocked),
                                enabledAttr: isEnabled(county, geoScored, geoone, genifocusdata.get(title, "location.county"), locationlocked),
                                label: "County: ", tdStyle: "float:right;padding: 0;",
                                fieldName: title + ":location:county", value: county, icon: locationicon,
                                geniValue: genifocusdata.get(title, "location.county"), locked: locationlocked
                            }) +
                            buildLocationFieldRow({
                                trClass: "geoloc" + itemGeolochidden, displayVal: itemGeoauto,
                                checkedAttr: isChecked(state, geoScored, geoone, genifocusdata.get(title, "location.state"), locationlocked),
                                enabledAttr: isEnabled(state, geoScored, geoone, genifocusdata.get(title, "location.state"), locationlocked),
                                label: "State: ", tdStyle: "float:right;padding: 0;",
                                fieldName: title + ":location:state", value: state, icon: locationicon,
                                geniValue: genifocusdata.get(title, "location.state"), locked: locationlocked
                            }) +
                            buildLocationFieldRow({
                                trClass: "geoloc" + itemGeolochidden, displayVal: itemGeoauto,
                                checkedAttr: isChecked(country, geoScored, geoone, genifocusdata.get(title, "location.country"), locationlocked),
                                enabledAttr: isEnabled(country, geoScored, geoone, genifocusdata.get(title, "location.country"), locationlocked),
                                label: "Country: ", tdStyle: "float:right;padding: 0;",
                                fieldName: title + ":location:country", value: country, icon: locationicon,
                                geniValue: genifocusdata.get(title, "location.country"), locked: locationlocked
                            }) +
                            buildLocationFieldRow({
                                trClass: "geoloc" + itemGeolochidden, displayVal: itemGeoauto,
                                checkedAttr: isChecked(latitude, geoScored, geoone, genifocusdata.get(title, "location.latitude"), locationlocked),
                                enabledAttr: isEnabled(latitude, geoScored, geoone, genifocusdata.get(title, "location.latitude"), locationlocked),
                                label: "Latitude: ", tdStyle: "float:right;padding: 0;",
                                fieldName: title + ":location:latitude", value: String(latitude), icon: locationicon,
                                geniValue: genifocusdata.get(title, "location.latitude"), locked: locationlocked
                            }) +
                            buildLocationFieldRow({
                                trClass: "geoloc" + itemGeolochidden, displayVal: itemGeoauto,
                                checkedAttr: isChecked(longitude, geoScored, geoone, genifocusdata.get(title, "location.longitude"), locationlocked),
                                enabledAttr: isEnabled(longitude, geoScored, geoone, genifocusdata.get(title, "location.longitude"), locationlocked),
                                label: "Longitude: ", tdStyle: "float:right;padding: 0;",
                                fieldName: title + ":location:longitude", value: String(longitude), icon: locationicon,
                                geniValue: genifocusdata.get(title, "location.longitude"), locked: locationlocked
                            });
                        locationadded = true;
                        //div[0].style.display = "block";
                    }
                }
                if (!dateadded) {
                    membersstring = membersstring +
                        '<tr ' + hiddenRowAttrs(hidden, false) + '><td class="profilediv"><input type="checkbox" class="checknext"' + (datelocked ? ' disabled' : '') + '>' + capFL(title) + ' Date: </td><td style="float:right;"><input type="text" class="formtext dateform" name="' + title + ':date" disabled></td><td class="genisliderow"><img src="images/' + dateicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "date.formatted_date")).replace(/&quot;/g, '"')) + '" disabled></td></tr>';
                }
                if (title === "death") {
                    membersstring = membersstring + '<tr ' + hiddenRowAttrs(hidden, false) + '><td class="profilediv"><input type="checkbox" class="checknext"' + (focusFieldLocked("cause_of_death") ? ' disabled' : '') + '>Death Cause: </td><td style="float:right;"><input type="text" class="formtext" name="cause_of_death" disabled></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("cause_of_death") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("cause_of_death") + '" disabled></td></tr>';
                }
                if (!locationadded) {
                    // #35 follow-up (live-reported): every <tr> in this
                    // blank-location fallback is built by raw string
                    // concatenation instead of hiddenRowAttrs() (which
                    // every OTHER hidden row in this codebase uses) - it
                    // was missing data-hasvalue entirely. The eyeball's
                    // close handler (.showhide, below) only re-hides
                    // '.hiddenrow[data-hasvalue="false"]' - a row with
                    // class="hiddenrow" but no data-hasvalue attribute at
                    // all doesn't match that selector, so clicking the
                    // eyeball open then closed again left these rows
                    // permanently stuck visible. Also missing Latitude/
                    // Longitude entirely - the same row-count-drift class
                    // of bug already fixed twice this session elsewhere
                    // (.geotopcheck, .geoicon) - this fallback was never
                    // updated when those rows were added.
                    locationval = locationval +
                        '<tr id="focus_'+title+'" class="hiddenrow" data-hasvalue="false" style="display: ' + isHidden(hidden) + ';"><td colspan="3" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-left: 2px; padding-left: 5px; padding-right: 2px;"><input style="float: left; margin-left: -1px;" type="checkbox" class="geotopcheck"><img class="geoicon" style="cursor: pointer; float:left; padding-left: 3px; padding-top: 2px; padding-right: 4px;" src="images/' + geoicon + '" alt="Toggle Geolocation" title="Toggle Geolocation" height="14px">';
                        if (geoAnySourceEnabled()) {
                            locationval = locationval + '<img src="images/edit.png" title="Edit Location" class="geoUpdateBtn" align="right" style="vertical-align: top; height: 14px; relative; top: 1px; cursor: pointer; margin-top: 2px; margin-right: 3px;">';
                        }
                        locationval = locationval + '<img class="geopin" title="" src="images/clearpin.png" align="right" style="height: 14px;">' + capFL(title) + ' Location: &nbsp;Unknown</div></td><td></td></tr>' +
                        '<tr class="geoplace hiddenrow' + geoplacehidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "place") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext"' + (locationlocked ? ' disabled' : '') + '>' + capFL(title) + ' Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "location_string")).replace(/&quot;/g, '"')) + '" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow' + geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext"' + (locationlocked ? ' disabled' : '') + '>Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name_geo" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "location.place_name")).replace(/&quot;/g, '"')) + '" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow' + geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext"' + (locationlocked ? ' disabled' : '') + '>City: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:city" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "location.city")).replace(/&quot;/g, '"')) + '" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow' + geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext"' + (locationlocked ? ' disabled' : '') + '>County: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:county" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "location.county")).replace(/&quot;/g, '"')) + '" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow' + geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext"' + (locationlocked ? ' disabled' : '') + '>State: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:state" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "location.state")).replace(/&quot;/g, '"')) + '" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow' + geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext"' + (locationlocked ? ' disabled' : '') + '>Country: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:country" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "location.country")).replace(/&quot;/g, '"')) + '" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow' + geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext"' + (locationlocked ? ' disabled' : '') + '>Latitude: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:latitude" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "location.latitude")).replace(/&quot;/g, '"')) + '" disabled></td></tr>' +
                        '<tr class="geoloc hiddenrow' + geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext"' + (locationlocked ? ' disabled' : '') + '>Longitude: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:longitude" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "location.longitude")).replace(/&quot;/g, '"')) + '" disabled></td></tr>';
                }
                membersstring = membersstring + locationval;
            } else {
                if (x > 0) {
                    membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td colspan="3"><div class="separator"></div></td><td></td></tr>';
                }

                membersstring = membersstring +
                    '<tr ' + hiddenRowAttrs(hidden, false) + '><td class="profilediv"><input type="checkbox" class="checknext"' + (datelocked ? ' disabled' : '') + '>' + capFL(title) + ' Date: </td><td style="float:right;"><input type="text" class="formtext dateform" name="' + title + ':date" disabled></td><td class="genisliderow"><img src="images/' + dateicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "date.formatted_date")).replace(/&quot;/g, '"')) + '" disabled></td></tr>';
                if (title === "death") {
                    membersstring = membersstring + '<tr ' + hiddenRowAttrs(hidden, false) + '><td class="profilediv"><input type="checkbox" class="checknext"' + (focusFieldLocked("cause_of_death") ? ' disabled' : '') + '>Death Cause: </td><td style="float:right;"><input type="text" class="formtext" name="cause_of_death" disabled></td><td class="genisliderow"><img src="images/' + genifocusdata.lockIcon("cause_of_death") + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + genifocusdata.get("cause_of_death") + '" disabled></td></tr>';
                }
                // #35 follow-up: same missing data-hasvalue + missing
                // Latitude/Longitude bug as the !locationadded fallback
                // above - this is the SEPARATE "title has zero data at
                // all" branch (obj doesn't exist), which is what actually
                // fires for baptism/death/burial on a page that never
                // scraped them at all (e.g. a MyHeritage marriage record).
                membersstring = membersstring +
                    '<tr id="focus_'+title+'" class="hiddenrow" data-hasvalue="false" style="display: ' + isHidden(hidden) + ';"><td colspan="3" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-left: 2px; padding-left: 5px; padding-right: 2px;"><input style="float: left; margin-left: -1px;" type="checkbox" class="geotopcheck"><img class="geoicon" style="cursor: pointer; float:left; padding-left: 3px; padding-top: 2px; padding-right: 4px;"  alt="Toggle Geolocation" title="Toggle Geolocation"  src="images/' + geoicon + '" height="14px">';
                    if (geoAnySourceEnabled()) {
                        membersstring = membersstring + '<img src="images/edit.png" title="Edit Location" class="geoUpdateBtn" align="right" style="vertical-align: top; height: 14px; relative; top: 1px; cursor: pointer; margin-top: 2px; margin-right: 3px;">';
                    }
                    membersstring = membersstring + '<img class="geopin" title="" src="images/clearpin.png" align="right" style="height: 14px;">' + capFL(title) + ' Location: &nbsp;Unknown</div></td><td></td></tr>' +
                    '<tr class="geoplace hiddenrow' + geoplacehidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "place") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext"' + (locationlocked ? ' disabled' : '') + '>' + capFL(title) + ' Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "location_string")).replace(/&quot;/g, '"')) + '" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow' + geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext"' + (locationlocked ? ' disabled' : '') + '>Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name_geo" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "location.place_name")).replace(/&quot;/g, '"')) + '" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow' + geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext"' + (locationlocked ? ' disabled' : '') + '>City: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:city" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "location.city")).replace(/&quot;/g, '"')) + '" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow' + geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext"' + (locationlocked ? ' disabled' : '') + '>County: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:county" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "location.county")).replace(/&quot;/g, '"')) + '" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow' + geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext"' + (locationlocked ? ' disabled' : '') + '>State: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:state" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "location.state")).replace(/&quot;/g, '"')) + '" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow' + geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext"' + (locationlocked ? ' disabled' : '') + '>Country: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:country" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "location.country")).replace(/&quot;/g, '"')) + '" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow' + geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext"' + (locationlocked ? ' disabled' : '') + '>Latitude: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:latitude" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "location.latitude")).replace(/&quot;/g, '"')) + '" disabled></td></tr>' +
                    '<tr class="geoloc hiddenrow' + geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext"' + (locationlocked ? ' disabled' : '') + '>Longitude: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:longitude" disabled></td><td class="genisliderow"><img src="images/' + locationicon + '" class="genislideimage"><input type="text" class="formtext genislideinput" value="' + escapeHtml(String(genifocusdata.get(title, "location.longitude")).replace(/&quot;/g, '"')) + '" disabled></td></tr>';

            }
            $(div[0]).html(membersstring);
        }
    } else {
        
        x = 1;
        $("#profileexpand").html('<div class="shadoweffect" style="text-align: center"><img class="iconaction" style="width: 16px; margin-bottom: -4px; margin-left: -2px; padding-right: 3px;" src="/images/disabled.png" title="disabled" description="disabled">Profile Update Disabled: pre-1600</div>')
        document.getElementById("profiledata").style.display = "block";
        
    }
    x = sepx + x;
    if (ck > 0) {
        $('#updateprofile').prop('checked', true);
    }
    if (x > 0) {
        document.getElementById("profiledata").style.display = "block";
        document.getElementById("genislider").style.display = "block";
    } else if (!hidden) {
        document.getElementById("profiledata").style.display = "block";
        document.getElementById("genislider").style.display = "block";
    } else {
        // #219: even in the genuinely-degenerate case (nothing at all
        // scored - no name, no birth/death, no gender, no occupation),
        // still show at least the Update Profile header row + eyeball
        // toggle (.showhide/#focusshowhide). Previously left #profiledata
        // fully hidden here, with no way to even reach the toggle that
        // reveals whatever Hide Empty Fields collapsed - individual rows
        // still collapse/expand under this exactly as that setting already
        // governs, only the panel itself is now guaranteed reachable.
        document.getElementById("profiledata").style.display = "block";
    }

    // ---------------------- Family Data --------------------
    listvalues = ["birth", "baptism", "marriage", "divorce", "death", "burial"];
    obj = alldata["family"];
    //console.log("");
    //console.log(JSON.stringify(obj));
    var ambigdatecheck = [];
    var icount = 0;
    var photoscore = $('#photoonoffswitch').prop('checked');
    for (var relationship in obj) if (obj.hasOwnProperty(relationship)) {
        var members = obj[relationship];
        var scored = false;
        var sibcheck = false;
        var childck = false;
        var partnerck = false;
        var parentck = false;
        var scoreused = false;
        //Use a common naming scheme
        // sibcheck/childck/parentck/partnerck (the top-level "add all
        // [category]" convenience checkbox) share their "Geni has none of
        // this category at all" signal with scored (which drives the
        // per-person top checkbox and, within each member's row, per-field
        // pre-checking) - deliberately, not coincidentally. This is a
        // separate, deterministic reason to auto-select from the source's
        // own SmartMatch relevance signal (scorefactors): whether MyHeritage
        // flagged this relationship as a probable match or not, a category
        // Geni has zero of at all is unambiguous - there's nothing to
        // conflict with, so every candidate found for it is worth
        // auto-selecting, fields included, not just the top-level "add all"
        // checkbox with nothing checked underneath it.
        if (isSibling(relationship)) {
            sibcheck = !geniHasAnyOfCategory(isSibling);
            if (scorefactors.contains("sibling") || sibcheck) {
                scored = true;
            }
            relationship = "sibling";
        } else if (isChild(relationship)) {
            childck = !geniHasAnyOfCategory(isChild);
            if (scorefactors.contains("child") || childck) {
                scored = true;
            }
            relationship = "child";
        }
        else if (isParent(relationship)) {
            parentck = !geniHasAnyOfCategory(isParent);
            if (scorefactors.contains("parent") || parentck) {
                scored = true;
            }
            relationship = "parent";
        }
        else if (isPartner(relationship) || relationship.contains("veteran (self)")) {
            partnerck = !geniHasAnyOfCategory(isPartner);
            if (scorefactors.contains("spouse") || partnerck) {
                scored = true;
            }
            relationship = "partner";
        } else {
            relationship = "unknown";
        }

        var div = $("#" + relationship);
        if (members.length > 0 && exists(div[0])) {
            div[0].style.display = "block";
        }
        var parentscore = scored;
        var skipprivate = $('#privateonoffswitch').prop('checked');
        for (var member in members) if (members.hasOwnProperty(member)) {
            var i = members[member]["profile_id"];
            if (!exists(i)) {
                i = icount;
                //Just in case a parser misses this in the future, add a nice warning
                console.warn("Family Member lacks profile_id (famid)!  Using fallback count, but this needs to be fixed.");
            }
            scored = parentscore;
            var entry = $("#" + relationship + "val")[0];
            if (!exists(entry)) {
                continue;
            }
            if (!exists(members[member].name)) {
                continue;
            }
            var nameval = NameParse.parse(members[member].name, mnameonoff);
            var fullname = nameval.displayname;
            if (!exists(fullname)) {
                continue;
            } else if (fullname.trim() === "") {
                scored = false;
            }
            var living = false;
            var livingScraped = false;
            var halfsibling = false;
            if (!scored && relationship === "parent") {
                //used !== to also select unknown gender
                // Only sets scored (per-member field-level relevance) now -
                // the top-level "add parents" bulk checkbox is decided once
                // per category, above, purely from whether Geni already has
                // ANY parent at all. Directly forcing #addparentck checked
                // here too - as this used to - would re-select "add
                // parents" any time just one of father/mother was
                // individually missing, even when Geni already has the
                // other one, contradicting that category-wide rule.
                if (scorefactors.contains("father") && !geniHas("father") && members[member].gender !== "female") {
                    scored = true;
                } else if (scorefactors.contains("mother") && !geniHas("mother")  && members[member].gender !== "male") {
                    scored = true;
                }
            }
            if (isSibling(relationship) && exists(members[member].halfsibling) && members[member].halfsibling) {
                scored = false;
                halfsibling = true;
            }
            if (skipprivate && checkLiving(fullname)) {
                scored = false;
            } else {
                scoreused = true;
            }
            if (exists(members[member].alive)) {
                living = members[member].alive;
                livingScraped = true;
            }
            if ($('#birthonoffswitch').prop('checked') && nameval.birthName === "") {
                if (members[member].gender === "male") {
                    nameval.birthName = nameval.lastName;
                } else if (members[member].gender === "female" && isCompoundSurname(nameval.lastName)) {
                    // #206: see isCompoundSurname() - never clear a
                    // compound surname, just copy it to Birth Name.
                    nameval.birthName = nameval.lastName;
                } else if (members[member].gender === "female" && setBirthName(relationship, nameval.lastName, mnameonoff)) {
                    nameval.birthName = nameval.lastName;
                    nameval.lastName = "";
                } else if (members[member].gender === "unknown" && relationship !== "parent") {
                    nameval.birthName = nameval.lastName;
                }
            }
            if (exists(members[member].nicknames)) {
                if (nameval.nickName !== "") {
                    nameval.nickName += ",";
                }
                nameval.nickName += members[member].nicknames;
            }
            var displayname = "";
            if (nameval.prefix !== "") {
                //Deprecated due to title field
                //displayname = nameval.displayname;
            }
            var gender = members[member].gender;
            if (gender === "unknown" && isPartner(relationship) && focusgender !== "unknown") {
                //if unknown, assume spouse is opposite gender
                gender = reverseGender(focusgender);
            }

            // #204: auto-fill a new female spouse's Last Name with the
            // focus person's own surname, when nothing was scraped for it
            // at all. Blank-only (nameval.lastName === "") - never
            // overwrites a Last Name the source actually provided, even if
            // it differs from the focus person's surname. That's not just
            // caution: some genealogical naming conventions (e.g. Mexican
            // civil-registry names, which are always the birth compound
            // surname and never legally change at marriage) will correctly
            // yield a non-blank scraped Last Name here, and guessing over
            // it would replace a correct birth surname with a guessed
            // married one.
            //
            // Originally scoped to exactly one spouse only (members.length
            // === 1), on the theory that a second spouse (remarriage) makes
            // which surname to default to ambiguous - but the value copied
            // in is always the FOCUS person's own already-parsed last_name,
            // never anything derived per-spouse, so there's no actual
            // ambiguity to resolve: every blank-Last-Name female spouse of
            // the same male focus person should independently get the same,
            // correct answer regardless of how many spouses total. A live
            // report (a man with two wives, neither auto-filled) confirmed
            // the length===1 guard was blocking valid cases, not protecting
            // against a real one - removed. Still only for a female spouse
            // with a male focus person (explicitly not assumed for any
            // other gender combination - see #204's "Same-Sex Marriage
            // Logic" note). Hyphenated/multi-word surnames need no special
            // handling here - this only ever copies the focus person's own
            // already-parsed last_name verbatim, never re-parses or
            // re-derives anything.
            //
            // Deliberately NOT attempting to detect maiden-name-retention
            // cultural conventions (e.g. Spanish/Hispanic naming) - there's
            // no reliable signal for this anywhere in the scraped data, and
            // guessing wrong would submit incorrect data, exactly what this
            // feature should avoid. The blank-only gate above is the real
            // mitigation for those conventions (a correctly-scraped birth
            // surname is never blank, so this never fires for one);
            // lastNameAutoFilled (used below, where the field actually
            // renders) is a second layer on top - the value is filled in
            // but never pre-checked, so it always requires the user's own
            // review before it can be submitted.
            // Gated behind its own toggle (#marriednameonoffswitch, on by
            // default) in addition to birthonoffswitch - see the matching
            // comment on the focus-person direction above.
            var lastNameAutoFilled = false;
            if ($('#birthonoffswitch').prop('checked') && $('#marriednameonoffswitch').prop('checked') && relationship === "partner" && isFemale(gender) && isMale(focusgender) && nameval.lastName === "") {
                var focusnamelang = genifocusdata.get("name_language");
                var spouseSurnameForMember = genifocusdata.get("names", focusnamelang + ".last_name");
                if (exists(spouseSurnameForMember) && spouseSurnameForMember !== "") {
                    nameval.lastName = spouseSurnameForMember;
                    lastNameAutoFilled = true;
                }
            }

            // #204 (parents): same married-name derivation, applied to the
            // focus person's MOTHER - a "parent" family member, not a
            // "partner" one, so it needed its own case rather than falling
            // out of the block above. Finds the FATHER's surname via
            // getParentSurname() (mirrors getFocusSpouseSurname() - exactly
            // one male among all parent-type entries, or give up) and fills
            // it in only when her own Last Name is blank, same rationale
            // and same cultural-naming caveat as the spouse direction
            // above.
            if ($('#birthonoffswitch').prop('checked') && $('#marriednameonoffswitch').prop('checked') && relationship === "parent" && isFemale(gender) && nameval.lastName === "") {
                var fatherSurnameForMember = getParentSurname("male", mnameonoff);
                if (fatherSurnameForMember !== "") {
                    nameval.lastName = fatherSurnameForMember;
                    lastNameAutoFilled = true;
                }
            }

            // Siblings/children re-checked on a re-run: unlike parent, which
            // is guarded above by geniHas(), sibling/child/partner had no
            // "already in Geni's tree" check at all - only whether
            // scorefactors flagged the relationship as a match factor, so
            // re-running a build on the same profile after a prior run
            // already added these people re-checked them again. Use the
            // same name+birth-year match buildAction() uses to decide
            // "Update" vs "Add Profile" in the dropdown below, so a member
            // already linked to an existing Geni family member doesn't get
            // flagged as needing to be added a second time.
            if (scored && (isSibling(relationship) || isChild(relationship) || isPartner(relationship))) {
                var earlyBirthYear = undefined;
                if (exists(members[member]["birth"]) && exists(members[member]["birth"][0]) && exists(members[member]["birth"][0]["date"])) {
                    earlyBirthYear = moment(members[member]["birth"][0]["date"], getDateFormat(members[member]["birth"][0]["date"])).get('year');
                }
                if (findExistingFamilyMatch(relationship, gender, nameval.firstName, (nameval.lastName || nameval.birthName), earlyBirthYear)) {
                    scored = false;
                }
            }

            // #208: fills a genuinely-blank family-member birth date with
            // an inferred "Circa <year>" estimate, opt-in and default OFF.
            // Runs here - after gender/halfsibling are resolved and after
            // the dedup match above (so an invented estimate never
            // influences "does this scraped person match an existing Geni
            // profile"), before the pre-1600 datelimit check and the
            // Vital/date-row rendering below, so both pick it up.
            // #208 follow-up (live report, data-loss risk): a wife who
            // already had a REAL date on Geni (not even a circa) still got
            // an estimate written AND auto-checked - the family-member date
            // row's checked-state comparison hardcodes currentValue="" (a
            // pre-existing quirk unrelated to this feature, out of scope to
            // fix generally), so writing an estimate here made a person who
            // already had real Geni data look exactly like the "scraped
            // blank + Geni blank -> safe to auto-check" case, when Geni's
            // side very much wasn't blank. Rather than touching that
            // broader render-time check, this gate stops the fabricated
            // value from ever being written in the first place whenever
            // Geni already has ANY real value for the SAME matched person
            // (getMatchedGeniFamilyCandidate() - the identical candidate
            // buildAction()'s dropdown will resolve one render step later),
            // circa or not - matches the "never overwrite real Geni data"
            // rule this whole feature already follows everywhere else
            // (focusRealYear, Priority 2's real spousal date).
            var matchedCandidateForEstimate = getMatchedGeniFamilyCandidate(relationship, gender, nameval, undefined);
            var matchedCandidateBirthYear = exists(matchedCandidateForEstimate) ?
                matchedCandidateForEstimate.get("birth", "date.year") : undefined;
            if ($('#estimatebirthyearsonoffswitch').prop('checked') &&
                !exists(getBirthYear(members[member]["birth"])) &&
                (!exists(matchedCandidateBirthYear) || !isValue(matchedCandidateBirthYear))) {
                // #208 follow-up: passed through as estimateBirthYear()'s
                // focusRealYear param (see its own comment) - a "partner"
                // member's Rule 1 lookup resolves the focus person as its
                // spouse, but once the focus person already has a real
                // birth date sitting on Geni (e.g. from an earlier run),
                // alldata["profile"]["birth"] never gets repopulated with
                // it this run (the focus-profile injection above correctly
                // skips writing a redundant new estimate), leaving nothing
                // for the in-memory lookup to find. Reading it here from
                // genifocusdata directly gives the estimator access to
                // that already-real value without having to fake-populate
                // alldata["profile"]["birth"] itself, which other code
                // (the 95-year check, date-row rendering) also reads and
                // has different, unrelated expectations about.
                var geniFocusBirthYear = genifocusdata.get("birth", "date.year");
                var focusRealYear = isValue(geniFocusBirthYear) ? parseInt(geniFocusBirthYear, 10) : undefined;
                if (isNaN(focusRealYear)) {
                    focusRealYear = undefined;
                }
                var memberEstimate = estimateBirthYear(relationship, members[member], focusgender,
                    parseInt($('#generationalgapyears').val(), 10), parseInt($('#spousalgapyears').val(), 10), focusRealYear);
                if (exists(memberEstimate)) {
                    applyEstimatedBirth(members[member], memberEstimate.year, memberEstimate.cascaded);
                    // The 95-year-old default (unlike the focus profile's
                    // inline check above) runs at PARSE time inside
                    // updateInfoData(), called from each collections/*.js
                    // parser BEFORE any cross-person family context exists -
                    // so members[member].alive is already fixed by now and
                    // won't pick up this estimate on its own. Recompute it
                    // explicitly, guarded so an explicit parser-set value
                    // (e.g. from a real death/burial record) is never
                    // overridden. livingScraped=true (not just living)
                    // matters too - it's what the Vital <select>'s own
                    // data-scraped attribute reflects, consumed by
                    // isFieldEmptyForCheckAll()/Select All (#217) to know
                    // this value is determined, not a render-time guess.
                    if (!exists(members[member].alive)) {
                        var estimateAgeLimit = moment.utc().format("YYYY") - 95;
                        members[member].alive = (memberEstimate.year >= estimateAgeLimit);
                        living = members[member].alive;
                        livingScraped = true;
                    }
                }
            }

            // #208: same rule as the focus profile above - fills a baptism
            // date ONLY when this member's scrape already shows a baptism
            // happened (a location on some baptism entry) but no date,
            // using birth's own already-resolved value (real or estimated,
            // just injected above). Reuses matchedCandidateForEstimate
            // (already computed just above for the birth check) rather than
            // re-resolving the same Geni match a second time.
            if ($('#estimatebirthyearsonoffswitch').prop('checked') && exists(members[member]["baptism"])) {
                var geniMemberBaptism = exists(matchedCandidateForEstimate) ?
                    matchedCandidateForEstimate.get("baptism", "date.formatted_date") : undefined;
                if (!exists(geniMemberBaptism) || !isValue(geniMemberBaptism)) {
                    var memberBirthYearForBaptism = getBirthYear(members[member]["birth"]);
                    if (exists(memberBirthYearForBaptism)) {
                        attachEstimatedDateToLocationEntry(members[member]["baptism"], "circa " + memberBirthYearForBaptism);
                    }
                }
            }

            // #208: this member's own marriage estimate - relationship
            // (parent/partner/sibling/child) is passed straight through as
            // estimateMarriageYear()'s category, so a partner specifically
            // (a spouse of focus) is eligible for the widow-remarriage
            // rule; sibling/child naturally resolve to undefined (no
            // children/spouse data exists for those categories at all).
            if ($('#estimatebirthyearsonoffswitch').prop('checked') &&
                !exists(getBirthYear(members[member]["marriage"]))) {
                var geniMemberMarriage = exists(matchedCandidateForEstimate) ?
                    matchedCandidateForEstimate.get("marriage", "date.formatted_date") : undefined;
                if (!exists(geniMemberMarriage) || !isValue(geniMemberMarriage)) {
                    var memberMarriageEstimate = estimateMarriageYear(relationship, members[member], focusgender,
                        parseInt($('#generationalgapyears').val(), 10), parseInt($('#spousalgapyears').val(), 10));
                    if (exists(memberMarriageEstimate)) {
                        applyEstimatedDate(members[member], "marriage", "circa " + memberMarriageEstimate.year);
                    }
                }
            }

            // #208/#230: death<->burial mutual fill for this member - whichever
            // side has a real date supplies the other, same rule as the
            // focus profile above.
            if ($('#estimatebirthyearsonoffswitch').prop('checked')) {
                fillMissingDeathOrBurialDate(members[member]);
            }

            var bgcolor = genderColor(gender);

            var actionicon = "add";
            if (isParent(relationship)) {
                if (isMale(gender) && geniHas("father")) {
                    actionicon = "update";
                } else if (isFemale(gender) && geniHas("mother")) {
                    actionicon = "update";
                }
            }
            var checkunknown = "";
            var hideunknown = "table-row";
            if (relationship === "unknown") {
                checkunknown = " disabled";
                hideunknown = "none";
            }
            var expand = true;
            if (exists(members[member]["birth"]) && exists(members[member]["birth"][0]) && exists(members[member]["birth"][0]["date"])) {
                var dt = moment(members[member]["birth"][0]["date"], getDateFormat(members[member]["birth"][0]["date"]));
                var year = dt.get('year');
                if (year < datelimit) {
                    checkunknown = " disabled";
                    scored = false;
                    expand = false;
                    actionicon = "disabled";
                }
            } else if (exists(members[member]["death"]) && exists(members[member]["death"][0]) && exists(members[member]["death"][0]["date"])) {
                var dt = moment(members[member]["death"][0]["date"], getDateFormat(members[member]["death"][0]["date"]));
                var year = dt.get('year');
                if (year < datelimit) {
                    checkunknown = " disabled";
                    scored = false;
                    expand = false;
                    actionicon = "disabled";
                }
            }

            var membersstring = $(entry).html();
            membersstring += '<div class="membertitle" style="background-color: ' + bgcolor + '"><table style="border-spacing: 0px; border-collapse: separate; width: 100%;"><tr>' +
                '<td><input type="checkbox" class="checkslide" name="checkbox' + i + '-' + relationship + '" ' + isChecked(fullname, scored) + checkunknown + '></td>';
            if (expand) {
                membersstring += '<td class="expandcontrol" name="' + i + '-' + relationship + '"  style="cursor: pointer; width: 100%;">';
            } else {
                membersstring += '<td name="' + i + '-' + relationship + '"  style="width: 100%;" title="pre 1600 - disabled" description="pre 1600 - disabled">';
            }
            membersstring += '<span id="ribbon' + i + '" style="display: ' + isHidden(living) + '; float: right; position: relative; margin-right: -12px; margin-bottom: -5px; right: 8px; top: -3px; margin-left: -8px;"><img src="images/deceased.png" style="width: 18px;"></span>';
            if (expand) {
                membersstring += '<span style="font-size: 130%; float: right; padding-right: 8px; padding-left:2px;"><img src="images/dropdown.png" style="width: 11px;"></span>';
            }
            membersstring += '<span style="font-size: 90%;"><img class="iconaction" style="width: 16px; margin-bottom: -4px; margin-left: -2px; padding-right: 3px;" src="/images/' + actionicon +  '.png" title=' + actionicon + ' description=' + actionicon + '>' + escapeHtml(fullname.replace(/&quot;/g, '"')) + '</span>';
            
            if (halfsibling) {
                membersstring += '<span style="float: right; margin-right: 3px; margin-left: -2px; margin-top: 3px; margin-bottom: -3px;"><img src="images/halfcircle.png" style="width: 14px; margin-top: -2px;" alt="half-sibling" title="half-sibling"></span>';
            }
            if (expand) {
                membersstring += '<span style="float: right; padding-left: 8px;"><img class="geopin" id="' + i + 'gpin" src="images/clearpin.png" style="height: 14px; margin-bottom: -3px;"><img id="' + i + 'errordate" src="images/dateerror.png" style="display: none; height: 13px; margin-bottom: -3px; padding-right: 3px; margin-left: -3px;" title="Ambiguous Date"></span>';
            }
            membersstring += '</td><td></td></tr></table></div>' +
                '<div id="slide' + i + '-' + relationship + '" class="memberexpand" style="display: none; padding-bottom: 6px; padding-left: 12px;"><table id="familytable_' + i + '" style="border-spacing: 0px; border-collapse: separate; width: 100%;">' +
                '<tr><td colspan="3" style="padding: 0px;"><input type="hidden" name="profile_id" value="' + i + '"></td></tr>';
            if (relationship === "unknown") {
                membersstring += '<tr name="unk" style="display: table-row;"><td class="profilediv" colspan="3" style="padding-bottom: 3px;"><span style="margin-top: 3px; float: left; margin-left: 19px;">Relation:</span><span id="unknownrel' + i + '">' + buildUnknown(gender) + '</span></td></tr>';
            }
            var showlabel = SHOW_ALL_LABEL;
            var showtitle = "Hiding Unused Fields";
            if (expand) {
                if (!$('#hideemptyonoffswitch').prop('checked')) {
                    showlabel = SHOW_LESS_LABEL;
                    showtitle = "Showing All Fields";
                }
                var actionBirthYear = undefined;
                if (exists(members[member]["birth"]) && exists(members[member]["birth"][0]) && exists(members[member]["birth"][0]["date"])) {
                    actionBirthYear = moment(members[member]["birth"][0]["date"], getDateFormat(members[member]["birth"][0]["date"])).get('year');
                }
                // nameval.lastName is cleared to "" for females (above,
                // when the birth-name split applies) with the maiden
                // surname moved into nameval.birthName instead - use
                // whichever is populated so buildAction gets the actual
                // surname regardless of gender.
                // #230 follow-up (live-reported): the lock icon here is
                // hidden until setGeniFamilyData() knows whether the
                // matched profile has any edit permission at all (not
                // knowable at render time, before a match exists) - it's
                // the same "why is everything greyed out" question the
                // blanket no-edit-permission sweep answers for the fields
                // themselves, surfaced right at Action: where the match is
                // actually chosen.
                membersstring += '<tr name="act" style="display: ' + hideunknown + ';"><td class="profilediv" colspan="3" style="padding-bottom: 3px;"><span style="margin-top: 3px; float: left; margin-left: 19px;">Action:</span><span class="showhide" title="' + showtitle + '" style="cursor: pointer; font-weight: normal; font-size: 90%; white-space: nowrap; margin-left: 6px;">' + showlabel + '</span><img id="' + i + '_action_lock" src="images/lock.png" title="This profile is locked - you do not have edit permission, so all fields are disabled" style="width: 14px; height: 14px; margin-left: 4px; display: none; vertical-align: middle;"><span name="buildactionspan" id="action' + i + '">' + buildAction(relationship, gender, i, nameval.firstName, (nameval.lastName || nameval.birthName), actionBirthYear) + '</span></td></tr></span>';

                if (isChild(relationship) || relationship === "unknown") {
                    var parentrel = "Parent";
                    if (focusgender === "male") {
                        parentrel = "Mother";
                    } else if (focusgender === "female") {
                        parentrel = "Father";
                    }
                    membersstring += '<tr name="parenttr" style="display: ' + hideunknown + ';"><td class="profilediv" colspan="3" style="padding-bottom: 3px; padding-top: 0px;"><span style="margin-top: 3px; float: left; margin-left: 19px;">' + parentrel + ':</span><span>' + buildParentSelect(members[member].parent_id) + '</span></td></tr>';
                }
                
                if (exists(members[member]["thumb"])) {
                    var thumbnail = members[member]["thumb"];
                    var image = members[member]["image"];
                    if (Object.getOwnPropertyNames(fsimage).length > 0) {
                        for (var imgurl in fsimage) {
                            if (imgurl == thumbnail) {
                                thumbnail = fsimage[imgurl];
                                image = thumbnail;
                                break;
                            }
                        }
                    }
                    var credit = members[member]["imagecredit"] || "";
                    membersstring = membersstring +
                        '<tr id="photo"><td class="profilediv"><input type="checkbox" class="checknext photocheck" ' + isChecked(thumbnail, (scored && photoscore)) + '>' +
                        "Photo" + ':</td><td style="padding: 0;"><div style="float: right;"><input type="hidden" class="photocheck" name="photo" value="' + image + '" ' + isEnabled(thumbnail, (scored && photoscore)) + ' author="' + credit + '"><img style="max-width: 150px; max-height: 120px; object-fit: contain;"  src="' + thumbnail + '"></div></td><td class="genisliderow" style="vertical-align: middle; padding: 0;"><div style="display: inline-block; vertical-align: middle; padding: 0;"><img id="' + i + '_geni_mugshot" src="images/right.png" class="genislideimage" style="padding-left: 5px;"></div><div style="display: inline-block; vertical-align: middle; padding: 0;"><img id="' + i + '_geni_photo_urls" style="max-width: 150px; max-height: 120px; object-fit: contain; padding: 0px;" src="' + geniPhoto(gender) + '"></div></td></tr>';
                }
                let namelang = "en-US";
                let langtarget = Object.assign({}, $("#language_selector"));
                $(langtarget).find("select").attr("id", i + "_geni_name_language");
                let regex = new RegExp('value="' + namelang + '">',"gm");
                membersstring += '<tr><td colspan="2"></td><td>' + $(langtarget).html().replace(regex, "value='" + namelang + "' selected>"); + '</td></tr>'
                // #210: each row below now goes through buildTextFieldRow(),
                // which escapes the scraped value before it reaches the
                // value="..." attribute - previously none of these did.
                // lastNameAutoFilled (#204) still controls Last Name's
                // enabled state exactly as before: the value came from a
                // guess (the focus person's or father's surname), not
                // scraped source data - starts enabled (typeable/
                // reviewable) like any other blank-safe field.
                // 'data-guessed="true"' is injected via the enabledAttr
                // slot (buildTextFieldRow() splices it straight into the
                // <input>'s attribute list, same trick "disabled" already
                // uses there) so isFieldValueBlank() treats this guessed
                // value as blank for Select All purposes - Select All
                // checks it only when Geni's own value is ALSO blank.
                // The initial checked state (follow-up to #204, requested
                // live after the multi-spouse fix above) now follows the
                // same rule automatically, without needing an explicit
                // Select All click: lastNameAutoCheckSafe() checks it when
                // there's no existing Geni match at all (a brand new
                // profile - nothing to protect) or the matched candidate's
                // own Last Name is blank, and leaves it unchecked exactly
                // like before whenever Geni already has real data there.
                var lastNameInitialChecked = lastNameAutoFilled && lastNameAutoCheckSafe(relationship, gender, nameval, actionBirthYear) ? "checked" : "";
                // #222 follow-up: the six secondary name fields (First/Last
                // Name stay permanently visible, unchanged, matching the
                // same exception the focus profile already has) now get
                // the same content-aware hiddenRowAttrs() treatment as
                // every other secondary field - previously these had NO
                // rowAttrs at all, so they never respected the eyeball for
                // family members even after the focus-profile fix.
                membersstring +=
                    buildTextFieldRow("Title:", "title", nameval.prefix, isChecked(nameval.prefix, scored, false, ""), isEnabled(nameval.prefix, scored, false, ""), i + "_geni_title", null, undefined, undefined, ' ' + hiddenRowAttrs(hidden, isValue(nameval.prefix))) +
                    buildTextFieldRow("First Name:", "first_name", nameval.firstName, isChecked(nameval.firstName, scored, false, ""), isEnabled(nameval.firstName, scored, false, ""), i + "_geni_first_name") +
                    buildTextFieldRow("Middle Name:", "middle_name", nameval.middleName, isChecked(nameval.middleName, scored, false, ""), isEnabled(nameval.middleName, scored, false, ""), i + "_geni_middle_name", null, undefined, undefined, ' ' + hiddenRowAttrs(hidden, isValue(nameval.middleName))) +
                    buildTextFieldRow("Last Name:", "last_name", nameval.lastName, (lastNameAutoFilled ? lastNameInitialChecked : isChecked(nameval.lastName, scored, false, "")), (lastNameAutoFilled ? 'data-guessed="true"' : isEnabled(nameval.lastName, scored, false, "")), i + "_geni_last_name") +
                    buildTextFieldRow("Birth Name:", "maiden_name", nameval.birthName, isChecked(nameval.birthName, scored, false, ""), isEnabled(nameval.birthName, scored, false, ""), i + "_geni_maiden_name", null, undefined, undefined, ' ' + hiddenRowAttrs(hidden, isValue(nameval.birthName))) +
                    buildTextFieldRow("Suffix: ", "suffix", nameval.suffix, isChecked(nameval.suffix, scored, false, ""), isEnabled(nameval.suffix, scored, false, ""), i + "_geni_suffix", null, undefined, undefined, ' ' + hiddenRowAttrs(hidden, isValue(nameval.suffix))) +
                    buildTextFieldRow("Display Name: ", "display_name", displayname, isChecked(displayname, scored, false, ""), isEnabled(displayname, scored, false, ""), i + "_geni_display_name", null, undefined, undefined, ' ' + hiddenRowAttrs(hidden, isValue(displayname))) +
                    buildTextFieldRow("Also Known As: ", "nicknames", nameval.nickName, isChecked(nameval.nickName, scored, false, ""), isEnabled(nameval.nickName, scored, false, ""), i + "_geni_nicknames", i + "_geni_nickimage", undefined, undefined, ' ' + hiddenRowAttrs(hidden, isValue(nameval.nickName)));
                if (exists(members[member]["occupation"])) {
                    var occupation = members[member]["occupation"].trim();
                    membersstring = membersstring + buildTextFieldRow("Occupation: ", "occupation", occupation, isChecked(occupation, scored, false, ""), isEnabled(occupation, scored, false, ""), i + "_geni_occupation");
                } else {
                    membersstring = membersstring + '<tr ' + hiddenRowAttrs(hidden, false) + ' id="occupation"><td class="profilediv"><input type="checkbox" class="checknext">Occupation: </td><td style="float:right; padding: 0px;"><input type="text" class="formtext" name="occupation" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_occupation" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
                }
                membersstring = membersstring + '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(gender, scored) + '>Gender: </td><td style="float:right; padding-bottom: 2px; padding-top: 0px; padding-right: 0px;"><select class="formselect genderselect" update="'+ i + '" relationship="' + relationship + '" style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="gender" ' + isEnabled(gender, scored) + '>' +
                    '<option value="male" ' + setGender("male", gender) + '>Male</option><option value="female" ' + setGender("female", gender) + '>Female</option><option value="unknown" ' + setGender("unknown", gender) + '>Unknown</option></select></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_gender" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                    '<tr><td class="profilediv"><input type="checkbox" class="checknext" ' + isChecked(living, scored) + '>Vital: </td><td style="float:right; padding-bottom: 2px; padding-top: 0px; padding-right: 0px;"><select class="formselect livingselect" data-scraped="' + livingScraped + '" update="'+ i + '"  style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="is_alive" ' + isEnabled(living, scored) + '>' +
                    '<option value=false ' + setLiving("deceased", living) + '>Deceased</option><option value=true ' + setLiving("living", living) + '>Living</option></select></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_is_alive" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
                var memberBirthYear = undefined;
                if (exists(members[member]["birth"]) && exists(members[member]["birth"][0]) && exists(members[member]["birth"][0]["date"])) {
                    memberBirthYear = moment(members[member]["birth"][0]["date"], getDateFormat(members[member]["birth"][0]["date"])).get('year');
                }
                // currentlyPublic can't be known yet at render time - which
                // existing Geni profile this member matches, if any, is only
                // resolved once the user picks something in the Action
                // picker above (defaults to "add"/no match). Rendered here
                // as not-yet-public (undefined); setGeniFamilyData() below
                // re-resolves this via getGeniData(profile, "public") and
                // rebuilds this row every time the Action picker's selected
                // match changes, so it stays correct as the user picks
                // different matches. data-birthyear carries memberBirthYear
                // through to that recompute, since it's not otherwise
                // available outside this closure.
                var memberPrivacy = buildPrivacySelect(living, memberBirthYear, undefined);
                membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td class="profilediv"><input id="' + i + '_public_checkbox" type="checkbox" class="checknext" ' + (memberPrivacy.enabled ? "checked" : "") + '>Privacy: </td><td style="float:right; padding: 0;"><select class="formselect privacyselect" update="'+ i + '" data-birthyear="' + (exists(memberBirthYear) ? memberBirthYear : "") + '" style="width: 152px; height: 24px; -webkit-appearance: menulist-button;" name="public" ' + (memberPrivacy.enabled ? "" : "disabled") + '>' +
                    memberPrivacy.options + '</select></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_public" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
                // The genislideinput below (missing until now) is what lets
                // refreshFieldCheckState()/parseForm()'s no-op skip see
                // Geni's actual About text for this field, same as every
                // other field's own hidden comparison input - without it,
                // an empty-but-present scraped About value could start
                // pre-checked (per the blank-scraped/blank-Geni rule above)
                // and never get re-protected once a real match with
                // existing bio text is picked.
                if (exists(members[member].about)) {
                    var about = members[member].about;
                    // #210: escapes `about` before it reaches the textarea's text content.
                    membersstring = membersstring + buildAboutFieldRow({
                        value: about,
                        checkedAttr: isChecked(about, scored, false, ""),
                        enabledAttr: isEnabled(about, scored, false, ""),
                        icon: "right.png",
                        divStyle: "width: 100%; font-size: 80%;",
                        geniInputId: i + "_geni_about"
                    });
                } else {
                    membersstring = membersstring + '<tr ' + hiddenRowAttrs(hidden, false) + ' id="about"><td colspan="3"><div class="profilediv" style="width: 100%; font-size: 80%;"><input type="checkbox" class="checknext">About:<img class="genisliderow" src="images/right.png" align="right" style="width: 12px; margin-right: 3px; margin-top: 5px;"><input id="' + i + '_geni_about" type="text" class="formtext genislideinput" value="" disabled style="display:none;"></div><div style="padding-top: 2px; padding-left:4px; padding-right:6px;"><textarea rows="4" name="about_me" style="width:100%;"  disabled></textarea></div></td></tr>';
                }
                for (var list in listvalues) if (listvalues.hasOwnProperty(list)) {
                    var title = listvalues[list];
                    if ((relationship !== "partner" && relationship !== "parent") && (title === "marriage" || title === "divorce")) {
                        continue;  //Skip marriage date fields if not partner
                    }
                    var memberobj = members[member][title];
                    if (exists(memberobj) && memberobj.length > 0) {
                        membersstring = membersstring + '<tr><td colspan="3"><div class="separator"></div></td></tr>';
                        var dateadded = false;
                        var locationadded = false;
                        var locationval = "";
                        for (var item in memberobj) if (memberobj.hasOwnProperty(item)) {
                            if (exists(memberobj[item].date)) {
                                var dateval = memberobj[item].date;
                                var dateambig = "";
                                if (dateAmbigous(dateval)) {
                                    dateambig = 'style="color: #ff0000;" ';
                                    ambigdatecheck.push(i);
                                }
                                // #208: scored here is the whole-member-
                                // level value shared by every field row
                                // (name, gender, living, birth, etc.) -
                                // forcing it globally for an estimated field
                                // would incorrectly auto-check unrelated
                                // fields too, so this override is scoped to
                                // just this row's own isChecked()/isEnabled()
                                // call via a local fieldScored, not scored
                                // itself. Same reasoning as the focus-profile
                                // equivalent above - an injected estimate
                                // (birth/baptism/marriage/death/burial, all
                                // #208) was never scraped, so nothing else
                                // would otherwise mark it as checkable.
                                var fieldScored = scored;
                                if (exists(memberobj[item].estimated) && memberobj[item].estimated === true) {
                                    fieldScored = true;
                                }
                                // #230 (was hardcoded ""): matchedCandidateForEstimate is
                                // the same matched Geni node already resolved once per
                                // member above (used by the birth/marriage/baptism
                                // Geni-blank computation gates) - reading this title's
                                // real value from it here closes the gap where an
                                // estimated field could get pre-checked (and submitted)
                                // even though Geni already has real data for this
                                // family member, live-reported on a locked-profile case
                                // where a computed marriage estimate was submitted and
                                // rejected by Geni for permissions, when Geni's own
                                // (inaccessible-to-us-until-now) value should have kept
                                // it unchecked. No match found still falls back to ""
                                // (new-to-Geni member, safe to default-check).
                                var geniFieldValue = exists(matchedCandidateForEstimate) ?
                                    matchedCandidateForEstimate.get(title, "date.formatted_date") : "";
                                // #210: escapes dateval before it reaches value="...".
                                membersstring = membersstring + buildDateFieldRow({
                                    label: capFL(title),
                                    fieldName: title,
                                    value: dateval,
                                    checkedAttr: isCheckedDateField(dateval, fieldScored, geniFieldValue, undefined, exists(memberobj[item].estimated) && memberobj[item].estimated === true),
                                    enabledAttr: isEnabled(dateval, fieldScored, false, geniFieldValue),
                                    dateambig: dateambig,
                                    geniInputId: i + "_geni_" + title + "_date",
                                    imgIdAttr: ' imgid="' + i + '"',
                                    labelSuffix: " "
                                });
                                dateadded = true;
                            }
                            if (exists(memberobj[item].location)) {
                                var place = memberobj[item].location;
                                var geovar2 = geolocation[memberobj[item].id];
                                var pincolor = "clear";
                                var pintitle = "";
                                if (geovar2 === undefined) {
                                    geovar2 = parseGoogle("");
                                }
                                if (geovar2.ambiguous || geovar2.count > 1) {
                                    pincolor = "yellow";
                                    pintitle = "Location lookup may be incorrect";
                                    membersstring = membersstring.replace('id="' + i + 'gpin" src="images/clearpin.png"', 'id="' + i + 'gpin" src="images/yellowpin.png" title="Location lookup may be incorrect"');
                                } else if (geovar2.count === 0) {
                                    pincolor = "red";
                                    pintitle = "Location lookup failed";
                                    membersstring = membersstring.replace('id="' + i + 'gpin" src="images/clearpin.png"', 'id="' + i + 'gpin" src="images/redpin.png" title="Location lookup failed"');
                                }
                                var placegeo = geovar2.place;
                                var city = geovar2.city;
                                var county = geovar2.county;
                                var state = geovar2.state;
                                var country = geovar2.country;
                                // #229: same as the focus profile block above.
                                var latitude = exists(geovar2.latitude) ? geovar2.latitude : "";
                                var longitude = exists(geovar2.longitude) ? geovar2.longitude : "";
                                // #223/#224 follow-up: same per-item default
                                // as the focus profile block above - see its
                                // comment for the full reasoning.
                                var hasGeoFields = isValue(city) || isValue(county) || isValue(state) || isValue(country);
                                var geoone = ($('#forcegeoswitch').prop('checked') && hasGeoFields);
                                var itemGeoplace = hasGeoFields ? "none" : "table-row";
                                var itemGeoauto = hasGeoFields ? "table-row" : "none";
                                var itemGeoicon = hasGeoFields ? "geoon.png" : "geooff.png";
                                var itemGeoplacehidden = hasGeoFields ? " geohidden" : "";
                                var itemGeolochidden = hasGeoFields ? "" : " geohidden";
                                var placeScored = scored && !geoAnySourceEnabled();
                                var geoScored = scored && geoAnySourceEnabled();
                                // #229 follow-up: same parenthesized treatment
                                // as the focus profile block above.
                                if (hasGeoFields && placegeo !== "") {
                                    placegeo = "(" + placegeo + ")";
                                }
                                // #224: same rule as the focus profile block
                                // above - see its own comment.
                                var itemPlaceNameValue = hasGeoFields ? computeLeftoverPlaceName(place, geovar2) : place;
                                // #229 follow-up: same parenthesized-leftover
                                // treatment as the focus profile block above.
                                if (hasGeoFields && itemPlaceNameValue !== "") {
                                    itemPlaceNameValue = "(" + itemPlaceNameValue + ")";
                                }
                                locationval = locationval +
                                    '<tr id="'+ i + "_" +title+'"><td colspan="3" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-right: 2px; padding-left: 5px;"><input style="float: left; margin-left: -1px;" type="checkbox" class="geotopcheck">' +
                                    '<img class="geoicon" style="cursor: pointer; float:left; padding-left: 3px; padding-top: 2px; padding-right: 4px;" alt="Toggle Geolocation" title="Toggle Geolocation" src="images/' + itemGeoicon + '" height="14px">';
                                    if (geoAnySourceEnabled()) {
                                        locationval = locationval + '<img src="images/edit.png" title="Edit Location" class="geoUpdateBtn" align="right" style="cursor: pointer; height: 14px; margin-top: 2px; margin-right: 3px;">';
                                    }
                                    locationval = locationval + '<img class="geopin" src="images/' + pincolor + 'pin.png" align="right" title="' + pintitle + '" style="height: 14px; margin-top: 2px;">' + capFL(title) + ' Location: &nbsp;' + place.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</div></td></tr>' +
                                    buildLocationFieldRow({
                                        trClass: "geoplace" + itemGeoplacehidden, displayVal: itemGeoplace,
                                        checkedAttr: isChecked(itemPlaceNameValue, placeScored, false, ""),
                                        enabledAttr: isEnabled(itemPlaceNameValue, placeScored, false, ""),
                                        label: Abbr(capFL(title)) + " Place: ", tdStyle: "float:right;",
                                        fieldName: title + ":location:place_name", value: itemPlaceNameValue,
                                        geniInputId: i + "_geni_" + title + "_location_string"
                                    }) +
                                    buildLocationFieldRow({
                                        trClass: "geoloc" + itemGeolochidden, displayVal: itemGeoauto,
                                        checkedAttr: isChecked(placegeo, geoScored, geoone, ""),
                                        enabledAttr: isEnabled(placegeo, geoScored, geoone, ""),
                                        label: "Place: ", tdStyle: "float:right;",
                                        fieldName: title + ":location:place_name_geo", value: placegeo,
                                        geniInputId: i + "_geni_" + title + "_place"
                                    }) +
                                    buildLocationFieldRow({
                                        trClass: "geoloc" + itemGeolochidden, displayVal: itemGeoauto,
                                        checkedAttr: isChecked(city, geoScored, geoone, ""),
                                        enabledAttr: isEnabled(city, geoScored, geoone, ""),
                                        label: "City: ", tdStyle: "float:right;",
                                        fieldName: title + ":location:city", value: city,
                                        geniInputId: i + "_geni_" + title + "_city"
                                    }) +
                                    buildLocationFieldRow({
                                        trClass: "geoloc" + itemGeolochidden, displayVal: itemGeoauto,
                                        checkedAttr: isChecked(county, geoScored, geoone, ""),
                                        enabledAttr: isEnabled(county, geoScored, geoone, ""),
                                        label: "County: ", tdStyle: "float:right;",
                                        fieldName: title + ":location:county", value: county,
                                        geniInputId: i + "_geni_" + title + "_county"
                                    }) +
                                    buildLocationFieldRow({
                                        trClass: "geoloc" + itemGeolochidden, displayVal: itemGeoauto,
                                        checkedAttr: isChecked(state, geoScored, geoone, ""),
                                        enabledAttr: isEnabled(state, geoScored, geoone, ""),
                                        label: "State: ", tdStyle: "float:right;",
                                        fieldName: title + ":location:state", value: state,
                                        geniInputId: i + "_geni_" + title + "_state"
                                    }) +
                                    buildLocationFieldRow({
                                        trClass: "geoloc" + itemGeolochidden, displayVal: itemGeoauto,
                                        checkedAttr: isChecked(country, geoScored, geoone, ""),
                                        enabledAttr: isEnabled(country, geoScored, geoone, ""),
                                        label: "Country: ", tdStyle: "float:right;",
                                        fieldName: title + ":location:country", value: country,
                                        geniInputId: i + "_geni_" + title + "_country"
                                    }) +
                                    buildLocationFieldRow({
                                        trClass: "geoloc" + itemGeolochidden, displayVal: itemGeoauto,
                                        checkedAttr: isChecked(latitude, geoScored, geoone, ""),
                                        enabledAttr: isEnabled(latitude, geoScored, geoone, ""),
                                        label: "Latitude: ", tdStyle: "float:right;",
                                        fieldName: title + ":location:latitude", value: String(latitude),
                                        geniInputId: i + "_geni_" + title + "_latitude"
                                    }) +
                                    buildLocationFieldRow({
                                        trClass: "geoloc" + itemGeolochidden, displayVal: itemGeoauto,
                                        checkedAttr: isChecked(longitude, geoScored, geoone, ""),
                                        enabledAttr: isEnabled(longitude, geoScored, geoone, ""),
                                        label: "Longitude: ", tdStyle: "float:right;",
                                        fieldName: title + ":location:longitude", value: String(longitude),
                                        geniInputId: i + "_geni_" + title + "_longitude"
                                    });
                                locationadded = true;
                            }
                        }
                        if (!dateadded) {
                            var dateambig = "";
                            if (dateAmbigous(dateval)) {
                                dateambig = 'style="color: #ff0000;" ';
                                ambigdatecheck.push(i);
                            }
                            membersstring = membersstring +
                                '<tr ' + hiddenRowAttrs(hidden, false) + '><td class="profilediv"><input type="checkbox" class="checknext">' + capFL(title) + ' Date: </td><td style="float:right;"><input type="text" imgid="' + i + '" class="formtext dateform" ' + dateambig + 'name="' + title + ':date" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_date" type="text" class="formtext genislideinput" value="" disabled></td></tr>';

                        }
                        if (title === "death") {
                            membersstring = membersstring + '<tr ' + hiddenRowAttrs(hidden, false) + '><td class="profilediv"><input type="checkbox" class="checknext">Death Cause: </td><td style="float:right;"><input type="text" class="formtext" name="cause_of_death" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_cause_of_death" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
                        }
                        if (!locationadded) {
                            // #35 follow-up: same fix as the focus profile's
                            // equivalent block above - missing data-hasvalue
                            // (stuck the eyeball's close action from ever
                            // re-hiding these once shown) and missing
                            // Latitude/Longitude entirely.
                            locationval = locationval +
                                '<tr id="'+ i + "_" +title+'" class="hiddenrow" data-hasvalue="false" style="display: ' + isHidden(hidden) + ';"><td colspan="3" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-right: 2px; padding-left: 5px;"><input style="float: left; margin-left: -1px;" type="checkbox" class="geotopcheck">' +
                                '<img class="geoicon" style="cursor: pointer; float:left; padding-left: 3px; padding-top: 2px; padding-right: 4px;" src="images/' + geoicon + '" alt="Toggle Geolocation" title="Toggle Geolocation" height="14px">';
                                if (geoAnySourceEnabled()) {
                                    locationval = locationval + '<img src="images/edit.png" title="Edit Location" class="geoUpdateBtn" align="right" style="cursor: pointer; height: 14px; margin-top: 2px; margin-right: 3px;">';
                                }
                                locationval = locationval + '<img class="geopin" src="images/clearpin.png" align="right" title="" style="height: 14px; margin-top: 2px;">' + capFL(title) + ' Location: &nbsp;Unknown</div></td></tr>' +
                                '<tr class="geoplace hiddenrow' +  geoplacehidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "place") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">' + Abbr(capFL(title)) + ' Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_location_string" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                                '<tr class="geoloc hiddenrow' +  geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name_geo" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_place" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                                '<tr class="geoloc hiddenrow' +  geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">City: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:city" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_city" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                                '<tr class="geoloc hiddenrow' +  geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">County: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:county" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_county" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                                '<tr class="geoloc hiddenrow' +  geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">State: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:state" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_state" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                                '<tr class="geoloc hiddenrow' +  geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Country: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:country" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_country" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                                '<tr class="geoloc hiddenrow' +  geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Latitude: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:latitude" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_latitude" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                                '<tr class="geoloc hiddenrow' +  geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Longitude: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:longitude" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_longitude" type="text" class="formtext genislideinput" value="" disabled></td></tr>';

                        }
                        membersstring = membersstring + locationval;
                    } else {
                        membersstring = membersstring + '<tr style="display: ' + isHidden(hidden) + ';" class="hiddenrow"><td colspan="3"><div class="separator"></div></td></tr>';

                        membersstring = membersstring + '<tr ' + hiddenRowAttrs(hidden, false) + '><td class="profilediv"><input type="checkbox" class="checknext">' + capFL(title) + ' Date: </td><td style="float:right;"><input type="text" imgid="' + i + '" class="formtext dateform" name="' + title + ':date" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_date" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
                        if (title === "death") {
                            membersstring = membersstring + '<tr ' + hiddenRowAttrs(hidden, false) + '><td class="profilediv"><input type="checkbox" class="checknext">Death Cause: </td><td style="float:right;"><input type="text" class="formtext" name="cause_of_death" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_cause_of_death" type="text" class="formtext genislideinput" value="" disabled></td></tr>';
                        }
                        // #35 follow-up: same missing data-hasvalue +
                        // missing Latitude/Longitude bug as the family
                        // member's !locationadded fallback above - this is
                        // the SEPARATE "title has zero data at all" branch
                        // (obj doesn't exist), which is what fires for e.g.
                        // a newly-added spouse's own blank Divorce fields.
                        membersstring = membersstring +
                            '<tr id="'+ i + "_" +title+'" class="hiddenrow" data-hasvalue="false" style="display: ' + isHidden(hidden) + ';"><td colspan="3" style="font-size: 90%;"><div class="membertitle" style="margin-top: 4px; margin-right: 2px; padding-left: 5px;"><input style="float: left; margin-left: -1px;" type="checkbox" class="geotopcheck">' +
                            '<img class="geoicon" style="cursor: pointer; float:left; padding-left: 3px; padding-top: 2px; padding-right: 4px;" src="images/' + geoicon + '" alt="Toggle Geolocation" title="Toggle Geolocation" height="14px">';
                            if (geoAnySourceEnabled()) {
                                membersstring = membersstring + '<img src="images/edit.png" title="Edit Location" class="geoUpdateBtn" align="right" style="cursor: pointer; height: 14px; margin-top: 2px; margin-right: 3px;">';
                            }
                            membersstring = membersstring +'<img class="geopin" src="images/clearpin.png" align="right" title="" style="height: 14px; margin-top: 2px;">' + capFL(title) + ' Location: &nbsp;Unknown</div></td></tr>' +
                            '<tr class="geoplace hiddenrow' + geoplacehidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "place") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">' + Abbr(capFL(title)) + ' Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_location_string" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow' +  geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Place: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:place_name_geo" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_place" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow' +  geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">City: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:city" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_city" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow' +  geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">County: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:county" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_county" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow' +  geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">State: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:state" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_state" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow' +  geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Country: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:country" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_country" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow' +  geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Latitude: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:latitude" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_latitude" type="text" class="formtext genislideinput" value="" disabled></td></tr>' +
                            '<tr class="geoloc hiddenrow' +  geolochidden + '" data-hasvalue="false" style="display: ' + isHidden(hidden, "loc") + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext">Longitude: </td><td style="float:right;"><input type="text" class="formtext" name="' + title + ':location:longitude" disabled></td><td class="genisliderow"><img src="images/right.png" class="genislideimage"><input id="' + i + '_geni_' + title + '_longitude" type="text" class="formtext genislideinput" value="" disabled></td></tr>';

                    }
                }
            }
            membersstring = membersstring + '</table></div>';
            $(entry).html(membersstring);
            for (var i=0;i<ambigdatecheck.length;i++) {
                $("#" + ambigdatecheck[i] + "errordate").show();
            }
            //log("  " + members[member].name);
            icount ++;
        }
        if (scoreused) {
            if (childck) {
                $('#addchildck').prop('checked', true);
            } else if (sibcheck) {
                $('#addsiblingck').prop('checked', true);
            } else if (parentck) {
                $('#addparentck').prop('checked', true);
            } else if (partnerck) {
                $('#addpartnerck').prop('checked', true);
            }
        }
    }

    iconUpdate();
    updateClassResponse();
    placementUpdate();
    if ($('#genislideonoffswitch').prop('checked')) {
        $(".genisliderow").not(".genihidden").slideToggle();
    }

    if ($("#parent")[0].style.display === "block") {
        var father = null;
        var mother = null;
        for (var p = 0; p < databyid.length; p++) {
            var relation;
            if (exists(databyid[p])) {
                if (exists(databyid[p].status)) {
                    relation = databyid[p].status;
                } else if (exists(databyid[p].title)) {
                    relation = databyid[p].title;
                }
                if (exists(relation) && isParent(relation)) {
                    if (databyid[p].gender === "male") {
                        father = NameParse.parse(databyid[p].name);
                    } else if (databyid[p].gender === "female") {
                        mother = NameParse.parse(databyid[p].name);
                    } else if (!exists(father)) {
                        father = NameParse.parse(databyid[p].name);
                    } else {
                        mother = NameParse.parse(databyid[p].name);
                    }
                }
            }
        }
        var genisearchurl = "https://www.geni.com/search";
        if (exists(father) && exists(mother)) {
            var mname = "&partner_names=";
            if (mother.birthName !== "" && mother.birthName !== father.lastName) {
                mname += mother.birthName;
            } else if (mother.lastName !== father.lastName) {
                mname += mother.lastName;
            } else {
                mname += mother.firstName;
            }
            genisearchurl += "?names=" + father.firstName + "+" + father.lastName + mname;
        } else if (exists(father)) {
            genisearchurl += "?names=" + father.firstName + "+" + father.lastName;
        } else if (exists(mother)) {
            var mname = "";
            if (mother.birthName !== "") {
                mname = mother.birthName;
            } else {
                mname = mother.lastName;
            }
            genisearchurl += "?names=" + mother.firstName + "+" + mname;
        } else {
            genisearchurl += "/advanced";
        }
        $("#genisearch").attr("href", genisearchurl);
        $("#parentsearch").show();
    }

    if (icount > 0 && accountinfo.user) {
        document.getElementById("familydata").style.display = "block";
        document.getElementById("genislider").style.display = "block";
    }
    document.getElementById("bottomsubmit").style.display = "block";
    parsecomplete = true;
    console.log("Process Complete...");
}

function isValue(object) {
    return (object !== "");
}

// #217: whether a field's OWN current value represents "no real data," for
// Select All purposes. Text/textarea use isValue() (blank == ""); Gender's
// <select> uses its literal "unknown" option as its blank state; Living's
// <select> has no blank option at all (Deceased/Living are both real
// values) so its blank state is tracked via data-scraped, stamped at
// render time on the "Vital:" row (see the family-member render loop).
function isFieldValueBlank(field) {
    if (field.tagName === "SELECT" && field.name === "gender") {
        return field.value === "unknown";
    }
    if (field.tagName === "SELECT" && field.name === "is_alive") {
        return $(field).attr("data-scraped") !== "true";
    }
    // #204 follow-up: a married-name guess (data-guessed, stamped by
    // buildform.js's family-member Last Name row when lastNameAutoFilled)
    // isn't real scraped data, so for Select All purposes it should be
    // treated exactly like an unscraped blank field - safe to check only
    // when Geni's own value (the companion check right after this,
    // isCompanionBlank()) is ALSO blank, never when it'd override real
    // Geni data with a guess.
    if ($(field).attr("data-guessed") === "true") {
        return true;
    }
    return !isValue(field.value);
}

// #217: whether a row's .genislideinput companion represents "Geni has no
// real data here." "" for every field type except Gender, whose companion
// is always capFL()'d, so "no data" displays as the literal string
// "Unknown" rather than "".
function isCompanionBlank(companionVal, field) {
    if (!exists(companionVal) || companionVal === "") {
        return true;
    }
    return field.tagName === "SELECT" && field.name === "gender" && companionVal === "Unknown";
}

// German transliteration is a deterministic convention, not a stylistic
// choice: each umlaut expands to the vowel followed by "e" (and the
// sharp-s expands to "ss") whenever the umlaut character itself isn't
// available - so "Loeb" and its umlaut-spelled form represent the
// identical name. One-directional (umlaut -> expanded) so an
// already-ASCII name on either side just passes through unchanged.
// See issue #190.
function normalizeGermanic(s) {
    return (s || "").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

/**
 * @return {string}
 */
function Abbr(title) {
    if (title === "Baptism") {
        return "Bapt.";
    } else {
        return title;
    }
}

function iconUpdate() {
    $('.actionselect').off();
    $('.actionselect').on('change', function () {
        actionUpdate(this);
    });
    for (var property in genibuildaction) {
        if (genibuildaction.hasOwnProperty(property)) {
            setGeniFamilyData(genibuildaction[property], property);
        }
    }
    genibuildaction = {};
}

function actionUpdate(object) {
    var id = $(object).closest("table")[0].id.replace("familytable_", "");
    var actionicon = $(document.getElementById("familytable_" + id)).closest("div").prev().find(".iconaction");
    var profile = $(object)[0].value;
    if (profile === "add") {
        actionicon.attr('src','images/add.png');
        actionicon.attr('title','add');
        actionicon.attr('description','add');
    } else {
        actionicon.attr('src','images/update.png');
        actionicon.attr('title','update');
        actionicon.attr('description','update');
    }
    let namelang = getGeniData(profile, "name_language");
    if (namelang !== "en-US" && namelang !== "") {
        $("#" + id + "_geni_name_language").val(namelang);
    }
    setGeniFamilyData(id, profile);
}

function updateClassResponse() {
    $('.genderselect').off();
    $(function () {
        $('.genderselect').on('change', function () {
            var genselect = $(this);
            if (exists(genselect[0].attributes.relationship)) {
                //Only run it on family members
                var gender = genselect[0].options[genselect[0].selectedIndex].value;
                $('#action'+genselect[0].attributes.update.value).html(buildAction(genselect[0].attributes.relationship.value, gender));
                iconUpdate();
                var gendercolor = genderColor(gender);
                genselect.closest('.memberexpand').prev('.membertitle').css('background-color', gendercolor);
            }
        });
    });

    $('.language_select').off();
    $(function () {
        $('.language_select').on('change', function () {
            let id = $(this).attr("id").replace("_geni_name_language","");
            if (id === "profilelanguage") {
                let namelang = $(this).val();
                var nameicon = "images/" + genifocusdata.lockIcon("name");
                $("#focus_geni_title").val(genifocusdata.get("names", namelang + ".title"));
                $("#focus_geni_title").prev().attr('src', nameicon);
                $("#focus_geni_first_name").val(String(genifocusdata.get("names", namelang + ".first_name")).replace(/&quot;/g, '"'));
                $("#focus_geni_first_name").prev().attr('src', nameicon);
                $("#focus_geni_middle_name").val(String(genifocusdata.get("names", namelang + ".middle_name")).replace(/&quot;/g, '"'));
                $("#focus_geni_middle_name").prev().attr('src', nameicon);
                $("#focus_geni_last_name").val(genifocusdata.get("names", namelang + ".last_name"));
                $("#focus_geni_last_name").prev().attr('src', nameicon);
                $("#focus_geni_maiden_name").val(genifocusdata.get("names", namelang + ".maiden_name"));
                $("#focus_geni_maiden_name").prev().attr('src', nameicon);
                $("#focus_geni_suffix").val(genifocusdata.get("names", namelang + ".suffix"));
                $("#focus_geni_suffix").prev().attr('src', nameicon);
                $("#focus_geni_display_name").val(String(genifocusdata.get("names", namelang + ".display_name")).replace(/&quot;/g, '"'));
                $("#focus_geni_display_name").prev().attr('src', nameicon);
                $("#focus_geni_nicknames").val(genifocusdata.get("nicknames"));
            } else {
                let profile = $("#action" + id).find("select").val();
                var nameicon = getGeniLock(profile, "name");
                let namelang = $("#" + id + "_geni_name_language").val();
                $("#" + id + "_geni_photo_urls").attr('src', getGeniData(profile, "photo_urls"));
                $("#" + id + "_geni_mugshot").attr('src', isAppend(getGeniData(profile, "photo_urls")));
                $("#" + id + "_geni_title").val(getGeniData(profile,  "names", namelang + ".title"));
                $("#" + id + "_geni_title").prev().attr('src', nameicon);
                $("#" + id + "_geni_first_name").val(String(getGeniData(profile, "names", namelang + ".first_name")).replace(/&quot;/g, '"'));
                $("#" + id + "_geni_first_name").prev().attr('src', nameicon);
                $("#" + id + "_geni_middle_name").val(String(getGeniData(profile, "names", namelang + ".middle_name")).replace(/&quot;/g, '"'));
                $("#" + id + "_geni_middle_name").prev().attr('src', nameicon);
                $("#" + id + "_geni_last_name").val(getGeniData(profile, "names", namelang + ".last_name"));
                $("#" + id + "_geni_last_name").prev().attr('src', nameicon);
                $("#" + id + "_geni_maiden_name").val(getGeniData(profile, "names", namelang + ".maiden_name"));
                $("#" + id + "_geni_maiden_name").prev().attr('src', nameicon);
                $("#" + id + "_geni_suffix").val(getGeniData(profile, "names", namelang + ".suffix"));
                $("#" + id + "_geni_suffix").prev().attr('src', nameicon);
                $("#" + id + "_geni_display_name").val(String(getGeniData(profile, "names", namelang + ".display_name")).replace(/&quot;/g, '"'));
                $("#" + id + "_geni_display_name").prev().attr('src', nameicon);
                $("#" + id + "_geni_nicknames").val(getGeniData(profile, "nicknames"));
            }
        });
    });

    $('.livingselect').off();
    $(function () {
        $('.livingselect').on('change', function () {
            var livingselect = $(this);
            if (exists(livingselect[0].attributes.update)) {
                var id = livingselect[0].attributes.update.value;
                //Option value is returned as a string, not boolean - will fail if you treat it as boolean
                if (livingselect[0].options[livingselect[0].selectedIndex].value === "true") {
                    $('#ribbon'+ id).hide();
                } else {
                    $('#ribbon'+ id).show();
                }
                refreshPrivacySelect(id);
            }
        });
    });
    $(function () {
        $('.dateform').on('input', function () {
            var datefield = $(this);
            var imgid = $(this).attr("imgid");
            if (dateAmbigous(datefield.val())) {
                $(this).css("color", "#ff0000");
                if (exists(imgid)) {
                    $("#" + imgid + "errordate").show();
                }
            } else {
                $(this).css("color", "#000");
                if (exists(imgid)) {
                    $("#" + imgid + "errordate").hide();
                }
            }
        });
    });
    $('.expandcontrol').off();
    $(function () {
        $('.expandcontrol').on('click', function () {
            expandFamily($(this).attr("name"));
        });
    });

    $('.checknext').off();
    $(function () {
        $('.checknext').on('click', function () {
            $(this).closest('tr').find('input[type="text"],select,input[type="hidden"],textarea').not(".genislideinput").not(".parentselector").attr("disabled", !this.checked);
            if (this.checked) {
                if ($(this).closest('tr').hasClass("geoloc") || $(this).closest('tr').hasClass("geoplace")) {
                    //This checks the geotopcheck when a child location is checked
                    var ps = $(this).closest('tr')[0].previousElementSibling;
                    while (exists(ps)) {
                        ps = $(ps)[0].previousElementSibling;
                        if (exists(ps) && ps.id !== "") {
                            $(ps).find('.geotopcheck').prop('checked', true);
                            break;
                        }
                    }
                }
                var personslide = $(this).closest('.memberexpand').prev('.membertitle');
                personslide.find('.checkslide').prop('checked', true);
                personslide.find('input[type="hidden"]').not(".genislideinput").attr('disabled', false);
                if($($(this).closest("fieldset")[0].parentElement)[0].id === "profileshadowdiv") {
                    $("#updateprofile").prop('checked', true);
                }
            }
        });
    });
    $('.geotopcheck').off();
    $(function () {
        $('.geotopcheck').on('click', function () {
            if (this.checked) {
                //Check the very top box
                var personslide = $(this).closest('.memberexpand').prev('.membertitle');
                personslide.find('.checkslide').prop('checked', true);
                personslide.find('input[type="hidden"]').not(".genislideinput").attr('disabled', false);
                if($($(this).closest("fieldset")[0].parentElement)[0].id === "profileshadowdiv") {
                    $("#updateprofile").prop('checked', true);
                }
            }
            var row = $(this).closest('tr');
            var icon = $(row.find("img")[0]).attr("src");
            row = $(row[0].nextElementSibling);
            if (icon === "images/geooff.png") {
                row.find('input[type="checkbox"]').prop('checked', this.checked);
                row.find('input[type="text"],select,input[type="hidden"],textarea').not(".genislideinput").not(".parentselector").attr("disabled", !this.checked);
            } else {
                // #229 follow-up: was 5 manually unrolled copies of this
                // same block (Place-geo/City/County/State/Country) - a real
                // bug surfaced from exactly this shape: adding the
                // Latitude/Longitude rows never updated this cascade, so
                // clicking the top "select all" checkbox for a location
                // silently skipped them. GEO_BREAKDOWN_ROW_COUNT is the one
                // number to update if a future row gets added here, instead
                // of remembering to copy-paste another block.
                var GEO_BREAKDOWN_ROW_COUNT = 7; // place_name_geo, city, county, state, country, latitude, longitude
                for (var r = 0; r < GEO_BREAKDOWN_ROW_COUNT; r++) {
                    row = $(row[0].nextElementSibling);
                    row.find('input[type="checkbox"]').prop('checked', this.checked);
                    row.find('input[type="text"],select,input[type="hidden"],textarea').not(".genislideinput").not(".parentselector").attr("disabled", !this.checked);
                }
            }
        });
    });
    $('.checkslide').off();
    $(function () {
        $('.checkslide').on('click', function () {
            applySelectAllState($("#" + this.name.replace("checkbox", "slide")), this.checked);
        });
    });
    $('.geoicon').off();
    $(function () {
        $('.geoicon').on('click', function () {
            var fs = $(this);
            // #229 follow-up (found during a full-codebase re-audit): this
            // handler had the exact same hardcoded-row-count bug that
            // .geotopcheck's own cascade had before the earlier
            // GEO_BREAKDOWN_ROW_COUNT fix (0a48a3a) - it only ever walked
            // 5 breakdown rows (place-geo/city/county/state/country),
            // never updated when Latitude/Longitude were added. Left as-is,
            // toggling this icon stranded Latitude/Longitude visible (and
            // still submittable) regardless of which view - flat or
            // structured - was actually showing. Reuses the same constant/
            // loop shape as that earlier fix.
            var GEO_BREAKDOWN_ROW_COUNT = 7; // place_name_geo, city, county, state, country, latitude, longitude
            var showingStructured = (fs.attr("src") === "images/geoon.png");
            fs.attr("src", showingStructured ? "images/geooff.png" : "images/geoon.png");
            var tb = $(this).closest('tr').next(); // the raw "Place" row
            tb[0].style.display = showingStructured ? "table-row" : "none";
            $(tb[0]).toggleClass("geohidden", !showingStructured);
            for (var r = 0; r < GEO_BREAKDOWN_ROW_COUNT; r++) {
                tb = tb.next();
                tb[0].style.display = showingStructured ? "none" : "table-row";
                $(tb[0]).toggleClass("geohidden", showingStructured);
            }
        });
    });
    $('.genimemslide').off();
    $('.genimemslide').on('click', function () {
        $('#'+ this.id + 'slide').slideToggle();
    });
    $('.ctrllink').off();
    $(function () {
        $('.ctrllink').on('click', function (event) {
            var ctrlpressed = (event.ctrlKey || event.metaKey);
            var url = $(this).attr('url');
            chrome.tabs.query({"currentWindow": true, "status": "complete", "windowType": "normal", "active": true}, function (tabs) {
            var tab = tabs[0];
                tabplacement += 1;
                var index = tab.index + tabplacement;
                chrome.tabs.create({'url': url, active: !ctrlpressed, 'index': index});
            });
        });
    });

    $('.geoUpdateBtn').off();
    $(function () {
        $('.geoUpdateBtn').on('click', function () {
            var id = $(this).closest("tr")[0].id;
            // #224 (live-reported): the edit textbox used to be seeded from
            // Row 1's CURRENT displayed input value - which, since this
            // session's leftover-diffing work, can be a computed,
            // parenthesized remainder ("(Potsdam, Preussen)") rather than
            // the actual original scraped text, or blank entirely when
            // nothing resolved (the Row 1 fallback's text input has no
            // value at all - see the blank-location fallback rows). The
            // revert button was already correctly using getParsedLocation()
            // (the true raw scraped text from alldata) - use the SAME
            // source for the edit textbox itself, so what's shown to edit
            // matches what "restore" restores, instead of the two
            // disagreeing.
            var parsedLocation = getParsedLocation(id);
            $('#georevertbtn').attr("value", parsedLocation);
            $('#geoupdatetext').val(parsedLocation);
            $('#geoupdatetext').attr("reference", id);
            // #233: only relevant to FamilySearch Places (Google's geocoder
            // has no per-lookup date concept) - defaults to the associated
            // date field's CURRENT live value (whatever the user may have
            // already edited this session), not whatever was originally
            // scraped, so a date correction made first is reflected here
            // without having to remember and retype it.
            if ($('#familysearchplacesonoffswitch').prop('checked')) {
                $('#geoupdateyear').val(getCurrentEventYear(id));
                $('#geoupdateyearrow').css('display', 'block');
            } else {
                $('#geoupdateyearrow').css('display', 'none');
            }
            document.getElementById('GeoUpdateModal').style.display = "block";
            $("#geoupdatetext").focus();
        });
    });
    $('.showhide').off();
    $(function () {
        $('.showhide').on('click', function () {
            var value = $($(this)[0]);
            if (value.text() === SHOW_LESS_LABEL) {
                // #222: only re-collapse rows that are ACTUALLY blank
                // (data-hasvalue) - same reasoning as hideempty() in
                // popup.js, scoped to just this person's own table.
                $(this).closest("table").find('.hiddenrow[data-hasvalue="false"]').css("display", "none");
                value.text(SHOW_ALL_LABEL);
                value.attr("title", "Hiding Unused Fields");
            } else {
                if (geoAnySourceEnabled()) {
                    $(this).closest("table").find(".hiddenrow").not(".geoplace").css("display", "table-row");
                } else {
                    $(this).closest("table").find(".hiddenrow").not(".geoloc").css("display", "table-row");
                }
                value.text(SHOW_LESS_LABEL);
                value.attr("title", "Showing All Fields");
            }
        });
    });
}

function getParsedLocation(dataid) {
    var idsplit = dataid.split("_");
    var item = idsplit[1];
    var dataroot;
    if (idsplit[0] === "focus") {
        dataroot = alldata["profile"];
    } else {
        var id = parseInt(idsplit[0]);
        dataroot = databyid[id];
    }
    if (checkNested(dataroot, item, 1, "location")) {
        return dataroot[item][1]["location"];
    } else if (checkNested(dataroot, item, 0, "location")) {
        return dataroot[item][0]["location"];
    } else {
        return "";
    }
}

// #233: the year offered as a default in the manual location-edit modal's
// FamilySearch lookup override - reads the LIVE date input's current value
// (same id convention as getParsedLocation() above), not alldata's
// original scraped date, so a date the user already corrected this
// session is reflected here instead of a stale value they'd have to
// remember and retype.
function getCurrentEventYear(dataid) {
    var idsplit = dataid.split("_");
    var item = idsplit[1];
    var scope = (idsplit[0] === "focus") ? $("#profiletable") : $("#familytable_" + idsplit[0]);
    var dateInput = scope.find('[name="' + item + ':date"]');
    if (dateInput.length === 0) {
        return "";
    }
    var year = extractDateYear(dateInput.val());
    return exists(year) ? year : "";
}

function placementUpdate() {
    $('.unknownselect').on('change', function () {
        if (this.value !== "unknown") {
            var replacestring = "";
            //this.value
            var div = $("#" + this.value);
            var gender = $(this).attr("gender");
            if (exists(div[0])) {
                div[0].style.display = "block";
                var section1 = $(this).closest("div").prev();
                var section2 = $(this).closest("div");
                var unkop = $(section2).find('[name="unk"]')[0].outerHTML;
                $($(section2).find('[name="buildactionspan"]')[0]).html(buildAction(this.value, gender));
                $(section1.find("input")[0]).prop('disabled', false);
                $(section2.find('[name="act"]')[0]).css('display', "table-row");
                if (this.value === "child") {
                    $(section2.find('[name="parenttr"]')[0]).css('display', "table-row");
                    if (myhspouse.length === 0 && $('.parentselector')[0].length === 0) {
                        $('.parentselector')
                            .append($("<option/>", {
                                value: -1,
                                text: "Unknown"
                            }));
                    }
                }
                if (this.value === "partner") {
                    //Add the spouse to the list for children pulldowns
                    var famid = parseInt(section2[0].id.replace("-unknown", "").replace("slide", ""));
                    myhspouse.push(famid);
                    $('.parentselector')
                        .append($("<option/>", {
                            value: famid,
                            text: getProfileName(databyid[famid].name).replace("born ", "")
                        }));
                }
                replacestring = section1[0].outerHTML;
                replacestring += section2[0].outerHTML;
                replacestring = replacestring.replace(unkop, "");
                replacestring = replacestring.replace(/-unknown/g, "-" + this.value);
                replacestring = replacestring.replace('relationship="unknown"','relationship="' + this.value + '"');
                section1[0].outerHTML = "";
                section2[0].outerHTML = "";
                var section3 = $("#" + this.value + "val");
                $(section3[0]).append(replacestring);

            }
            if ($("#unknownval").is(":empty")) {
                $("#unknown").hide();
            }
            iconUpdate();
            actionUpdate($(this).closest("tbody").find(".actionselect")[0]);
            updateClassResponse();
        }
    });
}

// #210: shared builder for a single-line text-input field row (name
// parts, occupation, display name, etc.) - the same shape was previously
// hand-copy-pasted ~20+ times across the focus-profile and family-member
// templates, and NONE of those copies escaped the scraped value before
// concatenating it into the value="..." attribute (a real, live-confirmed
// attribute-breakout XSS - see issue #210). escapeHtml() runs here, in
// exactly one place, rather than being left to each call site to
// remember individually - that's the actual point of this consolidation,
// not just deduplication for its own sake. Geni-sourced companion values
// (geniValue) keep using their own existing, separate &quot;-only
// escaping from GeniPerson.get()/getGeniData() - untouched here, since
// #210 is scoped to scraped/external data specifically.
//
// geniInputId/geniImgId are optional - omit either to render that
// attribute out entirely, matching call sites that don't need an id on
// one or the other (most rows only need geniInputId; the "Also Known As"
// row is the one exception that also needs a distinct icon id).
//
// geniValue/icon are also optional, appended at the end so every existing
// call (family-member rows, which don't know the Geni value yet at
// render time and always use the same "right.png" placeholder) keeps
// working unchanged - default to "" and "right.png" respectively. The
// focus-profile rows are the one caller that needs both: geniValue is
// already known via genifocusdata at render time, and icon varies
// (nameimage/"append.png") depending on field/lock state.
//
// rowAttrs is the last optional param - lets the focus-profile "hidden
// when pre-1600/collapsed" variant wrap the <tr> with
// style="display: ...;" class="hiddenrow" without every other caller
// needing to pass an empty string for it.
function buildTextFieldRow(label, fieldName, value, checkedAttr, enabledAttr, geniInputId, geniImgId, geniValue, icon, rowAttrs, locked) {
    geniValue = escapeHtml(String(geniValue || "").replace(/&quot;/g, '"'));
    icon = icon || "right.png";
    rowAttrs = rowAttrs || "";
    var imgIdAttr = geniImgId ? ' id="' + geniImgId + '"' : '';
    var inputIdAttr = geniInputId ? ' id="' + geniInputId + '"' : '';
    // #78: a locked field's checkbox is disabled outright (not just the
    // text input) - isChecked()/isEnabled() already force it unchecked and
    // disabled respectively when locked, but the .checknext click handler
    // and applySelectAllState() both directly toggle the text input's
    // disabled state off of the CHECKBOX's own state, bypassing whatever
    // was rendered here unless the checkbox itself can't be interacted
    // with in the first place.
    var lockedAttr = locked ? 'disabled ' : '';
    return '<tr' + rowAttrs + '><td class="profilediv"><input type="checkbox" class="checknext" ' + lockedAttr + checkedAttr + '>' + label + '</td>' +
        '<td style="float:right; padding: 0px;"><input type="text" class="formtext" name="' + fieldName + '" value="' + escapeHtml(value) + '" ' + enabledAttr + '></td>' +
        '<td class="genisliderow"><img' + imgIdAttr + ' src="images/' + icon + '" class="genislideimage"><input' + inputIdAttr + ' type="text" class="formtext genislideinput" value="' + geniValue + '" disabled></td></tr>';
}

// #210: shared builder for a date-input field row (birth/baptism/death/
// burial/marriage/divorce, both focus profile and family members) - same
// unescaped-attribute-breakout issue buildTextFieldRow() above already
// fixes for text fields, just in the date-specific templates. Takes an
// options object rather than another long positional list - the two
// contexts differ in enough small ways (an imgid attribute the
// family-member variant needs for a JS lookup elsewhere, a row id vs.
// none, differing <td> style/label spacing) that named fields are
// clearer here than tracking positions.
function buildDateFieldRow(opts) {
    var rowIdAttr = opts.rowIdAttr || "";
    var tdStyle = opts.tdStyle || "float:right;";
    var imgIdAttr = opts.imgIdAttr || "";
    var geniInputIdAttr = opts.geniInputId ? ' id="' + opts.geniInputId + '"' : "";
    var geniValue = escapeHtml(String(opts.geniValue || "").replace(/&quot;/g, '"'));
    var icon = opts.icon || "right.png";
    var labelSuffix = exists(opts.labelSuffix) ? opts.labelSuffix : "";
    var lockedAttr = opts.locked ? 'disabled ' : ''; // #78 - see buildTextFieldRow()
    return '<tr' + rowIdAttr + '><td class="profilediv"><input type="checkbox" class="checknext" ' + lockedAttr + opts.checkedAttr + '>' + opts.label + ' Date:' + labelSuffix + '</td>' +
        '<td style="' + tdStyle + '"><input type="text"' + imgIdAttr + ' class="formtext dateform" ' + (opts.dateambig || "") + 'name="' + opts.fieldName + ':date" value="' + escapeHtml(opts.value) + '" ' + opts.enabledAttr + '></td>' +
        '<td class="genisliderow"><img src="images/' + icon + '" class="genislideimage"><input' + geniInputIdAttr + ' type="text" class="formtext genislideinput" value="' + geniValue + '" disabled></td></tr>';
}

// #210: shared builder for the About/notes textarea row (focus profile
// and family members) - a different breakout shape from the helpers
// above: the scraped value is inserted as TEXT-NODE content inside
// <textarea>...</textarea>, not an HTML attribute, so a value containing
// a literal "</textarea>" could prematurely close the element and let
// anything after it be parsed as real markup instead of textarea text -
// live-confirmed as a second breakout shape alongside the attribute one,
// see #210. escapeHtml() neutralizes this the same way it neutralizes
// attribute-breakout: escaping "<" turns "</textarea>" into
// "&lt;/textarea&gt;", which can't be interpreted as a real closing tag.
function buildAboutFieldRow(opts) {
    var tdStyle = opts.tdStyle ? ' style="' + opts.tdStyle + '"' : "";
    var divStyle = opts.divStyle || "width: 100%;";
    var geniCompanionInput = opts.geniInputId ? '<input id="' + opts.geniInputId + '" type="text" class="formtext genislideinput" value="" disabled style="display:none;">' : "";
    return '<tr><td colspan="3"' + tdStyle + '><div class="profilediv" style="' + divStyle + '"><input type="checkbox" class="checknext" ' + opts.checkedAttr + '>About:<img class="genisliderow" src="images/' + opts.icon + '" align="right" style="width: 12px; margin-right: 3px; margin-top: 5px;">' + geniCompanionInput + '</div><div style="padding-left:4px; padding-right:6px;"><textarea rows="4" name="about_me" style="width:100%;" ' + opts.enabledAttr + '>' + escapeHtml(opts.value) + '</textarea></div></td></tr>';
}

// #210: shared builder for a single geo/location field row (Place, Place
// (geo), City, County, State, Country - focus profile and family members
// each render six of these). Same attribute-breakout shape as
// buildTextFieldRow/buildDateFieldRow; escapeHtml() applied to the scraped
// value in exactly one place. classStyleSep exists only to preserve a
// pre-existing, harmless quirk in the focus-profile "Place" row's markup
// (no space between the class and style attributes, unlike every other
// row here) - browsers parse it fine either way, but the fix is scoped to
// closing the XSS hole, not to also "improving" unrelated formatting.
function buildLocationFieldRow(opts) {
    var geniInputIdAttr = opts.geniInputId ? ' id="' + opts.geniInputId + '"' : "";
    var icon = opts.icon || "right.png";
    var geniValue = escapeHtml(String(opts.geniValue || "").replace(/&quot;/g, '"'));
    var sep = exists(opts.classStyleSep) ? opts.classStyleSep : " ";
    var lockedAttr = opts.locked ? 'disabled ' : ''; // #78 - see buildTextFieldRow()
    return '<tr class="' + opts.trClass + '"' + sep + 'style="display: ' + opts.displayVal + ';"><td class="profilediv" style="padding-left: 10px;"><input type="checkbox" class="checknext" ' + lockedAttr + opts.checkedAttr + '>' + opts.label + '</td><td style="' + opts.tdStyle + '"><input type="text" class="formtext" name="' + opts.fieldName + '" value="' + escapeHtml(opts.value) + '" ' + opts.enabledAttr + '></td><td class="genisliderow"><img src="images/' + icon + '" class="genislideimage"><input' + geniInputIdAttr + ' type="text" class="formtext genislideinput" value="' + geniValue + '" disabled></td></tr>';
}

// currentValue is optional and only changes behavior when explicitly passed
// as "" (a confirmed-blank comparison, e.g. Geni's own field for this
// person is genuinely empty, or the person doesn't exist on Geni at all
// yet). Left undefined at a call site preserves the original behavior
// exactly (blank scraped value -> disabled), since undefined fails the
// exists() check below - only call sites that have actually verified what
// Geni currently holds for this field opt into the relaxed behavior.
// Distinguishes "leave this alone, Geni already has real data here that a
// blank scrape shouldn't clobber" (protective, unchanged) from "there's
// nothing on either side to protect, so let the user type directly instead
// of requiring an extra click on the checkbox first."
// #78: locked takes precedence over everything else - a field Geni won't
// accept an edit for must never render as enabled, regardless of how
// strongly it scored or how empty both sides are. See buildTextFieldRow()
// for why the checkbox itself also needs to be disabled, not just this.
//
// #229 follow-up: isChecked()/isEnabled() (below) computed this exact same
// boolean via two byte-identical branch trees, differing only in which
// string each branch returned - audited and merged into this one shared
// resolver on request, since two copies of the same truth table is exactly
// the kind of duplication that drifts out of sync over time (unlike the
// checked/enabled string labels themselves, which genuinely do need to
// differ - that's the one real difference, kept in the two thin wrappers
// below rather than in the condition logic itself).
function resolveFieldEnabled(value, score, force, currentValue, locked) {
    if (locked) {
        return false;
    } else if (force && score) {
        return true;
    } else if (score && isValue(value)) {
        return true;
    } else if (score && !isValue(value) && exists(currentValue) && !isValue(currentValue)) {
        return true;
    } else {
        return false;
    }
}

function isEnabled(value, score, force, currentValue, locked) {
    return resolveFieldEnabled(value, score, force, currentValue, locked) ? "" : "disabled";
}

function isHidden(value, geo) {
    var hidden = geoAnySourceEnabled();
    if (geo === "place" && hidden) {
        return "none";
    } else if (geo === "loc" && !hidden) {
        return "none";
    }
    if (value) {
        return "none";
    } else {
        return "table-row";
    }
}

// #222: replaces "hidden = the Hide Empty Fields setting, applied as a
// blanket category toggle" with a per-row content check - a row now
// starts collapsed only when the setting is on AND this specific field's
// OWN scraped value is blank, not just because it's categorized as
// secondary. Geni's own side is deliberately NOT part of this decision
// (agreed direction on #222) - "Hide Empty Fields" is about decluttering
// what this run actually scraped, not about whether Geni separately
// already has something there.
//
// data-hasvalue is the other half of the fix: the eyeball's OPEN action
// still reveals every .hiddenrow unconditionally (unchanged, deliberately
// - see hideempty()/.showhide's click handler), but CLOSING must not
// re-hide a row that has real content just because it shares the
// .hiddenrow class - the close handler filters on this attribute instead
// of blindly hiding everything, closing the exact gap #222 was filed
// about ("'Closed' hides the whole category even if a specific row in it
// genuinely has real scraped data").
//
// Takes hasValue directly (a boolean the CALLER computes), not a raw value
// to blank-check internally - different fields have different "blank"
// representations in this codebase (plain "" for most text fields,
// Gender's literal "unknown" option, Living's data-scraped flag rather
// than its current value at all, since Deceased/Living are both "real").
// Forcing every call site to resolve its own field-appropriate blank
// check first, same as isFieldValueBlank() (popup.js) already does for
// Select All, avoids silently mis-treating "unknown" gender or a
// defaulted Vital value as if they were populated content.
function hiddenRowAttrs(hidden, hasValue) {
    return 'data-hasvalue="' + hasValue + '" style="display: ' + isHidden(hidden && !hasValue) + ';" class="hiddenrow"';
}

function genderColor(gender) {
    var bgcolor = "#c5fac9";
    if (gender === "male") {
        bgcolor = "#d1e3fb";
    } else if (gender === "female") {
        bgcolor = "#fdd4e4";
    }
    return bgcolor;
}

function setGender(gender, value) {
    if (gender === value) {
        return "selected";
    }
    return "";
}

function setLiving(living, value) {
    if (living === "deceased" && !value) {
        return "selected";
    } else if (living === "living" && value) {
        return "selected";
    } else {
        return "";
    }
}

function isSelected(id1, id2) {
    if (id1 === id2) {
        return "selected";
    } else {
        return "";
    }
}

// See isEnabled()'s comment above - same currentValue contract, kept in
// sync so a field never ends up checked-but-disabled or enabled-but-not
// submitted.
// #78: locked forces unchecked, same precedence reasoning as isEnabled().
function isChecked(value, score, force, currentValue, locked) {
    return resolveFieldEnabled(value, score, force, currentValue, locked) ? "checked" : "";
}

// #230: an estimated date must never end up pre-checked when Geni already
// has a real value for the same field - unlike genuinely scraped data
// (always checked regardless of Geni's side, per this project's normal
// rule), an estimate is a guess, not a source, and should be visible/
// available to manually check but never silently submitted over real Geni
// data. isChecked()/resolveFieldEnabled() have no branch for this: once
// score is forced true for an estimate (so the row renders enabled at
// all), their isValue(value) branch fires unconditionally, since the
// estimate's own written-out value ("circa <...>") is itself non-blank -
// passing a real currentValue into isChecked() alone can't suppress that.
// This wraps isChecked() and force-unchecks only in the one case that
// matters: an estimated field where Geni's own value isn't blank.
function isCheckedDateField(dateval, score, currentValue, locked, estimated) {
    if (estimated === true && exists(currentValue) && isValue(currentValue)) {
        return "";
    }
    return isChecked(dateval, score, false, currentValue, locked);
}

// #208: shared "get the year from a birth array" lookup - scans for the
// FIRST element with a non-blank .date (matching the correct pattern the
// 95-year check below already uses, buildform.js:447-462, rather than the
// [0]-only shortcut some other call sites use - a location-only first
// element, e.g. [{location:"..."}, {date:"1850"}], would otherwise be
// missed). excludeEstimated skips any element this feature itself wrote
// (estimated===true) - the one mechanism satisfying "never anchor off
// another estimated date," checked at read time (not just relying on pass
// ordering) since family members are processed in whatever order
// alldata["family"]'s keys iterate.
function getBirthYear(birthArray, excludeEstimated) {
    if (!exists(birthArray)) {
        return undefined;
    }
    for (var b = 0; b < birthArray.length; b++) {
        if (exists(birthArray[b]) && exists(birthArray[b].date) && birthArray[b].date.trim() !== "") {
            if (excludeEstimated && birthArray[b].estimated === true) {
                continue;
            }
            return moment(birthArray[b].date, getDateFormat(birthArray[b].date)).get('year');
        }
    }
    return undefined;
}

// #230: same scan as getBirthYear() above, but returns the raw date
// STRING instead of just the parsed year - fillMissingDeathOrBurialDate()
// below needs the real day/month precision (when present) to compute a
// day-offset estimate, which a bare year can't carry.
function getRealDateString(dateArray, excludeEstimated) {
    if (!exists(dateArray)) {
        return undefined;
    }
    for (var b = 0; b < dateArray.length; b++) {
        if (exists(dateArray[b]) && exists(dateArray[b].date) && dateArray[b].date.trim() !== "") {
            if (excludeEstimated && dateArray[b].estimated === true) {
                continue;
            }
            return dateArray[b].date;
        }
    }
    return undefined;
}

// #230: which of day/month/year precision a date string actually carries,
// using moment's own strict-parse result rather than a hand-rolled regex -
// getDateFormat() (popup.js) returns either dateformatter (an array of
// candidate formats) or one specific dash-delimited format; either way,
// moment's creationData().format reports back exactly which one matched.
// A format string containing "D" (day-of-month) means day precision, one
// containing "M" (month, MMM/MMMM) without a day means month precision,
// otherwise year-only.
function getDatePrecision(dateval) {
    if (!exists(dateval) || dateval.trim() === "") {
        return undefined;
    }
    var fmt = getDateFormat(dateval);
    var m = moment(dateval, fmt, true);
    if (!m.isValid()) {
        return undefined;
    }
    var matchedFormat = m.creationData().format;
    if (Array.isArray(matchedFormat)) {
        matchedFormat = matchedFormat[0];
    }
    if (!exists(matchedFormat)) {
        return undefined;
    }
    if (matchedFormat.indexOf("D") !== -1) {
        return "day";
    } else if (matchedFormat.indexOf("M") !== -1) {
        return "month";
    }
    return "year";
}

// #230: live-settled rule - "Buried <N> days after death" (default 3,
// #burieddaysafterdeath) applies symmetrically in both directions
// (direction=1 for burial-from-death, direction=-1 for death-from-burial).
// Only applied at DAY precision - there's no specific day to offset from
// a month-only or year-only source date, so those carry straight across
// unchanged at their own precision. Deliberately computes the offset
// BEFORE truncating to month/year output, not after - live-confirmed
// reasoning: a death on 29 Nov + a few days can land in December, and
// truncating the death date to its own month FIRST would put the burial
// estimate in the wrong month entirely.
function computeCircaFromRelatedDate(sourceDateStr, direction) {
    var precision = getDatePrecision(sourceDateStr);
    if (!exists(precision)) {
        return undefined;
    }
    var fmt = getDateFormat(sourceDateStr);
    var m = moment(sourceDateStr, fmt, true);
    if (precision === "day") {
        var offsetDays = parseInt($('#burieddaysafterdeath').val(), 10);
        if (isNaN(offsetDays) || offsetDays < 0) {
            offsetDays = 3;
        }
        m.add(direction * offsetDays, 'days');
        return "circa " + m.format("D MMM YYYY");
    } else if (precision === "month") {
        return "circa " + m.format("MMM YYYY");
    }
    return "circa " + m.format("YYYY");
}

// #204: finds the focus person's spouse's surname, but only when that's
// unambiguous - exactly one spouse total (alldata["family"]'s raw,
// un-normalized keys can include more than one that classifies as a
// partner, e.g. separate "husband"/"spouse" keys both present - collected
// across all of them, not just the first match), and that spouse is male
// (explicitly not assumed for any other gender combination - see #204's
// "Same-Sex Marriage Logic" note). Returns "" - never throws - for zero,
// multiple, or non-male spouses, or if the single spouse's own name
// doesn't parse out a surname at all.
function getFocusSpouseSurname(mnameonoff) {
    var spouses = aggregateFamilyByRelation(isPartner);
    if (spouses.length !== 1 || spouses[0].gender !== "male" || !exists(spouses[0].name)) {
        return "";
    }
    var spouseNameval = NameParse.parse(spouses[0].name, mnameonoff);
    return spouseNameval.lastName || "";
}

// #204 (parents): mirrors getFocusSpouseSurname() but for the parent
// category - finds a parent's surname among all parent-type family
// members (every raw relationship key isParent() recognizes, collected
// together, not just one), filtered to the requested gender and requiring
// exactly one match. An ambiguous source (e.g. two father entries from a
// remarriage) returns "" rather than guessing which one to use.
function getParentSurname(gender, mnameonoff) {
    var matches = aggregateFamilyByRelation(isParent).filter(function (m) { return m.gender === gender; });
    if (matches.length !== 1 || !exists(matches[0].name)) {
        return "";
    }
    var parentNameval = NameParse.parse(matches[0].name, mnameonoff);
    return parentNameval.lastName || "";
}

// #229 follow-up: "walk alldata['family']'s keys, collect every entry
// whose relationship key matches a predicate (isParent/isPartner/isChild/
// isSibling)" was repeated 6 times across the estimator alone
// (getMemberSpouse() below x2, getChildGroupAnchorYear() x3,
// getOtherPartners()) - audited and factored out into this one shared
// helper on request, each caller applying its own filter/require-singular/
// exclude-member logic on top of the same flat aggregate.
function aggregateFamilyByRelation(predicateFn) {
    var obj = alldata["family"];
    var matches = [];
    for (var relationship in obj) if (obj.hasOwnProperty(relationship)) {
        if (predicateFn(relationship)) {
            matches = matches.concat(obj[relationship]);
        }
    }
    return matches;
}

// #208: finds `member`'s real spouse record, for Rule 1 (spousal age gap)
// of the birth-year estimation feature. Spouse data only exists in the
// scraped model for two of the four relationship categories - no parser
// ever records who a sibling's or child's own spouse is (confirmed: no
// collections/*.js file scrapes that relationship at all), so this
// deliberately returns null for those rather than guessing.
//   "parent"  -> the OTHER isParent() entry (mirrors getParentSurname()'s
//                aggregation above), excluding `member` itself.
//   "partner" -> the focus person (alldata["profile"]) directly.
//   "focus"   -> (member omitted) the one isPartner() entry - unlike
//                getFocusSpouseSurname() above, NOT restricted to a male
//                spouse only (that restriction is #204-specific to
//                married-name direction; Rule 1 needs both directions).
//   "sibling"/"child" -> null, no spouse data exists for these categories.
function getMemberSpouse(category, member) {
    if (category === "parent") {
        var parents = aggregateFamilyByRelation(isParent).filter(function (p) { return p !== member; });
        return parents.length === 1 ? parents[0] : null;
    }
    if (category === "partner") {
        return alldata["profile"];
    }
    if (category === "focus") {
        var spouses = aggregateFamilyByRelation(isPartner);
        return spouses.length === 1 ? spouses[0] : null;
    }
    return null;
}

// #208 follow-up: prefers a REAL child anchor, but - confirmed live, asked
// for explicitly ("unlimited chaining", not the one-hop cap the spousal
// cascade uses) - falls back to the earliest ESTIMATED child's year when no
// real one exists in the pool at all, so a chain of otherwise-empty
// ancestors (father -> grandfather -> great-grandfather ...) can each
// anchor off the generation below's own estimate, uncapped. Returns
// {year, cascaded} (cascaded=true only when the anchor itself came from an
// estimate, never from real data) rather than a bare year, so a Rule-2
// result correctly carries the same cascaded flag every other estimate
// path already relies on (e.g. so a later spousal cascade off THIS result
// still only permits its own one-hop, unaffected by how many hops Rule 2
// itself already took to get here).
//
// #208: finds the anchor year for `member`'s own blank birth via Rule 2
// (parent age from oldest child) - the earliest REAL birth year among
// `member`'s children. Only "parent" (children = focus + siblings, half or
// full depending on the target's gender - see below) and "focus" (children
// = real isChild() entries) have a valid "their own children" pool under
// this feature's scope; sibling/child/partner-category members have no
// such data (no grandchildren are ever scraped) and always return
// undefined.
//
// Half-sibling handling (#208 follow-up, confirmed live against a real
// multi-marriage test case: Robert Brown, two wives) depends on the
// TARGET's own gender, not a blanket in/out rule:
//   - Mother (female target): full-siblings-only pool, unchanged. A full
//     sibling of focus (halfsibling !== true) shares BOTH parents with
//     focus, so by construction already IS one of THIS specific mother's
//     own children - no separate per-child parent-identity tracking is
//     needed for this case.
//   - Father (male target): half-siblings ARE included. A man's age is a
//     single fact regardless of which wife's children happen to be
//     scraped from the currently-viewed focus profile - confirmed live
//     that excluding half-siblings let the SAME father get re-anchored
//     (and re-estimated to a DIFFERENT, wrong year) depending on which
//     marriage's child happened to be the focus person. Anchoring on the
//     earliest child across EVERY marriage keeps him consistent.
// #208 follow-up: "partner" - a spouse who isn't the currently-scraped
// focus child's own mother (e.g. a second wife showing up on the FATHER's
// own page) CAN now anchor on her OWN children specifically, via
// parent_id - a link this codebase's collections/*.js parsers already
// build (confirmed present in ancestrynew.js, onlineofb.js, findagrave.js,
// and most others): fetching a child's OWN individual page resolves which
// of the focus's OTHER unions their non-focus parent belongs to
// ($.inArray() against unionurls, stored as parent_id - the same famid
// each spouse's own profile_id was registered under). Filtering the
// focus's children to parent_id === member.profile_id isolates JUST this
// specific spouse's own children from a multi-marriage focus person's
// full child list - solving the exact gap an earlier version of this
// comment called unsolvable (it wasn't - the data was already there,
// just not being read). Degrades safely to an empty pool (falls through
// to the spousal cascade, same as before) for any collection that
// doesn't happen to populate parent_id.
function getChildGroupAnchorYear(category, member) {
    var pool;
    if (category === "parent") {
        var includeHalfSiblings = exists(member) && member.gender === "male";
        pool = [alldata["profile"]].concat(aggregateFamilyByRelation(isSibling).filter(function (s) {
            return includeHalfSiblings || s.halfsibling !== true;
        }));
    } else if (category === "focus") {
        pool = aggregateFamilyByRelation(isChild);
    } else if (category === "partner" && exists(member) && exists(member.profile_id)) {
        pool = aggregateFamilyByRelation(isChild).filter(function (c) {
            return exists(c.parent_id) && c.parent_id === member.profile_id;
        });
    } else {
        return undefined;
    }
    var realAnchor = undefined;
    var estimatedAnchor = undefined;
    for (var p = 0; p < pool.length; p++) {
        var realYear = getBirthYear(pool[p]["birth"], true);
        if (exists(realYear) && (!exists(realAnchor) || realYear < realAnchor)) {
            realAnchor = realYear;
        } else if (!exists(realYear)) {
            var anyYear = getBirthYear(pool[p]["birth"], false);
            if (exists(anyYear) && (!exists(estimatedAnchor) || anyYear < estimatedAnchor)) {
                estimatedAnchor = anyYear;
            }
        }
    }
    if (exists(realAnchor)) {
        return { year: realAnchor, cascaded: false };
    }
    if (exists(estimatedAnchor)) {
        return { year: estimatedAnchor, cascaded: true };
    }
    return undefined;
}

// #208 follow-up: the LAST-RESORT half of the spousal (Rule 1) anchor
// lookup - a spouse's own estimate is usable as an anchor ONLY if that
// estimate itself was anchored on real data (cascaded !== true, i.e. not
// already a cascade), so a chain can never compound past a single hop away
// from a real, sourced date (RealPerson -> estimates spouse -> that
// spouse's estimate may anchor ONE further spousal estimate -> stop).
// Deliberately does NOT also check for a real date here - estimateBirthYear()
// below tries that separately, and at a HIGHER priority than this (see its
// own comment for why the order matters). Only ever reads birthArray[0]
// (not a full rescan) because applyEstimatedBirth() always unshifts - an
// estimate, if present at all, is always the first element.
function getCascadedSpouseYear(birthArray) {
    if (exists(birthArray) && exists(birthArray[0]) && birthArray[0].estimated === true && birthArray[0].cascaded !== true) {
        return getBirthYear(birthArray, false);
    }
    return undefined;
}

// #208: ties Rule 1 (spousal age gap) and Rule 2 (parent age from oldest
// child) together - husband older than wife by spousalGap years,
// father/mother older than their oldest child by generationalGap /
// (generationalGap - spousalGap) years respectively (mother is assumed
// spousalGap years younger than father, the same relationship Rule 1
// itself uses - not a separate, independently-configurable third number).
// Both gaps are user-configurable (#208 follow-up: originally hardcoded
// 5/30, made editable after the first live use) - passed in explicitly
// rather than read from the DOM here, so this function stays pure/
// testable; defaults match this feature's original hardcoded values, used
// only if a caller omits them (e.g. a synthetic test not exercising this
// part). Same-gender pairs and gender==="unknown" targets never fire
// either rule - no valid husband/wife or father/mother mapping exists,
// matching this codebase's existing culture of leaving ambiguous cases
// blank (see getFocusSpouseSurname()'s own male-only restriction above)
// rather than guessing.
//
// Priority order (#208 follow-up - CHANGED AGAIN, confirmed live a third
// time to add the "unlimited chaining" tier): (1) this person's own REAL
// children (Rule 2), (2) a spouse's REAL date, (3) this person's own
// ESTIMATED children (Rule 2, uncapped cascade), (4) a spouse's own
// estimate, exactly one hop of cascading (last resort). Real evidence about
// THIS person always wins over anything derived from someone else, and real
// evidence in general always wins over any estimate - a DERIVED estimate
// (spousal gap off someone else, even off a real date) is still less
// specific than this person's OWN direct evidence, and real data anywhere
// beats an estimate anywhere. Within the two estimate-tier fallbacks, own
// evidence still outranks someone else's for the same reason Priority 1
// does over Priority 2.
//
// Return value's `cascaded` flag marks whether THIS estimate was itself
// anchored on another estimate (true) or on real data (false).
// applyEstimatedBirth() stores it, and getCascadedSpouseYear() above reads
// it back to enforce the spousal cascade's one-hop-only bound - Rule 2's
// own child-anchor cascade (Priority 3 above) is deliberately NOT bounded
// the same way, per the "unlimited chaining" decision.
//
// focusRealYear (#208 follow-up, optional, only meaningful for category
// "partner") plugs a real gap found live: for a "partner" member,
// getMemberSpouse() resolves the spouse as alldata["profile"] (the focus
// person) directly - but the focus-profile's OWN injection (this file,
// above) only writes a fresh estimate when Geni's existing value for the
// focus person is ALSO blank. Once the focus person already has a real
// birth date on Geni (e.g. a "Circa" estimate submitted in an earlier
// run, now just an ordinary date on the profile), that injection
// correctly skips - nothing left to estimate for them - but that also
// means alldata["profile"]["birth"] never gets (re)populated this run, so
// this function's own spouse["birth"] lookup finds nothing at all, even
// though Geni demonstrably has a real value. focusRealYear is that value,
// read from genifocusdata at the family-member call site (kept as an
// explicit parameter, not a direct genifocusdata read in here, so this
// function stays pure/DOM-free) - treated as REAL (Priority 2, same as
// any other real spousal date), exactly as trustworthy as any other
// already-on-Geni date, regardless of whatever originally put it there.
// #208 follow-up: rounds an estimated year to the nearest multiple of 5 -
// requested live specifically so a "Circa <year>" the user sees is
// visibly recognizable as a coarse, rule-based guess rather than looking
// like a precisely-sourced date. "c.1850" or "c.1855" reads as an
// estimate at a glance; "c.1852" reads as if someone found an actual
// record giving that exact year, which this feature never has. Applied
// once, at the very end of the arithmetic, so every rule/priority path
// (real spousal, own real children, cascaded spousal) gets the same
// treatment uniformly - never applied to a REAL date anywhere else in
// this codebase, only to a value this feature itself is about to write.
function roundToNearestFive(year) {
    return Math.round(year / 5) * 5;
}

function estimateBirthYear(category, member, focusGender, generationalGap, spousalGap, focusRealYear, marriageGap) {
    if (!exists(generationalGap) || isNaN(generationalGap)) {
        generationalGap = 30;
    }
    if (!exists(spousalGap) || isNaN(spousalGap)) {
        spousalGap = 5;
    }
    if (!exists(marriageGap) || isNaN(marriageGap)) {
        marriageGap = 25;
    }
    var targetGender = member ? member.gender : focusGender;
    var spouse = getMemberSpouse(category, member);
    var oppositeGenderSpouse = exists(spouse) && exists(spouse.gender) && exists(targetGender) &&
        spouse.gender !== targetGender && spouse.gender !== "unknown" && targetGender !== "unknown";

    // #208: category="focus" is always called with member=undefined (the
    // focus person's own data lives in alldata["profile"] instead, unlike
    // every other category where the scraped person IS the member object) -
    // matches how getMemberSpouse()/getChildGroupAnchorYear() already
    // special-case "focus" internally.
    var ownObj = member || alldata["profile"];

    // Priority 0 (#208): this person's own REAL baptism record - genuinely
    // recorded source data, not an inference from anyone else, so it
    // outranks even this person's own real children below. A baptism
    // happens close enough to birth (days to a couple of years,
    // historically) that using the baptism year as-is, rounded the same
    // way every other estimate here is, is a reasonable "circa" birth
    // year. getBirthYear() is generic despite its name - just scans for
    // the first element with a non-blank .date - so it works unchanged
    // against a baptism array.
    var ownBaptismYear = getBirthYear(ownObj["baptism"]);
    if (exists(ownBaptismYear)) {
        return { year: roundToNearestFive(ownBaptismYear), cascaded: false };
    }

    var childAnchor = getChildGroupAnchorYear(category, member);

    // Priority 1: this person's own REAL children (Rule 2) - the most
    // direct evidence about THIS specific person, preferred over any
    // spousal-gap estimate (real or cascaded) derived from someone else.
    if (exists(childAnchor) && childAnchor.cascaded === false && exists(targetGender)) {
        if (targetGender === "male") {
            return { year: roundToNearestFive(childAnchor.year - generationalGap), cascaded: false };
        }
        if (targetGender === "female") {
            return { year: roundToNearestFive(childAnchor.year - (generationalGap - spousalGap)), cascaded: false };
        }
    }

    // Priority 2: a real spousal date (never a guess of any kind) - only
    // reached when this person has no real child data of their own.
    if (oppositeGenderSpouse) {
        var realSpouseYear = getBirthYear(spouse["birth"], true);
        if (!exists(realSpouseYear) && category === "partner" && exists(focusRealYear)) {
            realSpouseYear = focusRealYear;
        }
        if (exists(realSpouseYear)) {
            if (targetGender === "male") {
                return { year: roundToNearestFive(realSpouseYear - spousalGap), cascaded: false };
            }
            if (targetGender === "female") {
                return { year: roundToNearestFive(realSpouseYear + spousalGap), cascaded: false };
            }
        }
    }

    // Priority 3 (#208 follow-up, "unlimited chaining" confirmed live):
    // this person's own ESTIMATED children - only reached once neither a
    // real child anchor nor a real spousal date exists. Ranked ahead of the
    // spousal cascade below for the same "own evidence beats someone else's"
    // reasoning Priority 1 already uses, just one tier down since it's now
    // derived rather than real. Deliberately uncapped (no one-hop bound like
    // the spousal cascade) - an unbroken chain of otherwise-empty ancestors
    // can each anchor off the generation below's own estimate.
    if (exists(childAnchor) && childAnchor.cascaded === true && exists(targetGender)) {
        if (targetGender === "male") {
            return { year: roundToNearestFive(childAnchor.year - generationalGap), cascaded: true };
        }
        if (targetGender === "female") {
            return { year: roundToNearestFive(childAnchor.year - (generationalGap - spousalGap)), cascaded: true };
        }
    }

    // Priority 4 (last resort): a spouse's own estimate, exactly one hop
    // of cascading - only reached when nothing else above was available.
    if (oppositeGenderSpouse) {
        var cascadedSpouseYear = getCascadedSpouseYear(spouse["birth"]);
        if (exists(cascadedSpouseYear)) {
            if (targetGender === "male") {
                return { year: roundToNearestFive(cascadedSpouseYear - spousalGap), cascaded: true };
            }
            if (targetGender === "female") {
                return { year: roundToNearestFive(cascadedSpouseYear + spousalGap), cascaded: true };
            }
        }
    }

    // Priority 5 (#208, last resort): this person's own REAL marriage date -
    // the weakest signal here (marrying age varies far more than the
    // spousal/generational gaps above), so only reached once every other
    // rule has come up empty. marriageGap mirrors estimateMarriageYear()'s
    // own birth+marriageGap fallback in the opposite direction, so the two
    // stay consistent with each other.
    var ownMarriageYear = getBirthYear(ownObj["marriage"]);
    if (exists(ownMarriageYear)) {
        return { year: roundToNearestFive(ownMarriageYear - marriageGap), cascaded: false };
    }

    return undefined;
}

// #208: every OTHER scraped partner of this same focus person (a second,
// third, etc. spouse), excluding member itself - used by the widow/widower
// remarriage rule below. isPartner() covers every relationship-category
// key alldata["family"] could store a spouse under.
function getOtherPartners(member) {
    return aggregateFamilyByRelation(isPartner).filter(function (p) { return p !== member; });
}

// #208: resolves whichever half of a couple is female - "wife's birth +
// gap" (Priority 3 below) specifically wants her age, not "whoever this
// function happens to be estimating for." category="focus" (member
// undefined) reads the focus person's own data/gender directly, matching
// how estimateBirthYear()'s ownObj already does the same thing.
function resolveCoupleWife(category, member, focusGender) {
    var self = member || alldata["profile"];
    var selfGender = member ? member.gender : focusGender;
    if (selfGender === "female") {
        return self;
    }
    var spouse = getMemberSpouse(category, member);
    if (exists(spouse) && spouse.gender === "female") {
        return spouse;
    }
    return undefined;
}

// #208/#224: marriage-year estimator - written to the form (via
// applyEstimatedDate() at the call sites below) AND used to scope a
// FamilySearch geo lookup's date filter (resolveFsLookupYears()). Priority:
// (1) this couple's own oldest REAL child's birth year minus a small gap -
// the most direct evidence about THIS specific marriage, valid for
// "parent"/"focus"/"partner" (whichever categories getChildGroupAnchorYear()
// itself supports - a sibling/child has no "their own children" pool);
// (2) "partner" category only - a widow/widower remarrying: the latest
// real death year among this focus person's OTHER spouses, plus a small
// gap ("the second wife generally married about a year after the first
// wife died") - only meaningful when estimating one SPECIFIC spouse's own
// marriage, since focus's own aggregate marriage field has no clear "which
// union" to anchor when there's more than one; (3) last resort - the
// wife's own real birth year plus a typical age-at-marriage gap, reusing
// the SAME generational/spousal settings as the birth estimator
// (generationalGap - spousalGap = 25 by default) rather than inventing a
// separate constant. Rounded to the nearest 5, same visual "this is a
// guess" signal as every other estimate this feature writes.
function estimateMarriageYear(category, member, focusGender, generationalGap, spousalGap, childGap, widowGap) {
    if (!exists(generationalGap) || isNaN(generationalGap)) {
        generationalGap = 30;
    }
    if (!exists(spousalGap) || isNaN(spousalGap)) {
        spousalGap = 5;
    }
    if (!exists(childGap) || isNaN(childGap)) {
        childGap = 1;
    }
    if (!exists(widowGap) || isNaN(widowGap)) {
        widowGap = 1;
    }

    var childAnchor = getChildGroupAnchorYear(category, member);
    if (exists(childAnchor) && childAnchor.cascaded === false) {
        return { year: roundToNearestFive(childAnchor.year - childGap) };
    }

    if (category === "partner" && exists(member)) {
        // getOtherPartners() returns every other scraped partner with no
        // sense of chronological order - a LATER spouse's death has no
        // bearing on THIS member's own marriage date (e.g. estimating the
        // first wife's marriage must not anchor off the second wife's much
        // later death). Only an other-partner who died BEFORE this member's
        // own real death can be "the prior spouse whose death let this
        // member marry in" - so require that ordering whenever this
        // member's own real death year is known; if it isn't, there's no
        // evidence to rule the other-partner out, so fall back to the old
        // unrestricted behavior.
        var others = getOtherPartners(member);
        var memberOwnDeath = getBirthYear(member["death"], true);
        var latestOtherDeath = undefined;
        for (var o = 0; o < others.length; o++) {
            var otherDeathYear = getBirthYear(others[o]["death"], true);
            if (exists(otherDeathYear) && (!exists(memberOwnDeath) || otherDeathYear < memberOwnDeath) &&
                    (!exists(latestOtherDeath) || otherDeathYear > latestOtherDeath)) {
                latestOtherDeath = otherDeathYear;
            }
        }
        if (exists(latestOtherDeath)) {
            // roundToNearestFive() can round the raw estimate DOWN to at or
            // before the anchor death year itself, implying this member
            // married before the prior spouse even died - chronologically
            // impossible for a widow/widower remarriage. Round up instead
            // whenever that happens.
            var widowYear = roundToNearestFive(latestOtherDeath + widowGap);
            if (widowYear <= latestOtherDeath) {
                widowYear += 5;
            }
            return { year: widowYear };
        }
    }

    var wife = resolveCoupleWife(category, member, focusGender);
    if (exists(wife)) {
        var wifeBirthYear = getBirthYear(wife["birth"], true);
        if (exists(wifeBirthYear)) {
            return { year: roundToNearestFive(wifeBirthYear + (generationalGap - spousalGap)) };
        }
    }

    return undefined;
}

// #208: writes the actual estimate. unshift, not push/overwrite - the
// family-member pre-1600 datelimit check (below, in the per-member render
// loop) reads birth[0] directly rather than scanning, so the estimate must
// land at index 0 to be picked up there; the trigger condition only
// guarantees no element has a real .date, not that the array is empty, so
// an existing location-only element must be preserved, not clobbered.
// "circa <year>" (lowercase c) matches Geni's own display convention for an
// approximate date (confirmed live: Geni renders its circa dates lowercase,
// e.g. "circa 1822", not "Circa 1822") - popup.js's parseDate() was updated
// to recognize "circa" case-insensitively so this still round-trips into
// Geni's circa:true API field regardless of case. NOT "About <year>", which
// would not be recognized and would break.
// cascaded (#208 follow-up, optional) - stamped straight from
// estimateBirthYear()'s own return value, read back by
// getCascadedSpouseYear() to enforce the one-hop-cascading bound (see its
// own comment). Only ever set true, never explicitly false - absence
// means "not a cascade," identical to how `estimated` itself is only ever
// added, never written as false.
// #229 follow-up: was its own full copy of applyEstimatedDate()'s entry-
// construction/unshift logic (title hardcoded to "birth") - audited and
// merged into a thin wrapper on request. Safe because applyEstimatedDate()
// always leaves the just-written entry at index 0, whether it created the
// array fresh or unshifted onto an existing one - the same guarantee this
// function's own docstring above already promises callers.
function applyEstimatedBirth(target, year, cascaded) {
    applyEstimatedDate(target, "birth", "circa " + year);
    if (cascaded === true) {
        target["birth"][0].cascaded = true;
    }
}

// #208: attaches an estimated date DIRECTLY onto an existing
// location-bearing entry that has none yet (unlike applyEstimatedBirth()'s
// unshift-a-new-entry pattern) - reused by both baptism (#208, below,
// which NEVER falls back to creating a new entry - "not everyone has one,"
// so a baptism is only ever estimated when the scrape already has EVIDENCE
// one happened) and death/burial (#208, fillMissingDeathOrBurialDate()
// below, which DOES fall back to creating a new entry when this returns
// false - death/burial are treated as effectively certain once either is
// known, unlike the optional baptism). Returns true if it actually filled
// something in.
// #230: takes the full pre-formatted value ("circa <...>") directly
// rather than a bare year and prefixing internally - death/burial's own
// estimate (below) needs to write a full "circa <D MMM YYYY | MMM YYYY |
// YYYY>" string depending on source precision, which a year-only
// parameter couldn't carry. Existing callers (baptism) now pass
// "circa " + year themselves instead.
function attachEstimatedDateToLocationEntry(dateArray, value) {
    if (!exists(dateArray)) {
        return false;
    }
    // #238 (live-reported): most parsers, per c0607c3's own audit, push an
    // event's date and location as two SEPARATE array elements rather than
    // merging them onto one object - an established, intentional shape
    // elsewhere in this codebase (that commit deliberately fixed the
    // CONSUMERS to scan the whole array instead of restructuring every
    // parser), not something to "fix" upstream. This function's per-
    // element scan below never accounted for that: it could find a
    // location-only element, see no date on THAT element specifically, and
    // attach an estimate there even though a real date already sat on a
    // DIFFERENT element in the same array - live-confirmed on a
    // FamilySearch baptism record, producing a bogus "circa <year>"
    // alongside the real scraped date. Bail out first if ANY element
    // already has a real (non-estimated) date, matching the same whole-
    // array-scan discipline getRealDateString()/getBirthYear() already
    // apply elsewhere.
    for (var r = 0; r < dateArray.length; r++) {
        if (exists(dateArray[r]) && exists(dateArray[r].date) && dateArray[r].date.trim() !== "" &&
                dateArray[r].estimated !== true) {
            return false;
        }
    }
    for (var i = 0; i < dateArray.length; i++) {
        if (exists(dateArray[i].location) && (!exists(dateArray[i].date) || dateArray[i].date === "")) {
            dateArray[i].date = value;
            dateArray[i].estimated = true;
            return true;
        }
    }
    return false;
}

// #208: generic version of applyEstimatedBirth() - creates a brand new
// [{date, estimated}] entry (or unshifts onto an existing array) for any
// event title, not just birth. Used by fillMissingDeathOrBurialDate() below
// when attachEstimatedDateToLocationEntry() had nothing to attach to.
// #230: takes the full pre-formatted value directly - see
// attachEstimatedDateToLocationEntry()'s own comment on the same change.
function applyEstimatedDate(target, title, value) {
    var entry = { date: value, estimated: true };
    if (!exists(target[title])) {
        target[title] = [entry];
    } else {
        target[title].unshift(entry);
    }
}

// #230 (replaces the earlier #208 same-year version): death and burial
// are still treated as a symmetric pair, but the estimate is now a
// day-offset, not a same-year assumption. Whichever side has a REAL date
// (never an already-estimated one, via getRealDateString(..., true))
// supplies the source for whichever side is scraped-blank - attaching to
// an existing location-bearing entry when there is one, otherwise
// creating a bare date-only entry from nothing entirely (unlike baptism,
// which never does that - see attachEstimatedDateToLocationEntry()'s own
// comment for why the two differ).
//
// Live-settled rule: burial is estimated as death + the "Buried days
// after death" setting (default 3, #burieddaysafterdeath) when death has
// day precision; death is estimated as burial MINUS that same setting,
// symmetrically. A month-only or year-only source carries straight
// across unchanged at its own precision (no day to offset from) - see
// computeCircaFromRelatedDate()'s own comment.
//
// #230: no longer takes a geniGetter/checks Geni's own value at all -
// this now ALWAYS computes and writes the estimate whenever the scraped
// side is blank, regardless of what Geni already has. Whether it ends up
// pre-checked for submission is now purely a render-time decision (see
// the estimated-field checked-state override in the render loops below) -
// an estimate must never silently overwrite real Geni data, but it should
// still be visible and available to manually check even when Geni's side
// isn't blank.
function fillMissingDeathOrBurialDate(target) {
    var deathDateStr = getRealDateString(target["death"], true);
    var burialDateStr = getRealDateString(target["burial"], true);
    if (exists(deathDateStr) && !exists(burialDateStr)) {
        var burialEstimate = computeCircaFromRelatedDate(deathDateStr, 1);
        if (exists(burialEstimate) && !attachEstimatedDateToLocationEntry(target["burial"], burialEstimate)) {
            applyEstimatedDate(target, "burial", burialEstimate);
        }
    } else if (exists(burialDateStr) && !exists(deathDateStr)) {
        var deathEstimate = computeCircaFromRelatedDate(burialDateStr, -1);
        if (exists(deathEstimate) && !attachEstimatedDateToLocationEntry(target["death"], deathEstimate)) {
            applyEstimatedDate(target, "death", deathEstimate);
        }
    }
}

// #206: a multi-word surname (e.g. Hispanic paternal+maternal compound
// surnames like "Gomez Rodriguez") is treated as already-complete rather
// than an ambiguous single maiden name - setBirthName()'s exact-match check
// against a known father/spouse will essentially never match one (its
// second component is a different relative's surname entirely), and
// blindly moving+clearing it on a "no match" result would silently discard
// a correctly-scraped name. There's no reliable signal to detect this is
// specifically a Hispanic naming convention (same reasoning #204 already
// applied), so this is a general, name-shape-based guard, not a
// culture-specific one - a genuinely ambiguous single-word surname still
// gets the existing move/guess treatment.
function isCompoundSurname(lastname) {
    return lastname.indexOf(" ") !== -1;
}

// #229 follow-up: had three near-identical copy-pasted blocks (the
// "focus"/isParent(relation) branches were byte-identical bodies, both
// checking isParent - only reached via two different outer conditions;
// the third differed only in swapping isPartner for isParent) - audited
// and merged into one predicate-driven pass over
// aggregateFamilyByRelation(), on request.
function setBirthName(relation, lastname, mnameonoff) {
    var predicate = (relation === "focus" || isParent(relation)) ? isParent : (isPartner(relation) ? isPartner : null);
    if (!predicate) {
        return true;
    }
    var candidates = aggregateFamilyByRelation(predicate);
    for (var i = 0; i < candidates.length; i++) {
        var nameval = NameParse.parse(candidates[i].name, mnameonoff);
        if (candidates[i].gender === "male" && nameval.lastName === lastname) {
            return false;
        }
    }
    return true;
}

function buildUnknown(gender) {
    var pselect = "";
    pselect += '<option value="unknown" selected>Unknown</option>';
    if (gender === "unknown") {
        pselect += '<option value="parent">Parent</option>';
        pselect += '<option value="sibling">Sibling</option>';
        pselect += '<option value="partner">Spouse</option>';
        pselect += '<option value="child">Child</option>';
    } else if (gender === "male") {
        pselect += '<option value="parent">Father</option>';
        pselect += '<option value="sibling">Brother</option>';
        if (focusgender !== "male") {
            pselect += '<option value="partner">Husband</option>';
        }
        pselect += '<option value="child">Son</option>';
    } else if (gender === "female"){
        pselect += '<option value="parent">Mother</option>';
        pselect += '<option value="sibling">Sister</option>';
        if (focusgender !== "female") {
            pselect += '<option value="partner">Wife</option>';
        }
        pselect += '<option value="child">Daughter</option>';
    }

    pselect = '<select name="unknownsel" class="unknownselect" gender="' + gender + '">' + pselect;
    pselect += '</select>';
    return pselect;
}

// Shared by buildAction() (below) and the auto-check gate in buildForm() -
// matches an incoming family member against genifamilydata by exact,
// case/diacritic-normalized name and, when more than one same-named
// candidate could apply, a non-conflicting birth year (a classic namesake
// signal - e.g. a grandson named after his grandfather - see #186 for the
// full reasoning). Father/mother are excluded since Geni's data model
// guarantees at most one of each - no ambiguity to resolve, and that case
// is handled separately via geniHas(). Returns the matched genifamilydata
// entry, or null if nothing qualifies.
function findExistingFamilyMatch(relationship, gender, firstName, lastName, birthYear) {
    if (!exists(genifamily)) {
        return null;
    }
    if (isParent(relationship)) {
        if (gender === "male") {
            relationship = "father";
        } else if (gender === "female") {
            relationship = "mother";
        }
    } else if (isSibling(relationship)) {
        if (gender === "male") {
            relationship = "brother";
        } else if (gender === "female") {
            relationship = "sister";
        }
    } else if (isChild(relationship)) {
        if (gender === "male") {
            relationship = "son";
        } else if (gender === "female") {
            relationship = "daughter";
        }
    }

    function categoryMatches(familymem) {
        var famRel = familymem.get("relation");
        return (relationship === "brother" && famRel === "brother") ||
            (relationship === "sister" && famRel === "sister") ||
            (relationship === "son" && famRel === "son") ||
            (relationship === "daughter" && famRel === "daughter") ||
            (isPartner(famRel) && isPartner(relationship)) ||
            (isChild(famRel) && relationship === "child") ||
            (isSibling(famRel) && relationship === "sibling") ||
            (isParent(famRel) && relationship === "parent") ||
            (famRel === "child" && isChild(relationship)) ||
            (famRel === "sibling" && isSibling(relationship)) ||
            (famRel === "parent" && isParent(relationship));
    }

    var incomingFirst = normalizeGermanic((firstName || "").trim().toLowerCase());
    var incomingLast = normalizeGermanic((lastName || "").trim().toLowerCase());
    if ((incomingFirst === "" && incomingLast === "") || relationship === "father" || relationship === "mother") {
        return null;
    }
    var nameMatches = [];
    for (var node in genifamilydata) {
        if (!genifamilydata.hasOwnProperty(node)) continue;
        var candidate = genifamilydata[node];
        if (!categoryMatches(candidate)) continue;
        var candidateLang = candidate.get("name_language");
        var candidateFirst = normalizeGermanic((candidate.get("names", candidateLang + ".first_name") || "").trim().toLowerCase());
        // Sites like Ancestry generally only ever record a woman's maiden
        // surname, while Geni's own "name" for her may show her married
        // surname (or vice versa) - match against either of Geni's surname
        // fields rather than assuming which one the source data used.
        var candidateLastName = normalizeGermanic((candidate.get("names", candidateLang + ".last_name") || "").trim().toLowerCase());
        var candidateMaidenName = normalizeGermanic((candidate.get("names", candidateLang + ".maiden_name") || "").trim().toLowerCase());
        if (candidateFirst === incomingFirst &&
            (candidateLastName === incomingLast || candidateMaidenName === incomingLast)) {
            nameMatches.push(candidate);
        }
    }
    if (nameMatches.length === 1) {
        var candidateBirthYear = nameMatches[0].get("birth", "date.year");
        // Allow a small gap rather than requiring an exact match - source
        // data commonly disagrees by a year or two for the same person
        // (e.g. an estimated vs. recorded birth year), which shouldn't by
        // itself read as a namesake conflict.
        var birthConflict = exists(birthYear) && exists(candidateBirthYear) && candidateBirthYear !== "" &&
            Math.abs(Number(birthYear) - Number(candidateBirthYear)) > 2;
        if (!birthConflict) {
            return nameMatches[0];
        }
    }
    return null;
}

// #204 further follow-up / #208 follow-up: resolves the SAME matched Geni
// candidate buildAction() will auto-select one render step later - the
// direct father/mother relation lookup for a parent (mirrors geniHas()'s
// category check, since findExistingFamilyMatch() always returns null for
// relationship "father"/"mother" - parents are matched by category, not by
// name), or findExistingFamilyMatch() itself for everyone else. Shared by
// lastNameAutoCheckSafe() (below) and the #208 estimate injection (so a
// married-name guess and a birth-year estimate can never disagree with each
// other, or with the dropdown, about which existing Geni person this is)
// so both stay consistent with whichever candidate the dropdown itself will
// actually auto-select.
function getMatchedGeniFamilyCandidate(relationship, gender, nameval, birthYear) {
    if (relationship === "parent") {
        var wantRelation = (gender === "female") ? "mother" : "father";
        if (exists(genifamilydata)) {
            for (var node in genifamilydata) {
                if (genifamilydata.hasOwnProperty(node) && genifamilydata[node].get("relation") === wantRelation) {
                    return genifamilydata[node];
                }
            }
        }
        return null;
    }
    return findExistingFamilyMatch(relationship, gender, nameval.firstName, (nameval.lastName || nameval.birthName), birthYear);
}

// #224: computes the approximate birth/baptism/marriage/death/burial years
// used only to scope a FamilySearch geo lookup's date filter (fed to
// applyFsLookupYearFallback() in shared.js as the last-resort tier, after
// attachDateForFsLookup()'s own-scrape/sibling-scrape/burial-borrows-death
// chain has already had its shot) - never written back to the form itself.
// Priority per event, matching the scraped-blank fallback everywhere else
// in this feature: (1) this event's own scraped date; (2) Geni's existing
// date for the SAME event, via geniGetter (undefined for a family member
// with no resolved match - degrades to skipping this tier, not a crash);
// (3) a genealogical ballpark heuristic - see the chart in #224's own
// write-up: birth <-> baptism borrow each other (baptism is real source
// data either way, so this direction is ungated even when the #208
// estimate setting is off); birth also gets the #208 estimated year
// (gated, since that tier can genuinely fabricate a value) if still blank;
// marriage prefers oldest-child-1, falling back to birth+25; burial falls
// back to death. Divorce deliberately excluded - no reliable anchor exists
// for it in either direction.
function resolveFsLookupYears(personObj, geniGetter, estimateCategory, estimateMember, focusRealYear) {
    function ownScrapedYear(title) {
        var arr = personObj[title];
        if (!exists(arr)) {
            return undefined;
        }
        for (var i in arr) if (arr.hasOwnProperty(i)) {
            if (exists(arr[i].date) && arr[i].date !== "") {
                return extractDateYear(arr[i].date);
            }
        }
        return undefined;
    }
    function ownGeniYear(title) {
        if (!exists(geniGetter)) {
            return undefined;
        }
        var d = geniGetter(title, "date.formatted_date");
        return (exists(d) && isValue(d)) ? extractDateYear(d) : undefined;
    }
    var years = {};
    // #224: every tier in this whole function is deliberately UNGATED by
    // the "Estimate birth/marriage years" setting - unlike
    // applyEstimatedBirth()/applyEstimatedDate()/attachEstimatedDateTo-
    // LocationEntry()/fillMissingDeathOrBurialDate() (buildform.js's
    // render-time injection points, all correctly gated behind that
    // setting), nothing computed here is ever shown to the user or written
    // to the form - it only scopes a FamilySearch search query. A user who
    // has chosen not to see estimated dates on their tree still benefits
    // from FamilySearch picking the right historical jurisdiction instead
    // of a same-named modern one, since the ballpark year behind that
    // choice is never surfaced anywhere. Confirmed live-requested: the two
    // concerns (show estimates on the form vs. use a decent year to scope
    // a search) are independent and must not share a gate.
    var ownBaptismYear = ownScrapedYear("baptism") || ownGeniYear("baptism");
    years.birth = ownScrapedYear("birth") || ownGeniYear("birth") || ownBaptismYear;
    if (!exists(years.birth)) {
        var estimate = estimateBirthYear(estimateCategory, estimateMember, focusgender,
            parseInt($('#generationalgapyears').val(), 10), parseInt($('#spousalgapyears').val(), 10), focusRealYear);
        if (exists(estimate)) {
            years.birth = estimate.year;
        }
    }
    var ownDeathYear = ownScrapedYear("death") || ownGeniYear("death");
    var ownBurialYear = ownScrapedYear("burial") || ownGeniYear("burial");
    years.death = ownDeathYear || ownBurialYear;
    // baptism falls back to birth (any source, including the estimate just
    // resolved above) when baptism itself has neither a scraped nor a Geni
    // date of its own - the reverse direction of the tier above.
    years.baptism = ownBaptismYear || years.birth;
    years.marriage = ownScrapedYear("marriage") || ownGeniYear("marriage");
    if (!exists(years.marriage)) {
        var marriageEstimate = estimateMarriageYear(estimateCategory, estimateMember, focusgender,
            parseInt($('#generationalgapyears').val(), 10), parseInt($('#spousalgapyears').val(), 10));
        if (exists(marriageEstimate)) {
            years.marriage = marriageEstimate.year;
        }
    }
    years.burial = ownBurialYear || years.death;
    return years;
}

// #204 further follow-up: whether a guessed married surname is safe to
// auto-check at INITIAL render (no explicit Select All needed), requested
// live after the multi-spouse fix above confirmed the guess itself now
// fills in correctly but still required a manual check every time. "Safe"
// mirrors the same rule Select All already follows - nothing real to
// protect, either because there's no existing Geni match at all (a brand
// new profile, action defaults to "Add Profile") or because the matched
// candidate's own Last Name is blank.
function lastNameAutoCheckSafe(relationship, gender, nameval, birthYear) {
    var candidate = getMatchedGeniFamilyCandidate(relationship, gender, nameval, birthYear);
    if (!exists(candidate)) {
        return true;
    }
    var candidateLang = candidate.get("name_language");
    return !isValue(candidate.get("names", candidateLang + ".last_name"));
}

// #226: appends a candidate's [birth-death] years to their "Update: <name>"
// dropdown label, so same-named candidates (a common genealogy pattern -
// grandfather/grandson sharing a first name, siblings named after
// relatives) are distinguishable at a glance instead of reading identically.
// Gated behind its own setting (default off, #showdropdownyearsonoffswitch)
// - read directly here rather than threaded through as a parameter,
// matching how most other per-run toggles in this file are read (e.g.
// #birthonoffswitch above), since buildAction() only ever runs inside the
// popup's own DOM context. Uses date.year - a plain year number, already
// the established accessor for exactly this (see popup.js's byear/dyear
// 95-year check, buildform.js:2561's own birthYear conflict check above) -
// rather than parsing formatted_date's display text, so no circa/"About"
// text handling is needed: "?" simply stands in for a genuinely missing
// side, one of the format variations the issue itself calls acceptable.
function candidateOptionLabel(familymem) {
    var name = familymem.get("name");
    if (!$('#showdropdownyearsonoffswitch').prop('checked')) {
        return name;
    }
    var birthYear = familymem.get("birth", "date.year");
    var deathYear = familymem.get("death", "date.year");
    if (!isValue(birthYear) && !isValue(deathYear)) {
        return name;
    }
    // #226 follow-up: prefix a circa year with "c" (Geni's own "circa"
    // date flag, the same one #208's estimator sets and reads elsewhere
    // in this file) - requested live: "[1870-?]" reads as a sourced,
    // exact year; "[c1870-?]" correctly signals it's approximate, same
    // distinction the "About <year>"/"Circa <year>" convention already
    // makes everywhere else in this codebase, just compact enough to fit
    // a dropdown option label.
    var birthCirca = familymem.get("birth", "date.circa") === true;
    var deathCirca = familymem.get("death", "date.circa") === true;
    var birthText = isValue(birthYear) ? (birthCirca ? "c" + birthYear : birthYear) : "?";
    var deathText = isValue(deathYear) ? (deathCirca ? "c" + deathYear : deathYear) : "?";
    return name + ' [' + birthText + '-' + deathText + ']';
}

function buildAction(relationship, gender, id, firstName, lastName, birthYear) {
    var pselect = "";
    var selected = true;
    // #78 part C: adding a brand-new family member requires the "add"
    // permission on the FOCUS profile specifically (see buildTree() in
    // popup.js, which checks exactly this for any action.startsWith("add")
    // that isn't add-photo) - a new person has no Geni data of their own to
    // hold a permission. Disabling the option here means a lacking-add user
    // simply can't pick it, instead of only finding out after submission
    // fails server-side with "Geni permission denied - No add permission".
    // Existing-match "Update: ..." options are never affected by this -
    // they depend on that specific person's own permissions, unrelated to
    // "add".
    var canAddNew = genifocusdata.get("actions").indexOf("add") !== -1;
    if (exists(genifamily)) {
        if (isParent(relationship)) {
            if (gender === "male") {
                relationship = "father";
            } else if (gender === "female") {
                relationship = "mother";
            }
        } else if (isSibling(relationship)) {
            if (gender === "male") {
                relationship = "brother";
            } else if (gender === "female") {
                relationship = "sister";
            }
        } else if (isChild(relationship)) {
            if (gender === "male") {
                relationship = "son";
            } else if (gender === "female") {
                relationship = "daughter";
            }
        }

        var existingMatch = findExistingFamilyMatch(relationship, gender, firstName, lastName, birthYear);
        var autoSelectId = existingMatch ? existingMatch.get("id") : null;

        function addCandidateOption(familymem) {
            var candidateId = familymem.get("id");
            if (candidateId === autoSelectId) {
                pselect += '<option value="' + candidateId + '" selected>Update: ' + candidateOptionLabel(familymem) + '</option>';
                genibuildaction[candidateId] = id;
                selected = false;
            } else {
                pselect += '<option value="' + candidateId + '">Update: ' + candidateOptionLabel(familymem) + '</option>';
            }
        }

        for (var node in genifamilydata) {
            if (!genifamilydata.hasOwnProperty(node)) continue;
            var familymem = genifamilydata[node];
            if (relationship === "father" && familymem.get("relation") === "father") {
                pselect += '<option value="' + familymem.get("id") + '" selected>Update: ' + candidateOptionLabel(familymem) + '</option>';
                genibuildaction[familymem.get("id")] = id;
                selected = false;
            } else if (relationship === "mother" && familymem.get("relation") === "mother") {
                pselect += '<option value="' + familymem.get("id") + '" selected>Update: ' + candidateOptionLabel(familymem) + '</option>';
                genibuildaction[familymem.get("id")] = id;
                selected = false;
            } else if (relationship === "brother" && familymem.get("relation") === "brother") {
                addCandidateOption(familymem);
            } else if (relationship === "sister" && familymem.get("relation") === "sister") {
                addCandidateOption(familymem);
            } else if (relationship === "son" && familymem.get("relation") === "son") {
                addCandidateOption(familymem);
            } else if (relationship === "daughter" && familymem.get("relation") === "daughter") {
                addCandidateOption(familymem);
            } else if ((isPartner(familymem.get("relation")) && isPartner(relationship)) ||
                (isChild(familymem.get("relation")) && relationship === "child") ||
                (isSibling(familymem.get("relation")) && relationship === "sibling") ||
                (isParent(familymem.get("relation")) && relationship === "parent") ||
                (familymem.get("relation") === "child" && isChild(relationship)) ||
                (familymem.get("relation") === "sibling" && isSibling(relationship)) ||
                (familymem.get("relation")  === "parent" && isParent(relationship))) {
                addCandidateOption(familymem);
            }
        }
    }
    if (selected) {
        pselect = '<option value="add" selected' + (canAddNew ? '' : ' disabled') + '>Add Profile</option>' + pselect;
    } else {
        pselect = '<option value="add"' + (canAddNew ? '' : ' disabled') + '>Add Profile</option>' + pselect;
    }
    pselect = '<select name="action" class="actionselect">' + pselect;
    pselect += '</select>';
    return pselect;
}

function geniHas(relationship) {
    if (exists(genifamily)) {
        for (var node in genifamilydata) {
            if (!genifamilydata.hasOwnProperty(node)) continue;
            var familymem = genifamilydata[node];
            if (familymem.get("relation") === relationship) {
                return true;
            }
        }
    }
    return false;
}

// Whole-category version of geniHas() - true if Geni already has ANY
// member of this category (e.g. isParent matches "father" OR "mother"),
// used to decide whether the top-level "add all [category]" convenience
// checkbox should pre-select on load. "Geni has 1 and 1" (or even just 1)
// for parents should never auto-select "add parents" - that's for the
// "Geni has none of this category yet" case specifically, not a general
// relevance signal (that's what scored/scorefactors is for, and is left
// untouched - this only gates the bulk "add all" checkbox itself).
function geniHasAnyOfCategory(categoryCheck) {
    if (exists(genifamily)) {
        for (var node in genifamilydata) {
            if (!genifamilydata.hasOwnProperty(node)) continue;
            if (categoryCheck(genifamilydata[node].get("relation"))) {
                return true;
            }
        }
    }
    return false;
}

function buildParentSelect(id) {
    var geniselect = "";
    var scorefactors = alldata["scorefactors"];
    var spousescore = scorefactors.contains("spouse");
    var geniparent = $('#geniparentonoffswitch').prop('checked');
    var pselect = '<select name="parent" class="parentselector">';
    if (myhspouse.length === 0 && genispouse.length === 1) {
        geniselect = " selected";
    } else if (geniparent && myhspouse.length === 1 && genispouse.length === 1 && !spousescore) {
        id = -1;
        geniselect = " selected";
    } else if (id == -1 && geniparent && genispouse.length === 1) {
        geniselect = " selected";
    } else if (id == -1) {
        pselect += '<option value="-1" selected>Unknown</option>';
    }
    for (var key in myhspouse) if (myhspouse.hasOwnProperty(key)) {
        if (exists(databyid[myhspouse[key]])) {
            pselect += '<option value="' + myhspouse[key] + '" ' + isSelected(id, myhspouse[key]) + '>' + getProfileName(databyid[myhspouse[key]].name).replace("born ", "") + '</option>';
        }
    }
    for (var i = 0; i < genispouse.length; i++) {
        pselect += '<option value="' + getGeniData(genispouse[i], "union") + '"' + geniselect + '>Geni: ' + getGeniData(genispouse[i], "name") + '</option>';
    }
    pselect += '</select>';
    return pselect;
}


function updateInfoData(person, arg) {
    if (!exists(person) || person  === "") {
        return arg;
    }
    person["url"] = arg["url"];
    person["itemId"] = arg["itemId"];
    person["profile_id"] = arg["profile_id"];

    if (exists(arg.name)) {
        //This compares the data on the focus profile to the linked profile and uses most complete
        //Sometimes more information is shown on the SM, but when you click the link it goes <Private>
        if (exists(person.name) && person.name.trim() === "" && arg.name !== "") {
            person.name = arg.name;
        }
        var tempname = NameParse.parse(person.name, mnameonoff);
        var argname = NameParse.parse(arg.name, mnameonoff);
        if (exists(person["alive"])) {
            //leave alone - let parser define it
        } else if (exists(person["death"]) || exists(person["burial"])) {
            person["alive"] = false;
        } else if (checkLiving(person.name) || checkLiving(arg.name)) {
            person["alive"] = true;
        }
        if (checkLiving(person.name) && !checkLiving(arg.name)) {
            if (!arg.name.contains("(born ") && person.name.contains("(born ")) {
                if (arg.name.contains(tempname.birthName)) {
                    if (arg.name.contains(tempname.lastName)) {
                        arg.name = arg.name.replace(tempname.birthName, "(born " + tempname.birthName + ")");
                    } else {
                        arg.name = arg.name.replace(tempname.birthName, tempname.lastName + " (born " + tempname.birthName + ")");
                    }
                } else {
                    arg.name = arg.name.trim() + " (born " + tempname.birthName + ")";
                }
            }
            person.name = arg.name;
        }
        if (argname.suffix !== undefined && argname.suffix !== "" && tempname.suffix === "") {
            person.name += ", " + argname.suffix;
        }
        if (tempname.lasName !== undefined && argname.lastName !== undefined && tempname.lastName !== argname.lastName && tempname.lastName.toLowerCase() === argname.lastName.toLowerCase()) {
            //Check if one is CamelCase
            var tlast = tempname.lastName.substring(1, tempname.lastName.length);
            var alast = argname.lastName.substring(1, argname.lastName.length);
            if (!NameParse.is_camel_case(tlast) && NameParse.is_camel_case(alast)) {
                person.name = person.name.replace(tempname.lastName, argname.lastName);
            }
        }
        if (tempname.birthName !== undefined && argname.birthName !== undefined && tempname.birthName !== argname.birthName && tempname.birthName.toLowerCase() === argname.birthName.toLowerCase()) {
            //Check if one is CamelCase
            var tlast = tempname.birthName.substring(1, tempname.birthName.length);
            var alast = argname.birthName.substring(1, argname.birthName.length);
            if (!NameParse.is_camel_case(tlast) && NameParse.is_camel_case(alast)) {
                person.name = person.name.replace(tempname.birthName, argname.birthName);
            }
        }
        if (exists(arg.gender) && person.gender === "unknown") {
            person.gender = arg.gender;
        }

        if (person.gender === "unknown") {
            //Try another approach based on relationship to focus
            var title = arg.title;
            if (isFemale(title)) {
                person.gender = "female";
            } else if (isMale(title)) {
                person.gender = "male";
            }
        }
        if (person.gender === "unknown" && (argname.suffix !== "" || tempname.suffix !== "")) {
            person.gender = "male";
        }
        if (exists(arg.birthyear) && !exists(person.birth)) {
            person["birth"] = [
                {"date": arg.birthyear}
            ];
        }
        if (exists(arg.deathyear) && !exists(person.death)) {
            person["death"] = [
                {"date": arg.deathyear}
            ];
        }
        if (!exists(person["alive"]) && !tablink.contains("/collection-1/") && exists(person["birth"])) {
            var fulldate = null;
            for (var b = 0; b < person["birth"].length; b++) {
                if (exists(person["birth"][b].date) && person["birth"][b].date.trim() !== "") {
                    fulldate = person["birth"][b].date;
                    break;
                }
            }
            if (fulldate !== null) {
                var birthval = parseDate(fulldate, false);
                var agelimit = moment.utc().format("YYYY") - 95;
                if (exists(birthval.year) && birthval.year >= agelimit) {
                    person["alive"] = true;
                } else if (exists(birthval.year)) {
                    // Symmetric with the focus profile's own 95-year default
                    // (buildform.js:501-523, "If the older than 95, default
                    // to deceased") - this branch previously only ever set
                    // alive=true for a recent birth and left alive
                    // undetermined for an old one with no death/burial
                    // record scraped, live-confirmed to leave Vital's
                    // data-scraped flag false (see isFieldValueBlank()) and
                    // so Select All correctly, but confusingly, treats it as
                    // "nothing determined here" and protects it rather than
                    // checking it - a person born well over 95 years ago is
                    // confidently deceased, same reasoning as the focus
                    // profile already applies.
                    person["alive"] = false;
                }
            }
        }
        if (exists(arg.marriage) && exists(arg.marriage[0])) {
            delete arg["marriage"][0].name;
            person["marriage"] = arg["marriage"];
        }
        if (exists(arg.divorce) && exists(arg.divorce[0])) {
            delete arg["divorce"][0].name;
            person["divorce"] = arg["divorce"];
        }
    } else if (exists(person.name) && !exists(person["alive"])) {
        if (exists(person["death"]) || exists(person["burial"])) {
            person["alive"] = false;
        } else if (checkLiving(person.name)) {
            person["alive"] = true;
        } else if (exists(person["birth"])) {
            var fulldate = null;
            for (var b = 0; b < person["birth"].length; b++) {
                if (exists(person["birth"][b].date) && person["birth"][b].date.trim() !== "") {
                    fulldate = person["birth"][b].date;
                    break;
                }
            }
            if (fulldate !== null) {
                var birthval = parseDate(fulldate, false);
                var agelimit = moment.utc().format("YYYY") - 95;
                if (exists(birthval.year) && birthval.year >= agelimit) {
                    person["alive"] = true;
                } else if (exists(birthval.year)) {
                    // Same reasoning as the other 95-year branch above.
                    person["alive"] = false;
                }
            }
        }
    }
    return person;
}

function parseWikiURL(wikistring) {
    wikistring = wikistring.replace(/<a href="(.*?)"*>/mg, '[$1 ').replace(/<\/a>/g, "]");
    return wikistring;
}

function cleanHTML(html) {
    if (!exists(html)) {
        return "";
    }
    html = html.replace(/<sup.*?<\/sup>/ig, "");
    var div = $(document.createElement("div"));
    div.html(html);
    return div.text() || "";
}

function cleanDate(dateval) {
    if (dateval.contains("WFT ") || dateval.contains("Calculated") || dateval.toLowerCase().contains("deceased")) {
        /*
        WFT is an abbreviation for the World Family Tree algorithm, used in cases where the submitter did not provide a date.
        It is used to satisfy the database requirements of the World Family Tree Project and has no basis in fact.
        For genealogical purposes, it is best to ignore these computer assigned WFT dates.
        */
        dateval = "";
    }
    if (dateval.contains("(aged")) {
        dateval = dateval.replace(/ \(.*\)/gm, "");
    }
    
    dateval = dateval.replace(/–/g,"-");
    dateval = dateval.replace(/ - /g, "-");
    dateval = dateval.replace(/\?/g, "");
    dateval = dateval.replace(/ABT\.? /i, "Circa ");
    dateval = dateval.replace(/EST\.? /i, "Circa ");
    dateval = dateval.replace(/BEF\.? /i, "Before ");
    dateval = dateval.replace(/AFT\.? /i, "After ");
    dateval = dateval.replace(/BET\.? /i, "Between ");
    dateval = dateval.replace(/BTW\.? /i, "Between ");
    dateval = dateval.replace(/about/i, "Circa");
    dateval = dateval.replace(/before/i, "Before");
    dateval = dateval.replace(/after/i, "After");
    dateval = dateval.replace(/from/i, "After");
    dateval = dateval.replace(/^in /i, "");
    dateval = dateval.replace(/\s+/g, ' ');
    if (dateval.contains(".")) {
        if (dateval.search(/\w\./) !== -1) {
            dateval = dateval.replace(/\./g,"");
        } else {
            dateval = dateval.replace(/\./g,"-");
        }
    }

    if (dateval.search(/\d{4}\/\d{4}/) !== -1) {
        dateval = "Between " + dateval.replace("/", " and ");
    } else if (dateval.search(/\d{4}\-\d{4}/) !== -1) {
        var andval = " and ";
        if (dateval.contains("Circa")) {
            andval = andval + "Circa ";
        }
        dateval = "Between " + dateval.replace("-", andval);
    } else if (dateval.search(/\d{4}\/\d{2}/) !== -1) {
        dateval = dateval.replace(/\d{2}\//,"");
    }
 
    dateval = dateval.replace("Between Between", "Between");
    dateval = dateval.replace("Circa Circa","Circa");
    dateval = dateval.replace(/\s?\/\s?/g, "-");

    if (dateval.startsWith("To")) {
        dateval = dateval.replace(/^to/i, "Before");
    }
    if (dateval.contains(" to ")) {
        dateval = dateval.replace(" to ", " and ");
        if (!dateval.startsWith("Between")) {
            dateval = "Between " + dateval;
        }
    } else if (dateval.search(/\d{4}-\d{4}/) === -1 && dateval.search(/\d{2}-\d{4}/) !== -1) {
        // Read as DD-MM-YYYY format
    } else if (dateval.search(/\d{4}-\d{4}/) === -1 && dateval.search(/\d{4}-\d{2}/) !== -1) {
        // Read as YYYY-MM-DD format
    } else if (dateval.search(/\D{3}-\d{4}/)) {
        // Read as MMM-YYYY format
    } else if (dateval.contains("-")) {
        dateval = dateval.replace("-", " and ");
        if (!dateval.startsWith("Between")) {
            dateval = "Between " + dateval;
        }
    }
    if (dateval.search(/\d,\d/) !== -1) {
        dateval = dateval.replace(",", ", ");
    } else if (dateval.search(/\d{1,2} \d{1,2} \d{4}/) !== -1) {
        dateval = dateval.replace(/ /g, "-");
    } else if (dateval.search(/\d{4} \d{1,2} \d{1,2}/) !== -1) {
        dateval = dateval.replace(/ /g, "-");
    } else if (dateval.search(/\D, \d/) !== -1) {
        dateval = dateval.replace(",", "");
    }
    
    /*
    TODO Trying to set the format to MMM D YYYY, can produce Jan 1 YYYY if no month or day is present
    var momentval = moment(dateval.replace("Circa ", ""), getDateFormat(dateval.replace("Circa ", "")), true);
    if (momentval.isValid()) {
        //Try to format this similar to Geni for easy comparision
        if (dateval.startsWith("Circa ")) {
            dateval = "Circa " + momentval.format("MMM D YYYY");
        } else {
            dateval = momentval.format("MMM D YYYY");
        }
    }*/

    return dateval;
}

function loadGeniData() {
    familystatus.push("about");
    var abouturl = "https://www.geni.com/api/" + focusid + "?fields=about_me,nicknames&access_token=" + accountinfo.access_token;
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: abouturl
    }, function (response) {
        if (exists(response) && response.source !== "") {
            var geni_return = JSON.parse(response.source);
            if (!$.isEmptyObject(geni_return)) {
                if (exists(geni_return.about_me)) {
                    focusabout = geni_return.about_me;
                }
                if (exists(geni_return.nicknames)) {
                    focusnicknames = geni_return.nicknames;
                }
            }
        }
        familystatus.pop();
    });
}

function checkLiving(name) {
    return (name.startsWith("\<Private\>") || name.startsWith("Private") || name.startsWith("Living"));
}

function recursiveCompare(obj, reference) {
    if (obj === reference) return true;
    if (obj.constructor !== reference.constructor) return false;
    if (obj instanceof Array) {
        if (obj.length !== reference.length) return false;
        obj = obj.sort();
        reference = reference.sort();
        for (var i = 0, len = obj.length; i < len; i++) {
            if (typeof obj[i] == "object" && typeof reference[j] == "object") {
                if (!recursiveCompare(obj[i], reference[i])) return false;
            }
            else if (obj[i] !== reference[i]) return false;
        }
    }
    else {
        var objListCounter = 0;
        var refListCounter = 0;
        for (var i in obj) {
            objListCounter++;
            if (typeof obj[i] == "object" && typeof reference[i] == "object") {
                if (!recursiveCompare(obj[i], reference[i])) return false;
            }
            else if (obj[i] !== reference[i]) return false;
        }
        for (var i in reference) refListCounter++;
        if (objListCounter !== refListCounter) return false;
    }
    return true; //Every object and array is equal
}

function checkBurial(profiledata){
    var data = [];
    var dd = profiledata["death"][0]["date"].trim();
    if (dd.startsWith("Between")) {
        var btsplit = dd.split(" and ");
        if (btsplit.length > 1) {
            dd = btsplit[1];
        }
    }
    if (dd.startsWith("After Circa") || dd.startsWith("Circa After")) {
        dd = dd;
    } else if (dd.startsWith("After")) {
        dd = dd.replace("After", "After Circa");
    } else if (dd.startsWith("Before Circa") || dd.startsWith("Circa Before")) {
        dd = dd;
    } else if (dd.startsWith("Before")) {
        dd = dd.replace("Before", "Before Circa");
    } else if (dd.startsWith("Circa")) {
        dd = dd;
    } else if (!dd.startsWith("Between") && isNaN(dd)) {
        dd = "After " + dd;
    }
    if (!dd.startsWith("Between")) {
        data.push({date: dd});
        data.push(profiledata["burial"][0]);
        profiledata["burial"] = data;
    }

    return profiledata;
}

function getDate(data) {
    if (exists(data[0]) && exists(data[0].date)) {
        return data[0].date;
    } else {
        return null;
    }
}

function getLocation(data) {
    if (exists(data[1]) && exists(data[1].location)) {
        return data[1].location;
    } else if (exists(data[0]) && exists(data[0].location)) {
        return data[0].location;
    } else {
        return null;
    }
}

function addEvent(profiledata, event, dateval, eventlocation) {
    data = []

    dateval = cleanDate(dateval.replace("/","-"));
    if (dateval !== "unknown" && dateval !== "") {
        dt = moment(dateval, "DD-MM-YYYY", true);
        if (dt.isValid()) {
            dateval = dt.format('MMMM D, YYYY');
        }
        data.push({date: dateval});
    }
    if (eventlocation !== "") {
        data.push({id: geoid, location: eventlocation});
        geoid++;
    }
    if (!$.isEmptyObject(data)) {
        profiledata[event] = data;
    }
    return profiledata;
}

function emptyEvent(data) {
    if (exists(data)) {
        if (exists(data.date)) {
            var eventdate = data.date;
            for (var key in eventdate){
                var value = eventdate[key];
                if (key === "year" && isNaN(value)) {
                    value = "";
                }
                if (key !== "circa" && value !== "") {
                    return false;
                }
            }
        }
        if (exists(data.location)) {
            var eventlocation = data.location;
            for (var key in eventlocation){
                var value = eventlocation[key];
                if (value !== "") {
                    return false;
                }
            }
        }
    }
    return true;
}

function geniPhoto(gender) {
    if (isMale(gender)) {
        return "images/no_photo_m.gif";
    } else if (isFemale(gender)) {
        return "images/no_photo_f.gif";
    } else {
        return "images/no_photo_u.gif";
    }
}

// Applies (or re-applies) the person-level "select all fields" state to
// every field in fs - shared by the .checkslide click handler itself and
// by setGeniFamilyData() below, which re-runs this automatically whenever
// the action dropdown changes while "all" is already checked. Without
// that second call site, switching between "Update Betta" and "Add
// Profile" (or between two different matches) left every field's checked
// state stuck at whatever it was under the PREVIOUS action - e.g. Last
// Name staying checked (or unchecked) from a different person's Geni
// data - even though the row's top-level checkbox already visibly showed
// "yes, submit this person," so re-syncing the details underneath it on a
// dropdown change isn't the "silently select something the user can't
// see" problem this whole checked/disabled split was designed to avoid -
// it's just making the already-visible commitment stay internally
// consistent. Previously the only way to force this resync was to
// manually uncheck then recheck "all".
function applySelectAllState(fs, selectingAll) {
    // #217 follow-up: .geotopcheck (the "Toggle Geolocation" group-header
    // checkbox next to "<Birth/Baptism/Death/Burial> Location: ...") has
    // no name attribute and is never itself submitted, and its row's shape
    // doesn't fit isFieldEmptyForCheckAll()'s expectations below - excluded
    // from this blanket filter for both reasons. Its correct checked state
    // (does THIS group have anything selected - independent of whether the
    // group is showing "Unknown" or a real resolved location) is derived
    // separately at the end of this function, via syncGeotopcheckState().
    var ffs = fs.find('[type="checkbox"]').not('.geotopcheck');
    var photoon = $('#photoonoffswitch').prop('checked');
    ffs.filter(function (item) {
        // #78: a locked checkbox is disabled at render time specifically so
        // nothing - including "select all" - can check it. Skip it here
        // rather than letting .prop('checked', ...) below silently check a
        // disabled checkbox anyway (jQuery doesn't respect disabled for
        // programmatic property sets, only real user interaction).
        if (this.disabled) {
            return false;
        }
        if ($(ffs[item]).closest('tr').css("display") === "none") {
            return false;
        }
        if (!photoon && $(ffs[item]).hasClass("photocheck") && !this.checked) {
            return false;
        }
        if (selectingAll && isFieldEmptyForCheckAll($(ffs[item]).closest('tr'))) {
            return false;
        }
        return true;
    }).prop('checked', selectingAll);
    ffs = fs.find('input[type="text"],select,input[type="hidden"],textarea').not(".genislideinput").not(".parentselector");
    ffs.filter(function (item) {
        if ((ffs[item].type === "checkbox") || ($(ffs[item]).closest('tr').css("display") === "none") ||
            (!photoon && $(ffs[item]).hasClass("photocheck") && !this.checked) ||
            ffs[item].name === "action" || ffs[item].name === "profile_id") {
            return false;
        }
        // #78: same reasoning as the checkbox filter above - a locked
        // field's own .checknext is disabled at render time; never let
        // "select all" re-enable its paired input regardless of direction.
        if ($(ffs[item]).closest('tr').find('.checknext').prop('disabled')) {
            return false;
        }
        // Same reasoning as isFieldEmptyForCheckAll() (popup.js) - reads
        // Geni's value straight from this row's .genislideinput companion
        // rather than the field's own disabled attribute, which this very
        // filter mutates on every check/uncheck cycle and would otherwise
        // go stale. #217: also covers Gender/Living's <select> fields, not
        // just text/textarea - isFieldValueBlank()/isCompanionBlank() know
        // each field's own blank sentinel (Gender: "unknown"; Living:
        // data-scraped) rather than assuming "" is the only blank state.
        if (selectingAll &&
            (ffs[item].type === "text" || ffs[item].tagName === "TEXTAREA" ||
             (ffs[item].tagName === "SELECT" && (ffs[item].name === "gender" || ffs[item].name === "is_alive"))) &&
            isFieldValueBlank(ffs[item])) {
            var companionVal = $(ffs[item]).closest("tr").find(".genislideinput").val();
            if (!isCompanionBlank(companionVal, ffs[item])) {
                return false;
            }
        }
        return true;
    }).attr('disabled', !selectingAll);
    syncGeotopcheckState(fs);
}

// #217 follow-up: .geotopcheck's own click handler (.checknext's handler,
// above) already checks it whenever one of its geo children (Place/City/
// County/State/Country) gets checked directly - it's meant to reflect
// "does this group have anything selected," not just "was I clicked."
// Select All needs the same reflection, not a blanket exclude (which left
// it permanently unchecked even after Select All correctly checked a
// child that now has real, non-"Unknown" data) and not a blanket include
// (which checked it even when every child stayed correctly protected/
// unchanged). Walks forward from each .geotopcheck's own header row - its
// group's child rows are the ones immediately following with no id of
// their own; a row WITH an id marks the start of the next group - mirrors
// the backward walk the .checknext handler already uses to find ITS
// group's header the other direction.
function syncGeotopcheckState(fs) {
    fs.find('.geotopcheck').each(function () {
        var headerRow = $(this).closest('tr')[0];
        var anyChildChecked = false;
        var sib = headerRow.nextElementSibling;
        while (exists(sib) && (!sib.id || sib.id === "")) {
            if ($(sib).find('[type="checkbox"]').is(':checked')) {
                anyChildChecked = true;
            }
            sib = sib.nextElementSibling;
        }
        $(this).prop('checked', anyChildChecked);
    });
}

// Re-evaluates a family-member field's checkbox/enabled state now that we
// actually know whether Geni has real data there - triggered from
// setGeniFamilyData() below whenever the action dropdown settles on either
// a specific existing match or "Add Profile" (getGeniData("add", ...)
// already correctly returns "" for that case). The row was originally
// rendered before any of this was knowable, so every field started
// conservatively unchecked/disabled if the scraped value was blank.
// Mirrors isChecked()/isEnabled()'s truth table exactly, just applied live
// against the freshly-known currentValue instead of at initial render:
// scraped blank + Geni blank -> check it (nothing to protect, save the
// user a click); scraped blank + Geni has real data -> stays unchecked
// (protect it - the user can still manually check it to intentionally
// clear that field, but it's never pre-checked into doing so).
// #229 follow-up: this was verbatim-duplicated inside both
// refreshFieldCheckState() and refreshLivingCheckState() below (introduced
// that way in the first place, fixing the same bug in each independently
// instead of factoring it out once) - audited and merged on request.
// Only ever toggles disabled (typeable or not) - never checked. Checking a
// field is what tells the person's top-level "select all" checkbox
// (.checkslide) that something is about to be submitted for them; that
// signal needs to stay exclusively tied to an explicit user action - an
// individual .checknext click (which already propagates up to check
// .checkslide) or the "all" button itself (isFieldEmptyForCheckAll(),
// which already respects this same disabled state to decide what's safe
// to include). If picking an action from the dropdown also auto-checked
// fields, a collapsed sibling row could end up with real fields silently
// selected for submission while its own .checkslide still showed
// unchecked - no visible sign anything would happen.
// #78: this same "never touch checked" rule is why a field found to be
// locked here only gets its disabled state forced (input AND the row's
// own checkbox, for the same click-handler/select-all bypass reasons as
// the focus profile's equivalent fix) rather than also being unchecked -
// if it happened to already be checked from the scored initial render
// (before this person's match, and thus their lock status, was known), it
// stays checked but disabled, which parseForm() already excludes from
// submission regardless (!fsinput[item].disabled).
// (live-reported while testing #224) hardcoding score=true above means
// isEnabled() alone can't tell "this field was never checked yet" apart
// from "the user already manually unchecked it" - both look identical
// from scrapedValue/currentValue alone. Without gating on the checkbox's
// own current state, a manual uncheck (which disables the input via the
// .checknext click handler) got silently undone the next time this ran
// (e.g. the Action dropdown resolving/changing a match), re-enabling a
// field whose box still visibly showed unchecked - exactly the "no
// visible sign anything would happen" failure this rule was meant to
// prevent, just reached from the disabled side instead of the checked
// side. Only ever ENABLE the input when its checkbox is already checked;
// an unchecked box always forces disabled, regardless of what isEnabled()
// computes.
function applyProtectedDisabledState(input, scrapedValue, currentValue, locked) {
    var checknext = input.closest('tr').find('.checknext');
    if (locked) {
        // A field discovered to be Geni-locked (or missing update
        // permission) only becomes knowable once this member is matched
        // to a real Geni profile - after initial render, which may have
        // already checked this box (safely, with the information
        // available at the time). Un-checking here is always the safe
        // direction (removing eligibility to submit), unlike auto-
        // CHECKING, which this function deliberately never does (see the
        // comment above) - without this, a field checked at render time
        // stayed checked-but-disabled forever after, a state
        // isChecked()/isEnabled() themselves guarantee never happens at
        // render time but this refresh path previously didn't uphold.
        // Live-reported: this is what let a locked family member's
        // estimated marriage date stay checked (and get submitted,
        // rejected by Geni for permissions) after the lock was discovered.
        checknext.prop('checked', false);
    }
    var enabled = checknext.prop('checked') && isEnabled(scrapedValue, true, false, currentValue, locked) !== "disabled";
    input.prop("disabled", !enabled);
    checknext.prop('disabled', !!locked);
}

function refreshFieldCheckState(id, fieldName, currentValue, locked, blankValue) {
    var input = $("#familytable_" + id + " [name='" + fieldName + "']").not(".genislideinput");
    if (input.length === 0) {
        return;
    }
    var scrapedValue = input.val();
    // #217: some fields (Gender) use a literal sentinel value - "unknown" -
    // rather than "" to mean "no real data," on both the scraped side and
    // Geni's own currentValue. isEnabled()/isValue() only ever treat ""
    // as blank, so without this normalization "unknown" reads as a real,
    // intentional value and never gets the blank-protection treatment
    // below. blankValue is only ever passed for fields with this kind of
    // non-"" sentinel - every other call site leaves it undefined and
    // behaves exactly as before.
    if (blankValue !== undefined) {
        if (scrapedValue === blankValue) { scrapedValue = ""; }
        if (currentValue === blankValue) { currentValue = ""; }
    }
    applyProtectedDisabledState(input, scrapedValue, currentValue, locked);
}

// #217: Living's <select> only ever holds a real true/false value - never a
// blank sentinel like Gender's "unknown" option - so refreshFieldCheckState()'s
// generic input.val() read can't tell "no living data was scraped" (which
// renders as a defaulted Deceased/false, see the family-member render loop)
// apart from "source really said deceased." data-scraped, stamped on the
// <select> at render time, disambiguates the two.
function refreshLivingCheckState(id, currentValue, locked) {
    var input = $("#familytable_" + id + " select[name='is_alive']").not(".genislideinput");
    if (input.length === 0) {
        return;
    }
    var scrapedValue = (input.attr("data-scraped") === "true") ? input.val() : "";
    applyProtectedDisabledState(input, scrapedValue, currentValue, locked);
}

// #230 follow-up: photo submission uses its own separate "add-photo" Geni
// permission (see buildTree()'s own "add-photo" check, popup.js) rather
// than update/update-basics - a profile can allow one without the other,
// so this can't reuse getGeniFieldLocked()'s update/update-basics check.
function getGeniPhotoLocked(profile) {
    if (profile === "add") {
        return false;
    }
    var person = genifamilydata[profile];
    if (!exists(person)) {
        return false;
    }
    var actions = person.get("actions");
    return !exists(actions) || actions.indexOf("add-photo") === -1;
}

function setGeniFamilyData(id, profile) {
    var nameicon = getGeniLock(profile, "name");
    var nameLocked = getGeniFieldLocked(profile, "name"); // #78
    let namelang = $("#" + id + "_geni_name_language").val();
    $("#" + id + "_geni_photo_urls").attr('src', getGeniData(profile, "photo_urls"));
    $("#" + id + "_geni_mugshot").attr('src', isAppend(getGeniData(profile, "photo_urls")));
    // #230 follow-up (live-reported): the photo row previously never
    // refreshed its checked/disabled state against this match at all - a
    // photo submission would only find out it lacked "add-photo"
    // permission when buildTree() (popup.js) submitted it and Geni
    // rejected it with "Access Denied", instead of being caught here.
    refreshFieldCheckState(id, "photo", undefined, getGeniPhotoLocked(profile));
    var geniTitle = getGeniData(profile, "names", namelang + ".title");
    $("#" + id + "_geni_title").val(geniTitle);
    $("#" + id + "_geni_title").prev().attr('src', nameicon);
    refreshFieldCheckState(id, "title", geniTitle, nameLocked);
    var geniFirstName = String(getGeniData(profile, "names", namelang + ".first_name")).replace(/&quot;/g, '"');
    $("#" + id + "_geni_first_name").val(geniFirstName);
    $("#" + id + "_geni_first_name").prev().attr('src', nameicon);
    refreshFieldCheckState(id, "first_name", geniFirstName, nameLocked);
    var geniMiddleName = String(getGeniData(profile, "names", namelang + ".middle_name")).replace(/&quot;/g, '"');
    $("#" + id + "_geni_middle_name").val(geniMiddleName);
    $("#" + id + "_geni_middle_name").prev().attr('src', nameicon);
    refreshFieldCheckState(id, "middle_name", geniMiddleName, nameLocked);
    var geniLastName = getGeniData(profile, "names", namelang + ".last_name");
    $("#" + id + "_geni_last_name").val(geniLastName);
    $("#" + id + "_geni_last_name").prev().attr('src', nameicon);
    refreshFieldCheckState(id, "last_name", geniLastName, nameLocked);
    var geniMaidenName = getGeniData(profile, "names", namelang + ".maiden_name");
    $("#" + id + "_geni_maiden_name").val(geniMaidenName);
    $("#" + id + "_geni_maiden_name").prev().attr('src', nameicon);
    refreshFieldCheckState(id, "maiden_name", geniMaidenName, nameLocked);
    var geniSuffix = getGeniData(profile, "names", namelang + ".suffix");
    $("#" + id + "_geni_suffix").val(geniSuffix);
    $("#" + id + "_geni_suffix").prev().attr('src', nameicon);
    refreshFieldCheckState(id, "suffix", geniSuffix, nameLocked);
    var geniDisplayName = String(getGeniData(profile, "names", namelang + ".display_name")).replace(/&quot;/g, '"');
    $("#" + id + "_geni_display_name").val(geniDisplayName);
    $("#" + id + "_geni_display_name").prev().attr('src', nameicon);
    refreshFieldCheckState(id, "display_name", geniDisplayName, nameLocked);
    var geniNicknames = getGeniData(profile, "nicknames");
    $("#" + id + "_geni_nicknames").val(geniNicknames);
    $("#" + id + "_geni_nickimage").attr('src', isAppend(profile));
    var geniAbout = getGeniData(profile, "about_me");
    $("#" + id + "_geni_about").val(geniAbout);
    $("#" + id + "_geni_about").prev().attr('src', isAppend(profile));
    // #230 follow-up (live-reported): these two never passed a locked
    // argument at all, unlike every other field below - meaning they never
    // greyed out even when this member's profile has no update permission,
    // the same gap that let a photo submission reach Geni and get rejected
    // with "Access Denied" instead of being caught client-side first.
    refreshFieldCheckState(id, "about_me", geniAbout, getGeniFieldLocked(profile, "about_me"));
    refreshFieldCheckState(id, "nicknames", geniNicknames, getGeniFieldLocked(profile, "nicknames"));
    var geniOccupation = getGeniData(profile, "occupation");
    $("#" + id + "_geni_occupation").val(geniOccupation);
    $("#" + id + "_geni_occupation").prev().attr('src', getGeniLock(profile, "occupation"));
    refreshFieldCheckState(id, "occupation", geniOccupation, getGeniFieldLocked(profile, "occupation"));
    $("#" + id + "_geni_gender").val(capFL(getGeniData(profile, "gender")));
    $("#" + id + "_geni_gender").prev().attr('src', getGeniLock(profile, "gender"));
    refreshFieldCheckState(id, "gender", getGeniData(profile, "gender"), getGeniFieldLocked(profile, "gender"), "unknown");
    $("#" + id + "_geni_is_alive").val(isAlive(getGeniData(profile, "is_alive")));
    $("#" + id + "_geni_is_alive").prev().attr('src', getGeniLock(profile, "living"));
    refreshLivingCheckState(id, getGeniData(profile, "is_alive"), getGeniFieldLocked(profile, "living"));
    $("#" + id + "_geni_public").val(isPublic(getGeniData(profile, "public")));
    $("#" + id + "_geni_public").prev().attr('src', getGeniLock(profile, "public"));

    // Re-resolve the editable Privacy checkbox/select now that we know
    // which Geni profile (if any) this member is matched to - the row was
    // originally rendered with currentlyPublic left undefined (see the
    // comment at render time in buildform.js) because that wasn't knowable
    // until now.
    refreshPrivacySelect(id);
    var geniCauseOfDeath = getGeniData(profile, "cause_of_death");
    $("#" + id + "_geni_cause_of_death").val(geniCauseOfDeath);
    $("#" + id + "_geni_cause_of_death").prev().attr('src', getGeniLock(profile, "cause_of_death"));
    refreshFieldCheckState(id, "cause_of_death", geniCauseOfDeath, getGeniFieldLocked(profile, "cause_of_death"));

    var listvalues = ["birth", "baptism", "marriage", "divorce", "death", "burial"];
    for (var i = 0; i < listvalues.length; i++) {
        var title = listvalues[i];
        var locationicon = getGeniLock(profile, title, "location");
        var locationLocked = getGeniFieldLocked(profile, title, "location"); // #78
        var dateLocked = getGeniFieldLocked(profile, title, "date"); // #78
        var geniDate = getGeniData(profile, title, "date.formatted_date");
        $("#" + id + "_geni_" + title + "_date").val(geniDate);
        $("#" + id + "_geni_" + title + "_date").prev().attr('src', getGeniLock(profile, title, "date"));
        refreshFieldCheckState(id, title + ":date", geniDate, dateLocked);
        var geniLocationString = getGeniData(profile, title, "location_string");
        $("#" + id + "_geni_" + title + "_location_string").val(geniLocationString);
        $("#" + id + "_geni_" + title + "_location_string").prev().attr('src', locationicon);
        refreshFieldCheckState(id, title + ":location:place_name", geniLocationString, locationLocked);
        var geniPlaceName = getGeniData(profile, title, "location.place_name");
        $("#" + id + "_geni_" + title + "_place").val(geniPlaceName);
        $("#" + id + "_geni_" + title + "_place").prev().attr('src', locationicon);
        refreshFieldCheckState(id, title + ":location:place_name_geo", geniPlaceName, locationLocked);
        var geniCity = getGeniData(profile, title, "location.city");
        $("#" + id + "_geni_" + title + "_city").val(geniCity);
        $("#" + id + "_geni_" + title + "_city").prev().attr('src', locationicon);
        refreshFieldCheckState(id, title + ":location:city", geniCity, locationLocked);
        var geniCounty = getGeniData(profile, title, "location.county");
        $("#" + id + "_geni_" + title + "_county").val(geniCounty);
        $("#" + id + "_geni_" + title + "_county").prev().attr('src', locationicon);
        refreshFieldCheckState(id, title + ":location:county", geniCounty, locationLocked);
        var geniState = getGeniData(profile, title, "location.state");
        $("#" + id + "_geni_" + title + "_state").val(geniState);
        $("#" + id + "_geni_" + title + "_state").prev().attr('src', locationicon);
        refreshFieldCheckState(id, title + ":location:state", geniState, locationLocked);
        var geniCountry = getGeniData(profile, title, "location.country");
        $("#" + id + "_geni_" + title + "_country").val(geniCountry);
        $("#" + id + "_geni_" + title + "_country").prev().attr('src', locationicon);
        refreshFieldCheckState(id, title + ":location:country", geniCountry, locationLocked);
        // #229: same pattern as every other location sub-field above.
        var geniLatitude = getGeniData(profile, title, "location.latitude");
        $("#" + id + "_geni_" + title + "_latitude").val(geniLatitude);
        $("#" + id + "_geni_" + title + "_latitude").prev().attr('src', locationicon);
        refreshFieldCheckState(id, title + ":location:latitude", geniLatitude, locationLocked);
        var geniLongitude = getGeniData(profile, title, "location.longitude");
        $("#" + id + "_geni_" + title + "_longitude").val(geniLongitude);
        $("#" + id + "_geni_" + title + "_longitude").prev().attr('src', locationicon);
        refreshFieldCheckState(id, title + ":location:longitude", geniLongitude, locationLocked);
    }

    // If this person's "select all" checkbox is already checked, the user
    // has already made the visible, top-level commitment to submit them -
    // re-sync every field's checked state to match what we just learned
    // about this specific match/action, the same as manually unchecking
    // and rechecking "all" would (previously the only way to force this).
    // Never does this when "all" isn't checked - a dropdown change alone
    // still never checks anything on its own, matching the "only an
    // explicit action checks a box" rule refreshFieldCheckState() follows.
    var memberexpand = $("#familytable_" + id).closest(".memberexpand");
    var checkslideEl = memberexpand.prev(".membertitle").find(".checkslide");
    if (checkslideEl.length > 0 && checkslideEl.prop("checked")) {
        // Reset-then-reapply, not just reapply: applySelectAllState(...,
        // true) only ever SETS the fields it wants checked - it never
        // explicitly unchecks whatever it filters out, since normally
        // nothing is checked yet the first time "all" gets clicked. Here,
        // fields may already be checked from a PREVIOUS match/action (e.g.
        // safely checked as blank-to-blank under "Add Profile"), and if
        // the new match now has real Geni data for one of them, it needs
        // to go back to unchecked/disabled, not just get skipped over.
        // The false pass clears everything back to that baseline first,
        // exactly like manually unchecking "all" before rechecking it -
        // which is the workaround this whole resync replaces.
        applySelectAllState(memberexpand, false);
        applySelectAllState(memberexpand, true);
    }

    // #230 follow-up (live-reported): a profile with NO edit permission at
    // all (a genuinely locked profile, not just an individual Geni-locked
    // field) needs every checkbox for this member disabled and unchecked -
    // not just the ones whose individual refreshFieldCheckState() call
    // happens to pass a correct locked argument. Auditing every field/row
    // type one at a time already missed about_me/nicknames/photo (fixed
    // above) and still misses Privacy (its own separate
    // refreshPrivacySelect() code path, no lock awareness at all) and any
    // field only rendered once the "show all fields" eyeball toggle
    // reveals it (e.g. baptism/marriage location on a profile with no
    // scraped data for either) - a single blanket sweep here, run last so
    // it has final say over everything above (including the select-all
    // resync just above), is simpler and safer than chasing down every
    // remaining gap individually.
    // getGeniFieldLocked() always ORs in a per-field Geni lock too, which
    // would incorrectly report true here for a single locked field on an
    // otherwise-editable profile - recompute the permission check directly
    // instead of reusing it, so this only fires on a total lack of update
    // access, not an unrelated per-field lock.
    var memberActionsForLockSweep = genifamilydata[profile] ? genifamilydata[profile].get("actions") : undefined;
    var noEditPermission = profile !== "add" && exists(genifamilydata[profile]) &&
        (!exists(memberActionsForLockSweep) ||
            (memberActionsForLockSweep.indexOf("update") === -1 && memberActionsForLockSweep.indexOf("update-basics") === -1));
    if (noEditPermission) {
        memberexpand.find('.checknext').prop('checked', false).prop('disabled', true);
        memberexpand.find('input, select, textarea').not('.genislideinput').prop('disabled', true);
        checkslideEl.prop('checked', false).prop('disabled', true);
    }
    // Toggled both ways (not just shown) - switching the Action: dropdown
    // to a different match (locked -> editable, or vice versa) must not
    // leave a stale lock icon from whatever was previously selected.
    $('#' + id + '_action_lock').css('display', noEditPermission ? 'inline' : 'none');
}

function isAlive(alive) {
    if (alive === "") {
        return "";
    } else if (alive) {
        return "Living";
    } else {
        return "Deceased";
    }
}

function isPublic(privacy) {
    // getGeniData()/GeniPerson.get() both return "" specifically for "this
    // profile/field doesn't exist" (e.g. a brand-new "Add Profile" family
    // member, who has no Geni profile at all yet) - genuinely different
    // from a real profile whose public field is explicitly false. Treating
    // both as falsy collapsed them into the same "Private" display, making
    // a new person's "what Geni currently has" comparison column falsely
    // claim Geni already says Private, when there's really nothing there
    // to compare against at all - it should read blank, like every other
    // "_geni_X" companion field does in that same situation.
    if (privacy === "") {
        return "";
    } else if (privacy) {
        return "Public";
    } else {
        return "Private";
    }
}

// Re-resolves a family member's Privacy select/checkbox from whatever is
// currently true right now - the action dropdown's match (or "add"),
// living/deceased status, and birth year - rather than the render-time
// snapshot the row was originally built with (currentlyPublic couldn't be
// known yet then, and living/birthYear can both change afterward). Shared
// by setGeniFamilyData() (fires when the action dropdown settles on a
// match) and the .livingselect change handler below (fires when Vital
// itself changes) - previously only the former existed, so toggling Vital
// alone left Privacy showing whatever it last was, unrelated to the new
// Living/Deceased status.
function refreshPrivacySelect(id) {
    var privacySelect = $('select.privacyselect[update="' + id + '"]');
    if (privacySelect.length === 0) {
        return;
    }
    var profile = $("#familytable_" + id + " select.actionselect").val();
    var memberLivingNow = $('select.livingselect[update="' + id + '"]').val() === "true";
    var birthYearAttr = privacySelect.attr('data-birthyear');
    var memberBirthYearNow = exists(birthYearAttr) && birthYearAttr !== "" ? parseInt(birthYearAttr, 10) : undefined;
    // getGeniData() returns "" for "no profile/no data" (e.g. a brand-new
    // "Add Profile" match) - genuinely different from a real profile whose
    // public field is explicitly false, same distinction isPublic() draws
    // above. Collapsing "" to false here (as `=== true` alone would) broke
    // buildPrivacySelect()'s living-person branch specifically, which checks
    // `currentlyPublic !== false`: a brand-new living person's Privacy
    // checkbox would render enabled at initial render (currentlyPublic is
    // genuinely undefined then) but flip to incorrectly disabled the moment
    // this function re-resolves it against "" mistaken for false. Preserving
    // the real tri-state (true/false/undefined) instead keeps both call
    // sites consistent.
    var geniPublicRaw = getGeniData(profile, "public");
    var currentlyPublicNow = geniPublicRaw === "" ? undefined : geniPublicRaw;
    var refreshedPrivacy = buildPrivacySelect(memberLivingNow, memberBirthYearNow, currentlyPublicNow);
    privacySelect.html(refreshedPrivacy.options);
    // "Select all" means all, full stop - it doesn't try to skip fields
    // that happen to be no-ops (that's parseForm()'s job at actual submit
    // time, not the UI's). So if this person's top-level checkbox is
    // already checked, Privacy needs to stay checked too even when
    // buildPrivacySelect() says this particular value would be a no-op -
    // otherwise switching Vital back and forth while "all" is checked
    // left Privacy the one checkbox that mysteriously unchecked itself.
    var allChecked = $("#familytable_" + id).closest(".memberexpand").prev(".membertitle").find(".checkslide").prop("checked");
    var enabled = refreshedPrivacy.enabled || allChecked;
    privacySelect.prop('disabled', !enabled);
    $('#' + id + '_public_checkbox').prop('checked', enabled);
}

// Geni's own server-side "Auto" privacy logic defaults deceased profiles
// under 150 years old to Private whenever SmartCopy doesn't explicitly
// submit a public/private value - which is what happens whenever this
// dropdown is left in its default disabled state. Rather than leaving that
// field unset and letting "Auto" decide, this explicitly resolves what to
// submit:
//   - Older than 150 years: always Public, no other choice offered at all -
//     except it also stays unchecked by default if already Public on Geni,
//     for the same no-op reason as the next bullet (this branch is checked
//     first, so it otherwise would have shadowed that logic entirely for
//     every profile old enough to qualify).
//   - Already Public on Geni: pre-selects Public but stays unchecked by
//     default - checking it (manually, or via Select All) submits an
//     explicit Public, protecting against Auto re-evaluating and flipping
//     it to Private on an unrelated update. Not auto-submitted by default
//     though: since the field starts pre-checked whenever this branch
//     applied, and submitting Public here is genuinely a no-op on Geni's
//     side (nothing actually changes, since it's already Public), a
//     pre-checked box misleadingly implied a pending change was about to
//     happen when nothing observable would.
//   - Otherwise, if "Default deceased profiles to public" is on: defaults
//     to Public (still overridable) instead of leaving the field unset.
//   - Otherwise: unchanged from before - field stays disabled/unset,
//     deferring entirely to Geni's own existing/Auto behavior.
//
// A living person is handled first, before any of the above - explicitly
// resolves to Private (see its own comment below) rather than deferring to
// Geni's Auto behavior the way a deceased profile still can, since making
// the user guess what "Auto" resolves to for a living profile is exactly
// the confusion this whole function exists to avoid.
//
// Re-evaluated live (not just once at initial render) by
// refreshPrivacySelect() below whenever the action dropdown settles on a
// match, or the Vital dropdown itself changes - both call sites read
// living/currentlyPublic fresh rather than relying on a stale render-time
// snapshot.
function buildPrivacySelect(living, birthYear, currentlyPublic) {
    if (living) {
        // Private is the only real choice for a living profile - Geni
        // doesn't allow a normal living person to be Public without
        // separate "Master Profile" permissions this extension has no
        // business granting, so Public/Auto aren't offered at all, the
        // same way the >150-years branch below only ever offers Public.
        // Only enabled (checkable) when it would be a real change -
        // already-Private on Geni means checking it would be a no-op, the
        // same principle every other branch below already follows.
        return {
            options: '<option value=false selected>Private</option>',
            enabled: currentlyPublic !== false
        };
    }
    var currentYear = new Date().getFullYear();
    if (exists(birthYear) && (currentYear - birthYear) > 150) {
        return {options: '<option value=true selected>Public</option>', enabled: currentlyPublic !== true};
    }
    if (currentlyPublic === true) {
        return {
            options: '<option value="">Auto</option><option value=true selected>Public</option><option value=false>Private</option>',
            enabled: false
        };
    }
    if ($('#privacyonoffswitch').prop('checked')) {
        return {
            options: '<option value="">Auto</option><option value=true selected>Public</option><option value=false>Private</option>',
            enabled: true
        };
    }
    return {
        options: '<option value="" selected>Auto</option><option value=true>Public</option><option value=false>Private</option>',
        enabled: false
    };
}

function getGeniLock(profile, value, subvalue) {
    if (profile === "add") {
        return "images/right.png";
    }
    var person = genifamilydata[profile];
    if (!exists(person)) {
        return "images/right.png";
    }
    return "images/" + person.lockIcon(value, subvalue);
}

// #78 follow-up (part B): family-member equivalent of focusFieldLocked() -
// same reasoning (a Geni-side lock and a missing update/update-basics
// permission have the same consequence, so both disable the same way), but
// checked against this specific matched person's own actions rather than
// the focus profile's. profile === "add" (not yet matched to any existing
// Geni person) is never locked here - there's no Geni data to lock, and the
// permission that actually matters for a brand-new add is "add" on the
// focus profile, a separate check (see the "add" permission gating below).
function getGeniFieldLocked(profile, value, subvalue) {
    if (profile === "add") {
        return false;
    }
    var person = genifamilydata[profile];
    if (!exists(person)) {
        return false;
    }
    var actions = person.get("actions");
    var canEditBasics = exists(actions) && (actions.indexOf("update-basics") !== -1 || actions.indexOf("update") !== -1);
    return person.isLocked(value, subvalue) || !canEditBasics;
}

function isAppend(photo) {
    if (photo.startsWith("images/no_photo") || photo === "add") {
        return "images/right.png";
    } else {
        return "images/append.png";
    }
}
