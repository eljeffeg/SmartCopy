var verbose = false;
var GeoLocation = function (results, query) {
    var location = {};
    if (!exists(results["results"])) {
        location.count = 0;
        return location;
    }
    results = results["results"];

    if (results.length === 1) {
        location = parseGoogle(results[0], query);
        location.count = 1;
/*    } else if (results.length > 1) {
        var locationset = [];
        for (var i = 0; i < results.length; i++) {
            locationset[i] = parseGoogle(results[i], query);
            locationset[i].count = results.length;
            locationset[i].query = query || "";
        }
        for (var i = 1; i < results.length; i++) {
            location = compareGeo(locationset[i], locationset[0]);
        } */
    } else {
        location = parseGoogle("", query);
        location.count = 0;
    }

    if (location.place === "" && location.city === "" && location.county === "" && location.state === "" && location.country === "") {
        location.place = location.query;
    }

    return location;
};

function parseGoogle(result, query) {
    var location = {};
    location.query = query || "";
    location.place = "";
    location.zip = "";
    location.city = "";
    location.county = "";
    location.state = "";
    location.country = "";
    if (exists(result.address_components)) {
        for (var i = 0; i < result.address_components.length; i++) {
            var long_name = result.address_components[i].long_name;
            switch (result.address_components[i].types.join(",")) {
                case 'point_of_interest,establishment':
                    location.place = long_name;
                    break;
                case 'establishment':
                    location.place = long_name;
                    break;
                case 'postal_code':
                case 'postal_code_prefix,postal_code':
                    location.zip = long_name;
                    break;
                case 'sublocality,political':
                case 'locality,political':
                    if (isNaN(long_name)) {
                        location.city = long_name;
                    }
                    break;
                case 'neighborhood,political':
                case 'administrative_area_level_3,political':
                    if (location.city === "" && isNaN(long_name)) {
                        //If the city is not in locality, use admin area 3
                        location.city = long_name;
                    }
                    break;

                case '':
                    if (location.city === "" && isNaN(long_name)) {
                        //If the city is not in locality or admin area 3
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
                    break;

                case 'country,political':
                    if (isNaN(long_name)) {
                        location.country = long_name;
                    }
                    break;
            }
        }
        var split = location.query.split(",");
        if (split.length === 1) {
            var count = countGeoFields(location);
            if (count > 3) {
                //Only one field but returning 4 - seems unlikely to be accurate
                var subquery = location.query;
                location = parseGoogle("", subquery);
                location.place = subquery;
            }
        }
    }
    return location;
}

function checkPlace(location) {
    var splitplace = location.split(",");
    var checkplace = splitplace[0].toLowerCase().trim();
    var place = "";
    if (checkplace.contains(" cemetery") || checkplace.contains(" cemetary") || checkplace.contains(" grave") ||
        checkplace.toLowerCase().endsWith(" cem") || checkplace.toLowerCase().endsWith(" cem.") ||
        checkplace.toLowerCase().endsWith(" territory")) {
        if (checkplace.toLowerCase().endsWith(" cem") || checkplace.toLowerCase().endsWith(" cem.")) {
            place = splitplace[0].replace(/ cem\.?/i, " Cemetery").trim();
        } else if (checkplace.contains(" cemetary")) {
            place = splitplace[0].replace(/ cemetary/i, " Cemetery").trim();
        } else {
            place = splitplace[0];
            place = place.trim();
        }
    }
    return place
}

function queryGeo(locationset, test) {
    //locationset should contain "location", "id", and optionally "place" if detected prior to date.
    if (exists(locationset.location)) {
        var unittest = "";
        if (exists(test) && test !== "") {
            unittest = JSON.parse(test);
        }
        var place = "";
        var location = locationset.location.trim();
        if (exists(locationset.place) && locationset.place !== "") {
            place = locationset.place.trim();
        } else {
            place = checkPlace(location);
        }
        geostatus.push(geostatus.length);
        var url = "http://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(location);
        chrome.extension.sendMessage({
            method: "GET",
            action: "xhttp",
            url: url,
            variable: {id: locationset.id, place: place, location: locationset.location, unittest: unittest}
        }, function (response) {
            var result = jQuery.parseJSON(response.source);
            var id = response.variable.id;
            var unittest = response.variable.unittest;
            var full_location = response.variable.location;
            var georesult = new GeoLocation(result, full_location);
            georesult.place = response.variable.place;

            geolocation[id] = georesult;

			// ----- if 1st lookup was not unique (count > 1), AND only one element in the original string
            var location_split = full_location.split(",");
            if (location_split.length > 1) {
                location_split.shift();
            } else if (location_split.length === 1) {
				// ..... ... assume it is a solitary "state" name and force that as the type of location...
            	location_split[0] = location_split[0] + " State";
            };
            // ----- Stage 2: Run again with one item removed from front, or modified, for comparison -----
            var short_location = location_split.join(",");
            if (location_split.length > 0) {
                var url = "http://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(short_location);
                chrome.extension.sendMessage({
                    method: "GET",
                    action: "xhttp",
                    url: url,
                    variable: {id: id, location: short_location, unittest: unittest, place: response.variable.place}
                }, function (response) {
                    var result = jQuery.parseJSON(response.source);
                    var id = response.variable.id;
                    var unittest = response.variable.unittest;
                    var georesult = new GeoLocation(result, response.variable.location);
                    if (response.variable.place !== "") {
                        georesult.place = response.variable.place;
                    }
                    geolocation[id] = compareGeo(georesult, geolocation[id]);
                    if (unittest !== "") {
                        print(geolocation[id], unittest);
                    }
                    geostatus.pop();
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
    if (list.country !== "") {
        fldcount++;
    }
    if (list.state !== "") {
        fldcount++;
    }
    if (list.county !== "") {
        fldcount++;
    }
    if (list.city !== "") {
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
    else */ if (((longGeo.count !== 1) && (shortGeo.count !== 1)) || ((longGeo.count === 1) && (shortGeo.count !== 1))) {
// if neither had unique data, or only Long did, use Long results (which at least has .place set)
        location = longGeo;
        if (verbose){console.log("used long when short or both had 0 or multiples");}
    } else if ((longGeo.count !== 1) && (shortGeo.count === 1)) {
// if only Short has unique results, use it, adding long's query diff
        location = shortGeo;
        if (verbose){console.log("used short when long had 0 or multiples");}
// ... do we suspect the 'place' is a state?
        if (numShortFields === 1) {
            location.state = location_split[0];
            if (verbose){console.log("... & used loc.split[0] as state");}
        } else if ((numShortFields > 1) && (location.state !== location_split[0])) {
            location.place = location_split[0];
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
                location.state = location_split[0];
                if (verbose){console.log("... & used loc.split[0] as state");}
            } else {
                location.place = location_split[0];
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
                    location.state = location_split[0];
                    if (verbose){console.log("... & used loc.split[0] as state");}
                } else {
                    location.place = location_split[0];
                    if (verbose){console.log("... & used loc.split[0] as place");}
                }
            } else {
// both has same number of fields, but they differ in contents
// use long results ... but this could really go either way!  (perhaps retain both for user to choose)
                location = longGeo;
                if (verbose){console.log("used long when field contents differ");}
                if (!(ambig)) {
	                ambig = true;
	                if (verbose){console.log("... and marked ambiguous");}
                }
            }
        }
    }

//    location.query = longGeo.query;
    location.ambiguous = ambig;
    return location;
    /*
     var location = {};
     location.query = longGeo.query;
     location.place = longGeo.place; //longGeo has the Cemetery & Grave filter
     if (location.place === "" || shortGeo.place === shortGeo.query) {
     location.city = longGeo.city;
     location.county = longGeo.county;
     location.state = longGeo.state;
     location.country = longGeo.country;
     if (shortGeo.city === longGeo.city && shortGeo.city !== "") {
     var location_split = longGeo.query.split(",");
     location.place = location_split.shift();
     }
     } else {
     if (shortGeo.city === "" && longGeo.city !== "") {
     location.city = longGeo.city;
     } else {
     location.city = shortGeo.city;
     }
     if (shortGeo.county === "" && longGeo.county !== "") {
     location.county = longGeo.county;
     } else {
     location.county = shortGeo.county;
     }
     if (shortGeo.state === "" && longGeo.state !== "") {
     location.state = longGeo.state;
     } else {
     location.state = shortGeo.state;
     }
     if (shortGeo.country === "" && lonGeo.country !== "") {
     location.country = longGeo.country;
     } else {
     location.country = shortGeo.country;
     }
     }
     return location;
     */
    /**
     var location = {};
     location.query = longGeo.query;
     location.place = longGeo.place; //longGeo has the Cemetery & Grave filter
     if (location.place === "" || shortGeo.place === shortGeo.query) {
        location.city = longGeo.city;
        location.county = longGeo.county;
        location.state = longGeo.state;
        location.country = longGeo.country;
        if (shortGeo.city === longGeo.city && shortGeo.city !== "") {
            var location_split = longGeo.query.split(",");
            location.place = location_split.shift();
        }
    } else {
        location.city = shortGeo.city;
        location.county = shortGeo.county;
        location.state = shortGeo.state;
        location.country = shortGeo.country;
    }
     */

    /**
     *  else if (shortGeo.county === longGeo.county && shortGeo.county !== "") {
            location.place = location_split.shift();
        } else if (shortGeo.state === longGeo.state && shortGeo.state !== "") {
            location.place = location_split.shift();
        } else if (shortGeo.country === longGeo.country && shortGeo.country !== "") {
            location.place = location_split.shift();
        }
     */
    /**
     if (shortGeo.city === longGeo.city && shortGeo.city !== "") {
            if (longGeo.place === "") {
                location.place = location_split.shift();
            }
    } else if (shortGeo.county === longGeo.county && shortGeo.county !== "") {
        if (shortGeo.city === "" && longGeo.city !== "") {
            location.city = longGeo.city;
        }
    } else if (shortGeo.state === longGeo.state && shortGeo.state !== "") {
        if (shortGeo.county === "" && longGeo.county !== "") {
            location.county = longGeo.county;
            if (location.city === "" && longGeo.city !== "") {
                location.city = longGeo.city;
            }
        }
    } else if (shortGeo.country === longGeo.country && shortGeo.country !== "") {
        if (shortGeo.state === "" && longGeo.state !== "") {
            location.state = longGeo.state;
            if (location.county === "" && longGeo.county !== "") {
                location.county = longGeo.county;
                if (location.city === "" && longGeo.city !== "") {
                    location.city = longGeo.city;
                }
            }
        }
    } else if (shortGeo.country === "") {
        location.country = longGeo.country;
        location.state = longGeo.state;
        location.county = longGeo.county;
        location.city = longGeo.city;
    }*/
}

function print(location, unittest) {
    console.log("---------------------------------------");
    console.log("Query: " + location.query);
    console.log("Place: " + location.place);
    console.log("City: " + location.city);
    console.log("County: " + location.county);
    console.log("State: " + location.state);
    console.log("Country: " + location.country);

    if (exists(unittest) && matchGeoFields(location, unittest, 5)) {
        console.log("Matching: " + JSON.stringify(unittest));
        console.log("%cPassed", 'background: #222; color: #55da7e');
    } else {
        console.log("Expected: " + JSON.stringify(unittest));
        console.log("Received: " + JSON.stringify(location));
        console.log("%cFailed", 'background: #222; color: #fb1520');
    }
    console.log("---------------------------------------\n")
}
