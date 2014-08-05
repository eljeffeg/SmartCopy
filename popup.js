var proaccount = true;
var focusid;
var tablink;
var expandparents = true;
var expandparners = true;
var expandsiblings = true;
var expandchildren = true;

// Run script as soon as the document's DOM is ready.
if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str) {
        return this.slice(0, str.length) == str;
    };
}
if (typeof String.prototype.endsWith != 'function' ) {
    String.prototype.endsWith = function( str ) {
        return this.substring( this.length - str.length, this.length ) === str;
    }
};
if (!String.prototype.contains) {
    String.prototype.contains = function () {
        return String.prototype.indexOf.apply(this, arguments) !== -1;
    };
}

document.addEventListener('DOMContentLoaded', function () {
    checkAccount();
    chrome.tabs.getSelected(null, function (tab) {
        tablink = tab.url;
        if (tablink.startsWith("http://www.myheritage.com/research/collection")) {
            loadLogin();
        } else {
            setMessage("#f9acac", 'SmartCopy Disabled: The MyHeritage Smart/Record Match page is not detected.')
        }
        if (tablink.startsWith("http://www.geni.com/people/") || tablink.startsWith("http://www.geni.com/family-tree/")) {
            var focusprofile = getProfile(tablink);
            updateLinks(focusprofile);

        }
    });
});

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
        if (request.source.indexOf('pk_family_tabs') === -1) {
            if (tablink.contains("/collection-1/")) {
                document.getElementById("smartcopy-container").style.display = "block";
                document.getElementById("loading").style.display = "block";
                var parsed = $('<div>').html(request.source.replace(/<img[^>]*>/g,""));
                var focusperson = parsed.find(".recordTitle").text().trim();
                var focusprofile = parsed.find(".individualInformationProfileLink").attr("href").trim();
                var focusrange = parsed.find(".recordSubtitle").text().trim();
                focusid = focusprofile.replace("http://www.geni.com/", "");
                updateLinks("?profile=" + focusid);
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
            setMessage("#f8ff86", 'The copy is only supported on the Matched profile ' + name + ".");
        }
    }
});

function setMessage(color, messagetext) {
    var message = document.querySelector('#message');
    message.style.backgroundColor = color;
    message.style.display = "block";
    message.innerText = messagetext;
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
    xhr.open("GET", "http://historylink.herokuapp.com/account", true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            var response = JSON.parse(xhr.responseText);
            if (response.curator) {
                //display leaderboard link if user is a curator - page itself still verifies
                document.getElementById("curator").style.display = "inline-block";
            }
            proaccount = response.pro;
        }
    }
    xhr.send();
}

function loadLogin() {
    chrome.extension.sendMessage({
        method: "GET",
        action: "xhttp",
        url: "http://historylink.herokuapp.com/smart"
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
            //redirect helps it close properly.. not sure why
            chrome.windows.create({'url': 'redirect.html', 'type': 'panel', 'width': w, 'height': h, 'left': left, 'top': top, 'focused': true}, function (window) {
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

$("input:checkbox").click(function() {
    $("input:text").attr("disabled", !this.checked);
});

$(function () {
    $('.checkall').on('click', function () {
        var fs = $(this).closest('div').find('fieldset');
        fs.find(':checkbox').prop('checked', this.checked);
    });
});

// ----- Persistent Options -----
$(function () {
    $('#geoonoffswitch').on('click', function () {
        chrome.storage.local.set({'autogeo': this.checked});
        if (this.checked) {
            var locobj = document.getElementsByClassName("geoloc");
            for (var i=0;i < locobj.length; i++) {
                locobj[i].style.display = "table-row";
                $(locobj[i]).children(":input").prop("disabled", false);
            }
            var placeobj = document.getElementsByClassName("geoplace");
            for (var i=0;i < placeobj.length; i++) {
                placeobj[i].style.display = "none";
                $(placeobj[i]).children(":input").prop("disabled", true);
            }
           // .style.display = "table-row";
            //document.getElementsByClassName("geoplace")[0].style.display = "none";
            //$('#divID').children(":input").prop("disabled", true); // disable

        } else {
            //document.getElementsByClassName("geoloc").style.display = "none";
           // document.getElementsByClassName("geoplace")[0].style.display = "table-row";
            var locobj = document.getElementsByClassName("geoloc");
            for (var i=0;i < locobj.length; i++) {
                locobj[i].style.display = "none";
                $(locobj[i]).children(":input").prop("disabled", true);
            }
            var placeobj = document.getElementsByClassName("geoplace");
            for (var i=0;i < placeobj.length; i++) {
                placeobj[i].style.display = "table-row";
                $(placeobj[i]).children(":input").prop("disabled", false);
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