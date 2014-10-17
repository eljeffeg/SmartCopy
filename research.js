
function buildResearch() {
    var fields = "name,first_name,last_name,maiden_name,birth,death,gender";
    chrome.extension.sendMessage({
        method: "GET",
        action: "xhttp",
        url: "http://historylink.herokuapp.com/smartsubmit?profile=" + focusid + "&fields=" + fields,
        variable: ""
    }, function (response) {
        var responsedata = JSON.parse(response.source);
        var accessdialog = document.querySelector('#useraccess');
        var researchstring = "<div style='font-size: 115%;'><strong>Research this Person</strong></div><div style='padding-top: 2px; padding-bottom: 5px;'>";
        //researchstring += buildAncestry(responsedata);
        researchstring += buildBillionGraves(responsedata);
        researchstring += buildFamilySearch(responsedata);
        researchstring += buildFindAGrave(responsedata);
        researchstring += buildGoogle(responsedata);
        //researchstring += buildObitsforLive(responsedata);
        researchstring += buildRootsWeb(responsedata);
        researchstring += '</div>';
        accessdialog.innerHTML = researchstring;
    });
}

function buildGoogle(responsedata) {
    var query = responsedata.name.replace(/ /g, "+");
    var researchstring = '<div style="text-align: left; padding-top: 4px;"><strong>Google</strong>';
    researchstring += '<li><a href="https://www.google.com/?gws_rd=ssl#q=' + query + '%20site:news.google.com/newspapers&source=newspapers" target="_blank">Google Search (Newspapers)</a></li>';
    researchstring += '<li><a href="https://www.google.com/?gws_rd=ssl#q=' + query + '&tbm=bks" target="_blank">Google Search (Books)</a></li>';
    researchstring += '<li><a href="https://www.google.com/?gws_rd=ssl#q=' + query + "+~genealogy" + '" target="_blank">Google Search (Genealogy)</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildFamilySearch(responsedata) {
    var query = 'results?count=75&query=%2Bgivenname%3A' + responsedata.first_name.replace("'","");
    var lastname = responsedata.last_name;
    if (exists(responsedata.maiden_name) && responsedata.gender === "female" && responsedata.maiden_name !== responsedata.last_name) {
        lastname = responsedata.maiden_name.replace("'","");
        query += '~%20%2Bspouse_surname%3A' + responsedata.last_name.replace("'","");
    }
    query += '~%20%2Bsurname%3A' + lastname;
    if (exists(responsedata.birth)) {
        if (exists(responsedata.birth.date) && exists(responsedata.birth.date.year)) {
            query += '~%20%2Bbirth_year%3A' + (responsedata.birth.date.year - 1) + '-' + (responsedata.birth.date.year + 1);
        }
        if (exists(responsedata.birth.location)) {
            query += '~%20%2Bbirth_place%3A%22' + locationString(responsedata.birth.location) + '%22';
        }
    }
    if (exists(responsedata.death)) {
        if (exists(responsedata.death.location)) {
            query += '~%20%2Bdeath_place%3A%22' + locationString(responsedata.death.location) + '%22';
        }
        if (exists(responsedata.death.date) && exists(responsedata.death.date.year)) {
            query += '~%20%2Bdeath_year%3A' + (responsedata.death.date.year - 1) + '-' + (responsedata.death.date.year + 1);
        }
    }
    query += '~';
    query = query.replace(/[\u2018\u2019]/g, "'");
    var researchstring = '<div style="text-align: left; padding-top: 4px;"><strong>FamilySearch</strong>';
    researchstring += '<li><a href="https://familysearch.org/search/tree/' + query + '" target="_blank">FamilySearch (Genealogies)</a></li>';
    researchstring += '<li><a href="https://familysearch.org/search/record/' + query + '" target="_blank">FamilySearch (Records)</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildFindAGrave(responsedata) {
    var query = 'http://www.findagrave.com/cgi-bin/fg.cgi?page=gsr&GSfn=' + responsedata.first_name + '&GSmn=&GSln=' + responsedata.last_name + '&GSiman=1&GScntry=0&GSst=0&GSgrid=&df=all&GSob=n';
    var researchstring = '<div style="text-align: left; padding-top: 4px;"><strong>FindAGrave</strong>';
    researchstring += '<li><a href="' + query + '" target="_blank">FindAGrave (Gravestones)</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildBillionGraves(responsedata) {
    //http://billiongraves.com/pages/search/#given_names=John&family_names=Smith&birth_year=1830&death_year=1880&year_range=5&lim=0&num=10&action=search&exact=false&phonetic=true&record_type=0&country=United+States&state=Arizona&county=0
    var query = 'http://billiongraves.com/pages/search/#given_names=' + responsedata.first_name + '&family_names=' + responsedata.last_name;
    if (exists(responsedata.birth)) {
        if (exists(responsedata.birth.date) && exists(responsedata.birth.date.year)) {
            query += '&birth_year=' + responsedata.birth.date.year;
        }
    }
    if (exists(responsedata.death)) {
        if (exists(responsedata.death.location)) {
            var location = responsedata.death.location;
            if (exists(location.country)) {
                query += '&country=' + location.country;
            }
            if (exists(location.state)) {
                query += '&state=' + location.state;
            }
            query += '&county=0';
        }
        if (exists(responsedata.death.date) && exists(responsedata.death.date.year)) {
            query += '&death_year=' + responsedata.death.date.year;
        }
    }
    query += "&year_range=5&lim=0&num=10&action=search&exact=false&phonetic=true&record_type=0";

    var researchstring = '<div style="text-align: left; padding-top: 4px;"><strong>BillionGraves</strong>';
    researchstring += '<li><a href="' + query + '" target="_blank">BillionGraves (Gravestones)</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildObitsforLive(responsedata) {
    var query = 'http://www.obitsforlife.co.uk/records/list.php?filterChange=true&firstRequest=false&showTodays=false&firstname=' + responsedata.first_name + '&lastname=' + responsedata.last_name + '&speciesName=human&curPage=1&total=100000&rrp=10';

    var researchstring = '<div style="text-align: left; padding-top: 4px;"><strong>ObitsforLife</strong>';
    researchstring += '<li><a href="' + query + '" target="_blank">ObitsforLife (Obituaries)</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildAncestry(responsedata) {
    var lastname = responsedata.last_name;
    if (exists(responsedata.maiden_name)) {
        lastname = responsedata.maiden_name;
    }
    var query = 'http://search.ancestry.com/cgi-bin/sse.dll?gsfn=' + responsedata.first_name + '&gsln=' + lastname + '&cp=0&gl=allgs';
    var researchstring = '<div style="text-align: left; padding-top: 4px;"><strong>Ancestry</strong>';
    researchstring += '<li><a href="' + query + '" target="_blank">Ancestry</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildRootsWeb(responsedata) {
    var query = 'http://wc.rootsweb.ancestry.com/cgi-bin/igm.cgi?op=Search&includedb=&lang=en&ti=&skipdb=&period=All&fuzzy=Y&submit.x=Search&given=' + responsedata.first_name;
    var lastname = responsedata.last_name;
    if (exists(responsedata.maiden_name) && responsedata.gender === "female" && responsedata.maiden_name !== responsedata.last_name) {
        lastname = responsedata.maiden_name;
        query += '&spouse=' + responsedata.last_name;
    }
    query += '&surname=' + lastname;
    if (exists(responsedata.birth)) {
        if (exists(responsedata.birth.date) && exists(responsedata.birth.date.year)) {
            query += '&brange=5&byear=' + responsedata.birth.date.year;
        }
        if (exists(responsedata.birth.location)) {
            query += '&bplace=' + locationString(responsedata.birth.location).replace(/%20/g,"+");
        }
    }
    if (exists(responsedata.death)) {
        if (exists(responsedata.death.location)) {
            query += '&dplace=' + locationString(responsedata.death.location).replace(/%20/g,"+");
        }
        if (exists(responsedata.death.date) && exists(responsedata.death.date.year)) {
            query += '&drange=5&dyear=' + responsedata.death.date.year;
        }
    }

    var researchstring = '<div style="text-align: left; padding-top: 4px;"><strong>RootsWeb</strong>';
    researchstring += '<li><a href="' + query + '" target="_blank">RootsWeb (Genealogies)</a></li>';

    query = 'http://boards.rootsweb.com/SearchResults.aspx?db=mb&gskw=%22' + responsedata.name.replace(/ /g, "+") + '%22';
    researchstring += '<li><a href="' + query + '" target="_blank">RootsWeb (MessageBoard)</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function locationString(location) {
    var locationset = [];
    if (exists(location.county)) {
        locationset.push(location.county.replace(" ", "%20"));
    }
    if (exists(location.state)) {
        locationset.push(location.state.replace(" ", "%20"));
    }
    if (exists(location.country)) {
        locationset.push(location.country.replace(" ", "%20"));
    }
    return locationset.join("%2C%20");
}

//http://www.obitsforlife.co.uk/records/list.php?filterChange=true&firstRequest=false&showTodays=false&firstname=John&lastname=Smith&speciesName=human&curPage=1&total=100000&rrp=10