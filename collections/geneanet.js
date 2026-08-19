registerCollection({
    "reload": false,
    "recordtype": "Geneanet Genealogy",
    "prepareUrl": function(url) {
        if (url.contains("type=")) {
            url = url.replace(/&type=.*?&/, "&");
            url = url.replace(/&type=.*?$/, "");
            url = url.replace(/\?type=.*?&/, "?");
            this.reload = true;
        }
        if (url.contains("lang=") && !url.contains("lang=en")) {
            url = url.replace(/lang=.*?(?=&|$)/, "lang=en");
            this.reload = true;
        }
        return url;
    },
    "collectionMatch": function(url) {
        return (startsWithHTTP(url, "https://gw.geneanet.org"));
    },
    "parseData": function(url) {
        focusURLid = getGeneanetItemId(url);
        getPageCode();
    },
    "loadPage": function(request) {
        var parsed = $(request.source.replace(/<img /ig, "<track "));
        var nameTab = parsed.find(".with_tabs.name");
        focusname = nameTab.find("a:not(:has(track))").first().text() + " " + nameTab.find("a:not(:has(track))").first().next().text();
    },
    "parseProfileData": parseGeneanet
});

function parseGeneanet(htmlstring, familymembers, relation) {
  // background.js's GET fetch path never sets response.error on failure (only
  // the POST path does) - a failed/blocked recursive family-member fetch (see
  // getGeneanetFamily()) comes back here as an undefined htmlstring instead,
  // which used to throw unguarded on the very next line, above the
  // familystatus.pop() in getGeneanetFamily()'s callback - hanging
  // "Reading Family Data..." forever. Same class of bug as Filae's
  // parseFilae() guard - see collections/filae.js.
  if (!exists(htmlstring)) {
      return "";
  }
  relation = relation || "";
  var parsed = $(htmlstring.replace(/<img /ig,"<track "));

  var nameTab = parsed.find(".with_tabs.name");
  var genderval = "unknown";
  var genderImg = nameTab.find("track").first();
  if (genderImg.attr("alt") === "Male") {
    genderval = "male";
  } else if (genderImg.attr("alt") === "Female") {
    genderval = "female";
  } else if (exists(relation.gender) && relation.gender !== "unknown") {
    genderval = relation.gender;
  }
  if (relation === "") {
    focusgender = genderval;
  }
  var aboutdata = "";
  var givenName = nameTab.find("a:not(:has(track))").first().text();
  var familyName = nameTab.find("a:not(:has(track))").first().next().text();
  var focusperson = givenName + " " + familyName;
  // exists($(nameTab).html()) guards against nameTab being empty entirely -
  // htmlstring can be a real, successfully-fetched page that just isn't a
  // profile page at all (Geneanet's login/view-limit page, most commonly -
  // confirmed live in Firefox once its CORS fix let plain fetches actually
  // reach Geneanet instead of failing outright). .with_tabs.name doesn't
  // exist on that page, so nameTab is an empty jQuery set and .html()
  // returns undefined - calling .replace() on that threw uncaught, above
  // the familystatus.pop() in getGeneanetFamily()'s callback chain, the
  // same hang-causing bug class already fixed once via the
  // !exists(htmlstring) guard at the top of this function. That guard only
  // catches a missing response; this catches a real response that isn't
  // a profile.
  if (focusperson.trim() === "" && exists($(nameTab).html())) {
      $(nameTab).html($(nameTab).html().replace("<em>", '"').replace("<\/em>", '"'));
      focusperson = $(nameTab).text().trim();
  }

  $("#readstatus").html(escapeHtml(focusperson));

  var profiledata = {name: focusperson, gender: genderval, status: relation.title};

  var img = $(nameTab).closest("table").prev().find("track").attr("src");
  if (exists(img)) {
      profiledata["thumb"] = img;
      profiledata["image"] = img.replace("/medium", "/normal");
  }

  fullBirth = parsed.find("ul li:contains('Born ')");
  if (exists(fullBirth)) {
    profiledata["birth"] = parseGeneanetDate($(fullBirth[0]).text().replace('Born ', ''));
  }

  fullBaptism = parsed.find("ul li:contains('Baptized ')");
  if (exists(fullBaptism)) {
    profiledata["baptism"] = parseGeneanetDate($(fullBaptism[0]).text().replace('Baptized ', ''));
  }

  fullDeath = parsed.find("ul li:contains('Deceased ')");
  if (exists(fullDeath)) {
    profiledata["death"] = parseGeneanetDate($(fullDeath[0]).text().replace('Deceased ', '').replace(/ at age .*/, '').replace(/ age at .*/, ''));
  }

  fullBurial = parsed.find("ul li:contains('Buried ')");
  if (exists(fullBurial)) {
    profiledata["burial"] = parseGeneanetDate($(fullBurial[0]).text().replace('Buried ', ''));
  }

  individualNote = parsed.find(".fiche-note-ind");
  if (exists(individualNote)) {
      var notes = $(individualNote).text().trim();
      if (notes !== "") {
            aboutdata += "===Individual Note===\n" + notes;
      }
  }

  familyNote = parsed.find("h3:contains('Family Note')");
  if (exists(familyNote)) {
      var notes = $(familyNote).nextUntil("div").text().trim();
      if (notes !== "") {
          if (aboutdata !== "") {
              aboutdata += "\n";
          }
          aboutdata += "===Family Note===\n" + notes;
      }
  }

  if (aboutdata.trim() !== "") {
      profiledata["about"] = aboutdata;
  }

  if (familymembers) {
    loadGeniData();
    var famid = 0;

    var parents = $(parsed).find('h2:has(span:contains("Parents")) + ul li');
    if (exists(parents[0])) {
      processGeneanetFamily(parents[0], "father", famid);
      famid++;
    }
    if (exists(parents[1])) {
      processGeneanetFamily(parents[1], "mother", famid);
      famid++;
    }

    var spouses = $(parsed).find('h2:has(span:contains("Spouses")) + ul.fiche_union > li');
    if (exists(spouses[0])) {
      for (var i = 0; i < spouses.length; i++) {
        var spouse = spouses[i];
        processGeneanetFamily(spouse, "spouse", famid);
        myhspouse.push(famid);
        famid++;

        var children = $(spouse).find("> ul > li");
        if (exists(children[0])) {
          for (var j = 0; j < children.length; j++) {
            processGeneanetFamily(children[j], "child", famid);
            famid++;
          }
        }
      }
    }

    var siblings = $(parsed).find('h2:has(span:contains("Siblings")) + ul li');
    siblings = siblings.filter(function(index) {
        if($(siblings[index]).find('b').length === 0){
            return true;
        }
    });
    if (exists(siblings[1])) {
        for (i=0; i<siblings.length; i++) {
            processGeneanetFamily(siblings[i], "sibling", famid);
            famid++;
        }
    }

  } else if (isParent(relation.title)) {
      if (parentmarriageid === "") {
          parentmarriageid = relation.itemId;
      } else if (relation.itemId !== parentmarriageid) {
          var spouses = $(parsed).find('h2:has(span:contains("Spouses")) + ul.fiche_union > li');
          for (i=0;i<spouses.length;i++) {
              var url = $(spouses[i]).find("a:not(:has(track))").attr("href");
              if (exists(url)) {
                  var itemid = getGeneanetItemId(url);
                  if (itemid === parentmarriageid) {
                      profiledata = processMarriage(spouses[i], profiledata);
                  }
              }
          }
      }
  } else if (isSibling(relation.title)) {
      var siblingparents = [];
      var parents = $(parsed).find('h2:has(span:contains("Parents")) + ul li');
      for (i=0;i<parents.length;i++) {
          var url = $(parent[i]).find("a:not(:has(track))").attr("href");
          if (exists(url)) {
              var itemid = getGeneanetItemId(url);
              siblingparents.push(itemid);
          }
      }
      if (siblingparents.length > 0) {
          profiledata["halfsibling"] = !recursiveCompare(parentlist, siblingparents);
      }
  } else if (isChild(relation.title)) {
      var parents = $(parsed).find('h2:has(span:contains("Parents")) + ul li');
      for (i=0;i<parents.length;i++) {
          var url = $(parent[i]).find("a:not(:has(track))").attr("href");
          if (exists(url)) {
              var itemid = getGeneanetItemId(url);
              if (focusURLid !== itemid) {
                  childlist[relation.proid] = $.inArray(itemid, unionurls);
                  profiledata["parent_id"] = $.inArray(itemid, unionurls);
                  break;
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

function parseGeneanetDate(vitalstring, type) {
  vitalstring = vitalstring.replace(/,$/, "").trim();
  // Example matches:
  // in 1675
  // about 1675
  // before 1675
  // after 1675
  // 30 September 1675 - Crouy sur Cosson, 41, France
  // 30 September 1675, Crouy sur Cosson, 41, France     // Marriage version
  // 30 September 1675 (Saturday) - Crouy sur Cosson, 41, France
  // before September 1675 - Crouy sur Cosson, 41, France
  // September 30, 1872 (Monday) - Rheinbischofsheim, Bade-Wurtemberg, Allemagne   // US-style, comma inside the date itself - see below
  var data;
  var matches;
  if (type === "marriage") {
    matches = vitalstring.match(/(about|before|after)?([\w\s]+\w)(?:\s+\(\w+\))?(?:,\s+(.+))?/i);
  } else {
    // [\w\s,]+ (not just [\w\s]+) - Geneanet doesn't only render dates as
    // "D MMMM YYYY" ("30 September 1675"); some trees (confirmed live on
    // Isidore Bodenheimer's profile) render US-style "MMMM D, YYYY"
    // ("September 30, 1872"), which has a comma INSIDE the date itself.
    // The original [\w\s]+ stopped matching group 2 at that comma, cutting
    // the year off entirely and silently producing an empty result for
    // every date on the page - not just family members, the focus profile
    // too. Safe to widen only here (not the marriage branch above): this
    // branch's date/place separator is " - ", not a comma, so an extra
    // comma inside the date can't be confused with it.
    matches = vitalstring.match(/(about|before|after)?([\w\s,]+\w)(?:\s+\(\w+\))?(?:\s+-\s+(.+))?/i);
  }
  if (exists(matches)) {
    data = [];
    var dateval = matches[2].trim();
    // Warning: nbsp; in date format!
    var nbspre = new RegExp(String.fromCharCode(160), "g");
    dateval = dateval.replace(nbspre, " ");
    // Parse stricly, and try harder if it fails
    var momentval;
    var date_format;
    if (dateval.startsWith("in ")) {
      momentval = moment(dateval.replace("in ", ""), "YYYY", true);
      date_format = "YYYY";
    } else {
      momentval = moment(dateval, "D MMMM YYYY", true);
      date_format = "MMM D YYYY";
      if (!momentval.isValid()) {
        // US-style "MMMM D, YYYY" counterpart to the widened regex above.
        momentval = moment(dateval, "MMMM D, YYYY", true);
        date_format = "MMM D YYYY";
      }
      if (!momentval.isValid()) {
        momentval = moment(dateval, "MMMM YYYY", true);
        date_format = "MMM-YYYY";
      }
      if (!momentval.isValid()) {
        momentval = moment(dateval, "YYYY", true);
        date_format = "YYYY";
      }
    }
    if (momentval.isValid()) {
        momentdate = momentval.format(date_format);
        if (matches[1] !== undefined) {
          momentdate = matches[1]+" "+momentdate;
        }
        dateval = cleanDate(momentdate);
        data.push({date: dateval});
    }

    var eventlocation = matches[3];
    if (eventlocation) {
      eventlocation = eventlocation.trim().replace(/ ?,$/,"");
      if (eventlocation !== "") {
        data.push({id: geoid, location: eventlocation});
        geoid++;
      }
    }
  }
  return data;
}

function processGeneanetFamily(person, title, famid) {
  var url = $(person).find("a:not(:has(track))").first().attr("href");
  if (exists(url)) {
    if (!exists(alldata["family"][title])) {
      alldata["family"][title] = [];
    }
    var nameTab = $(person).find("a:not(:has(track))").first();
    $(nameTab).html($(nameTab).html().replace("<em>", '"').replace("<\/em>", '"'));
    var name =  $(nameTab).text();
    var itemid = getGeneanetItemId(url);
    if (isParent(title)) {
      parentlist.push(itemid);
    }
    // Sections are inconsistent about this: confirmed live, the Siblings
    // list has its own "images/male.png"/"images/female.png" icon
    // (alt="Male"/"Female") right next to each name, but Parents and
    // Spouses do not - so try the icon first (real signal, not a guess)
    // and only fall back to relationship-based inference where there's no
    // icon to read.
    var gendersv = extractGeneanetGenderIcon(person);
    if (gendersv === "unknown") {
      if (isFemale(title)) {
        gendersv = "female";
      } else if (isMale(title)) {
        gendersv = "male";
      } else if (isPartner(title)) {
        gendersv = reverseGender(focusgender);
      }
    }
    var fullurl = hostDomain(tablink) + "/" + url;
    var subdata = {name: name, title: title, url: fullurl, gender: gendersv, itemId: itemid, profile_id: famid};
    // Sidebar-only fallback: the family list already shows a plain
    // "YYYY-YYYY" year range right next to each name (e.g. "Jacques Jerome
    // BODENHEIMER 1902-1969" - confirmed live, issue #195), independent of
    // whether getGeneanetFamily()'s recursive per-person fetch below
    // succeeds. updateInfoData() (buildform.js) already merges
    // birthyear/deathyear into the final person object whenever the fetch
    // doesn't produce real birth/death dates - same convention as
    // collections/smartmatch.js - so this guarantees at least a year even
    // when the fetch fails, instead of nothing at all.
    $.extend(subdata, extractGeneanetYearRange(person));
    // Parse marriage data
    subdata = processMarriage(person, subdata);
    unionurls[famid] = itemid;
    getGeneanetFamily(famid, fullurl, subdata);
  }
}

function extractGeneanetYearRange(person) {
  var clone = $(person).clone();
  clone.find("ul").remove(); // exclude nested children's own year ranges (e.g. a spouse card's own range must win over her listed children's)
  var text = clone.text();
  var result = {};
  var birthyear, deathyear;
  // Geneanet shows a bare "YYYY-" when only the birth year is known (still
  // living, or death year not recorded - e.g. "Adelaïde BRAUNSCHWEIG
  // 1849-", confirmed live) and presumably "-YYYY" the other way around
  // when only the death year is known. The original (\d{4})\s*-\s*(\d{4})
  // required BOTH sides, so it matched nothing at all for a partial range -
  // not even the one year that was actually available - instead of falling
  // back gracefully. Try the full range first, then each partial form.
  //
  // A year can also carry an approximate-date marker right before it (e.g.
  // "Loeb BRAUNSCHWEIG ca 1805-", confirmed live) - "ca"/"c."/"about"/"abt"
  // are the standard genealogy abbreviations for this (collections/rootsweb.js
  // already recognizes the same set). Captured and prefixed as "about " to
  // match parseGeneanetDate()'s own qualifier convention elsewhere in this
  // file, rather than silently discarding it and presenting an estimated
  // year as if it were exact.
  var QUALIFIER = "(?:ca\\.?|c\\.|about|abt\\.?)";
  var qualifiedYear = function (raw, qualifierGroup) {
    return exists(qualifierGroup) ? "about " + raw : raw;
  };
  var fullRange = text.match(new RegExp("(" + QUALIFIER + ")?\\s*(\\d{4})\\s*-\\s*(\\d{4})", "i"));
  if (exists(fullRange)) {
    birthyear = qualifiedYear(fullRange[2], fullRange[1]);
    deathyear = fullRange[3];
  } else {
    var birthOnly = text.match(new RegExp("(" + QUALIFIER + ")?\\s*(\\d{4})\\s*-(?!\\d)", "i"));
    if (exists(birthOnly)) {
      birthyear = qualifiedYear(birthOnly[2], birthOnly[1]);
    } else {
      var deathOnly = text.match(new RegExp("-\\s*(" + QUALIFIER + ")?\\s*(\\d{4})", "i"));
      if (exists(deathOnly)) {
        deathyear = qualifiedYear(deathOnly[2], deathOnly[1]);
      }
    }
  }
  if (exists(birthyear) || exists(deathyear)) {
    // Both shapes are needed here, not just one: updateInfoData()
    // (buildform.js) returns arg completely untouched (including whatever
    // shape birth/death happen to be in) whenever the recursive fetch
    // produced no person at all, but merges birthyear/deathyear - a plain
    // year string, not this array-of-object shape - into an *existing*
    // person object that's missing dates. Setting only birthyear/deathyear
    // (matching collections/smartmatch.js's convention) silently produced
    // no visible date at all whenever the fetch came back completely
    // empty, since that's the untouched-passthrough path, not the merge
    // path - confirmed live, no dates came through for any family member
    // despite this fallback already being in place.
    if (exists(birthyear)) {
      result.birth = [{date: birthyear}];
      result.birthyear = birthyear;
    }
    if (exists(deathyear)) {
      result.death = [{date: deathyear}];
      result.deathyear = deathyear;
    }
  }
  return result;
}

function extractGeneanetGenderIcon(person) {
  // person is a live element from the already-<track>-substituted parsed
  // page (parseGeneanet() does that replace once, up front, on the whole
  // page string before any of these per-card elements are found) - so the
  // gender icon here is a <track alt="Male"|"Female">, not a real <img>,
  // same as everywhere else in this file.
  var clone = $(person).clone();
  clone.find("ul").remove(); // exclude nested children's own gender icons
  var icon = clone.find("track[alt='Male'], track[alt='Female']").first();
  if (icon.length === 0) {
    return "unknown";
  }
  return icon.attr("alt") === "Male" ? "male" : "female";
}

function processMarriage(person, subdata) {
    if ($(person).text().startsWith("Married") && !$(person).text().startsWith("Married to")) {
        var marriageinfo = $(person).find("em").first();
        if (exists(marriageinfo)) {
            subdata["marriage"] = parseGeneanetDate(marriageinfo.text(), "marriage");
        }
    }
    return subdata;
}

function getGeneanetFamily(famid, url, subdata) {
    familystatus.push(famid);
    fetchGeneanetPlain(url, subdata, function (person, arg, loginWall) {
        if (isUsableGeneanetPerson(person)) {
            finishGeneanetFamilyMember(famid, person, arg);
            return;
        }
        if (loginWall) {
            // This fetch's own redirect chain already confirms the wall
            // for this URL - retrying the identical plain fetch would just
            // hit the same redirect again, so skip straight to the tab
            // (which is what actually confirms it globally and shows the
            // notice - see isGeneanetLoginWall() usage in
            // runGeneanetTabFetch() - a single fetch's redirect isn't
            // trusted for that on its own, only for skipping this one
            // pointless retry).
            fetchGeneanetFamilyViaTab(famid, url, arg);
            return;
        }
        // The plain background fetch above came back without real
        // birth/death dates - almost always because Geneanet's Cloudflare
        // bot-check served a "Just a moment..." interstitial instead of
        // the real page (confirmed live - see issue #195). A
        // background-script fetch can never solve that challenge on its
        // own since it doesn't execute page JS - but once any ONE real tab
        // has passed it this session (geneanetClearanceLikely, set by
        // runGeneanetTabFetch() below), Cloudflare's own clearance cookie
        // should carry over to every other plain fetch too (confirmed live
        // earlier: several concurrent plain fetches all succeeded once
        // past the challenge once). Retrying the plain fetch once here is
        // far cheaper than a tab, so try that first rather than assuming
        // every family member needs their own slow tab.
        if (geneanetClearanceLikely) {
            fetchGeneanetPlain(url, subdata, function (retryPerson, retryArg, retryLoginWall) {
                if (isUsableGeneanetPerson(retryPerson)) {
                    finishGeneanetFamilyMember(famid, retryPerson, retryArg);
                } else {
                    fetchGeneanetFamilyViaTab(famid, url, retryArg);
                }
            });
        } else {
            fetchGeneanetFamilyViaTab(famid, url, arg);
        }
    });
}

function fetchGeneanetPlain(url, subdata, callback) {
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        variable: subdata,
        url: url,
        latency: 190
    }, function (response) {
        var arg = (exists(response) && exists(response.variable)) ? response.variable : subdata;
        var person = "";
        if (exists(response) && exists(response.source)) {
            person = parseGeneanet(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
        }
        var loginWall = isGeneanetLoginWall(exists(response) ? response.responseURL : undefined);
        callback(person, arg, loginWall);
    });
}

// Only treat a parse as "good enough" if it actually produced a date -
// name/gender alone doesn't distinguish a real (but sparse) profile from a
// Cloudflare interstitial or other non-profile page, but a real birth or
// death date essentially never comes from anything else.
function isUsableGeneanetPerson(person) {
    return exists(person) && person !== "" && (exists(person.birth) || exists(person.death));
}

function finishGeneanetFamilyMember(famid, person, arg) {
    person = updateInfoData(person, arg);
    databyid[arg.profile_id] = person;
    alldata["family"][arg.title].push(person);
    familystatus.pop();
}

// Every family member's plain fetch can fail at once (Cloudflare is
// consistent within a session), which used to open one tab per person
// simultaneously - a burst of new tabs is both disruptive to watch and
// plausibly makes Cloudflare's bot-detection worse, not better. This queue
// runs the tab fallback for one person at a time; everyone else's fallback
// just waits its turn.
var geneanetTabQueue = [];
var geneanetTabRunning = false;
// Once a real tab confirms Geneanet's login/view-limit wall (it caps how
// many profiles you can view per session/account, unrelated to Cloudflare -
// confirmed live: /connexion/?from=view_limit_redirect&url=...), every
// other family member's tab fallback would hit the exact same wall. It's
// not a per-request block that a fresh tab or a wait can get past, so once
// confirmed, skip straight to fallback data for everything still queued
// instead of opening (and waiting out) more tabs that are certain to fail
// the same way.
var geneanetLoginWallHit = false;
// Cloudflare's clearance, once earned by any ONE real tab navigation this
// session, applies to plain fetches too (confirmed live: several
// concurrent plain fetches all succeeded once past the challenge once).
// Set the first time a tab lands on a real (non-walled) page - getGeneanetFamily()
// uses this to retry the much cheaper plain fetch before falling back to
// another slow tab for later family members.
var geneanetClearanceLikely = false;

function isGeneanetLoginWall(url) {
    return exists(url) && (url.indexOf("/connexion") !== -1 || url.indexOf("view_limit_redirect") !== -1);
}

function fetchGeneanetFamilyViaTab(famid, url, arg) {
    geneanetTabQueue.push({famid: famid, url: url, arg: arg});
    runNextGeneanetTabFetch();
}

function runNextGeneanetTabFetch() {
    if (!deepResearchOn || deepResearchSkipRun) {
        while (geneanetTabQueue.length > 0) {
            var skipped = geneanetTabQueue.shift();
            finishGeneanetFamilyMember(skipped.famid, "", skipped.arg);
        }
        return;
    }
    if (geneanetTabRunning || geneanetTabQueue.length === 0) {
        return;
    }
    geneanetTabRunning = true;
    var next = geneanetTabQueue.shift();
    runGeneanetTabFetch(next.famid, next.url, next.arg, function () {
        geneanetTabRunning = false;
        runNextGeneanetTabFetch();
    });
}

// The status ticker ($("#readstatus"), updated per-person throughout the
// read) is the wrong place for this - it gets overwritten by the very next
// family member a moment later, so a login-wall notice there would flash
// and vanish before anyone could read it. #message (popup.js's
// setMessage()/updateMessage(), used throughout for things like "Geni
// replies that you have no permissions...") is a separate, persistent
// banner that stays up for the rest of the popup session instead - shown
// once, with a real "Log in" button (see below for why it's a button, not
// an auto-opened window).
//
// The click handler also starts a poll, mirroring exactly how Geni's own
// login flow works (popup.js's $("#genilogin").on("click", ...) /
// loginpoll): open the login window, then poll once a second to notice
// when it's done, auto-reloading the popup the moment it is. Like Geni's
// version, this is a bonus for whenever the popup happens to survive, NOT
// the reliable path - Geni's own loginpoll is a plain popup.js
// setInterval too, with no chrome.storage or background.js involved, so
// it's just as dependent on the popup staying open, and Geni's UI tells
// the user to click the icon again for the same reason. "Reopen SmartCopy
// once you're done" stays the message and the guaranteed fallback either
// way.
var geneanetLoginNoticeShown = false;
var geneanetLoginPoll = null;

function showGeneanetLoginNotice(url) {
    if (geneanetLoginNoticeShown) {
        return;
    }
    geneanetLoginNoticeShown = true;
    // Deliberately not sharing buildform.js's own .ctrllink class here:
    // updateClassResponse() later does $('.ctrllink').off() (removing
    // EVERY handler bound to that class, including this one) before
    // rebinding its own handler, which expects a url attribute this link
    // doesn't have - inline styling instead of a shared class avoids that
    // collision entirely.
    updateMessage(warningmsg, "Geneanet is requiring login to show full birth/death dates and places for family members. " +
        "<a class=\"geneanet-login-link\" style=\"cursor:pointer; text-decoration:underline;\">Log in</a>, then click the SmartCopy icon again.");
    // window.open() used to be called automatically the moment the wall was
    // detected - but that happens deep inside async tab-polling callbacks,
    // not as the direct result of a click, so Chrome's popup blocker was
    // silently swallowing it (confirmed live: no window ever appeared).
    // Opening it from a real click handler instead counts as a genuine
    // user gesture, which popup blockers allow through.
    $("#message").off("click", ".geneanet-login-link").on("click", ".geneanet-login-link", function () {
        window.open("https://en.geneanet.org/connexion/", "geneanetlogin", "width=660,height=620");
        if (geneanetLoginPoll) {
            clearInterval(geneanetLoginPoll);
        }
        var attempts = 0;
        geneanetLoginPoll = setInterval(function () {
            if (attempts++ > 120) {
                clearInterval(geneanetLoginPoll);
                geneanetLoginPoll = null;
                return;
            }
            fetchGeneanetPlain(url, {}, function (person) {
                if (isUsableGeneanetPerson(person)) {
                    clearInterval(geneanetLoginPoll);
                    geneanetLoginPoll = null;
                    window.location.reload();
                }
            });
        }, 1000);
    });
}

function runGeneanetTabFetch(famid, url, arg, onDone) {
    if (geneanetLoginWallHit) {
        finishGeneanetFamilyMember(famid, "", arg);
        onDone();
        return;
    }
    // Mirrors the per-person status update parseGeneanet() already does
    // for the plain-fetch path ($("#readstatus").html(...) there) - without
    // this, the status label just sits on whatever it last said while a
    // tab silently loads in the background, which reads as a hang even
    // though it's real, still-in-progress work.
    $("#readstatus").html(escapeHtml(arg.name) + " (looking deeper, this may take a second)");
    chrome.tabs.create({url: url, active: false}, function (tab) {
        if (!exists(tab) || !exists(tab.id)) {
            finishGeneanetFamilyMember(famid, "", arg);
            onDone();
            return;
        }
        var settled = false;
        var attempts = 0;
        // Only the very top of the page is actually needed (name, gender,
        // birth/death date+place) - not the rest of the page (sources,
        // notes, the extended family-tree diagram, etc.) - but that
        // header still has to actually finish rendering first, and Chrome
        // throttles rendering/network for active:false background tabs
        // fairly aggressively. An earlier version cut this down to 5
        // attempts at a 1s cadence based on testing done through
        // foreground (unthrottled) tabs, which don't reflect real
        // background-tab timing - confirmed live, that budget was too
        // short and the tab got closed (and its result discarded for the
        // bare-year fallback) before a real background tab had actually
        // finished loading. Back to a more patient budget - safe to do now
        // that geneanetClearanceLikely (see getGeneanetFamily()) routes
        // most family members through the much faster plain-fetch retry
        // instead of a tab at all, so this slow path should now be rare
        // rather than the common case.
        var maxAttempts = 10;

        function cleanupAndFinish(person) {
            if (settled) {
                return;
            }
            settled = true;
            chrome.tabs.remove(tab.id, function () {
                // Swallow "no tab with id" - the tab may have already
                // closed (e.g. the user closed it manually) by the time
                // this runs; nothing left to clean up in that case.
                void chrome.runtime.lastError;
            });
            finishGeneanetFamilyMember(famid, person, arg);
            onDone();
        }

        function attempt() {
            if (settled) {
                return;
            }
            attempts++;
            // Polling chrome.tabs.get() directly, rather than reacting to
            // chrome.tabs.onUpdated's "complete" event, deliberately: an
            // onUpdated listener only added after chrome.tabs.create()'s own
            // callback fires can lose the race against a fast-loading page
            // and miss the event entirely - confirmed live, Marthe
            // Bodenheimer's page had real data present well before
            // "complete" even fired (checked at readyState "interactive"),
            // yet the event-driven version never picked it up. Polling
            // sidesteps the race by not depending on catching a specific
            // event at all.
            chrome.tabs.get(tab.id, function (tabInfo) {
                if (chrome.runtime.lastError || !exists(tabInfo)) {
                    cleanupAndFinish("");
                    return;
                }
                if (isGeneanetLoginWall(tabInfo.url)) {
                    // A real tab is the trustworthy signal here (see the
                    // comment in getGeneanetFamily() above) - this tab is
                    // done navigating and it landed on the login wall, so
                    // there's nothing to gain by waiting out maxAttempts.
                    geneanetLoginWallHit = true;
                    showGeneanetLoginNotice(url);
                    cleanupAndFinish("");
                    return;
                }
                // Reaching here at all means this tab is navigating a real
                // Geneanet page, not the login wall - Cloudflare's own
                // challenge (if any) is already behind it. See
                // getGeneanetFamily()'s use of this flag.
                geneanetClearanceLikely = true;
                chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    func: function () {
                        var html = "", node = document.firstChild;
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
                    // - Firefox evaluates its host-permission check against
                    // the tab's current state at that instant, so this is
                    // usually transient and the next poll attempt succeeds
                    // once real navigation has started. Reading lastError
                    // just suppresses the "Unchecked lastError" console
                    // warning; the retry itself already happens naturally
                    // below since an empty/failed result isn't usable.
                    void chrome.runtime.lastError;
                    var html = (exists(results) && exists(results[0])) ? results[0].result : undefined;
                    var person = exists(html) ? parseGeneanet(html, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId}) : "";
                    if (isUsableGeneanetPerson(person) || attempts >= maxAttempts) {
                        // On the final attempt, use whatever came through
                        // even if incomplete (e.g. gender but no dates) -
                        // that's still strictly better than discarding it
                        // for the bare sidebar-year fallback.
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

function getGeneanetItemId(url) {
    if (exists(url)) {
        var p = getParameterByName("p", url);
        var n = getParameterByName("n", url);
        var oc = getParameterByName("oc", url);
        return "p="+p+"&n="+n+"&oc="+oc;
    } else {
        return "";
    }
}
