/**
 * Possible parameters for request:
 *  action: "xhttp" for a cross-origin HTTP request
 *  method: Default "GET"
 *  url   : required, but not validated
 *  data  : data to send in a POST request
 *  variable : pass private variable into the callback
 *
 * The callback function is called upon completion of the request
 * http://stackoverflow.com/questions/7699615/cross-domain-xmlhttprequest-using-background-pages
 *
 * Call to verify HistoryLink authentication to Geni & query Family Data
 * */
chrome.runtime.onMessage.addListener(function(request, sender, callback) {
    if (request.action == "xhttp") {
        var xhttp = new XMLHttpRequest();
        var method = request.method ? request.method.toUpperCase() : 'GET';
        xhttp.onload = function() {
            var valrtn = {source: xhttp.responseText, variable: request.variable, responseURL: xhttp.responseURL};
            callback(valrtn);
        };
        xhttp.onerror = function(error) {
            // Do whatever you want on error. Don't forget to invoke the
            // callback to clean up the communication port.
            var valrtn = {error: error, variable: request.variable, responseURL: xhttp.responseURL};
            callback(valrtn);
        };
        xhttp.open(method, request.url, true);
        if (method == 'POST') {
            xhttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");  //"application/json;charset=UTF-8"
            //xhttp.setRequestHeader("Content-length", request.data.length);
        }
        xhttp.send(request.data);
        return true; // prevents the callback from being called too early on return
    } else if (request.action == "icon") {
        chrome.browserAction.setIcon({path: request.path});
        return true;
    }
});

function exists(object) {
    return (typeof object !== "undefined" && object !== null);
}

chrome.webRequest.onHeadersReceived.addListener(
    function(info) {
        var headers = info.responseHeaders;
        for (var i=headers.length-1; i>=0; --i) {
            var header = headers[i].name.toLowerCase();
            if (header === "x-frame-options" || header === "frame-options") {
                headers.splice(i, 1); // Remove x-frame header origin policy
            }
        }
        return {responseHeaders: headers};
    },
    {
        urls: [ "https://www.geni.com/platform/oauth/*" ],
        types: [ "sub_frame" ]
    },
    ["blocking", "responseHeaders"]
);
