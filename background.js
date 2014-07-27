/**
 * Possible parameters for request:
 *  action: "xhttp" for a cross-origin HTTP request
 *  method: Default "GET"
 *  url   : required, but not validated
 *  data  : data to send in a POST request
 *
 * The callback function is called upon completion of the request */
chrome.runtime.onMessage.addListener(function(request, sender, callback) {
    if (request.action == "xhttp") {
        var xhttp = new XMLHttpRequest();
        var method = request.method ? request.method.toUpperCase() : 'GET';

        xhttp.onload = function() {
            callback(xhttp.responseText);
        };
        if (method == 'POST') {
            xhttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded"); 
            xhttp.setRequestHeader("Content-length", request.data.length);
        }
        xhttp.open(method, request.url, true);
        xhttp.send(request.data);
        return true; // prevents the callback from being called too early on return
    }
});


