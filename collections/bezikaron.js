// Parse BeZikaron.co.il Records
registerCollection({
    reload: false,
    recordtype: "BeZikaron.co.il Grave",
    prepareUrl: function (url) {
      return url;
    },
    collectionMatch: function (url) {
      var regex = new RegExp(
        "(%[A-Fa-f0-9]{2})+-(%[A-Fa-f0-9]{2})+-([0-9]{4}|na)-([0-9]{4}|na)-([0-9A-Za-z]{5})/$",
        "i"
      );
      return startsWithHTTP(url, "http://bezikaron.co.il") && regex.test(url);
    },
    parseData: function (url) {
      var regex = new RegExp(
        "(%[A-Fa-f0-9]{2})+-(%[A-Fa-f0-9]{2})+-([0-9]{4}|na)-([0-9]{4}|na)-([0-9A-Za-z]{5})/$",
        "i"
      );
      if (startsWithHTTP(url, "http://bezikaron.co.il") && regex.test(url)) {
        focusURLid = regex.exec(url)[0];
        getPageCode();
      } else {
        document.querySelector("#loginspinner").style.display = "none";
        setMessage(
          warningmsg,
          "Please select one of the Profile pages on this site."
        );
      }
    },
    loadPage: function (request) {
      var parsed = $(request.source.replace(/<img[^>]*>/gi, ""));
      focusname = parsed
        .find(
          ".deceased-info__deceased-name"
        )
        .first()
        .text()
        .trim();
    },
    parseProfileData: parseBeZikaron,
  });
  
  function fixHebrewMonths(dateStr) {
      return dateStr
      .replace("ינואר", "January")
      .replace("פברואר", "February")
      .replace("מרץ", "March")
      .replace("אפריל", "April")
      .replace("מאי", "May")
      .replace("יוני", "June")
      .replace("יולי", "July")
      .replace("אוגוסט", "August")
      .replace("ספטמבר", "September")
      .replace("אוקטובר", "October")
      .replace("נובמבר", "November")
      .replace("דצמבר", "December")
  }
  
  // Parse FindAGrave
  function parseBeZikaron(htmlstring, familymembers, relation) {
    var parsed = $(htmlstring.replace(/<img/gi, "<gmi"));
    relation = relation || "";
  
    var title = htmlstring
      .match("<title>.*</title>")[0]
      .replace("<title>", "")
      .replace("</title>", "");
  
    var dateRegex = new RegExp("(\([0-9]{4}\))", "i");
    var datesRegex = new RegExp("(\([0-9]{4} - [0-9]{4}\))", "i");
  
    var focusdaterange = "";
    if (datesRegex.test(title)) {
      focusdaterange = datesRegex.exec(title)[0];
    } else if (dateRegex.test(title)) {
      focusdaterange = dateRegex.exec(title)[0];
    }
  
    var burialInfo = parsed.find(".deceased-info__burial-info").first();
    var focusperson = burialInfo
      .find(
        ".deceased-info__deceased-name"
      )
      .first()
      .text()
      .replace("\"", "'")
      .trim();
  
    var genderval = "unknown";
  
    if (relation === "") {
      focusgender = genderval;
    } else if (exists(relation.genderval) && genderval === "unknown") {
      genderval = relation.genderval;
    }
  
    var aboutdata = "";
    var profiledata = {
      name: focusperson,
      gender: genderval,
      status: relation.title,
    };
  
    if (familymembers) {
      loadGeniData();
    }
  
    // ---------------------- Profile Data --------------------
    if (focusdaterange !== "") {
      profiledata["daterange"] = focusdaterange;
    }
  
    // Herbrew or English
    burialInfo.find(".deceased-info__deceased-dates").first().find("[itemProp='birthDate']").first().text()
  
    var datesField = burialInfo
      .find(".deceased-info__deceased-dates")
      .first();
  
      var birthDate = fixHebrewMonths(datesField
        .find("[itemProp='birthDate']")
        .first()
        .text()
        .trim()
        .replace("לא ידוע", ""));
      var deathDate = fixHebrewMonths(datesField
        .find("[itemProp='deathDate']")
        .first()
        .text()
        .trim()
        .replace("לא ידוע", ""));
  
    if (birthDate) {
      profiledata = addEvent(profiledata, "birth", birthDate, "");
    }
    if (deathDate) {
      profiledata = addEvent(profiledata, "death", deathDate, "");
    }
  
    var cemName = parsed
      .find(".deceased-info__section-row").first()
      .find(".labeled-value__value").first().text().trim();
  
    if (cemName) {
      profiledata = addEvent(profiledata, "burial", "", cemName);
    }
  
    // ---------------------- Profile Continued --------------------
    profiledata["alive"] = false; //assume deceased
  
    if (familymembers) {
      alldata["profile"] = profiledata;
      alldata["scorefactors"] = smscorefactors;
      updateGeo();
    }
    return profiledata;
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
  