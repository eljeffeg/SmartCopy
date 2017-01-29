registerCollection({
  "reload": false,
  "experimental": true,
  "url": "http://www.farhi.org",
  "parseData": function(url) {
    getPageCode();
  },
  "loadPage": function(request) {
    console.log("Loading page");
    var parsed = $(request.source.replace(/<img[^>]*>/ig, ""));
    focusname = getTNGName(parsed);
    recordtype = "TNG Genealogy";
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
  var elem = getTNGField(parsed);
  if (exists(elem)) {
    var familyname = elem.find(".family-name").text();
    var givenname = elem.find(".given-name").text();
    return givenname + " " + familyname;
  }
  return "";
}

function parseTNG(htmlstring, familymembers, relation) {
  relation = relation || "";
  var parsed = $(htmlstring);

  focusperson = getTNGFieldText(parsed, "Name");
  genderval = getTNGFieldText(parsed, "Gender");
  focusname = focusperson;

  document.getElementById("readstatus").innerHTML = escapeHtml(focusperson);

  var profiledata = {name: focusperson, gender: genderval, status: relation.title};

  profiledata["birth"] = parseTNGDate(parsed, "Born");
  profiledata["death"] = parseTNGDate(parsed, "Died");

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
  var url = $(person).find("a").attr("href");
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
    console.log("Person is "+title+" and has subdata");
    console.log(subdata);

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
