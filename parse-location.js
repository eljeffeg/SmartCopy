;var GeoLocation = function (results, query) {

    var location = {};
    location.query = query || "";
    location.place = "";
    location.zip = "";
    location.city = "";
    location.county = "";
    location.state = "";
    location.country = "";
    if (!exists(results["results"])) {
        return location;
    }
    results = results["results"];

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

function compareGeo(shortGeo, longGeo) {
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
    return location;
}