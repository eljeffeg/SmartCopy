//Shared Variables between popup and context scripts
var smartcopyurl = "https://historylink.herokuapp.com";  //helpful for local testing to switch from https to http
var genifamily, focusid, tabuniondatalink;
var familystatus = [], genifamilydata = {};
var focusgender = "unknown";
var uniondata = [];

// #213: Deep Research controls (persistent on/off setting + a live per-run
// skip), declared here rather than popup.js since every collections/*.js
// tab-fetch queue needs to read them directly as bare globals, and
// shared.js is the one script guaranteed to load before both popup.js and
// every collections/*.js file. deepResearchOn mirrors chrome.storage.local's
// 'deepresearchenabled' key (see popup.js) and is fixed for the popup's
// lifetime otherwise. deepResearchSkipRun is never persisted - it's reset to
// false at the start of every new "read family data" run so a skip never
// silently carries over onto the next profile.
var deepResearchOn = true;
var deepResearchSkipRun = false;

// #231 follow-up (live-reported): the eyeball icon - even after being
// fixed to reflect current state rather than the click action - was
// still confusing at a glance (an eye-open vs. eye-slashed glyph
// requires interpreting a small color/shape difference). Replaced with
// a plain text toggle: a disclosure-triangle glyph (▶ collapsed, ▼
// expanded) paired with a label naming the click action itself ("Show
// all" / "Show less") - the triangle still reflects current state
// (Apple HIG convention, same reasoning #231 already established), the
// text just makes the action unambiguous without requiring any icon
// interpretation at all.
//
// popup.html's own static <span id="focusshowhide"> tag can't
// reference a JS constant (it's plain HTML, not templated) - its
// initial text is SHOW_ALL_LABEL hardcoded directly, matching the
// default collapsed state ("Hide Empty Fields" defaults on). Keep both
// in sync if this label ever changes.
// Leading space is intentional and load-bearing, not stray whitespace -
// the focus-profile placement (popup.html) sits this span directly after
// plain "Update Profile" text with no space of its own, and CSS
// padding-left alone wasn't rendering enough visual separation (live-
// reported: "Update Profile▶ Show all" ran together).
// Small solid triangles (▸/▾), not full-size (▶/▼) - live-reported the
// full-size glyphs read as bold regardless of font-weight, since
// font-weight has no effect on a filled Unicode symbol's shape; these
// are a dedicated smaller variant, still filled rather than outline.
var SHOW_ALL_LABEL = ' ▸ Show all fields';
var SHOW_LESS_LABEL = ' ▾ Hide unused fields';

// Registry of abort callbacks for every Deep Research tab fetch currently
// in flight (one entry per open tab, across all four collections). Skipping
// mid-run only needs to stop FUTURE tabs from starting (the runNext*TabFetch
// gate above handles that) - clicking skip while a tab is already open and
// polling would otherwise still wait out that tab's own multi-second
// timeout before the run actually finishes. Each run*TabFetch() pushes its
// own abort function here when its tab opens and removes it once settled;
// the skip button (popup.js) calls every entry immediately on click.
var deepResearchInFlightAborts = [];

// #208: mirrors chrome.storage.local's 'estimatebirthyears' key (see
// popup.js), default OFF - this feature writes inferred, not sourced,
// data. Not read directly inside the pure estimation functions in
// buildform.js (getMemberSpouse()/getChildGroupAnchorYear()/
// estimateBirthYear()) - those stay DOM/global-free on purpose so they can
// be extracted and run standalone in this project's synthetic test
// harnesses; the actual on/off gate is checked via
// $('#estimatebirthyearsonoffswitch').prop('checked') at the two call
// sites in buildForm() instead, matching how most other per-feature
// toggles are already read directly in buildform.js (e.g.
// birthonoffswitch). This global exists for consistency with the Deep
// Research pattern above and for any future use outside buildForm()'s
// own scope.
var estimateBirthYearsOn = true;

// #223/#224 follow-up: mirrors chrome.storage.local's
// 'familysearchplaces' key (see popup.js). This queries an
// UNAUTHENTICATED FamilySearch beta endpoint (apibeta.familysearch.org)
// that has no registered API key backing it and isn't a documented/
// sanctioned access path (see issue #224 - FamilySearch's own Solution
// Provider application, the only route to a real production key,
// explicitly rejects a project shaped like this one). FamilySearch's own
// docs describe this tier as an "older production data snapshot" whose
// "availability varies" - it could change or disappear without notice,
// so every call site built on this must degrade silently to the existing
// Google/raw-string fallback, never block location parsing on it.
// #229: DEFAULT true for a fresh install as of here, per explicit
// decision - FamilySearch's date-aware historical resolution
// outperformed Google's in live testing throughout #224/#227/#228, and
// Google requires a per-user paid API key to do anything at all, which
// FamilySearch doesn't. The risk above is real and unchanged - just
// judged worth it as the new default, not eliminated. Read directly via
// $('#familysearchplacesonoffswitch').prop('checked') at its one call
// site in parse-location.js's queryGeo(), matching how the Google geo
// toggle itself is read (geoqueryCheck()) rather than off this global -
// this global exists for consistency with the other feature-flag
// globals in this file.
var familysearchPlacesOn = true;

// #241: burial locations conventionally show the place name as it's
// known TODAY (useful for someone actually visiting the grave), not the
// historic name at time of death - the opposite of every other event,
// which deliberately resolves to the period-correct historical name (see
// familysearchPlacesOn's own comment). Off by default - an opt-in
// override, not a change to the base behavior. Only affects the
// FamilySearch lookup's query year for burial specifically; the source
// burial date and #232's own estimated burial date are untouched. Read
// directly via $('#burialcurrentlocationonoffswitch').prop('checked') at
// its call sites in buildform.js, same convention as
// familysearchPlacesOn above.
var burialCurrentLocationOn = false;

// #247: some source records fold the cemetery name into the death
// location instead of recording it separately as the burial location. Off
// by default - this rewrites already-scraped text (moves a detected
// cemetery segment from death to burial location), not just how a lookup
// is queried, so it's opt-in rather than an automatic default like
// #244's cemetery-abbreviation normalization. Read directly via
// $('#extractburialfromdeathonoffswitch').prop('checked') at its one call
// site in buildform.js's updateGeo(), same convention as
// burialCurrentLocationOn above.
var extractBurialFromDeathLocationOn = false;

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

// #212: moved here from popup.js (#223/#224 follow-up) - also needed by
// extractDateYear() below, not just datesAreEquivalent() (popup.js).
// Optional trailing "the " handles a real case confirmed live - "After
// the 1st September 1919" - a qualifier followed by an article before the
// date itself, not just "After 1919".
var DATE_QUALIFIER_PATTERN = /^(circa|about|after|before)\s+(the\s+)?/i;

// #223/#224 follow-up: live-confirmed getGeoDedupKey()/FamilySearch's date
// query both silently lost the year entirely for any qualified date
// ("After 20 Jan 1891") - moment() requires the ENTIRE string to match one
// of dateformatter's formats, and none of them account for a leading
// qualifier word at all, so a real, parseable date failed outright just
// because of the "After " prefix. Strips the qualifier (reusing the exact
// pattern datesAreEquivalent() already relies on for the same reason) and
// the ordinal suffix ("1st" -> "1") before handing off to moment - the
// single shared place both getGeoDedupKey() and FamilySearch's
// queryFamilySearchPlaces() (parse-location.js) now get a year from,
// instead of two separate inline copies of the same moment() call.
function extractDateYear(dateval) {
    if (!exists(dateval) || dateval === "") {
        return undefined;
    }
    var stripped = dateval.replace(DATE_QUALIFIER_PATTERN, "").replace(/(\d+)(st|nd|rd|th)\b/i, "$1").trim();
    var dt = moment(stripped, getDateFormat(stripped));
    if (dt.isValid() && !isNaN(dt.get('year'))) {
        return dt.get('year');
    }
    return undefined;
}

// #223/#224 follow-up: previously deduped purely by the raw location
// STRING, harmless for Google (date-blind - two events sharing the same
// place string always got the identical result regardless of processing
// order) but a real correctness bug once FamilySearch Places entered the
// picture: it resolves the SAME place string to DIFFERENT, historically
// correct entities depending on the associated date (e.g. a birth vs a
// death decades apart at the same place name). Live-confirmed: a death
// location was silently getting the geocoded result computed for a
// different, earlier event that happened to share the identical raw place
// string - whichever one was processed first "won" the unique slot, and
// every later duplicate just copied its result wholesale (see the
// geocleanup/geounique matching loop in updateFamily(), buildform.js).
// Folding the event's own year into the dedup key fixes this for both
// sources - the common Google-only case is unaffected, this only costs a
// handful of extra (still fully correct) redundant lookups in the rare
// same-string-different-year edge case.
//
// Reads .dateForFsLookup in preference to .date (see
// attachDateForFsLookup() below) - live-confirmed at least one parser
// (collections/onlineofb.js) never puts an event's date and location on
// the same array element at all, so .date alone is undefined here far
// more often than expected. Lives here (not buildform.js) as a general-
// purpose, reusable utility - depends only on exists()/moment/
// getDateFormat(), all globally available by the time this actually runs,
// regardless of script load order (function declarations resolve their
// references at call time, not at parse time).
function getGeoDedupKey(entry) {
    var dateval = exists(entry.dateForFsLookup) ? entry.dateForFsLookup : entry.date;
    var year = extractDateYear(dateval);
    return entry.location + "|" + (exists(year) ? year : "");
}

// Live-confirmed bug (issue #224): collections/onlineofb.js pushes an
// event's date and location as TWO SEPARATE array elements
// (data.push({date:...}) then data.push({id:geoid, location:...})), never
// merged onto one object - so a location-bearing element's OWN .date is
// undefined even when the event genuinely has a real date sitting right
// next to it in the same array. FamilySearch's date-aware lookup (and the
// dedup key above) need SOME associated year; this scans the same
// event-type array (there's normally at most one real date per event) for
// the first element that actually has one, and attaches it as a NEW field
// - deliberately not named/aliased as .date itself, so nothing else that
// already reads .date (rendering, the 95-year check, etc.) is affected by
// this at all.
// fallbackobj (optional): requested live - burial events frequently have
// no date of their own at all anywhere in their own array, only a
// location. Assuming burial happened the same year as death is a
// reasonable genealogical default (rather than leaving the FamilySearch
// lookup entirely date-blind, or wrongly reusing some unrelated event's
// year via dedup collision) - callers pass the person's own "death" array
// as fallbackobj specifically for a "burial" location; omitted entirely
// for every other event type.
function attachDateForFsLookup(memberobj, locationEntry, fallbackobj) {
    if (exists(locationEntry.date) && locationEntry.date !== "") {
        return; // already has its own real date, nothing to borrow
    }
    for (var i in memberobj) if (memberobj.hasOwnProperty(i)) {
        if (exists(memberobj[i].date) && memberobj[i].date !== "") {
            locationEntry.dateForFsLookup = memberobj[i].date;
            return;
        }
    }
    if (exists(fallbackobj)) {
        for (var j in fallbackobj) if (fallbackobj.hasOwnProperty(j)) {
            if (exists(fallbackobj[j].date) && fallbackobj[j].date !== "") {
                locationEntry.dateForFsLookup = fallbackobj[j].date;
                return;
            }
        }
    }
}

// #224: last-resort tier of the same chain, applied after
// attachDateForFsLookup() above has already had its shot (own date ->
// sibling scrape -> burial-borrows-scraped-death) and come up empty -
// fills in a year resolved from Geni's existing data or a genealogical
// ballpark heuristic (see resolveFsLookupYears() in buildform.js: birth ->
// #208's estimated year, marriage -> birth+30, burial -> death year).
// Never overwrites anything attachDateForFsLookup() already set - only
// used to scope the FamilySearch date filter, never written back to the
// form, so an approximate year here is fine; landing in the right decade
// is enough to prefer the correct historical jurisdiction over a modern
// one.
function applyFsLookupYearFallback(locationEntry, year) {
    if (exists(year) &&
        (!exists(locationEntry.dateForFsLookup) || locationEntry.dateForFsLookup === "") &&
        (!exists(locationEntry.date) || locationEntry.date === "")) {
        locationEntry.dateForFsLookup = String(year);
    }
}

// #224: strips German jurisdiction-level abbreviations/words ("Kr."/
// "Kreis", "Landkreis", "Amt", "Bezirk", "Regierungsbezirk", "Provinz",
// "Königreich", "Grafschaft") and parenthetical qualifiers (e.g. "(Mark)"
// in "Storkow (Mark)") before comparing a raw scraped segment against a
// resolved city/county/state/country value - the two rarely match as
// exact strings even when they clearly refer to the same place ("Kr.
// Beeskow-Storkow" vs a resolved county of "Beeskow-Storkow"). Not an
// exhaustive list - built from the actual qualifier words seen live on
// 19th-century Prussian-era records, the case this feature was built
// against; add to it as further cases turn up.
var PLACE_SEGMENT_QUALIFIER_PATTERN = /\((?:[^)]*)\)|\b(kr\.?|kreis|landkreis|amt|bez\.?|bezirk|regierungsbezirk|provinz|province|königreich|koenigreich|grafschaft)\b/gi;
// #253 follow-up (found while investigating a live-reported leftover-text
// bug): the old /[^\w\s]/g punctuation strip is ASCII-only - \w never
// matches an accented letter, so "México" got mangled to "m xico" (a
// stray space where the "é" was), silently breaking a match against a
// resolved "Mexico" field. Two-part fix: NFD-normalize and strip
// combining marks so an accented letter folds to its plain-ASCII base
// ("México" -> "Mexico") BEFORE the punctuation strip - live-confirmed
// this exact mismatch (FamilySearch returns the unaccented "Mexico", the
// scraped source text has "México") would otherwise leave a real match
// undetected. Unicode property escapes (\p{L}/\p{N}) then keep any
// remaining real letter/digit in any script the fold didn't cover, only
// stripping actual punctuation.
function normalizePlaceSegmentForMatch(text) {
    return String(text || "")
        .replace(PLACE_SEGMENT_QUALIFIER_PATTERN, " ")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

// #224: true when segment is either empty after normalizing (nothing but
// a qualifier word/parenthetical - no real content to preserve) or is a
// close match (equal, or a substring either direction) of one of the
// already-resolved fields. Deliberately NOT an exact-only match - the
// scrape's own text and FamilySearch's/Google's resolved short names are
// rarely byte-identical even when they clearly refer to the same place.
function segmentMatchesAnyField(segment, fields) {
    var normSeg = normalizePlaceSegmentForMatch(segment);
    if (normSeg === "") {
        return true;
    }
    for (var i = 0; i < fields.length; i++) {
        var normField = normalizePlaceSegmentForMatch(fields[i]);
        if (normField !== "" && (normSeg === normField || normSeg.indexOf(normField) !== -1 || normField.indexOf(normSeg) !== -1)) {
            return true;
        }
    }
    return false;
}

// #224: live-reported - once city/county/state/country resolve to real
// values, the RAW scraped string (Geni's "location_string"/Place Name
// field) still gets suggested as-is, duplicating the exact same
// information Geni's display then shows twice over ("Storkow (Mark), Kr.
// Beeskow-Storkow, Potsdam, Brandenburg, Preussen, Storkow, Beeskow-
// Storkow, Brandenburg, Germany"). This computes what's actually LEFT
// OVER after removing every raw segment that's already represented in the
// resolved geo fields - e.g. "Potsdam" (a jurisdiction level that gets
// dropped during the 5-levels-into-4-fields mapping, see
// familySearchPlaceToGeoLocation()'s own comment) or "Preussen" (a
// historical name that won't match a modern-day resolved country like
// "Germany") legitimately survive as real, non-redundant context; "Storkow
// (Mark)"/"Kr. Beeskow-Storkow"/"Brandenburg" don't, since they're already
// captured by city/county/state. Returns "" when nothing is left over (the
// common case for a location that resolved cleanly) - never returns the
// raw string unchanged, and never fires at all unless the caller already
// confirmed real geo fields exist (see buildform.js's hasGeoFields).
function computeLeftoverPlaceName(rawLocation, geo) {
    if (!exists(rawLocation) || rawLocation.trim() === "" || !exists(geo)) {
        return "";
    }
    var segments = rawLocation.split(",").map(function (s) { return s.trim(); }).filter(function (s) { return s !== ""; });
    var fields = [geo.place, geo.city, geo.county, geo.state, geo.country];
    var leftover = segments.filter(function (seg) { return !segmentMatchesAnyField(seg, fields); });
    return leftover.join(", ");
}

// #260 follow-up (live-reported, DanCornett - screenshots confirmed the
// exact symptom): buildform.js's visible-by-default "Place: " row
// (title:location:place_name_geo, fed by geo.place alone) only ever
// showed whatever extractPlaceNameSegments() stripped as a recognized
// venue keyword before searching - genuinely blank whenever nothing
// matched a keyword, even when there's real leftover text with nowhere
// else to go (e.g. "Sagrario" ahead of a resolved Xalapa/Veracruz/Mexico
// chain). That leftover WAS being computed correctly all along by
// computeLeftoverPlaceName() above - it just fed a DIFFERENT row
// (title:location:place_name, "Baptism Place:") that's hidden by default
// behind the geoicon toggle whenever real geo fields exist, which
// DanCornett was never interacting with. Combines both into the one
// value users actually see by default: the stripped venue (if any)
// first, then any additional leftover residue. Safe to concatenate
// without ever duplicating text - computeLeftoverPlaceName() already
// excludes anything matching geo.place from its own output (geo.place is
// one of its own comparison fields).
function computeCombinedPlaceValue(rawLocation, geo) {
    var parts = [geo.place, computeLeftoverPlaceName(rawLocation, geo)].filter(function (v) {
        return exists(v) && v !== "";
    });
    return parts.join(", ");
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