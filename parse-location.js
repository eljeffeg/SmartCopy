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
    return location;
};