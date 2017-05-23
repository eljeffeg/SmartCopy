tablink = window.location.href;
var consistencymessage = "";
var year = 31557600; //365.25
var termlimit = 8;
var pregnancy = 21038400;  //8 month term limit
var longevity_error = 125;
var longevity_warn = 105;
var birthage_young = 12;
var birthage_old = 55;
var marriageage_young = 14;
var spouse_age_dif = 22;
var namecheckoption = true;
var siblingcheckoption = true;
var childcheckoption = true;
var partnercheckoption = true;
var agecheckoption = true;
var selfcheckoption = true;
var dataconflictoption = false;
var datecheckoption = true;
var samenameoption = true;
var wedlock = false;
var uniondata = [];

chrome.storage.local.get('dataconflict', function (result) {
    if (result.dataconflict !== undefined) {
        dataconflictoption = result.dataconflict;
    }
});

function buildconsistencyDiv() {
    if (isGeni(tablink)) {
        var consistencydiv = $(document.createElement('div'));
        consistencydiv.attr('id', 'consistencyck');
        consistencydiv.css({"display": "none", "position": "absolute", "background-color": "#fff", "box-sizing": "border-box", "z-index": "2", "width": "100%", "borderBottom":"solid 1px #cad3dd", "padding": "5px 20px 3px", "vertical-align": "middle", "line-height": "150%"});
        $("#header").after(consistencydiv);
        queryGeni();
    }
}

function queryGeni() {
    focusid = getProfile(tablink).replace("?profile=", "");
    if (focusid === "" && tablink !== "https://www.geni.com/family-tree") {
        return;
    }
    familystatus.push(1);
    var dconflict = "";
    if (dataconflictoption) {
        //This is an expensive query - exclude it if it's not enabled
        dconflict = ",data_conflict";
    }
    var args = "fields=id,guid,name,title,first_name,middle_name,last_name,maiden_name,suffix,display_name,gender,deleted,birth,baptism,death,burial,is_alive,marriage,divorce" + dconflict;
    var url = "https://www.geni.com/api/" + focusid + "/immediate-family?" + args;
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url
    }, function (response) {
        if (response.source === "[]" || response.source === "") {
            genifamily = [];
        } else {
            try {
                genifamily = JSON.parse(response.source);
            } catch (e) {
                genifamily = [];
            }
            if (!exists(genifamily)) {
                genifamily = [];
            } else {
                focusid = genifamily["focus"].id;
                genifamilydata[focusid] = new GeniPerson(genifamily["focus"]);
                var nodes = genifamily["nodes"];
                for (var node in nodes) {
                    if (!nodes.hasOwnProperty(node)) continue;
                    if (nodes[node].id.startsWith("union")) {
                        uniondata[nodes[node].id] = nodes[node];
                    } else if (!nodes[node].deleted) {
                        genifamilydata[nodes[node].id] = new GeniPerson(nodes[node]);
                    }
                }
            }
        }
        familystatus.pop();
    });
    checkConsistency();
}

$(window).bind('hashchange', function() {
    displayCheck(false);
    tablink = window.location.href;
    queryGeni();
});

$(window).mouseup(function(event) {
    if ($(event.target).attr('class') === "super blue button") {
        displayCheck(false);
        queryGeni();
    }
});

function checkConsistency() {
    if (familystatus.length > 0) {
        setTimeout(checkConsistency, 50);
    } else {
        consistencymessage = "";
        var focus = getFocus();
        var parents = getParents();
        var siblings = getSiblings();
        var children = getChildren(focus);
        var partners = getPartners();
        var parentset = getParentSets(focus, parents);
        siblings.unshift(focus); //treat the focus as a sibling

        //Compare profiles against themselves
        selfCheck(siblings);
        selfCheck(children);
        selfCheck(partners);
        selfCheck(parents);

        relationshipCheck(parents, siblings);
        relationshipCheck(parents, partners);
        relationshipCheck(parents, children);
        relationshipCheck(partners, children);
        relationshipCheck(siblings, children);

        //Compare Parent & Sibling relationships
        for (var union in parentset) {
            if (!parentset.hasOwnProperty(union)) continue;
            siblings = getChildren(parentset[union][0],parentset[union][1]);
            partnerCheck(parentset[union]);
            siblingCheck(siblings);
            childCheck(parentset[union], siblings);
        }

        //Compare Focus & Child relationships
        for (var i=0; i < partners.length; i++) {
            parents = [focus, partners[i]];
            children = getChildren(focus, partners[i]);
            partnerCheck(parents);
            siblingCheck(children);
            childCheck(parents, children);
        }

        updateQMessage();
    }
}

function partnerCheck(partners) {
    if (partnercheckoption) {
        var husband;
        var wife;
        if (isMale(getGeniData(partners[0], "gender"))) {
            husband = partners[0];
            wife = partners[1];
        } else {
            husband = partners[1];
            wife = partners[0];
        }
        var hstatus = getGeniData(husband, "status");
        var wstatus = getGeniData(wife, "status");
        if (hstatus === "") {
            hstatus = reverseRelationship(wstatus);
        } else if (wstatus === "") {
            wstatus = reverseRelationship(hstatus);
        }
        var husband_bdate = unixDate(husband, "birth");
        var wife_bdate = unixDate(wife, "birth");
        var husband_ddate = unixDate(husband, "death");
        var wife_ddate = unixDate(wife, "death");
        var union_mdate = unixDate(husband, "marriage");
        checkDate(husband, "marriage");
        if (isNaN(union_mdate)) {
            union_mdate = unixDate(wife, "marriage");
            checkDate(wife, "marriage");
        }
        if (husband_bdate + (spouse_age_dif * year) < wife_bdate || husband_bdate - (spouse_age_dif * year) > wife_bdate) {
            //Age different between partners is significant
            consistencymessage = concat("warn") + "More than " + spouse_age_dif + " year age difference between " + buildEditLink(wife) + " and "
                + getPronoun(getGeniData(wife, "gender")) + " " + getStatus(hstatus, getGeniData(husband, "gender")) + " " + buildEditLink(husband) + ".";
        }
        if (samenameoption && validName(getGeniData(wife, "maiden_name")) && getGeniData(wife, "maiden_name") === getGeniData(husband, "last_name")) {
            if (!(getGeniData(husband, "maiden_name") !== "" && getGeniData(husband, "last_name") !== getGeniData(husband, "maiden_name"))) {
                //Maiden name same as husband's last name
                //TODO if you get additional family members, compare this against her father's last name
                consistencymessage = concat("info") + "Birth Surname of " + buildEditLink(wife) + " is the same as the last name of "
                    + getPronoun(getGeniData(wife, "gender")) + " " + getStatus(hstatus, getGeniData(husband, "gender")) + " " + buildEditLink(husband) + ".";
            }
        }
        if (isNaN(husband_ddate) && husband_ddate === wife_ddate) {
            //Husband and wife death dates the same
            consistencymessage = concat("info") + "Death date of " + buildEditLink(husband) + " is the same as the death date of "
                + getPronoun(getGeniData(husband, "gender")) + " " + getStatus(wstatus, getGeniData(wife, "gender")) + " " + buildEditLink(wife) + ".";
        }
        if (isNaN(husband_ddate) && husband_ddate === union_mdate) {
            //Husband death date same as marriage date
            consistencymessage = concat("info") + "Death date of " + buildEditLink(husband) + " is the same as " + getPronoun(getGeniData(husband, "gender"))
                + " marriage date.";
        }
        if (isNaN(wife_ddate) && wife_ddate === union_mdate) {
            //Wife death date same as marriage date
            consistencymessage = concat("info") + "Death date of " + buildEditLink(wife) + " is the same as " + getPronoun(getGeniData(wife, "gender"))
                + " marriage date.";
        }

        for (var i=0;i<partners.length; i++) {
            var partner_bdate = unixDate(partners[i], "birth");
            var partner_ddate = unixDate(partners[i], "death");
            var partner_mdate = unixDate(partners[i], "marriage");
            if (partner_bdate > partner_mdate) {
                //Born after marriage
                consistencymessage = concat("error") + buildEditLink(partners[i]) + " born after " + getPronoun(getGeniData(partners[i], "gender")) + " marriage date.";
            } else if (partner_ddate < partner_mdate) {
                //Died before marriage
                consistencymessage = concat("error") + buildEditLink(partners[i]) + " died before " + getPronoun(getGeniData(partners[i], "gender")) + " marriage date.";
            } else if (partner_bdate + (marriageage_young * year) > partner_mdate) {
                //Implausible marriage age, too young
                consistencymessage = concat("warn") + buildEditLink(partners[i]) + " is under " + marriageage_young + " years old for " + getPronoun(getGeniData(partners[i], "gender")) + " marriage.";
            }
        }
    }
}

function siblingCheck(siblings) {
    if (siblingcheckoption) {
        var day = 86400;
        for (var i = 0; i < siblings.length; i++) {
            for (var j = i+1; j < siblings.length; j++) {
                var sib1_bdate = unixDate(siblings[i], "birth");
                var sib2_bdate = unixDate(siblings[j], "birth");
                if ((sib1_bdate < sib2_bdate && sib1_bdate + pregnancy > sib2_bdate) ||
                    (sib1_bdate > sib2_bdate && sib1_bdate - pregnancy < sib2_bdate)) {
                    if ((sib1_bdate < sib2_bdate && sib1_bdate + day > sib2_bdate) ||
                        (sib1_bdate > sib2_bdate && sib1_bdate - day < sib2_bdate)) {
                        //Exclude Twins
                    } else {
                        //Siblings ages too close together
                        consistencymessage = concat("warn") + "Birth date of " + buildEditLink(siblings[i]) + " and " + getPronoun(getGeniData(siblings[i], "gender"))
                            + " " + siblingName(getGeniData(siblings[j], "gender")) + " " + buildEditLink(siblings[j]) + " are within " + termlimit + " months.";
                    }
                }
            }
        }
    }
}

function childCheck(parents, children) {
    for (var i=0; i < parents.length; i++) {
        var parent_bdate = unixDate(parents[i], "birth");
        var parent_ddate = unixDate(parents[i], "death");
        var parent_mdate = unixDate(parents[i], "marriage");
        if (childcheckoption) {
            for (var x=0; x < children.length; x++) {
                var adj_parent_ddate = parent_ddate;
                if (isMale(getGeniData(parents[i], "gender"))) {
                    adj_parent_ddate = parent_ddate + pregnancy; //Add 9 months to compare conception
                }

                var sibling_bdate = unixDate(children[x], "birth");
                if (sibling_bdate < parent_bdate) {
                    //Born before parent birth
                    consistencymessage = concat("error") + buildEditLink(children[x]) + " born before the birth of "
                        + getPronoun(getGeniData(children[x], "gender")) + " " + parentName(getGeniData(parents[i], "gender")) + " " + buildEditLink(parents[i]) + ".";
                } else if (sibling_bdate > adj_parent_ddate) {
                    //Born after parent death
                    consistencymessage = concat("error") + buildEditLink(children[x]) + " born after the death of "
                        + getPronoun(getGeniData(children[x], "gender")) + " " + parentName(getGeniData(parents[i], "gender")) + " " + buildEditLink(parents[i]) + ".";
                } else if (sibling_bdate < parent_bdate + (birthage_young * year) + pregnancy) {
                    //Parent too young for child's birth
                    consistencymessage = concat("warn") + buildEditLink(parents[i]) + " is under " + birthage_young + " years old for the birth of " + getPronoun(getGeniData(parents[i], "gender"))
                        + " child " + buildEditLink(children[x]) + ".";
                } else if (isFemale(getGeniData(parents[i], "gender")) && sibling_bdate > parent_bdate + (birthage_old * year)) {
                    //Mother too old for child's birth
                    consistencymessage = concat("warn") + buildEditLink(parents[i]) + " is over " + birthage_old + " years old for the birth of " + getPronoun(getGeniData(parents[i], "gender"))
                        + " child " + buildEditLink(children[x]) + ".";
                } else if (wedlock && i === 0 && sibling_bdate < parent_mdate) {
                    //Born before parent marriage
                    consistencymessage = concat("info") + buildEditLink(children[x]) + " born before the marriage of "
                        + getPronoun(getGeniData(children[x], "gender")) + " parents " + buildEditLink(parents[0]) + " and " + buildEditLink(parents[1]) + ".";
                }
            }
        }
    }
}

function selfCheck(familyset) {
    if (selfcheckoption) {
        for (var x=0; x < familyset.length; x++) {
            var person = familyset[x];
            var person_bdate = unixDate(person, "birth");
            var person_bapdate = unixDate(person, "baptism");
            var person_ddate = unixDate(person, "death");
            var person_burial = unixDate(person, "burial");
            var conflicts = getGeniData(person, "data_conflict");
            if (dataconflictoption && conflicts) {
                consistencymessage = concat("info") + getGeniData(person, "name") + " has pending <a href='https://www.geni.com/merge/resolve/" + getGeniData(person, "guid") + "'>data conflicts</a>.";
            }
            checkDate(person, "birth");
            checkDate(person, "baptism");
            checkDate(person, "death");
            checkDate(person, "burial");
            if (agecheckoption) {
                if (person_bdate + longevity_error * year < person_ddate) {
                    //Excessive Age Error
                    consistencymessage = concat("error") + "The age of " + buildEditLink(person) + " exceeds " + longevity_error + " years.";
                } else if (person_bdate + longevity_warn * year < person_ddate) {
                    //Excessive Age Warning
                    consistencymessage = concat("warn") + "The age of " + buildEditLink(person) + " exceeds " + longevity_warn + " years.";
                }
                if (person_bdate > person_ddate && !containsRange(person, "birth", person, "death")) {
                    //Born after death
                    consistencymessage = concat("error") + "Birth date of " + buildEditLink(person) + " is after " + getPronoun(getGeniData(person, "gender")) + " death date.";
                } else if (person_bapdate > person_ddate && !containsRange(person, "baptism", person, "death")) {
                    //Baptism after death
                    consistencymessage = concat("error") + "Baptism date of " + buildEditLink(person) + " is after " + getPronoun(getGeniData(person, "gender")) + " death date.";
                } else if (person_ddate > person_burial && !containsRange(person, "death", person, "burial")) {
                    //Death is after Burial
                    consistencymessage = concat("error") + "Death date of " + buildEditLink(person) + " is after " + getPronoun(getGeniData(person, "gender")) + " burial date.";
                }
            }

            if (namecheckoption) {
                var namevaluecheck = [];
                var namevalues = ["display_name", "first_name", "middle_name", "last_name", "maiden_name"];
                if (improperSapce(getGeniData(person, "name"))) {
                    var nameupdate = [];
                    for (var i=0; i < namevalues.length; i++) {
                        var name = getGeniData(person, namevalues[i]);
                        if (improperSapce(name)) {
                            namevaluecheck.push(namevalues[i]);
                            nameupdate.push(name.replace("  ", " ").trim());
                        }
                    }
                    //Name contains double space
                    consistencymessage = concat("info") + buildEditLink(person) + " contains a double space in " + getPronoun(getGeniData(person, "gender")) + " name.<sup><a title='" + nameupdate.join("; ") + "' class='fixspace' href='javascript:void(0)' id='space" + getGeniData(person, "id") + "' name='" + namevaluecheck + "'>[fix space]</a></sup>";
                }
                if (getGeniData(person, "first_name").contains('&quot;') || getGeniData(person, "first_name").contains('"') || (getGeniData(person, "first_name").contains('(') && getGeniData(person, "first_name").contains(')')) || getGeniData(person, "first_name").split("'").length > 2) {
                    //Name contains alias
                    consistencymessage = concat("info") + buildEditLink(person) + " contains an alias in " + getPronoun(getGeniData(person, "gender")) + " first name.";
                }
                namevaluecheck = [];
                for (var i=0; i < namevalues.length; i++) {
                    var name = getGeniData(person, namevalues[i]);
                    if (validName(name) && !NameParse.is_camel_case(name) && name !== formatName(name)) {
                        namevaluecheck.push(namevalues[i]);
                    }
                }
                if (namevaluecheck.length > 0) {
                    var nameupdate = [];
                    for (var i=0; i < namevaluecheck.length; i++) {
                        nameupdate.push(formatName(getGeniData(person, namevaluecheck[i])));
                    }
                    //Name contains improper use of uppercase/lowercase
                    consistencymessage = concat("info") + buildEditLink(person) + " contains incorrect use of uppercase/lowercase in " + getPronoun(getGeniData(person, "gender")) + " name.<sup><a title='" + nameupdate.join("; ") + "' class='fixcase' href='javascript:void(0)' id='case" + getGeniData(person, "id") + "' name='" + namevaluecheck + "'>[fix case]</a></sup>";
                }

                var fnamesplit = getGeniData(person, "first_name").split(" ");
                if (fnamesplit.length > 1 && NameParse.is_suffix(fnamesplit[fnamesplit.length-1])) {
                    //First Name contain suffix
                    consistencymessage = concat("info") + buildEditLink(person) + " appears to contain a suffix in " + getPronoun(getGeniData(person, "gender")) + " first name.<sup><a title='Move Suffix' class='fixsuffix' href='javascript:void(0)' id='fsuffix" + getGeniData(person, "id") + "'>[fix suffix]</a></sup>";
                }
                if (getGeniData(person, "title") !== "") {
                    var title = getGeniData(person, "title").toLowerCase().replace(".", "").replace("-","");
                    if (title === "mr" || title === "mrs" || title === "miss" || title === "ms") {
                        //Salutation in title
                        consistencymessage = concat("info") + buildEditLink(person) + " contains improper use of salutation in " + getPronoun(getGeniData(person, "gender")) + " title.<sup><a title='Remove salutation' class='fixtitle' href='javascript:void(0)' id='title" + getGeniData(person, "id") + "' name='title'>[fix title]</a></sup>";
                    } else if (isChild(title) || isPartner(title) || isParent(title) || title === "grandmother" || title === "grandfather") {
                        //Relationship in title
                        consistencymessage = concat("info") + buildEditLink(person) + " contains improper use of relationship in " + getPronoun(getGeniData(person, "gender")) + " title.<sup><a title='Remove relationship' class='fixtitle' href='javascript:void(0)' id='title" + getGeniData(person, "id") + "' name='title'>[fix title]</a></sup>";
                    }
                }
                if (getGeniData(person, "suffix") !== "") {
                    var suffix = getGeniData(person, "suffix").toLowerCase().replace(".", "").replace("-","");
                    if (suffix === "mr" || suffix === "mrs" || suffix === "miss" || title === "ms") {
                        //Salutation in suffix
                        consistencymessage = concat("info") + buildEditLink(person) + " contains improper use of salutation in " + getPronoun(getGeniData(person, "gender")) + " suffix.<sup><a title='Remove salutation' class='fixtitle' href='javascript:void(0)' id='suffix" + getGeniData(person, "id") + "' name='suffix'>[fix suffix]</a></sup>";
                    } else if (isChild(suffix) || isPartner(suffix) || isParent(suffix) || suffix === "grandmother" || suffix === "grandfather") {
                        //Relationship in suffix
                        consistencymessage = concat("info") + buildEditLink(person) + " contains improper use of relationship in " + getPronoun(getGeniData(person, "gender")) + " suffix.<sup><a title='Remove relationship' class='fixtitle' href='javascript:void(0)' id='suffix" + getGeniData(person, "id") + "' name='suffix'>[fix suffix]</a></sup>";
                    }
                }
            }
        }
    }
}

function relationshipCheck(group1, group2) {
    if (selfcheckoption) {
        for (var i=0;i < group1.length; i++) {
            for (var x=0;x < group2.length; x++) {
                if (group1[i] === group2[x]) {
                    //relationship cycle within immediate family
                    consistencymessage = concat("warn") + buildEditLink(group1[i]) + " is in a relationship cycle within the immediate family.";
                }
            }
        }
    }
}

function checkDate(person, type) {
    if (selfcheckoption && datecheckoption) {
        var obj = getGeniData(person, type, "date");
        if (exists(obj.year) && exists(obj.day) && !exists(obj.month)) {
            //Year and Day without Month
            consistencymessage = concat("info") + buildEditLink(person) + " contains an incomplete " + type + " date, missing month.";
        } else if (!exists(obj.year) && (exists(obj.month) || exists(obj.day))) {
            //Month or Day without any year
            consistencymessage = concat("info") + buildEditLink(person) + " contains an incomplete " + type + " date, missing year.";
        }
    }
}

function validName(name) {
    return (name.length > 1 && isASCII(name) && name !== "NN" && name !== "unknown");
}

function isASCII(str) {
    return /^[\x00-\x7F]*$/.test(str);
}

function containsRange(person1, type1, person2, type2) {
    var d1 = getGeniData(person1, type1, "date");
    var d2 = getGeniData(person2, type2, "date");
    if (exists(d1.year) && exists(d2.year) && d1.year !== d2.year) {
        return false;
    }
    if (exists(d1.month) && exists(d2.month) && d1.month !== d2.month) {
        return false;
    }
    if (exists(d1.day) && exists(d2.day) && d1.day !== d2.day) {
        return false;
    }
    return true;
}

function unixDate(person, type) {
    var obj = getGeniData(person, type, "date");
    var date = new Date();
    if (!exists(obj.formatted_date) || obj.formatted_date === "" || exists(obj.range)) {
        if (type === "death" && getGeniData(person, "is_alive")) {
            //If the person is alive, return current date
            return parseInt(date.getTime() / 1000);
        } else {
            return NaN;
        }
    }
    if (exists(obj.year)) {
        date.setFullYear(obj.year);
        if (exists(obj.month)) {
            date.setMonth(obj.month-1);
        } else {
            date.setMonth(0);
        }
        if (exists(obj.day)) {
            date.setDate(obj.day);
        } else {
            date.setDate(1);
        }
        return parseInt(date.getTime() / 1000);
    } else {
        return NaN;
    }
}

function buildEditLink(person) {
    if (startsWithHTTP(tablink, "https://www.geni.com/family-tree")) {
        return "<a href='javascript:openEditCard(\"" + getGeniData(person, "guid") + "\"); void 0'>" + getGeniData(person, "name") + "</a>";
    }
    return "<a href='https://www.geni.com/profile/edit_basics/" + getGeniData(person, "guid") + "'>" + getGeniData(person, "name") + "</a>";
}

function improperSapce(name) {
    return name.contains("  ") || name.startsWith(" ") || name.endsWith(" ");
}

function formatName(namepart) {
    var name = namepart.split(" ");
    for (var i=0; i < name.length; i++) {
        name[i] = NameParse.fix_case(name[i]);
    }
    return name.join(" ");
}

function updateQMessage() {
    if (consistencymessage !== "") {
        $("#consistencyck").html("<span style='float: right; margin-top: -1px; padding-left: 10px;'><img id='refreshcheck' src='"+ chrome.extension.getURL("images/content_update.png") + "' style='cursor: pointer; margin-right: 3px; width: 12px;'><img class='consistencyslide' src='"+ chrome.extension.getURL("images/content_close.png") + "' style='cursor: pointer; width: 18px;'></span><a href='https://www.geni.com/projects/SmartCopy/18783' target='_blank'><img src='" + chrome.extension.getURL("images/icon.png") + "' style='width: 16px; margin-top: -3px; padding-right: 5px;' title='SmartCopy'></a></img><strong>Consistency Check:</strong>"
            + consistencymessage);
        $('.consistencyslide').off();
        $('.consistencyslide').on('click', function () {
            displayCheck(false);
        });
        $('.fixcase').off();
        $('.fixcase').on('click', function(){
            var id = $(this)[0].id.replace("case", "");
            var args = {};
            var nameparts = $(this)[0].name.split(",");
            for (var i=0;i < nameparts.length;i++) {
                args[nameparts[i]] = formatName(getGeniData(id, nameparts[i]));
            }
            var url = "https://www.geni.com/api/" + id + "/update-basics";
            $("#case" + id).replaceWith("<span style='cursor: default;'>[fixed <img src='"+ chrome.extension.getURL("images/content_check.png") + "' style='width: 14px; margin-top: -5px; margin-right: -3px;'></span>]");
            chrome.runtime.sendMessage({
                method: "POST",
                action: "xhttp",
                url: url,
                data: $.param(args)
            }, function (response) {
            });
        });
        $('.fixsuffix').off();
        $('.fixsuffix').on('click', function(){
            var id = $(this)[0].id.replace("fsuffix", "");
            var fnamesplit = getGeniData(id, "first_name").split(" ");
            var suffix = fnamesplit.pop();
            var args = {"suffix": suffix, "first_name": fnamesplit.join(" ")};
            var url = "https://www.geni.com/api/" + id + "/update-basics";
            $("#fsuffix" + id).replaceWith("<span style='cursor: default;'>[fixed <img src='"+ chrome.extension.getURL("images/content_check.png") + "' style='width: 14px; margin-top: -5px; margin-right: -3px;'></span>]");
            chrome.runtime.sendMessage({
                method: "POST",
                action: "xhttp",
                url: url,
                data: $.param(args)
            }, function (response) {
            });
        });
        $('.fixspace').off();
        $('.fixspace').on('click', function(){
            var id = $(this)[0].id.replace("space", "");
            var args = {};
            var nameparts = $(this)[0].name.split(",");
            for (var i=0;i < nameparts.length;i++) {
                args[nameparts[i]] = getGeniData(id, nameparts[i]).replace("  ", " ").trim();
            }
            var url = "https://www.geni.com/api/" + id + "/update-basics";
            $("#space" + id).replaceWith("<span style='cursor: default;'>[fixed <img src='"+ chrome.extension.getURL("images/content_check.png") + "' style='width: 14px; margin-top: -5px; margin-right: -3px;'></span>]");
            chrome.runtime.sendMessage({
                method: "POST",
                action: "xhttp",
                url: url,
                data: $.param(args)
            }, function (response) {
            });
        });
        $('.fixtitle').off();
        $('.fixtitle').on('click', function(){
            var args = {};
            var name = $(this)[0].name;
            var id = $(this)[0].id.replace(name, "");
            args[name] = "";
            var url = "https://www.geni.com/api/" + id + "/update-basics";
            $("#" + name + id).replaceWith("<span style='cursor: default;'>[fixed <img src='"+ chrome.extension.getURL("images/content_check.png") + "' style='width: 14px; margin-top: -5px; margin-right: -3px;'></span>]");
            chrome.runtime.sendMessage({
                method: "POST",
                action: "xhttp",
                url: url,
                data: $.param(args)
            }, function (response) {
            });
        });
        $('#refreshcheck').off();
        $('#refreshcheck').on('click', function () {
            displayCheck(false);
            queryGeni();
        });
        displayCheck(true);
    } else {
        displayCheck(false);
    }
}

function displayCheck(visible) {
    if (visible) {
        $('#fb-sharing-wrapper').css({'visibility': 'hidden', 'opacity': 0, 'transition': 'visibility 0s, linear 300ms, opacity 300ms'});
        $("#consistencyck").slideDown();
    } else {
        $("#consistencyck").slideUp(function() {
            $('#fb-sharing-wrapper').css({'visibility': 'visible', 'opacity': 1, 'transition': 'visibility 0s, linear 0s, opacity 300ms'});
        });
    }
}

function getFocus() {
    return genifamily["focus"].id;
}

function getParents() {
    var familyset = [];
    var focusid = getFocus();
    var focus = getGeniData(focusid, "edges");
    for (var union in focus) {
        if (!focus.hasOwnProperty(union)) continue;
        if (isChild(focus[union].rel) && !exists(focus[union].rel_modifier)) {
            var edges = uniondata[union]["edges"];
            for (var profile in edges) {
                if (!edges.hasOwnProperty(profile)) continue;
                if (isPartner(edges[profile].rel)) {
                    if ("marriage" in uniondata[union]) {
                        var person = genifamilydata[profile];
                        person.set("marriage", uniondata[union]["marriage"]);
                    }
                    if ("divorce" in uniondata[union]) {
                        var person = genifamilydata[profile];
                        person.set("divorce", uniondata[union]["divorce"]);
                    }
                    familyset.push(profile);
                }
            }
        }
    }
    return familyset;
}

function getParentSets(focus, parents) {
    var focusedge = getGeniData(focus, "edges");
    var parentset = {};
    for (var union in focusedge) {
        if (!focusedge.hasOwnProperty(union)) continue;
        if (isChild(focusedge[union].rel)) {
            for (var i=0; i < parents.length; i++) {
                var parentedge = getGeniData(parents[i], "edges");
                for (var punion in parentedge) {
                    if (!parentedge.hasOwnProperty(punion)) continue;
                    if (punion === union) {
                        if (!exists(parentset[union])) {
                            parentset[union] = [];
                        }
                        parentset[union].push(parents[i]);
                    }
                }
            }
        }

    }
    return parentset;
}

function getChildren(focusid, partner) {
    var familyset = [];
    var focus = getGeniData(focusid, "edges");
    for (var union in focus) {
        if (!focus.hasOwnProperty(union)) continue;
        if (isPartner(focus[union].rel)) {
            if (!exists(uniondata[union])) {
                return familyset;
            }
            var edges = uniondata[union]["edges"];
            var loopedges = false;
            if (exists(partner) && partner in edges) {
                loopedges = true;
            } else if (!exists(partner)) {
                loopedges = true;
            }
            if (loopedges) {
                for (var profile in edges) {
                    if (!edges.hasOwnProperty(profile)) continue;
                    if (isChild(edges[profile].rel)) {
                        familyset.push(profile);
                    }
                }
            }

        }
    }
    return familyset;
}

function getSiblings() {
    var familyset = [];
    var focusid = getFocus();
    var focus = getGeniData(focusid, "edges");
    for (var union in focus) {
        if (!focus.hasOwnProperty(union)) continue;
        if (isChild(focus[union].rel) && !exists(focus[union].rel_modifier)) {
            var edges = uniondata[union]["edges"];
            for (var profile in edges) {
                if (!edges.hasOwnProperty(profile)) continue;
                if (isChild(edges[profile].rel) && profile !== focusid) {
                    familyset.push(profile);
                }
            }
        }
    }
    return familyset;
}

function getPartners() {
    var familyset = [];
    var focusid = getFocus();
    var focus = getGeniData(focusid, "edges");
    for (var union in focus) {
        if (!focus.hasOwnProperty(union)) continue;
        if (isPartner(focus[union].rel)) {
            var edges = uniondata[union]["edges"];
            for (var profile in edges) {
                if (!edges.hasOwnProperty(profile)) continue;
                if (isPartner(edges[profile].rel) && profile !== focusid) {
                    if ("marriage" in uniondata[union]) {
                        var person = genifamilydata[profile];
                        person.set("marriage", uniondata[union]["marriage"]);
                    }
                    if ("divorce" in uniondata[union]) {
                        var person = genifamilydata[profile];
                        person.set("divorce", uniondata[union]["divorce"]);
                    }
                    familyset.push(profile);
                }
            }
        }
    }
    return familyset;
}

function getPronoun(gender) {
    if (isFemale(gender)) {
        return "her";
    } else if (isMale(gender)) {
        return "his";
    } else {
        return "their";
    }
}

function parentName(gender) {
    if (isFemale(gender)) {
        return "mother";
    } else if (isMale(gender)) {
        return "father";
    } else {
        return "parent";
    }
}

function siblingName(gender) {
    if (isFemale(gender)) {
        return "sister";
    } else if (isMale(gender)) {
        return "brother";
    } else {
        return "sibling";
    }
}

function getStatus(relation, gender) {
    if (relation === "partner") {
        return relation;
    } else if (relation === "mother") {
        return "wife";
    } else if (relation === "father") {
        return "husband";
    } else {
        if (isFemale(gender)) {
            return "wife";
        } else if (isMale(gender)) {
            return "husband";
        } else {
            return relation;
        }
    }
}

function concat(type) {
    var icon = "<img src='" + chrome.extension.getURL("images/content_" + type + ".png") + "' style='width: 14px; padding-left: 6px; padding-right: 2px; margin-top: -3px;'>";
    if (consistencymessage !== "") {
        return consistencymessage += icon;
    }
    return icon;
}

chrome.storage.local.get('geniconsistency', function (result) {
    if (result.geniconsistency) {
        buildconsistencyDiv();
    } else if (result.geniconsistency === undefined) {
        chrome.storage.local.set({'geniconsistency': true});
        buildconsistencyDiv();
    }
});

chrome.storage.local.get('namecheck', function (result) {
    if (result.namecheck !== undefined) {
        namecheckoption = result.namecheck;
    }
});

chrome.storage.local.get('siblingcheck', function (result) {
    if (result.siblingcheck !== undefined) {
        siblingcheckoption = result.siblingcheck;
    }
});

chrome.storage.local.get('agelimitwarn', function (result) {
    if (result.agelimitwarn !== undefined) {
        longevity_warn = result.agelimitwarn;
    }
});

chrome.storage.local.get('agelimiterror', function (result) {
    if (result.agelimiterror !== undefined) {
        longevity_error = result.agelimiterror;
    }
});

chrome.storage.local.get('childcheck', function (result) {
    if (result.childcheck !== undefined) {
        childcheckoption = result.childcheck;
    }
});

chrome.storage.local.get('partnercheck', function (result) {
    if (result.partnercheck !== undefined) {
        partnercheckoption = result.partnercheck;
    }
});

chrome.storage.local.get('agecheck', function (result) {
    if (result.agecheck !== undefined) {
        agecheckoption = result.agecheck;
    }
});

chrome.storage.local.get('birthyoung', function (result) {
    if (result.birthyoung !== undefined) {
        birthage_young = result.birthyoung;
    }
});

chrome.storage.local.get('birthold', function (result) {
    if (result.birthold !== undefined) {
        birthage_old = result.birthold;
    }
});

chrome.storage.local.get('marriageyoung', function (result) {
    if (result.marriageyoung !== undefined) {
        marriageage_young = result.marriageyoung;
    }
});

chrome.storage.local.get('marriagedif', function (result) {
    if (result.marriagedif !== undefined) {
        spouse_age_dif = result.marriagedif;
    }
});

chrome.storage.local.get('wedlockcheck', function (result) {
    if (result.wedlockcheck !== undefined) {
        wedlock = result.wedlockcheck;
    }
});

chrome.storage.local.get('termlimit', function (result) {
    if (result.termlimit !== undefined) {
        termlimit = result.termlimit;
        pregnancy = termlimit * (year/12);
    }
});

chrome.storage.local.get('selfcheck', function (result) {
    if (result.selfcheck !== undefined) {
        selfcheckoption = result.selfcheck;
    }
});
chrome.storage.local.get('datecheck', function (result) {
    if (result.datecheck !== undefined) {
        datecheckoption = result.datecheck;
    }
});

chrome.storage.local.get('samenamecheck', function (result) {
    if (result.samenamecheck !== undefined) {
        samenameoption = result.samenamecheck;
    }
});