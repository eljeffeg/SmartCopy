const iframe = document.getElementById("offscreen");

console.log("Offscreen script loaded...");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action == "offscreen") {
        console.log("Offscreen received message with payload: {}", request);

        iframe.contentWindow.postMessage(request.data, "*");
        window.addEventListener("message", (event) => {
            console.log("Offscreen callback event {}", event);
             sendResponse(event.data);
        }, false);
        return true;
    } else {
        console.log("Offscreen ignoring message type: {}", request.action);
    }
    return false;
});