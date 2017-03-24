var tabplacement = 0;
function buildResearch() {
    var fields = "name,first_name,last_name,maiden_name,birth,death,gender";
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: smartcopyurl + "/smartsubmit?profile=" + focusid + "&fields=" + fields,
        variable: ""
    }, function (response) {
        var responsedata = JSON.parse(response.source);
        focusname = responsedata.name;
        var accessdialog = document.querySelector('#useraccess');
        var researchstring = "<div style='font-size: 115%;'><strong>Research this Person</strong><div style='font-size: 85%; font-style: italic;'>" + focusname + "</div></div><div style='padding-top: 2px; padding-bottom: 5px;'>";
        if (exists(responsedata.first_name)) {
            researchstring += buildAncestry(responsedata);
            researchstring += buildBillionGraves(responsedata);
            researchstring += buildFamilySearch(responsedata);
            researchstring += buildFindAGrave(responsedata);
            researchstring += buildGenealogy(responsedata);
            researchstring += buildGeni(responsedata);
            researchstring += buildGoogle(responsedata);
            researchstring += buildLegacy(responsedata);
            //researchstring += buildObitsforLive(responsedata);
            researchstring += buildRootsWeb(responsedata);
            researchstring += buildTributes(responsedata);
            researchstring += "<div style='text-align: center; padding-top: 10px;'><strong>Other Resources</strong></div><div style='text-align: left; padding-left: 5px;'><li style='padding-left: 5px;'><a class='ctrllink' url='http://www.geni.com/projects/Genealogie-Zoekmachines-voor-de-Lage-Landen/24259'>Genealogy Search Engines for the Low Countries</a></li></div>";
        } else {
            researchstring = "<div><strong>Unable to create research links on this profile.</strong>"
        }
        researchstring += '</div>';
        $(accessdialog).html(researchstring);

        $(function () {
            $('.ctrllink').on('click', function (event) {
                var ctrlpressed = (event.ctrlKey || event.metaKey);
                var url = $(this).attr('url');
                chrome.tabs.query({"currentWindow": true, "status": "complete", "windowType": "normal", "active": true}, function (tabs) {
                var tab = tabs[0];
                    tabplacement += 1;
                    var index = tab.index + tabplacement;
                    chrome.tabs.create({'url': url, active: !ctrlpressed, 'index': index});
                });
            });
        });
    });
}

function buildGoogle(responsedata) {
    var query = responsedata.name.replace(/ /g, "+");
    var researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>Google</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://www.google.com/?gws_rd=ssl#q=' + query + '%20site:news.google.com/newspapers&source=newspapers">Google Search (Newspapers)</a></li>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://www.google.com/?gws_rd=ssl#q=' + query + '&tbm=bks">Google Search (Books)</a></li>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://www.google.com/?gws_rd=ssl#q=' + query + "+~genealogy" + '">Google Search (Genealogy)</a></li>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://www.google.com/?gws_rd=ssl#q=' + query + "+intitle:obituary obituaries" + '">Google Search (Obituaries)</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildGenealogy(responsedata) {
    var lastname = "";
    var firstname = "";
    if (responsedata.first_name) {
        firstname = responsedata.first_name;
    }
    if (exists(responsedata.last_name)) {
        lastname = responsedata.last_name;
    } else if (exists(responsedata.maiden_name)) {
        lastname = responsedata.maiden_name;
    }
    var query = firstname + " " + lastname;
    var researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>Genealogy.com</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="http://www.genealogy.com/search/result?type=ftmcontent&keyword=' + query + '">Genealogy.com (Genealogies)</a></li>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="http://www.genealogy.com/search/result?type=forumposts&keyword=' + query + '">Genealogy.com (MessageBoard)</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildGeni(responsedata) {
    var query = responsedata.name.replace(/ /g, "+");
    var researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>Geni</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="http://www.geni.com/search?search_type=people&names=' + query + '">Geni Search (Genealogies)</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildFamilySearch(responsedata) {
    var query = 'results?count=75&query=%2Bgivenname%3A%22' + wrapEncode(responsedata.first_name.replace("'","")).replace(/%22/g, "") + '%22';
    var lastname = wrapEncode(responsedata.last_name).replace(/%22/g, "");
    if (exists(responsedata.maiden_name) && responsedata.gender === "female" && responsedata.maiden_name !== responsedata.last_name) {
        lastname = wrapEncode(responsedata.maiden_name.replace("'","")).replace(/%22/g, "");
        if (exists(responsedata.last_name)) {
            query += '~%20%2Bspouse_surname%3A%22' + wrapEncode(responsedata.last_name.replace("'","")).replace(/%22/g, "") + '%22';
        }
    }
    query += '~%20%2Bsurname%3A%22' + wrapEncode(lastname).replace(/%22/g, "") + '%22';
    if (exists(responsedata.birth)) {
        if (exists(responsedata.birth.date) && exists(responsedata.birth.date.year)) {
            query += '~%20%2Bbirth_year%3A' + (responsedata.birth.date.year - 1) + '-' + (responsedata.birth.date.year + 1);
        }
        if (exists(responsedata.birth.location)) {
            query += '~%20%2Bbirth_place%3A%22' + wrapEncode(locationString(responsedata.birth.location)).replace(/%22/g, "") + '%22';
        }
    }
    if (exists(responsedata.death)) {
        if (exists(responsedata.death.location)) {
            query += '~%20%2Bdeath_place%3A%22' + wrapEncode(locationString(responsedata.death.location)).replace(/%22/g, "") + '%22';
        }
        if (exists(responsedata.death.date) && exists(responsedata.death.date.year)) {
            query += '~%20%2Bdeath_year%3A' + (responsedata.death.date.year - 1) + '-' + (responsedata.death.date.year + 1);
        }
    }
    query += '~';
    query = query.replace(/[\u2018\u2019]/g, "'");
    var researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>FamilySearch</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://familysearch.org/search/tree/' + query + '">FamilySearch (Genealogies)</a></li>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://familysearch.org/search/record/' + query + '">FamilySearch (Records)</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildFindAGrave(responsedata) {
    var lastname = "";
    var firstname = "";
    if (responsedata.first_name) {
        firstname = wrapEncode(responsedata.first_name.replace("'",""));
    }
    if (exists(responsedata.last_name)) {
        lastname = wrapEncode(responsedata.last_name.replace("'",""));
    } else if (exists(responsedata.maiden_name)) {
        lastname = wrapEncode(responsedata.maiden_name.replace("'",""));
    }
    var query = 'http://www.findagrave.com/cgi-bin/fg.cgi?page=gsr&GSfn=' + firstname.replace(/%22/g, "") + '&GSmn=&GSln=' + lastname.replace(/%22/g, "") + '&GSiman=1&GScntry=0&GSst=0&GSgrid=&df=all&GSob=n';
    var researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>FindAGrave</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="' + query + '">FindAGrave (Gravestones)</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildBillionGraves(responsedata) {
    var lastname = "";
    var firstname = "";
    if (responsedata.first_name) {
        firstname = responsedata.first_name;
    }
    if (exists(responsedata.last_name)) {
        lastname = responsedata.last_name;
    } else if (exists(responsedata.maiden_name)) {
        lastname = responsedata.maiden_name;
    }
    //https://billiongraves.com/search/results?given_names=John&family_names=Smith&birth_year=1830&death_year=1880&year_range=5&lim=0&num=10&action=search&exact=false&phonetic=true&record_type=0&country=United+States&state=Arizona&county=0
    var query = 'https://billiongraves.com/search/results?given_names=' + firstname + '&family_names=' + lastname;
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

    var researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>BillionGraves</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="' + query + '">BillionGraves (Gravestones)</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildObitsforLive(responsedata) {
    var lastname = "";
    var firstname = "";
    if (responsedata.first_name) {
        firstname = responsedata.first_name;
    }
    if (exists(responsedata.last_name)) {
        lastname = responsedata.last_name;
    } else if (exists(responsedata.maiden_name)) {
        lastname = responsedata.maiden_name;
    }
    var query = 'http://www.obitsforlife.co.uk/records/list.php?filterChange=true&firstRequest=false&showTodays=false&firstname=' + firstname + '&lastname=' + lastname + '&speciesName=human&curPage=1&total=100000&rrp=10';

    var researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>ObitsforLife</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="' + query + '">ObitsforLife (Obituaries)</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildAncestry(responsedata) {
    var lastname = "";
    var firstname = "";
    if (responsedata.first_name) {
        firstname = responsedata.first_name;
    }
    if (exists(responsedata.last_name)) {
        lastname = responsedata.last_name;
    } else if (exists(responsedata.maiden_name)) {
        lastname = responsedata.maiden_name;
    }
    var query = 'http://www.ancestry.com/genealogy/records/results?firstname=' + firstname + '&lastname=' + lastname;
    var researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>Ancestry</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="' + query + '">Ancestry (Genealogies)</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildTributes(responsedata) {
    var lastname = "";
    var firstname = "";
    if (responsedata.first_name) {
        firstname = responsedata.first_name;
    }
    if (exists(responsedata.last_name)) {
        lastname = responsedata.last_name;
    } else if (exists(responsedata.maiden_name)) {
        lastname = responsedata.maiden_name;
    }
    var daterange = "ALL";
    if (exists(responsedata.death)) {
        if (exists(responsedata.death.date) && exists(responsedata.death.date.year)) {
            var year = responsedata.death.date.year;
            if (year < 1950) {
                daterange = "Range+pre-1950";
            } else if (year > 2009) {
                daterange = "Range+2010-Now";
            } else if (year > 1999) {
                daterange = "Range+2000-Now";
            } else if (year > 1979) {
                daterange = "Range+1980-2000";
            } else if (year > 1949) {
                daterange = "Range+1950-1980";
            }
        }
    }
    var query = 'http://www.tributes.com/search/obituaries/?solr=&first=' + firstname + '&last=' + lastname + '&search_type=' + daterange;
    var researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>Tributes</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="' + query + '">Tributes (Obituaries)</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildLegacy(responsedata) {
    var lastname = "";
    var firstname = "";
    if (responsedata.first_name) {
        firstname = responsedata.first_name;
    }
    if (exists(responsedata.last_name)) {
        lastname = responsedata.last_name;
    } else if (exists(responsedata.maiden_name)) {
        lastname = responsedata.maiden_name;
    }
    var daterange = "All";
    if (exists(responsedata.death)) {
        if (exists(responsedata.death.date) && exists(responsedata.death.date.year)) {
            var year = responsedata.death.date.year;
            if (year > 2015) {
                daterange = "Last1Yrs";
            } else if (year > 2009) {
                daterange = "2010-2015";
            } else if (year > 1999) {
                daterange = "2000-2009";
            }
        }
    }
    var query = 'http://www.legacy.com/ns/obitfinder/obituary-search.aspx?daterange=' + daterange + '&firstname=' + firstname + '&lastname=' + lastname + '&countryid=0&stateid=all&affiliateid=all';
    var researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>Legacy</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="' + query + '">Legacy (Obituaries)</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildRootsWeb(responsedata) {
    var query = 'http://wc.rootsweb.ancestry.com/cgi-bin/igm.cgi?op=Search&includedb=&lang=en&ti=&skipdb=&period=All&fuzzy=Y&submit.x=Search&given=' + responsedata.first_name;
    var lastname = "";
    if (exists(responsedata.last_name)) {
        lastname = responsedata.last_name;
    } else if (exists(responsedata.maiden_name)) {
        lastname = responsedata.maiden_name;
    }

    if (exists(responsedata.maiden_name) && exists(responsedata.last_name) && responsedata.gender === "female" && responsedata.maiden_name !== responsedata.last_name) {
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

    var researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>RootsWeb</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="' + query + '">RootsWeb (Genealogies)</a></li>';

    query = 'http://boards.rootsweb.com/SearchResults.aspx?db=mb&gskw=%22' + responsedata.name.replace(/ /g, "+") + '%22';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="' + query + '">RootsWeb (MessageBoard)</a></li>';
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

function wrapEncode(name) {
    if (!exists(name)) {
        name = "";
    } else if (name.contains(" ")) {
        name = '"' + name + '"';
    }
    name = encodeURI(name);
    return name;
}

//http://www.obitsforlife.co.uk/records/list.php?filterChange=true&firstRequest=false&showTodays=false&firstname=John&lastname=Smith&speciesName=human&curPage=1&total=100000&rrp=10