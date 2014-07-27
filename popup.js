// Run script as soon as the document's DOM is ready.
if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str){
        return this.slice(0, str.length) == str;
    };
}


document.addEventListener('DOMContentLoaded', function () {
    //console.log(getPageText());
    var message = document.querySelector('#message');

    chrome.tabs.getSelected(null,function(tab) {
        var tablink = tab.url;
        if (tablink.startsWith("http://www.myheritage.com/research/collection")) {
            loadLogin();
        } else {
            message.innerText = 'This extension only works on the MyHeritage SmartMatch page.';
        }
    });


});

chrome.extension.onMessage.addListener(function(request, sender, callback) {
    if (request.action == "getSource") {
        message.innerText = request.source;
    }

});

function getPageCode() {
    chrome.tabs.executeScript(null, {
        file: "getPagesSource.js"
    }, function() {
        // If you try and inject into an extensions page or the webstore/NTP you'll get an error
        if (chrome.extension.lastError) {
            message.innerText = 'There was an error injecting script : \n' + chrome.extension.lastError.message;
        }
    });

}

function $(id) {
    return document.getElementById(id);
}

function loadLogin() {
    chrome.extension.sendMessage({
        method: "GET",
        action: "xhttp",
        url: "http://historylink.herokuapp.com/smart"
    }, function(responseText) {
        if (responseText === "<script>window.open('', '_self', ''); window.close();</script>") {
            console.log("Logged In...");
            getPageCode();
        } else {
            console.log("Logged Out...");
            var w = 600;
            var h = 450;
            var left = (screen.width/2)-(w/2);
            var top = (screen.height/2)-(h/2);

            chrome.windows.create({'url': 'redirect.html', 'type': 'panel', 'width': w, 'height': h, 'left': left, 'top': top, 'focused': true} , function(window) {
            });
        }

        //document.getElementById('loginpage').innerHTML = responseText;
        /*Callback function to deal with the response*/
    });
}