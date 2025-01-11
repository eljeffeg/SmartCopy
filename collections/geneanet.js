var verboselogs = false;
registerCollection({
    "reload": false,
    "experimental": true,
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
       // var genderval = "unknown";
        var genderImg = nameTab.find("track").first();
        var focusfirstName = nameTab.find("a:not(:has(track))").first().text();
        var focuslastName = departicule(nameTab.find("a:not(:has(track))").first().next().text());
          if(focuslastName+focuslastName ==""){
            nameTab = parsed.find("em[style=\"font-size:14px\"]");
            focusfirstName = nameTab.find("a:not(:has(track))").first().text();
            focuslastName = departicule(nameTab.find("a:not(:has(track))").first().next().text());
          }
         if (genderImg.attr("title") === "M") {
          focusname = focusfirstName + " " + sepgeneanet +" " + focuslastName;
              // genderval = "male";
          } else if (genderImg.attr("title") === "F") {
// Retrouver un nom marital (le premier qui se présente)
            var spouses = $(parsed).find('h2:has(span:contains("Spouses")) + ul.fiche_union > li');
            var nomMaris = $(spouses[0]).find("a:not(:has(track))").first().text().split(' ');
            var Nommarital ="";
             if (exists(nomMaris)) {
                Nommarital = nomMaris[nomMaris.length-1];
           // console.log("Nommarital ",nomMaris,Nommarital);
             focusname = focusfirstName + " " + sepgeneanet +" " + Nommarital  + " (" +
              focuslastName+")";
            } else {
              focusname = focusfirstName + " " + sepgeneanet +" " + focuslastName;
            }
          }
         if (verboselogs) {
          console.log("FocusName   : ",focusname);
         }
 /*       if (focusname.trim() === sepgeneanet) {
         var nameTab = parsed.find("em[style=\"font-size:14px\"]");
         if (verboselogs) {
          console.log("nameTab2   : ",nameTab);
         }
     	 focusname=nameTab.find("a:not(:has(track))").first().text() + " " + sepgeneanet +" " + nameTab.find("a:not(:has(track))").first().next().text();
       
          }
*/
        if (verboselogs) {
       console.log("focusname   : ",focusname);
        }
  
    },
    "parseProfileData": parseGeneanet
});
function parseGeneanet(htmlstring, familymembers, relation){
var parsed = $(htmlstring.replace(/<img /ig,"<track "));
tmr = parsed.find("span:contains('429 Too Many Requests')");
if(exists(tmr[0])) {
  console.log("TMR",tmr[0]);
  // trop de requete : rejet par nginx, traité par un délai dans le workers (backgroud.js)
  // TODO faire une identification par défaut
  //return
}
// TODO Affichage du tonnelier (geneanet en panne, réessayer ultérieurement)
//enpanne = parsed.find("class:contains('container_error')");
//enpanne = $(parse)
//if(exists(enpanne)){
//  console.log("Panne",enpanne);
  //return
//}
//if (false) {
//console.log("Too Many Requests",tooManyRq.variable);
//parseGeneanet1(parsed, familymembers, relation);
//} 
//else {
  return parseGeneanet1(htmlstring, familymembers, relation);
//}
}

function parseGeneanet1(htmlstring, familymembers, relation) {
  relation = relation || "";
  var parsed = $(htmlstring.replace(/<img /ig,"<track "));
  var nameTab = parsed.find(".with_tabs.name");
  var genderval = "unknown";
  var genderImg = nameTab.find("track").first();
  if (genderImg.attr("title") === "M") {
    genderval = "male";
  } else if (genderImg.attr("title") === "F") {
    genderval = "female";
  } else if (exists(relation.gender) && relation.gender !== "unknown") {
    genderval = relation.gender;
  }
  if (relation === "") {
    focusgender = genderval;
  }
  var aboutdata = "";
   var givenName = nameTab.find("a:not(:has(track))").first().text();
   cleanName(givenName);
  var familyName = departicule(nameTab.find("a:not(:has(track))").first().next().text());
  //console.log("Noms vides  ?:",(givenName+familyName));
  if ((givenName+familyName) ===""){
    var nameTab = parsed.find("em[style=\"font-size:14px\"]");
    givenName = nameTab.find("a:not(:has(track))").first().text();
    familyName = departicule(nameTab.find("a:not(:has(track))").first().next().text());
  }
  var focusperson = "";
  var Nommarital = "";
  if (genderval == "female") {
    var spouses = $(parsed).find('h2:has(span:contains("Spouses")) + ul.fiche_union > li');
    var nomMaris = $(spouses[0]).find("a:not(:has(track))").first().text().split(' ');
    //console.log("Female ",spouses,nomMaris);
    if (exists(nomMaris)) {
      Nommarital = departicule(nomMaris[nomMaris.length-1]);
      focusperson = givenName + " " + sepgeneanet + " " + Nommarital +" ("+ familyName +")";
    } else {
      focusperson = givenName + " " + sepgeneanet + " " + familyName;
    }
  } else {
    focusperson = givenName + " " + sepgeneanet + " " + familyName;
    }
  
//   on intercale  un séparateur  - un ou plusieurs caractères  - pour servir de marqueur entre les prénoms et le nom éventuellement composé (firstname et lastname)
//  var focusperson = givenName + " · " + familyName;
//  var focusperson = givenName + " " + sepgeneanet + " " + familyName;
 /* if (focusperson.trim() === sepgeneanet) {
   //   $(nameTab).html($(nameTab).html().replace("<em>", '"').replace("<\/em>", '"'));
   //   focusperson = $(nameTab).text().trim();
   var nameTab = parsed.find("em[style=\"font-size:14px\"]");
      //console.log("nameTabP   : ",nameTab);
     	 focusperson=nameTab.find("a:not(:has(track))").first().text() + " " + sepgeneanet +" " + nameTab.find("a:not(:has(track))").first().next().text();
        if (verboselogs) {
      console.log("focusperson   : ",focusperson);
        }
  }
*/
        
  $("#readstatus").html(escapeHtml(focusperson));

  var profiledata = {name: focusperson, gender: genderval, status: relation.title};

   var img = $(nameTab).closest("table").prev().find("track").attr("src");
 
  /*La référence photo du profil est local (//gw... ) les références aux profils familiaux sont normaux (https://gw...)
  The photo reference of the profile is local (//gw...) the references to family profiles are normal (https://gw...)
  */
   if (exists(img)) {
    if(img.substring(0, 2) == "//"){
    img = "https:" + img ;
  }
      profiledata["thumb"] = img;
      profiledata["image"] = img.replace("/medium", "/normal");
      if (verboselogs) {
        console.log("IMG :",img);
      }
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
//jobs
var jobs = "";
var jobs1 = parsed.find(".row.clearfix + ul li:last").html();
var jobs2 = parsed.find(".row.clearfix + + ul li:last").html();
if(jobs1 !== undefined) {
  jobs = jobs1.replace(/<br>/g," ").trim();
}
if(jobs2 !== undefined) {
  jobs = jobs2.replace(/<br>/g," ").trim();
  }
if (jobs.includes('Born') || jobs.includes('Baptized') || jobs.includes('Deceased') || jobs.includes('Buried')){
jobs = "";
}
if (jobs !== ""){
  profiledata["occupation"] = jobs;
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
    // traite le cas du format "Parents photo"
    if (parents.length === 0) {
      if (verboselogs) {
      console.log("Parsed   :" + $(parsed));
      }
    parents = $(parsed).find('h2:has(span:contains("Parents")) + div div div table td ul li');
    if (verboselogs) {
      console.log("Parents  :" + parents);
    }
    }
    
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
  // bug corrige  - test sur siblings[0] au lieu de siblings[1]
    if (exists(siblings[0])) {
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

// Cas des particules honteuses (de) et des indications entre parentheses
function departicule(nomStr){
if (nomStr.match(/\(de\)/gi)){
  nomStr = "de " + nomStr.replace("(de)", '') ;
}
// enleve les parenthese [(|)]/g
// enleve toute indication entre parenthese
const regex = /\(.*?\)/g ;
nomStr = nomStr.replace(regex,"");
if (verboselogs) {
}
return nomStr;
}
function parseGeneanetDate(vitalstring, type) {
  vitalstring = vitalstring.replace(/,$/, "").trim();
  vitalstring = vitalstring.replace(/possibly/, "").trim(); // TODO synonyme about
  vitalstring = vitalstring.replace(/,\naged.*/,"").trim();
  // Example matches:
  // in 1675
  // about 1675
  // before 1675
  // after 1675
  // 30 September 1675 - Crouy sur Cosson, 41, France
  // 30 September 1675, Crouy sur Cosson, 41, France     // Marriage version
  // 30 September 1675 (Saturday) - Crouy sur Cosson, 41, France
  // before September 1675 - Crouy sur Cosson, 41, France
  // Modif QUENEE - nouvelles données GENEANET
  // March 15, 1617 (Wednesday) - Hauville, 27350, Eure, Haute-Normandie, FRANCE
  // March&nbsp;15,&nbsp;1617 (Wednesday) - Hauville, 27350, Eure, Haute-Normandie, FRANCE
  //console.log("Date string : ",vitalstring,type);
  var data;
  var matches;
  if (vitalstring.match(/^\(\d{1,2}\// )) {
    vitalstring ="";
  }
  if (type === "marriage") {
  // effacement de la premiere virgule modif quenee
      vitalstring = vitalstring.replace(",","");
    matches = vitalstring.match(/(about|before|after)?([\w\s]+\w)(?:\s+\(\w+\))?(?:,\s+(.+))?/i);
  } else {
//                                                  modif ici (,)   
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
    // cas des dates révolutionnaires
    if (dateval.match(/^\d{1,2} /)){
      console.log ("Date revol : ",dateval);
      try {
        dateval = vitalstring.match(/\((.*?)\)/)[1];
      } catch (err) {
        console.log("Erreur de reprise de dateval : ",err,vitalstring,matches );
      }
      try {
      matches[3] = vitalstring.match(/\)(.*)/)[1];
      } catch (err) {
        console.log("Erreur de reprise de loc : ",err,vitalstring,matches );
      }
      console.log ("date georgien : ",dateval);
    }
    if (dateval.startsWith("in ")) {
      momentval = moment(dateval.match((/\d{4,}/)), "YYYY", true);
      date_format = "YYYY";
    } else {
    // Ancien format obsolete modif quenee
      //momentval = moment(dateval, "D MMMM YYYY", true);
      momentval = moment(dateval.replace(",",""), "MMMM D YYYY", true);
      date_format = "MMM D YYYY";
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
    var name =  departicule($(nameTab).text());
    var itemid = getGeneanetItemId(url);
    if (isParent(title)) {
      parentlist.push(itemid);
    }
    var gendersv = "unknown";
    if (isFemale(title)) {
      gendersv = "female";
    } else if (isMale(title)) {
      gendersv = "male";
    } else if (isPartner(title)) {
      gendersv = reverseGender(focusgender);
    }
    var fullurl = hostDomain(tablink) + "/" + url;
    var subdata = {name: name, title: title, url: fullurl, gender: gendersv, itemId: itemid, profile_id: famid};
    // Parse marriage data
    subdata = processMarriage(person, subdata);
    unionurls[famid] = itemid;
    getGeneanetFamily(famid, fullurl, subdata);
  }
}

function processMarriage(person, subdata) {
   //console.log("Info Mariage  :",$(person).text());
   //console.log("Info M2  :",$(person).text().startsWith("Married",0),$(person).text().startsWith("Married",1),$(person).text().startsWith("Married",2));
   // modif pour évacuer un saut de ligne inaproprié (quenee) corige geneanet 5/9/2024
    if ($(person).text().startsWith("Married",1) && !$(person).text().startsWith("Married to",1)) {
        var marriageinfo = $(person).find("em").first();
        if (exists(marriageinfo)) {
            subdata["marriage"] = parseGeneanetDate(marriageinfo.text(), "marriage");
        }
    }
    return subdata;
}

function getGeneanetFamily(famid, url, subdata) {
    familystatus.push(famid);
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        variable: subdata,
        url: url
    }, function (response) {
        if (exists(response)) {
            var arg = response.variable;
            if (exists(response.error)) {
                console.log(response.error);
                var person = "";
            } else {
                var person = parseGeneanet(response.source, false, {"title": arg.title, "proid": arg.profile_id, "itemId": arg.itemId});
            }
            person = updateInfoData(person, arg);
            databyid[arg.profile_id] = person;
            alldata["family"][arg.title].push(person);
        } else {
            console.log("*** Reading Failed ***");
        }
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
function cleanName(givenName){
  if (verboselogs) {
    //console.log("Given name1  :",givenName);
   }
  givenName = givenName.replace(/\!|\*|_|\.|\"/g,"");
  if (verboselogs) {
    //console.log("Given name2  :",givenName);
  }
  return givenName;
}
