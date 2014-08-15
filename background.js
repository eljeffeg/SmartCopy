/**
 * Possible parameters for request:
 *  action: "xhttp" for a cross-origin HTTP request
 *  method: Default "GET"
 *  url   : required, but not validated
 *  data  : data to send in a POST request
 *  variable : pass private variable into the callback
 *
 * The callback function is called upon completion of the request
 *
 * Call to verify HistoryLink authentication to Geni & query Family Data
 * */
chrome.runtime.onMessage.addListener(function(request, sender, callback) {
    if (request.action == "xhttp") {
        var xhttp = new XMLHttpRequest();
        var method = request.method ? request.method.toUpperCase() : 'GET';
        xhttp.onload = function() {
            var valrtn = {source: xhttp.responseText, variable: request.variable};
            callback(valrtn);
        };
        xhttp.open(method, request.url, true);
        if (method == 'POST') {
            xhttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");  //"application/json;charset=UTF-8"
            //xhttp.setRequestHeader("Content-length", request.data.length);
        }
        xhttp.send(request.data);
        return true; // prevents the callback from being called too early on return
    }
});

