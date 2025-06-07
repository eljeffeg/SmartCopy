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

module.exports = {getUrlFromJson, getJsonFromUrl, isValidDate};