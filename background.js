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

// #113: Geni access tokens expire periodically, but nothing previously
// noticed - the icon stayed the normal "logged in" blue even once a token
// had gone stale, and the failure only ever surfaced as a confusing error
// on whatever action the user happened to be doing (e.g. generating a
// biography). A 401 from any geni.com/api call is Geni's own signal that
// the token isn't valid anymore, so flip to the same grey warning icon
// already used for the logged-out case - HistoryLink's own session persists
// independently, so re-triggering login from here should re-authorize
// near-instantly rather than requiring the user to re-enter anything.
function checkGeniAuthStatus(url, status) {
    // Uses the native .includes() rather than the .contains() polyfill the
    // rest of the codebase relies on - that polyfill lives in shared.js,
    // which background.js never loads.
    if (status === 401 && exists(url) && url.includes("geni.com/api")) {
        chrome.action.setIcon({path: "images/icon_warn.png"});
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
            (async () => {
                try {
                    let jsData = getJsonFromUrl(request.data);
                    if (jsData.photo !== undefined) {
                        const photoResponse = await fetch(jsData.photo);
                        if (!photoResponse.ok) {
                            callback({error: photoResponse.error, responseURL: photoResponse.responseURL});
                            return;
                        }
                        const buf = await photoResponse.arrayBuffer();
                        let binary = "";
                        const bytes = new Uint8Array(buf);
                        for (let i = 0; i < bytes.byteLength; i++) {
                            binary += String.fromCharCode(bytes[i] & 0xff);
                        }
                        delete jsData.photo;
                        jsData.file = btoa(binary);
                    }
                    const body = getUrlFromJson(jsData);
                    const response = await fetch(request.url, {
                        method: 'POST',
                        credentials: 'include',
                        body: body,
                        headers: {"Content-Type": "application/x-www-form-urlencoded"}
                    });
                    const responseText = await response.text();
                    checkGeniAuthStatus(request.url, response.status);
                    if (!response.ok) {
                        console.error("Unable to get XMLHttpRequest: " + request.url);
                        // response.error was always undefined here - a fetch()
                        // Response object has no .error property - and this
                        // branch discarded responseText entirely even though it
                        // was already read above, so the caller never saw
                        // Geni's actual rejection reason (permission denied,
                        // validation failure, etc.), only that it failed.
                        // Passing source through the same way the success case
                        // does lets popup.js's buildTree() actually parse and
                        // show that real reason instead of crashing on an
                        // undefined result and showing its own crash message
                        // in place of Geni's - see issue #194.
                        callback({source: responseText, error: response.error, variable: request.variable, responseURL: response.responseURL});
                    } else {
                        callback({source: responseText, variable: request.variable, responseURL: response.url});
                    }
                } catch (error) {
                    console.error("Fetch POST failed: ", error);
                    callback({error: error.message, variable: request.variable});
                }
            })();
        } else {
            // pass this request through - note that all receivers need to change for fetch response
            var vartn = {variable: request.variable};
            fetch(request.url,
                {
                    method: "GET",
                    credentials: 'include',
                    body: request.data
                }
            ).then((response) => {
                vartn.responseURL = response.url;
                vartn.status = response.status;
                checkGeniAuthStatus(request.url, response.status);
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
    } else if (request.action == "eval") {
        evalObject(request.variable, callback);
        return true;
    }
    return false;
});

async function evalObject(expression, callback) {
    if (chrome.offscreen) {
        await setupOffscreenDocument("offscreen.html");
        await chrome.runtime.sendMessage({
            action: "offscreen",
            target: "offscreen",
            data: expression
        }, function(response) {
            callback(response);
        });
    } else {
        // Firefox has no chrome.offscreen API, but its MV3 background is a
        // real event page (a "scripts" background, not a headless service
        // worker) with its own document, so the sandboxed eval iframe can be
        // hosted directly here instead of in a separate offscreen document.
        const result = await evalInSandboxIframe(expression);
        callback(result);
    }
}

let sandboxIframeReady;
function getSandboxIframe() {
    if (!sandboxIframeReady) {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        sandboxIframeReady = new Promise((resolve) => {
            iframe.addEventListener("load", () => resolve(iframe), { once: true });
            (document.body || document.documentElement).appendChild(iframe);
            iframe.src = chrome.runtime.getURL("sandbox.html");
        });
    }
    return sandboxIframeReady;
}

function evalInSandboxIframe(expression) {
    return new Promise(async (resolve) => {
        const iframe = await getSandboxIframe();
        function handleMessage(event) {
            window.removeEventListener("message", handleMessage);
            resolve(event.data);
        }
        window.addEventListener("message", handleMessage);
        iframe.contentWindow.postMessage(expression, "*");
    });
}

function exists(object) {
    return (typeof object !== "undefined" && object !== null);
}

const iframeHosts = ['www.geni.com',];

// This rule strips X-Frame-Options/Frame-Options from geni.com responses,
// but only for requests this extension itself initiates - it's what lets
// #loginframe in popup.html actually render Geni's own login page in an
// iframe (Geni sets X-Frame-Options: sameorigin, which blocks that by
// default for every other origin). Without this rule installed, login
// fails outright with "Refused to display ... because it set
// 'X-Frame-Options' to 'sameorigin'".
//
// Previously only installed via chrome.runtime.onInstalled, which is a
// one-time event on install/update. MV3 service workers get terminated and
// restarted by Chrome frequently (idle timeout, browser restart, etc.), and
// while declarativeNetRequest's dynamic rules are documented to persist
// across those restarts, re-asserting the rule on every service worker
// start as well is a cheap, idempotent safety net against any timing or
// persistence edge case - not just the one moment right after an update.
//
// On Firefox, chrome.runtime.id is the browser_specific_settings.gecko.id
// from the manifest (an email-like string such as
// "smartcopy@eljeffeg.github.io"), not a Chrome-style extension id -
// declarativeNetRequest's initiatorDomains rejects it outright ("Invalid
// domain"), since it expects a plain hostname-shaped string. Wrapped in
// try/catch (and a .catch() for the promise itself) so a browser that
// can't set this specific rule just skips it, rather than throwing
// uncaught and leaving the header-stripping feature half-configured.
function installHeaderStrippingRule() {
    try {
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
        }).then(() => {
            console.log("Header rule installed");
        }).catch((error) => {
            console.warn("Could not install header-stripping rule: ", error);
        });
    } catch (error) {
        console.warn("Could not install header-stripping rule: ", error);
    }
}

chrome.runtime.onInstalled.addListener(installHeaderStrippingRule);
installHeaderStrippingRule();

// #55: badge the toolbar icon on tabs where SmartCopy can read a profile,
// either the Geni destination site itself or one of the source sites it
// knows how to parse. Kept as a coarse, domain-level list matching
// manifest.json's host_permissions rather than each collection's own
// (much narrower) collectionMatch() regex - reusing those exactly would
// mean importing shared.js and every collections/*.js file into the
// background context just for a badge, and this only needs to answer
// "is this a site SmartCopy knows," not "will this exact page parse."
const SUPPORTED_SITE_HOSTS = [
    "geni.com",
    "findagrave.com",
    "familysearch.org",
    "familysearchcdn.org",
    "wikitree.com",
    "billiongraves.com",
    "ancestrylibrary.com",
    "ancestry.com",
    "myheritage.com",
    "sites-cf.mhcache.com",
    "filae.com",
    "gravez.me",
    "toldot.ru",
    "yadvashem.org",
    "geneanet.org",
    "bezikaron.co.il"
];

function isSupportedSite(url) {
    try {
        const hostname = new URL(url).hostname;
        return SUPPORTED_SITE_HOSTS.some(function (host) {
            return hostname === host || hostname.endsWith("." + host);
        });
    } catch (error) {
        return false;
    }
}

function updateBadgeForTab(tabId, url) {
    if (isSupportedSite(url)) {
        chrome.action.setBadgeText({tabId: tabId, text: "✓"});
        chrome.action.setBadgeBackgroundColor({tabId: tabId, color: "#2e7d32"});
    } else {
        chrome.action.setBadgeText({tabId: tabId, text: ""});
    }
}

function refreshAllTabBadges() {
    chrome.tabs.query({}, function (tabs) {
        tabs.forEach(function (tab) {
            if (tab.id !== undefined && tab.url) {
                updateBadgeForTab(tab.id, tab.url);
            }
        });
    });
}

chrome.tabs.onActivated.addListener(function (activeInfo) {
    chrome.tabs.get(activeInfo.tabId, function (tab) {
        if (tab && tab.url) {
            updateBadgeForTab(tab.id, tab.url);
        }
    });
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.url || changeInfo.status === "complete") {
        updateBadgeForTab(tabId, tab.url);
    }
});

// Service workers (Chrome) get torn down and restarted; a freshly-started
// worker hasn't run any of the listeners above for tabs that were already
// open and already active, so their badge would stay stale/unset until
// their next activation or navigation. Same onInstalled+direct-call
// pattern as installHeaderStrippingRule() above.
chrome.runtime.onInstalled.addListener(refreshAllTabBadges);
chrome.runtime.onStartup.addListener(refreshAllTabBadges);
refreshAllTabBadges();


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
