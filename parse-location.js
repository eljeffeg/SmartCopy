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

function queryGeo(locationset, test) {
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
                        georesult.place = geolocation[id].query;
                    } else {
                        if (countGeoFields(georesult) === 0 && !georesult.place.contains(" States")) {
                            georesult.place = georesult.place.replace(" State", "").trim();
                        }
                        georesult = compareGeo(georesult, geolocation[id]);
                        if (response.variable.place !== "") {
                            georesult.place = response.variable.place.trim();
                        } else if (georesult.place === georesult.state) {
                            georesult.place = "";
                        } else if (georesult.city !== "" && georesult.city === georesult.state) {
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

                        if (georesult.place === georesult.city) {
                            georesult.place = "";
                        }
                    }
                    georesult.query = full_location;
                    if (georesult.count === 0 && (!exists(locationset.retry) || locationset.retry < 0)) {
                        locationset.retry += 1;
                        console.log("Retry " + locationset.retry + " - Failed to Locate: " + full_location);
                        setTimeout(queryGeo, 1000, locationset);
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

function USCheck(location) {
    l = location.toLowerCase();
    return (l.endsWith("united states") || l.endsWith(" usa") || l.endsWith(" us"));
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
        } else if ((numShortFields > 1) && (location.state !== location_split[0])) {
            location.place = locationCase(location_split[0]);
            if (verbose){console.log("... & used loc.split[0] as place (when not same as state)");}
        }
    } else {
// both returns are unique (count=1), so see how they match up
        if ((numShortFields > numLongFields) && (fields_match)) {
// case of only one value in the short query, use query diff? (e.g.: Virgina, USA)
            location = shortGeo;
            if (verbose){console.log("used short when short had more fields & match");}
// ... do we suspect the 'place' is a state?
            if (numShortFields === 1) {
                location.state = locationCase(location_split[0]);
                if (verbose){console.log("... & used loc.split[0] as state");}
            } else if (location_split[0] !== location.query && location_split[0] + " State" !== location.query) {
                location.place = locationCase(location_split[0]);
                if (verbose){console.log("... & used loc.split[0] as place");}
            }
        } else if ((numShortFields < numLongFields) && (fields_match)) {
            location = longGeo;
            if (verbose){console.log("used long when long had more fields & match");}
        } else {
// both have the same number of fields & same contents for them,
// use Short results + long.place
            if ((numShortFields === numLongFields) && (fields_match)) {
                location = shortGeo;
                if (verbose){console.log("used short when min fields are the same");}
// ... do we suspect the 'place' is a state?
                if (numShortFields === 1) {
                    location.state = locationCase(location_split[0]);
                    if (verbose){console.log("... & used loc.split[0] as state");}
                }  else if (location_split[0] !== location.query && location_split[0] + " State" !== location.query) {
                    location.place = locationCase(location_split[0]);
                    if (verbose){console.log("... & used loc.split[0] as place");}
                }
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
