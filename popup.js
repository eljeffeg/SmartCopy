var devblocksend = false;
var proaccount = true;
var profilechanged = false;
var focusid;
var tablink;
var submitcheck = true;
var dateformatter = ["MMM YYYY", "MMM D YYYY", "YYYY", "MM/ /YYYY"];
//noinspection JSUnusedGlobalSymbols
var expandparent = true; //used in expandAll function window[...] var call
//noinspection JSUnusedGlobalSymbols
var expandpartner = true; //same
//noinspection JSUnusedGlobalSymbols
var expandsibling = true; //same
//noinspection JSUnusedGlobalSymbols
var expandchild = true; //same

// Run script as soon as the document's DOM is ready.
if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str) {
        if (typeof str === "undefined") {
            return false;
        }
        return this.slice(0, str.length) == str;
    }
}
if (typeof String.prototype.endsWith != 'function' ) {
    String.prototype.endsWith = function( str ) {
        if (typeof str === "undefined") {
            return false;
        }
        return this.substring( this.length - str.length, this.length ) === str;
    }
}
if (!String.prototype.contains) {
    String.prototype.contains = function () {
        return String.prototype.indexOf.apply(this, arguments) !== -1;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    console.log(chrome.app.getDetails().name + " v" + chrome.app.getDetails().version);
    checkAccount();
    chrome.tabs.getSelected(null, function (tab) {
        tablink = tab.url;
        if (startsWithRegex(tablink,"http://www\\.myheritage\\.\\w{2,3}/research/collection")) {
            loadLogin();
        } else if (startsWithRegex(tablink,"http://www\\.myheritage\\.\\w{2,3}/matchingresult")) {
            setMessage("#f8ff86", 'SmartCopy Disabled: Please select one of the Matches on this results page.');
        } else {
            setMessage("#f9acac", 'SmartCopy Disabled: The MyHeritage Smart/Record Match page is not detected.')
        }
        if (tablink.startsWith("http://www.geni.com/people/") || tablink.startsWith("http://www.geni.com/family-tree/")) {
            var focusprofile = getProfile(tablink);
            updateLinks(focusprofile);

        }
    });
});

function startsWithRegex(stringToCheck, query) {
    var searchPattern = new RegExp('^' + query, 'i');
    return searchPattern.test(stringToCheck);
}

function updateLinks(focusprofile) {
    $("#historyurl").attr("href", "http://historylink.herokuapp.com/history" + focusprofile);
    $("#graphurl").attr("href", "http://historylink.herokuapp.com/graph" + focusprofile);
}

chrome.extension.onMessage.addListener(function (request, sender, callback) {
    if (request.action == "getSource") {
        /*
         Below checks to make sure the user has not clicked away from the matched profile
         in order to prevent them from copying a family or data to the wrong destination.
         Once you click off the initial match, MH adds a row of tabs - using that as indication.
         */
        if (request.source.indexOf('pk_family_tabs') === -1 || profilechanged) {
            if (tablink.contains("/collection-1/")) {
                document.getElementById("smartcopy-container").style.display = "block";
                document.getElementById("loading").style.display = "block";
                var parsed = $('<div>').html(request.source.replace(/<img[^>]*>/g,""));
                var focusperson = parsed.find(".recordTitle").text().trim();
                var focusrange = parsed.find(".recordSubtitle").text().trim();
                if (!profilechanged) {
                    var focusprofile = parsed.find(".individualInformationProfileLink").attr("href").trim();
                    focusid = focusprofile.replace("http://www.geni.com/", "");
                    updateLinks("?profile=" + focusid);
                }
                document.getElementById("focusname").innerText = focusperson;
                if (focusrange !== "") {
                    document.getElementById("focusrange").innerText = focusrange;
                }
                alldata["profile"] = parseSmartMatch(request.source, proaccount);

                if (!proaccount) {
                    document.getElementById("loading").style.display = "none";
                    $("#familymembers").attr('disabled', 'disabled');
                    setMessage("#f8ff86", 'The copying of Family Members is only available to Geni Pro Members.');
                }
            } else {
                setMessage("#f8ff86", 'This MyHeritage collection is not yet supported.');
            }
        } else {
            var name = $(request.source).find(".individualInformationName").text().trim();
            setMessage("#f8ff86", 'The copy is only supported on the Matched profile ' + name + '.<br/>' +
                '<strong><span id="changetext">Change Geni Destination Profile</span></strong><input type="text" id="changeprofile"><button id="changefocus">Update</button>');
            $(function () {
                $('#changefocus').on('click', function () {
                    var profilelink = getProfile($('#changeprofile')[0].value);
                    if (profilelink !== "" || devblocksend) {
                        updateLinks(profilelink);
                        focusid = profilelink.replace("?profile=", "");
                        document.querySelector('#message').style.display = "none";
                        profilechanged = true;
                        getPageCode();
                    } else {
                        var invalidtext = $("#changetext")[0];
                        invalidtext.innerText = "Invalid Profile Id - Try Again";
                        invalidtext.style.color ='red';
                    }
                });
            });
        }
    }
});

function setMessage(color, messagetext) {
    var message = document.querySelector('#message');
    message.style.backgroundColor = color;
    message.style.display = "block";
    message.innerHTML = messagetext;
}

function getPageCode() {
    chrome.tabs.executeScript(null, {
        file: "getPagesSource.js"
    }, function () {
        // If you try and inject into an extensions page or the webstore/NTP you'll get an error
        if (chrome.extension.lastError) {
            message.innerText = 'There was an error injecting script : \n' + chrome.extension.lastError.message;
        }
    });
}

function checkAccount() {
    var xhr = new XMLHttpRequest();
    var url =
        xhr.open("GET", "http://historylink.herokuapp.com/account?version=" + chrome.app.getDetails().version, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            var response = JSON.parse(xhr.responseText);
            if (response.curator) {
                //display leaderboard link if user is a curator - page itself still verifies
                document.getElementById("curator").style.display = "inline-block";
            }
            proaccount = response.pro;
        }
    };
    xhr.send();
}

function loadLogin() {
    chrome.extension.sendMessage({
        method: "GET",
        action: "xhttp",
        url: "http://historylink.herokuapp.com/smartlogin"
    }, function (responseText) {
        if (responseText.html === "<script>window.open('', '_self', ''); window.close();</script>") {
            console.log("Logged In...");
            getPageCode();
        } else {
            console.log("Logged Out...");
            var w = 600;
            var h = 450;
            var left = (screen.width / 2) - (w / 2);
            var top = (screen.height / 2) - (h / 2);
            //redirect helps it close the window properly.. not sure why
            chrome.windows.create({'url': 'redirect.html', 'type': 'panel', 'width': w, 'height': h, 'left': left, 'top': top, 'focused': true}, function (window) {
                //grab the window.id if needed
            });
        }
    });
}

function getProfile(profile_id) {
    //Gets the profile id from the Geni URL
    if (profile_id.length > 0) {
        if (profile_id.indexOf("profile-") != -1) {
            profile_id = profile_id.substring(profile_id.lastIndexOf('/') + 1);
        }
        if (profile_id.indexOf("/") != -1) {
            //Grab the GUID from a URL
            profile_id = "profile-g" + profile_id.substring(profile_id.lastIndexOf('/') + 1);
        }
        if (profile_id.indexOf("?") != -1) {
            //In case the copy the profile url by navigating through another 6000000002107278790?through=6000000010985379345
            profile_id = profile_id.substring(0, profile_id.lastIndexOf('?'));
        }
        if (profile_id.indexOf("#") != -1) {
            //In case the copy the profile url by navigating in tree view 6000000001495436722#6000000010985379345
            profile_id = "profile-g" + profile_id.substring(profile_id.lastIndexOf('#') + 1, profile_id.length);
        }
        var isnum = /^\d+$/.test(profile_id);
        if (isnum) {
            profile_id = "profile-g" + profile_id;
        }
        if (profile_id.indexOf("profile-") != -1) {
            return "?profile=" + profile_id;
        }
    }
    return "";
}

var exlinks = document.getElementsByClassName("expandlinks");
var sllinks = document.getElementsByClassName("familydiv");

var expandAll = function() {
    var expandmembers = $(this).closest('div').find('.memberexpand');
    for(var i=0;i<expandmembers.length;i++){
        if (window[this.name]) {
            $(expandmembers[i]).slideDown();
            this.innerText = "collapse all";
        } else {
            $(expandmembers[i]).slideUp();
            this.innerText = "expand all";
        }
    }
    window[this.name] = !window[this.name];
};

for(var i=0;i<exlinks.length;i++){
    exlinks[i].addEventListener('click', expandAll, false);
}

for(var i=0;i<sllinks.length;i++){
    sllinks[i].addEventListener('click', function(event) {
        expandFamily(event.target.name);
    });
}


function expandFamily(member) {
    $('#slide'+member).slideToggle();
}

var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
};

function escapeHtml(string) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
        return entityMap[s];
    });
}

function capFL(string)
{   //Capitalize the first letter of the string
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function exists(object) {
    return (typeof object !== "undefined");
}

$(function () {
    $('.checkall').on('click', function () {
        var fs = $(this).closest('div').find('fieldset');
        fs.find(':checkbox').prop('checked', this.checked);
        fs.find('input:text,select').attr('disabled', !this.checked);
    });
});

// Form submission
var submitstatus = [];
var tempspouse;
var partnersubmit = false;
var submitform = function() {
    if (parsecomplete && submitcheck) {

        submitcheck = false; //try to prevent clicking more than once and submitting it twice
        document.getElementById("familydata").style.display = "none";
        document.getElementById("profiledata").style.display = "none";
        document.getElementById("updating").style.display = "block";

        // --------------------- Update Profile Data ---------------------
        var fs = $('#profiletable');
        var profileout = parseForm(fs);
        buildTree(profileout, "update", focusid);



        // --------------------- Add Family Data ---------------------
        var privateprofiles = $('.checkslide');
        for (var profile in privateprofiles) if (privateprofiles.hasOwnProperty(profile)) {
            var entry = privateprofiles[profile];
            if (exists(entry.name) && entry.name.startsWith("checkbox") && entry.checked) {
                fs = $("#" + entry.name.replace("checkbox", "slide"));
                var actionname = entry.name.split("-"); //get the relationship
                if (actionname[1] !== "child") {
                    var familyout = parseForm(fs);
                    buildTree(familyout, "add-" + actionname[1], focusid)
                } else {
                    if (!devblocksend && !partnersubmit) {
                        partnersubmit = true;
                        submitstatus.push(submitstatus.length);
                        chrome.extension.sendMessage({
                            method: "POST",
                            action: "xhttp",
                            url: "http://historylink.herokuapp.com/smartsubmit?profile=" + focusid + "&action=add-partner",
                            data: "",
                            variable: ""
                        }, function (response) {
                            //console.log(response.html);
                            tempspouse = JSON.parse(response.html);
                            submitstatus.pop();
                        });
                    } else if (devblocksend && !partnersubmit) {
                        //Dev testing code - give it some fake data so it doesn't fail
                        partnersubmit = true;
                        tempspouse = JSON.parse('{"id":"profile-34663119235","unions": ["https://www.geni.com/api/union-58259268"]}');
                    }

                }
            }
        }
    }
    submitChildren();
};

function buildTree(data, action, sendid) {
    if(!$.isEmptyObject(data) && !devblocksend) {
        submitstatus.push(submitstatus.length);
        chrome.extension.sendMessage({
            method: "POST",
            action: "xhttp",
            url: "http://historylink.herokuapp.com/smartsubmit?profile=" + sendid + "&action=" + action,
            data: $.param(data),
            variable: ""
        }, function (response) {
            submitstatus.pop();
        });
    } else if (!$.isEmptyObject(data) && devblocksend) {
        console.log("-------------------");
        console.log(JSON.stringify(data));
    }
}

function submitChildren() {
    if (submitstatus.length > 0) {
        setTimeout(submitChildren, 300);
    } else {
        if (partnersubmit) {
            var unionid = tempspouse.unions[0].replace("https://www.geni.com/api/", "");
            // --------------------- Add Family Data ---------------------
            var privateprofiles = $('.checkslide');
            for (var profile in privateprofiles) if (privateprofiles.hasOwnProperty(profile)) {
                var entry = privateprofiles[profile];
                if (exists(entry.name) && entry.name.startsWith("checkbox") && entry.checked) {
                    var fs = $("#" + entry.name.replace("checkbox", "slide"));
                    var actionname = entry.name.split("-"); //get the relationship
                    if (actionname[1] === "child") {
                        var familyout = parseForm(fs);
                        buildTree(familyout, "add-child", unionid)
                    }
                }
            }
        }
        submitWait();
    }
}

function submitWait() {
    if (submitstatus.length > 0) {
        setTimeout(submitWait, 300);
    } else {
        if (partnersubmit) {
            buildTree("", "delete", tempspouse.id);
        }
        document.getElementById("updating").innerHTML = '<div style="text-align: center; font-size: 110%;"><strong>Geni Tree Updated</strong></div>' +
            '<div style="text-align: center; padding:5px;"><b>View Profile:</b> ' +
            '<a href="http://www.geni.com/family-tree/index/' + focusid.replace("profile-g","") + '" target="_blank">tree view</a>, ' +
            '<a href="http://www.geni.com/' + focusid.replace("profile-g","") + '" target="_blank">profile view</a></div>';
        console.log("Tree Updated...");
        if (devblocksend) {
            console.log("******** Dev Mode - Blocked Sending ********")
        }
    }
}

document.getElementById('submitbutton').addEventListener('click', submitform, false);
document.getElementById('submitbutton2').addEventListener('click', submitform, false);

function parseForm(fs) {
    var objentry = {};
    var fsinput = fs.find('input:text,select');
    for (var item in fsinput) if (fsinput.hasOwnProperty(item)) {
        if (exists(fsinput[item].value) && !fsinput[item].disabled) {
            //console.log(fsinput[item].name + ":" + fsinput[item].value);
            var splitentry = fsinput[item].name.split(":");
            if (splitentry.length > 1) {
                if (splitentry[1] === "date") {
                    var vardate = {};
                    var fulldate = fsinput[item].value;

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
                            var dt = moment(btsplit[1].trim(), dateformatter);
                            if (isNaN(btsplit[1])) {
                                var splitd = btsplit[1].split(" ");
                                if (splitd.length > 2) {
                                    vardate["end_day"] = dt.get('date');
                                    vardate["end_month"] = dt.get('month')+1; //+1 because, for some dumb reason, months are indexed to 0
                                } else {
                                    vardate["end_month"] = dt.get('month')+1; //+1 because, for some dumb reason, months are indexed to 0
                                }
                            }
                            vardate["end_year"] = dt.get('year');
                        }

                    }
                    var dt = moment(fulldate.trim(), dateformatter);
                    //TODO Probably need to do some more checking below to make sure it doesn't improperly default dates
                    if (isNaN(fulldate)) {
                        var splitd = fulldate.split(" ");
                        if (splitd.length > 2) {
                            vardate["day"] = dt.get('date');
                            vardate["month"] = dt.get('month')+1; //+1 because, for some dumb reason, months are indexed to 0
                        } else {
                            vardate["month"] = dt.get('month')+1; //+1 because, for some dumb reason, months are indexed to 0
                        }
                    }
                    vardate["year"] = dt.get('year');

                    if (!exists(objentry[splitentry[0]])) {
                        objentry[splitentry[0]] = {};
                    }
                    var finalentry = {};
                    finalentry[splitentry[1]] = vardate;
                    $.extend(objentry[splitentry[0]], finalentry);


                } else if (splitentry[1] === "location" && splitentry.length > 2) {
                    if (!exists(objentry[splitentry[0]])) {
                        objentry[splitentry[0]] = {};
                    }
                    var geocheck = $('#geoonoffswitch').prop('checked');
                    var fieldname = splitentry[2];
                    if (geocheck && fieldname === "place_name") {
                        continue;
                    } else if (!geocheck && fieldname !== "place_name") {
                        continue;
                    }
                    if (fieldname === "place_name_geo") {
                        fieldname = "place_name";
                    }
                    var varlocation = {};
                    varlocation[fieldname] = fsinput[item].value;
                    if (!exists(objentry[splitentry[0]][splitentry[1]])) {
                        objentry[splitentry[0]][splitentry[1]] = {};
                    }
                    $.extend(objentry[splitentry[0]][splitentry[1]], varlocation);
                }
            } else {
                if (fsinput[item].name === "gender") {
                    objentry[fsinput[item].name] = fsinput[item].options[fsinput[item].selectedIndex].value;
                } else {
                    objentry[fsinput[item].name] = fsinput[item].value;
                }
            }
        }
        //var entry = focusprofile[profile];
        //console.log(entry);
    }
    return objentry;
}


// ----- Persistent Options -----
$(function () {
    $('#privateonoffswitch').on('click', function() {
        chrome.storage.local.set({'autoprivate': this.checked});
        //TODO could check if each field has data before enabling to avoid submitting unnecessary fields
        var profilegroup = $('.checkall');
        for (var group in profilegroup) if (profilegroup.hasOwnProperty(group)) {
            if(profilegroup[group].checked) { //only check it if the section is checked
                var privateprofiles = $(profilegroup[group]).closest('div').find('.checkslide');
                for (var profile in privateprofiles) if (privateprofiles.hasOwnProperty(profile)) {
                    if (exists(privateprofiles[profile].name) && privateprofiles[profile].name.startsWith("checkbox")) {
                        if ($(privateprofiles[profile]).next().text().startsWith("\<Private\>")) {
                            $(privateprofiles[profile]).prop('checked', !this.checked);
                            var fs = $("#" + privateprofiles[profile].name.replace("checkbox", "slide"));
                            fs.find(':checkbox').prop('checked', !this.checked);
                            fs.find('input:text').attr('disabled', this.checked);
                        }
                    }
                }
            }
        }
    });
    $('#geoonoffswitch').on('click', function () {
        chrome.storage.local.set({'autogeo': this.checked});
        if (this.checked) {
            var locobj = document.getElementsByClassName("geoloc");
            for (var i=0;i < locobj.length; i++) {
                locobj[i].style.display = "table-row";
                $(locobj[i]).find(":input").prop("disabled", false);
            }
            var placeobj = document.getElementsByClassName("geoplace");
            for (var i=0;i < placeobj.length; i++) {
                placeobj[i].style.display = "none";
                $(placeobj[i]).find(":input").prop("disabled", true);
            }

        } else {
            var locobj = document.getElementsByClassName("geoloc");
            for (var i=0;i < locobj.length; i++) {
                locobj[i].style.display = "none";
                $(locobj[i]).find(":input").prop("disabled", true);
            }
            var placeobj = document.getElementsByClassName("geoplace");
            for (var i=0;i < placeobj.length; i++) {
                placeobj[i].style.display = "table-row";
                $(placeobj[i]).find(":input").prop("disabled", false);
            }
        }
    });
    $('#birthonoffswitch').on('click', function() {
        chrome.storage.local.set({'autobirth': this.checked});
        var profilegroup = $('.checkall');
        for (var group in profilegroup) if (profilegroup.hasOwnProperty(group)) {
            if(profilegroup[group].id === "addchildck" || profilegroup[group].id === "addsiblingck") {
                var privateprofiles = $(profilegroup[group]).closest('div').find('.checkslide');
                for (var profile in privateprofiles) if (privateprofiles.hasOwnProperty(profile)) {
                    if (exists(privateprofiles[profile].name) && privateprofiles[profile].name.startsWith("checkbox")) {
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
            }
        }
    });
});

chrome.storage.local.get('autogeo', function (result) {
    var geochecked = result.autogeo;
    if(exists(geochecked)) {
        $('#geoonoffswitch').prop('checked', geochecked);
    }
});

chrome.storage.local.get('autoprivate', function (result) {
    var privatechecked = result.autoprivate;
    if(exists(privatechecked)) {
        $('#privateonoffswitch').prop('checked', privatechecked);
    }
});

chrome.storage.local.get('autobirth', function (result) {
    var birthchecked = result.autobirth;
    if(exists(birthchecked)) {
        $('#birthonoffswitch').prop('checked', birthchecked);
    }
});