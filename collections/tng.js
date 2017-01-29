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
    focusname = getTNGField(parsed, "Name");
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
  var elem = parsed.find(selector);
  if (exists(elem)) {
    return elem.text().trim();
  }
  return "";
}

function parseTNG(htmlstring, familymembers, relation) {
  relation = relation || "";
  var parsed = $(htmlstring);

  focusperson = getTNGField(parsed, "Name");
  genderval = getTNGField(parsed, "Gender");
  focusname = focusperson;

  document.getElementById("readstatus").innerHTML = escapeHtml(focusperson);

  var profiledata = {name: focusperson, gender: genderval, status: relation.title};

  profiledata["birth"] = parseTNGDate(parsed, "Born");
  profiledata["death"] = parseTNGDate(parsed, "Died");

  if (familymembers) {
    alldata["profile"] = profiledata;
    alldata["scorefactors"] = smscorefactors;
    updateGeo();
  }

  return profiledata;
}

function parseTNGDate(parsed, name) {
  var data = [];
  var dateval = cleanDate(getTNGField(parsed, name, 1));
  if (dateval !== "") {
    data.push({date: dateval});
  }
  var eventlocation = getTNGField(parsed, name, 2);
  if (eventlocation !== "") {
    data.push({id: geoid, location: eventlocation});
    geoid++;
  }
  return data;
}
