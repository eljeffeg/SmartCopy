//Development Global Variables
var devblocksend = false; //Blocks the sending data to Geni, prints output to console instead
var locationtest = false; //Verbose parsing of location data
var verboselogs = false;

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
  // The on/off switches render their "ON"/"OFF" text via CSS
  // (.onoffswitch-inner:before/:after { content: attr(data-on-text/data-off-text) })
  // rather than real DOM text, since the same two-tone slider look is shared
  // by 20+ switches - setting these two attributes once here covers all of
  // them instead of needing a data-i18n-style attribute on every switch.
  $('.onoffswitch-inner').attr('data-on-text', _("switchOn")).attr('data-off-text', _("switchOff"));
});

chrome.storage.local.get('buildhistory', function (result) {
    if (exists(result.buildhistory)) {
        buildhistory = dedupeHistory(result.buildhistory);
        chrome.storage.local.set({'buildhistory': buildhistory});
        buildHistoryBox();
    }
});

function normalizeProfileId(id) {
    return String(id).replace("profile-g", "").replace("profile-", "");
}

// Source-page item ids can show up percent-encoded or decoded depending on
// where they were captured from - e.g. chrome.tabs Tab.url is percent-encoded
// for non-ASCII paths ("L%C3%B6wenstein-53"), while ids parsed directly out
// of a fetched page's own HTML href attributes come through as raw Unicode
// ("Löwenstein-53"). Decode before comparing/storing so the same profile
// visited either way still matches for history auto-pick.
function normalizeItemId(itemId) {
    var s = String(itemId);
    try {
        return decodeURIComponent(s);
    } catch (e) {
        return s;
    }
}

// Geni exposes (at least) two id formats for the same profile: a modern
// "guid"-based id (used in "pretty" https://www.geni.com/people/Name/<guid>
// URLs) and an older, shorter internal "node_number". Geni's update/submit
// API endpoints require the node_number form - using the guid form as
// focusid breaks the auto-pick-destination-from-history match against a
// real submit's result.id. So the node_number form is kept as the
// primary/matching id, while the guid form (nicer, human-recognizable) is
// preferred for display.
//
// Detection is based on normalized digit length (matching getProfile()'s
// own >16-digit convention in shared.js), not on string prefix, since ids
// show up with a "profile-g" prefix, a "profile-" prefix, or completely
// bare (e.g. the alias captured by scraping a Geni page's own source only
// yields the bare digits).
function isNodeNumberId(id) {
    var normalized = normalizeProfileId(id);
    return /^\d+$/.test(normalized) && normalized.length <= 16;
}

function isGuidFormatId(id) {
    var normalized = normalizeProfileId(id);
    return /^\d+$/.test(normalized) && normalized.length > 16;
}

function toProfileId(id) {
    var normalized = normalizeProfileId(id);
    if (/^\d+$/.test(normalized)) {
        return (normalized.length > 16 ? "profile-g" : "profile-") + normalized;
    }
    return id;
}

function pickPrimaryId(candidateIds) {
    for (var i = 0; i < candidateIds.length; i++) {
        if (isNodeNumberId(candidateIds[i])) {
            return toProfileId(candidateIds[i]);
        }
    }
    return toProfileId(candidateIds[0]);
}

function pickDisplayId(entry) {
    var candidates = [entry.id].concat(Array.isArray(entry.aliasIds) ? entry.aliasIds : []);
    for (var i = 0; i < candidates.length; i++) {
        if (isGuidFormatId(candidates[i])) {
            return toProfileId(candidates[i]);
        }
    }
    return toProfileId(entry.id);
}

function getAllHistoryIds(entry) {
    var ids = [normalizeProfileId(entry.id)];
    if (Array.isArray(entry.aliasIds)) {
        for (var i = 0; i < entry.aliasIds.length; i++) {
            ids.push(normalizeProfileId(entry.aliasIds[i]));
        }
    }
    return ids;
}

function idSetsOverlap(idsA, idsB) {
    for (var i = 0; i < idsA.length; i++) {
        if (idsB.indexOf(idsA[i]) !== -1) {
            return true;
        }
    }
    return false;
}

function dedupeHistory(history) {
    // One-time cleanup for entries stored before per-profile de-duplication
    // was added to addHistory() - collapses any pre-existing duplicate
    // profile ids down to one entry, merging their submission histories.
    // Matches on the full set of known ids per entry (primary id + any
    // aliasIds) since Geni exposes more than one id format for the same
    // profile (e.g. a modern "guid"-based id and an older internal id).
    var groups = [];
    for (var i = 0; i < history.length; i++) {
        var entry = history[i];
        var entryNormIds = getAllHistoryIds(entry);
        var entryOriginalIds = [entry.id].concat(Array.isArray(entry.aliasIds) ? entry.aliasIds : []);
        var entrySubmissions = Array.isArray(entry.data)
            ? entry.data
            : [{date: entry.date, data: exists(entry.data) ? entry.data : ""}];
        var group = null;
        for (var g = 0; g < groups.length; g++) {
            if (idSetsOverlap(groups[g].normIds, entryNormIds)) {
                group = groups[g];
                break;
            }
        }
        var entryItemIds = Array.isArray(entry.itemIds) ? entry.itemIds : (exists(entry.itemId) && entry.itemId !== "" ? [entry.itemId] : []);
        if (!group) {
            group = {
                normIds: entryNormIds.slice(),
                originalIds: entryOriginalIds.slice(),
                itemIds: entryItemIds.slice(),
                name: entry.name,
                date: entry.date,
                data: entrySubmissions.slice()
            };
            groups.push(group);
        } else {
            for (var n = 0; n < entryNormIds.length; n++) {
                if (group.normIds.indexOf(entryNormIds[n]) === -1) {
                    group.normIds.push(entryNormIds[n]);
                }
            }
            for (var o = 0; o < entryOriginalIds.length; o++) {
                if (group.originalIds.indexOf(entryOriginalIds[o]) === -1) {
                    group.originalIds.push(entryOriginalIds[o]);
                }
            }
            for (var k = 0; k < entryItemIds.length; k++) {
                if (group.itemIds.map(normalizeItemId).indexOf(normalizeItemId(entryItemIds[k])) === -1) {
                    group.itemIds.push(entryItemIds[k]);
                }
            }
            if ((!exists(group.name) || group.name === "") && exists(entry.name) && entry.name !== "") {
                group.name = entry.name;
            }
            group.data = group.data.concat(entrySubmissions);
        }
    }
    return groups.map(function (g) {
        var primary = pickPrimaryId(g.originalIds);
        var primaryNorm = normalizeProfileId(primary);
        return {
            id: primary,
            aliasIds: g.originalIds.filter(function (v) { return normalizeProfileId(v) !== primaryNorm; }),
            itemIds: g.itemIds,
            name: g.name,
            date: g.date,
            data: g.data
        };
    });
}

function buildHistoryBox() {
    var historytext = "";
    for (var i = 0; i < buildhistory.length; i++) {
        var name = buildhistory[i].id;
        if (exists(buildhistory[i].name)) {
            name = buildhistory[i].name;
        }
        var focusprofileurl = "";
        if (exists(buildhistory[i].id)) {
            var displayId = pickDisplayId(buildhistory[i]);
            var normalizedId = normalizeProfileId(displayId);
            if (displayId.startsWith("profile-g")) {
                focusprofileurl = "https://www.geni.com/profile/index/" + displayId.replace("profile-g", "");
            } else {
                focusprofileurl = "https://www.geni.com/" + displayId;
            }
            var nameLink = '<a href="' + focusprofileurl + '" target="_blank">' + name + '</a>' + (normalizedId !== "" ? ' (' + normalizedId + ')' : '');
            if (hasHistoryDetails(buildhistory[i].data)) {
                historytext += '<span class="expandhistory" name="history' + buildhistory[i].id + '" style="font-size: large; cursor: pointer;">▸</span> ' + nameLink + '<br/>';
                historytext += formatHistoryDetails(buildhistory[i].data, buildhistory[i].id);
            } else {
                historytext += '<span style="padding-left: 2px; padding-right: 2px;">&#x25cf;</span> ' + nameLink + '<br/>';
            }
        }
    }
    $("#historytext").html(historytext);
    $(function () {
        $('.expandhistory').on('click', function () {
            expandFamily($(this).attr("name"));
            $(this).text($(this).text() === '▸' ? '▾' : '▸');
        });
    });
}

function hasHistoryDetails(data) {
    if (Array.isArray(data)) {
        return data.length > 0;
    }
    return exists(data) && data !== "";
}

function formatHistoryDetails(data, id) {
    // Newer entries store an array of past submissions (accumulated across
    // repeat "Add to History" calls for the same profile); older entries
    // stored a single JSON string directly - support both.
    var submissions = Array.isArray(data) ? data : [{date: null, data: data}];
    var historytext = '<ul id="slidehistory' + id + '" style="display: none;">';
    for (var s = 0; s < submissions.length; s++) {
        var sub = submissions[s];
        var subdatetxt = "Update";
        if (exists(sub.date)) {
            var day = new Date(sub.date);
            subdatetxt = ("00" + (day.getMonth() + 1)).slice(-2) + "-" + ("00" + day.getDate()).slice(-2) + "@" + ("00" + day.getHours()).slice(-2) + ":" + ("00" + day.getMinutes()).slice(-2);
        }
        if (!exists(sub.data) || sub.data === "") {
            historytext += '<li><b>' + subdatetxt + '</b>: Manually added to history</li>';
            continue;
        }
        var parsed = sub.data;
        if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
        }
        historytext += '<li><b>' + subdatetxt + '</b>: ' + formatJSON(parsed, "", "") + '</li>';
    }
    historytext += '</ul>';
    return historytext;
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

if (navigator.serviceWorker) {
    // Chrome MV3-only: the background service worker can go dormant: this
    // re-registers it if needed. Firefox has no navigator.serviceWorker at
    // all in this context - it uses an always-on background event page
    // instead (see manifest.json's background.scripts), so it doesn't need
    // this and the API simply isn't there to call.
    navigator.serviceWorker.getRegistration().then(r => {
        if (r) return;
        const bg = chrome.runtime.getManifest().background;
        navigator.serviceWorker.register(bg.service_worker, {
          type: bg.type || 'classic',
          scope: '/',
        });
      });
}
  // Fin d'ajout - End of Add
// get_tab() (which eventually calls loginProcess(), the thing that
// actually checks the geonotice flag) used to fire straight from
// DOMContentLoaded, independently of chrome.storage.local.get('geonotice',
// ...) below - two separate async calls racing with no ordering between
// them. geonotice starts hardcoded true (see the var declaration up top),
// so whichever finished first decided the outcome: if chrome.tabs.query
// resolved before the storage read did, loginProcess() saw the still-
// default true and showed the notice again even though the user had
// already dismissed and persisted it as false. Gating on both flags
// (rather than nesting one call inside the other) closes the race
// regardless of which actually finishes first - see issue #193.
var domReady = false;
var geonoticeLoaded = false;

function maybeStartLogin() {
    if (domReady && geonoticeLoaded) {
        get_tab();
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var version = chrome.runtime.getManifest().version;
    console.log(chrome.runtime.getManifest().name + " v" + version);
    $("#versionbox").html("SmartCopy v" + version);
    $("#versionbox2").html("<a href='https://github.com/eljeffeg/SmartCopy/releases' target='_blank' style='color: inherit; text-decoration: none;'>SmartCopy v" + version + "</a>");
    domReady = true;
    maybeStartLogin();
});

function get_tab() {
    chrome.tabs.query({"currentWindow": true, "status": "complete", "windowType": "normal", "active": true}, function (tabs) {
        var tab = tabs[0];
        if (tab !== undefined) {
            tablink = tab.url;
            loginProcess();
        } else {
            window.setTimeout(get_tab, 1000);
        }
    });
}

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
        updateLinks(focusprofile);
    }
    if (startsWithHTTP(tablink, "https://www.geni.com") && !isGeni(tablink)) {
        $('#loginspinner').hide();
        $("#optionslide").show();
    } else if (!loggedin) {
        loadLogin();
    } else {
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
                setMessage(errormsg, _('SmartCopy_does_not_currently_support_parsing'));
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
                    $(accessdialog).append('<div style="text-align:center"><br><a id="researchclick" href="#">Continue to Research this Person</a></div>')
                    document.getElementById('researchclick').addEventListener('click', buildResearch, false);
                    chrome.runtime.sendMessage({
                        method: "GET",
                        action: "xhttp",
                        url: "https://www.geni.com/api/" + focusid + "?fields=name&access_token=" + accountinfo.access_token,
                        variable: ""
                    }, function (response) {
                        var responsedata = JSON.parse(response.source);
                        if (exists(responsedata.name)) {
                            focusname = responsedata.name;
                        }
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
                        chrome.scripting.executeScript(
                            {
                                target: {tabID: tab1.id}, 

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
                            }
                        , function () {
                            window.close();
                        });
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

// Client-rendered SPA pages (Filae, MyHeritage's new design) can be
// captured before React has actually finished rendering, since
// getPagesSource.js's injection is a single, one-shot DOM snapshot with no
// concept of "is this page actually ready yet" - unlike the retry-based
// family-member fallback each of those collections has, the FOCUS
// profile's own capture had no equivalent safety net at all, confirmed
// live: an early capture on Filae came back completely blank. Strictly
// opt-in via collection.isPageReady (undefined for every collection that
// doesn't need it, e.g. anything server-rendered) so this changes nothing
// for the common case - only a collection that defines it pays any retry
// cost at all.
var pageReadyAttempts = 0;
var PAGE_READY_MAX_ATTEMPTS = 15;

chrome.runtime.onMessage.addListener(function (request, sender, callback) {
    if (request.action == "getSource") {
        if (exists(collection) && exists(collection.isPageReady)) {
            var ready = collection.isPageReady(request.source);
            if (!ready && pageReadyAttempts < PAGE_READY_MAX_ATTEMPTS) {
                pageReadyAttempts++;
                $("#readstatus").html("(waiting for the page to finish loading)");
                setTimeout(capturePage, 1000);
                return false;
            }
            if (!ready) {
                console.warn("getSource: gave up waiting for isPageReady after " + pageReadyAttempts + " attempts, proceeding anyway");
            }
        }
        pageReadyAttempts = 0;
        // loadPage() runs synchronously and never calls callback -
        // getPagesSource.js's sendMessage call doesn't pass one either, so
        // no response is ever expected here. Returning true (promising an
        // async response) with nothing to deliver is exactly what Firefox
        // flags as "Promised response from onMessage listener went out of
        // scope"; Chrome tolerates the mismatch silently.
        loadPage(request);
        return false;
    }
    return false;
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
                    setMessage(warningmsg, _('SmartCopy_is_having_difficulty_reading_the_page') + error);
                }
            }
            if (!profilechanged && focusURLid !== "") {
                for (var i = 0; i < buildhistory.length; i++) {
                    var historyItemIds = Array.isArray(buildhistory[i].itemIds)
                        ? buildhistory[i].itemIds
                        : (exists(buildhistory[i].itemId) ? [buildhistory[i].itemId] : []);
                    if (historyItemIds.map(normalizeItemId).indexOf(normalizeItemId(focusURLid)) !== -1) {
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
            setMessage(warningmsg, _('This_website_is_not_yet_supported_by_SmartCopy.'));
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
            $("#focusname").html('<span id="genilinkdesc"><a href="' + 'https://www.geni.com/' + focusid + '" target="_blank" style="color:inherit; text-decoration: none;">' + getProfileName(focusname) + "</a></span>");
            if (focusrange !== "") {
                $("#focusrange").text(focusrange);
            }
            var accessdialog = document.querySelector('#useraccess');
            accessdialog.style.display = "none";
            accessdialog.style.marginBottom = "12px";
            $(accessdialog).text("");
            accessdialog.style.backgroundColor = "#dfe6ed";

            var args = "fields=id,guid,name,names,title,first_name,middle_name,last_name,maiden_name,suffix,display_name,nicknames,gender,deleted,merged_into,birth,baptism,death,burial,cause_of_death,is_alive,public,occupation,photo_urls,marriage,divorce,locked_fields,match_counts&actions=update,update-basics,add,add-photo";
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

                console.log("Parsing Family... {}", request);
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
                console.log("Finished parsing family...");
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
    var parsed = $('<div>').html(JSON.stringify(request).replace(/<img[^>]*>/ig, ""));
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

// The actual DOM capture step of getPageCode() - factored out so the
// "getSource" listener below can re-trigger it for a collection that opts
// into isPageReady (see that listener), without duplicating the injection
// sequence.
async function capturePage() {
    const tabId = await getTabId();
    chrome.scripting.executeScript({
        target: {tabId: tabId},
        world: "MAIN",
        files: ["annotateMyHeritageLinks.js"]
    }, function () {
        // Best-effort only (e.g. not every site is React, or this is
        // a browser without MAIN-world injection support) - proceed
        // to the normal page capture regardless of the outcome here.
        chrome.scripting.executeScript({
            target: {tabId: tabId},
            files: ["annotateFilaeAvatars.js", "getPagesSource.js"]
        }, function () {
            if (chrome.runtime.lastError) {
                setMessage(errormsg, 'There was an error injecting script : \n' + chrome.runtime.lastError.message);
            }
        });
    });
}

async function getPageCode() {
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
            capturePage();
        }
    } else {
        setTimeout(getPageCode, 50);
    }
}

async function getTabId() {
    let queryOptions = { active: true, currentWindow: true };
    let tabs = await chrome.tabs.query(queryOptions);
    return tabs[0].id;
}

var loginprocessing = true;
var loginpoll = null;

function loadLogin() {
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: smartcopyurl + "/accountlogin?version=" + chrome.runtime.getManifest().version
    }, function (resp) {
        console.log("Callback for login: {}", resp);
        try {
            var response =  JSON.parse(resp.source);
        } catch(err) {
            console.log('Problem getting account information. {}', err);
            if (loginprocessing) {
                chrome.action.setIcon({ path: "images/icon_warn.png" });
                if (resp.status !== 401) {
                    // Not a clean "not authenticated" response - a network
                    // failure, a HistoryLink server error, etc. Prompting
                    // to log into Geni here would be misleading when Geni
                    // isn't actually the problem.
                    loginprocessing = false;
                    document.getElementById("loginspinner").style.display = "none";
                    setMessage(errormsg, _("HistoryLink_unreachable_message"));
                    return;
                }
                console.log("Logged Out... Prompting for Geni login.");
                loginprocessing = false;
                document.getElementById("loginspinner").style.display = "none";
                $("#logindiv").slideDown();
                $("#genilogin").off("click").on("click", function () {
                    window.open(smartcopyurl + '/smartlogin', 'smartcopylogin', 'width=660,height=520');
                    $("#loginhint").slideDown();
                    if (loginpoll) {
                        clearInterval(loginpoll);
                    }
                    var attempts = 0;
                    loginpoll = setInterval(function () {
                        if (loggedin || attempts++ > 120) {
                            clearInterval(loginpoll);
                            loginpoll = null;
                            return;
                        }
                        loadLogin();
                    }, 1000);
                });
            }
            return;
        }

        console.log("Logged In...");
        accountinfo = response;
        chrome.storage.local.set({'accountinfo': accountinfo});
            
        if (exists(accountinfo.google_key) && accountinfo.google_key !== "" && accountinfo.google_key !== "invalid") {
            //This allows the server to issue the Google API Key if they ever change their payment model to something reasonable
            google_api = accountinfo.google_key;
        }
        if (accountinfo.curator) {
            //display leaderboard link if user is a curator - page itself still verifies
            //document.getElementById("curator").style.display = "inline-block";
            datelimit = 1000 ;
            console.log("You are a curator, you can use SC from the year 1000");
        }
        loggedin = true;
        chrome.action.setIcon({ path: "images/icon.png" });
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
        // Captured before entering .filter() callbacks below, where `this`
        // is rebound by jQuery to the element currently being tested.
        var selectingAll = this.checked;
        var ffs = fs.find('[type="checkbox"]');
        if (!$(ffs[0]).prop("disabled")) {
            var photoon = $('#photoonoffswitch').prop('checked');
            // Individual fields already default to checked/enabled only
            // when they actually have a value (see isChecked()/isEnabled()
            // at render time) - Select All was overriding that and forcing
            // empty text fields on too, which then submitted as blank and
            // overwrote whatever was already on the Geni profile. Only
            // applies while turning fields on; deselecting is always safe.
            ffs.filter(function (item) {
                if ($(ffs[item]).closest('tr').css("display") === "none") {
                    return false;
                }
                if (!photoon && $(ffs[item]).hasClass("photocheck") && !this.checked) {
                    return false;
                }
                if (selectingAll && isFieldEmptyForCheckAll($(ffs[item]).closest('tr'))) {
                    return false;
                }
                return true;
            }).prop('checked', selectingAll);
            var ffs = fs.find('input[type="text"],select,input[type="hidden"],textarea').not(".genislideinput").not(".parentselector");
            ffs.filter(function (item) {
                if ((ffs[item].type === "checkbox") || ($(ffs[item]).closest('tr').css("display") === "none") ||
                    (!photoon && $(ffs[item]).hasClass("photocheck") && !this.checked) ||
                    ffs[item].name === "action" || ffs[item].name === "profile_id") {
                    return false;
                }
                // Same reasoning as isFieldEmptyForCheckAll() below - reads
                // Geni's value straight from this row's .genislideinput
                // companion rather than the field's own disabled attribute,
                // which this very filter mutates on every check/uncheck
                // cycle and would otherwise go stale.
                if (selectingAll && (ffs[item].type === "text" || ffs[item].tagName === "TEXTAREA") && !isValue(ffs[item].value)) {
                    var companionVal = $(ffs[item]).closest("tr").find(".genislideinput").val();
                    if (exists(companionVal) && companionVal !== "") {
                        return false;
                    }
                }
                return true;
            }).attr('disabled', !selectingAll);
        }
    });
});

function isFieldEmptyForCheckAll(row) {
    var valueFields = row.find('input[type="text"],textarea').not(".genislideinput").not(".parentselector");
    if (valueFields.length === 0) {
        // No plain text/textarea value field on this row (e.g. a <select>
        // like Gender or Vital status) - those always resolve to a real
        // value, not a blank one, so there's nothing to guard against here.
        return false;
    }
    for (var i = 0; i < valueFields.length; i++) {
        if (isValue(valueFields[i].value)) {
            return false;
        }
    }
    // Every value field in this row is blank - safe to include (don't
    // exclude) only if Geni's own value, read directly from this row's
    // .genislideinput companion, is ALSO blank. Deliberately does NOT look
    // at the field's disabled attribute - that toggles on every "all"
    // check/uncheck cycle (see the second filter below and
    // refreshFieldCheckState() in buildform.js), so a field correctly
    // enabled once (e.g. after the action dropdown settles on "Add
    // Profile") would otherwise get disabled again by simply unchecking
    // "all", then wrongly look "protected" and get excluded the next time
    // "all" is checked. The .genislideinput companion only changes when
    // setGeniFamilyData()/render-time genifocusdata actually updates it,
    // which is exactly when this determination should change too.
    var companion = row.find(".genislideinput").val();
    return exists(companion) && companion !== "";
}

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
            $('#showhistory').text(_("Show_History"));
        } else {
            $('#showhistory').text(_("Hide_History"));
        }
    });
});

$(function () {
    $('#addhistory').on('click', function () {
        // Geni's REST API doesn't expose the short internal "node_number"
        // (confirmed - neither genifocusdata.get("id") nor .get("node_number")
        // returned it), but the page itself embeds it directly, e.g.
        // <span class="matches-counter" data-match-counter='profile-34758447241'>
        // and G.PageProfile = {..., "node_number":"34758447241", ...}. Fetch
        // this Geni page's own source and pull it from there instead.
        chrome.runtime.sendMessage({
            method: "GET",
            action: "xhttp",
            url: tablink
        }, function (response) {
            var aliasId = "";
            if (exists(response.source)) {
                var match = response.source.match(/data-match-counter=["']profile-(\d+)["']/);
                if (!match) {
                    match = response.source.match(/"node_number"\s*:\s*"(\d+)"/);
                }
                if (match) {
                    aliasId = match[1];
                }
            }
            addHistory(focusid, tablink, getProfileName(focusname), "", aliasId);
            buildHistoryBox();
        });
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
                // Always fold in the existing About text first - a prior
                // submission's Reference lines live there, and skipping this
                // merge on a repeat submission (as a stale version of this
                // check used to) silently dropped about_me from the request
                // whenever the source page itself had no free-text notes.
                if (focusabout !== "") {
                    about = focusabout + "\n" + about;
                }
                // Category-level summary of what this submission actually
                // touched, appended to the same Reference note rather than
                // a separate formal sources/citations system - see #59.
                var updatedCategories = summarizeUpdatedCategories(profileout, exists(focusphotoinfo));
                var updatedSuffix = updatedCategories.length > 0 ? " (updated: " + updatedCategories.join(", ") + ")" : "";
                // Matches on just the stable "[url recordtype]" token rather
                // than the full surrounding phrase, so this keeps working
                // regardless of prefix wording ("Updated from" vs
                // "Reference:"), link protocol, or formatting (e.g. bold).
                var token = "[" + encodeURI(refurl) + " " + recordtype + "]";
                var alreadyReferenced = focusabout.contains(token);
                // A source referenced once but updated again later with a
                // genuinely different category (e.g. a photo added after the
                // name was already recorded) still deserves its own new
                // Reference line - but resubmitting the SAME category that a
                // prior line from this source already recorded (e.g.
                // re-saving the death place a second time with nothing else
                // changed) is reference spam, not new information, and
                // should be skipped even though summarizeUpdatedCategories
                // still reports it as "updated" for this request. Compares
                // against every category ANY prior line from this source has
                // ever recorded, not just the most recent one.
                var priorCategories = getReferencedCategories(focusabout, token);
                var newCategories = updatedCategories.filter(function (category) {
                    return priorCategories.indexOf(category) === -1;
                });
                if (!alreadyReferenced || newCategories.length > 0) {
                    if (exists(refurl)) {
                        profileout["about_me"] = about + "* '''Reference:''' [" + encodeURI(refurl) + " " + recordtype + "] - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''" + moment.utc().format("MMM D YYYY, H:mm:ss") + " UTC''" + updatedSuffix + "\n";
                    } else {
                        profileout["about_me"] = about + "* '''Reference:''' " + recordtype + " - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''" + moment.utc().format("MMM D YYYY, H:mm:ss") + " UTC''" + updatedSuffix + "\n";
                    }
                } else if (about !== "") {
                    profileout["about_me"] = about;
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
                            // Unconditional, matching the focus-profile path
                            // above (~line 1328) - without this, a plain
                            // about note with no existing bullet lines (e.g.
                            // straight from a collection's own note text,
                            // not a prior SmartCopy run) skipped straight to
                            // the "* Reference: ..." append below with no
                            // separator, breaking the bullet formatting.
                            if (!about.endsWith("\n")) {
                                about += "\n";
                            }
                        }
                        if (sourcecheck) {
                            var focusprofileurl = "";
                            if (focusid.startsWith("profile-g")) {
                                focusprofileurl = "https://www.geni.com/profile/index/" + focusid.replace("profile-g", "");
                            } else {
                                focusprofileurl = "https://www.geni.com/" + focusid;
                            }
                            var updatedCategories = summarizeUpdatedCategories(familyout, exists(photosubmit[familyout.profile_id]));
                            var updatedSuffix = updatedCategories.length > 0 ? " (updated: " + updatedCategories.join(", ") + ")" : "";
                            if (exists(fdata.url)) {
                                about = about + "* '''Reference:''' [" + encodeURI(fdata.url) + " " + recordtype + "] - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''" + moment.utc().format("MMM D YYYY, H:mm:ss") + " UTC''" + updatedSuffix + "\n";
                            } else {
                                about = about + "* '''Reference:''' " + recordtype + " - [https://www.geni.com/projects/SmartCopy/18783 SmartCopy]: ''" + moment.utc().format("MMM D YYYY, H:mm:ss") + " UTC''" + updatedSuffix + "\n";
                            }
                            
                        }
                        if (about !== "") {
                            familyout["about_me"] = about;
                        }
                    }
                    if (exists(familyout.photo) && exists(fdata.url)) {
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
                            var abouturl = "https://www.geni.com/api/" + pid + "?fields=about_me,nicknames&access_token=" + accountinfo.access_token;
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

// jQuery's $.param(), used as-is, serializes an array-valued field (e.g.
// nicknames: ["Yakob", "Jakob"]) as repeated PHP/Rails-style bracket keys -
// "nicknames[]=Yakob&nicknames[]=Jakob". Confirmed live that Geni's API
// doesn't treat that as multiple values (only the last "nicknames[]="
// survived). The classic repeated-key HTML form format ("nicknames=Yakob&
// nicknames=Jakob", jQuery's "traditional" param mode) doesn't work either -
// also confirmed live, Geni's API keeps only the last "nicknames=" value it
// sees either way. What actually persists all of them is the same format
// Geni's own GET response would produce if flattened: one "nicknames="
// field holding a single comma-joined string. Built on a shallow copy so
// the caller's own `data` object - reused afterward as the `variable`
// payload for chrome.runtime.sendMessage's callback, and eventually
// JSON.stringify'd into the local history log - keeps its original
// nicknames array intact rather than being silently rewritten to a string.
function serializeGeniUpdate(data) {
    if (!exists(data.nicknames)) {
        return $.param(data);
    }
    var withData = $.extend({}, data);
    withData.nicknames = (data.nicknames instanceof Array) ? data.nicknames.join(",") : data.nicknames;
    return $.param(withData);
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
        var posturl = "https://www.geni.com/api/" + sendid + "/" + action +  "?fields=id,unions,name&access_token=" + accountinfo.access_token;
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
                data: serializeGeniUpdate(data),
                variable: {id: id, relation: action.replace("add-", ""), data: data}
            }, function (response) {
                try {
                    if (!exists(response.source)) {
                        // background.js now passes source through even on a
                        // non-2xx Geni response (see its POST handler), so
                        // reaching here with no source at all means there
                        // was never an HTTP response to read in the first
                        // place - a genuine network-level failure, caught by
                        // background.js's own outer catch, which does set a
                        // real, readable response.error message for exactly
                        // this case. Surface that directly instead of
                        // falling through to result.error below, which would
                        // throw on an undefined result and show that crash's
                        // own message in place of the real reason.
                        throw new Error(exists(response.error) ? response.error : "No response received from Geni.");
                    }
                    var result = typeof response.source == 'string' ? JSON.parse(response.source) : response.source;
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
                    if (response.variable.relation === "update" && response.variable.data !== undefined) {
                        submitstatus.pop();
                        document.querySelector('#message').style.display = "none";
                        return
                    }
                    updateMessage(errormsg, 'There was a problem updating Geni with a ' + response.variable.relation + '. ' + extrainfo + 'Error Response: "' + e.message + '"');
                    console.log(e); //error in the above string(in this case,yes)!
                    console.log(response)
                    // result was never assigned (the parse above threw), so every
                    // relation type other than "update" must also bail out here -
                    // falling through used result.id on an undefined result,
                    // throwing a second, uncaught exception that both dropped the
                    // rest of this chained add (e.g. a 2nd parent, marriage info,
                    // children - #152) and skipped the submitstatus.pop() below,
                    // leaving submission tracking permanently off by one.
                    if (action !== "add-photo" && action !== "delete") {
                        updatecount += 1;
                        $("#updatecount").text(Math.min(updatecount, updatetotal).toString());
                    }
                    submitstatus.pop();
                    return;
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
                    // genidata already resolved above (from genifamilydata if
                    // known, else a fresh wrapper around this response) - its
                    // guid, when available, is what lets history display and
                    // future auto-pick use the recognizable guid instead of
                    // the internal node_number id result.id above always is
                    // (see issue #201).
                    addHistory(result.id, databyid[id].itemId, getProfileName(databyid[id].name), JSON.stringify(response.variable.data), genidata.get("guid"));
                } else if (sendid === focusid) {
                    // result.id and focusid are confirmed to be the same profile here
                    // (that's what the sendid === focusid check just established), but
                    // Geni's API can return result.id in a different id format than
                    // focusid (URL/guid-derived) - pass focusid through as an alias so
                    // this matches any prior/future history entry recorded under either.
                    // Also pass the real guid directly (issue #201) - focusid isn't
                    // guaranteed to be guid-format depending on how it was set this
                    // session, so don't rely on it alone for that.
                    addHistory(result.id, focusURLid, getProfileName(focusname), JSON.stringify(response.variable.data), [focusid, genifocusdata.get("guid")]);
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
            }, function (response) {
                // Additive only - the POST itself and submitstatus.pop()'s
                // timing below are unchanged. This only adds the same
                // addHistory() bookkeeping the non-photo callback already
                // does, so photo updates stop being silently absent from
                // history (see issue #36). Wrapped defensively since a
                // malformed/unexpected response shape here must not affect
                // submission tracking, which doesn't depend on this callback.
                try {
                    if (exists(response) && exists(response.source)) {
                        var result = typeof response.source == 'string' ? JSON.parse(response.source) : response.source;
                        if (!exists(result.error)) {
                            // A clean "photo -> uploaded" marker, not the raw
                            // submission payload - that's a full image URL
                            // plus attribution text, not useful in a compact
                            // history view.
                            var photoHistoryData = JSON.stringify({photo: "uploaded"});
                            var photoId = response.variable.id;
                            if (exists(databyid[photoId])) {
                                // Unlike the field-update callback, nothing
                                // upstream of this callback already resolved
                                // a GeniPerson wrapper for this family member -
                                // look one up the same way that callback does
                                // (known genifamilydata entry, if any) so the
                                // guid can be passed the same way (#201). No
                                // fallback to a fresh wrapper from `result`
                                // here - the photo endpoint's response doesn't
                                // include a guid field either way, so a fresh
                                // wrapper wouldn't have one to give.
                                var photoGuid = "";
                                if (exists(databyid[photoId]["geni_id"]) && exists(genifamilydata[databyid[photoId]["geni_id"]])) {
                                    photoGuid = genifamilydata[databyid[photoId]["geni_id"]].get("guid");
                                }
                                addHistory(result.id, databyid[photoId].itemId, getProfileName(databyid[photoId].name), photoHistoryData, photoGuid);
                            } else if (sendid === focusid) {
                                addHistory(result.id, focusURLid, getProfileName(focusname), photoHistoryData, [focusid, genifocusdata.get("guid")]);
                            }
                            // submitstatus.pop() below fires synchronously,
                            // not waiting on this response - so the "all
                            // submissions done" flow elsewhere can already
                            // have redrawn the history list before this
                            // callback (and thus addHistory() above) ever
                            // runs, leaving the photo entry recorded but not
                            // visible until some unrelated later refresh.
                            // Redraw here too so it shows up promptly.
                            buildHistoryBox();
                        }
                    }
                } catch (e) {
                    console.error(e);
                }
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
                        url: "https://www.geni.com/api/" + spouseinfo.union + "/update?access_token=" + accountinfo.access_token,
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
            url: "https://www.geni.com/api/" + focusid + "/add-partner?access_token=" + accountinfo.access_token,
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


// Condenses a parseForm() field-data object into a short, human-readable
// list of what categories of data changed - e.g. "photo, name, gender,
// living status, birth" - for the "* Reference: ..." note appended to
// about_me on submit (issue #59). Category-level, not field-level, so it
// stays skimmable in a bio even on a large multi-field update, rather than
// listing every individual field name touched.
function summarizeUpdatedCategories(fields, includesPhoto) {
    var categoryMap = {
        // "title"/"first_name"/etc. never actually appear as flat top-level
        // keys here - parseForm() always nests them under a top-level
        // "names" object (one per language), so it's that plural literal
        // key that needs mapping, not the individual field names (those
        // entries are kept anyway in case a future caller ever does pass
        // them flat). "nicknames" gets its own distinct "AKA" category
        // (matching Geni's own "Also Known As" field label) rather than
        // folding into "names" - it's a genuinely different field from the
        // actual given/family name, and collapsing the two together would
        // hide that a submission touched one but not the other.
        "names": "names",
        "title": "names", "first_name": "names", "middle_name": "names", "last_name": "names",
        "maiden_name": "names", "suffix": "names", "display_name": "names", "nicknames": "AKA",
        "gender": "gender",
        "is_alive": "living status",
        "public": "privacy",
        "occupation": "occupation",
        "cause_of_death": "cause of death",
        // about_me is genuinely different from every other excluded key
        // here (profile_id, action): both call sites (~line 1429, ~1527)
        // run this BEFORE profileout/familyout["about_me"] gets overwritten
        // with the appended "* Reference: ..." line, so at this point it
        // still holds only the real, checked-and-submitted about content
        // (a collection's own scraped notes - e.g. Online-OFB's misc
        // fields folded into "about" - or a manually-checked About edit),
        // never the mechanical reference note itself. Excluding it
        // unconditionally (as a stale version of this did) silently hid a
        // real content category from the summary every time.
        "about_me": "about"
    };
    var categories = [];
    if (includesPhoto) {
        categories.push("photo");
    }
    if (exists(fields)) {
        for (var key in fields) {
            if (fields.hasOwnProperty(key) && key !== "profile_id" && key !== "action") {
                var category;
                if (categoryMap.hasOwnProperty(key)) {
                    category = categoryMap[key];
                } else if (key.contains(":")) {
                    // e.g. "birth:date", "birth:location:place_name" -> "birth"
                    category = key.split(":")[0].replace(/_/g, " ");
                } else {
                    category = key.replace(/_/g, " ");
                }
                if (categories.indexOf(category) === -1) {
                    categories.push(category);
                }
            }
        }
    }
    return categories;
}

// Every category any prior "* Reference: [url recordtype] ... (updated:
// ...)" line for this same source has ever recorded, scanned from the
// existing about_me text line-by-line (each Reference line is always
// exactly one line - see the "\n" terminator where these lines are built).
// Used to tell a genuinely new update (a category not seen before from this
// source) apart from reference spam (resubmitting a category, e.g. death
// place, that a prior line from this same source already recorded, with
// nothing else new this time).
function getReferencedCategories(existingAbout, token) {
    var categories = [];
    if (!exists(existingAbout) || existingAbout === "") {
        return categories;
    }
    existingAbout.split("\n").forEach(function (line) {
        if (!line.contains(token)) {
            return;
        }
        var match = line.match(/\(updated: ([^)]*)\)/);
        if (!exists(match)) {
            return;
        }
        match[1].split(",").forEach(function (category) {
            category = category.trim();
            if (category !== "" && categories.indexOf(category) === -1) {
                categories.push(category);
            }
        });
    });
    return categories;
}

function parseForm(fs) {
    let name_element = ["title", "first_name", "middle_name", "last_name", "maiden_name", "suffix", "display_name"]
    let name_language = "en-US"
    var objentry = {};
    var marentry = {};
    var diventry = {};
    var rawinput = fs.find('input[type="text"],select,input[type="hidden"],textarea').not(".genislideinput");
    var updatefd = (fs.selector === "#profiletable");
    var fsinput = rawinput.filter(function (item) {
        return (!$(rawinput[item]).closest('tr').hasClass("geohidden"));
    });
    for (var item in fsinput) if (fsinput.hasOwnProperty(item)) {
        if (fsinput[item].name === "name_language"){
            name_language = fsinput[item].value;
            fsinput[item].name = ""
        }
        if (exists(fsinput[item].value) && !fsinput[item].disabled && getProfileName(fsinput[item].name) !== "") {
            // A checked+enabled field can still be a genuine no-op: "select
            // all" now always checks every safe field regardless of
            // whether it happens to already match Geni (e.g. Privacy
            // pre-selecting Public on an already-Public profile, or a
            // scraped birth year of 1821 landing on a profile Geni already
            // has as 1821 - see #205), and the blank-scraped/blank-Geni
            // case (isChecked()/isEnabled()'s currentValue relaxation) is
            // really just the same thing with both sides empty. Comparing
            // against the real "what does Geni actually have" value
            // already sitting in this row's .genislideinput companion
            // (populated by setGeniFamilyData()/genifocusdata at render or
            // match time) catches all of these the same way, so nothing
            // gets submitted - or shows up as a false "(updated: ...)"
            // reference-note category - for a field that wouldn't actually
            // change anything. A blank scraped value that does NOT match a
            // real Geni value still proceeds normally - that's a
            // deliberate manual clear (the field only reaches here checked
            // at all because the user explicitly overrode a protected
            // field), not a no-op.
            var geniCompanionValue = $(fsinput[item]).closest("tr").find(".genislideinput").val();
            if (exists(geniCompanionValue)) {
                // Privacy's select value is "true"/"false"/"", but its
                // companion displays the human label ("Public"/"Private"/"")
                // via isPublic() - map through the same labels before
                // comparing, since the raw strings would never match even
                // when they mean the same thing.
                var comparableValue = fsinput[item].value;
                if (fsinput[item].name === "public") {
                    comparableValue = fsinput[item].value === "true" ? "Public" : (fsinput[item].value === "false" ? "Private" : "");
                }
                if (geniCompanionValue === comparableValue) {
                    continue;
                }
            }
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
                        var isFlatPlace = (fieldname === "place_name");
                        if (fieldname === "place_name_geo") {
                            fieldname = "place_name";
                        }
                        varlocation[fieldname] = fsinput[item].value;
                        if (isFlatPlace) {
                            // Submitting the flat "Place:" field alone left
                            // the rest of Geni's location record untouched
                            // (whether set by hand, or by a previous
                            // submission), and Geni's own combined location
                            // summary then showed the new place name and
                            // the stale remainder stacked back to back.
                            // Explicitly clearing the rest of Geni's actual
                            // location schema (per Geni's own API docs:
                            // place_name/city/county/state/country/
                            // street_address1/latitude/longitude - no
                            // separate address lines 2/3, no postal_code)
                            // makes the flat place name the sole source of
                            // truth for this location.
                            varlocation['city'] = '';
                            varlocation['county'] = '';
                            varlocation['state'] = '';
                            varlocation['country'] = '';
                            varlocation['street_address1'] = '';
                        }
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
                } else if (name_element.includes(fsinput[item].name)) {
                    if (!exists(objentry["names"])) {
                        objentry["names"] = {};
                    }
                    if (!exists(objentry["names"][name_language])) {
                        objentry["names"][name_language] = {};
                    }
                    objentry["names"][name_language][fsinput[item].name] = fsinput[item].value;
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

function parseDate(fulldate, update, customdateformat) {
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

    var dateformat = customdateformat ? customdateformat : getDateFormat(fulldate.trim());
    var dt = moment(fulldate.trim(), dateformat);
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

function addHistory(id, itemId, name, data, aliasId) {
    if (exists(id)) {
        var incomingOriginalIds = [id];
        // aliasId may be a single id (existing callers) or an array of
        // candidate ids (e.g. both a legacy alias and the profile's guid -
        // see issue #201) - accept either.
        var aliasCandidates = Array.isArray(aliasId) ? aliasId : [aliasId];
        for (var a = 0; a < aliasCandidates.length; a++) {
            var candidate = aliasCandidates[a];
            if (exists(candidate) && candidate !== "" && normalizeProfileId(candidate) !== normalizeProfileId(id) && incomingOriginalIds.indexOf(candidate) === -1) {
                incomingOriginalIds.push(candidate);
            }
        }
        var incomingNormIds = incomingOriginalIds.map(normalizeProfileId);
        var priorSubmissions = [];
        var priorOriginalIds = [];
        var priorItemIds = [];
        buildhistory = buildhistory.filter(function (entry) {
            if (!idSetsOverlap(getAllHistoryIds(entry), incomingNormIds)) {
                return true;
            }
            if (Array.isArray(entry.data)) {
                priorSubmissions = entry.data;
            } else {
                priorSubmissions = [{date: entry.date, data: exists(entry.data) ? entry.data : ""}];
            }
            priorOriginalIds = [entry.id].concat(Array.isArray(entry.aliasIds) ? entry.aliasIds : []);
            priorItemIds = Array.isArray(entry.itemIds) ? entry.itemIds : (exists(entry.itemId) && entry.itemId !== "" ? [entry.itemId] : []);
            return false;
        });
        var submissions = [{date: Date.now(), data: exists(data) ? data : ""}].concat(priorSubmissions);
        var allOriginalIds = incomingOriginalIds.concat(priorOriginalIds).filter(function (v, idx, arr) {
            return arr.map(normalizeProfileId).indexOf(normalizeProfileId(v)) === idx;
        });
        var primary = pickPrimaryId(allOriginalIds);
        var primaryNorm = normalizeProfileId(primary);
        var aliasIds = allOriginalIds.filter(function (v) { return normalizeProfileId(v) !== primaryNorm; });
        // itemId here may be a source page's own id (auto-pick's match key) or,
        // from the manual "Add to History" button, the Geni destination page's
        // own URL - not the same kind of value at all. Accumulate rather than
        // overwrite, so a later manual add can never destroy the source-page
        // mapping auto-pick actually depends on.
        var itemIds = [String(itemId)].concat(priorItemIds).filter(function (v, idx, arr) {
            if (v === "" || v === "null" || v === "undefined") {
                return false;
            }
            return arr.map(normalizeItemId).indexOf(normalizeItemId(v)) === idx;
        });
        buildhistory.unshift({id: primary, aliasIds: aliasIds, itemIds: itemIds, name: name, date: Date.now(), data: submissions});
        if (buildhistory.length > 300) {
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
    $('#exportprojectsonoffswitch').on('click', function () {
        chrome.storage.local.set({'exportprojectsbutton': this.checked});
        $("#exportprojectschange").css("display", "block");
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

    $('#marriednameonoffswitch').on('click', function () {
        chrome.storage.local.set({'derivemarriednames': this.checked});
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
    $('#compoundlastonoffswitch').on('click', function () {
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
            $('body').css('min-height', '550px');
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
    if (typeof profile === 'object') {
        if (profile.displayname) {
            return profile.displayname;
        }
        if (profile.display_name) {
            return profile.display_name;
        }
        if (profile.displayName) {
            return profile.displayName;
        }
    }
    return profile;
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
            chrome.action.setIcon({ path: "images/icon_warn.png" });
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

function isDictionary(object) {
    return object instanceof Object && object.constructor === Object;
}

// utility
function createQuery(queryObject, keyPrefix) {
    if (queryObject == null || !Object.keys(queryObject).length) return "";
    keyPrefix = keyPrefix ? (keyPrefix + "_") : "";

    const queryKeys = Object.keys(queryObject);
    const queryArray = queryKeys.map(key => {
        const value = queryObject[key];
        if (value) {
            if (isDictionary(value)) {
                return createQuery(value, keyPrefix + key + "_");
            }
            return keyPrefix + encodeURIComponent(key) + "=" + encodeURI(String(value));
        }
        return "";
    });

    return queryArray.filter(Boolean).join("&");
}

chrome.storage.local.get('geonotice', function(result) {
    geonotice = result.geonotice;
    if (!exists(geonotice)) {
        geonotice = true;
    }
    geonoticeLoaded = true;
    maybeStartLogin();
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
    var compoundlast = exists(result.compoundlast) ? result.compoundlast : true;
    $('#compoundlastonoffswitch').prop('checked', compoundlast);
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

chrome.storage.local.get('exportprojectsbutton', function (result) {
    var exportprojectsbutton = result.exportprojectsbutton;
    if (exists(exportprojectsbutton)) {
        $('#exportprojectsonoffswitch').prop('checked', exportprojectsbutton);
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

chrome.storage.local.get('derivemarriednames', function (result) {
    var marriednameschecked = result.derivemarriednames;
    if (exists(marriednameschecked)) {
        $('#marriednameonoffswitch').prop('checked', marriednameschecked);
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
