
/**
 * Possible parameters for request:
 *  action: "xhttp" for a cross-origin HTTP request
 *  method: Default "GET"
 *  url   : required, but not validated
 *  data  : data to send in a POST request
 *  variable : pass private variable into the callback
 *
 * The callback function is called upon completion of the request
 * https://stackoverflow.com/questions/7699615/cross-domain-xmlhttprequest-using-background-pages
 *
 * Call to verify HistoryLink authentication to Geni & query Family Data
 * */
function getUrlFromJson(obj) {
    let result = "";
    for (let key in obj) {
        if (result !== "") {
            result += "&";
        }
        result += key + "=" + encodeURIComponent(obj[key]);
    }
    return result;
}

function getJsonFromUrl(query) {
    const result = {};
    query.split("&").forEach(function(part) {
        const item = part.split("=");
        result[item[0]] = decodeURIComponent(item[1]);
    });
    return result;
}

chrome.runtime.onMessage.addListener(function(request, sender, callback) {
    if (request.action === "xhttp") {
        let method = request.method ? request.method.toUpperCase() : 'GET';

        let requestInit = {
            method: method
        }

        let fetch_res = null;
        if (method === 'POST') {
            requestInit.body = request.data;
            requestInit.headers = {"Content-Type": "application/x-www-form-urlencoded"};

            data = getJsonFromUrl(request.data)
            if (data.photo !== undefined) {
                fetch_res = fetch(data.photo).then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    return response.text(); // Or response.json() for JSON data
                }).then(response => {
                    let binary = ""
                    for(let i=0;i<response.length;i++){
                        binary += String.fromCharCode(response.charCodeAt(i) & 0xff);
                    }
                    delete data.photo
                    data.file = btoa(binary)
                    return fetch(getUrlFromJson(data), {method: method,
                        headers: { "Content-Type": "application/x-www-form-urlencoded",},
                        body: request.data});
                }).catch(error => {
                    const valrtn = {error: error, responseURL: data.photo};
                    callback(valrtn);
                })
            }
        }


        if (!fetch_res) {
            fetch_res = fetch(request.url, {
                method,
                // Pass headers for POST requests
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: request.method === 'POST' ? request.data : null,
            });
        }

        fetch_res.then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response.text(); // Or response.json() for JSON data
        }).then(responseText => {
            const valrtn = {source: responseText, variable: request.variable, responseURL: response};
            callback(valrtn);
        }).catch(error => {
            const valrtn = { error: error, variable: request.variable, responseURL: error.response?.url || null, // Get URL from error if available
            };
            callback(valrtn);
        }).then(() => {
            return true;
        });

        // return true; // prevents the callback from being called too early on return
    } else if (request.action === "icon") {
        chrome.action.setIcon({path: request.path});
        return true;
    }
});

const iframeHosts = [
    'geni.com',
];
chrome.runtime.onInstalled.addListener(() => {
    const RULE = {
        id: 1,
        condition: {
            initiatorDomains: [chrome.runtime.id],
            requestDomains: iframeHosts,
            resourceTypes: ['sub_frame'],
        },
        action: {
            type: 'modifyHeaders',
            responseHeaders: [
                {header: 'X-Frame-Options', operation: 'remove'},
                {header: 'Frame-Options', operation: 'remove'},
                // Uncomment the following line to suppress `frame-ancestors` error
                {header: 'Content-Security-Policy', operation: 'remove'},
            ],
        },
    };
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [RULE.id],
        addRules: [RULE],
    });
});