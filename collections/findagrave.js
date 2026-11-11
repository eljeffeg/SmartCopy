// #364: the strip-inline-event-handlers helper now lives in shared.js
// (used by popup.js too, not just this file) - see its own comment there
// for the full story.

registerCollection({
    "recordtype": "Find A Grave Memorial",
    "usesDeepResearch": true, // #213 follow-up: fetchFindAGraveFamilyViaTab() below
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
            focusURLid = getFAGID(url);
            getPageCode();
        }
    },
    "loadPage": function(request) {
        let parsed = $(stripInlineEventHandlers(request.source.replace(/<img[^>]*>/ig, "")));
        let fperson = parsed.find("#bio-name");
        focusname = getFindAGraveName($(fperson[0]).html()).trim();
        let title = parsed.filter('title').text().replace(" - Find A Grave Memorial", "");
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
    let parsed = $(stripInlineEventHandlers(htmlstring.replace(/<img[^>]*>/ig,"")));
    let focusdaterange = "";
    let title = parsed.filter('title').text().replace(" - Find A Grave Memorial", "");
    if (title.contains("(")) {
        splitrange = title.split("(");
        focusdaterange = splitrange[1];
        focusdaterange = focusdaterange.replace(")","").trim();
    }
    let fperson = parsed.find(".plus2").find("b");
    if (!exists(fperson[0])) {
        //In case the Memorial has been merged
        fperson = parsed.find("#bio-name");
        if (exists(fperson[0]) && $(fperson[0]).html() === "Memorial has been merged.") {
            let click = $(fperson[0]).next('table').find('a');
            let urlset = exists(click[0]) ? click[0].outerHTML.match('href="(.*)"') : null;
            let url = "";
            if (exists(urlset) && exists(urlset[1])) {
                url = hostDomain(tablink) + urlset[1];
                familystatus.push(familystatus.length);
                chrome.runtime.sendMessage({
                    method: "GET",
                    action: "xhttp",
                    url: url,
                    variable: relation
                }, function (response) {
                    try {
                        let arg = response.variable;
                        let person = parseFindAGrave(response.source, familymembers, response.variable);
                        person = updateInfoData(person, arg);
                        // arg is the relation object for this person - shaped
                        // {title, proid, itemId} for family members (see
                        // getFindAGraveFamily() above), or the string "" for the
                        // focus person (no family context to file this under).
                        // Only family members have a real slot to record - a
                        // merged focus-person memorial has nothing meaningful to
                        // attribute this redirect's result to.
                        if (exists(arg.proid)) {
                            databyid[arg.proid] = person;
                            alldata["family"][arg.title].push(person);
                        }
                    } catch (e) {
                        console.error("SmartCopy [parseFindAGrave merged-memorial redirect]: failed to parse the redirected memorial, skipping it rather than hanging the import", e);
                    } finally {
                        familystatus.pop();
                    }
                });
            }
            return "";
        }
    }
    let focusperson = getFindAGraveName($(fperson[0]).html()).trim();
    $("#readstatus").html(escapeHtml(focusperson));
    let genderval = "unknown";
        if (focusperson.contains("(born")) {
            genderval = "female";
        }
    if (relation === "") {
        focusgender = genderval;
    } else if (exists(relation.genderval) && genderval === "unknown") {
        genderval = relation.genderval
    }
    let aboutdata = "";
    let profiledata = {name: focusperson, gender: genderval, status: relation.title};

    if (familymembers) {
        loadGeniData();
    }

    // ---------------------- Profile Data --------------------
    if (focusdaterange !== "") {
        profiledata["daterange"] = focusdaterange;
    }
    
    let abouttemp = parsed.find("#fullBio").html();
    if (exists(abouttemp)) {
        aboutdata = $($.parseHTML(abouttemp.replace(/<br>/g, "\n"))).text().trim();
    }
    profiledata = addEvent(profiledata, "birth", parsed.find("#birthDateLabel").text(), parsed.find("#birthLocationLabel").text());
    profiledata = addEvent(profiledata, "baptism", parsed.find("#baptismDateLabel").text(), parsed.find("#baptismLocationLabel").text());
    profiledata = addEvent(profiledata, "death", parsed.find("#deathDateLabel").text(), parsed.find("#deathLocationLabel").text());
    let cemetery = parsed.find("#burialLocationLabel").text();
    if (cemetery === "") {
        cemetery = parsed.find("#cemeteryNameLabel").text();
        let placeinfo = parsed.find("#cemeteryNameLabel").closest("div").next();
        let cemeteryplace = [];
        if (placeinfo.length > 0) {
            cemeteryplace = placeinfo[0].childNodes;
        }
        if (cemeteryplace.length > 0) {
            cemetery += ", ";
        }
        for (let i = 0; i < cemeteryplace.length; i++) {
            let item = $(cemeteryplace[i]).text().trim();
            if (item === ",") {
                item += " ";
            }
            if (item !== "Add to Map" && !item.includes("Show Map")) {
                cemetery += item;
            }
        }
    }
    profiledata = addEvent(profiledata, "burial", parsed.find("#burialDateLabel").text(), cemetery.trim());
    
    // ---------------------- Family Data --------------------
    let pid = "";
    let mid = "";
    let parentstrings = parsed.find("#parentsLabel").next().find("a");
    for (const element of parentstrings) {
        let parentstr = $(element).attr("href").replace("/memorial/", "").split("/")[0];
        if (isNaN(parseInt(pid))) {
            pid = parentstr;
        } else if (isNaN(parseInt(mid))) {
            mid = parentstr;
        }
    }

    if (!familymembers && (isNaN(parseInt(pid)) || isNaN(parseInt(mid)))) {
        let familyquery = parsed.find(".member-family");
        for (let i = 0; i < familyquery.length; i++) {
            let title = $(familyquery[i]).prev().text().toLowerCase();
            if (isParent(title)) {
                let group = $(familyquery[i]).find(".name");
                for (let x = 0; x < group.length; x++) {
                    let url = $(group[x]).attr("href");
                    if (exists(url)) {
                        let itemid = getFAGID(url);
                        if (isNaN(parseInt(pid))) {
                            pid = itemid;
                        } else if (isNaN(parseInt(mid)) && pid != itemid) {
                            mid = itemid;
                        }
                    }
                }
            }
        }
    }

    if (familymembers) {
        let famid = 0;
        let familyquery = parsed.find(".member-family");
        for (let i = 0; i < familyquery.length; i++) {
            let title = $(familyquery[i]).prev().text().toLowerCase();
            if (exists(title)) {
                if (title === "half siblings") {
                    title = "siblings";
                }
                let group = $(familyquery[i]).find('a');
                for (let x = 0; x < group.length; x++) {
                    let url = $(group[x]).attr("href");
                    if (exists(url)) {
                        let itemid = getFAGID(url);
                        let name = NameParse.fix_case(url.substring(url.lastIndexOf('/') + 1).replace(/[-_]/g, " "));
                        if (!exists(alldata["family"][title])) {
                            alldata["family"][title] = [];
                        }

                        if (isParent(title)) {
                            if (itemid === pid) {
                                genderval = "male";
                            } else if (itemid === mid) {
                                genderval = "female";
                            }
                            if (isNaN(parseInt(pid))) {
                                pid = itemid;
                            } else if (isNaN(parseInt(mid)) && pid != itemid) {
                                mid = itemid;
                            }
                        }
                        let subdata = {name: name, title: title, genderval: genderval};
                        if (!url.startsWith("http")) {
                            url = "https://www.findagrave.com" + url;
                        }
                        subdata["url"] = url;
                        subdata["itemId"] = itemid;
                        subdata["profile_id"] = famid;
                        if (isParent(title)) {
                            parentlist.push(itemid);
                        } else if (isPartner(title)) {
                            myhspouse.push(famid);
                        }
                        unionurls[famid] = itemid;
                        getFindAGraveFamily(famid, url, subdata);
                        famid++;
                    }
                }
            }
        }
    } else if (isChild(relation.title)) {
        if (pid !== undefined && focusURLid !== pid) {
            childlist[relation.proid] = $.inArray(pid, unionurls);
            profiledata["parent_id"] = $.inArray(pid, unionurls);

        } else if (mid !== undefined && focusURLid !== mid) {
            childlist[relation.proid] = $.inArray(mid, unionurls);
            profiledata["parent_id"] = $.inArray(mid, unionurls);
        }
    } else if (isSibling(relation.title)) {
        let siblingparents = [];

        if (pid !== "") {
            siblingparents.push(pid);
        }
        if (mid !== "") {
            siblingparents.push(mid);
        }
        if (siblingparents.length > 0) {
            profiledata["halfsibling"] = !recursiveCompare(parentlist, siblingparents);
        }
    }




    // ---------------------- Profile Continued --------------------
    parsed = $(stripInlineEventHandlers(htmlstring.replace(/<img/ig,"<gmi")));

    profiledata["alive"] = false; //assume deceased
    let imagedata = parsed.find("#profileImage");
    if (exists(imagedata[0])) {
        let thumb = $(imagedata[0]).attr( "src" );
        if (startsWithHTTP(thumb, "https://images") || thumb.contains("find-a-grave-prod/photos")) {
            let image = thumb.replace("photos250/", "");
            profiledata["thumb"] = thumb;
            profiledata["image"] = image;
            let credit = parsed.find("#main-photo").next().find("a");
            if (credit.length > 1) {
                profiledata["imagecredit"] = $(credit).text().trim().replace('"', '').replace("'", "");
            }
        }
    }

    if (aboutdata.trim() !== "") {
        profiledata["about"] = cleanHTML(aboutdata);
    }

    if (familymembers) {
        alldata["profile"] = profiledata;
        alldata["scorefactors"] = smscorefactors;
        updateGeo();
    }
    return profiledata;
}

function getFindAGraveName(focusperson) {
    if (!exists(focusperson)) {
        return "";
    }
    focusperson = focusperson.split("\<b class")[0].trim(); //filter veteran from name
    let personborn = focusperson.match(/<i>(.*)<\/i>/i);
    if (exists(personborn) && exists(personborn[0])) {
        focusperson = focusperson.replace(personborn[0], "");
        focusperson = focusperson + " (born " + personborn[1] + ")";
    }
    focusperson = focusperson.replace(/(<([^>]+)>)/ig, "");
    return focusperson;
}


function getFAGID(url) {
    let fagid = url.substring(url.lastIndexOf('memorial/') + 9).replace("#", "");
    if (fagid.contains("/")) {
        fagid = fagid.substring(0, fagid.indexOf('/'));
    }
    return fagid;
}


// Live-reported, Dan Bodenheimer (https://www.findagrave.com/memorial/
// 150507526/leo-hirschfeld): multiple family members in the same import
// came back with blank/slug-only data (no maiden name, no dates, no
// gender) - confirmed directly via debug logging that the fetched
// response.source was Cloudflare's own "Just a moment..." challenge page,
// not real FindAGrave content, for every family member checked. A plain
// background fetch can never pass that challenge on its own (no JS
// execution) - same root cause and same fix shape already proven for
// Geneanet (#195) and the other Deep-Research sites: fall back to a real
// hidden browser tab, which can actually clear the challenge the way a
// normal visit does.
function getFindAGraveFamily(famid, url, subdata) {
    familystatus.push(famid);
    fetchFindAGravePlain(url, subdata, function (person, arg) {
        if (isUsableFindAGravePerson(person)) {
            finishFindAGraveFamilyMember(famid, person, arg);
            return;
        }
        // The plain fetch failed to produce real data - almost always the
        // Cloudflare challenge page. Once any ONE real tab has passed it
        // this session (findagraveClearanceLikely, set in
        // runFindAGraveTabFetch() below), Cloudflare's own clearance
        // cookie should carry over to other plain fetches too (same
        // behavior already confirmed live for Geneanet) - retrying the
        // much cheaper plain fetch once is worth it before assuming every
        // remaining family member needs their own slow tab.
        if (findagraveClearanceLikely) {
            fetchFindAGravePlain(url, subdata, function (retryPerson, retryArg) {
                if (isUsableFindAGravePerson(retryPerson)) {
                    finishFindAGraveFamilyMember(famid, retryPerson, retryArg);
                } else {
                    fetchFindAGraveFamilyViaTab(famid, url, retryArg);
                }
            });
        } else {
            fetchFindAGraveFamilyViaTab(famid, url, arg);
        }
    });
}

function fetchFindAGravePlain(url, subdata, callback) {
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url,
        variable: subdata
    }, function (response) {
        let arg = (exists(response) && exists(response.variable)) ? response.variable : subdata;
        let person = "";
        try {
            if (exists(response) && exists(response.source)) {
                person = parseFindAGrave(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
            }
        } catch (e) {
            console.error("SmartCopy [fetchFindAGravePlain]: failed to parse a family member's memorial, falling back to Deep Research rather than hanging the import", e);
            person = "";
        }
        callback(person, arg);
    });
}

// Only treat a parse as "good enough" if it actually produced a name or a
// date - a blank name with no birth/death is exactly what the Cloudflare
// challenge page parses as (confirmed live via debug logging: name "",
// gender "unknown", no birth/death at all), while a real memorial almost
// never has literally none of the three.
function isUsableFindAGravePerson(person) {
    return exists(person) && person !== "" && (person.name !== "" || exists(person.birth) || exists(person.death));
}

function finishFindAGraveFamilyMember(famid, person, arg) {
    // updateInfoData() (buildform.js) already falls back to arg itself
    // (the crude URL-slug name guess) whenever person is "" - calling it
    // unconditionally, rather than only when person is non-blank, is what
    // makes a totally-failed fetch (Deep Research off, tab exhausted,
    // etc.) still produce a reviewable fallback row instead of silently
    // dropping the family member from the results entirely.
    person = updateInfoData(person, arg);
    databyid[arg.profile_id] = person;
    alldata["family"][arg.title].push(person);
    familystatus.pop();
}

// Every family member's plain fetch can fail at once (Cloudflare is
// consistent within a session) - opening one tab per person simultaneously
// would be both disruptive to watch and plausibly worse for Cloudflare's
// own bot-detection, not better. This queue runs the tab fallback for one
// person at a time; everyone else's fallback just waits its turn. Same
// pattern already proven for Geneanet.
var findagraveTabQueue = [];
var findagraveTabRunning = false;
// Cloudflare's clearance, once earned by any ONE real tab navigation this
// session, applies to plain fetches too (same behavior already confirmed
// live for Geneanet) - set the first time a tab lands on real content.
var findagraveClearanceLikely = false;

function fetchFindAGraveFamilyViaTab(famid, url, arg) {
    findagraveTabQueue.push({famid: famid, url: url, arg: arg});
    runNextFindAGraveTabFetch();
}

function runNextFindAGraveTabFetch() {
    if (!deepResearchOn || deepResearchSkipRun) {
        while (findagraveTabQueue.length > 0) {
            let skipped = findagraveTabQueue.shift();
            finishFindAGraveFamilyMember(skipped.famid, "", skipped.arg);
        }
        return;
    }
    if (findagraveTabRunning || findagraveTabQueue.length === 0) {
        return;
    }
    findagraveTabRunning = true;
    let next = findagraveTabQueue.shift();
    runFindAGraveTabFetch(next.famid, next.url, next.arg, function () {
        findagraveTabRunning = false;
        runNextFindAGraveTabFetch();
    });
}

function runFindAGraveTabFetch(famid, url, arg, onDone) {
    // Mirrors the per-person status update parseFindAGrave() already does
    // for the plain-fetch path - without this, the status label just sits
    // on whatever it last said while a tab silently loads in the
    // background, which reads as a hang even though it's real,
    // still-in-progress work.
    $("#readstatus").html(escapeHtml(arg.name) + " (looking deeper, this may take a second)");
    chrome.tabs.create({url: url, active: false}, function (tab) {
        if (!exists(tab) || !exists(tab.id)) {
            finishFindAGraveFamilyMember(famid, "", arg);
            onDone();
            return;
        }
        let settled = false;
        let attempts = 0;
        // Only the very top of the page is actually needed (name, dates,
        // family list) - not the rest of the page (photos, flowers, ads) -
        // but Chrome throttles rendering/network for active:false
        // background tabs fairly aggressively, and the Cloudflare
        // challenge itself takes a moment to clear. Same budget already
        // proven for Geneanet's equivalent tab fetch.
        let maxAttempts = 10;

        function cleanupAndFinish(person) {
            if (settled) {
                return;
            }
            settled = true;
            let abortIndex = deepResearchInFlightAborts.indexOf(abortThisFetch);
            if (abortIndex !== -1) {
                deepResearchInFlightAborts.splice(abortIndex, 1);
            }
            chrome.tabs.remove(tab.id, function () {
                // Swallow "no tab with id" - the tab may have already
                // closed (e.g. the user closed it manually) by the time
                // this runs; nothing left to clean up in that case.
                void chrome.runtime.lastError;
            });
            finishFindAGraveFamilyMember(famid, person, arg);
            onDone();
        }

        function abortThisFetch() {
            cleanupAndFinish("");
        }
        deepResearchInFlightAborts.push(abortThisFetch);

        function attempt() {
            if (settled) {
                return;
            }
            attempts++;
            // Polling chrome.tabs.get() directly, rather than reacting to
            // chrome.tabs.onUpdated's "complete" event, deliberately - same
            // reasoning as Geneanet's equivalent fetch: an onUpdated
            // listener only added after chrome.tabs.create()'s own callback
            // fires can lose the race against a fast-loading page and miss
            // the event entirely.
            chrome.tabs.get(tab.id, function (tabInfo) {
                if (chrome.runtime.lastError || !exists(tabInfo)) {
                    cleanupAndFinish("");
                    return;
                }
                chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    func: function () {
                        let html = "", node = document.firstChild;
                        while (node) {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                html += node.outerHTML;
                            } else if (node.nodeType === Node.TEXT_NODE) {
                                html += node.nodeValue;
                            }
                            node = node.nextSibling;
                        }
                        return html;
                    }
                }, function (results) {
                    if (settled) {
                        return;
                    }
                    // executeScript can fail here if the tab hasn't
                    // actually finished navigating to the real URL yet
                    // (still on about:blank right after chrome.tabs.create)
                    // - usually transient, and the next poll attempt
                    // succeeds once real navigation has started. Reading
                    // lastError just suppresses the "Unchecked lastError"
                    // console warning; the retry itself already happens
                    // naturally below since an empty/failed result isn't
                    // usable.
                    void chrome.runtime.lastError;
                    let html = (exists(results) && exists(results[0])) ? results[0].result : undefined;
                    let person = "";
                    try {
                        person = exists(html) ? parseFindAGrave(html, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId}) : "";
                    } catch (e) {
                        console.error("SmartCopy [runFindAGraveTabFetch]: failed to parse the tab-fetched memorial", e);
                        person = "";
                    }
                    if (isUsableFindAGravePerson(person)) {
                        // Reaching real, usable content at all means this
                        // tab is past whatever challenge Cloudflare showed
                        // it - see getFindAGraveFamily()'s use of this flag.
                        findagraveClearanceLikely = true;
                    }
                    if (isUsableFindAGravePerson(person) || attempts >= maxAttempts) {
                        // On the final attempt, use whatever came through
                        // even if incomplete - that's still strictly better
                        // than discarding it for the bare slug-name fallback.
                        cleanupAndFinish(person);
                    } else {
                        setTimeout(attempt, 1500);
                    }
                });
            });
        }
        setTimeout(attempt, 1500);
    });
}