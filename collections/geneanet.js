registerCollection({
  "url": "http://gw.geneanet.org",
  "prepareUrl": function(url) {
    console.log("Nothing to do to prepare the URL");
    return url;
  },
  "parseData": function() {
    console.log("Parsing geneanet data");
    getPageCode();
  },
  "getPageCode": function() {
      chrome.tabs.executeScript(null, {
        file: "getPagesSource.js"
      }, function () {
        // If you try and inject into an extensions page or the webstore/NTP you'll get an error
        if (chrome.extension.lastError) {
          message.innerText = 'There was an error injecting script : \n' + chrome.extension.lastError.message;
        }
      });
  },
  "parseProfileData": parseGeneanet,
});

function parseGeneanet(htmlstring, familymembers, relation) {
  relation = relation || "";
  //var parsed = $(htmlstring.replace(/<img[^>]*>/ig,""));
  var parsed = $(htmlstring);

  // TODO: check language is English!

  nameTab = parsed.find(".with_tabs.name")
  var genderval = "unknown";
  var genderImg = nameTab.find("img").first();
  if (genderImg.attr("title") === "M") {
    genderval = "male";
  } else if (genderImg.attr("title") === "F") {
    genderval = "female";
  }

  givenName = nameTab.find("a").first().text();
  familyName = nameTab.find("a").first().next().text();
  focusperson = givenName + " " + familyName;
  // hack required?
  focusname = focusperson;
  document.getElementById("readstatus").innerHTML = escapeHtml(focusperson);

  var profiledata = {name: focusperson, gender: genderval, status: relation.title};

  recordtype = "Geneanet profile";

  fullBirth = parsed.find("ul li:contains('Born ')");
  if (exists(fullBirth)) {
    profiledata["birth"] = parseGeneanetDate(fullBirth.text().replace('Born ', ''));
  }

  fullBaptism = parsed.find("ul li:contains('Baptized ')");
  if (exists(fullBaptism)) {
    profiledata["baptism"] = parseGeneanetDate(fullBaptism.text().replace('Baptized ', ''));
  }

  fullDeath = parsed.find("ul li:contains('Deceased ')");
  if (exists(fullDeath)) {
    profiledata["death"] = parseGeneanetDate(fullDeath.text().replace('Deceased ', '').replace(/ at age .*/, '').replace(/ age at .*/, ''));
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

    // TODO: find siblings
  } else if (isParent(relation.title)) {
        if (parentmarriageid === "") {
            parentmarriageid = relation.itemId;
        } else if (relation.itemId !== parentmarriageid) {
            //TODO - Not sure if this Marriage information is provided
        }
  } // TODO: children
    // TODO: sibling

  if (familymembers) {
    alldata["profile"] = profiledata;
    alldata["scorefactors"] = smscorefactors;
    updateGeo();
  }

  return profiledata;
}

function parseGeneanetDate(vitalstring) {
  var data = [];
  var matches = vitalstring.match(/([\w\s]+\w)(?:\s+\(\w+\)\s+)?(?:\s+-\s+(.+))?/);
  if (exists(matches)) {
    var dateval = matches[1].trim();
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
        momentval = moment(dateval, "MMMM YYYY", true);
        date_format = "MMM-YYYY";
      }
    }
    if (momentval.isValid()) {
        dateval = cleanDate(momentval.format(date_format));
        data.push({date: dateval});
    }

    var eventlocation = matches[2];
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
  var url = $(person).find("a").attr("href");
  if (exists(url)) {
    if (!exists(alldata["family"][title])) {
      alldata["family"][title] = [];
    }
    // TODO: How do we get the gender?
    var gendersv = "unknown";
    var name = $(person).find("a").text();
    // TODO: get itemID
    var itemid = getGeneanetItemId(url);
    var fullurl = "http://gw.geneanet.org/"+url;
    var subdata = {name: name, title: title, gender: gendersv, url: fullurl, itemId: itemid, profile_id: famid};
    unionurls[famid] = itemid;
    getGeneanetFamily(famid, fullurl, subdata);
  }
}

function getGeneanetFamily(famid, url, subdata) {
    familystatus.push(famid);
    chrome.extension.sendMessage({
        method: "GET",
        action: "xhttp",
        variable: subdata,
        url: url
    }, function (response) {
        var arg = response.variable;
        var person = parseGeneanet(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
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
