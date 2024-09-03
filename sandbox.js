console.log("Sandbox script loaded...");

window.addEventListener('message', (event) => {
    console.log("Sandbox received a message: {}", event.data)
    const data = eval(event.data);
    event.source.window.postMessage(data, event.origin);
});