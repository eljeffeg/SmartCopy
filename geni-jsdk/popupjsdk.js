// Run script as soon as the document's DOM is ready.
if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str){
        return this.slice(0, str.length) == str;
    };
}


document.addEventListener('DOMContentLoaded', function () {
    //console.log(getPageText());
    var message = document.querySelector('#message');
    Geni.init({
        app_id: 'kmTDRYWcLrLSSTCUJdpSueGlj1AmDmx2Hp47bDwv'
    });
    connectWithGeni();
    //loadLogin();
    //document.getElementById('loginpage').innerHTML('<object data="http://historylink.herokuapp.com/search"/>');
    chrome.tabs.getSelected(null,function(tab) {
        var tablink = tab.url;
        if (tablink.startsWith("http://www.myheritage.com/research/collection")) {
            getPageCode();
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

function loadLogin() {
    chrome.extension.sendMessage({
        method: "GET",
        action: "xhttp",
        url: "http://historylink.herokuapp.com/smart"
    }, function(responseText) {
        console.log(responseText);
        if (responseText === "<script>window.open('', '_self', ''); window.close();</script>") {
            console.log("Logged In...");
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
    // ******************************************************************************************
    // Helper methods
    // ******************************************************************************************
    function $(id) {
        return document.getElementById(id);
    }
    var name_counts = {};

    function generateDirectory() {
        html = [];
        var names = Object.keys(name_counts);
        names.sort();

        var total_count = 0;
        for (var i=0; i<names.length; i++) {
            var name = names[i];
            total_count = total_count + name_counts[name];
            var font_size = 10 + (name_counts[name]*5);
            var title = name_counts[name] + (name_counts[name] == 1 ? " member of your family has this last name" : " members of your family have this last name");
            html.push("<div><a href='http://www.geni.com/surnames/" + name + "' title='" + title + "'>" + name + "</a>" + " <span style='font-size:12px;color:#666;'>(" +  name_counts[name] + ")</span></div>");
        }

        var summary = "<div style='padding:20px;'>Your family has " + total_count + " members.</div> ";

        $("name_directory").innerHTML = summary + html.join(" ");
        $("loading").style.display = "none";
    }

    // ******************************************************************************************
    // Load family methods
    // ******************************************************************************************
    function loadFamilyNames(url) {
        if (!url) { url = '/user/max-family'; }
        url = url.replace("https://www.geni.com/api", "");

        Geni.api(url, function (response) {
            for (var i=0; i<response.results.length; i++) {
                var profile = response.results[i];
                var name = profile.last_name;

                if (!name_counts[name]) {
                    name_counts[name] = 0;
                }
                name_counts[name] = name_counts[name] + 1;
            }
            if (response.next_page) {
                loadFamilyNames(response.next_page);
            } else {
                generateDirectory();
            }
        });
    }
 function connectWithGeni() {
        Geni.connect(function(response) {
            if(response.status == 'authorized') {
                $("login_link").style.display = "none";
                $("loading").style.display = "";
                loadFamilyNames();
            } else {
                $("login_link").style.display = "";
            }
        });
    }

//window.onload = onWindowLoad;