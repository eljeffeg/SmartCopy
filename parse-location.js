;var GeoLocation = function (results) {

    var location = {};
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
            switch (results[0].address_components[i].types.join(",")) {
                case 'postal_code':
                case 'postal_code_prefix,postal_code':
                    location.zip = results[0].address_components[i].long_name;
                    break;

                case 'sublocality,political':
                case 'locality,political':
                case 'neighborhood,political':
                case 'administrative_area_level_3,political':
                    location.city = results[0].address_components[i].long_name;
                    break;

                case 'administrative_area_level_2,political':
                    location.county = results[0].address_components[i].long_name;
                    break;

                case 'administrative_area_level_1,political':
                    location.state = results[0].address_components[i].long_name;
                    break;

                case 'country,political':
                    location.country = results[0].address_components[i].long_name;
                    break;
            }
        }
    }
    return location;
};