//Development Global Variables
var devblocksend = false; //Blocks the sending data to Geni, prints output to console instead
var locationtest = false; //Verbose parsing of location data
var verboselogs = true;

//Common Global Variables
var profilechanged = false, loggedin = false, parentblock = false, submitcheck = true;
var geonotice = true, googlegeoquery = false, captcha = false, mnameonoff = true;
var accountinfo, parentspouseunion, genigender, geniliving, genifocusdata, google_api;
var focusURLid = "", focusname = "", focusrange = "", recordtype = "", smscorefactors = "", googlerequery = "";
var buildhistory = [], marriagedates = [], parentspouselist = [], siblinglist = [], addsiblinglist = [];
var genibuildaction = {}, updatecount = 1, updatetotal = 0;
var errormsg = "#f9acac", warningmsg = "#f8ff86", infomsg = "#afd2ff";

var _ = function(messageName, substitutions) {
    return chrome.i18n.getMessage(messageName, substitutions);
};



document.addEventListener('DOMContentLoaded', function () {
  Array.prototype.forEach.call(document.getElementsByTagName('*'), function (el) {
    if ( el.hasAttribute('data-i18n') ){
      var tranlation = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
      $(el).text(tranlation);
    }
  });
});

chrome.storage.local.get('buildhistory', function (result) {
    if (exists(result.buildhistory)) {
        buildhistory = result.buildhistory;
        buildHistoryBox();
    }
});

function buildHistoryBox() {
    var historytext = "";
    for (var i = 0; i < buildhistory.length; i++) {
        var name = buildhistory[i].id;
        if (exists(buildhistory[i].name)) {
            name = buildhistory[i].name;
        }
        var datetxt = "";
        if (exists(buildhistory[i].date)) {
            var day = new Date(buildhistory[i].date);
            datetxt = (("00" + (day.getMonth() + 1))).slice(-2) + "-" + ("00" + day.getDate()).slice(-2) + "@" + ("00" + day.getHours()).slice(-2) + ":" + ("00" + day.getMinutes()).slice(-2) + ": ";
            //moment(buildhistory[i].date).format("MM-DD@HH:mm") + ': ';
        }
        var focusprofileurl = "";
        if (exists(buildhistory[i].id)) {
            if (buildhistory[i].id.startsWith("profile-g")) {
                focusprofileurl = "https://www.geni.com/profile/index/" + buildhistory[i].id.replace("profile-g", "");
            } else {
                focusprofileurl = "https://www.geni.com/" + buildhistory[i].id;
            }
            if (exists(buildhistory[i].data)) {
                historytext += '<span class="expandhistory" name="history' + buildhistory[i].id + '" style="font-size: large; cursor: pointer;"><img src="images/dropdown.png" style="width: 11px;"></span> ' + datetxt + '<a href="' + focusprofileurl + '" target="_blank">' + name + '</a><br/>';
                historytext += formatJSON(buildhistory[i].data, "", buildhistory[i].id);
            } else {
                historytext += '<span style="padding-left: 2px; padding-right: 2px;">&#x25cf;</span> ' + datetxt + '<a href="' + focusprofileurl + '" target="_blank">' + name + '</a><br/>';
            }
        }
    }
    $("#historytext").html(historytext);
    $(function () {
        $('.expandhistory').on('click', function () {
            expandFamily($(this).attr("name"));
        });
    });
}

function formatJSON(datastring, historytext, id) {
    if (typeof datastring === 'string' && datastring.length > 0) {
        var p = JSON.parse(datastring);
        historytext = '<ul id="slidehistory' + id + '" style="display: none;">';
    } else {
        var p = datastring;
    }
    for (var key in p) {
        if (p.hasOwnProperty(key)) {
            if (key !== 'about_me') {
                if (typeof datastring === 'string') {
                    historytext += '<li>';
                }
                if (typeof p[key] === 'object') {
                    historytext += '<b>' + key + "</b>: " + formatJSON(p[key], "", "");

                } else {
                    historytext += '<b>' + key + "</b> -> " + p[key] + " ";
                }
                if (typeof datastring === 'string') {
                    historytext += '</li>';
                }
            }
        }
    }
    if (typeof datastring === 'string' && datastring.length > 0) {
        historytext += '</ul>';
    }
    return historytext;
}

function buildHistorySelect() {
    var historytext = "";
    for (var i = 0; i < buildhistory.length; i++) {
        var name = buildhistory[i].id;
        if (exists(buildhistory[i].name)) {
            name = buildhistory[i].name;
        }
        historytext += '<option value="' + buildhistory[i].id + '">History: ' + name + '</option>';
        if (i > 30) {
            break;
        }
    }
    return historytext;
}

var dateformatter = ["MMM YYYY", "MMMM YYYY", "MMM D YYYY", "MMMM D YYYY", "YYYY", "MM/ /YYYY", "D MMM YYYY"];
//noinspection JSUnusedGlobalSymbols
var expandparent = true; //used in expandAll function window[...] var call
//noinspection JSUnusedGlobalSymbols
var expandpartner = true; //same
//noinspection JSUnusedGlobalSymbols
var expandsibling = true; //same
//noinspection JSUnusedGlobalSymbols
var expandchild = true; //samet

document.addEventListener('DOMContentLoaded', function () {
    var version = chrome.runtime.getManifest().version;
    console.log(chrome.runtime.getManifest().name + " v" + version);
    $("#versionbox").html("SmartCopy v" + version);
    $("#versionbox2").html("SmartCopy v" + version);
    chrome.tabs.query({"currentWindow": true, "status": "complete", "windowType": "normal", "active": true}, function (tabs) {
        var tab = tabs[0];
        tablink = tab.url;
        loginProcess();
    });
});

var collections = new Array();
var collection;
function registerCollection(collection) {
  collections.push(collection);
}

function loginProcess() {
    if (geonotice) {
        setMessage(infomsg, "<h2>"+_("Notice___Please_Read") + "</h2><div style='text-align: justify;'>" +
            _("SmartCopy_will_no_longer_do_geo_location_lookups___", ["<img src='images/geooff.png' style='height: 14px; margin-bottom: -2px;'>"]) +
            "</div><br/><button id='closeGeoNotice'>" + _("Close") + "</button><br/><br/>");
        $('#loginspinner').hide();
        $('#closeGeoNotice').on('click', function () {
            geonotice = false;
            chrome.storage.local.set({'geonotice': geonotice});
            $("#message").css("display", "none");
            $('#loginspinner').show();
            loginProcess();
        });
        return
    }
    if (isGeni(tablink)) {
        document.querySelector('#message').style.display = "none";
        var focusprofile = getProfile(tablink);
        focusid = focusprofile.replace("?profile=", "");
        document.getElementById("addhistoryblock").style.display = "block";
        chrome.runtime.sendMessage({ "action" : "icon", "path": "images/icon.png" });
        updateLinks(focusprofile);
    }
    if (startsWithHTTP(tablink, "https://www.geni.com") && !isGeni(tablink)) {
        chrome.runtime.sendMessage({ "action" : "icon", "path": "images/icon.png" });
        $('#loginspinner').hide();
        $("#optionslide").show();
    } else if (!loggedin) {
        loadLogin();
    } else {
        chrome.runtime.sendMessage({ "action" : "icon", "path": "images/icon.png" });
        if (isGeni(tablink)) {
            userAccess();
        } else {
            // Select collection
            for (var i=0; i<collections.length; i++) {
                if (collections[i].collectionMatch(tablink)) {
                    collection = collections[i];
                    tablink = collection.prepareUrl(tablink);
                    recordtype = collection.recordtype;
                    if (collection.experimental) {
                        $("#experimentalmessage").css("display", "block");
                    }
                    console.log("Collection: " + recordtype);
                    break;
                }
            }

            // Parse data
            if (exists(collection) && collection.parseData) {
                console.log("Going to parse data now");
                collection.parseData(tablink);
            } else {
                console.log("Could not find collection on " + tablink);
                document.querySelector('#loginspinner').style.display = "none";
                setMessage(errormsg, 'SmartCopy does not currently support parsing this page / site / collection.');
            }
        }
    }
}

var slideopen = false;
$('#genislider').on('click', function () {
    if (slideopen) {
        $("body").animate({ 'max-width': "340px" }, 'slow');
        $(".genisliderow").not(".genihidden").slideToggle();
        $("#controlimage").slideUp();
        $(this).find("img")[0].src = "images/openmenu.png";
        $("#configtext").hide();
    } else {
       // $("body").animate({ 'max-width': "550px" }, 'slow');
        $("body").animate({ 'max-width': "500px" }, 'slow');
        $(".genisliderow").not(".genihidden").slideToggle();
        $("#controlimage").slideDown();
        $(this).find("img")[0].src = "images/closemenu.png";
        $("#configtext").show();
    }
    slideopen = !slideopen;
});

$("#checkdetailsopen").on("click", function () {
    $("#checkdetails").slideToggle();
});

function userAccess() {
    if (loggedin && exists(accountinfo)) {
        if (focusid === "" && tablink === "https://www.geni.com/family-tree") {
            focusid = accountinfo.id;
        }
        if (focusid !== "") {
            chrome.runtime.sendMessage({
                method: "GET",
                action: "xhttp",
                url: smartcopyurl + "/account?profile=" + focusid,
                variable: ""
            }, function (response) {
                document.querySelector('#loginspinner').style.display = "none";
                var responsedata = JSON.parse(response.source);
                var accessdialog = document.querySelector('#useraccess');
                accessdialog.style.display = "block";
                if (!responsedata.big_tree) {
                    setMessage(infomsg, '<strong>' + _('This_profile_is_not_in_the_World_Family_Tree') + '</strong>');
                    accessdialog.style.marginBottom = "-2px";
                }
                if (accountinfo.curator && responsedata.claimed && !responsedata.curator) {
                    if (!responsedata.user) {
                        $(accessdialog).html('<div style="padding-top: 2px;"><strong>This user has limited rights on SmartCopy.</strong></div><div style="padding-top: 6px;"><button type="button" id="grantbutton" class="cta cta-blue">Grant Tree-Building</button></div>' +
                            '<div>Granting tree-building rights will give this user the ability to add profiles to the Geni tree via SmartCopy.  If you notice they are not being responsible with the tool, you can revoke the rights.</div>');
                        document.getElementById('grantbutton').addEventListener('click', useradd, false);
                    } else {
                        if (responsedata.user.revoked == null) {
                            $(accessdialog).html('<div style="padding-top: 2px;"><strong>This user has tree-building rights on SmartCopy.</strong></div><div style="padding-top: 6px;"><button type="button" id="revokebutton" class="cta cta-red">Revoke Tree-Building</button></div>' +
                                '<div>Tree-building rights were granted by <a href="https://www.geni.com/' + responsedata.user.sponsor + '" target="_blank">' + responsedata.user.sname + '</a> on ' + responsedata.user.sponsordate + ' UTC</div>');
                            document.getElementById('revokebutton').addEventListener('click', userrevoke, false);
                        } else {
                            $(accessdialog).html('<div style="padding-top: 2px;"><strong>This user has limited rights on SmartCopy.</strong></div><div style="padding-top: 6px;"><button type="button" id="grantbutton" class="cta cta-yellow">Restore Tree-Building</button></div>' +
                                '<div>Tree-building rights were revoked by <a href="https://www.geni.com/' + responsedata.user.revoked + '" target="_blank">' + responsedata.user.rname + '</a> on ' + responsedata.user.revokedate + ' UTC</div>');
                            document.getElementById('grantbutton').addEventListener('click', userrestore, false);
                        }
                    }
                    chrome.runtime.sendMessage({
                        method: "GET",
                        action: "xhttp",
                        url: "https://www.geni.com/api/" + focusid + "&fields=name",
                        variable: ""
                    }, function (response) {
                        var responsedata = JSON.parse(response.source);
                        focusname = responsedata.name;
                    })
                } else {
                    $(accessdialog).html("<div style='font-size: 115%;'><strong>" + _("Research_this_Person") + "</strong></div>" + _("Loading___"));
                    buildResearch();
                }
            });
        } else {
            setMessage(warningmsg, "Invalid Profile Id - Try Again");
        }
    } else {
        setTimeout(userAccess, 50);
    }
}

function userrestore() {
    document.querySelector('#useraccess').style.display = "none";
    document.querySelector('#loginspinner').style.display = "block";
    var prefixurl = smartcopyurl + "/account?profile=" + focusid;
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: prefixurl + "&action=add_user",
        variable: ""
    }, function (response) {
        window.close();
    });
}

function useradd() {
    document.querySelector('#useraccess').style.display = "none";
    document.querySelector('#loginspinner').style.display = "block";
    var prefixurl = smartcopyurl + "/account?profile=" + focusid;
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: prefixurl + "&action=add_user",
        variable: ""
    }, function (response) {
    });
    chrome.tabs.query({"currentWindow": true, "status": "complete", "windowType": "normal", "active": true}, function (tabs) {
        var tab = tabs[0];
        chrome.tabs.update(tab.id, {url: "https://www.geni.com/threads/new/" + focusid.replace("profile-g", "") + "?return_here=true"}, function (tab1) {
            var listener = function(tabId, changeInfo, tab) {
                if (tabId == tab1.id && changeInfo.status === 'complete') {
                    // remove listener, so only run once
                    chrome.tabs.onUpdated.removeListener(listener);
                    chrome.tabs.executeScript(tab1.id, {
                        code: "document.getElementById('thread_subject').value='SmartCopy Invite';" +
                            "document.getElementById('msg_body').value='I have granted you tree-building rights with SmartCopy, which is a browser extension that " +
                            "allows Geni users to copy information and profiles from various sources into Geni.\\n\\n" +
                            "The extension can be downloaded here: https://historylink.herokuapp.com/smartcopy\\n" +
                            "More information and discussion can be found in the Geni project: https://www.geni.com/projects/SmartCopy/18783\\n\\n" +
                            "Before using SmartCopy, please read the cautionary notes in the Project Description. " +
                            "SmartCopy can be a powerful tool to help us build the world tree, but it could also quickly create duplication and introduce bad data - be responsible.\\n\\n" +
                            "*********************************************************\\n" +
                            "Users granted rights to SmartCopy are expected to review for and avoid creating duplicates, merge or delete profiles when duplicates are created, and attempt to work through relationship conflicts that may arise (get curator assistance if necessary).\\n" +
                            "*********************************************************" +
                            "';"
                    }, function () {
                        window.close();
                    })
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
    });
}

function userrevoke() {
    document.querySelector('#useraccess').style.display = "none";
    document.querySelector('#loginspinner').style.display = "block";
    var prefixurl = smartcopyurl + "/account?profile=" + focusid;
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: prefixurl + "&action=revoke_user",
        variable: ""
    }, function (response) {
        window.close();
    });
}

function startsWithMH(stringToCheck, query) {
    var searchPattern = new RegExp('^https?://www\.myheritage\..*?/' + query, 'i');
    return searchPattern.test(stringToCheck);
}

function updateLinks(focusprofile) {
    $("#historyurl").attr("href", "https://historylinktools.herokuapp.com/history" + focusprofile);
    $("#graphurl").attr("href", "https://historylinktools.herokuapp.com/graph" + focusprofile + "&color=gender");
    $("#descendanturl").attr("href", "https://historylinktools.herokuapp.com/graph" + focusprofile + "&type=descendant&color=gender");
}

chrome.runtime.onMessage.addListener(function (request, sender, callback) {
    if (request.action == "getSource") {
        loadPage(request);
    }
});

function loadPage(request) {
    if (!profilechanged) {
        if (collection.parseProfileData) {
            if (collection.loadPage) {
                if (exists(request.source)) {
                    collection.loadPage(request);
                } else {
                    document.getElementById("top-container").style.display = "block";
                    document.getElementById("submitbutton").style.display = "none";
                    document.getElementById("loading").style.display = "none";
                    console.log("Error trying to read: " + tablink);
                    var error = "";
                    if (exists(request.error)) {
                        if (typeof request.error === 'string' && request.error !== "") {
                            error = " Error: " + request.error;
                            console.log(error);
                        } else if (typeof request.error === 'object' && !$.isEmptyObject(request.error)) {
                            error = " Error: " + JSON.stringify(request.error);
                            console.log(error);
                        }
                    }
                    setMessage(warningmsg, 'SmartCopy is having difficulty reading the page.  Try refreshing the page.' + error);
                }
            }
            if (!profilechanged && focusURLid !== "") {
                for (var i = 0; i < buildhistory.length; i++) {
                    if (buildhistory[i].itemId === focusURLid) {
                        focusid = buildhistory[i].id;
                        profilechanged = true;
                        loadPage(request);
                        return;
                    }
                }
            }
            if (collection.parseProfileData && !profilechanged) {
                loadSelectPage(request);
            }
        } else {
            document.getElementById("top-container").style.display = "block";
            document.getElementById("submitbutton").style.display = "none";
            document.getElementById("loading").style.display = "none";
            setMessage(warningmsg, 'This website is not yet supported by SmartCopy.');
        }
    } else {
        document.getElementById("top-container").style.display = "block";
        if (focusid === "" || focusid === "Select from History") {
            var accessdialog = document.querySelector('#useraccess');
            accessdialog.style.marginBottom = "-2px";
            $(accessdialog).text("The URL or ID entered failed to resolve.");
            accessdialog.style.backgroundColor = errormsg;
            accessdialog.style.display = "block";
            focusid = null;
        }
        if (exists(focusid)) {
            if (collection.redirect) {
                var redirect = collection.redirect(request);
                if (redirect) {
                    return;
                }
            }
            $("#focusname").html('<span id="genilinkdesc"><a href="' + 'http://www.geni.com/' + focusid + '" target="_blank" style="color:inherit; text-decoration: none;">' + getProfileName(focusname) + "</a></span>");
            if (focusrange !== "") {
                $("#focusrange").text(focusrange);
            }
            var accessdialog = document.querySelector('#useraccess');
            accessdialog.style.display = "none";
            accessdialog.style.marginBottom = "12px";
            $(accessdialog).text("");
            accessdialog.style.backgroundColor = "#dfe6ed";

            var args = "fields=id,guid,name,title,first_name,middle_name,last_name,maiden_name,suffix,display_name,nicknames,gender,deleted,merged_into,birth,baptism,death,burial,cause_of_death,is_alive,public,occupation,photo_urls,marriage,divorce,locked_fields,match_counts&actions=update,update-basics,add,add-photo";
            var descurl = "https://www.geni.com/api/" + focusid + "/immediate-family?" + args + "&access_token=" + accountinfo.access_token;
            chrome.runtime.sendMessage({
                method: "GET",
                action: "xhttp",
                url: descurl
            }, function (response) {
                genifamily = JSON.parse(response.source);
                if (genifamily["error"]) {
                    document.getElementById("top-container").style.display = "block";
                    document.getElementById("submitbutton").style.display = "none";
                    document.getElementById("loading").style.display = "none";
                    setMessage(errormsg, 'SmartCopy was unable to retrieve the focus profile data from Geni.<br>Geni message: "' + genifamily["error"]["message"] + '"');
                    return;
                } else if (genifamily["focus"].merged_into) {
                    focusid = genifamily["focus"].merged_into.replace("https://www.geni.com/api/", "").trim();
                    loadPage(request);
                    return;
                } else if (genifamily["focus"].deleted){
                    focusid = "";
                    loadSelectPage(request);
                    return;
                }
                focusid = getFocus();
                buildParentSpouse(true);
                genifocusdata = genifamilydata[focusid];
                var permissions = genifocusdata.get("actions");
                if (!exists(permissions)) {
                    document.getElementById("top-container").style.display = "block";
                    document.getElementById("submitbutton").style.display = "none";
                    document.getElementById("loading").style.display = "none";
                    setMessage(errormsg, 'SmartCopy was unable to retrieve the focus profile data from Geni.');
                    return
                } else if (permissions.length === 0) {
                    document.getElementById("top-container").style.display = "block";
                    document.getElementById("submitbutton").style.display = "none";
                    document.getElementById("loading").style.display = "none";
                    setMessage(warningmsg, 'Geni replies that you have no permissions on the focus profile.  The profile may be private and inaccessible or you may need to reauthenticate SmartCopy on Geni. ' +
                        'You can reauthenticate by <a href="' + smartcopyurl + '/logout" target="_blank">clicking here</a> and rerunning SmartCopy.');
                    return
                }
                var matches = genifocusdata.get("match_counts");
                if (matches.tree_match > 0) {
                    $("#treematchurl").attr("href", "https://www.geni.com/search/matches?id=" + genifocusdata.get("guid") + "&src=smartcopy&cmp=btn");
                    $("#treematchcount").text(" " + matches.tree_match + " ");
                    $("#treematches").show();
                    if (!accountinfo.pro) {
                        $("#treematchtext").show();
                    }
                };
                //Update focusname again in case there is a merge_into
                $("#focusname").html('<span id="genilinkdesc"><a href="' + 'https://www.geni.com/' + focusid + '" target="_blank" style="color:inherit; text-decoration: none;">' + getProfileName(focusname) + "</a></span>");

                var byear = genifocusdata.get("birth", "date.year");
                var dyear = genifocusdata.get("death", "date.year");
                var dateinfo = "";

                if (byear !== "" || dyear !== "") {
                    dateinfo = " (";
                    if (exists(byear)) {
                        dateinfo += "b." + byear;
                        if (exists(dyear)) {
                            dateinfo += "-";
                        }
                    }
                    if (exists(dyear)) {
                        dateinfo += "d." + dyear;
                    }
                    dateinfo += ")";
                }
                genigender = genifocusdata.get("gender");
                geniliving = genifocusdata.get("is_alive");
                $("#genilinkdesc").attr('title', "Geni: " + genifocusdata.get("name") + dateinfo);

                console.log("Parsing Family...");
                // generic call
                if (collection.parseProfileData) {
                    collection.parseProfileData(request.source, true);
                } else {
                    setMessage(warningmsg, 'There was a problem with the collection - please report with link to page.');
                }
                if (!accountinfo.user || (exists(accountinfo.user.revoked) && accountinfo.user.revoked !== null)) {
                    //document.getElementById("loading").style.display = "none";
                    $("#familymembers").attr('disabled', 'disabled');
                    setMessage(warningmsg, 'Use of SmartCopy for copying Family Members to Geni is managed.  You may <a class="ctrllink" url="https://www.geni.com/discussions/147619">request this ability from a Curator</a>.');
                }
            });
        } else {
            loadSelectPage(request);
        }
    }
}

function loadSelectPage(request) {
    //document.getElementById("smartcopy-container").style.display = "none";
    document.getElementById("loading").style.display = "none";
    setMessage(infomsg, 'SmartCopy was unable to determine the Geni profile to use as a copy destination.<br/><br/>' +
        '<strong><span id="changetext" title="Select the profile on Geni that matches the focus person on this page.">Set Geni Destination Profile</span></strong>' +
        '<table style="width: 100%;"><tr><td colspan="2" style="width: 100%; font-size: 90%; text-align: left;"><strong><span id="optionrel" style="display: none;">Relatives &&nbsp;</span><span id="optionsc">SmartCopy&nbsp;</span>History:</strong></td></tr>' +
        '<tr id="optionrowldr"><td colspan="2" style="width: 100%; text-align: left; font-size: 90%; padding-left: 20px;">Loading Geni Relatives <img src="images/spinnerlg.gif" style="height: 16px; margin-bottom: -4px;"></td></tr>' +
        '<tr id="optionrow" style="display: none;"><td id="focusoption" style="width: 100%; text-align: left;"></td></tr>' +
        '<tr><td colspan="2" style="width: 100%; font-size: 90%; text-align: left;"><strong>Geni ID or URL:</strong></td></tr>' +
        '<tr><td style="padding-right: 5px;"><input type="text" style="width: 100%;" id="changeprofile"></td></tr>' +
        '<tr><td style="padding-top: 5px;"><button id="changefocus">Set Destination</button></td></tr></table>');
    var parsed = $('<div>').html(request.source.replace(/<img[^>]*>/ig, ""));
    var focusperson = parsed.find(".individualInformationName").text().trim();
    if (focusperson == "<Private>") {
        focusperson = parsed.find("#BreadcrumbsFinalText").text().trim();
    }
    var focusprofile = parsed.find(".individualInformationProfileLink").attr("href");
    if (exists(focusprofile) && focusprofile.contains("myheritage.com")) {
        focusprofile = null;
    }
    $('#changefocus').off();
    $('#changefocus').on('click', function () {
        changepersonevent();
    });
    $('#changeprofile').off();
    $('#changeprofile').on('keyup',  function(e) {
        var key=e.keyCode || e.which;
        if (key==13){
            changepersonevent();
        }
    });
    function changepersonevent() {
        var profilelink = getProfile($('#changeprofile')[0].value);
        if (profilelink === "") {
            var focusselect = $('#focusselect')[0];
            if (exists(focusselect)) {
                profilelink = "?profile=" + focusselect.options[focusselect.selectedIndex].value;
            }
        }
        if (profilelink !== "" || devblocksend) {
            updateLinks(profilelink);
            focusid = profilelink.replace("?profile=", "");
            document.querySelector('#message').style.display = "none";
            document.getElementById("smartcopy-container").style.display = "block";
            document.getElementById("loading").style.display = "block";
            profilechanged = true;
            loadPage(request);
        } else {
            var invalidtext = $("#changetext")[0];
            $(invalidtext).text("Invalid Profile Id - Try Again");
            invalidtext.style.color = 'red';
        }
    }
    if (exists(focusprofile)) {
        $('#optionrel').css("display", "inline-block");
        $('#optionsc').css("display", "none");
        focusprofile = focusprofile.replace("http://www.geni.com/", "").replace("https://www.geni.com/", "").trim();
        var args = "fields=id,guid,name,gender,deleted";
        var url = "https://www.geni.com/api/" + focusprofile + "/immediate-family?" + args + "&access_token=" + accountinfo.access_token;
        chrome.runtime.sendMessage({
            method: "GET",
            action: "xhttp",
            url: url
        }, function (response) {
            genifamily = JSON.parse(response.source);
            buildParentSpouse(false);
            var result = genifamilydata;
            result.sort(function (a, b) {
                var relA = a.get("relation"), relB = b.get("relation");
                if (relA < relB) //sort string ascending
                    return -1;
                if (relA > relB)
                    return 1;
                return 0; //default return value (no sorting)
            });
            var selectsrt = '<select id="focusselect" style="width: 100%;"><option>Select relative of ' + focusperson + '</option>';
            if (exists(result)) {
                selectsrt += '<option value="' + focusprofile + '">Self: ' + focusperson + '</option>';
                for (var key in result) if (result.hasOwnProperty(key)) {
                    var person = result[key];
                    if (exists(person) && person.get("relation") !== "self") {
                        selectsrt += '<option value="' + person.get("id") + '">' + capFL(person.get("relation")) + ": " + person.get("name") + '</option>';
                    }
                }
                if (buildhistory.length > 0) {
                    selectsrt += '<option disabled>&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;</option>';
                }
            }
            selectsrt += buildHistorySelect();
            selectsrt += '</select>';
            $('#optionrowldr').css("display", "none");
            $('#optionrow').css("display", "table-row");
            $($('#focusoption')[0]).html(selectsrt);
        });
    } else {
        var selectsrt = '<select id="focusselect" style="width: 100%;"><option>Select from History</option>';
        selectsrt += buildHistorySelect();
        selectsrt += '</select>';
        $('#optionrowldr').css("display", "none");
        $('#optionrow').css("display", "table-row");
        $($('#focusoption')[0]).html(selectsrt);
    }
}

function buildParentSpouse(finalid) {
    if (exists(genifamily)) {
        uniondata = [];
        genifamilydata = [];
        genispouse = [];
        var siblingsck = false;
        var parentsck = false;
        var parval = {male: 0, female: 0, unknown: 0};
        var sibval = {male: 0, female: 0, unknown: 0};
        var chval = {male: 0, female: 0, unknown: 0};
        var spval = {male: 0, female: 0, unknown: 0};
        var nodes = genifamily["nodes"];
        for (var node in nodes) {
            if (!nodes.hasOwnProperty(node)) continue;
            if (nodes[node].id.startsWith("union")) {
                uniondata[nodes[node].id] = nodes[node];
            } else if (!nodes[node].deleted) {
                var familymem = nodes[node];
                genifamilydata[familymem.id] = new GeniPerson(familymem);
                if (familymem.id === getFocus()) {
                    genifamilydata[familymem.id].set("relation", "self");
                    genifamilydata[familymem.id].set("status", "");
                    genifamilydata[familymem.id].set("union", "");
                }
            }
        }
        var parents = getParents();
        var siblings = getSiblings();
        var children = getChildren(getFocus());
        var partners = getPartners();
        genispouse = partners;
        for (var i=0; i < parents.length; i++) {
            parval = countGeniMem(parval, getGeniData(parents[i], "relation"));
            parentsck = true;
            if (finalid) {
                    document.getElementById("parentsearch").style.display = "none";
                }
                if (!parentblock) {
                    parentspouseunion = getGeniData(parents[i], "union");
                    parentblock = true;
                } else {
                    //If there are two parents - reset
                    parentspouselist = [];
                    parentblock = false;
                }
        }
        for (var i=0; i < siblings.length; i++) {
            sibval = countGeniMem(sibval, getGeniData(siblings[i], "relation"));
            siblingsck = true;
        }
        for (var i=0; i < children.length; i++) {
            chval = countGeniMem(chval, getGeniData(children[i], "relation"));
        }
        for (var i=0; i < partners.length; i++) {
            spval = countGeniMem(spval, getGeniData(partners[i], "relation"));
        }
        if (finalid) {
            buildGeniCount(parval, "parentcount");
            buildGeniCount(sibval, "siblingcount");
            buildGeniCount(spval, "partnercount");
            buildGeniCount(chval, "childcount");
        }
        if (!parentsck && siblingsck) {
            for (var i=0; i < siblings.length; i++) {
                parentspouseunion = getGeniData(siblings[i], "union");
                parentblock = true;
                break;
            }
        }
    }
}

function countGeniMem(val, rel) {
    if (isMale(rel)) {
        val.male += 1;
    } else if (isFemale(rel)) {
        val.female += 1;
    } else {
        val.unknown += 1;
    }
    return val;
}

function buildGeniCount(val, name) {
    if (val) {
        var genifmcount = "";
        if (val.male > 0) {
            genifmcount += " " + val.male + " <span class='malebox'></span>";
        }
        if (val.female > 0) {
            genifmcount += " " + val.female + " <span class='femalebox'></span>";
        }
        if (val.unknown > 0) {
            genifmcount += " " + val.unknown + " <span class='unknownbox'></span>";
        }
        if (genifmcount.length > 0) {
            genifmcount = " &mdash; Geni has" + genifmcount;
            $("#" + name).html(genifmcount);
        }
    }
}

function setMessage(color, messagetext) {
    let message = document.querySelector('#message');
    message.style.backgroundColor = color;
    message.style.display = "block";
    $(message).html(messagetext);
}

function updateMessage(color, messagetext) {
    let message = document.querySelector('#message');
    let color_before = message.style.backgroundColor
    message.style.backgroundColor = color;
    let color_after = message.style.backgroundColor
    if (color === errormsg && color_before !== color_after) {
        // if moving from warning to error then clear message
        $(message).empty()
    }
    message.style.display = "block";
    messagehtml = $(message).html();
    if (messagehtml.length > 0) {
        messagehtml = messagehtml + "<br>"
    }
    $(message).html(messagehtml + messagetext);
}

function getPageCode() {
    if (loggedin && exists(accountinfo)) {
        document.querySelector('#message').style.display = "none";
        document.querySelector('#loginspinner').style.display = "none";
        document.getElementById("smartcopy-container").style.display = "block";
        document.getElementById("loading").style.display = "block";

        if (collection.reload) {
            chrome.runtime.sendMessage({
                method: "GET",
                action: "xhttp",
                url: tablink
            }, function (response) {
                loadPage(response);
            });
        } else if (collection.parseProfileData) {
            chrome.tabs.executeScript(null, {
                file: "getPagesSource.js"
            }, function () {
                if (chrome.runtime.lastError) {
                    setMessage(errormsg, 'There was an error injecting script : \n' + chrome.runtime.lastError.message);
                }
            });
        }
    } else {
        setTimeout(getPageCode, 50);
    }
}

var loginprocessing = true;
var logincount = 0;
function loadLogin() {
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: smartcopyurl + "/accountlogin?version=" + chrome.runtime.getManifest().version
    }, function (responseText) {
        try {
            var response = JSON.parse(responseText.source);
        } catch(err) {
            console.log('Problem getting account information.');
            if (loginprocessing) {
                chrome.runtime.sendMessage({ "action" : "icon", "path": "images/icon_warn.png" });
                console.log("Logged Out... Redirecting to Geni for authorization.");
                loginprocessing = false;
                var frame = $("#loginframe");
                frame.attr('src', smartcopyurl + '/smartlogin');
                $("body").css('max-width', "640px");
                $("body").animate({ 'width': "640px" }, 'slow');
                frame.on("load", function(){
                    if (logincount > 0) {
                        loginProcess();
                    } else if (logincount === 0) {
                        $("#logindiv").slideDown();
                        document.getElementById("loginspinner").style.display = "none";
                    }
                    logincount++;
                });
            }
            return;
        }

        console.log("Logged In...");
        accountinfo = response;
        
        if (exists(accountinfo.google_key) && accountinfo.google_key !== "" && accountinfo.google_key !== "invalid") {
            //This allows the server to issue the Google API Key if they ever change their payment model to something reasonable
            google_api = accountinfo.google_key;
        }
        if (accountinfo.curator) {
            //display leaderboard link if user is a curator - page itself still verifies
            //document.getElementById("curator").style.display = "inline-block";
        }
        loggedin = true;
        if (!loginprocessing) {
            $("#logindiv").slideUp();
            document.getElementById("loginspinner").style.display = "block";
            if (!slideopen) {
                $("body").animate({ 'max-width': "340px" }, 'slow');
                $("body").animate({ 'width': "340px" }, 'slow');
                $("configtext").hide();
            } else {
                $("body").animate({ 'max-width': "500px" }, 'slow');
                $("body").animate({ 'width': "500px" }, 'slow');
                $("configtext").show();
            }
        }
        loginProcess();
    });
}

var exlinks = document.getElementsByClassName("expandlinks");

var expandAll = function () {
    var expandmembers = $(this).closest('div').find('.memberexpand');
    for (var i = 0; i < expandmembers.length; i++) {
        if (!exists(window[this.name])) {
            window[this.name] = true;
        }
        if (window[this.name]) {
            $(expandmembers[i]).slideDown();
            $(this).text("collapse all");
        } else {
            $(expandmembers[i]).slideUp();
            $(this).text("expand all");
        }
    }
    window[this.name] = !window[this.name];
};

for (var i = 0; i < exlinks.length; i++) {
    exlinks[i].addEventListener('click', expandAll, false);
}

function expandFamily(member) {
    $('#slide' + member).slideToggle();
}

var entityMap = {
    "& ": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;',
    "`": '&DiacriticalGrave;'
};

function escapeHtml(string) {
    return String(string).replace(/& |[<>"'`\/]/g, function (s) {
        return entityMap[s];
    });
}

function capFL(string) {   //Capitalize the first letter of the string
    return string.charAt(0).toUpperCase() + string.slice(1);
}

$(function () {
    $('.checkall').on('click', function () {
        var fs = $(this).closest('div').find('fieldset');
        var ffs = fs.find('[type="checkbox"]');
        if (!$(ffs[0]).prop("disabled")) {
            var photoon = $('#photoonoffswitch').prop('checked');
            ffs.filter(function (item) {
                if ($(ffs[item]).closest('tr').css("display") === "none") {
                    return false;
                }
                return !(!photoon && $(ffs[item]).hasClass("photocheck") && !this.checked);
            }).prop('checked', this.checked);
            var ffs = fs.find('input[type="text"],select,input[type="hidden"],textarea').not(".genislideinput").not(".parentselector");
            ffs.filter(function (item) {
                return !((ffs[item].type === "checkbox") || ($(ffs[item]).closest('tr').css("display") === "none") || (!photoon && $(ffs[item]).hasClass("photocheck") && !this.checked) || ffs[item].name === "action" || ffs[item].name === "profile_id");
            }).attr('disabled', !this.checked);
        }
    });
});

$(function () {
    $('#updateslide').on('click', function () {
        $('#profilefield').slideToggle();
    });
});

var showhistorycheck = true;
$(function () {
    $('#showhistory').on('click', function () {
        $('#historybox').slideToggle();
        showhistorycheck = !showhistorycheck;
        if (showhistorycheck) {
            $('#showhistory').text("Show History");
        } else {
            $('#showhistory').text("Hide History");
        }
    });
});

$(function () {
    $('#addhistory').on('click', function () {
        addHistory(focusid, tablink, getProfileName(focusname), "");
        buildHistoryBox();
    });
});

$(function () {
    $('#clearhistory').on('click', function () {
        buildhistory = [];
        chrome.storage.local.set({'buildhistory': buildhistory});
        buildHistoryBox();
    });
});

// ------------------ Form submission ---------------
var submitstatus = [];
var tempspouse = [];
var spouselist = [];
var parentlist = [];
var addchildren = [];
var photosubmit = [];
var focusphotoinfo = null;
var submitform = function () {
    if (parsecomplete && submitcheck) {
        document.getElementById("bottomsubmit").style.display = "none";
        document.getElementById("submitbutton").style.display = "none";
        submitcheck = false; //try to prevent clicking more than once and submitting it twice
        document.getElementById("familydata").style.display = "none";
        document.getElementById("profiledata").style.display = "none";
        document.getElementById("updating").style.display = "block";
        setMessage(warningmsg, 'Leaving this window before completion could result in an incomplete data copy.');

        var about = "";
        var sourcecheck = $('#sourceonoffswitch').prop('checked');
        var fs = $('#profiletable');
        var profileout = parseForm(fs);
        var profileupdatestatus = "";
        if (!$.isEmptyObject(profileout)) {
            updatetotal += 1;
        }
        var privateprofiles = $('.checkslide');
        for (var profile in privateprofiles) if (privateprofiles.hasOwnProperty(profile)) {
            var entry = privateprofiles[profile];
            if (exists(entry.name) && entry.name.startsWith("checkbox") && entry.checked) {
                updatetotal += 1;
            }
        }
        // --------------------- Update Profile Data ---------------------
        if (!$.isEmptyObject(profileout)) {
            $("#updatestatus").text("Update: " + getProfileName(focusname));
            if (exists(profileout["about_me"])) {
                about = profileout["about_me"];
                if (!about.endsWith("\n")) {
                    about += "\n";
                }
            }
            if (sourcecheck) {
                var refurl = tablink;
                if (exists(alldata["profile"].url)) {
                    refurl = alldata["profile"].url;
                }
                if (!focusabout.contains("Updated from [" + encodeURI(refurl) + " " + recordtype + "] by [http://www.geni.com/projects/SmartCopy/18783 SmartCopy]:") &&
                    !focusabout.contains("Updated from [" + encodeURI(refurl) + " " + recordtype + "] by [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]:") &&
                    !focusabout.contains("Reference: [" + encodeURI(refurl) + " " + recordtype + "] - [http://www.geni.com/projects/SmartCopy/18783 SmartCopy]:")) {
                    if (focusabout !== "") {
                        about = focusabout + "\n" + about;
                    }
                    if (about !== "") {
                        var splitabout = about.split("\n");
                        if (splitabout.length > 1 && splitabout[splitabout.length - 2].startsWith("* ")) {
                            if (!about.endsWith("\n")) {
                                about += "\n";
                            }
                            about += "*";
                        }
                    }
                    profileout["about_me"] = about + "* Reference: [" + encodeURI(refurl) + " " + recordtype + "] - [http://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''" + moment.utc().format("MMM D YYYY, H:mm:ss") + " UTC''\n";
                } else {
                    if (about !== "") {
                        profileout["about_me"] = focusabout + "\n" + about;
                    }
                }
            } else if (about !== "" && focusabout !== "") {
                profileout["about_me"] = focusabout + "\n" + about;
            }
            if (exists(profileout["nicknames"]) && focusnicknames !== "") {
                if (focusnicknames instanceof Array) {
                    focusnicknames = focusnicknames.join();
                }
                profileout["nicknames"] = focusnicknames + "," + profileout["nicknames"];
                profileout["nicknames"] = profileout["nicknames"].split(/\s*,\s*/);
            }
            if (exists(profileout.photo)) {
                if (tablink.indexOf('showRecord') !== -1) {
                    var shorturl = tablink.substring(0, tablink.indexOf('showRecord') + 10);
                } else {
                    var shorturl = tablink;
                }
                var description = "";
                if (exists(profileout.author) && profileout.author !== "") {
                    description = profileout.author + ", ";
                }
                focusphotoinfo = {photo: profileout.photo, title: getProfileName(focusname), attribution: description + "Source: " + shorturl};
                delete profileout.photo;
                delete profileout.author;
            }
            buildTree(profileout, "update", focusid);
            $("#updatestatus").text("Updating Profile");
            profileupdatestatus = "Updating Profile & ";
        }

        // --------------------- Add Family Data ---------------------
        for (var profile in privateprofiles) if (privateprofiles.hasOwnProperty(profile)) {
            var entry = privateprofiles[profile];
            if (exists(entry.name) && entry.name.startsWith("checkbox") && entry.checked) {
                fs = $("#" + entry.name.replace("checkbox", "slide"));

                var actionname = entry.name.split("-"); //get the relationship
                if (actionname[1] === "unknown") {
                    continue;
                }
                var familyout = parseForm(fs);
                var tempfamilyout = jQuery.extend(true, {}, familyout);
                delete tempfamilyout.profile_id;  //check to see if it's only the hidden profile_id
                if (!$.isEmptyObject(tempfamilyout)) {
                    var fdata = databyid[familyout.profile_id];
                    if (exists(fdata)) {
                        about = "";
                        if (exists(familyout["about_me"])) {
                            about = familyout["about_me"];
                        }
                        if (about !== "") {
                            var splitabout = about.split("\n");
                            if (splitabout.length > 1 && splitabout[splitabout.length - 2].startsWith("* ")) {
                                if (!about.endsWith("\n")) {
                                    about += "\n";
                                }
                                if (sourcecheck) {
                                    about += "*";
                                }
                            }
                        }
                        if (sourcecheck) {
                            var focusprofileurl = "";
                            if (focusid.startsWith("profile-g")) {
                                focusprofileurl = "https://www.geni.com/profile/index/" + focusid.replace("profile-g", "");
                            } else {
                                focusprofileurl = "https://www.geni.com/" + focusid;
                            }
                            about = about + "* Reference: [" + encodeURI(fdata.url) + " " + recordtype + "] - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''" + moment.utc().format("MMM D YYYY, H:mm:ss") + " UTC''\n";
                        }
                        if (about !== "") {
                            familyout["about_me"] = about;
                        }
                    }
                    if (exists(familyout.photo)) {
                        if (fdata.url.indexOf('showRecord') !== -1) {
                            var shorturl = fdata.url.substring(0, fdata.url.indexOf('showRecord') + 10);
                        } else {
                            var shorturl = fdata.url;
                        }
                        var description = "";
                        if (exists(familyout.author) && familyout.author !== "") {
                            description = familyout.author + ", ";
                        }
                        photosubmit[familyout.profile_id] = {photo: familyout.photo, title: fdata.name, attribution: description + "Source: " + shorturl};
                        delete familyout.photo;
                        delete familyout.author;
                    }
                    if (familyout.action === "add") {
                        delete familyout.action;
                        if (!isChild(actionname[1])) {
                            var statusaction = actionname[1];
                            if (statusaction === "sibling" || statusaction === "parent" || statusaction === "partner") {
                                statusaction += "s";
                            }
                            $("#updatestatus").text(profileupdatestatus + "Updating Family");
                            if (parentblock && isParent(statusaction)) {
                                parentspouselist.push(familyout);
                            } else if (isSibling(statusaction)) {
                                addsiblinglist.push(familyout);
                            } else {
                                buildTree(familyout, "add-" + actionname[1], focusid);
                                if (statusaction === "parents") {
                                    parentblock = true;
                                }
                            }
                        } else {
                            addchildren[familyout.profile_id] = familyout;
                        }
                    } else {
                        $("#updatestatus").text(profileupdatestatus + "Updating Family");
                        var pid = familyout.action;
                        delete familyout.action;
                        if (exists(fdata)) {
                            databyid[familyout.profile_id]["geni_id"] = pid;
                        }
                        var genidata;
                        if (exists(genifamilydata[pid])) {
                            genidata = genifamilydata[pid];
                        }
                        if (isPartner(actionname[1]) || isParent(actionname[1])) {
                            var unionid = getUnion(pid);
                            if (unionid !== "") {
                                spouselist[familyout.profile_id] = {union: unionid, status: "", genidata: genidata};
                            }
                        }
                        if ((exists(familyout["about_me"]) && familyout["about_me"] !== "") || (exists(familyout["nicknames"]) && familyout["nicknames"] !== "")) {
                            var abouturl = "https://www.geni.com/api/" + pid + "?fields=about_me,nicknames" + "&access_token=" + accountinfo.access_token;
                            submitstatus.push(updatetotal);
                            chrome.runtime.sendMessage({
                                method: "GET",
                                action: "xhttp",
                                url: abouturl,
                                variable: {pid: pid, familyout: familyout}
                            }, function (response) {
                                var geni_return = JSON.parse(response.source);
                                var familyout = response.variable.familyout;
                                if (!$.isEmptyObject(geni_return)) {
                                    if (exists(familyout["about_me"]) && exists(geni_return.about_me)) {
                                        familyout["about_me"] = geni_return.about_me + "\n" + familyout["about_me"];
                                    }
                                    if (exists(familyout["nicknames"]) && exists(geni_return.nicknames)) {
                                        if (geni_return instanceof Array) {
                                            geni_return.nicknames = geni_return.nicknames.join();
                                        }
                                        familyout["nicknames"] = geni_return.nicknames + "," + familyout["nicknames"];
                                    }
                                    if (exists(familyout["nicknames"])) {
                                        familyout["nicknames"] = familyout["nicknames"].split(/\s*,\s*/);
                                    }                                    
                                }
                                buildTree(familyout, "update", response.variable.pid);
                                submitstatus.pop();
                            });
                        } else {
                            buildTree(familyout, "update", pid);
                        }
                    }
                }
            }
        }
    }
    if (!exists(parentspouseunion) && !parentblock && addsiblinglist.length > 0) {
        //This allows it to get the union in case no parents exists
        buildTree(addsiblinglist.pop(), "add-sibling", focusid);
    }
    submitChildren();
};

function getUnion(profileid) {
    return getGeniData(profileid, "union");
}

var noerror = true;
function buildTree(data, action, sendid) {
    if (!$.isEmptyObject(data) && exists(sendid) && !devblocksend) {
        if (action !== "add-photo" && action !== "delete") {
            $("#updatetotal").text(updatetotal);
            $("#updatecount").text(Math.min(updatecount, updatetotal).toString());
        }
        submitstatus.push(updatetotal);
        var id = "";
        if (exists(data.profile_id)) {
            id = data.profile_id;
            delete data.profile_id;
        }
        var permissions = [];
        if (exists(genifamilydata[sendid])) {
            permissions = genifamilydata[sendid].get("actions");
        } else if (genifocusdata.get("id") === sendid || sendid.startsWith("union")) {
            permissions = genifocusdata.get("actions");
        } else {
            //New profile
            permissions = ["add-photo"];
        }

        if (action === "update") {
            if (permissions.indexOf("update") === -1 && permissions.indexOf("update-basics") !== -1) {
                action = "update-basics";
            }
        } else if (action.startsWith("add") && action !== "add-photo") {
            if (permissions.indexOf("add") === -1) {
                updateMessage(errormsg, "Geni permission denied - No add permission on: " + sendid);
                console.log("Geni permission denied - No add permission on profile: " + sendid);
                submitstatus.pop();
                return;
            }
        }
        var posturl = "https://www.geni.com/api/" + sendid + "/" + action +  "?fields=id,unions,name" + "&access_token=" + accountinfo.access_token;
        if (action === "add-photo" && permissions.indexOf("add-photo") === -1) {
            updateMessage(errormsg, "Geni permission to add photo denied on: " + sendid);
            console.log("Geni permission to add photo denied on: " + sendid);
            submitstatus.pop();
            return;
        }
        if (verboselogs) {
            console.log("Post URL: " + posturl);
            console.log("Post Data: " + JSON.stringify(data));
        }
        if (action !== "add-photo") {
            chrome.runtime.sendMessage({
                method: "POST",
                action: "xhttp",
                url: posturl,
                data: $.param(data),
                variable: {id: id, relation: action.replace("add-", ""), data: data}
            }, function (response) {
                try {
                    var result = JSON.parse(response.source);
                    if (verboselogs) {
                        console.log("Geni Response: " + response.source);
                    }
                    if (exists(result.error) && exists(result.error.message)) {
                        noerror = false;
                        updateMessage(errormsg, 'There was a problem updating Geni with a ' + response.variable.relation + '. ' + 'Error Response: "' + result.error.message + '"');
                    }
                } catch (e) {
                    noerror = false;
                    var extrainfo = "";
                    if (response.variable.relation === "photo") {
                        extrainfo = "The photo may be too large. "
                    }
                    updateMessage(errormsg, 'There was a problem updating Geni with a ' + response.variable.relation + '. ' + extrainfo + 'Error Response: "' + e.message + '"');
                    console.log(e); //error in the above string(in this case,yes)!
                    console.log(response.source);
                }
                var id = response.variable.id;
                var relation = response.variable.relation;
                if (exists(databyid[id])) {
                    var genidata;
                    if (exists(result.id)) {
                        databyid[id]["geni_id"] = result.id;
                    }
                    if (exists(genifamilydata[databyid[id]["geni_id"]])) {
                        genidata = genifamilydata[databyid[id]["geni_id"]];
                    } else {
                        genidata = new GeniPerson(result);
                    }
                    if (isPartner(relation) && exists(result.unions)) {
                        spouselist[id] = {union: result.unions[0].replace("https://www.geni.com/api/", ""), status: databyid[id].status, genidata: genidata};
                    } else if (isParent(relation) && exists(result.unions)) {
                        parentspouseunion = result.unions[0].replace("https://www.geni.com/api/", "");
                        if (parentlist.length > 0) {
                            if (exists(marriagedates[id]) || exists(marriagedates[parentlist[0]])){
                                spouselist[id] = {union: parentspouseunion, status: databyid[id].status, genidata: genidata};
                            }
                        } else {
                            parentlist.push(id);
                        }
                    } else if (isSibling(relation) && !exists(parentspouseunion)) {
                        parentspouseunion = result.unions[0].replace("https://www.geni.com/api/", "");
                    }
                    addHistory(result.id, databyid[id].itemId, getProfileName(databyid[id].name), JSON.stringify(response.variable.data));
                }
                if (action !== "add-photo" && action !== "delete") {
                    updatecount += 1;
                    $("#updatecount").text(Math.min(updatecount, updatetotal).toString());
                }
                submitstatus.pop();
            });
        } else {
            chrome.runtime.sendMessage({
                method: "POST",
                action: "xhttp",
                url: posturl,
                data: $.param(data),
                variable: {id: id, relation: action.replace("add-", ""), data: data}
            });
            submitstatus.pop();
        }
        
    } else if (!$.isEmptyObject(data) && exists(sendid) && devblocksend) {
        var permissions = [];
        if (exists(genifamilydata[sendid])) {
            permissions = genifamilydata[sendid].get("actions");
        } else if (genifocusdata.get("id") === sendid || sendid.startsWith("union")) {
            permissions = genifocusdata.get("actions");
        }
        if (action === "update") {
            if (permissions.indexOf("update") === -1 && permissions.indexOf("update-basics") !== -1) {
                action = "update-basics";
            }
        } else if (action.startsWith("add") && action !== "add-photo") {
            if (permissions.indexOf("add") === -1) {
                updateMessage(errormsg, "Permission denied - No add permission on: " + sendid);
                console.log("Permission denied - No add permission on profile: " + sendid);
                return;
            }
        }
        if (exists(data.profile_id)) {
            var id = data.profile_id;
            if (exists(databyid[id])) {
                databyid[id]["geni_id"] = sendid;
                var genidata;
                if (exists(genifamilydata[sendid])) {
                    genidata = genifamilydata[sendid];
                }
                spouselist[id] = {union: "union" + id, status: databyid[id].status, genidata: genidata};
                if (parentlist.length > 0) {
                    if (exists(marriagedates[id])) {
                        spouselist[id] = {union: "union" + id, status: databyid[id].mstatus, genidata: genidata};
                    } else if (exists(marriagedates[parentlist[0]])) {
                        var pid = parentlist[0];
                        spouselist[pid] = {union: "union" + pid, status: databyid[pid].mstatus, genidata: genidata};
                    } else {
                        console.log("No Parent");
                    }
                    console.log("Add Union: " + JSON.stringify(spouselist[id]));
                } else {
                    parentlist.push(id);
                }
            }
            delete data.profile_id;
        }
        console.log("-------------------");
        console.log("Action: " + action + " on " + sendid);
        console.log(JSON.stringify(data));
    }
}

var checkchildren = false;
var checkpictures = false;
var checkspouseunion = false;
var photocount = 0;
var photototal = 0;
var photoprogress = 0;
function submitChildren() {
    if (submitstatus.length > 0) {
        setTimeout(submitChildren, 50);
    } else if (!checkspouseunion) {
        checkspouseunion = true;
        if (parentspouselist.length > 0 && exists(parentspouseunion)) {
            for (var i = 0; parentspouselist.length > i; i++) {
                buildTree(parentspouselist[i], "add-partner", parentspouseunion);
            }

        }
        if (addsiblinglist.length > 0 && exists(parentspouseunion)) {
            for (var i = 0; addsiblinglist.length > i; i++) {
                buildTree(addsiblinglist[i], "add-child", parentspouseunion);
            }
        }
        submitChildren();
    } else if (!checkchildren) {
        checkchildren = true;
        if (spouselist.length > 0) {
            $("#updatestatus").text("Adding Spouse(s)");
        }
        var tempadded = [];
        for (var i = 0; i < addchildren.length; i++) {
            if (exists(addchildren[i])) {
                var childid = childlist[i];
                if (!exists(childid) || childid === -1) {
                    childid = 0;
                } else if (typeof childid == "string" && childid.startsWith("union")) {
                    continue;
                }
                if (!exists(tempadded[childid]) && !exists(spouselist[childid])) {
                    //Add a temp for each spouse which is a parent that is not added
                    buildTempSpouse(childid);
                    tempadded[childid] = "added";
                }
            }
        }
        for (var i = 0; i < spouselist.length; i++) {
            if (exists(spouselist[i])) {
                var spouseinfo = spouselist[i];
                var genidata = spouseinfo.genidata;
                var genimarriage;
                var genidivorce;
                var genistatus = "spouse";
                if (exists(genidata) && exists(genidata.person)) {
                    genistatus = genidata.get("status");
                    genimarriage = genidata.person.marriage;
                    genidivorce = genidata.person.divorce;
                }

                var marriageupdate = {};
                var status = "";

                if (spouseinfo.status === ("ex-partner")) {
                    status = "ex_partner";
                } else if (spouseinfo.status === "ex-spouse") {
                    status = "ex_spouse";
                } else if (spouseinfo.status === "partner") {
                    status = "partner";
                }
                if (status !== "") {
                    marriageupdate.status = status;
                }
                if (exists(marriagedates[i])) {
                    if (exists(marriagedates[i].marriage) && (!emptyEvent(marriagedates[i].marriage) || !emptyEvent(genimarriage))) {
                        if (status === "spouse" && genistatus !== "spouse") {
                            marriageupdate.status = genistatus;
                        }
                        marriageupdate.marriage = marriagedates[i].marriage;
                    }
                    if (exists(marriagedates[i].divorce) && (!emptyEvent(marriagedates[i].divorce) || !emptyEvent(genidivorce))) {
                        if (status === "spouse" && genistatus !== "spouse") {
                            marriageupdate.status = genistatus;
                        }
                        marriageupdate.divorce = marriagedates[i].divorce;
                    }
                }
                if (!$.isEmptyObject(marriageupdate) && !devblocksend) {
                    chrome.runtime.sendMessage({
                        method: "POST",
                        action: "xhttp",
                        url: "https://www.geni.com/api/" + spouseinfo.union + "/update" + "?access_token=" + accountinfo.access_token,
                        data: $.param(marriageupdate),
                        variable: ""
                    }, function (response) {
                    });
                    //Process the Union Update
                } else if (!$.isEmptyObject(marriageupdate) && devblocksend) {
                    console.log("Marriage Update: " + JSON.stringify(marriageupdate));
                }
            }
        }
        submitChildren();
    } else if (!checkpictures) {
        checkpictures = true;
        if (addchildren.length > 0) {
            $("#updatestatus").text("Adding Children");
        }
        // --------------------- Add Child Data ---------------------
        for (var child in addchildren) if (addchildren.hasOwnProperty(child)) {
            var familyout = addchildren[child];
            var clid = childlist[familyout.profile_id];
            var parentunion;
            if (!exists(clid) || clid === -1) {
                parentunion = spouselist[0].union;
            } else if (typeof clid == "string" && clid.startsWith("union")) {
                parentunion = clid;
            } else {
                parentunion = spouselist[clid].union;
            }
            if (exists(parentunion)) {
                buildTree(familyout, "add-child", parentunion);
            }
        }
        if (exists(focusphotoinfo) || photosubmit.length > 0) {
            if (exists(focusphotoinfo)) {
                photototal += 1;
            }
            for (var p = 0; p < photosubmit.length; p++) {
                if (exists(photosubmit[p]) && exists(databyid[p])) {
                    photototal += 1;
                }
            }
            photoprogress = photototal;
        }
        submitChildren();
    } else if (exists(focusphotoinfo) || photoprogress > 0) {
        photocount += 1;
        var photodialog = "1 Photo";
        if (photototal > 1) {
            photodialog = photototal + " Photos";
        }
        $("#updatestatus").text("Uploading " + photodialog);
        $("#updatetotal").text(photototal);
        $("#updatecount").text(Math.min(photocount, photototal).toString());
        if (exists(focusphotoinfo)) {
            buildTree(focusphotoinfo, "add-photo", focusid);
            focusphotoinfo = null;
            photoprogress -= 1;
        } else {
            for (var p = 0; p < photosubmit.length; p++) {
                if (exists(photosubmit[p]) && exists(databyid[p])) {
                    buildTree(photosubmit[p], "add-photo", databyid[p].geni_id);
                    photosubmit[p] = null;
                    photoprogress -= 1;
                    break;
                }
            }
        }
        submitChildren();
    } else {
        submitWait();
    }
}

function buildTempSpouse(parentid) {
    var tgender = reverseGender(focusgender);
    if (!devblocksend) {
        submitstatus.push(submitstatus.length);
        chrome.runtime.sendMessage({
            method: "POST",
            action: "xhttp",
            url: "https://www.geni.com/api/" + focusid + "/add-partner" + "?access_token=" + accountinfo.access_token,
            data: $.param({gender: tgender}),
            variable: {id: parentid}
        }, function (response) {
            var result = JSON.parse(response.source);
            if (exists(result.unions)) {
                spouselist[response.variable.id] = {union: result.unions[0].replace("https://www.geni.com/api/", ""), status: "partner", genidata: ""};
            }
            tempspouse[response.variable.id] = result.id;
            submitstatus.pop();
        });
    } else if (devblocksend) {
        //Dev testing code - give it some fake data so it doesn't fail
        spouselist[parentid] = {union: "union-58259268", status: "partner", genidata: ""};
    }
}

function submitWait() {
    if (submitstatus.length > 0) {
        setTimeout(submitWait, 50);
    } else {
        for (var i = 0; i < tempspouse.length; i++) {
            if (exists(tempspouse[i])) {
                buildTree("", "delete", tempspouse[i]);
            }
        }
        var focusprofileurl = "";
        if (focusid.startsWith("profile-g")) {
            focusprofileurl = "https://www.geni.com/profile/index/" + focusid.replace("profile-g", "");
        } else {
            focusprofileurl = "https://www.geni.com/" + focusid;
        }
        $("#updating").html('<div style="text-align: center; font-size: 110%;"><strong>Geni Tree Updated</strong></div>' +
            '<div style="text-align: center; padding:5px; color: #a75ccd">Reminder: Please review for duplicates<br>and merge when able.</div>' +
            '<div style="text-align: center; padding:5px;"><b>View Profile:</b> ' +
            '<a href="https://www.geni.com/family-tree/index/' + focusid.replace("profile-g", "") + '" target="_blank">tree view</a>, ' +
            '<a href="' + focusprofileurl + '" target="_blank">profile view</a></div>');
        if (noerror) {
            document.getElementById("message").style.display = "none";
            $('#updating').css('margin-bottom', "15px");
        }
        buildHistoryBox();
        console.log("Tree Updated...");
        if (devblocksend) {
            console.log("******** Dev Mode - Blocked Sending ********")
        }
    }
}

var slideoptions = function () {
    $('#optionslide').slideToggle();
};

document.getElementById('submitbutton').addEventListener('click', submitform, false);
document.getElementById('submitbutton2').addEventListener('click', submitform, false);
document.getElementById('optionbutton').addEventListener('click', slideoptions, false);


function parseForm(fs) {
    var objentry = {};
    var marentry = {};
    var diventry = {};
    var rawinput = fs.find('input[type="text"],select,input[type="hidden"],textarea').not(".genislideinput");
    var updatefd = (fs.selector === "#profiletable");
    var fsinput = rawinput.filter(function (item) {
        return (!$(rawinput[item]).closest('tr').hasClass("geohidden"));
    });
    for (var item in fsinput) if (fsinput.hasOwnProperty(item)) {
        if (exists(fsinput[item].value) && !fsinput[item].disabled && getProfileName(fsinput[item].name) !== "") {
            //console.log(fsinput[item].name + ":" + fsinput[item].value);
            var splitentry = fsinput[item].name.split(":");
            if (splitentry.length > 1) {
                if (splitentry[1] === "date") {
                    var vardate = parseDate(fsinput[item].value, updatefd);

                    if (!$.isEmptyObject(vardate)) {
                        var finalentry = {};
                        finalentry[splitentry[1]] = vardate;
                        if (splitentry[0] === "divorce") {
                            if (!exists(diventry[splitentry[0]])) {
                                diventry[splitentry[0]] = {};
                            }
                            $.extend(diventry[splitentry[0]], finalentry);
                        } else if (splitentry[0] !== "marriage") {
                            if (!exists(objentry[splitentry[0]])) {
                                objentry[splitentry[0]] = {};
                            }
                            $.extend(objentry[splitentry[0]], finalentry);
                        } else {
                            if (!exists(marentry[splitentry[0]])) {
                                marentry[splitentry[0]] = {};
                            }
                            $.extend(marentry[splitentry[0]], finalentry);
                        }
                    }
                } else if (splitentry[1] === "location" && splitentry.length > 2) {
                    if (fsinput[item].value !== "" || updatefd) {
                        var varlocation = {};
                        var fieldname = splitentry[2];
                        if (fieldname === "place_name_geo") {
                            fieldname = "place_name";
                        }
                        varlocation[fieldname] = fsinput[item].value;
                        if (!$('#geoonoffswitch').prop('checked') && !exists(varlocation['latitude']) && !exists(varlocation['longitude'])) {
                            varlocation['latitude'] = 0;
                            varlocation['longitude'] = 0;
                        }
                        if (splitentry[0] === "divorce") {
                            if (!exists(diventry[splitentry[0]])) {
                                diventry[splitentry[0]] = {};
                            }
                            if (!exists(diventry[splitentry[0]][splitentry[1]])) {
                                diventry[splitentry[0]][splitentry[1]] = {};
                            }
                            $.extend(diventry[splitentry[0]][splitentry[1]], varlocation);
                        } else if (splitentry[0] !== "marriage") {
                            if (!exists(objentry[splitentry[0]])) {
                                objentry[splitentry[0]] = {};
                            }
                            if (!exists(objentry[splitentry[0]][splitentry[1]])) {
                                objentry[splitentry[0]][splitentry[1]] = {};
                            }
                            $.extend(objentry[splitentry[0]][splitentry[1]], varlocation);
                        } else {
                            if (!exists(marentry[splitentry[0]])) {
                                marentry[splitentry[0]] = {};
                            }
                            if (!exists(marentry[splitentry[0]][splitentry[1]])) {
                                marentry[splitentry[0]][splitentry[1]] = {};
                            }
                            $.extend(marentry[splitentry[0]][splitentry[1]], varlocation);
                        }
                    }
                }
            } else {
                if (fsinput[item].name === "action") {
                    updatefd = (fsinput[item].value !== "add");
                    objentry[fsinput[item].name] = fsinput[item].options[fsinput[item].selectedIndex].value;
                } else if (fsinput[item].name === "gender") {
                    if (exists(fsinput[item].options[fsinput[item].selectedIndex])) {
                        objentry[fsinput[item].name] = fsinput[item].options[fsinput[item].selectedIndex].value;
                    }
                } else if (fsinput[item].name === "parent") {
                    if (exists(fsinput[item].options[fsinput[item].selectedIndex])) {
                        childlist[objentry.profile_id] = fsinput[item].options[fsinput[item].selectedIndex].value;
                    }
                } else if (fsinput[item].value !== "" || updatefd) {
                    objentry[fsinput[item].name] = fsinput[item].value;
                    if (fsinput[item].name === "photo" && $(fsinput[item]).attr("author")) {
                        objentry["author"] = $(fsinput[item]).attr("author");
                    }
                }
            }
        }
        //var entry = focusprofile[profile];
        //console.log(entry);
    }
    if (!$.isEmptyObject(marentry) || !$.isEmptyObject(diventry)) {
        if (!$.isEmptyObject(marentry) && !$.isEmptyObject(diventry)) {
            marentry["divorce"] = diventry["divorce"];
        } else if (!$.isEmptyObject(diventry)) {
            marentry = diventry;
        }
        marriagedates[objentry.profile_id] = marentry;
    }
    return objentry;
}

function parseDate(fulldate, update) {
    var vardate = {};
    if (update) {
        vardate["circa"] = false;
        vardate["range"] = "";
        vardate["day"] = "";
        vardate["month"] = "";
        vardate["year"] = "";
        vardate["end_circa"] = "";
        vardate["end_day"] = "";
        vardate["end_month"] = "";
        vardate["end_year"] = "";
    }

    if (fulldate.startsWith("Circa")) {
        vardate["circa"] = true;
        fulldate = fulldate.replace("Circa ", "");
    }
    if (fulldate.startsWith("After")) {
        vardate["range"] = "after";
        fulldate = fulldate.replace("After ", "");
        if (fulldate.startsWith("Circa")) {
            vardate["circa"] = true;
            fulldate = fulldate.replace("Circa ", "");
        }
    } else if (fulldate.startsWith("Before")) {
        vardate["range"] = "before";
        fulldate = fulldate.replace("Before ", "");
        if (fulldate.startsWith("Circa")) {
            vardate["circa"] = true;
            fulldate = fulldate.replace("Circa ", "");
        }
    } else if (fulldate.startsWith("Between")) {
        vardate["range"] = "between";
        fulldate = fulldate.replace("Between ", "");
        if (fulldate.startsWith("Circa")) {
            vardate["circa"] = true;
            fulldate = fulldate.replace("Circa ", "");
        }
        var btsplit = fulldate.split(" and ");
        if (btsplit.length > 1) {
            fulldate = btsplit[0];
            if (btsplit[1].startsWith("Circa ")) {
                vardate["end_circa"] = true;
                btsplit[1] = btsplit[1].replace("Circa ", "").trim();
            }
            var dt = moment(btsplit[1].trim(), getDateFormat(btsplit[1].trim()));
            if (isNaN(btsplit[1])) {
                var splitd = btsplit[1].split(" ");
                if (splitd.length > 2) {
                    vardate["end_day"] = dt.get('date');
                    vardate["end_month"] = dt.get('month') + 1; //+1 because, for some dumb reason, months are indexed to 0
                } else {
                    vardate["end_month"] = dt.get('month') + 1; //+1 because, for some dumb reason, months are indexed to 0
                }
            }
            if (dt.get('year') !== 0) {
                vardate["end_year"] = dt.get('year');
            }
        }
    }
    var dt = moment(fulldate.trim(), getDateFormat(fulldate.trim()));
    //TODO Probably need to do some more checking below to make sure it doesn't improperly default dates
    if (isNaN(fulldate)) {
        var splitd = [];
        if (fulldate.contains("-")) {
            splitd = fulldate.split("-");
        } else {
            splitd= fulldate.split(" ");
        }
        if (splitd.length > 2) {
            vardate["day"] = dt.get('date');
            vardate["month"] = dt.get('month') + 1; //+1 because, for some dumb reason, months are indexed to 0
        } else {
            vardate["month"] = dt.get('month') + 1; //+1 because, for some dumb reason, months are indexed to 0
        }
    }
    if (dt.get('year') !== 0) {
        vardate["year"] = dt.get('year');
    }
    return vardate;
}

function getDateFormat(valdate) {
    var dateformat = dateformatter;
    if (exists(valdate)) {
        if (valdate.trim().search(/\d{4}-\d{2}/) !== -1) {
            dateformat = "YYYY-MM-DD";
        } else if ((valdate.trim().search(/\d{2}-\d{4}/) !== -1) || (valdate.trim().search(/\d{1}-\d{1}-\d{4}/) !== -1)) {
            var datesplit = valdate.split("-");
            //assume a MM-DD-YYYY format
            if (parseInt(datesplit[0]) > 12) {
                dateformat = "DD-MM-YYYY";
            } else {
                dateformat = "MM-DD-YYYY";
            }
        }
    }
    return dateformat;
}

function dateAmbigous(valdate) {
    if (getDateFormat(valdate) === "MM-DD-YYYY") {
        var datesplit = valdate.split("-");
        if (parseInt(datesplit[1]) < 13) {
            return true;
        }
    }
    return false;
}

function addHistory(id, itemId, name, data) {
    if (exists(id)) {
        buildhistory.unshift({id: id, itemId: itemId, name: name, date: Date.now(), data: data});
        if (buildhistory.length > 100) {
            buildhistory.pop();
        }
        chrome.storage.local.set({'buildhistory': buildhistory});
    }
}

function getParameterByName(name, url) {
    if (exists(url)) {
        url = url.replace(/&amp;/g, "&");
        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(url);
        return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    }
    return null;
}

function relationshipToHead(focusrel, relationship) {
    //console.log(focusrel + ":" + relationship);
    if (focusrel === "notfound" && relationship !== "notfound") {
        return "unknown";
    } else if (relationship === "notfound") {
        return relationship;
    } else if (focusrel === "head" || focusrel === "self") {
        if (isChild(relationship) || isPartner(relationship) || isParent(relationship) || isSibling(relationship)) {
            return relationship;
        } else if (relationship !== "") {
            return "exclude";
        }
    } else if (isChild(focusrel)) {
        if (relationship === "head" || relationship === "self") {
            return "parent";
        } else if (isChild(relationship)) {
            return "sibling";
        } else if (isPartner(relationship)) {
            return "parent";
        } else if (relationship !== "") {
            return "exclude";
        }
    } else if (isPartner(focusrel)) {
        if (relationship === "head" || relationship === "self") {
            return "spouse";
        } else if (isChild(relationship)) {
            return relationship;
        } else if (relationship.contains("-in-law")) {
            return relationship.replace("-in-law", "");
        } else if (relationship !== "") {
            return "exclude";
        }
    } else if (isParent(focusrel)) {
        if (relationship === "head" || relationship === "self") {
            return "child";
        } else if (isParent(relationship)) {
            return "spouse";
        } else if (relationship !== "") {
            return "exclude";
        }
    } else if (isSibling(focusrel)) {
        if (relationship === "head" || relationship === "self") {
            return "sibling";
        } else if (relationship !== "") {
            return "exclude";
        }
    } else if (focusrel.contains("-in-law")) {
        var focusinlaw = focusrel.replace("-in-law", "");
        if (isPartner(relationship)) {
            return reverseRelationship(focusinlaw);
        } else if (relationship.contains("-in-law")) {
            var relationinlaw = relationship.replace("-in-law", "");
            if (!isChild(relationinlaw)) {
                return relationshipToHead(focusinlaw, relationinlaw);
            }
        } else if (relationship !== "") {
            return "exclude";
        }
    } else if (focusrel !== "" && focusrel !== "unknown") {
        return "exclude";
    }
    return "unknown";
}

// ----- Persistent Options -----
$(function () {
    $('#privateonoffswitch').on('click', function () {
        chrome.storage.local.set({'autoprivate': this.checked});
        var profilegroup = $('.checkall');
        for (var group in profilegroup) if (profilegroup.hasOwnProperty(group)) {
            if (profilegroup[group].checked) { //only check it if the section is checked
                var privateprofiles = $(profilegroup[group]).closest('div').find('.checkslide');
                for (var profile in privateprofiles) if (privateprofiles.hasOwnProperty(profile)) {
                    if (exists(privateprofiles[profile]) && exists(privateprofiles[profile].name) && privateprofiles[profile].name.startsWith("checkbox")) {
                        if ($(privateprofiles[profile]).next().text().startsWith("\<Private\>")) {
                            $(privateprofiles[profile]).prop('checked', !this.checked);
                            var fs = $("#" + privateprofiles[profile].name.replace("checkbox", "slide"));
                            fs.find('[type="checkbox"]').prop('checked', !this.checked);
                            fs.find('input[type="text"]').not(".genislideinput").attr('disabled', this.checked);
                        }
                    }
                }
            }
        }
    });
    $('#geoapi_save').on('click', function() {
        var api_value = $("#google_api_key").val();
        if (exists(api_value) && api_value.length > 0) {
            var url = "https://maps.googleapis.com/maps/api/geocode/json?language=en&key=" + api_value + "&address=New York, New York, USA";
            chrome.runtime.sendMessage({
                method: "GET",
                action: "xhttp",
                url: url,
                variable: {api_value: api_value}
            }, function (response) {
                var result = JSON.parse(response.source);
                if (exists(result.error_message)) {
                    google_api = "";
                    googlegeoquery = false;
                    $("#geo_location_type").text("(Geni post-submission)");
                    $("#geocheckimage").css("display", "none");
                    alert("Google Response: " + result.error_message);
                } else {
                    google_api = response.variable.api_value;
                    googlegeoquery = true;
                    $("#geocheckimage").css("display", "block");
                    $("#geo_location_type").text("(Google pre-submission)");
                }
                chrome.storage.local.set({'google_key': google_api});
            });
        } else {
            google_api = "";
            googlegeoquery = false;
            $("#geo_location_type").text("(Geni post-submission)");
            $("#geocheckimage").css("display", "none");
            chrome.storage.local.set({'google_key': google_api});
        }
    });

    chrome.storage.local.get('google_key', function (result) {
        var google_api_key = result.google_key;
        if (exists(google_api_key) && google_api_key !== "") {
            google_api = google_api_key;
            googlegeoquery = true;
            $("#google_api_key").val(google_api);
            $("#geocheckimage").css("display", "block");
            $("#geo_location_type").text("(Google pre-submission)");
        } else {
            google_api = "";
            googlegeoquery = false;
            $("#google_api_key").val("");
            $("#geocheckimage").css("display", "none");
            $("#geo_location_type").text("(Geni post-submission)");
        }
    });
    $('#geoonoffswitch').on('click', function () {
        chrome.storage.local.set({'autogeo': this.checked});
        geoonoff(this.checked);
        hideempty($('#hideemptyonoffswitch').prop('checked'));
    });
    $('#consistencyonoffswitch').on('click', function () {
        chrome.storage.local.set({'geniconsistency': this.checked});
        if (this.checked) {
            $("#consistencyoptiontable").slideDown();
        } else {
            $("#consistencyoptiontable").slideUp();
        }
    });
    $('#forcegeoswitch').on('click', function () {
        chrome.storage.local.set({'forcegeo': this.checked});
        $("#forcegeochange").css("display", "block");
    });
    $('#namecheckonoffswitch').on('click', function () {
        chrome.storage.local.set({'namecheck': this.checked});
    });
    $('#livingcheckonoffswitch').on('click', function () {
        chrome.storage.local.set({'livingnameexclude': this.checked});
    });
    $('#siblingonoffswitch').on('click', function () {
        chrome.storage.local.set({'siblingcheck': this.checked});
    });
    $('#wedlockonoffswitch').on('click', function () {
        chrome.storage.local.set({'wedlockcheck': this.checked});
    });
    $('#agelimiterror').on('change', function () {
        chrome.storage.local.set({'agelimiterror': this.value});
    });
    $('#agelimitwarn').on('change', function () {
        chrome.storage.local.set({'agelimitwarn': this.value});
    });
    $('#publicyearval').on('change', function () {
        chrome.storage.local.set({'publicyearval': this.value});
    });
    $('#termlimit').on('change', function () {
        chrome.storage.local.set({'termlimit': this.value});
    });
    $('#childyoungwarn').on('change', function () {
        chrome.storage.local.set({'birthyoung': this.value});
    });
    $('#childoldwarn').on('change', function () {
        chrome.storage.local.set({'birthold': this.value});
    });
    $('#marriedyoungwarn').on('change', function () {
        chrome.storage.local.set({'marriageyoung': this.value});
    });
    $('#spouseagediff').on('change', function () {
        chrome.storage.local.set({'marriagedif': this.value});
    });
    $('#childrenonoffswitch').on('click', function () {
        chrome.storage.local.set({'childcheck': this.checked});
        if (this.checked) {
            $("#childoptions").slideDown();
        } else {
            $("#childoptions").slideUp();
        }
    });
    $('#selfonoffswitch').on('click', function () {
        chrome.storage.local.set({'selfcheck': this.checked});
        if (this.checked) {
            $("#selfoptions").slideDown();
        } else {
            $("#selfoptions").slideUp();
        }
    });
    $('#ageonoffswitch').on('click', function () {
        chrome.storage.local.set({'agecheck': this.checked});
    });
    $('#publiconoffswitch').on('click', function () {
        chrome.storage.local.set({'privatecheck': this.checked});
    });
    $('#samenameonoffswitch').on('click', function () {
        chrome.storage.local.set({'samenamecheck': this.checked});
    });
    $('#dataconflictonoffswitch').on('click', function () {
        chrome.storage.local.set({'dataconflict': this.checked});
    });
    $('#datecheckonoffswitch').on('click', function () {
        chrome.storage.local.set({'datecheck': this.checked});
    });
    $('#locationcheckonoffswitch').on('click', function () {
        chrome.storage.local.set({'locationcheck': this.checked});
    });
    $('#addbioonoffswitch').on('click', function () {
        chrome.storage.local.set({'addbiobutton': this.checked});
        $("#addbiochange").css("display", "block");
    });
    $('#partneronoffswitch').on('click', function () {
        chrome.storage.local.set({'partnercheck': this.checked});
        if (this.checked) {
            $("#partneroptions").slideDown();
        } else {
            $("#partneroptions").slideUp();
        }
    });
    $('#genislideonoffswitch').on('click', function () {
        chrome.storage.local.set({'genislideout': this.checked});
        if (this.checked) {
            $("body").css('max-width', "500px");
            $("#genislider").find("img")[0].src = "images/closemenu.png";
            $("#controlimage").slideDown();
            slideopen = this.checked;
        }
    });

    $('#birthonoffswitch').on('click', function () {
        chrome.storage.local.set({'autobirth': this.checked});
        var profilegroup = $('.checkall');
        for (var group in profilegroup) if (profilegroup.hasOwnProperty(group)) {
            if (profilegroup[group].id === "addchildck" || profilegroup[group].id === "addsiblingck") {
                var privateprofiles = $(profilegroup[group]).closest('div').find('.checkslide');
                for (var profile in privateprofiles) if (privateprofiles.hasOwnProperty(profile)) {
                    if (exists(privateprofiles[profile]) && exists(privateprofiles[profile].name) && privateprofiles[profile].name.startsWith("checkbox")) {
                        var fs = $("#" + privateprofiles[profile].name.replace("checkbox", "slide"));
                        var lname = fs.find('[name="last_name"]')[0];
                        var bname = fs.find('[name="maiden_name"]')[0];
                        if (this.checked) {
                            if (bname.value === "") {
                                bname.value = lname.value;
                            }
                        } else {
                            if (bname.value === lname.value) {
                                bname.value = "";
                            }
                        }
                    }
                }
            } else if (profilegroup[group].id === "addparentck" || profilegroup[group].id === "addpartnerck") {
                var privateprofiles = $(profilegroup[group]).closest('div').find('.checkslide');
                for (var profile in privateprofiles) if (privateprofiles.hasOwnProperty(profile)) {
                    if (exists(privateprofiles[profile]) && exists(privateprofiles[profile].name) && privateprofiles[profile].name.startsWith("checkbox")) {
                        var fs = $("#" + privateprofiles[profile].name.replace("checkbox", "slide"));
                        var genderobj = fs.find('[name="gender"]')[0];
                        var gender = genderobj.options[genderobj.selectedIndex].value;
                        if (gender === "male") {
                            var lname = fs.find('[name="last_name"]')[0];
                            var bname = fs.find('[name="maiden_name"]')[0];
                            if (this.checked) {
                                if (bname.value === "") {
                                    bname.value = lname.value;
                                }
                            } else {
                                if (bname.value === lname.value) {
                                    bname.value = "";
                                }
                            }
                        }
                    }
                }
            }
        }
    });
    $('#mnameonoffswitch').on('click', function () {
        chrome.storage.local.set({'automname': this.checked});
        mnameonoff = this.checked;
        var profilegroup = $('.checkall');
        for (var group in profilegroup) if (profilegroup.hasOwnProperty(group)) {
            var privateprofiles = $(profilegroup[group]).closest('div').find('.checkslide');
            for (var profile in privateprofiles) if (privateprofiles.hasOwnProperty(profile)) {
                if (exists(privateprofiles[profile]) && exists(privateprofiles[profile].name) && privateprofiles[profile].name.startsWith("checkbox")) {
                    if (exists($(privateprofiles[profile]).next()[0])) {
                        var name = NameParse.parse($(privateprofiles[profile]).next()[0].text, this.checked);
                        var fs = $("#" + privateprofiles[profile].name.replace("checkbox", "slide"));
                        var fname = fs.find('[name="first_name"]')[0];
                        var mname = fs.find('[name="middle_name"]')[0];
                        fname.value = name.firstName;
                        mname.value = name.middleName;

                    }
                }
            }

        }
    });
    $('#adjustnameonoffswitch').on('click', function () {
        chrome.storage.local.set({'adjustname': this.checked});
        $("#casenamechange").css("display", "block");
    });
    $('#compountlastonoffswitch').on('click', function () {
        chrome.storage.local.set({'compoundlast': this.checked});
        $("#compoundlast").css("display", "block");
    });
    $('#sourceonoffswitch').on('click', function () {
        chrome.storage.local.set({'addsource': this.checked});
    });
    $('#photoonoffswitch').on('click', function () {
        if (this.checked) {
            $("#photochange").css("display", "block");
        }
        chrome.storage.local.set({'addphoto': this.checked});
    });
    $('#geniparentonoffswitch').on('click', function () {
        chrome.storage.local.set({'geniparent': this.checked});
        $("#gparentchange").css("display", "block");
    });
    $('#privacyonoffswitch').on('click', function () {
        chrome.storage.local.set({'privacy': this.checked});
        $("#privacychange").css("display", "block");
    });
    $('#burialonoffswitch').on('click', function () {
        chrome.storage.local.set({'burialdate': this.checked});
        $("#burialchange").css("display", "block");
    });
    $('#hideemptyonoffswitch').on('click', function () {
        chrome.storage.local.set({'hideempty': this.checked});
        if (!this.checked) {
            document.getElementById("profiledata").style.display = "block";
        } else if (hideprofile) {
            document.getElementById("profiledata").style.display = "none";
        }
        hideempty(this.checked);
    });
    function hideempty(value) {
        if (value) {
            $('#formdata').find(".hiddenrow").css("display", "none");
            $('.showhide').attr("src", "images/show.png");
            $('.showhide').attr("title", "Show All Fields");
        } else {
            $('#formdata').find(".hiddenrow").css("display", "table-row");
            $('.showhide').attr("src", "images/hide.png");
            $('.showhide').attr("title", "Hide Unused Fields");
            geoonoff($('#geoonoffswitch').prop('checked'));
        }
    }

    var modal = document.getElementById('GeoUpdateModal');
    var modal2 = document.getElementById('AboutModal');

    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
        if (event.target == modal2) {
            modal2.style.display = "none";
        }
    };
    var firefox = (navigator.userAgent.toLowerCase().indexOf('firefox') > -1);
    var ffscrollcheck = null;
    var isDragging = false;
    if (firefox) {
        //Firefox jump to top bug
        $(window).mousedown(function(event) {
            ffscrollcheck = $(window).scrollTop();
            isDragging = false;
        });
        $(window).mousemove(function(event) {
            isDragging = true;
        });
        $(window).mouseup(function(event) {
            isDragging = false;
        });
        window.onwheel = function(event) {
            ffscrollcheck = null;
        }
        $(window).scroll(function() {
            if(ffscrollcheck && !isDragging && $(window).scrollTop() === 0) {
                $(window).scrollTop(ffscrollcheck);
            }
        });
    }

    $(function () {
        $('.aboutdev').on('click', function () {
            var modal2 = document.getElementById('AboutModal');
            modal2.style.display = "block";
            $('body').css('min-height', '540px');
        });
    });
    $(function () {
        // When the user clicks on <span> (x), close the modal
        $('#modalclose2').on('click', function () {
            document.getElementById('AboutModal').style.display = "none";
            $('body').css('min-height', '');
        });
    });
    $(function () {
        // When the user clicks on <span> (x), close the modal
        $('#modalclose1').on('click', function () {
            document.getElementById('GeoUpdateModal').style.display = "none";
        });
    });
    $(function () {
        $('#geolookupbtn').on('click', function () {
            $("body").toggleClass("wait");
            googlerequery = $('#geoupdatetext').attr("reference");
            var modal = document.getElementById('GeoUpdateModal');
            var locationset = {"id": geoid, "location": $('#geoupdatetext').val()};
            modal.style.display = "none";
            queryGeo(locationset);
            updateGeoLocation();
            geoid++;
        });
    });
    $("#geoupdatetext").on('keyup', function(event){
        if(event.keyCode == 13){
            $("#geolookupbtn").click();
        }
    });
    $(function () {
        $('#georevertbtn').on('click', function () {
            $('#geoupdatetext').val($('#georevertbtn').attr("value"));
        });
    });
});

function geoonoff(value) {
    if (value) {
        $("#google_apirow").css("display", "table-row");
        var locobj = document.getElementsByClassName("geoloc");
        for (var i = 0; i < locobj.length; i++) {
            locobj[i].style.display = "table-row";
            var pinput = $(locobj[i]).find('input[type="text"]');
            pinput.filter(function (item) {
                var checkbox = $(pinput[item]).closest("tr").find('input[type="checkbox"]');
                return (pinput[item].value !== "" && checkbox.checked);
            }).prop("disabled", false);
        }
        var placeobj = document.getElementsByClassName("geoplace");
        for (var i = 0; i < placeobj.length; i++) {
            placeobj[i].style.display = "none";
            //$(placeobj[i]).find(":input:text").prop("disabled", true);
        }
        $(".geoicon").attr("src", "images/geoon.png");
    } else {
        $("#google_apirow").css("display", "none");
        var locobj = document.getElementsByClassName("geoloc");
        for (var i = 0; i < locobj.length; i++) {
            locobj[i].style.display = "none";
            //$(locobj[i]).find(":input:text").prop("disabled", true);
        }
        var placeobj = document.getElementsByClassName("geoplace");
        for (var i = 0; i < placeobj.length; i++) {
            placeobj[i].style.display = "table-row";
            var pinput = $(placeobj[i]).find('input[type="text"]').not(".genislideinput");
            pinput.filter(function (item) {
                var checkbox = $(pinput[item]).closest("tr").find('input[type="checkbox"]');
                return (pinput[item].value !== "" && checkbox.checked);
            }).prop("disabled", false);
        }
        $(".geoicon").attr("src", "images/geooff.png");
    }
}

function getProfileName(profile) {
    if (typeof profile == "object" && profile.displayname) {
        return profile.displayname;
    } else {
        return profile;
    }
}

function hostDomain(url) {
    var a = document.createElement('a');
    a.href = url;
    return a.protocol + "//" + a.host;
};

function geoqueryCheck() {
    return googlegeoquery && $('#geoonoffswitch').prop('checked');
}

$(function () {
    $('#logoutbutton').on('click', function () {
        chrome.runtime.sendMessage({
            method: "GET",
            action: "xhttp",
            url: smartcopyurl + "/logout",
            variable: ""
        }, function (response) {
            chrome.runtime.sendMessage({ "action" : "icon", "path": "images/icon_warn.png" });
            window.close();
        });
    });
});

$(function () {
    $('.tablinks').on('click', function () {
        // Declare all variables
        var i, tabcontent, tablinks;
        // Get all elements with class="tabcontent" and hide them
        tabcontent = document.getElementsByClassName("tabcontent");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }

        // Get all elements with class="tablinks" and remove the class "active"
        tablinks = document.getElementsByClassName("tablinks");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }

        // Show the current tab, and add an "active" class to the button that opened the tab
        document.getElementById(this.value).style.display = "block";
        this.className += " active";
    });
});

chrome.storage.local.get('geonotice', function(result) {
    geonotice = result.geonotice;
    if (!exists(geonotice)) {
        geonotice = true;
    }
});

chrome.storage.local.get('autogeo', function (result) {
    var geochecked = result.autogeo;
    if (exists(geochecked)) {
        $('#geoonoffswitch').prop('checked', geochecked);
        geoonoff(geochecked);
    }
});

chrome.storage.local.get('namecheck', function (result) {
    var namecheck = result.namecheck;
    if (exists(namecheck)) {
        $('#namecheckonoffswitch').prop('checked', namecheck);
    }
});

chrome.storage.local.get('livingnameexclude', function (result) {
    var livingnameexclude = result.livingnameexclude;
    if (exists(livingnameexclude)) {
        $('#livingcheckonoffswitch').prop('checked', livingnameexclude);
    }
});

chrome.storage.local.get('siblingcheck', function (result) {
    var siblingcheck = result.siblingcheck;
    if (exists(siblingcheck)) {
        $('#siblingonoffswitch').prop('checked', siblingcheck);
    }
});

chrome.storage.local.get('wedlockcheck', function (result) {
    var wedlockcheck = result.wedlockcheck;
    if (exists(wedlockcheck)) {
        $('#wedlockonoffswitch').prop('checked', wedlockcheck);
    }
});

chrome.storage.local.get('agelimitwarn', function (result) {
    var agelimitwarn = result.agelimitwarn;
    if (exists(agelimitwarn)) {
        $('#agelimitwarn').prop('value', agelimitwarn);
    }
});

chrome.storage.local.get('publicyearval', function (result) {
    var publicyearval = result.publicyearval;
    if (exists(publicyearval)) {
        $('#publicyearval').prop('value', publicyearval);
    }
});

chrome.storage.local.get('agelimiterror', function (result) {
    var agelimiterror = result.agelimiterror;
    if (exists(agelimiterror)) {
        $('#agelimiterror').prop('value', agelimiterror);
    }
});

chrome.storage.local.get('birthyoung', function (result) {
    var birthyoung = result.birthyoung;
    if (exists(birthyoung)) {
        $('#childyoungwarn').prop('value', birthyoung);
    }
});

chrome.storage.local.get('birthold', function (result) {
    var birthold = result.birthold;
    if (exists(birthold)) {
        $('#childoldwarn').prop('value', birthold);
    }
});

chrome.storage.local.get('marriageyoung', function (result) {
    var marriageyoung = result.marriageyoung;
    if (exists(marriageyoung)) {
        $('#marriedyoungwarn').prop('value', marriageyoung);
    }
});

chrome.storage.local.get('marriagedif', function (result) {
    var marriagedif = result.marriagedif;
    if (exists(marriagedif)) {
        $('#spouseagediff').prop('value', marriagedif);
    }
});

chrome.storage.local.get('termlimit', function (result) {
    var termlimit = result.termlimit;
    if (exists(termlimit)) {
        $('#termlimit').prop('value', termlimit);
    }
});

chrome.storage.local.get('samenamecheck', function (result) {
    var samenamecheck = result.samenamecheck;
    if (exists(samenamecheck)) {
        $('#samenameonoffswitch').prop('checked', samenamecheck);
    }
});

chrome.storage.local.get('selfcheck', function (result) {
    var selfcheck = result.selfcheck;
    if (exists(selfcheck)) {
        $('#selfonoffswitch').prop('checked', selfcheck);
    }
});

chrome.storage.local.get('agecheck', function (result) {
    var agecheck = result.agecheck;
    if (exists(agecheck)) {
        $('#ageonoffswitch').prop('checked', agecheck);
    }
});

chrome.storage.local.get('privatecheck', function (result) {
    var privatecheck = result.privatecheck;
    if (exists(privatecheck)) {
        $('#publiconoffswitch').prop('checked', privatecheck);
    }
});

chrome.storage.local.get('datecheck', function (result) {
    var datecheck = result.datecheck;
    if (exists(datecheck)) {
        $('#datecheckonoffswitch').prop('checked', datecheck);
    }
});

chrome.storage.local.get('locationcheck', function (result) {
    var locationcheck = result.locationcheck;
    if (exists(locationcheck)) {
        $('#locationcheckonoffswitch').prop('checked', locationcheck);
    }
});

chrome.storage.local.get('dataconflict', function (result) {
    var dataconflict = result.dataconflict;
    if (exists(dataconflict)) {
        $('#dataconflictonoffswitch').prop('checked', dataconflict);
    }
});

chrome.storage.local.get('partnercheck', function (result) {
    var partnercheck = result.partnercheck;
    if (exists(partnercheck)) {
        $('#partneronoffswitch').prop('checked', partnercheck);
        if (partnercheck) {
            $("#partneroptions").show();
        } else {
            $("#partneroptions").hide();
        }
    }
});

chrome.storage.local.get('childcheck', function (result) {
    var childcheck = result.childcheck;
    if (exists(childcheck)) {
        $('#childrenonoffswitch').prop('checked', childcheck);
        if (childcheck) {
            $("#childoptions").show();
        } else {
            $("#childoptions").hide();
        }
    }
});

chrome.storage.local.get('geniconsistency', function (result) {
    var consistencychecked = result.geniconsistency;
    if (exists(consistencychecked)) {
        $('#consistencyonoffswitch').prop('checked', consistencychecked);
        if (consistencychecked) {
            $("#consistencyoptiontable").slideDown();
        } else {
            $("#consistencyoptiontable").slideUp();
        }
    }
});

chrome.storage.local.get('forcegeo', function (result) {
    var forcechecked = result.forcegeo;
    if (exists(forcechecked)) {
        $('#forcegeoswitch').prop('checked', forcechecked);
    }
});

chrome.storage.local.get('adjustname', function (result) {
    var adjustname = result.adjustname;
    if (exists(adjustname)) {
        $('#adjustnameonoffswitch').prop('checked', adjustname);
    }
});

chrome.storage.local.get('compoundlast', function (result) {
    var compoundlast = result.compoundlast;
    if (exists(compoundlast)) {
        $('#compountlastonoffswitch').prop('checked', compoundlast);
    }
});

chrome.storage.local.get('autoprivate', function (result) {
    var privatechecked = result.autoprivate;
    if (exists(privatechecked)) {
        $('#privateonoffswitch').prop('checked', privatechecked);
    }
});

chrome.storage.local.get('addbiobutton', function (result) {
    var addbiobutton = result.addbiobutton;
    if (exists(addbiobutton)) {
        $('#addbioonoffswitch').prop('checked', addbiobutton);
    }
});

chrome.storage.local.get('genislideout', function (result) {
    var genislideoutchecked = result.genislideout;
    if (!exists(genislideoutchecked)) {
        genislideoutchecked = true;
    }
    $('#genislideonoffswitch').prop('checked', genislideoutchecked);
    if (genislideoutchecked) {
        $('body').css('max-width', '500px');
        $("#controlimage").slideDown();
        slideopen = true;
        $("#genislider").find("img")[0].src = "images/closemenu.png";
    } else {
        $('body').css('max-width', '340px');
        $("#controlimage").slideUp();
        slideopen = false;
        $("#configtext").hide();
        $("#genislider").find("img")[0].src = "images/openmenu.png";
    }

});

chrome.storage.local.get('autobirth', function (result) {
    var birthchecked = result.autobirth;
    if (exists(birthchecked)) {
        $('#birthonoffswitch').prop('checked', birthchecked);
    }
});

chrome.storage.local.get('automname', function (result) {
    var mnamechecked = result.automname;
    if (exists(mnamechecked)) {
        $('#mnameonoffswitch').prop('checked', mnamechecked);
        mnameonoff = mnamechecked;
    }
});

chrome.storage.local.get('hideempty', function (result) {
    var hidechecked = result.hideempty;
    if (exists(hidechecked)) {
        $('#hideemptyonoffswitch').prop('checked', hidechecked);
        if (!$('#hideemptyonoffswitch').prop('checked')) {
                $("#focusshowhide").attr("src", "images/hide.png");
                $("#focusshowhide").attr("title", "Hide Unused Fields");
            }
    }
});

chrome.storage.local.get('burialdate', function (result) {
    var burialchecked = result.burialdate;
    if (exists(burialchecked)) {
        $('#burialonoffswitch').prop('checked', burialchecked);
    }
});

chrome.storage.local.get('geniparent', function (result) {
    var gparentchecked = result.geniparent;
    if (exists(gparentchecked)) {
        $('#geniparentonoffswitch').prop('checked', gparentchecked);
    }
});

chrome.storage.local.get('privacy', function (result) {
    var privacychecked = result.privacy;
    if (exists(privacychecked)) {
        $('#privacyonoffswitch').prop('checked', privacychecked);
    }
});

chrome.storage.local.get('addsource', function (result) {
    var sourcechecked = result.addsource;
    if (exists(sourcechecked)) {
        $('#sourceonoffswitch').prop('checked', sourcechecked);
    }
});

chrome.storage.local.get('addphoto', function (result) {
    var addphotochecked = result.addphoto;
    if (exists(addphotochecked)) {
        $('#photoonoffswitch').prop('checked', addphotochecked);
    }
});
