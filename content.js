/*jshint esversion: 6 */
tablink = window.location.href;
var consistencymessage = "";
var year = 31557600; //365.25
var termlimit = 8;
var pregnancy = 21038400; //8 month term limit
var longevity_error = 125;
var longevity_warn = 105;
var birthage_young = 12;
var birthage_old = 55;
var marriageage_young = 14;
var spouse_age_dif = 22;
var publicyear = 1850;
var publiclist = [];
var privatecheck = true;
var geniconsistency = true;
var namecheckoption = true;
var livingnameoption = false;
var siblingcheckoption = true;
var childcheckoption = true;
var partnercheckoption = true;
var agecheckoption = true;
var selfcheckoption = true;
var locationcheckoption = false;
var dataconflictoption = false;
var datecheckoption = true;
var samenameoption = true;
var compoundlast = false;
var wedlock = false;
var biography = null;
var addbioonoff = true;
var exportprojectsonoff = false;
var messagestatus = [];
var projectExportResults = [];
var project_id;
var getsettingsdone = false;
var accountinfo;
var GeniTaal="en";

var _ = function (messageName, substitutions) {
    return chrome.i18n.getMessage(messageName, substitutions);
};

function initializeContent() {
    if (isGeni(tablink) || isGeniProject(tablink)) {
        getGeniLanguage();
        getSettings();
        runContent();
    }
}

function runContent() {
    if (getsettingsdone) {
        if (tablink.contains("www.geni.com/people/")) {
            if ($("#overview_tab_content").length > 0) {
                if ($("#overview_tab_content").find(".flt_r").length < 1) {
                    setTimeout(runContent, 100);
                    return
                }
                $($($("#overview_tab_content").find(".flt_r")[0]).find("a")[0]).on('click', function () {
                    if (addbioonoff) {
                        addBioButton();
                    }
                });
            }
        } else if (isGeniProject(tablink)) {
            if (exportprojectsonoff) {
                addProjectExportButton();
            }
            return;
        }
        var consistencydiv = $(document.createElement('div'));
        consistencydiv.attr('id', 'consistencyck');
        consistencydiv.css({
            "display": "none",
            "position": "absolute",
            "background-color": "#fff",
            "box-sizing": "border-box",
            "z-index": "2",
            "width": "100%",
            "borderBottom": "solid 1px #cad3dd",
            "padding": "5px 20px 3px",
            "vertical-align": "middle",
            "line-height": "150%"
        });
        $("#header").after(consistencydiv);
        queryGeni();
    } else {
        setTimeout(runContent, 50);
        return;
    }
}

function getGeniLanguage() {
	// determine Geni user language from the translation of the Actions menu (used for language to generate biography in)
	let menus = $("div.drop-menu");
    for (let i = 0; i < menus.length; i++) {
	  if ($(menus[i]).text().trim().startsWith("Acties")) {
		GeniTaal = "nl";
		i = menus.length;
	  }
	  else if ($(menus[i]).text().trim().startsWith("Toiminnot")) {
		GeniTaal = "fi";
		i = menus.length;
	  }
	}
}

function queryGeni() {
    focusid = getProfile(tablink).replace("?profile=", "");
    if (focusid === "" && tablink !== "https://www.geni.com/family-tree") {
        return;
    }
    var dconflict = "";
    if (dataconflictoption) {
        //This is an expensive query - exclude it if it's not enabled
        dconflict = ",data_conflict";
    }
    familystatus.push(1);
    var args = "fields=id,guid,name,title,first_name,middle_name,last_name,maiden_name,suffix,display_name,names,occupation,gender,deleted,birth,baptism,death,cause_of_death,burial,is_alive,marriage,divorce,claimed,public" + dconflict + "&actions=update,update-basics";
    var url = "https://www.geni.com/api/" + focusid + "/immediate-family?" + args + "&access_token=" + accountinfo.access_token;
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
            if (!exists(genifamily) || !exists(genifamily["focus"])) {
                genifamily = [];
            } else {
                focusid = genifamily["focus"].id;
                var nodes = genifamily["nodes"];
                for (let node in nodes) {
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
    buildContent();
}

$(window).bind('hashchange', function () {
    displayCheck(false);
    tablink = window.location.href;
    getSettings();
    queryGeni();
});

$(window).mouseup(function (event) {
    if ($(event.target).attr('class') === "super blue button") {
        displayCheck(false);
        getSettings();
        queryGeni();
    }
});

function buildContent() {
    if (familystatus.length > 0) {
        setTimeout(buildContent, 50);
    } else {
        buildConsistency();
        buildProfile();
    }
}

function addBioButton() {
    if ($("#add-language-button").length == 0) {
        setTimeout(addBioButton, 50);
    } else {
        $("<a id='addbio' href='javascript:void(0)' class='super grey tab button flt_r' style='margin-right: 2px;' title='" + _("appShortName") + " " + _("Add_Biography") + "'>" + _("Add_Biography") + "</a>").insertAfter($("#add-language-button"));
        $('#addbio').on('click', function () {
            $("*").css("cursor", "progress");
            appendBio();
        });
        buildProfile();
    }
}

function addProjectExportButton() {
    if ($(".drop-menu").length == 0) {
        setTimeout(addProjectExportButton, 50);
    } else {
        let menus = $("div.drop-menu");
        let menu = undefined;
        for (let i = 0; i < menus.length; i++) {
	        if ($(menus[i]).text().trim().startsWith(_("Actions"))) {
                menu = $(menus[i]).find("hr")[1];
            }
        }
        if (menu !== undefined) {
            $("<hr>").insertBefore($(menu));
            $("<a id='exportProjectProfiles' href='javascript:void(0)' draggable='false' title='" + _("appShortName") + " " + _("Export_Profiles") + "'>" + _("Export_Profiles") + "</a>").insertBefore($(menu));
            $('#exportProjectProfiles').on('click', function () {
                $("#panel_overlay").show();
                var progress = $(`<div id="exportprojectprogress" style="position: absolute; z-index: 9006; width: 500px; cursor: default; top: 50%; left: 50%; margin-left: -260px; margin-top: -72.4545px;" class="modal_lightbox"><div id="project_people_form" class="collaborators_form" style="cursor: default;">
                    <div class="module modal" style="cursor: progress;">
                        <div class="modal_inner" style="cursor: progress;">
                            <div class="modal_bd padding_20" style="cursor: progress; text-align: center;">
                                <br>
                                <h3><strong>SmartCopy Project Export</strong></h3>
                                <h4 id="SC_ExportCount">Exporting Project Profiles (Page 1) - Please Wait...</h4>
                                <br>
                            </div>
                        </div>
                    </div>
                </div>`);
                progress.insertAfter($("#panel_overlay"));
                project_id = getProject(tablink);
                //let args = "?fields=name,title,first_name,middle_name,last_name,maiden_name,suffix,display_name,names,occupation,gender,deleted,birth,baptism,death,cause_of_death,burial,is_alive";
                let url = "https://www.geni.com/api/project-" + project_id + "/profiles?access_token=" + accountinfo.access_token;
                getProjectProfiles(url);
            });
        }
    }
}

function getProjectProfiles(url) {
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url
    }, function (response) {
        if (response.source === "[]" || response.source === "") {
            projectprofiles = [];
            $("#panel_overlay").hide();
            $("#exportprojectprogress").remove();
        } else {
            try {
                //console.log(response.source)
                projectprofiles = JSON.parse(response.source);
            } catch (e) {
                projectprofiles = [];
                $("#panel_overlay").hide();
                $("#exportprojectprogress").remove();
            }
            if (!exists(projectprofiles) || !exists(projectprofiles["results"])) {
                projectprofiles = [];
                $("*").css("cursor", "default");
                $("#panel_overlay").hide();
                $("#exportprojectprogress").remove();
            } else {
                for (let i = 0; i < projectprofiles["results"].length; i++) {

                    projectExportResults.push(projectprofiles["results"][i]);
                }

                if (projectprofiles["next_page"] !== undefined) {
                    $("#SC_ExportCount").text("Exporting Project Profiles (Page " + projectprofiles["next_page"].substr(projectprofiles["next_page"].lastIndexOf("=") + 1, projectprofiles["next_page"].length) + ") - Please Wait...");
                    getProjectProfiles(projectprofiles["next_page"]);
                } else {
                    let csv = doCSV(projectExportResults);
                    $("#panel_overlay").hide();
                    $("#exportprojectprogress").remove();
                    downloadCSV(csv);
                }
            }
        }

    });
}

function parse_object(obj, path) {
    if (path == undefined)
        path = "";

    var type = $.type(obj);
    var scalar = (type == "number" || type == "string" || type == "boolean" || type == "null");

    if (type == "array" || type == "object") {
        var d = {};
        for (var i in obj) {

            var newD = parse_object(obj[i], path + i + "/");
            $.extend(d, newD);
        }

        return d;
    } else if (scalar) {
        var d = {};
        var endPath = path.substr(0, path.length - 1);
        d[endPath] = obj;
        return d;
    }

    // ?
    else return {};
}

function arrayFrom(json) {
    var queue = [],
        next = json;
    while (next !== undefined) {
        if ($.type(next) == "array") {

            // but don't if it's just empty, or an array of scalars
            if (next.length > 0) {

                var type = $.type(next[0]);
                var scalar = (type == "number" || type == "string" || type == "boolean" || type == "null");

                if (!scalar)
                    return next;
            }
        }
        if ($.type(next) == "object") {
            for (var key in next)
                queue.push(next[key]);
        }
        next = queue.shift();
    }
    // none found, consider the whole object a row
    return [json];
}

function doCSV(json) {
    var inArray = arrayFrom(projectExportResults);
    var outArray = [];
    for (var row in inArray)
        outArray[outArray.length] = parse_object(inArray[row]);
    let csv = $.csv.fromObjects(outArray, {
        separator: ","
    });
    csv = csv.replaceAll("\/api\/", "\/");
    return csv;
}

function downloadCSV(csv) {
    //Download the file as CSV
    var downloadLink = document.createElement("a");
    var blob = new Blob(["\ufeff", csv]);
    var url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = "project-" + project_id + ".csv";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

function appendBio() {
    var screenopen = ($("#add-language-button").length !== 0);
    if (biography == null && screenopen) {
        setTimeout(appendBio, 50);
    } else if (screenopen) {
        $("*").css("cursor", "default");
        var textarea = $("#page_profile_detail_strings_en-US_about_me");
        textarea.val(biography + textarea.val().replace(getSelection(), "").trim());
    } else {
        //In case the screen is closed
        $("*").css("cursor", "default");
    }
}

function dateFormat(dateval) {
    var eventdate = dateval.formatted_date;
    if (eventdate.startsWith("circa") || eventdate.startsWith("before") || eventdate.startsWith("after") || eventdate.startsWith("between")) {
        return " " + eventdate;
    } else if (exists(dateval.day)) {
        return " on " + eventdate;
    } else {
        return " in " + eventdate;
    }
}

function dateFormatDutch(dateval) {
  var maandNamen = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  var eventdate = " ";
  if (exists(dateval.range)) {
    if (dateval.range == 'after') {
      eventdate += "na ";
    } else if (dateval.range == 'between') {
      eventdate += "tussen ";
    }
	else if (dateval.range == 'before') {
	  eventdate += "voor ";
	}
  }
  if (exists(dateval.circa)) {
    eventdate += "circa ";
  }
  if (eventdate == " ") {
	if (exists(dateval.day)) {
		eventdate += "op ";
	}
	else {
		eventdate += "in ";
	}
  }
  if (exists(dateval.day)) {
    eventdate += dateval.day + " ";
  }
  if (exists(dateval.month)) {
    eventdate += maandNamen[dateval.month - 1] + " ";
  }
  else if (exists(dateval.day)) {
	  eventdate += "? "; 
  }
  if (exists(dateval.year)) {
    eventdate += dateval.year;
  }
  if (exists(dateval.end_day) || exists(dateval.end_month) || exists(dateval.end_year)) {
    eventdate += " en ";
    if (exists(dateval.end_circa)) {
      eventdate += "circa ";
	}
    if (exists(dateval.end_day)) {
      eventdate += dateval.end_day + " ";
    }
    if (exists(dateval.end_month)) {
      eventdate += maandNamen[dateval.end_month - 1] + " ";
    }
	else if (exists(dateval.day)) {
	  eventdate += "? ";
    }
    if (exists(dateval.end_year)) {
      eventdate += dateval.end_year;
    }
  }
  return eventdate;
}

function dateFormatFinnish(dateval) {
    var eventdate = " ";
    if (exists(dateval.circa)) {
        eventdate += "noin ";
    }
    if (exists(dateval.range) && dateval.range == 'before') {
        eventdate += "ennen ";
    }
    if (exists(dateval.day)) {
        eventdate += dateval.day + ".";
    }
    if (exists(dateval.month)) {
        eventdate += dateval.month + ".";
    }
    if (exists(dateval.year)) {
        eventdate += dateval.year;
    }
    if (exists(dateval.end_day) || exists(dateval.end_month) || exists(dateval.end_year)) {
        eventdate += " ja ";
        if (exists(dateval.end_circa)) {
            eventdate += "noin ";
            if (exists(dateval.end_day)) {
                eventdate += dateval.end_day + ".";
            }
            if (exists(dateval.end_month)) {
                eventdate += dateval.end_month + ".";
            }
            if (exists(dateval.end_year)) {
                eventdate += dateval.end_year;
            }
        }
    }
    if (exists(dateval.range)) {
        if (dateval.range == 'after') {
            eventdate += " jälkeen";
        } else if (dateval.range == 'between') {
            eventdate += " välillä";
        }
    }
    return eventdate;
}

function getSelection() {
    return (!!document.getSelection) ? document.getSelection() :
        (!!window.getSelection) ? window.getSelection() :
        document.selection.createRange().text;
}

function buildProfile() {
    if (biography == null) {
        //In case edit is clicked twice - only need to build this once.
		// switch (chrome.i18n.getUILanguage())
		// use Geni user language instead (to easily generate biographies in different languages
        switch (GeniTaal) {
            case "nl":
                buildProfileDutch();
                break;
            case "fi":
                buildProfileFinnish();
                break;
            default:
                buildProfileDefault();
                break;
        }
    }
}

function buildProfileDefault() {
    var focus = getFocus();
    var parents = getParents();
    var partners = getPartners();
    var bio = "==Biography==\n'''" + getGeniData(focus, "name") + "''' ";

    var birth = getGeniData(focus, "birth");
    var bap = getGeniData(focus, "baptism");
    var death = getGeniData(focus, "death");
    var deathcause = getGeniData(focus, "cause_of_death");
    var burial = getGeniData(focus, "burial");
    var occupation = getGeniData(focus, "occupation");

    if (birth !== "") {
        bio += "was born";
        if (exists(birth.date)) {
            bio += dateFormat(birth.date);
        }
        if (exists(birth.location)) {
            bio += " in " + birth.location.formatted_location;
        }
        if (bap !== "") {
            bio += " and ";
        } else {
            bio += ". ";
        }
    }
    if (bap !== "") {
        bio += "was baptized";
        if (exists(bap.date)) {
            bio += dateFormat(bap.date);
        }
        if (exists(bap.location)) {
            var baploc = bap.location.formatted_location;
            if (exists(birth.location)) {
                var birthloc = birth.location.formatted_location;
                if (birthloc === baploc) {
                    bio += " there";
                } else if (birthloc === baploc.replace(bap.location.place_name + ", ", "")) {
                    bio += " in " + bap.location.place_name;
                } else {
                    bio += " in " + baploc;
                }
            } else {
                bio += " in " + baploc;
            }
        }
        bio += ". ";
    }
    if (parents.length > 0 && parents.length < 3) {
        var father = null;
        var mother = null;
        if (getGeniData(parents[0], "gender") === "male") {
            father = parents[0];
        } else if (getGeniData(parents[1], "gender") === "male") {
            father = parents[1];
        }
        if (getGeniData(parents[0], "gender") === "female") {
            mother = parents[0];
        } else if (getGeniData(parents[1], "gender") === "female") {
            mother = parents[1];
        }
        if (getGeniData(focus, "gender") === "male") {
            bio += "His ";
        } else if (getGeniData(focus, "gender") === "female") {
            bio += "Her ";
        } else {
            bio += getGeniData(focus, "first_name") + "\'s ";
        }

        if (exists(father) && exists(mother)) {
            bio += "parents were " + buildWikiLink(father) + " and " + buildWikiLink(mother) + ". ";
        } else if (exists(father)) {
            bio += "father was " + buildWikiLink(father) + ". ";
        } else if (exists(mother)) {
            bio += "mother was " + buildWikiLink(mother) + ". ";
        }
    }


    if (occupation !== "") {
        if (getGeniData(focus, "gender") === "male") {
            bio += "He ";
        } else if (getGeniData(focus, "gender") === "female") {
            bio += "She ";
        } else {
            bio += getGeniData(focus, "first_name") + " ";
        }
        bio += "was a " + occupation + ". ";
    }

    for (let i = 0; i < partners.length; i++) {

        bio += "\n\n" + getGeniData(focus, "first_name");
        if (getGeniData(partners[i], "status") !== "partner") {
            bio += " married ";
        } else {
            bio += " partnered with ";
        }
        bio += buildWikiLink(partners[i]);
        if (getGeniData(partners[i], "status") !== "partner") {
            if (getGeniData(partners[i], "marriage", "date") !== "") {
                bio += dateFormat(getGeniData(partners[i], "marriage", "date"));
            }
            if (getGeniData(partners[i], "marriage", "location") !== "") {
                bio += " in " + getGeniData(partners[i], "marriage", "location")["formatted_location"];
            }
            if (getGeniData(partners[i], "divorce") !== "") {
                bio += " and they divorced";
                if (getGeniData(partners[i], "divorce", "date") !== "") {
                    bio += dateFormat(getGeniData(partners[i], "divorce", "date"));
                }
                if (getGeniData(partners[i], "divorce", "location") !== "") {
                    bio += " in " + getGeniData(partners[i], "divorce", "location")["formatted_location"];
                }
            }
        }
        bio += ". ";
        children = getChildren(focus, partners[i]);
        if (children.length > 0) {
            bio += "Together they had the following children:\n" + buildWikiLink(children[0]);
            for (let x = 1; x < children.length; x++) {
                bio += ";\n" + buildWikiLink(children[x]);
            }
            bio += ". ";
        }
    }

    if (death !== "" || burial !== "") {
        bio += "\n\n";
        if (getGeniData(focus, "gender") === "male") {
            bio += "He ";
        } else if (getGeniData(focus, "gender") === "female") {
            bio += "She ";
        } else {
            bio += getGeniData(focus, "first_name") + " ";
        }
    }

    if (death !== "") {
        bio += "died";
        if (exists(death.date)) {
            bio += dateFormat(death.date);
        }
        if (exists(death.location)) {
            bio += " in " + death.location.formatted_location;
        }
        if (deathcause !== "") {
            bio += " from " + deathcause;
        }
        if (burial !== "") {
            bio += " and ";
        } else {
            bio += ". ";
        }
    }

    if (burial !== "") {
        if (death === "" && deathcause !== "") {
            bio += "died from " + deathcause + " and ";
        }
        bio += "was buried";
        if (exists(burial.date)) {
            bio += dateFormat(burial.date);
        }
        if (exists(burial.location)) {
            var burloc = burial.location.formatted_location;
            if (exists(death.location)) {
                var deathloc = death.location.formatted_location;
                if (deathloc === burloc) {
                    bio += " there";
                } else if (deathloc === burloc.replace(burial.location.place_name + ", ", "")) {
                    bio += " in " + burial.location.place_name;
                } else {
                    bio += " in " + burloc;
                }
            } else {
                bio += " in " + burloc;
            }
        }
        bio += ". ";
    }

    bio += "\n----\n";
    biography = bio;
}

function buildProfileDutch() {
    const current_date = moment();
	var focus = getFocus();
    var parents = getParents();
    var partners = getPartners();
    var bio = "==Biografie==\n'''" + getGeniData(focus, "name") + "''' ";
    var birth = getGeniData(focus, "birth");
    var bap = getGeniData(focus, "baptism");
	var living = getGeniData(focus, "is_alive");
    var death = getGeniData(focus, "death");
    var deathcause = getGeniData(focus, "cause_of_death");
    var burial = getGeniData(focus, "burial");
    var occupation = getGeniData(focus, "occupation");
	// add warning for data conflicts to the biography
	var conflicts = getGeniData(focus, "data_conflict");
	if (conflicts) {
		bio += "\n\nLET OP: er is een data conflict!\n\n";
	}
    if (birth !== "") {
        bio += "werd geboren";
        if (exists(birth.date)) {
            bio += dateFormatDutch(birth.date);
        }
        if (exists(birth.location)) {
            bio += " in " + birth.location.formatted_location;
        }
        if (bap !== "") {
            bio += " en ";
        } else {
            bio += ". ";
        }
    }
    if (bap !== "") {
        bio += "werd";

        if (exists(bap.date)) {
            bio += dateFormatDutch(bap.date);
        }
        if (exists(bap.location)) {
            var baploc = bap.location.formatted_location;
            if (exists(birth.location)) {
                var birthloc = birth.location.formatted_location;
                if (birthloc === baploc) {
                    bio += " daar gedoopt";
                } else if (birthloc === baploc.replace(bap.location.place_name + ", ", "")) {
                    bio += " gedoopt in " + bap.location.place_name;
                } else {
                    bio += " gedoopt in " + baploc;
                }
            } else {
                bio += " gedoopt in " + baploc;
            }
        }
        bio += ". ";
    }
    if (parents.length > 0 && parents.length < 3) {
        var father = null;
        var mother = null;
        if (getGeniData(parents[0], "gender") === "male") {
            father = parents[0];
        } else if (getGeniData(parents[1], "gender") === "male") {
            father = parents[1];
        }
        if (getGeniData(parents[0], "gender") === "female") {
            mother = parents[0];
        } else if (getGeniData(parents[1], "gender") === "female") {
            mother = parents[1];
        }
        if (getGeniData(focus, "gender") === "male") {
            bio += "Zijn ";
        } else if (getGeniData(focus, "gender") === "female") {
            bio += "Haar ";
        } else {
            bio += getGeniData(focus, "first_name") + "\'s ";
        }
        if (exists(father) && exists(mother)) {
            bio += "ouders waren " + buildWikiLink(father) + " en " + buildWikiLink(mother) + ". ";
        } else if (exists(father)) {
            bio += "vader was " + buildWikiLink(father) + ". ";
        } else if (exists(mother)) {
            bio += "moeder was " + buildWikiLink(mother) + ". ";
        }
    }
    if (occupation !== "") {
        if (getGeniData(focus, "gender") === "male") {
            bio += "Hij ";
        } else if (getGeniData(focus, "gender") === "female") {
            bio += "Zij ";
        } else {
            bio += getGeniData(focus, "first_name") + " ";
        }
		// ocupation can be current when living
		if (!living) {
			bio +="was ";
		}
		else
		{
			bio +="is ";
		}
        bio += occupation + ". ";
    }
    for (let i = 0; i < partners.length; i++) {
        bio += "\n\n" + getGeniData(focus, "first_name");
        if ((getGeniData(partners[i], "status") !== "partner") && (getGeniData(partners[i], "status") !== "ex_partner")) {
            bio += " trouwde ";
        } 
		else {
		  if (getGeniData(partners[i], "status") == "partner") {
			bio += " partner van";
		  }
		  else {
			bio += " ex-partner van ";
		  }
        }
        bio += buildWikiLink(partners[i]);
        if (getGeniData(partners[i], "status") !== "partner") {
            if (getGeniData(partners[i], "marriage", "date") !== "") {
                bio += dateFormatDutch(getGeniData(partners[i], "marriage", "date"));
            }
            if (getGeniData(partners[i], "marriage", "location") !== "") {
                bio += " in " + getGeniData(partners[i], "marriage", "location")["formatted_location"];
            }
            if (getGeniData(partners[i], "divorce") !== "") {
                bio += " en ze zijn gescheiden";
                if (getGeniData(partners[i], "divorce", "date") !== "") {
                    bio += dateFormatDutch(getGeniData(partners[i], "divorce", "date"));
                }
                if (getGeniData(partners[i], "divorce", "location") !== "") {
                    bio += " in " + getGeniData(partners[i], "divorce", "location")["formatted_location"];
                }
            }
        }
        bio += ". ";
        children = getChildren(focus, partners[i]);
        if (children.length > 0) {
            bio += "Samen hadden ze de volgende kinderen:\n" + buildWikiLink(children[0]);
            for (let x = 1; x < children.length; x++) {
                bio += ";\n" + buildWikiLink(children[x]);
            }
            bio += ". ";
        }
    }
	// there can be children even when no partner
    if (partners.length == 0) {
		var children = getChildren(focus);
        if (children.length > 0) {
            bio += "\nKind(eren):\n" + buildWikiLink(children[0]);
            for (let x = 1; x < children.length; x++) {
                bio += ";\n" + buildWikiLink(children[x]);
            }
            bio += ". ";
        }
    }
		

    if (death !== "" || burial !== "") {
        bio += "\n\n";
        if (getGeniData(focus, "gender") === "male") {
            bio += "Hij ";
        } else if (getGeniData(focus, "gender") === "female") {
            bio += "Zij ";
        } else {
            bio += getGeniData(focus, "first_name") + " ";
        }
    }
    if (death !== "") {
        bio += "is overleden";
        if (exists(death.date)) {
            bio += dateFormatDutch(death.date);
        }
        if (exists(death.location)) {
            bio += " in " + death.location.formatted_location;
        }
        if (deathcause !== "") {
            bio += " aan " + deathcause;
        }
        if (burial !== "") {
            bio += " en ";
        } else {
            bio += ". ";
        }
    }
    if (burial !== "") {
        if (death === "" && deathcause !== "") {
            bio += "overleden aan " + deathcause + " en ";
        }
        bio += "werd";

        if (exists(burial.date)) {
            bio += dateFormatDutch(burial.date);
        }
        if (exists(burial.location)) {
            var burloc = burial.location.formatted_location;	
            if (exists(death.location)) {
                var deathloc = death.location.formatted_location;
                if (deathloc === burloc) {
                    bio += " daar begraven";
                } else if (deathloc === burloc.replace(burial.location.place_name + ", ", "")) {
                    bio += " begraven in " + burial.location.place_name;
                } else {
                    bio += " begraven in " + burloc;
                }
            } else {
                bio += " begraven in " + burloc;
            }
        }
        bio += ". ";
    }
	// added generated date
    bio += "\n''(Biografie gegenereerd op " + current_date.format('DD-MM-YYYY') + ")''\n----\n";
    biography = bio;
}

function buildProfileFinnish() {
    var focus = getFocus();
    var parents = getParents();
    var partners = getPartners();
    var bio = "==Elämäkerta==\n'''" + getGeniData(focus, "name") + "''' ";

    var birth = getGeniData(focus, "birth");
    var bap = getGeniData(focus, "baptism");
    var death = getGeniData(focus, "death");
    var deathcause = getGeniData(focus, "cause_of_death");
    var burial = getGeniData(focus, "burial");
    var occupation = getGeniData(focus, "occupation");

    if (birth !== "") {
        bio += "syntyi";
        if (exists(birth.date)) {
            bio += dateFormatFinnish(birth.date);
        }
        if (exists(birth.location)) {
            bio += ", " + birth.location.formatted_location;
        }
        if (bap !== "") {
            bio += " ja ";
        } else {
            bio += ". ";
        }
    }
    if (bap !== "") {
        bio += "ja kastettiin";
        if (exists(bap.date)) {
            bio += dateFormatFinnish(bap.date);
        }
        if (exists(bap.location)) {
            var baploc = bap.location.formatted_location;
            if (exists(birth.location)) {
                var birthloc = birth.location.formatted_location;
                if (birthloc === baploc) {
                    bio += " siellä";
                } else if (birthloc === baploc.replace(bap.location.place_name + ", ", "")) {
                    bio += ", " + bap.location.place_name;
                } else {
                    bio += ", " + baploc;
                }
            } else {
                bio += ", " + baploc;
            }
        }
        bio += ". ";
    }
    if (parents.length > 0 && parents.length < 3) {
        var father = null;
        var mother = null;
        if (getGeniData(parents[0], "gender") === "male") {
            father = parents[0];
        } else if (getGeniData(parents[1], "gender") === "male") {
            father = parents[1];
        }
        if (getGeniData(parents[0], "gender") === "female") {
            mother = parents[0];
        } else if (getGeniData(parents[1], "gender") === "female") {
            mother = parents[1];
        }
        bio += "Hänen ";

        if (exists(father) && exists(mother)) {
            bio += "vanhempansa olivat " + buildWikiLink(father) + " ja " + buildWikiLink(mother) + ". ";
        } else if (exists(father)) {
            bio += "isänsä oli " + buildWikiLink(father) + ". ";
        } else if (exists(mother)) {
            bio += "äitinsä oli " + buildWikiLink(mother) + ". ";
        }
    }


    if (occupation !== "") {
        bio += "Hän oli ammatiltaan " + occupation + ". ";
    }

    for (let i = 0; i < partners.length; i++) {

        bio += "\n\n" + getGeniData(focus, "first_name");
        if (getGeniData(partners[i], "status") !== "partner") {
            bio += " avioitui ";
        } else {
            bio += " hänen kumppaninsa oli ";
        }
        bio += buildWikiLink(partners[i]);
        if (getGeniData(partners[i], "status") !== "partner") {
            bio += " kanssa";
            if (getGeniData(partners[i], "marriage", "date") !== "") {
                bio += dateFormatFinnish(getGeniData(partners[i], "marriage", "date"));
            }
            if (getGeniData(partners[i], "marriage", "location") !== "") {
                bio += ", " + getGeniData(partners[i], "marriage", "location")["formatted_location"];
            }
            if (getGeniData(partners[i], "divorce") !== "") {
                bio += " he erosivat";
                if (getGeniData(partners[i], "divorce", "date") !== "") {
                    bio += dateFormatFinnish(getGeniData(partners[i], "divorce", "date"));
                }
                if (getGeniData(partners[i], "divorce", "location") !== "") {
                    bio += ", " + getGeniData(partners[i], "divorce", "location")["formatted_location"];
                }
            }
        }
        bio += ". ";
        children = getChildren(focus, partners[i]);
        if (children.length > 0) {
            bio += "Heillä oli yhteiset lapset:\n" + buildWikiLink(children[0]);
            for (let x = 1; x < children.length; x++) {
                bio += ";\n" + buildWikiLink(children[x]);
            }
            bio += ". ";
        }
    }

    if (death !== "" || burial !== "") {
        bio += "\n\n";
        bio += "Hän ";
    }



    if (death !== "") {
        bio += "kuoli";
        if (exists(death.date)) {
            bio += dateFormatFinnish(death.date);
        }
        if (exists(death.location)) {
            bio += ", " + death.location.formatted_location;
        }
        if (deathcause !== "") {
            bio += ", syynä " + deathcause;
        }
        if (burial !== "") {
            bio += " ja ";
        } else {
            bio += ". ";
        }
    }

    if (burial !== "") {
        if (death === "" && deathcause !== "") {
            bio += "kuoli, syynä " + deathcause + ", ja ";
        }
        bio += "haudattiin";
        if (exists(burial.date)) {
            bio += dateFormatFinnish(burial.date);
        }
        if (exists(burial.location)) {
            var burloc = burial.location.formatted_location;
            if (exists(death.location)) {
                var deathloc = death.location.formatted_location;
                if (deathloc === burloc) {
                    bio += " sinne";
                } else if (deathloc === burloc.replace(burial.location.place_name + ", ", "")) {
                    bio += ", " + burial.location.place_name;
                } else {
                    bio += ", " + burloc;
                }
            } else {
                bio += ", " + burloc;
            }
        }
        bio += ". ";
    }

    bio += "\n----\n";
    biography = bio;
}

function buildConsistency() {
    consistencymessage = "";
    var focus = getFocus();
    var parents = getParents();
    var siblings = getSiblings();
    var children = getChildren(focus);
    var partners = getPartners();
    var parentset = getParentSets(focus, parents);
    siblings.unshift(focus); //treat the focus as a sibling

    //Compare profiles against themselves
    publiclist = [];
    selfCheck(siblings);
    selfCheck(children, true);
    selfCheck(partners);
    selfCheck(parents);

    if (publiclist.length > 0) {
        var namelist = [];
        for (let i = 0; i < publiclist.length; i++) {
            genifocusdata = genifamilydata[publiclist[i]];
            let permissions = genifocusdata.get("actions");
            if (permissions.indexOf("update") !== -1) {
                namelist.push(getGeniData(publiclist[i], "name"));
            }
        }
        if (namelist.length > 0) {
            //Old private profiles
            if (namelist.length > 1) {
                consistencymessage = concat("info") + _("numFamilyMembersBornBeforeYearAreSetAsPrivate", [publiclist.length, publicyear]) +
                    "<sup><a title='" + namelist.join("; ") + "' href='javascript:void(0)' class='makepublic'>[" + _("makePublic") + "]</a></sup>";
            } else {
                consistencymessage = concat("info") + _("personWasBornBeforeYearAndIsSetAsPrivate", [buildEditLink(publiclist[0]), publicyear]) +
                    "<sup><a title='" + namelist.join("; ") + "' href='javascript:void(0)' class='makepublic'>[" + _("makePublic") + "]</a></sup>";
            }
        }
    }

    relationshipCheck(parents, siblings);
    relationshipCheck(parents, partners);
    relationshipCheck(parents, children);
    relationshipCheck(partners, children);
    relationshipCheck(siblings, children);

    //Compare Parent & Sibling relationships
    for (let union in parentset) {
        if (!parentset.hasOwnProperty(union)) continue;
        siblings = getChildren(parentset[union][0], parentset[union][1]);
        partnerCheck(parentset[union]);
        siblingCheck(siblings);
        childCheck(parentset[union], siblings);
    }

    //Compare Focus & Child relationships
    for (let i = 0; i < partners.length; i++) {
        parents = [focus, partners[i]];
        children = getChildren(focus, partners[i]);
        partnerCheck(parents);
        siblingCheck(children);
        childCheck(parents, children);
    }

    checkQMessage();
}

function checkQMessage() {
    if (messagestatus.length > 0) {
        setTimeout(checkQMessage, 50);
    } else {
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
            consistencymessage = concat("warn") + _("More_than_") + spouse_age_dif + _("_year_age_difference_between_") + buildEditLink(wife) + _("_and_") +
                getPronoun(getGeniData(wife, "gender")) + " " + getStatus(hstatus, getGeniData(husband, "gender")) + " " + buildEditLink(husband) + ".";
        }
        if (samenameoption && validName(getGeniData(wife, "maiden_name")) && getGeniData(wife, "maiden_name") === getGeniData(husband, "last_name")) {
            if (!(getGeniData(husband, "maiden_name") !== "" && getGeniData(husband, "last_name") !== getGeniData(husband, "maiden_name"))) {
                //Maiden name same as husband's last name
                //TODO if you get additional family members, compare this against her father's last name
                messagestatus.push(wife);
                var args = "fields=id,first_name,last_name,maiden_name,gender,deleted,public&actions=update,update-basics";
                var url = "https://www.geni.com/api/" + wife + "/immediate-family?" + args + "&access_token=" + accountinfo.access_token;
                chrome.runtime.sendMessage({
                    method: "GET",
                    action: "xhttp",
                    url: url
                }, function (response) {
                    if (response.source === "[]" || response.source === "") {
                        wifefamily = [];
                    } else {
                        try {
                            wifefamily = JSON.parse(response.source);
                        } catch (e) {
                            wifefamily = [];
                        }
                        if (!exists(wifefamily) || !exists(wifefamily["focus"])) {
                            wifefamily = [];
                        } else {
                            var wifeid = wifefamily["focus"].id;
                            var nodes = wifefamily["nodes"];
                            var wifeunionid = null;
                            var wifefather = null;
                            wifefamilydata = [];
                            for (let node in nodes) {
                                if (!nodes.hasOwnProperty(node)) continue;
                                if (!nodes[node].id.startsWith("union") && !nodes[node].deleted) {
                                    if (nodes[node].id == wifeid && nodes[node].edges) {
                                        for (edge in nodes[node].edges) {
                                            if (nodes[node].edges[edge].rel == "child") {
                                                wifeunionid = edge;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                            for (let node in nodes) {
                                if (!nodes.hasOwnProperty(node)) continue;
                                if (!nodes[node].id.startsWith("union") && !nodes[node].deleted) {
                                    if (nodes[node].edges) {
                                        for (edge in nodes[node].edges) {
                                            if (edge == wifeunionid && nodes[node].edges[edge].rel == "partner" && isMale(nodes[node].gender)) {
                                                wifefather = nodes[node];
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                            var fatherfirstcheck = true;
                            if (wifefather !== null && exists(wifefather.first_name)) {
                                fatherfirst = wifefather.first_name.split(" ");
                                fatherfirstcheck = wifefamily["focus"].maiden_name.startsWith(fatherfirst[0]) !== true;
                            }
                            if (wifefather === null || (
                                    wifefamily["focus"].maiden_name !== wifefather.last_name &&
                                    wifefamily["focus"].maiden_name !== wifefather.maiden_name &&
                                    fatherfirstcheck)) {
                                consistencymessage = concat("info") + _("Birth_Surname_of_") + buildEditLink(wife) + _("_is_the_same_as_the_last_name_of_") +
                                    getPronoun(getGeniData(wife, "gender")) + " " + getStatus(hstatus, getGeniData(husband, "gender")) + " " + buildEditLink(husband) + ".";
                            }
                        }
                    }
                    messagestatus.pop();
                });
            }
        }
        if (isNaN(husband_ddate) && husband_ddate === wife_ddate) {
            //Husband and wife death dates the same
            consistencymessage = concat("info") + _("Death_date_of_") + buildEditLink(husband) + _("_is_the_same_as_the_death_date_of_") +
                getPronoun(getGeniData(husband, "gender")) + " " + getStatus(wstatus, getGeniData(wife, "gender")) + " " + buildEditLink(wife) + ".";
        }
        if (isNaN(husband_ddate) && husband_ddate === union_mdate) {
            //Husband death date same as marriage date
            consistencymessage = concat("info") + _("Death_date_of_") + buildEditLink(husband) + _("_is_the_same_as_") + getPronoun(getGeniData(husband, "gender")) +
                _("_marriage_date") + ".";
        }
        if (isNaN(wife_ddate) && wife_ddate === union_mdate) {
            //Wife death date same as marriage date
            consistencymessage = concat("info") + _("Death_date_of_") + buildEditLink(wife) + _("_is_the_same_as_") + getPronoun(getGeniData(wife, "gender")) +
                _("_marriage date.");
        }

        for (let i = 0; i < partners.length; i++) {
            var partner_bdate = unixDate(partners[i], "birth");
            var partner_ddate = unixDate(partners[i], "death");
            var partner_mdate = unixDate(partners[i], "marriage");
            if (partner_bdate > partner_mdate) {
                //Born after marriage
                consistencymessage = concat("error") + buildEditLink(partners[i]) + _("_born_after_") + getPronoun(getGeniData(partners[i], "gender")) + _("_marriage_date") + ".";
            } else if (partner_ddate < partner_mdate) {
                //Died before marriage
                consistencymessage = concat("error") + buildEditLink(partners[i]) + _("_died_before_") + getPronoun(getGeniData(partners[i], "gender")) + _("_marriage_date") + ".";
            } else if (partner_bdate + (marriageage_young * year) > partner_mdate) {
                //Implausible marriage age, too young
                consistencymessage = concat("warn") + buildEditLink(partners[i]) + _("_is_under_") + marriageage_young + _("_years_old_for_") + getPronoun(getGeniData(partners[i], "gender")) + _("_marriage");
            }
        }
    }
}

function siblingCheck(siblings) {
    if (siblingcheckoption) {
        var day = 86400 * 2; //48 hours
        for (let i = 0; i < siblings.length; i++) {
            for (let j = i + 1; j < siblings.length; j++) {
                var sib1_bdate = unixDate(siblings[i], "birth");
                var sib2_bdate = unixDate(siblings[j], "birth");
                if (isYear(siblings[i], "birth") || isYear(siblings[j], "birth")) {
                    //TODO This should be improved for years that are the same to check if the birth is in the middle of the year
                    continue;
                }
                if ((sib1_bdate < sib2_bdate && sib1_bdate + pregnancy > sib2_bdate) ||
                    (sib1_bdate > sib2_bdate && sib1_bdate - pregnancy < sib2_bdate)) {
                    if ((sib1_bdate < sib2_bdate && sib1_bdate + day > sib2_bdate) ||
                        (sib1_bdate > sib2_bdate && sib1_bdate - day < sib2_bdate)) {
                        //Exclude Twins - 48hrs to account birth going into a second day
                    } else {
                        //Siblings ages too close together
                        consistencymessage = concat("warn") + _("Birth_date_of_") + buildEditLink(siblings[i]) + _("_and_") + getPronoun(getGeniData(siblings[i], "gender")) +
                            " " + siblingName(getGeniData(siblings[j], "gender")) + " " + buildEditLink(siblings[j]) + _("_are_within_") + termlimit + _("_months") + ".";
                    }
                }
            }
        }
    }
}

function childCheck(parents, children) {
    var wedcheck = 0;
    if (parents[0] === focusid) {
        wedcheck = 1;
    }
    for (let i = 0; i < parents.length; i++) {
        var parent_bdate = unixDate(parents[i], "birth");
        var parent_ddate = unixDate(parents[i], "death");
        var parent_mdate = unixDate(parents[i], "marriage");
        if (childcheckoption) {
            for (let x = 0; x < children.length; x++) {
                var adj_parent_ddate = parent_ddate;
                if (isMale(getGeniData(parents[i], "gender"))) {
                    var pregnancy_padding = 5259487; // 2 months
                    adj_parent_ddate = parent_ddate + pregnancy + pregnancy_padding; //Add pregnacy term and some padding to compare conception
                }
                var sibling_bdate = unixDate(children[x], "birth");
                if (sibling_bdate < parent_bdate) {
                    //Born before parent birth
                    consistencymessage = concat("error") + buildEditLink(children[x]) + _("_born_before_the_birth_of_") +
                        getPronoun(getGeniData(children[x], "gender")) + " " + parentName(getGeniData(parents[i], "gender")) + " " + buildEditLink(parents[i]) + ".";
                } else if (sibling_bdate > adj_parent_ddate && !containsRange(children[x], "birth", parents[i], "death")) {
                    //Born after parent death
                    consistencymessage = concat("error") + buildEditLink(children[x]) + _("_born_after_the_death_of_") +
                        getPronoun(getGeniData(children[x], "gender")) + " " + parentName(getGeniData(parents[i], "gender")) + " " + buildEditLink(parents[i]) + ".";
                } else if (sibling_bdate < parent_bdate + (birthage_young * year) + pregnancy) {
                    //Parent too young for child's birth
                    consistencymessage = concat("warn") + buildEditLink(parents[i]) + _("_is_under_") + birthage_young + _("_years_old_for_the_birth_of_") + getPronoun(getGeniData(parents[i], "gender")) +
                        " child " + buildEditLink(children[x]) + ".";
                } else if (isFemale(getGeniData(parents[i], "gender")) && sibling_bdate > parent_bdate + (birthage_old * year)) {
                    //Mother too old for child's birth
                    consistencymessage = concat("warn") + buildEditLink(parents[i]) + _("_is_over_") + birthage_old + _("_years_old_for_the_birth_of_") + getPronoun(getGeniData(parents[i], "gender")) +
                        " child " + buildEditLink(children[x]) + ".";
                } else if (wedlock && i === wedcheck && sibling_bdate < parent_mdate && !containsRange(parents[i], "marriage", children[x], "birth")) {
                    //Born before parent marriage
                    consistencymessage = concat("info") + buildEditLink(children[x]) + _("_born_before_the_marriage_of_") +
                        getPronoun(getGeniData(children[x], "gender")) + _("_parents_") + buildEditLink(parents[0]) + _("_and_") + buildEditLink(parents[1]) + ".";
                }
            }
        }
    }
}

function selfCheck(familyset, children) {
    children = children || false;
    if (selfcheckoption) {
        if (privatecheck) {
            var publicdate = new Date();
            publicdate.setFullYear(publicyear, 0, 1);
            var publicbottom = new Date();
            publicbottom.setFullYear(100, 0, 1); //Prevent 2 digit year problems with living
        }

        for (let x = 0; x < familyset.length; x++) {
            var person = familyset[x];
            var person_bdate = unixDate(person, "birth");
            var person_bapdate = unixDate(person, "baptism");
            var person_ddate = unixDate(person, "death");
            var person_burial = unixDate(person, "burial");
            var conflicts = getGeniData(person, "data_conflict");
            if (dataconflictoption && conflicts) {
                consistencymessage = concat("info") + getGeniData(person, "name") + _("_has_pending_") + "<a href='https://www.geni.com/merge/resolve/" + getGeniData(person, "guid") + "'>"+_("data_conflicts")+"</a>.";
            }
            var private_bdate = person_bdate;
            if (isNaN(private_bdate) && !children) {
                //If the birth date of the profile is unknown, compare the focus profile's birthdate for siblings, spouse, and parents to estimate birth
                private_bdate = unixDate(getFocus(), "birth");
            }
            if (privatecheck && !getGeniData(person, "public") && publicdate !== undefined && private_bdate < parseInt(publicdate.getTime() / 1000) && private_bdate > parseInt(publicbottom.getTime() / 1000)) {
                publiclist.push(person);
            }
            checkDate(person, "birth");
            checkDate(person, "baptism");
            checkDate(person, "death");
            checkDate(person, "burial");
            if (agecheckoption) {
                if (person_bdate + longevity_error * year < person_ddate) {
                    //Excessive Age Error
                    consistencymessage = concat("error") + _("The_age_of_") + buildEditLink(person) + _("_exceeds_") + longevity_error + _("_years") + ".";
                } else if (person_bdate + longevity_warn * year < person_ddate) {
                    //Excessive Age Warning
                    consistencymessage = concat("warn") + _("The_age_of_") + buildEditLink(person) + _("_exceeds_") + longevity_warn + _("_years") + ".";
                }
                if (person_bdate > person_ddate && !containsRange(person, "birth", person, "death")) {
                    //Born after death
                    consistencymessage = concat("error") + _("Birth_date_of_") + buildEditLink(person) + _("_is_after_") + getPronoun(getGeniData(person, "gender")) + _("_death_date") + ".";
                } else if (person_bapdate > person_ddate && !containsRange(person, "baptism", person, "death")) {
                    //Baptism after death
                    consistencymessage = concat("error") + _("Baptism_date_of_") + buildEditLink(person) + _("_is_after_") + getPronoun(getGeniData(person, "gender")) + _("_death_date") + ".";
                } else if (person_bapdate < person_bdate && !containsRange(person, "birth", person, "baptism")) {
                    //Baptism before birth
                    consistencymessage = concat("error") + _("Baptism_date_of_") + buildEditLink(person) + _("_is_before_") + getPronoun(getGeniData(person, "gender")) + _("_birth_date")+".";
                } else if (person_ddate > person_burial && !containsRange(person, "death", person, "burial")) {
                    //Death is after Burial
                    consistencymessage = concat("error") + _("Death_date_of_") + buildEditLink(person) + _("_is_after_") + getPronoun(getGeniData(person, "gender")) + _("_burial_date") + ".";
                }
            }

            if (namecheckoption) {
                var claimed = getGeniData(person, "claimed");
                var living = getGeniData(person, "is_alive");
                var livingcheck = living && livingnameoption;
                var quickfix = !claimed && !livingcheck;
                checkSpace(person, quickfix);
                checkAlias(person, quickfix);
                checkCase(person, quickfix);
                checkSuffixInFirstName(person, quickfix);
                checkTitle(person, quickfix);
                checkMaidenName(person, quickfix);
                checkSuffix(person, quickfix);
            }
        }
    }
}

function checkSpace(person, quickfix) {
    // checks for default language names (with fixes)
    var namevaluecheck = [];
    var namevalues = ["display_name", "first_name", "middle_name", "last_name", "maiden_name"];
    if (improperSapce(getGeniData(person, "name"))) {
        var nameupdate = [];
        for (let i = 0; i < namevalues.length; i++) {
            var name = getGeniData(person, namevalues[i]);
            if (improperSapce(name)) {
                namevaluecheck.push(namevalues[i]);
                nameupdate.push(name.replace("  ", " ").trim());
            }
        }
        //Name contains double space
        consistencymessage = concat("info") + buildEditLink(person) + _("_contains_a_double_space_in_") +
            getPronoun(getGeniData(person, "gender")) + " name.";
        genifocusdata = genifamilydata[person];
        let permissions = genifocusdata.get("actions");
        if (permissions.indexOf("update-basics") !== -1) {
            if (quickfix) {
                consistencymessage += "<sup><a title='" + nameupdate.join("; ") +
                    "' class='fixspace' href='javascript:void(0)' id='space" + getGeniData(person, "id") + "' name='" + namevaluecheck +
                    "'>[" + _("fixSpace") + "]</a></sup>";
            } else {
                consistencymessage += "<sup>[" + profileStatus(person) + "]</sup>";
            }
        }
    }
    // checks for other languages names (without fixes as Geni API does not support it)
    var names = getGeniData(person, "names");
    if (names !== "") {
        var defaultLanguage = true;
        for (let lang in names) {
            if (names.hasOwnProperty(lang)) {
                var nameFound = false;
                for (let i = 0; i < namevalues.length; i++) {
                    if (names[lang].hasOwnProperty(namevalues[i])) {
                        nameFound = true;
                        if (!defaultLanguage) {
                            // skip first found language with any names as these have been handled above in default language name checks
                            var name = names[lang][namevalues[i]];
                            if (improperSapce(name)) {
                                consistencymessage = concat("info") + buildEditLink(person) + _("_contains_a_double_or_trailing_space_in_") +
                                    getPronoun(getGeniData(person, "gender")) + _("_names")+" (" + lang + ").";
                                break;
                            }
                        }
                    }
                }
                if (nameFound) {
                    defaultLanguage = false;
                }
            }
        }
    }
}

function checkAlias(person, quickfix) {
    var names = getGeniData(person, "names");
    if (names !== "") {
        for (let lang in names) {
            if (names.hasOwnProperty(lang)) {
                if (names[lang].hasOwnProperty("first_name")) {
                    var firstName = names[lang]["first_name"];
                    if (firstName.contains('&quot;') || firstName.contains('"') || (firstName.contains('(') && firstName.contains(')')) ||
                        firstName.split("'").length > 2) {

                        // Name contains alias
                        consistencymessage = concat("info") + buildEditLink(person) + _("_contains_an_alias_in_") +
                            getPronoun(getGeniData(person, "gender")) + " " + _("first_name") +" (" + lang + ").";
                    }
                }
            }
        }
    } else if (getGeniData(person, "first_name").contains('&quot;') || getGeniData(person, "first_name").contains('"') ||
        (getGeniData(person, "first_name").contains('(') && getGeniData(person, "first_name").contains(')')) ||
        getGeniData(person, "first_name").split("'").length > 2) {

        //Name contains alias
        consistencymessage = concat("info") + buildEditLink(person) + _("_contains_an_alias_in_") + getPronoun(getGeniData(person, "gender")) +
            " "+ _("first_name") + ".";
    }
}

function checkCase(person, quickfix) {
    // checks for default language names (with fixes)
    var namevaluecheck = [];
    var nameupdate = [];
    var namevalues = ["display_name", "first_name", "middle_name", "last_name", "maiden_name"];
    var names = getGeniData(person, "names");
    if (names !== "") {
        for (let lang in names) {
            if (names.hasOwnProperty(lang)) {
                for (let i = 0; i < namevalues.length; i++) {
                    if (names[lang].hasOwnProperty(namevalues[i])) {
                        // skip first found language with any names as these have been handled above in default language name checks
                        var name = names[lang][namevalues[i]];
                        if (validName(name) && !NameParse.is_camel_case(name) && name !== formatName(name)) {
                            namevaluecheck.push("names[" + lang + "][" + namevalues[i] + "]");
                            nameupdate.push(formatName(name).replace(/'/g, "&#39;"));
                        }
                    }
                }
            }
        }
    } else {
        for (let i = 0; i < namevalues.length; i++) {
            var name = getGeniData(person, namevalues[i]);
            if (validName(name) && !NameParse.is_camel_case(name) && name !== formatName(name)) {
                namevaluecheck.push(namevalues[i]);
                nameupdate.push(formatName(name).replace(/'/g, "&#39;"));
            }
        }
    }
    if (namevaluecheck.length > 0) {
        //Name contains improper use of uppercase/lowercase
        consistencymessage = concat("info") +
            _("contains_incorrect_uppercase_lowercase_in_name_default", [buildEditLink(person), getPronoun(getGeniData(person, "gender"))]);
        genifocusdata = genifamilydata[person];
        let permissions = genifocusdata.get("actions");
        if (permissions.indexOf("update-basics") !== -1) {
            if (quickfix) {
                consistencymessage += "<sup><a title='" + nameupdate.join("; ") + "' class='fixcase' href='javascript:void(0)' id='case" + getGeniData(person, "id") +
                    "' name='" + namevaluecheck + "'>[" + _("fixCase") + "]</a></sup>";
            } else {
                consistencymessage += "<sup>[" + profileStatus(person) + "]</sup>";
            }
        }
    }
}

function checkSuffixInFirstName(person, quickfix) {
    var fnamesplit = getGeniData(person, "first_name").split(" ");
    if (fnamesplit.length > 1 && NameParse.is_suffix(fnamesplit[fnamesplit.length - 1]) && getGeniData(person, "suffix") === "") {
        //First Name contain suffix
        consistencymessage = concat("info") + buildEditLink(person) + _("_appears_to_contain_a_suffix_in_") +
            getPronoun(getGeniData(person, "gender")) + _("_first_name") + ".";
        genifocusdata = genifamilydata[person];
        let permissions = genifocusdata.get("actions");
        if (permissions.indexOf("update-basics") !== -1) {
            if (quickfix) {
                consistencymessage += "<sup><a title='Move Suffix' class='fixsuffix' href='javascript:void(0)' id='fsuffix" + getGeniData(person, "id") +
                    "'>" + _("fixSuffix") + "</a></sup>";
            } else {
                consistencymessage += "<sup>[" + profileStatus(person) + "]</sup>";
            }
        }
    }
}

function checkTitle(person, quickfix) {
    if (getGeniData(person, "title") !== "") {
        var title = getGeniData(person, "title").toLowerCase().replace(/./g, "").replace(/-/g, "");
        genifocusdata = genifamilydata[person];
        let permissions = genifocusdata.get("actions");
        if (title === "mr" || title === "mrs" || title === "miss" || title === "ms") {
            // Salutation in title
            consistencymessage = concat("info") + buildEditLink(person) + _("contains_improper_use_of_salutation_in_") +
                getPronoun(getGeniData(person, "gender")) + _("_title") + ".";

            if (permissions.indexOf("update-basics") !== -1) {
                if (quickfix) {
                    consistencymessage += "<sup><a title='Remove salutation' class='clearfield' href='javascript:void(0)' id='cleartitle" +
                        getGeniData(person, "id") + "' name='title'>" + _("fixTitle") + "</a></sup>";
                } else {
                    consistencymessage += "<sup>[" + profileStatus(person) + "]</sup>";
                }
            }
        } else if (isChild(title) || isPartner(title) || isParent(title) || title === "grandmother" || title === "grandfather") {
            // Relationship in title
            consistencymessage = concat("info") + buildEditLink(person) + _("_contains_improper_use_of_relationship_in_") +
                getPronoun(getGeniData(person, "gender")) + _("_title") + ".";
            if (permissions.indexOf("update-basics") !== -1) {
                if (quickfix) {
                    consistencymessage += "<sup><a title='Remove relationship' class='clearfield' href='javascript:void(0)' id='cleartitle" +
                        getGeniData(person, "id") + "' name='title'>" + _("fixTitle") + "</a></sup>";
                } else {
                    consistencymessage += "<sup>[" + profileStatus(person) + "]</sup>";
                }
            }
        }
    }
}

function checkMaidenName(person, quickfix) {
    if (getGeniData(person, "maiden_name").startsWith("#") || (!isNaN(getGeniData(person, "maiden_name")) &&
            parseInt(getGeniData(person, "maiden_name")) > 5)) {

        //Numbering scheme
        consistencymessage = concat("info") + buildEditLink(person) + _("_contains_improper_use_of_a_numbering_scheme_in_") +
            getPronoun(getGeniData(person, "gender")) + _("_birth_surname.");
        genifocusdata = genifamilydata[person];
        let permissions = genifocusdata.get("actions");
        if (permissions.indexOf("update-basics") !== -1) {
            if (quickfix) {
                consistencymessage += "<sup><a title='Remove numeric' class='clearfield' href='javascript:void(0)' id='clearmaiden_name" +
                    getGeniData(person, "id") + "' name='maiden_name'>" + _("fixName") + "</a></sup>";
            } else {
                consistencymessage += "<sup>[" + profileStatus(person) + "]</sup>";
            }
        }
    }
}

// Checks that suffix does not contain salutation, improper numbering or relationship.
function checkSuffix(person, quickfix) {
    if (getGeniData(person, "suffix") !== "") {
        var suffix = getGeniData(person, "suffix").toLowerCase().replace(/./g, "").replace(/-/g, "");
        genifocusdata = genifamilydata[person];
        let permissions = genifocusdata.get("actions");
        if (suffix === "mr" || suffix === "mrs" || suffix === "miss" || suffix === "ms") {
            //Salutation in suffix
            consistencymessage = concat("info") + buildEditLink(person) + _("_contains_improper_use_of_salutation_in_") +
                getPronoun(getGeniData(person, "gender")) + _("_suffix.");
            if (permissions.indexOf("update-basics") !== -1) {
                if (quickfix) {
                    consistencymessage += "<sup><a title='Remove salutation' class='clearfield' href='javascript:void(0)' id='clearsuffix" +
                        getGeniData(person, "id") + "' name='suffix'>" + _("fixSuffix") + "</a></sup>";
                } else {
                    consistencymessage += "<sup>[" + profileStatus(person) + "]</sup>";
                }
            }
        } else if (suffix.startsWith("#") || (!isNaN(suffix) && suffix > 5)) {
            //Numbering scheme
            consistencymessage = concat("info") + buildEditLink(person) + _("_contains_improper_use_of_a_numbering_scheme_in_") +
                getPronoun(getGeniData(person, "gender")) + _("_suffix.");
            if (permissions.indexOf("update-basics") !== -1) {
                if (quickfix) {
                    consistencymessage += "<sup><a title='Remove salutation' class='clearfield' href='javascript:void(0)' id='clearsuffix" +
                        getGeniData(person, "id") + "' name='suffix'>" + _("fixSuffix") + "</a></sup>";
                } else {
                    consistencymessage += "<sup>[" + profileStatus(person) + "]</sup>";
                }
            }
        } else if (isChild(suffix) || isPartner(suffix) || isParent(suffix) || suffix === "grandmother" || suffix === "grandfather") {
            //Relationship in suffix
            consistencymessage = concat("info") + buildEditLink(person) + _("_contains_improper_use_of_relationship_in_") +
                getPronoun(getGeniData(person, "gender")) + _("_suffix.");
            if (permissions.indexOf("update-basics") !== -1) {
                if (quickfix) {
                    consistencymessage += "<sup><a title='Remove relationship' class='clearfield' href='javascript:void(0)' id='clearsuffix" +
                        getGeniData(person, "id") + "' name='suffix'>" + _("fixSuffix") + "</a></sup>";
                } else {
                    consistencymessage += "<sup>[" + profileStatus(person) + "]</sup>";
                }
            }
        }
    }
}

function profileStatus(person) {
    if (getGeniData(person, "claimed")) {
        return _("claimed");
    } else {
        return _("living");
    }
}

function relationshipCheck(group1, group2) {
    if (selfcheckoption) {
        for (let i = 0; i < group1.length; i++) {
            for (let x = 0; x < group2.length; x++) {
                if (group1[i] === group2[x]) {
                    //relationship cycle within immediate family
                    consistencymessage = concat("warn") + buildEditLink(group1[i]) + _("_is_in_a_relationship_cycle_within_the_immediate_family") + ".";
                }
            }
        }
    }
}

function checkDate(person, type) {
    if (selfcheckoption && datecheckoption) {
        var obj = getGeniData(person, type, "date");
        if (exists(obj.month) && parseInt(obj.month) > 12) {
            //Month greater than 12
            consistencymessage = concat("error") + buildEditLink(person) + _("_contains_an_invalid_") + type + _("_date_month_greater_than_12");
        } else if (exists(obj.day) && parseInt(obj.day) > 31) {
            //Day greater than 31
            consistencymessage = concat("error") + buildEditLink(person) + _("_contains_an_invalid_") + type + _("_date_day_greater_than_31");
        } else if (exists(obj.formatted_date) && obj.formatted_date.contains("error")) {
            //Geni error in Date
            consistencymessage = concat("error") + buildEditLink(person) + _("_contains_an_invalid_") + type + _("_date")+".";
        } else if (exists(obj.year) && exists(obj.day) && !exists(obj.month)) {
            //Year and Day without Month
            consistencymessage = concat("info") + buildEditLink(person) + _("_contains_an_incomplete_") + type + _("_date_missing_month");
        } else if (!exists(obj.year) && (exists(obj.month) || exists(obj.day))) {
            //Month or Day without any year
            consistencymessage = concat("info") + buildEditLink(person) + _("_contains_an_incomplete_") + type + _("_date_missing_year");
        }
    }
    if (selfcheckoption && locationcheckoption) {
        var obj = getGeniData(person, type, "location");
        if (obj !== "" && !exists(obj.place_name) && !exists(obj.country)) {
            //Location with no country
            consistencymessage = concat("info") + buildEditLink(person) + _("_contains_a_") + type + _("_location_without_a_country") + ".";
        }
    }
}

function validName(name) {
    name = name.toLowerCase();
    return (name.length > 1 && !name.contains(".") && isNaN(name) && name !== "nn" && name !== "unknown" && name !== "hidden");
}

function isYear(person, type) {
    var obj = getGeniData(person, type, "date");
    if (!exists(obj.formatted_date) || obj.formatted_date === "" || exists(obj.range)) {
        return false;
    }
    return exists(obj.year) && !exists(obj.day) && !exists(obj.month);
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
    return !(exists(d1.day) && exists(d2.day) && d1.day !== d2.day);
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
        date.setFullYear(parseInt(obj.year), 0, 1); //Reset date baseline to first of the year
        if (exists(obj.month)) {
            date.setMonth(parseInt(obj.month) - 1);
        }
        if (exists(obj.day)) {
            date.setDate(parseInt(obj.day));
        }
        return parseInt(date.getTime() / 1000);
    } else {
        return NaN;
    }
}

function buildEditLink(person) {
    genifocusdata = genifamilydata[person];
    let permissions = genifocusdata.get("actions");
    if (permissions.indexOf("update-basics") === -1) {
        if (tablink.startsWith("https://www.geni.com/people/") && tablink.endsWith(getGeniData(person, "guid"))) {
            return "<strong>" + getGeniData(person, "name") + "</strong>";
        } else {
            return "<a target='_blank' href='https://www.geni.com/profile/index/" + getGeniData(person, "guid") + "'>" + getGeniData(person, "name") + "</a>";
        }

    }
    if (startsWithHTTP(tablink, "https://www.geni.com/family-tree")) {
        return "<a href='javascript:openEditCard(\"" + getGeniData(person, "guid") + "\"); void 0'>" + getGeniData(person, "name") + "</a>";
    }
    return "<a href='https://www.geni.com/profile/edit_basics/" + getGeniData(person, "guid") + "'>" + getGeniData(person, "name") + "</a>";
}

function buildWikiLink(person) {
    return "[https://www.geni.com/" + getGeniData(person, "id") + " " + getGeniData(person, "name") + "]";
}

function improperSapce(name) {
    return name.contains("  ") || name.startsWith(" ") || name.endsWith(" ");
}

function formatName(namepart) {
    var name = namepart.replace(/&quot;/g, '"').split(" ");
    for (let i = 0; i < name.length; i++) {
        if (name.length > 1 && compoundlast && NameParse.is_compound_lastName(name[i]) && !name[i].contains(".")) {
            name[i] = name[i].toLowerCase();
        } else if (name[i].startsWith('"') && name[i].endsWith('"')) {
            name[i] = '"' + NameParse.fix_case(name[i].replace(/"/g, '')) + '"';
        } else {
            name[i] = NameParse.fix_case(name[i]);
        }
    }
    return name.join(" ");
}

function updateQMessage() {
    if (consistencymessage !== "") {
        $("#consistencyck").html("<span style='float: right; margin-top: -1px; padding-left: 10px;'><img id='refreshcheck' src='" +
            chrome.runtime.getURL("images/content_update.png") +
            "' style='cursor: pointer; margin-right: 3px; width: 12px;'><img class='consistencyslide' src='" +
            chrome.runtime.getURL("images/content_close.png") +
            "' style='cursor: pointer; width: 18px;'></span><a href='https://www.geni.com/projects/SmartCopy/18783' target='_blank'><img src='" +
            chrome.runtime.getURL("images/icon.png") +
            "' style='width: 16px; margin-top: -3px; padding-right: 5px;' title='SmartCopy'></a></img><strong>" +
            _("consistencyCheck") +
            ":</strong>" +
            consistencymessage);
        $('.consistencyslide').off();
        $('.consistencyslide').on('click', function () {
            displayCheck(false);
        });
        $('.fixcase').off();
        $('.fixcase').on('click', function () {
            var id = $(this)[0].id.replace("case", "");
            var args = {};
            var nameparts = $(this)[0].name.split(",");
            var nameupdates = $(this)[0].title.split("; ");
            for (let i = 0; i < nameparts.length; i++) {
                args[nameparts[i]] = nameupdates[i];
            }
            var url = "https://www.geni.com/api/" + id + "/update-basics?access_token=" + accountinfo.access_token;
            $("#case" + id).replaceWith("<span style='cursor: default;'>[" + _("fixed") +
                " <img src='" + chrome.runtime.getURL("images/content_check.png") +
                "' style='width: 14px; margin-top: -5px; margin-right: -3px;'></span>]");
            chrome.runtime.sendMessage({
                method: "POST",
                action: "xhttp",
                url: url,
                data: $.param(args)
            }, function (response) {});
        });
        $('.makepublic').off();
        $('.makepublic').on('click', function () {
            $("#makepublic").replaceWith("<span style='cursor: default;'>[" + _("fixed") + " <img src='" +
                chrome.runtime.getURL("images/content_check.png") + "' style='width: 14px; margin-top: -5px; margin-right: -3px;'></span>]");
            var args = {
                "public": true,
                "is_alive": false
            };
            for (let i = 0; i < publiclist.length; i++) {
                var url = "https://www.geni.com/api/" + publiclist[i] + "/update?access_token=" + accountinfo.access_token;
                chrome.runtime.sendMessage({
                    method: "POST",
                    action: "xhttp",
                    url: url,
                    data: $.param(args)
                }, function (response) {});
            }
        });
        $('.fixsuffix').off();
        $('.fixsuffix').on('click', function () {
            var id = $(this)[0].id.replace("fsuffix", "");
            var fnamesplit = getGeniData(id, "first_name").split(" ");
            var suffix = fnamesplit.pop();
            var args = {
                "suffix": suffix,
                "first_name": fnamesplit.join(" ")
            };
            var url = "https://www.geni.com/api/" + id + "/update-basics?access_token=" + accountinfo.access_token;
            $("#fsuffix" + id).replaceWith("<span style='cursor: default;'>[" + _("fixed") + " <img src='" +
                chrome.runtime.getURL("images/content_check.png") + "' style='width: 14px; margin-top: -5px; margin-right: -3px;'></span>]");
            chrome.runtime.sendMessage({
                method: "POST",
                action: "xhttp",
                url: url,
                data: $.param(args)
            }, function (response) {});
        });
        $('.fixspace').off();
        $('.fixspace').on('click', function () {
            var id = $(this)[0].id.replace("space", "");
            var args = {};
            var nameparts = $(this)[0].name.split(",");
            for (let i = 0; i < nameparts.length; i++) {
                args[nameparts[i]] = getGeniData(id, nameparts[i]).replace(/  /g, " ").trim();
            }
            var url = "https://www.geni.com/api/" + id + "/update-basics?access_token=" + accountinfo.access_token;
            $("#space" + id).replaceWith("<span style='cursor: default;'>[" + _("fixed") + " <img src='" +
                chrome.runtime.getURL("images/content_check.png") + "' style='width: 14px; margin-top: -5px; margin-right: -3px;'></span>]");
            chrome.runtime.sendMessage({
                method: "POST",
                action: "xhttp",
                url: url,
                data: $.param(args)
            }, function (response) {});
        });
        $('.clearfield').off();
        $('.clearfield').on('click', function () {
            var args = {};
            var name = $(this)[0].name;
            var id = $(this)[0].id.replace("clear" + name, "");
            args[name] = "";
            var url = "https://www.geni.com/api/" + id + "/update-basics?access_token=" + accountinfo.access_token;
            $("#clear" + name + id).replaceWith("<span style='cursor: default;'>[" + _("fixed") + " <img src='" +
                chrome.runtime.getURL("images/content_check.png") + "' style='width: 14px; margin-top: -5px; margin-right: -3px;'></span>]");
            chrome.runtime.sendMessage({
                method: "POST",
                action: "xhttp",
                url: url,
                data: $.param(args)
            }, function (response) {});
        });
        $('#refreshcheck').off();
        $('#refreshcheck').on('click', function () {
            displayCheck(false);
            getSettings();
            queryGeni();
        });
        displayCheck(true);
    } else {
        displayCheck(false);
    }
}

function displayCheck(visible) {
    if (visible) {
        $('#fb-sharing-wrapper').css({
            'visibility': 'hidden',
            'opacity': 0,
            'transition': 'visibility 0s, linear 300ms, opacity 300ms'
        });
        $("#consistencyck").slideDown();
    } else {
        $("#consistencyck").slideUp(function () {
            $('#fb-sharing-wrapper').css({
                'visibility': 'visible',
                'opacity': 1,
                'transition': 'visibility 0s, linear 0s, opacity 300ms'
            });
        });
    }
}

function getPronoun(gender) {
    if (isFemale(gender)) {
        return _("her");
    } else if (isMale(gender)) {
        return _("his");
    } else {
        return _("their");
    }
}

function parentName(gender) {
    if (isFemale(gender)) {
        return _("mother");
    } else if (isMale(gender)) {
        return _("father");
    } else {
        return _("parent");
    }
}

function siblingName(gender) {
    if (isFemale(gender)) {
        return _("sister");
    } else if (isMale(gender)) {
        return _("brother");
    } else {
        return _("sibling");
    }
}

function getStatus(relation, gender) {
    if (relation === _("partner")) {
        return relation;
    } else if (relation === _("mother")) {
        return _("wife");
    } else if (relation === _("father")) {
        return _("husband");
    } else {
        if (isFemale(gender)) {
            return _("wife");
        } else if (isMale(gender)) {
            return _("husband");
        } else {
            return relation;
        }
    }
}

function concat(type) {
    let icon = "<img src='" + chrome.runtime.getURL("images/content_" + type + ".png") + "' style='width: 14px; padding-left: 6px; padding-right: 2px; margin-top: -3px;'>";
    if (consistencymessage !== "") {
        return consistencymessage += icon;
    }
    return icon;
}

function getSettings() {
    geniconsistency = undefined;
    chrome.storage.local.get('accountinfo', function (result) {
        if (result.accountinfo !== undefined) {
            accountinfo = result.accountinfo;
        }
    });
    chrome.storage.local.get('dataconflict', function (result) {
        if (result.dataconflict !== undefined) {
            dataconflictoption = result.dataconflict;
        }
    });

    chrome.storage.local.get('namecheck', function (result) {
        if (result.namecheck !== undefined) {
            namecheckoption = result.namecheck;
        }
    });

    chrome.storage.local.get('livingnameexclude', function (result) {
        if (result.livingnameexclude !== undefined) {
            livingnameoption = result.livingnameexclude;
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

    chrome.storage.local.get('publicyearval', function (result) {
        if (result.publicyearval !== undefined) {
            publicyear = result.publicyearval;
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

    chrome.storage.local.get('privatecheck', function (result) {
        if (result.privatecheck !== undefined) {
            privatecheck = result.privatecheck;
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
            pregnancy = termlimit * (year / 12);
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

    chrome.storage.local.get('locationcheck', function (result) {
        if (result.locationcheck !== undefined) {
            locationcheckoption = result.locationcheck;
        }
    });

    chrome.storage.local.get('samenamecheck', function (result) {
        if (result.samenamecheck !== undefined) {
            samenameoption = result.samenamecheck;
        }
    });

    chrome.storage.local.get('compoundlast', function (result) {
        if (result.compoundlast !== undefined) {
            compoundlast = result.compoundlast;
        }
    });

    chrome.storage.local.get('addbiobutton', function (result) {
        if (result.addbiobutton !== undefined) {
            addbioonoff = result.addbiobutton;
        }
    });

    chrome.storage.local.get('exportprojectsbutton', function (result) {
        if (result.exportprojectsbutton !== undefined) {
            exportprojectsonoff = result.exportprojectsbutton;
        }
    });

    chrome.storage.local.get('geniconsistency', function (result) {
        if (result.geniconsistency !== undefined) {
            geniconsistency = result.geniconsistency;
        } else {
            chrome.storage.local.set({
                'geniconsistency': geniconsistency
            });
        }
        //Save as last option setting as it delays content execution
        getsettingsdone = true;
    });
}

initializeContent();
