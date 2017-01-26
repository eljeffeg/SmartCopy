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
  "parseProfileData": function(htmlstring, familymembers, relation) {
    console.log("In parseProfileData");
    relation = relation || "";
    //var parsed = $(htmlstring.replace(/<img[^>]*>/ig,""));
    var parsed = $(htmlstring);

    // TODO: check language is English!

    nameTab = parsed.find(".with_tabs.name")
    console.log(nameTab);
    var genderval = "unknown";
    var genderImg = nameTab.find("img").first();
    console.log(genderImg);
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
    profiledata["birth"] = parseGeneanetDate(fullBirth.text().replace('Born ', ''));

    fullBaptism = parsed.find("ul li:contains('Baptized ')");
    profiledata["baptism"] = parseGeneanetDate(fullBaptism.text().replace('Baptized ', ''));

    fullDeath = parsed.find("ul li:contains('Deceased ')");
    profiledata["death"] = parseGeneanetDate(fullDeath.text().replace('Deceased ', '').replace(/, at age .*/, ''));

    console.log(profiledata);

    if (familymembers) {
        loadGeniData();
    }

    console.log("Family members loaded");

    //updateInfoData();
    
    if (familymembers) {
      alldata["profile"] = profiledata;
      alldata["scorefactors"] = smscorefactors;
      updateGeo();
    }

    return profiledata;
  },
});

function parseGeneanetDate(vitalstring) {
  console.log("Parsing date "+vitalstring);
  var data = [];
  var matches = vitalstring.match(/([^-]+[^-\s])(?:\s+-\s+(.+))?/);
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
      momentval = moment(dateval, "DD MMMM YYYY", true);
      date_format = "YYYY-MM-DD";
      if (!momentval.isValid()) {
        momentval = moment(dateval, "MMMM YYYY", true);
        date_format = "YYYY-MM";
      }
    }
    console.log(momentval);
    dateval = cleanDate(momentval.format(date_format));
    console.log(dateval);
    if (dateval !== "") {
      data.push({date: dateval});
    }

    var eventlocation = matches[2];
    if (eventlocation) {
      eventlocation = eventlocation.trim();
      if (eventlocation !== "") {
        data.push({id: geoid, location: eventlocation});
        geoid++;
      }
    }
  }
  return data;
}
