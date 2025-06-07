console.log("Sandbox script loaded...");

window.addEventListener('message', (event) => {
    console.log("Sandbox received a message: {}", event.data);
    let result;
    try {
        result = eval(event.data);
    } catch (e) {
        result = { error: e.message };
    }
    event.source.postMessage(result, event.origin);
}); 