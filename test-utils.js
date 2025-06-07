function getUrlFromJson(obj) {
    let result = '';
    for (var key in obj) {
        if (result != '') {
            result += '&';
        }
        result += key + '=' + encodeURIComponent(obj[key]);
    }
    return result;
}

function getJsonFromUrl(query) {
    if (typeof query === 'string') {
        var result = {};
        query.split('&').forEach(function(part) {
            var item = part.split('=');
            result[item[0]] = decodeURIComponent(item[1]);
        });
        return result;
    } else {
        return query;
    }
}

function isValidDate(d) {
    return d instanceof Date && !isNaN(d);
}

function getProfileName(profile) {
    if (typeof profile === 'object') {
        if (profile.displayname) {
            return profile.displayname;
        }
        if (profile.display_name) {
            return profile.display_name;
        }
        if (profile.displayName) {
            return profile.displayName;
        }
    }
    return profile;
}

module.exports = {getUrlFromJson, getJsonFromUrl, isValidDate, getProfileName};