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
        iframe.contentWindow.postMessage(request.data, "null");
        return true;
    }
    return false;
});