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
    if (typeof query === 'string') {
        var result = {};
        query.split("&").forEach(function(part) {
        var item = part.split("=");
        result[item[0]] = decodeURIComponent(item[1]);
        });
        return result;
    } else {
        return query;
    }
}

// listen for messages - if they include photo URLs, intercept and get them
chrome.runtime.onMessage.addListener( function(request, sender, callback) {
    if (request.action == "xhttp") {
        if (request.latency){
            delay(request.latency);// see https://www.nginx.com/blog/rate-limiting-nginx/
        }

        const method = request.method ? request.method.toUpperCase() : 'GET';
        if (method == 'POST') {
            const jsData = getJsonFromUrl(request.data);
            if (jsData.photo !== undefined) {
                const photoOk  = GetPhoto(jsData);
                photoOk.then((jsData) =>  {
                    request.data = jsData;
                    const header = "application/x-www-form-urlencoded";
                    GeniPostReq(request,header,callback);
                });
                return true
            }
            const header = "application/x-www-form-urlencoded";
            GeniPostReq(request,header,callback);
     
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

    function GeniPostReq(request,header,callback) {
        fetch(request.url, {
            method : "POST",
            body: request.data,
            headers: {
                "Content-Type" : header
            }  
        })
        .then((response) => {
            if (!response.ok) {
                return response.text()
                .then((responseText)=> {
                console.error("Unable to get Fetch Request: " + request.url);
                var valrtn = {error: responseText, variable: request.variable, responseURL: request.url};
                console.log("valrtn_FL ",valrtn,request.data);
                callback(valrtn);
            });
            
            } else {
                return response.text()
                .then((responseText)=> {
                var valrtn = {source: responseText, variable: request.variable, responseURL: request.url};
                //console.log("valrtn_OK ",valrtn);
                callback(valrtn);
             });
            } 
         })
        }
       // load the photo from the given URL
async function GetPhoto (jsData){
    try {
        const photoResponse = await fetch(jsData.photo, {
            method: 'GET',
            mode: "cors",
            headers: {
                "Content-Type" : "application/xml",
            //   "Access-Control-Allow-Origin": "*",
            //   "Access-Control-Allow-Methods": "GET",
            //   "Access-Control-Max-Age": "86400",
            },
        });
        if (!photoResponse.ok) {
                throw new Error(`Erreur Photo : ${photoResponse.status}`);
            }
        const photoreader =  photoResponse.body.getReader();    
            let binary = "";
            while (true){
                const {done,value} = await photoreader.read();
                if (done){
    
                    delete jsData.photo;
                    jsData.file = btoa(binary);
                    jsData = getUrlFromJson(jsData);
                    return jsData;
                }

                charsReceived = value.length;
                for(i=0;i<charsReceived;i++){
                binary += String.fromCharCode(value[i]);
                }
            }
    }
    catch({name, stat}) {
        console.error(name, stat);
    }
}

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

const iframeHosts = ['www.geni.com',];

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

function delay(ms){
    let currDate = new Date().getTime();
    let dateNow = currDate;
    while(dateNow<currDate+ms){
      dateNow = new Date().getTime();
    }
  }