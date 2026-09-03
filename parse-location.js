var verbose = false;
var countryPattern = new RegExp(' County', 'i');
var GeoLocation = function (results, query) {
    var location = {};
    if (!exists(results["results"])) {
        location.query = query || "";
        location.count = 0;
        return location;
    }
    results = results["results"];

    if (results.length === 1) {
        location = parseGoogle(results[0], query);
        location.count = 1;
    } else if (results.length > 1) {
        var locationset = [];
        for (var i = 0; i < results.length; i++) {
            locationset[i] = parseGoogle(results[i], query);
            locationset[i].count = results.length;
        }
        var locationstate = locationset[0];
        for (var i = 0; i < results.length; i++) {
            locationstate = compareGeo(locationset[i], locationstate);
        }
        location = locationstate;

    } else {
        location = parseGoogle("", query);
        location.count = 0;
    }

    if (location.place === "" && location.city === "" && location.county === "" && location.state === "" && location.country === "") {
        location.count = 0;
        location.place = location.query;
    }

    return location;
};

function parseGoogle(result, query) {
    var location = {};
    location.query = query || "";
    location.query = location.query.replace(/</g, "").replace(/>/g, "");
    if (location.query.startsWith("of ")) {
        location.query = location.query.replace("of ", "");
    }
    location.place = "";
    location.zip = "";
    location.city = "";
    location.county = "";
    location.state = "";
    location.country = "";
    location.state_short = "";
    location.country_short = "";
    // #229: same reasoning as familySearchPlaceToGeoLocation()'s own
    // comment - Google's Geocoding API always includes this on every
    // result (geometry.location.lat/.lng), never previously extracted.
    location.latitude = exists(result.geometry) && exists(result.geometry.location) && exists(result.geometry.location.lat) ? result.geometry.location.lat : "";
    location.longitude = exists(result.geometry) && exists(result.geometry.location) && exists(result.geometry.location.lng) ? result.geometry.location.lng : "";
    if (exists(result.address_components)) {
        for (var i = 0; i < result.address_components.length; i++) {
            var long_name = result.address_components[i].long_name.replace(/^\d*, /, "");
            var short_name = result.address_components[i].short_name.replace(/^\d*, /, "");
            //noinspection FallthroughInSwitchStatementJS
            switch (result.address_components[i].types.join(",")) {
                case 'postal_code':
                case 'postal_code_prefix,postal_code':
                    location.zip = long_name;
                    break;
                case 'colloquial_area,political':
                case 'point_of_interest,establishment':
                case 'natural_feature,establishment':
                case 'sublocality_level_1,sublocality,political':
                case 'political,sublocality,sublocality_level_1':
                case 'political,sublocality':
                case 'sublocality,political':
                case 'neighborhood,political':
                    if (location.place === "") {
                        location.place = long_name;
                    } else {
                        location.place += ", " + long_name;
                    }
                    break;
                case 'establishment':
                    break;
                case 'locality,political':
                    if (isNaN(long_name)) {
                        location.city = long_name;
                    }
                    break;
                case '':
                case 'postal_town':
                case 'administrative_area_level_3,political':
                    if (location.city === "" && isNaN(long_name)) {
                        //If the city is not in locality, use admin area 3
                        location.city = long_name;
                    }
                    break;
                case 'administrative_area_level_4,political':
                    if (location.city === "" && isNaN(long_name)) {
                        //If the city is not in locality, use admin area 4
                        location.city = long_name;
                    }
                    break;
                case 'administrative_area_level_5,political':
                    if (location.city === "" && isNaN(long_name)) {
                        //If the city is not in locality, use admin area 5
                        location.city = long_name;
                    }
                    break;
                case 'administrative_area_level_2,political':
                    if (isNaN(long_name)) {
                        location.county = long_name;
                    }
                    break;

                case 'administrative_area_level_1,political':
                    if (isNaN(long_name)) {
                        location.state = long_name;
                    }
                    if (isNaN(short_name)) {
                        location.state_short = short_name;
                    }
                    break;

                case 'country,political':
                    if (isNaN(long_name)) {
                        location.country = long_name;
                    }
                    if (isNaN(short_name)) {
                        location.country_short = short_name;
                    }
                    break;
            }
        }
        var split = location.query.split(",");
        if (split.length === 1 && (location.query.startsWith(" ") || location.query.contains("Territory"))) {
            var count = countGeoFields(location);
            if (count > 3) {
                //Only one field but returning 4 - seems unlikely to be accurate
                var subquery = location.query;
                location = parseGoogle("", subquery);
                location.place = subquery.trim();
            }
        } else if (location.county === "") {
            if (countryPattern.test(location.query)) {
                for (var i=0;i<split.length;i++) {
                    if (countryPattern.test(split[i])) {
                        location.county = split[i].trim();
                        break;
                    }
                }
            }
        }
    }
    return location;
}

function checkPlace(location) {
    var splitplace = location.split(",");
    var checkplace = splitplace[0].toLowerCase().trim();
    var place = "";
    if (isCem(checkplace)) {
        if (checkplace.toLowerCase().endsWith(" cem") || checkplace.toLowerCase().endsWith(" cem.")) {
            place = splitplace[0].replace(/ cem\.?/i, " Cemetery").trim();
        } else if (checkplace.contains(" cemetary")) {
            place = splitplace[0].replace(/ cemetary/i, " Cemetery").trim();
        } else if (checkplace.toLowerCase().endsWith("temple")) {
            if (splitplace.length === 1) {
                place = splitplace[0];
                place = place.trim();
            }
        } else {
            place = splitplace[0];
            place = place.trim();
        }
    } else if (checkplace.toLowerCase().endsWith("hospital")) {
        place = splitplace[0];
        place = place.trim();
    }
    return place;
}

function isCem(checkplace) {
    return checkplace.contains(" cemetery") || checkplace.contains(" cemetary") || checkplace.contains(" grave") ||
        checkplace.endsWith(" cem") || checkplace.endsWith(" cem.") || checkplace.contains(" burying") ||
        checkplace.endsWith(" territory") || checkplace.endsWith(" church") || checkplace.contains(" burial") ||
        checkplace.endsWith("temple") || checkplace.contains("mausoleum") || checkplace.contains("memorial");
}

// #223/#224 follow-up: when the FamilySearch Places toggle is on, tries it
// FIRST - live-tested against real historical Online-OFB records, it
// correctly resolves period-appropriate administrative hierarchies (e.g. a
// German record from 1885 correctly resolving to its 1871-1952 Prussian-era
// jurisdiction chain) that Google's present-day-only geocoding can't. Falls
// through to the existing Google/raw-string path unchanged whenever
// FamilySearch is off, finds nothing, or the call fails for any reason -
// this is an unauthenticated beta endpoint with no uptime guarantee (see
// the familysearchPlacesOn comment in shared.js), so it must never be the
// only path to a result. queryGeoGoogle() below is the original queryGeo()
// body, renamed but otherwise untouched.
function queryGeo(locationset, test) {
    if (familysearchPlacesOn && exists(locationset.location) && locationset.location.trim() !== "") {
        geostatus.push(geostatus.length);
        queryFamilySearchPlaces(locationset, function (matched) {
            geostatus.pop();
            if (matched) {
                if (exists(test) && test !== "") {
                    print(geolocation[locationset.id], JSON.parse(test));
                }
                return;
            }
            queryGeoGoogle(locationset, test);
        });
        return;
    }
    queryGeoGoogle(locationset, test);
}

// Live-confirmed failure mode (issue #224 - "Posen" searched for a 1765
// event): when no settlement-level FamilySearch record exists for the
// target year, the best-scored match can be a much broader jurisdiction
// (a whole Province, in that real case) that merely shares the searched
// name - accepting it would mislabel "somewhere in this entire province"
// as if it were the specific town. FamilySearch's own display.type string
// is checked directly rather than the numeric type codes elsewhere in
// this file (id 9278776 vs 7717173 vs 7717174 - the three real Storkow
// entries - all used DIFFERENT numeric codes for the same "Brandenburg"
// province depending on the historical period, so the numbers aren't a
// stable type taxonomy; "Province"/"State"/"Country" as plain English
// strings are what's actually consistent across entries).
// Not an exhaustive taxonomy - FamilySearch's own type list isn't
// published anywhere found during #224's research, so this is built from
// broad-jurisdiction types actually seen live (Province confirmed on the
// Posen/1765 case above; District confirmed the same way - ranked ahead
// of the genuine City-level match for the identical query). Add to this
// list as further false-positive types turn up in practice.
//
// #35 follow-up (live-reported, live-confirmed via a direct query against
// FamilySearch's real API): "Country" removed, "Continent" added.
// Querying "Austria" (a bare country-name birthplace, live-reported on
// Leo Hamlisch's own birth) returned, in order: "Austria" (Country,
// score 100, lat/long 47.5/14.0 - the objectively correct answer),
// "Holy Roman Empire" (Country, score 86), "Europe" (Continent, score
// 84, lat/long 49.0/13.0). With "Country" in this list, BOTH correct
// candidates were rejected as "too broad," and the code fell through to
// "Europe" - which passed the filter only because "Continent" was never
// on it, even though a continent is broader than either rejected
// candidate. "Country" itself was never confirmed necessary by a real
// case (only Province/District were, per the comment above) - it was
// added speculatively, and this is a confirmed case where it actively
// produces a WORSE result than what it excludes. A bare country name is
// also a completely ordinary level of specificity for a historical
// birthplace (unlike "Posen" above, where the query was meant to name a
// specific town but only matched the province standing in for it) - here
// the country IS the whole of what was actually recorded.
//
// #224 follow-up (live-reported): "State" removed for the identical
// reason, live-confirmed via direct queries. "Pennsylvania" (from a
// birth recorded as just "Pennsylvania, United States") had its correct
// "Pennsylvania" (State, score 100) match rejected, falling through to
// far worse candidates. "Virginia" (1823 event, same shape) was worse -
// its correct "Virginia" (State, score 100) match was rejected, and the
// NEXT candidate that passed the filter was "Virginia" (Populated Place,
// score 58) at 22.38,-80.17 - a real location IN CUBA, live-reported
// exactly as "gives a city in Cuba." Also never confirmed necessary by a
// real case, same as "Country" was.
var FS_BROAD_PLACE_TYPES = ["Province", "Region", "District", "Continent"];
function isBroadPlaceType(place) {
    return exists(place) && exists(place.display) && exists(place.display.type) &&
        FS_BROAD_PLACE_TYPES.indexOf(place.display.type) !== -1;
}

// #224: live-reported ("Jewish Cemetery Schönhauser Allee, Berlin,
// Germany, Plot 15191a" coming back a mess - the cemetery name landing in
// City, the plot number nowhere useful) - a scraped location string can
// carry a specific-point-in-place segment (a venue/institution name, a
// street address, a plot/lot/grave reference) that isn't a jurisdiction at
// all. FamilySearch's Places search only understands jurisdictions/
// settlements - it has no concept of a cemetery's own name or a plot
// number - so searching on a segment like that either finds nothing or
// (worse) matches an unrelated named place, and either way stuffs the
// wrong text into City. Google's OWN geocoder handles this natively via
// its address_components' point_of_interest/establishment types (see
// parseGoogle() above) - FamilySearch has no equivalent, so this strips
// segments like these out ourselves before ever querying, and hands them
// back as the Place Name field instead of discarding them.
// Not an exhaustive list - keyword-based, built from the kinds of things
// that actually show up in scraped location strings (cemeteries, churches,
// addresses, burial-plot references), not a formal taxonomy.
// #224 follow-up (live-reported): "Jüdischer Friedhof Storkow" (German for
// "Jewish Cemetery Storkow") sailed straight through the English-only
// version of this list and got sent to FamilySearch as the search term -
// which matched an entirely unrelated "Jewish Cemetery" entity near
// Bendorf/Koblenz (the Rhineland, nowhere near Storkow/Brandenburg),
// since FamilySearch's Places search is a plain text match with no
// awareness that two places merely sharing a generic descriptive name
// aren't the same place. This codebase deals with German-language sources
// constantly (this whole feature was built against German/Prussian
// records) - German venue/institution words for the same categories are
// exactly as likely to show up as the English ones, so they get the same
// treatment.
// #244: "cem\.?|cemetary" added alongside the existing "cemetery" -
// checkPlace()/isCem() (Google's own equivalent, above) already
// recognized the abbreviated "Cem"/"Cem." and misspelled "Cemetary"
// forms; this pattern only had the correctly-spelled full word, so a
// segment like "Oak Hill Cem" was never even recognized as a venue at
// all here - it would flow straight into the FamilySearch jurisdiction
// query instead of being stripped into the Place Name field.
// #252 (live-reported): "fort" removed - it was meant to catch landmark
// text (e.g. "at the old fort"), but as a bare word it also matches the
// START of real, populous US city names ("Fort Worth", "Fort Wayne",
// "Fort Lauderdale", "Fort Collins", "Fort Myers", "Fort Smith" all
// test true against \bfort\b) - live-confirmed via "Fort Worth, Tarrant,
// TX" being wrongly stripped into the Place Name field entirely, instead
// of being sent to the geocoder where it resolves cleanly to City. No
// live-confirmed case ever needed "fort" specifically (unlike every
// other word here), so removed rather than special-cased - same
// evidence-based discipline as the rest of this list. "camp" and
// "plantation" carry the identical risk (real cities: Camp Hill PA,
// Plantation FL) but have no live-reported failure yet - left as-is
// pending one, not preemptively removed.
var PLACE_NAME_KEYWORD_PATTERN = /\b(cemetery|cem\.?|cemetary|church|chapel|synagogue|temple|hospital|clinic|camp|prison|plantation|plot|lot|grave|section|block|row|space|apt|apartment|suite|room|building|street|st\.?|avenue|ave\.?|road|rd\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|highway|hwy\.?|route|rt\.?|farm|ranch|friedhof|kirchhof|kirche|kapelle|synagoge|kloster|krankenhaus|gefängnis|gefangnis)\b/i;
// A segment that's essentially just a number (a house/plot/lot number,
// with an optional trailing letter like "15191a"), starts with one
// followed by more text (the US street-address convention, "123 Main"),
// or ENDS with one (the European/German convention, street name first -
// "Jagowstraße 29-33", "Hauptstraße 5") - live-reported: "Jagowstraße
// 29-33" sailed straight through untouched, since it's one compound word
// with no space for the keyword pattern's word-boundary check to reach
// ("straße" the way "Friedhof" was a separate word in the earlier live
// case) AND doesn't start with a digit either. A trailing number/range is
// a much stronger, low-false-positive signal on its own regardless of
// language - genuine settlement/jurisdiction names essentially never end
// in a bare number.
var PLACE_NAME_NUMERIC_PATTERN = /^\s*#?\s*\d+[a-z]?\s*$|^\s*\d+\s+\S|\S\s+\d+[a-z]?(-\d+[a-z]?)?\s*$/i;
function isPlaceNameSegment(segment) {
    var trimmed = segment.trim();
    return trimmed !== "" && (PLACE_NAME_KEYWORD_PATTERN.test(trimmed) || PLACE_NAME_NUMERIC_PATTERN.test(trimmed));
}

// #244: normalizes "Cem"/"Cem." (abbreviated) and "Cemetary" (misspelled)
// to "Cemetery" in text destined for the Place Name field - the same
// cleanup checkPlace() already does for Google's path, ported here since
// FamilySearch's own venue extraction never got it. Two cases: "Cem"/
// "Cem." at the END of the text (nothing following) becomes plain
// "Cemetery" - never trails a comma when there's nothing after it. "Cem."
// followed by MORE text in the same segment (e.g. a source punctuated
// "XYZ Cem. Plot 15" with a period rather than a comma) becomes
// "Cemetery, " + that text, treating the abbreviation's period as the
// clause break it was standing in for.
function normalizeCemeteryAbbreviation(text) {
    if (!exists(text) || text.trim() === "") {
        return text;
    }
    var normalized = text.replace(/\bcemetary\b/i, "Cemetery");
    normalized = normalized.replace(/\bcem\.?(\s+\S)/i, "Cemetery,$1");
    normalized = normalized.replace(/\bcem\.?\s*$/i, "Cemetery");
    return normalized.replace(/\s+/g, ' ').trim();
}

// #247 (live-reported by DanCornett, no concrete example available - built
// from his own proposed algorithm): some source records fold the burial
// site into the death location itself (e.g. "Oak Hill Cem, Springfield,
// IL" scraped as the death Place) instead of recording it separately.
// Detects a cemetery name ONLY in the location's FIRST comma-segment - a
// mention deeper in the string is ambiguous (could be unrelated context),
// and DanCornett's own issue text accepts this as a known imperfection
// ("won't be perfect in all cases"). Reuses normalizeCemeteryAbbreviation()
// (#244) so an abbreviated/misspelled "Cem"/"Cemetary" is recognized the
// same way it already is for Google's venue-extraction path. Returns
// undefined when there's nothing to extract, or when extracting would
// leave the death location completely empty (never blank a field as a
// side effect - if the whole string is just the cemetery name, leave it
// untouched rather than guess).
function extractBurialSegmentFromDeathLocation(deathLocationText) {
    if (!exists(deathLocationText) || deathLocationText.trim() === "") {
        return undefined;
    }
    var segments = deathLocationText.split(',');
    var firstSegment = normalizeCemeteryAbbreviation(segments[0]);
    var match = firstSegment.match(/^(.*?\bCemetery\b)\s*(.*)$/i);
    if (!match) {
        return undefined;
    }
    var burialSegment = match[1].trim();
    var leftoverInFirstSegment = match[2].trim();
    var remainingSegments = segments.slice(1);
    if (leftoverInFirstSegment !== "") {
        remainingSegments.unshift(leftoverInFirstSegment);
    }
    var remainingDeathLocation = remainingSegments.join(',').replace(/^[,\s]+/, '').trim();
    if (remainingDeathLocation === "") {
        return undefined;
    }
    return { burialSegment: burialSegment, deathLocation: remainingDeathLocation };
}

// #224: strips leading/trailing isPlaceNameSegment() matches off a
// comma-separated location string, returning what's left (the
// jurisdiction chain to actually search/geocode) plus the stripped text
// joined back in its original order (destined for the Place Name field).
// Always leaves at least one segment behind (the `length > 1` guards) -
// never strips the entire string down to nothing to search on.
// #244: each stripped segment is normalized (normalizeCemeteryAbbreviation)
// BEFORE joining, not after - normalizing the final joined string would
// break the "nothing follows" detection whenever more than one segment
// gets stripped (e.g. "ABC Cem, DEF" - "Cem" isn't at the end of THAT
// string even though it correctly is at the end of its own original
// segment "ABC Cem").
function extractPlaceNameSegments(segments) {
    var remaining = segments.slice();
    var leading = [];
    while (remaining.length > 1 && isPlaceNameSegment(remaining[0])) {
        leading.push(normalizeCemeteryAbbreviation(remaining.shift()));
    }
    var trailing = [];
    while (remaining.length > 1 && isPlaceNameSegment(remaining[remaining.length - 1])) {
        trailing.unshift(normalizeCemeteryAbbreviation(remaining.pop()));
    }
    return { remaining: remaining, placeName: leading.concat(trailing).join(", ") };
}

// #223/#224 follow-up: resolves the most specific segment of a scraped
// location string against FamilySearch's Places Search, then picks
// whichever returned candidate's date range covers the record's own event
// year - the exact approach validated live against issue #224's test case.
// Always calls back (true = geolocation[locationset.id] was populated,
// false = caller should fall through to Google/raw-string) - never throws,
// matching this codebase's established "degrade to blank, don't break the
// run" convention for anything that talks to an external, unreliable
// source.
function queryFamilySearchPlaces(locationset, callback) {
    var location = locationset.location.trim();
    // #224: strip a venue/address/plot segment (leading, trailing, or
    // both) before searching - see extractPlaceNameSegments()'s own
    // comment. What's left is the actual jurisdiction chain to query.
    var segments = location.split(",").map(function (s) { return s.trim(); }).filter(function (s) { return s !== ""; });
    var extracted = extractPlaceNameSegments(segments);
    // #224 follow-up (live-reported feedback on that issue): querying ONLY
    // the most specific remaining segment ("resolves the most specific
    // segment" - see this function's original comment, validated against
    // the Storkow case where that segment alone was specific enough to
    // disambiguate correctly) breaks down for a common/ambiguous place
    // name, or a location that's inherently only recorded at state/
    // country level to begin with. Live-confirmed via direct queries
    // against the real API: "Bridgewater" alone (stripped of "Lunenburg,
    // Nova Scotia, Canada") returns 8 same-scored, unrelated candidates
    // worldwide with no ranking signal at all (top hit: Australia) - the
    // full remaining string as one quoted phrase gives a clear, correctly
    // top-scored match (100 vs 95) instead. Confirmed this does NOT
    // regress the original Storkow case this design was built for - the
    // full string still surfaces the identical correct top result there,
    // just with historical/non-matching segments (e.g. "Preussen")
    // diluting its absolute score rather than preventing the match -
    // FamilySearch's own search appears to score token overlap within the
    // phrase, not require an exact literal match.
    var placeSegment = extracted.remaining.join(", ").replace(/"/g, "");
    if (placeSegment === "" || placeSegment === "?") {
        callback(false);
        return;
    }
    // Live-confirmed bug (issue #224): at least one parser
    // (collections/onlineofb.js) pushes an event's date and location as
    // two SEPARATE array elements, never merged onto one object - so
    // locationset.date alone was undefined for every single location live-
    // tested, not just some. buildform.js's attachDateForFsLookup() (see
    // its own comment) borrows the real date from elsewhere in the same
    // event-type array before this ever runs; dateForFsLookup is preferred
    // when present, falling back to locationset.date directly for
    // whichever parsers already merge them onto one object.
    var rawDate = exists(locationset.dateForFsLookup) ? locationset.dateForFsLookup : locationset.date;
    // extractDateYear() (shared.js) - also strips a leading qualifier
    // ("After "/"Before "/"Circa ") and ordinal suffix before parsing;
    // live-confirmed a range-qualified burial date ("After 20 Jan 1891")
    // silently failed to parse at all without this, since moment()
    // requires the whole string to match one of dateformatter's formats.
    var eventYear = extractDateYear(rawDate);
    // Try the REAL event year first, always - a blanket floor broke places
    // FamilySearch genuinely has good early coverage for (live-confirmed:
    // "Boston" in 1650 already worked correctly with no floor at all).
    // Live-confirmed separately (issue #224) that a single fixed fallback
    // year isn't reliable across this dataset: "Posen" for an 1765 event
    // needed 1871 to find anything, while "Murzynowo (Kirchlich)"/1813 and
    // "Filehne"/1807 returned HTTP 204 (confirmed via direct curl - a
    // real, empty result, not an error) at BOTH 1850 and needed 1871
    // specifically too. Rather than chase a single "right" floor year
    // that keeps not being right, this tries a bounded, explicit cascade
    // (requested live, "that's a lot of fallbacks, but it's better"):
    // real year, then 1850, then 1900, then no date filter at all (pure
    // name relevance) - stopping at the first one that finds a usable
    // settlement-level match. At most 4 requests, never more, never
    // retried again once one succeeds.
    var fsAttemptYears = [];
    if (exists(eventYear)) {
        fsAttemptYears.push(eventYear);
    }
    if (eventYear !== 1850) {
        fsAttemptYears.push(1850);
    }
    if (eventYear !== 1900) {
        fsAttemptYears.push(1900);
    }
    fsAttemptYears.push(undefined); // last resort: no date filter at all

    (function tryNextFsYear(index) {
        if (index >= fsAttemptYears.length) {
            callback(false);
            return;
        }
        attemptFamilySearchQuery(placeSegment, fsAttemptYears[index], location, extracted.placeName, function (matched) {
            if (matched) {
                geolocation[locationset.id] = matched;
                callback(true);
            } else {
                tryNextFsYear(index + 1);
            }
        });
    })(0);
}

// One search attempt for a given (place, year) pair. Calls back with a
// GeoLocation-shaped result (see familySearchPlaceToGeoLocation()) on a
// good settlement-level match, or undefined if nothing usable came back -
// never throws, matching this codebase's established "degrade to blank,
// don't break the run" convention for anything that talks to an external,
// unreliable source.
function attemptFamilySearchQuery(placeSegment, year, fullLocationString, placeName, callback) {
    var queryText = 'name:"' + placeSegment + '"';
    if (exists(year)) {
        // Per FamilySearch's own documented syntax for this parameter
        // ("+date:1823" or "+date:1800/1900" - the "+" marks the date
        // FIELD as required, it's not part of the year value itself).
        // Live-tested: an earlier version of this had a second, spurious
        // "+" directly on the year ("+date:+1823") - FamilySearch's parser
        // tolerated it in every case tested, but that's undocumented
        // leniency on an already-unstable beta endpoint, not something to
        // rely on.
        queryText += ' +date:' + year;
    }
    // count=5, not 1: live-confirmed failure case (issue #224 - "Posen" in
    // 1765) - when no settlement-level record exists for the target year
    // (FamilySearch's Prussian-era Posen entries only start in 1815), the
    // single best-scored match can be a much BROADER jurisdiction (a whole
    // Province, in that case) that merely shares the searched name - a
    // misleading result to present as if it were the specific place.
    // FS_BROAD_PLACE_TYPES below rejects those; keeping a few candidates
    // in reserve lets the next-best (still date-eligible) match be tried
    // instead of immediately falling through to Google/raw-string.
    var url = "https://apibeta.familysearch.org/platform/places/search?count=5&q=" + encodeURIComponent(queryText);
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: url
    }, function (response) {
        try {
            var result = JSON.parse(response.source);
            var entries = result.entries;
            if (!exists(entries) || entries.length === 0) {
                callback(undefined);
                return;
            }
            // Entries are pre-sorted by relevance score (highest first).
            // Collect every non-broad candidate tied at the TOP score seen
            // (not just the first one) - #237 (live-reported, DanCornett):
            // FamilySearch itself can score two genuinely different
            // interpretations of the same query identically (e.g.
            // "Washington, Virginia" scores a Village named Washington and
            // Washington County equally at 100) - picking blindly whichever
            // happened to sort first ignored real tie-break signal.
            var topScore;
            var tiedCandidates = [];
            for (var e = 0; e < entries.length; e++) {
                var candidatePlaces = entries[e].content.gedcomx.places;
                if (!exists(candidatePlaces) || candidatePlaces.length === 0 || isBroadPlaceType(candidatePlaces[0])) {
                    continue;
                }
                if (!exists(topScore)) {
                    topScore = entries[e].score;
                } else if (entries[e].score !== topScore) {
                    break; // pre-sorted descending - nothing further can tie
                }
                tiedCandidates.push(candidatePlaces);
            }
            if (tiedCandidates.length === 0) {
                callback(undefined);
                return;
            }
            var picked = selectBestTiedFsMatch(tiedCandidates, placeSegment, fullLocationString, placeName);
            callback(familySearchPlaceToGeoLocation(picked.places, fullLocationString, placeName, picked.ambiguous));
        } catch (e) {
            callback(undefined);
        }
    });
}

// #237 (live-reported, DanCornett): picks the best of several FamilySearch
// candidates that tied at the same top relevance score. First choice: a
// precise county-only match for the query term - reuses countyOnlyOverride()
// as-is, the same function and reasoning #225 already established for
// Google's path ("genealogical records are typically indexed at county
// level, not city"). Otherwise falls back to DanCornett's stated general
// preference: fewest populated fields wins (e.g. "County, State, Country"
// over "City, County, State, Country"); ties within that tier keep
// FamilySearch's own original relevance order (first candidate in the
// array). A single tied candidate always short-circuits straight through,
// completely inert for the (overwhelmingly common) non-tied case.
//
// #262 (live-reported, DanCornett): also reports whether the
// pick was actually CONFIDENT or just an arbitrary tie-break, via the
// returned .ambiguous flag - familySearchPlaceToGeoLocation() (below)
// wires this into the same location.ambiguous field Google's own path
// already sets, which the existing render code already reads to show a
// yellow "Location lookup may be incorrect" pin. A tie resolved by the
// county-only override is a confident, reasoned pick (not ambiguous); a
// tie that fell through to fewest-fields is exactly the case DanCornett
// flagged as needing to be visible - two live different interpretations
// of the same query, with no strong signal to prefer one over the other
// (e.g. "Texas, USA" 1831 scoring four different, unrelated hamlets all
// named Texas identically).
function selectBestTiedFsMatch(tiedCandidates, placeSegment, fullLocationString, placeName) {
    if (tiedCandidates.length === 1) {
        return { places: tiedCandidates[0], ambiguous: false };
    }
    var queryFirstSegment = placeSegment.split(",")[0].trim();
    var geos = tiedCandidates.map(function (places) {
        return familySearchPlaceToGeoLocation(places, fullLocationString, placeName);
    });
    for (var i = 0; i < geos.length; i++) {
        if (countyOnlyOverride(queryFirstSegment, geos[i])) {
            return { places: tiedCandidates[i], ambiguous: false };
        }
    }
    var best = 0;
    var bestCount = countGeoFields(geos[0]);
    for (var j = 1; j < geos.length; j++) {
        var c = countGeoFields(geos[j]);
        if (c < bestCount) {
            best = j;
            bestCount = c;
        }
    }
    return { places: tiedCandidates[best], ambiguous: true };
}

// Maps FamilySearch's place + ancestor-jurisdiction chain onto this
// codebase's existing {city, county, state, country} shape (same shape
// parseGoogle() produces), so every downstream consumer (buildform.js's
// rendering, compareGeo(), etc.) treats a FamilySearch result exactly like
// a Google one - no separate code path needed anywhere else.
//
// places[0] is the matched place itself; places[1..] are its ancestor
// jurisdictions, most specific first. Geni's schema only has 4 slots, but a
// deep historical hierarchy can have more (e.g. town -> Kreis -> province ->
// historical country -> modern country, 5 levels for a 19th-century Prussian
// record) - live-confirmed on issue #224's own test case. Rather than
// guessing which middle level to keep, this always keeps the two ancestors
// closest to the place itself (county, state) and the outermost one
// (country, whatever real-world country the location falls in today) -
// only a level strictly BETWEEN state and country (e.g. a defunct historical
// polity like Prussia, when a modern country like Germany also appears
// after it) ever gets dropped. For shallower hierarchies every level maps
// cleanly with nothing dropped at all.
// #262 (live-reported, DanCornett): ambiguous (optional, defaults false)
// - true when this result came from an UNRESOLVED tied-score match (see
// selectBestTiedFsMatch()'s own comment above). Previously always
// hardcoded false here regardless of how the match was actually picked,
// so the render code's existing yellow "Location lookup may be
// incorrect" pin (already wired to read this same field for Google
// results) could never fire for a genuinely ambiguous FamilySearch match
// - e.g. "Texas, USA" 1831 scoring four different, unrelated hamlets
// identically, with no reliable way to prefer one over the others.
function familySearchPlaceToGeoLocation(places, query, placeName, ambiguous) {
    var location = {
        // #224: placeName is whatever extractPlaceNameSegments() stripped
        // out of the raw string before searching (a venue/address/plot
        // segment) - previously this was always left "" for a FamilySearch
        // result, unlike Google's own parseGoogle() which fills it from
        // address_components. See also computeLeftoverPlaceName() (shared.js)
        // for the SEPARATE "clean up the Place Name field itself" pass this
        // feeds into at render time.
        query: query || "", zip: "", place: placeName || "",
        city: "", county: "", state: "", country: "",
        state_short: "", country_short: "",
        // #229: real coordinates for the matched place itself - confirmed
        // live (direct curl against this same endpoint) that places[0]
        // carries plain numeric latitude/longitude, e.g. 52.2541/13.9318
        // for Storkow. Ancestor jurisdictions (county/state/country) don't
        // have this - a county doesn't have one natural point - so this is
        // only ever set from places[0], never an ancestor. Geni's own
        // location schema already has latitude/longitude fields
        // (popup.js's parseForm() comment) that nothing has ever actually
        // populated before now.
        latitude: exists(places[0].latitude) ? places[0].latitude : "",
        longitude: exists(places[0].longitude) ? places[0].longitude : "",
        count: 1, ambiguous: ambiguous === true
    };

    // Live-reported bug: the "City" field showed the WHOLE comma-joined
    // hierarchy ("Storkow, Oder-Spree, Brandenburg, Germany") instead of
    // just "Storkow". Root cause: places[0] (the matched place itself) is
    // the ONE entry in the array whose names[0].value holds the full
    // combined string (matching its own display.fullName) rather than its
    // own short name - display.name is the short form ("Storkow") for
    // that entry specifically. Ancestor entries (county/state/country)
    // don't have this problem at all - they have no display object, and
    // their names[0].value is already just their own short name - so
    // preferring display.name first (falling back to names[0].value only
    // when there's no display object) fixes places[0] without changing
    // ancestor behavior at all.
    function nameOf(p) {
        if (exists(p) && exists(p.display) && exists(p.display.name)) {
            return p.display.name;
        }
        if (exists(p) && exists(p.names) && exists(p.names[0]) && exists(p.names[0].value)) {
            return p.names[0].value;
        }
        return "";
    }

    // #234 follow-up (live-reported): "Price Hill, Cincinnati, Hamilton,
    // Ohio, United States" - a neighborhood inside a city - was mapping
    // county to "Cincinnati" (itself a city) and state to "Hamilton" (the
    // real county), because ancestors[0]/[1] were assumed to always be
    // county/state. FamilySearch can insert an extra populated-place
    // ancestor (a city enclosing a neighborhood, or similar) between the
    // matched place and the real administrative hierarchy - live-confirmed
    // via each ancestor's own numeric place-type ID (the last path segment
    // of its "type" URL): Cincinnati is type 186 ("City"), the same broad
    // kind of place as the matched neighborhood itself, not an
    // administrative district like a county. Skip any LEADING ancestor
    // whose type is itself a settlement/populated place before assigning
    // county/state - not an exhaustive type list, built from live-
    // confirmed cases (186 City, 308 Neighborhood or suburb, 376 Town, 201
    // Municipality); extend as new cases turn up. Live-confirmed this does
    // NOT affect the Storkow case (its own extra/dropped ancestor,
    // Prussia, is type 362 "State" - an administrative type, never
    // matched by this list) or the Santa Cruz case (#234's own county
    // ancestor is type 209 "County", never matched either).
    // #237 follow-up (live-explored): "520" (Major City) added - a NYC
    // borough match (Manhattan, Brooklyn, Bronx, Queens, Staten Island -
    // all display.type "Borough") has "New York City" itself as an
    // ancestor, type 520. Without this, "New York City" was wrongly
    // treated as the county (adminAncestors[0]), when it's a settlement
    // like Cincinnati, not an administrative district - FamilySearch's
    // NYC hierarchy never actually surfaces the real county names (New
    // York County, Kings County, etc.) at all, so there's no correct
    // county value to extract here regardless; folding it into City
    // ("Manhattan, New York City") is the closest correct answer, not
    // "Manhattan" with a wrong county.
    var FS_SETTLEMENT_ANCESTOR_TYPES = ["186", "308", "376", "201", "520"];
    function typeId(p) {
        if (!exists(p) || !exists(p.type)) {
            return "";
        }
        var parts = p.type.split("/");
        return parts[parts.length - 1];
    }

    // #237 (live-reported): places[0] (the matched place itself) was
    // always assumed to be a city/settlement - but a bare state or county
    // name can itself BE the top-scored FamilySearch match, not a
    // settlement inside one. Live-confirmed via places[0]'s own human-
    // readable display.type (only places[0] carries this - ancestors
    // don't, see nameOf()'s own comment): querying "Pennsylvania" top-
    // matches display.type "State" (its only ancestor is "United
    // States"); querying "Accomack" top-matches display.type "County"
    // ("Accomack, Virginia, United States"). Both were landing in City
    // with the real field (State/County) left blank. Not exhaustive -
    // built from these live-confirmed cases; "Province" added on the
    // same reasoning as FS_BROAD_PLACE_TYPES above (a high-level
    // administrative division, comparable to State for Geni's 4-field
    // schema).
    // #237 follow-up (live-reported): "Colony" added - querying
    // "Virginia, USA" for an event dated 1660-1709 (well within the
    // colonial era, before Virginia was a modern US state) correctly
    // resolves to display.type "Colony" ("Virginia, British Colonial
    // America") - exactly the period-correct resolution this whole
    // feature exists to provide, just a type label the original two
    // cases didn't anticipate. Mapped to "state" for the same reason as
    // Province - the closest fit in Geni's 4-field schema.
    // #237 follow-up (live-reported): "Country" added - querying a bare
    // country name with nothing more specific ("United States" alone, no
    // city/state/county in the original string) was falling all the way
    // through to the settlement/city branch below, since nothing in the
    // original three cases anticipated places[0] itself being a country -
    // live-confirmed via direct query: places[0].display.type "Country",
    // a single-element places array (no ancestors at all, not even a
    // continent), landing "United States" in City with every real field
    // left blank.
    var FS_MATCH_ADMIN_LEVEL = { "County": "county", "State": "state", "Province": "state", "Colony": "state", "Country": "country" };
    var matchedAdminLevel = (exists(places[0]) && exists(places[0].display)) ?
        FS_MATCH_ADMIN_LEVEL[places[0].display.type] : undefined;

    var ancestors = places.slice(1);
    if (matchedAdminLevel !== "country" && ancestors.length >= 1) {
        location.country = nameOf(ancestors[ancestors.length - 1]);
    }
    if (matchedAdminLevel === "country") {
        location.country = nameOf(places[0]);
        // City/county/state intentionally stay blank - nothing more
        // specific than a bare country was actually matched. A country's
        // own ancestor (if any - at most a continent) has no home in
        // Geni's 4-field schema, so it's deliberately ignored here.
    } else if (matchedAdminLevel === "county") {
        location.county = nameOf(places[0]);
        var stateAncestors = ancestors.slice(0, ancestors.length - 1);
        if (stateAncestors.length >= 1) {
            location.state = nameOf(stateAncestors[stateAncestors.length - 1]);
        }
    } else if (matchedAdminLevel === "state") {
        location.state = nameOf(places[0]);
        // City/county intentionally stay blank - nothing more specific
        // than this state/province was actually matched.
    } else {
        location.city = nameOf(places[0]);
        var adminAncestors = ancestors.slice(0, ancestors.length - 1);
        // A skipped settlement ancestor (Cincinnati, enclosing the Price
        // Hill neighborhood) is still real, useful city-level context -
        // fold it into City rather than discarding it: "Price Hill,
        // Cincinnati".
        while (adminAncestors.length > 1 && FS_SETTLEMENT_ANCESTOR_TYPES.indexOf(typeId(adminAncestors[0])) !== -1) {
            location.city = location.city + ", " + nameOf(adminAncestors[0]);
            adminAncestors = adminAncestors.slice(1);
        }
        if (adminAncestors.length === 1) {
            location.state = nameOf(adminAncestors[0]);
        } else if (adminAncestors.length >= 2) {
            location.county = nameOf(adminAncestors[0]);
            location.state = nameOf(adminAncestors[1]);
        }
    }
    // #234: Geni appends " County" to disambiguate a US county from a
    // same-named city (e.g. "Santa Cruz, Santa Cruz County, California,
    // United States") - FamilySearch's own data doesn't carry that
    // suffix (live-confirmed: querying "Santa Cruz, California" returns
    // county ancestor name "Santa Cruz", plain, country "United
    // States"). US-only for now, matching countyOnlyOverride()'s own
    // "County" detection regex - other countries may have their own
    // disambiguation convention, but nothing here is evidenced yet.
    // #237 follow-up (live-reported): "British Colonial America" added -
    // a pre-1776 US record (Westmoreland, Virginia, dated 1660-1709)
    // resolves with country "British Colonial America", not "United
    // States" (the same historically-accurate colonial-era country label
    // the #237 "Colony" fix surfaced) - the county still needs Geni's
    // same " County" convention regardless of which side of 1776 the
    // record falls on.
    // #237 follow-up (live-reported): "Republic of Texas" added - the
    // same reasoning, live-confirmed via "Gonzales, Texas" dated 1840/1842
    // (Texas's independent-republic era, 1836-1845): county ancestor name
    // resolves plain "Gonzales" under country "Republic of Texas", which
    // needs the same " County" suffix as its later "United States" era.
    var FS_US_COUNTY_SUFFIX_COUNTRIES = ["United States", "British Colonial America", "Republic of Texas"];
    // #237 follow-up (live-reported): Louisiana calls its county-equivalent
    // divisions "Parish", not "County" - live-confirmed querying "New
    // Orleans, Louisiana" returns county ancestor name plain "Orleans"
    // (same as every other state), so without a state-specific override
    // this produced "Orleans County", which isn't a real place ("Orleans
    // Parish" is). Not exhaustive - only Louisiana is live-evidenced;
    // every other US state/colonial-era polity keeps the plain "County"
    // default.
    var FS_COUNTY_SUFFIX_WORD_BY_STATE = { "Louisiana": "Parish" };
    if (FS_US_COUNTY_SUFFIX_COUNTRIES.indexOf(location.country) !== -1 && location.county !== "" &&
            !/\s*(County|Parish)\s*$/i.test(location.county)) {
        var countySuffixWord = FS_COUNTY_SUFFIX_WORD_BY_STATE[location.state] || "County";
        location.county = location.county + " " + countySuffixWord;
    }
    // #229 follow-up (live-reported regression): recomputing .place here
    // via computeLeftoverPlaceName() - live-reported as "Potsdam, Preussen"
    // (a genuine leftover, correctly computed) silently getting auto-
    // checked and submitted as Geni's structured place_name sub-field
    // (this function's OWN .place, used for the DIFFERENT "Place: "/
    // place_name_geo row in buildform.js, not the protected/parenthesized
    // location_string row that computeLeftoverPlaceName() was actually
    // built for). place_name_geo's row uses the normal "scraped has real
    // data -> auto-check" rule (geoScored), never the deliberately
    // unchecked-by-default treatment - it was never designed to hold
    // "maybe-useful supplementary residue," only a specific named place
    // when one is genuinely known. Reverted to placeName alone (whatever
    // extractPlaceNameSegments() stripped as an actual venue/address
    // BEFORE ever searching - "" for a location like this one with no such
    // segment) - buildform.js's OWN, SEPARATE computeLeftoverPlaceName()
    // call (unaffected by this revert) remains the one and only place that
    // computes and shows the leftover, in the row that's actually
    // protected for it.
    location.place = placeName || "";
    return location;
}

function queryGeoGoogle(locationset, test) {
    var geoenabled = geoqueryCheck();
    if (!geoenabled) {
        geolocation[locationset.id] = parseGoogle("");
        return;
    }
    //locationset should contain "location", "id", and optionally "place" if detected prior to date.
    if (exists(locationset.location)) {
        //console.log(locationset.id + ": " + locationset.location);
        var unittest = "";
        if (exists(test) && test !== "") {
            unittest = JSON.parse(test);
        }
        var place = "";
        var location = locationset.location.trim();

        if (location.toLowerCase() == "y") {
            geolocation[locationset.id] = parseGoogle("");
            return;
        }
        if (location.toLowerCase() == "at sea") {
            geolocation[locationset.id] = parseGoogle("");
            geolocation[locationset.id].place = location;
            return;
        }
        location = location.replace(/:/ig, "");
        location = location.replace(/Unknown/ig, "");
        location = location.replace(/\[Blank\]/ig, "");
        location = location.replace(/ Dist,/ig, ",");
        location = location.replace(/ Co,/ig, ",");
        if (location.startsWith("Prob")) {
            location = location.replace(/^Prob[, ]/,'').trim();
        } else if (location.startsWith("From")) {
            location = location.replace(/^From[, ]/,'').trim();
        } else if (location.startsWith("of")) {
            location = location.replace(/^of[, ]/,'').trim();
        }
        if (location.contains("\?")) {
            var questionmark = parseGoogle("");
            if (location !== "?") {
                questionmark.place = location;
            }
            geolocation[locationset.id] = questionmark;
            if (unittest !== "") {
                print(geolocation[locationset.id], unittest);
            }
            return;
        }

        if (exists(locationset.place) && locationset.place !== "") {
            place = locationset.place.trim();
        } else {
            place = checkPlace(location);
            var georesult = parseGoogle("", location);
            if (place !== "" && place === location) {
                georesult.place = place;
                geolocation[locationset.id] = georesult;
                return;
            } else if (location === "") {
                geolocation[locationset.id] = georesult;
                return;
            } else if (place === "" && !location.startsWith(",") && USCheck(location)) {
                location = "," + location;  //Prefix string with comma to help prevent mix-ups.
            }
        }

        geostatus.push(geostatus.length);
        if (exists(locationset.retry)) {
            geostatus.pop();
        } else {
            locationset.retry = 0;
        }
        var url = "https://maps.googleapis.com/maps/api/geocode/json?language=en&key=" + google_api + "&address=" + encodeURIComponent(location);
        chrome.runtime.sendMessage({
            method: "GET",
            action: "xhttp",
            url: url,
            variable: {id: locationset.id, place: place, location: locationset.location, unittest: unittest, locationset: locationset}
        }, function (response) {
            var result = JSON.parse(response.source);
            var id = response.variable.id;
            var unittest = response.variable.unittest;
            var full_location = response.variable.location;
            var georesult = new GeoLocation(result, full_location);
            georesult.place = response.variable.place.trim();
            var ffield = full_location.split(",");
            if (ffield[0].toLowerCase().endsWith(" twp") || ffield[0].toLowerCase().endsWith(" twp.") || ffield[0].toLowerCase().endsWith(" township")) {
                var township = ffield[0].replace(/ twp\.?/i, " Township");
                if (!georesult.city.endsWith("Township") && township.startsWith(georesult.city)) {
                    georesult.city = township;
                }
            }
            if (georesult.state !== "" && full_location.toLowerCase().endsWith(georesult.state.toLowerCase() + " colony") && !georesult.state.toLowerCase().contains("colony") && georesult.country !== "") {
                georesult.state = georesult.state + " Colony";
                georesult.country = "";
            }

            geolocation[id] = georesult;

            // ----- if 1st lookup was not unique (count > 1), AND only one element in the original string
            var location_split = full_location.split(",");
            if (location_split.length > 1) {
                location_split.shift();
            } else if (location_split.length === 1 && georesult.count > 1) {
                // ..... ... assume it is a solitary "state" name and force that as the type of location...
                location_split[0] = location_split[0] + " State";
            }
            // ----- Stage 2: Run again with one item removed from front, or modified, for comparison -----
            var short_location = location_split.join(",").trim();
            if (location_split.length > 0) {
                var url = "https://maps.googleapis.com/maps/api/geocode/json?language=en&key=" + google_api + "&address=" + encodeURIComponent(short_location);
                chrome.runtime.sendMessage({
                    method: "GET",
                    action: "xhttp",
                    url: url,
                    variable: {id: id, location: short_location, unittest: unittest, place: response.variable.place, full: full_location, locationset: locationset}
                }, function (response) {
                    var result = JSON.parse(response.source);
                    var id = response.variable.id;
                    var short_location = response.variable.location;
                    var unittest = response.variable.unittest;
                    var georesult = new GeoLocation(result, response.variable.location);
                    if (georesult.state !== "" && short_location.toLowerCase().endsWith(georesult.state.toLowerCase() + " colony") && !georesult.state.toLowerCase().contains("colony") && georesult.country !== "") {
                        georesult.state = georesult.state + " Colony";
                        georesult.country = "";
                    }
                    if (countGeoFields(georesult) === 0 && countGeoFields(geolocation[id]) === 0) {
                        georesult = geolocation[id];
                    } else {
                        if (countGeoFields(georesult) === 0 && !georesult.place.contains(" States")) {
                            georesult.place = georesult.place.replace(" State", "").trim();
                        }
                        georesult = compareGeo(georesult, geolocation[id]);
                        if (georesult.city !== "" && georesult.city === georesult.state) {
                            //This tries to deal with "New York", "NY", or "New York, United States"
                            //to prevent it from listing the City of New York.
                            if (georesult.query === georesult.city) {
                                georesult.city = "";
                            } else {
                                var querysplit = georesult.query.split(",");
                                if (querysplit.length > 1 && ((querysplit[1].trim() === georesult.country || querysplit[1].trim() === georesult.country_short) || (querysplit[0].trim() === georesult.state || querysplit[0].trim() === georesult.state_short))) {
                                    georesult.city = "";
                                } else if (querysplit[0].trim() === georesult.state || querysplit[0].trim() === georesult.state_short) {
                                    georesult.city = "";
                                }
                            }
                        }
                    }
                    georesult.query = full_location;
                    // #229 follow-up (live-reported regression): the
                    // computeLeftoverPlaceName() recompute that used to sit
                    // here was WRONG for this field - live-reported as a
                    // computed leftover ("Potsdam, Preussen" on the
                    // FamilySearch side of this same fix) getting silently
                    // auto-checked and submitted as Geni's structured
                    // place_name sub-field, since THIS row uses the normal
                    // "scraped has real data -> auto-check" rule
                    // (geoScored in buildform.js), never the deliberately
                    // unchecked-by-default treatment the SEPARATE leftover
                    // suggestion (location_string, buildform.js's own,
                    // unaffected computeLeftoverPlaceName() call) actually
                    // gets. .place here is left as whatever parseGoogle()'s
                    // own address_components typing already determined (a
                    // genuine sublocality/POI, or "" if none) - narrower
                    // than "everything not otherwise captured," but that's
                    // the correct scope for a field that auto-checks itself.
                    if (georesult.place === georesult.state) {
                        georesult.place = "";
                    } else if (georesult.place === georesult.city) {
                        georesult.place = "";
                    }
                    if (georesult.count === 0 && (!exists(locationset.retry) || locationset.retry < 0)) {
                        locationset.retry += 1;
                        console.log("Retry " + locationset.retry + " - Failed to Locate: " + full_location);
                        setTimeout(queryGeoGoogle, 1000, locationset);
                    } else {
                        geolocation[id] = georesult;
                        if (unittest !== "") {
                            print(geolocation[id], unittest);
                        }
                        geostatus.pop();
                    }
                });
            } else {
                if (unittest !== "") {
                    print(geolocation[id], unittest);
                }
                if (verbose) {
                    console.log(full_location);
                    console.log(JSON.stringify(geolocation[id]));
                }

                geostatus.pop();
            }

        });
    }
}

// #258 (live-reported): "united states of america" added - FindAGrave's
// own default location string uses the full phrase, not the shorter
// "United States" this already matched.
function USCheck(location) {
    l = location.toLowerCase();
    return (l.endsWith("united states of america") || l.endsWith("united states") || l.endsWith(" usa") || l.endsWith(" us"));
}

function matchGeoFields(g1, g2, cnt) {
    if (cnt < 1) {
        return false;
    }
    if (g1.country === g2.country) {
        if (cnt === 1) {
            return true;
        } else if (g1.state === g2.state) {
            if (cnt === 2) {
                return true;
            } else if (g1.county === g2.county) {
                if (cnt === 3) {
                    return true;
                } else if (g1.city === g2.city) {
                    if (cnt === 4) {
                        return true;
                    } else if (g1.place === g2.place) {
                        if (cnt === 5) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    return false;
}

function countGeoFields(list) {
    var fldcount = 0;
    if (exists(list.country) && list.country.trim() !== "") {
        fldcount++;
    }
    if (exists(list.state) && list.state.trim() !== "") {
        fldcount++;
    }
    if (exists(list.county) && list.county.trim() !== "") {
        fldcount++;
    }
    if (exists(list.city) && list.city.trim() !== "") {
        fldcount++;
    }
    return fldcount;
}

// #225: before compareGeo() blindly prefers whichever candidate has more
// populated fields (its long-standing default, both branches below),
// check whether the OTHER (fewer-fields) candidate is actually a precise,
// unambiguous county-only match for the query term - if so, that's the
// more likely correct answer, not the one with more fields. Live-reported:
// for a query like "XXXX, State" - genuinely ambiguous, since Google can
// return BOTH a same-named city and the county itself as separate
// candidates - the existing logic always preferred the city match purely
// because it had one extra field filled in, even for records
// genealogically indexed at the county level (the U.S. historical norm
// the issue describes), where the county-only match is what's actually
// correct. Per the issue's own stated examples, this holds even when the
// city candidate's OWN name also happens to equal the query term (a real
// place can have both a city and a same-named county) - county-level
// indexing is common enough for this tool's use case that the issue's
// author judged the county interpretation the better default in both
// shapes, not just the "coincidental unrelated county" one.
// UNVERIFIED against Google's live API (no key available in this
// environment) - covered by synthetic tests against realistic candidate
// shapes only. Additive and inert when it returns false: every existing
// branch's original behavior is completely unchanged in that case.
function countyOnlyOverride(queryTerm, candidate) {
    if (!exists(candidate) || candidate.city !== "" || candidate.county === "") {
        return false;
    }
    // Strip a trailing "County" (or Louisiana's "Parish" - see
    // FS_COUNTY_SUFFIX_WORD_BY_STATE in familySearchPlaceToGeoLocation())
    // from BOTH sides before comparing - the scraped source text might
    // already spell it out explicitly ("Story County, Iowa" / "Orleans
    // Parish, Louisiana") or might not ("Story, Iowa" / "Orleans,
    // Louisiana"), and the comparison needs to work either way.
    var normQuery = String(queryTerm || "").replace(/\s*(County|Parish)\s*$/i, "").trim().toLowerCase();
    var normCounty = candidate.county.replace(/\s*(County|Parish)\s*$/i, "").trim().toLowerCase();
    return normQuery !== "" && normCounty !== "" && normQuery === normCounty;
}

function compareGeo(shortGeo, longGeo) {
    var location = {};
    // check for inconsistent results
    var ambig = false;
    if ((shortGeo.country !== "") && (longGeo.country !== "") && (shortGeo.country !== longGeo.country)) {
        ambig = true;
    }
    if ((shortGeo.state !== "") && (longGeo.state !== "") && (shortGeo.state !== longGeo.state)) {
        ambig = true;
    }
    if ((shortGeo.county !== "") && (longGeo.county !== "") && (shortGeo.county !== longGeo.county)) {
        ambig = true;
    }
    // don't check more than that.
    if ((longGeo.count > 1) && (shortGeo.count > 1)) {
        ambig = true;
    }

    // get number of fields 'used' by each
    var numShortFields = countGeoFields(shortGeo);
    var numLongFields = countGeoFields(longGeo);
    var minOfFields = Math.min(numShortFields,numLongFields);
    if (verbose) {
        console.log("Return counts: ",shortGeo.count,longGeo.count);
        console.log("Field counts: ",numShortFields,numLongFields,minOfFields);
    }
    var fields_match = matchGeoFields(shortGeo, longGeo, minOfFields);
    if (verbose){
        console.log("Match? ",fields_match," : ",longGeo.query);
        console.log("Short: ", numShortFields, shortGeo);
        console.log("Long:  ", numLongFields, longGeo);
    }
    // extract difference between the queries
    var location_split = longGeo.query.split(",");
    if (exists(longGeo.place) && (longGeo.place !== "")) {
        location_split[0] = longGeo.place;
    }

    /*    if (numLongFields === 0 && numShortFields > 0) {
     location = shortGeo;
     }
     else if (numLongFields > 0 && numShortFields === 0) {
     location = longGeo;
     }
     else */
    if (numLongFields === 0 && numShortFields === 0) {
        if (verbose){console.log("both have 0 - look at place");}
        if (longGeo.place !== "") {
            location = longGeo;
        } else {
            location = shortGeo;
        }
    } else if (((longGeo.count !== 1) && (shortGeo.count !== 1)) || ((longGeo.count === 1) && (shortGeo.count !== 1))) {
// if neither had unique data, or only Long did, use Long results (which at least has .place set)
        location = longGeo;
        if (verbose){console.log("used long when short or both had 0 or multiples");}
    } else if ((longGeo.count !== 1) && (shortGeo.count === 1)) {
// if only Short has unique results, use it, adding long's query diff
        location = shortGeo;
        if (verbose){console.log("used short when long had 0 or multiples");}
// ... do we suspect the 'place' is a state?
        if (numShortFields === 1) {
            location.state = locationCase(location_split[0]);
            if (verbose){console.log("... & used loc.split[0] as state");}
        }
// #229 follow-up: the old "guess .place from location_split[0]" fallback
// removed here, not replaced - assuming the first comma segment is always
// the leftover broke for a European street-address-first location like
// "Jagowstraße 29-33, Grunewald, Berlin, Germany" (see the live-traced
// #229 case), overwriting a correct address_components-derived value
// ("Grunewald") with raw street-address text. .place is left as whatever
// parseGoogle()'s own address_components typing already determined for
// this candidate (see queryGeoGoogle()'s own comment on the same point) -
// buildform.js's SEPARATE computeLeftoverPlaceName() call still computes
// the Place Name (location_string) suggestion, just not by feeding through
// this function's .place.
    } else {
// both returns are unique (count=1), so see how they match up
        if ((numShortFields > numLongFields) && (fields_match) && !countyOnlyOverride(location_split[0], longGeo)) {
// case of only one value in the short query, use query diff? (e.g.: Virgina, USA)
            location = shortGeo;
            if (verbose){console.log("used short when short had more fields & match");}
// ... do we suspect the 'place' is a state? (.place fallback removed here -
// see the first occurrence's own comment above.)
            if (numShortFields === 1) {
                location.state = locationCase(location_split[0]);
                if (verbose){console.log("... & used loc.split[0] as state");}
            }
        } else if ((numShortFields > numLongFields) && (fields_match)) {
// #225: countyOnlyOverride() fired above - longGeo (fewer fields) is the
// precise county-only match, use it instead of short despite short
// having more fields.
            location = longGeo;
            if (verbose){console.log("#225: overrode to long (county-only match) despite short having more fields");}
        } else if ((numShortFields < numLongFields) && (fields_match) && !countyOnlyOverride(location_split[0], shortGeo)) {
            location = longGeo;
            if (verbose){console.log("used long when long had more fields & match");}
        } else if ((numShortFields < numLongFields) && (fields_match)) {
// #225: countyOnlyOverride() fired above - shortGeo (fewer fields) is the
// precise county-only match, use it instead of long despite long having
// more fields.
            location = shortGeo;
            if (verbose){console.log("#225: overrode to short (county-only match) despite long having more fields");}
        } else {
// both have the same number of fields & same contents for them,
// use Short results + long.place
            if ((numShortFields === numLongFields) && (fields_match)) {
                location = shortGeo;
                if (verbose){console.log("used short when min fields are the same");}
// ... do we suspect the 'place' is a state? (.place fallback removed here -
// see the first occurrence's own comment above.)
                if (numShortFields === 1) {
                    location.state = locationCase(location_split[0]);
                    if (verbose){console.log("... & used loc.split[0] as state");}
                }
            } else if (countyOnlyOverride(location_split[0], shortGeo)) {
// #225: this is actually the MORE realistic path for the county-vs-city
// bug this whole override exists for - a genuine county mismatch (e.g.
// shortGeo.county="XXXX County" vs longGeo.county="YYYY County") makes
// matchGeoFields() correctly return false once country is populated on
// both sides (the common case for real Google responses), landing here
// rather than in either fields_match-gated branch above.
                location = shortGeo;
                if (verbose){console.log("#225: overrode to short (county-only match) in the mismatched-fields catch-all");}
            } else if (countyOnlyOverride(location_split[0], longGeo)) {
                location = longGeo;
                if (verbose){console.log("#225: overrode to long (county-only match) in the mismatched-fields catch-all");}
            } else {
// both has same number of fields, but they differ in contents
// use long results ... but this could really go either way!  (perhaps retain both for user to choose)
                location = longGeo;
                if (verbose){console.log("used long when field contents differ");}
                if (!(ambig) && longGeo.count !== 1) {
                    //If the long has a count of 1, assume it's not ambig
                    ambig = true;
                    if (verbose){console.log("... and marked ambiguous");}
                }
            }
        }
    }

    if (location.county === "" && countryPattern.test(location.place)) {
        location.county = location.place;
        location.place = "";
    }
    if (location.country === location.state && location.county === "" && location.city === "") {
        location.state = "";
    }
    if (exists(location.country) && exists(location.state) && location.country.toLowerCase() === "united states" && location.state.toLowerCase() === "usa") {
        location.state = "";
    }

    //----------- Problem Locations --------
    if (location.city === "Ontario") {
        ambig = true;
    }
    //--------------------------------------

    location.ambiguous = ambig;
    return location;
}

function locationCase(name) {
    if (!NameParse.is_camel_case(name)) {
        name = NameParse.fix_case(name);
    }
    return name;
}

var fcount = 1;
var acount = 1;
var pcount = 1;

function print(location, unittest) {
    console.log("---------------------------------------");
    console.log("Query: " + location.query);
    console.log("Count: " + location.count);
    console.log("Place: " + location.place);
    console.log("City: " + location.city);
    console.log("County: " + location.county);
    console.log("State: " + location.state);
    console.log("Country: " + location.country);

    if (exists(unittest) && matchGeoFields(location, unittest, 5)) {
        console.log("Matching: " + JSON.stringify(unittest));
        console.log("%cPassed (" + pcount + ")", 'background: #222; color: #55da7e');
        pcount++;
    } else {
        console.log("Expected: " + JSON.stringify(unittest));
        console.log("Received: " + JSON.stringify(location));
        if (exists(unittest.alt) && matchGeoFields(location, unittest.alt, 5)) {
            console.log("%cAcceptable (" + acount + ")", 'background: #222; color: #EDDD00');
            acount++;
        } else {
            console.log("%cFailed (" + fcount + ")", 'background: #222; color: #FF231A');
            fcount++;
        }
    }
    console.log("---------------------------------------\n")
}
