/**
 * Convert an object to a query string.
 * @param {Object} obj key/value pairs
 * @returns {string} encoded query string
 */
function getUrlFromJson(obj) {
    let result = '';
    for (const key in obj) {
        if (result !== '') {
            result += '&';
        }
        result += key + '=' + encodeURIComponent(obj[key]);
    }
    return result;
}

/**
 * Parse a query string into an object.
 * @param {string|Object} query string or object
 * @returns {Object} parsed key/value pairs
 */
function getJsonFromUrl(query) {
    if (typeof query === 'string') {
        const result = {};
        query.split('&').forEach(part => {
            const item = part.split('=');
            result[item[0]] = decodeURIComponent(item[1]);
        });
        return result;
    }
    return query;
}

/**
 * Validate that a Date object is valid.
 * @param {*} d value to test
 * @returns {boolean} true if valid Date
 */
function isValidDate(d) {
    return d instanceof Date && !isNaN(d);
}

/**
 * Extract a display name from various profile objects.
 * @param {Object|string} profile profile object or string
 * @returns {string} display name
 */
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