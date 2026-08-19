//Shared Variables between popup and context scripts
var smartcopyurl = "https://historylink.herokuapp.com";  //helpful for local testing to switch from https to http
var genifamily, focusid, tabuniondatalink;
var familystatus = [], genifamilydata = {};
var focusgender = "unknown";
var uniondata = [];

// Run script as soon as the document's DOM is ready.
if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str) {
        if (typeof str === "undefined") {
            return false;
        }
        return this.slice(0, str.length) == str;
    }
}
if (typeof String.prototype.endsWith != 'function') {
    String.prototype.endsWith = function (str) {
        if (typeof str === "undefined") {
            return false;
        }
        return this.substring(this.length - str.length, this.length) === str;
    }
}
if (!String.prototype.contains) {
    String.prototype.contains = function () {
        return String.prototype.indexOf.apply(this, arguments) !== -1;
    }
}

function exists(object) {
    return (typeof object !== "undefined" && object !== null);
}

// #211: chrome.i18n.getMessage() has no fallback option of its own - if the
// browser's active locale (e.g. es/fi/he, all badly incomplete as of this
// writing) is missing a key, it returns "" rather than falling back to
// manifest.json's declared default_locale ("en"), even though Chrome does
// use default_locale when NO locale folder at all matches the browser's
// language. That fallback only ever applies at the whole-locale level, never
// per-key. There's also no API to ask chrome.i18n for a specific locale's
// text at runtime - the only way to get a per-key fallback is a JS-side copy
// of the English text this wrapper can reach for when Chrome's own lookup
// comes back empty. EN_FALLBACK_MESSAGES (locale_fallback_en.js, loaded
// before this file) is that copy, generated from the real
// _locales/en/messages.json by scripts/generate-locale-fallback.js rather
// than hand-duplicated.
//
// This is now the one canonical _() - it used to be defined identically
// (a bare chrome.i18n.getMessage() passthrough, no fallback) in popup.js,
// research.js, and content.js separately; centralized here since all three
// contexts already load shared.js.
function _(messageName, substitutions) {
    var result = chrome.i18n.getMessage(messageName, substitutions);
    if (result !== "") {
        return result;
    }
    if (typeof EN_FALLBACK_MESSAGES === "undefined" || !EN_FALLBACK_MESSAGES.hasOwnProperty(messageName)) {
        return result;
    }
    return applyLocaleFallbackSubstitutions(EN_FALLBACK_MESSAGES[messageName], substitutions);
}

// Replays chrome.i18n's own message-substitution algorithm
// (https://developer.chrome.com/docs/extensions/reference/api/i18n#placeholders)
// against a raw messages.json entry, since the fallback path bypasses
// chrome.i18n.getMessage() entirely (that's the whole point - it's the one
// that just returned "") and so never gets Chrome's own substitution
// handling for free.
function applyLocaleFallbackSubstitutions(entry, substitutions) {
    var message = entry.message;
    var placeholders = entry.placeholders || {};
    // $placeholderName$ -> the placeholder's own "content" template (e.g.
    // "$1") - matched case-insensitively per Chrome's spec, hence the
    // lowercase lookup against placeholder keys (which the real
    // messages.json always defines in lowercase).
    message = message.replace(/\$([A-Za-z0-9_@]+)\$/g, function (match, name) {
        var key = name.toLowerCase();
        return placeholders.hasOwnProperty(key) ? placeholders[key].content : match;
    });
    // $1, $2, ... -> the caller's substitutions. Chrome's own API accepts
    // either a single string (treated as just $1) or an array - matched
    // here for parity.
    var subs = Array.isArray(substitutions) ? substitutions : (exists(substitutions) ? [substitutions] : []);
    message = message.replace(/\$(\d+)/g, function (match, num) {
        var index = parseInt(num, 10) - 1;
        return exists(subs[index]) ? subs[index] : match;
    });
    // $$ -> a literal $ - Chrome's escape mechanism. Applied last so it
    // can't interfere with the $name$/$digit patterns matched above.
    message = message.replace(/\$\$/g, "$");
    return message;
}

function isValidDate(d) {
    return d instanceof Date && !isNaN(d);
}

function startsWithHTTP(url, match) {
    //remove protocol and comapre
    url = url.replace("https://", "").replace("http://", "");
    match = match.replace("https://", "").replace("http://", "");
    return url.startsWith(match);
}

function isGeni(url) {
    return (startsWithHTTP(url,"http://www.geni.com/people") || startsWithHTTP(url,"http://www.geni.com/family-tree") || startsWithHTTP(url,"http://www.geni.com/profile"));
}

function isGeniProject(url) {
    return startsWithHTTP(url,"http://www.geni.com/projects")
}

function getProject(project_id) {
    return project_id.substring(project_id.lastIndexOf('/') + 1).replace("#", "");
}

function getProfile(profile_id) {
    //Gets the profile id from the Geni URL
    if (profile_id.length > 0) {
        var startid = profile_id.toLowerCase();
        profile_id = decodeURIComponent(profile_id).trim();
        if (profile_id.indexOf("&resolve=") != -1) {
            profile_id = profile_id.substring(profile_id.lastIndexOf('#') + 1);
        }
        if (profile_id.indexOf("profile-") != -1) {
            profile_id = profile_id.substring(profile_id.lastIndexOf('/') + 1);
        }
        if (profile_id.indexOf("#/tab") != -1) {
            profile_id = profile_id.substring(0, profile_id.lastIndexOf('#/tab'));
        }
        if (profile_id.indexOf("/") != -1) {
            //Grab the GUID from a URL
            profile_id = profile_id.substring(profile_id.lastIndexOf('/') + 1);
        }
        if (profile_id.indexOf("?through") != -1) {
            //In case the copy the profile url by navigating through another 6000000002107278790?through=6000000010985379345
            //But skip 6000000029660962822?highlight_id=6000000029660962822#6000000028974729472
            profile_id = "profile-g" + profile_id.substring(0, profile_id.lastIndexOf('?'));
        }
        if (profile_id.indexOf("?from_flash") != -1) {
            profile_id = "profile-g" + profile_id.substring(0, profile_id.lastIndexOf('?'));
        }
        if (profile_id.indexOf("?highlight_id") != -1) {
            profile_id = "profile-g" + profile_id.substring(profile_id.lastIndexOf('=') + 1, profile_id.length);
        }
        if (profile_id.indexOf("#") != -1) {
            //In case the copy the profile url by navigating in tree view 6000000001495436722#6000000010985379345
            if (profile_id.contains("html5")) {
                profile_id = "profile-" + profile_id.substring(0, profile_id.lastIndexOf('#'));
            } else {
                profile_id = "profile-g" + profile_id.substring(0, profile_id.lastIndexOf('#'));
            }
        }
        var isnum = /^\d+$/.test(profile_id);
        if (isnum) {
            if (profile_id.length > 16) {
                profile_id = "profile-g" + profile_id;
            } else if (startid.contains("www.geni.com/people") || startid.contains("www.geni.com/family-tree")) {
                profile_id = "profile-g" + profile_id;
            } else {
                profile_id = "profile-" + profile_id;
            }
        }
        var validate = profile_id.replace("profile-g", "").replace("profile-", "").replace("#","");
        if (isNaN(validate)) {
            profile_id = "";
        }
        if (profile_id.indexOf("profile-") != -1 && profile_id !== "profile-g") {
            return "?profile=" + profile_id;
        } else if (tablink !== "https://www.geni.com/family-tree") {
            console.log("Profile ID not detected: " + startid);
            console.log("URL: " + tablink);
            return "";
        }
    }
    return "";
}


function GeniPerson(obj) {
    this.person = obj;
    this.get = function (path, subpath) {
        var obj = this.person;
        if (path === "name_language") {
            if (obj["names"] === undefined) {
                return "en-US"
            } else {
                for (lang in obj["names"]) {
                    if (Object.keys(obj["names"][lang]).length > 0) {
                        return lang
                    }
                }
            }
        }
        if (path === "names" && subpath !== undefined && obj[path] === undefined && subpath.substring(0,5) === "en-US") {
            // names object only exists if there is more than one language on the profile
            path = subpath.substring(6,subpath.length)
            subpath = undefined
        }
        if (path == "photo_urls") {
            if (checkNested(this.person,"photo_urls", "medium")) {
                return this.person["photo_urls"].medium;
            } else {
                return geniPhoto(this.person.gender);
            }
        } else if (!obj.hasOwnProperty(path)) {
            return "";
        } else if (!exists(subpath)) {
            if (typeof obj[path] === 'string' || obj[path] instanceof String) {
                obj[path] = obj[path].replace(/"/g, "&quot;");
            } else {
                for (var i = 0; i < obj[path].length; i++) {
                    obj[path][i] = obj[path][i].replace(/"/g, "&quot;");
                }
            }
            return obj[path];
        } else {
            obj = obj[path];
            if (subpath === "location_string" && exists(obj.location) && exists(obj.location.formatted_location)) {
                subpath = "location.formatted_location";
            }
            if (subpath === "date.formatted_date" && typeof obj["date"] === 'string') {
                subpath = "date";
            }
            var args = subpath.split(".");
            for (var i = 0; i < args.length; i++) {
                if (!obj || !obj.hasOwnProperty(args[i])) {
                    return "";
                }
                obj = obj[args[i]];
            }
            return obj;
        }
    };
    this.set = function (path, data) {
       this.person[path] = data;
    };
    this.isLocked = function (path, subpath) {
        var obj = this.person;
        if (!obj.hasOwnProperty("locked_fields")) {
            return false;
        }
        obj = obj["locked_fields"];
        if (!obj.hasOwnProperty(path)) {
            return false;
        } else if (!exists(subpath)) {
            return obj[path];
        } else {
            obj = obj[path];
            var args = subpath.split(".");
            for (var i = 0; i < args.length; i++) {
                if (!obj || !obj.hasOwnProperty(args[i])) {
                    return false;
                }
                obj = obj[args[i]];
            }
            return obj;
        }
    };
    this.lockIcon = function(path, subpath) {
        if (this.isLocked(path, subpath)) {
            return "lock.png";
        } else {
            return "right.png";
        }
    };
}

function isFemale(title) {
    if (!exists(title)) { return false; }
    title = title.toLowerCase().replace(" (implied)", "");
    return (title === "wife" || title === "ex-wife" || title === "mother" || title === "sister" || title === "daughter" || title === "female" || title === "f");
}

function isMale(title) {
    if (!exists(title)) { return false; }
    title = title.toLowerCase().replace(" (implied)", "");
    return (title === "husband" || title === "ex-husband" || title === "father" || title === "brother" || title === "son" || title === "male" || title === "m");
}

function isSibling(relationship) {
    if (!exists(relationship)) { return false; }
    relationship = relationship.toLowerCase().replace(" (implied)", "");
    return (relationship === "siblings" || relationship === "sibling" || relationship === "brother" || relationship === "sister" || relationship === "bro" || relationship === "sis");
}

function isChild(relationship) {
    if (!exists(relationship)) { return false; }
    relationship = relationship.toLowerCase().replace(" (implied)", "");
    return (relationship === "children" || relationship === "child" || relationship === "son" || relationship === "daughter" || relationship === "dau");
}

function isParent(relationship) {
    if (!exists(relationship)) { return false; }
    relationship = relationship.toLowerCase().replace(" (implied)", "");
    return (relationship === "parents" || relationship === "father" || relationship === "mother" || relationship === "parent" || relationship === "moth" || relationship === "fath");
}

function isPartner(relationship) {
    if (!exists(relationship)) { return false; }
    relationship = relationship.toLowerCase().replace(" (implied)", "");
    return (relationship === "spouse" || relationship === "wife" || relationship === "husband" || relationship === "partner" || relationship === "ex-husband" || relationship === "ex-wife" || relationship === "ex-partner" || relationship === "ex_husband" || relationship === "ex_wife" || relationship === "ex_partner" || relationship === "spouses");
}

function getGeniData(profile, value, subvalue) {
    if (profile === "add") {
        if (value === "photo_urls") {
            return geniPhoto('unknown');
        }
        return "";
    }
    var person = genifamilydata[profile];
    if (!exists(person)) {
        return "";
    }
    return person.get(value, subvalue);
}

function getUnionData(union, value) {
    if (exists(union[value])) {
        return union[value];
    } else {
        return "";
    }
}

function getFocus() {
    return genifamily["focus"].id;
}

function getParents() {
    var familyset = [];
    var focusid = getFocus();
    var focus = getGeniData(focusid, "edges");
    for (var union in focus) {
        if (!focus.hasOwnProperty(union)) continue;
        if (isChild(focus[union].rel) && !exists(focus[union].rel_modifier)) {
            var edges = uniondata[union]["edges"];
            for (var profile in edges) {
                if (!edges.hasOwnProperty(profile)) continue;
                if (isPartner(edges[profile].rel)) {
                    var person = genifamilydata[profile];
                    person.set("relation", getRelationship("parent", person.get("gender")));
                    person.set("union", getUnionData(uniondata[union], "id"));
                    person.set("status", getUnionData(uniondata[union], "status"));
                    if ("marriage" in uniondata[union]) {
                        person.set("marriage", uniondata[union]["marriage"]);
                    }
                    if ("divorce" in uniondata[union]) {
                        person.set("divorce", uniondata[union]["divorce"]);
                    }
                    familyset.push(profile);
                }
            }
        }
    }
    return familyset;
}

function getParentSets(focus, parents) {
    var focusedge = getGeniData(focus, "edges");
    var parentset = {};
    for (var union in focusedge) {
        if (!focusedge.hasOwnProperty(union)) continue;
        if (isChild(focusedge[union].rel)) {
            for (var i=0; i < parents.length; i++) {
                var parentedge = getGeniData(parents[i], "edges");
                for (var punion in parentedge) {
                    if (!parentedge.hasOwnProperty(punion)) continue;
                    if (punion === union) {
                        if (!exists(parentset[union])) {
                            parentset[union] = [];
                        }
                        if (parentset[union].indexOf(parents[i]) == -1) {
                            parentset[union].push(parents[i]);
                        }
                    }
                }
            }
        }

    }
    return parentset;
}

function getChildren(focusid, partner) {
    var familyset = [];
    var focus = getGeniData(focusid, "edges");
    for (var union in focus) {
        if (!focus.hasOwnProperty(union)) continue;
        if (isPartner(focus[union].rel)) {
            if (!exists(uniondata[union])) {
                return familyset;
            }
            var edges = uniondata[union]["edges"];
            var loopedges = false;
            if (exists(partner) && partner in edges) {
                loopedges = true;
            } else if (!exists(partner)) {
                loopedges = true;
            }
            if (loopedges) {
                for (var profile in edges) {
                    if (!edges.hasOwnProperty(profile)) continue;
                    if (isChild(edges[profile].rel) && !exists(edges[profile].rel_modifier)) {

                        var person = genifamilydata[profile];
                        person.set("relation", getRelationship("child", person.get("gender")));
                        person.set("union", getUnionData(uniondata[union], "id"));
                        person.set("status", "");
                        familyset.push(profile);
                    }
                }
            }

        }
    }
    return familyset;
}

function getSiblings() {
    var familyset = [];
    var focusid = getFocus();
    var focus = getGeniData(focusid, "edges");
    for (var union in focus) {
        if (!focus.hasOwnProperty(union)) continue;
        if (isChild(focus[union].rel) && !exists(focus[union].rel_modifier)) {
            var edges = uniondata[union]["edges"];
            for (var profile in edges) {
                if (!edges.hasOwnProperty(profile)) continue;
                if (isChild(edges[profile].rel) && profile !== focusid) {
                    var person = genifamilydata[profile];
                    person.set("relation", getRelationship("sibling", person.get("gender")));
                    person.set("union", getUnionData(uniondata[union], "id"));
                    person.set("status", "");
                    familyset.push(profile);
                }
            }
        }
    }
    return familyset;
}

function getPartners() {
    var familyset = [];
    var focusid = getFocus();
    var focus = getGeniData(focusid, "edges");
    for (var union in focus) {
        if (!focus.hasOwnProperty(union)) continue;
        if (isPartner(focus[union].rel)) {
            var edges = uniondata[union]["edges"];
            for (var profile in edges) {
                if (!edges.hasOwnProperty(profile)) continue;
                if (isPartner(edges[profile].rel) && profile !== focusid) {
                    var person = genifamilydata[profile];
                    person.set("relation", getRelationship("partner", person.get("gender")));
                    person.set("union", getUnionData(uniondata[union], "id"));
                    person.set("status", getUnionData(uniondata[union], "status"));
                    if ("marriage" in uniondata[union]) {
                        person.set("marriage", uniondata[union]["marriage"]);
                    }
                    if ("divorce" in uniondata[union]) {
                        person.set("divorce", uniondata[union]["divorce"]);
                    }
                    familyset.push(profile);
                }
            }
        }
    }
    return familyset;
}

function getRelationship(relationship, gender) {
    if (isParent(relationship)) {
        if (isMale(gender)) {
            return "father";
        } else if (isFemale(gender)) {
            return "mother";
        } else {
            return "parent";
        }
    } else if (isPartner(relationship)) {
        if (isMale(gender)) {
            return "husband";
        } else if (isFemale(gender)) {
            return "wife";
        } else {
            return "spouse";
        }
    } else if (isSibling(relationship)) {
        if (isMale(gender)) {
            return "brother";
        } else if (isFemale(gender)) {
            return "sister";
        } else {
            return "sibling";
        }
    } else if (isChild(relationship)) {
        if (isMale(gender)) {
            return "son";
        } else if (isFemale(gender)) {
            return "daughter";
        } else {
            return "child";
        }
    }
    return "";
}

function reverseRelationship(relationship) {
    if (relationship === "wife") {
        return "husband";
    } else if (relationship === "husband") {
        return "wife";
    } else if (relationship === "son" || relationship === "daughter" || relationship === "child" || relationship === "children") {
        if (focusgender === "male") {
            return "father";
        } else if (focusgender === "female") {
            return "mother";
        } else {
            return "parent";
        }
    } else if (relationship === "parents" || relationship === "parent" || relationship === "father" || relationship === "mother") {
        if (focusgender === "male") {
            return "son";
        } else if (focusgender === "female") {
            return "daughter";
        } else {
            return "child";
        }
    } else if (relationship === "siblings" || relationship === "sibling" || relationship === "sister" || relationship === "brother") {
        if (focusgender === "male") {
            return "brother";
        } else if (focusgender === "female") {
            return "sister";
        } else {
            return "sibling";
        }
    } else if (relationship === "partner") {
        return "partner";
    } else if (relationship === "ex-wife") {
        return "ex-husband";
    } else if (relationship === "ex-husband") {
        return "ex-wife";
    } else if (relationship === "ex-partner") {
        return "ex-partner";
    } else {
        return "";
    }
}

function updateUrlParam(url, paramName, paramValue) {
    if (paramValue == null) {
        paramValue = '';
    }
    var pattern = new RegExp('\\b('+paramName+'=).*?(&|#|$)');
    if (url.search(pattern)>=0) {
        return url.replace(pattern,'$1' + paramValue + '$2');
    }
    url = url.replace(/[?#]$/,'');
    return url + (url.indexOf('?')>0 ? '&' : '?') + paramName + '=' + paramValue;
}


function getUrlParam(url, paramName, defaultValue = undefined) {
    var params = {};
	var parser = document.createElement('a');
	parser.href = url;
    params = parser.search.substring(1)

    let searchParams = new URLSearchParams(params)

    if (searchParams.has(paramName)) {
        return searchParams.get(paramName);
    }

    return defaultValue;
}

// Family card/profile hrefs on some sites (e.g. React Router links) are
// site-relative ("/individualsheet?...") rather than absolute - fine for
// same-site navigation, but this same value is also carried through as a
// family member's "url" and used verbatim to build the Geni About-reference
// link, where a relative path produces a broken/non-clickable reference.
// Shared by collections/ancestrynew.js and collections/filae.js, which
// each had their own byte-identical copy of this before.
function resolveRelativeUrl(url, baseOrigin) {
    if (exists(url) && url.startsWith("/")) {
        return baseOrigin + url;
    }
    return url;
}

// #210: moved here from popup.js - content.js (a content script, per
// manifest.json's content_scripts) never loads popup.js, only
// jquery/jquery.csv/moment/parse-names/shared.js/content.js, so
// escapeHtml() calls added to content.js for #210 would have thrown
// "escapeHtml is not defined" the moment they ran on a real Geni page.
// shared.js is the one file every context (popup.html's script chain
// AND the geni.com content script) already loads, so this is the only
// place a helper needed by both can safely live.
var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;',
    "`": '&DiacriticalGrave;'
};

// The ampersand entry was previously keyed to "& " (with a trailing
// space) in both entityMap and this regex, so a bare "&" not immediately
// followed by a space - "AT&T", or one at the end of a string - was never
// escaped at all. Order matters here: "&" must be replaced by the same
// single pass as the others (one combined regex/replace, not "&" first
// then the rest as two separate calls) - replacing "&" in an earlier pass
// would then have its own output's "&" re-matched by a later pass over
// "<>\"'`/", double-escaping entities this function just introduced.
function escapeHtml(string) {
    return String(string).replace(/[&<>"'`\/]/g, function (s) {
        return entityMap[s];
    });
}