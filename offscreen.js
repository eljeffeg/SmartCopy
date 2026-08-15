const iframe = document.getElementById("offscreen");

console.log("Offscreen script loaded...");

let listenerAdded = false;
let pendingResponse = null;

function handleMessage(event) {
    if (event.source !== iframe.contentWindow) return;
    if (pendingResponse) {
        pendingResponse(event.data);
        pendingResponse = null;
    }
}
  
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "offscreen" && sender.id === chrome.runtime.id) {
        if (!listenerAdded) {
            window.addEventListener("message", handleMessage);
            listenerAdded = true;
        }
        pendingResponse = sendResponse;
        // "*" is the only targetOrigin value that can actually deliver to
        // an opaque-origin destination like this sandboxed iframe - "null"
        // (from #191) is not a valid target and throws synchronously
        // ("Invalid target origin 'null'"), confirmed empirically; "null"
        // is only ever what a *receiving* handler sees as event.origin for
        // a message sent from an opaque origin, not something a sender can
        // target. The event.source check in handleMessage() above (also
        // from #191) is the actually-effective fix for the reported
        // vulnerability - it validates incoming messages regardless of
        // what targetOrigin was used to send this one.
        iframe.contentWindow.postMessage(request.data, "*");
        return true;
    }
    return false;
});