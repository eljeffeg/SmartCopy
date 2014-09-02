;var GeoLocation = function (results, query) {

    var location = {};
    location.query = query || "";
    location.place = "";
    location.zip = "";
    location.city = "";
    location.county = "";
    location.state = "";
    location.country = "";
    location.count = 0;

    if (!exists(results["results"])) {
        return location;
    }
    results = results["results"];
    location.count = results.length;

    if (results.length >= 1) {
        for (var i = 0; i < results[0].address_components.length; i++) {
            var long_name = results[0].address_components[i].long_name;
            switch (results[0].address_components[i].types.join(",")) {
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
    }
    if (location.place === "" && location.city === "" && location.county === "" && location.state === "" && location.country === "") {
        location.place = location.query;
    }
    return location;
};

function checkPlace(location) {
    var splitplace = location.split(",");
    var checkplace = splitplace[0].toLowerCase().trim();
    var place = "";
    if (checkplace.contains(" cemetery") || checkplace.contains(" cemetary") || checkplace.contains(" grave") || checkplace.toLowerCase().endsWith(" cem") || checkplace.toLowerCase().endsWith(" cem.")) {
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
    var unittest = test || false;
    //locationset should contain "location", "id", and optionally "place" if detected prior to date.
    if (exists(locationset.location)) {
        var place = "";
        if (exists(locationset.place) && locationset.place !== "") {
            place = locationset.place;
        } else {
            place = checkPlace(locationset.location);
        }
        geostatus.push(geostatus.length);
        var url = "http://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(locationset.location);
        chrome.extension.sendMessage({
            method: "GET",
            action: "xhttp",
            url: url,
            variable: {id: locationset.id, place: place, location: locationset.location}
        }, function (response) {
            var result = jQuery.parseJSON(response.source);
            var id = response.variable.id;
            var full_location = response.variable.location;
            var georesult = new GeoLocation(result, full_location);
            if (response.variable.place !== "") {
                georesult.place = response.variable.place;
            }
            geolocation[id] = georesult;

            // ----- Stage 2: Run again with one item removed from front for comparison -----
            var location_split = full_location.split(",");
            if (location_split.length > 1) {
                location_split.shift();
                var short_location = location_split.join(",");
                var url = "http://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(short_location);
                chrome.extension.sendMessage({
                    method: "GET",
                    action: "xhttp",
                    url: url,
                    variable: {id: id, location: short_location}
                }, function (response) {
                    var result = jQuery.parseJSON(response.source);
                    var id = response.variable.id;
                    var georesult = new GeoLocation(result, response.variable.location);
                    geolocation[id] = compareGeo(georesult, geolocation[id], unittest);
                    geostatus.pop();
                });
            } else {
                if (unittest) {
                    print(geolocation[id]);
                }
                geostatus.pop();
            }
        });
    }
}

function compareGeo(shortGeo, longGeo, logging) {
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
    if (((longGeo.count > 1) && (shortGeo.count > 1)) || ((longGeo.count === 1) && (shortGeo.count > 1))) {
        location = longGeo;
    } else if ((longGeo.count > 1) && (shortGeo.count === 1)) {
        location = shortGeo;
    } else {
// both counts = 1
        location.place = longGeo.place; //longGeo has the Cemetery & Grave filter
        location.city = longGeo.city;
        location.county = longGeo.county;
        location.state = longGeo.state;
        location.country = longGeo.country;
        if ((shortGeo.city === longGeo.city) && (shortGeo.city !== "")) {
            var location_split = longGeo.query.split(",");
            location.place = location_split.shift();
            location.city = shortGeo.city;
        }
    }
    location.query = longGeo.query;
    location.ambiguous = ambig;
    if (location.ambiguous) {
        console.log(" Warning: Location is ambiguous!", location.query);
    }
    if (logging) {
        print(location);
    }
    return location;

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

function print(location) {
    console.log("---------------------------------------");
    console.log("Query: " + location.query);
    console.log("Place: " + location.place);
    console.log("City: " + location.city);
    console.log("County: " + location.county);
    console.log("State: " + location.state);
    console.log("Country: " + location.country);
    console.log("---------------------------------------\n")
}