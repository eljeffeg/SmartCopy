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
    for (var key in obj) {
        if (result != "") {
            result += "&";
        }
        result += key + "=" + encodeURIComponent(obj[key]);
    }
    return result;
}

function getJsonFromUrl(query) {
    var result = {};
    query.split("&").forEach(function(part) {
      var item = part.split("=");
      result[item[0]] = decodeURIComponent(item[1]);
    });
    return result;
}

// listen for messages - if they include photo URLs, intercept and get them
chrome.runtime.onMessage.addListener( function(request, sender, callback) {
    if (request.action == "xhttp") {
        const method = request.method ? request.method.toUpperCase() : 'GET';
        if (method == 'POST') {
            fetch(request.url, {
                method : method,
                body: request.data,
                headers: {
                    "Content-Type" : "application/x-www-form-urlencoded"
                }  
            }).then((response) => {
                if (!response.ok) {
                    console.error("Unable to get XMLHttpRequest: " + request.url);
                    var valrtn = {error: response.error, variable: request.variable, responseURL: response.responseURL};
                    callback(valrtn);
                } else {
                    const responseText = response.text();
                    var valrtn = {source: responseText, variable: request.variable, responseURL: response.responseURL};
                    callback(valrtn);
                    const jsData = getJsonFromUrl(request);
                    if (jsData.photo !== undefined) {
                        // load the photo from the given URL
                        fetch(jsData.photo, {
                            method: 'GET',
                            headers: {
                                "Content-Type" : "text/plain; charset=UTF-8"
                            }
                        }).then((photoResponse) => {
                            if (!photoResponse.ok) {
                                var valrtn = {error: photoResponse.error, responseURL: photoResponse.responseURL};
                                callback(valrtn);
                            } else {
                                const photo = photoResponse.text()
                                let binary = ""
                                for(i=0;i<photo.length;i++){
                                    binary += String.fromCharCode(photo.charCodeAt(i) & 0xff);
                                }
                                delete jsData.photo;
                                jsData.file = btoa(binary);
                                return fetch(getUrlFromJson(jsData));
                            }
                        });
                    }
                }
            });
        } else {
            // pass this request through - note that all receivers need to change for fetch response
            var vartn = {variable: request.variable};
            fetch(request.url,
                {
                    method: "GET",
                    body: request.data
                }
            ).then((response) => {
                vartn.responseURL = response.url;
                return response.text();
            }).then((source) => {
                vartn.source = source;
            }).catch((error) => {
                console.error("Fetch GET failed: ", error)
            }).finally(() => {
                callback(vartn);
            });
        }
        return true; // prevents the callback from being called too early on return
    } else if (request.action == "icon") {
        chrome.action.setIcon({path: request.path});
        return true;
    } else if (request.action == "eval") {
        evalObject(request.variable, callback);
        return true;
    }
    return false;
});

async function evalObject(expression, callback) {
    await setupOffscreenDocument("offscreen.html");
    await chrome.runtime.sendMessage({
        action: "offscreen",
        target: "offscreen",
        data: expression
    }, function(response) {
        callback(response);
    });
}

function exists(object) {
    return (typeof object !== "undefined" && object !== null);
}

const iframeHosts = [
    'www.geni.com',
  ];

chrome.runtime.onInstalled.addListener(() => {
    const RULE = {
      id: 1,
      condition: {
        initiatorDomains: [chrome.runtime.id],
        requestDomains: iframeHosts,
        resourceTypes: ['main_frame', 'sub_frame'],
      },
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          {header: 'X-Frame-Options', operation: 'remove'},
          {header: 'Frame-Options', operation: 'remove'},
          // Uncomment the following line to suppress `frame-ancestors` error
          // {header: 'Content-Security-Policy', operation: 'remove'},
        ],
      },
    };
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [RULE.id],
      addRules: [RULE],
    });
    console.log("Header rule installed");
  });


let creating; // A global promise to avoid concurrency issues
async function setupOffscreenDocument(path) {
  // Check all windows controlled by the service worker to see if one
  // of them is the offscreen document with the given path
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  // create offscreen document
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['CLIPBOARD'],
      justification: 'reason for needing the document',
    });
    await creating;
    creating = null;
  }
}
