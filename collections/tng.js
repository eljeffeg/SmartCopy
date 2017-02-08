registerCollection({
  "reload": false,
  "experimental": true,
  "recordtype": "TNG Genealogy",
  "prepareUrl": function(url) {
      if (!url.contains("getperson.php")) {
          url = hostDomain(url) + "/genealogy/getperson.php?" + getTNGItemId(url);
          this.reload = true;
      }
      return url;
  },
  "collectionMatch": function(url) {
      if (url.contains("/genealogy/") && url.contains(".php?personID=")) {
          //TODO Look at source code for TNG
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
    focusname = getTNGName(parsed);
  },
  "parseProfileData": parseTNG
});

function getTNGField(parsed, name, position) {
  position = position || 1;
  var selector = "td:contains('"+name+"')";
  for (i = 0; i<position; i++) {
    selector += "+ td";
  }
  return parsed.find(selector);
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
    return givenname.replace(",", "") + " " + familyname.replace(",", "");
  }
  // Less precise, but better than nothing
  console.log("Count not find name, using nameheader");
  return parsed.find("h1#nameheader").text();
}

function parseTNG(htmlstring, familymembers, relation) {
  relation = relation || "";
  var parsed = $(htmlstring);

  var focusperson = getTNGName(parsed);
  var genderval = getTNGFieldText(parsed, "Gender").toLowerCase();;

  document.getElementById("readstatus").innerHTML = escapeHtml(focusperson);

  var profiledata = {name: focusperson, gender: genderval, status: relation.title};

  profiledata["birth"] = parseTNGDate(parsed, "Born");
  profiledata["death"] = parseTNGDate(parsed, "Died");

  profiledata["occupation"] = getTNGFieldText(parsed, "OCCU");

  if (familymembers) {
    loadGeniData();
    var famid = 0;

    var father = getTNGField(parsed, "Father");
    if (exists(father)) {
      processTNGFamily(father, "father", famid);
    }

    var mother = getTNGField(parsed, "Mother");
    if (exists(mother)) {
      processTNGFamily(mother, "mother", famid);
    }

    var spouses = getTNGField(parsed, "Family");
    if (exists(spouses[0])) {
      for (var i = 0; i < spouses.length; i++) {
        var spouse = spouses[i];
        processTNGFamily(spouse, "spouse", famid);
        myhspouse.push(famid);
        famid++;
      }
    }

    var childrensection = getTNGField(parsed, "Children");
    if (exists(childrensection)) {
      var children = childrensection.find("tr span");
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        processTNGFamily(child, "child", famid);
        famid++;
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

function parseTNGDate(parsed, name) {
  var data = [];
  var dateval = cleanDate(getTNGFieldText(parsed, name, 1));
  if (dateval.contains("[")) {
      var datesplit = dateval.split("[");
      dateval = datesplit[0].trim();
  }
  if (dateval !== "") {
    data.push({date: dateval});
  }
  var eventlocation = getTNGFieldText(parsed, name, 2);
  if (eventlocation !== "") {
    data.push({id: geoid, location: eventlocation});
    geoid++;
  }
  return data;
}

function processTNGFamily(person, title, famid) {
  var url = $(person).find("a").first().attr("href");
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
    var text = $(person).text();
    var subdata = {name: name, title: title, gender: gendersv, url: fullurl, itemId: itemid, profile_id: famid};

    // Parse marriage data
    /*
    if ($(person).text().startsWith("Married")) {
      var marriageinfo = $(person).find("em").first();
      if (exists(marriageinfo)) {
        subdata["marriage"] = parseGeneanetDate(marriageinfo.text());
        console.log(subdata["marriage"]);
      }
    }
    */
    unionurls[famid] = itemid;
    getTNGFamily(famid, fullurl, subdata);
  }
}

function getTNGFamily(famid, url, subdata) {
    familystatus.push(famid);
    chrome.extension.sendMessage({
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
    if (exists(url)) {
        var p = getParameterByName("personID", url);
        var t = getParameterByName("tree", url);
        return "personID="+p+"&tree="+t;
    } else {
        return "";
    }
}
