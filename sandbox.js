console.log("Sandbox script loaded...");

window.addEventListener('message', (event) => {
    console.log("Sandbox received a message: {}", event.data);
    let data;
    try {
        data = JSON.parse(event.data);
    } catch (e) {
        data = { error: 'Invalid JSON' };
    }
    event.source.window.postMessage(data, event.origin);
});