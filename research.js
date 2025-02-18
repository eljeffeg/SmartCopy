var tabplacement = 0;

var _ = function(messageName, substitutions) {
    return chrome.i18n.getMessage(messageName, substitutions);
};



function buildResearch() {
    let fields = "name,first_name,last_name,maiden_name,birth,baptism,death,burial,gender";
    chrome.runtime.sendMessage({
        method: "GET",
        action: "xhttp",
        url: "https://www.geni.com/api/" + focusid + "&fields=" + fields + "&access_token=" + accountinfo.access_token,
        variable: ""
    }, function (response) {
        let responsedata = JSON.parse(response.source);
        focusname = responsedata.name; // Use of global variable required for use of history QP 
        let accessdialog = document.querySelector('#useraccess');
        let researchstring = "<div style='font-size: 115%;'><strong>" + _("Research_this_Person") + "</strong><div style='font-size: 85%; font-style: italic;'>" + focusname + "</div></div><div style='padding-top: 2px; padding-bottom: 5px;'>";
        if (exists(responsedata.first_name)) {
            researchstring += buildAncestry(responsedata);
            researchstring += buildBillionGraves(responsedata);
            researchstring += buildFamilySearch(responsedata);
            researchstring += buildFilae(responsedata);
            researchstring += buildFindAGrave(responsedata);
            researchstring += buildGenealogy(responsedata);
            researchstring += buildGeneanet(responsedata);
            researchstring += buildGeni(responsedata);
            researchstring += buildGoogle(responsedata);
            researchstring += buildLegacy(responsedata);
            researchstring += buildMyHeritage(responsedata);
            researchstring += buildNationalArchive(responsedata);
            researchstring += buildYadVashem(responsedata);
            researchstring += buildOpenArchieven(responsedata);
            researchstring += "<div style='text-align: center; padding-top: 10px;'><strong>" + _("Other_Resources") + "</strong></div><div style='text-align: left; padding-left: 5px;'><li style='padding-left: 5px;'><a class='ctrllink' url='https://www.geni.com/projects/Genealogie-Zoekmachines-voor-de-Lage-Landen/24259'>Genealogy Search Engines for the Low Countries</a></li></div>";
        } else {
            researchstring = "<div><strong>" + _("Unable_to_create_research_links_on_this_profile") + "</strong>"
        }
        researchstring += '</div>';
        $(accessdialog).html(researchstring);

        $(function () {
            $('.ctrllink').on('click', function (event) {
                let ctrlpressed = (event.ctrlKey || event.metaKey);
                let url = $(this).attr('url');
                chrome.tabs.query({"currentWindow": true, "status": "complete", "windowType": "normal", "active": true}, function (tabs) {
                let tab = tabs[0];
                    tabplacement += 1;
                    let index = tab.index + tabplacement;
                    chrome.tabs.create({'url': url, active: !ctrlpressed, 'index': index});
                });
            });
        });
    });
}

function buildGoogle(responsedata) {
    let query = encodeURIComponent(responsedata.name).replace(/%20/g, "+");
    let researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>Google</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://www.google.com/search?q=' + query + '%20site:news.google.com/newspapers&source=newspapers">' + _("Google_Search") + ' (' + _("NewsPapers") + ')</a></li>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://www.google.com/search?q=' + query + '&tbm=bks">' + _("Google_Search") + ' (' + _("Books") + ')</a></li>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://www.google.com/search?q=' + query + "+~genealogy" + '">' + _("Google_Search") + ' (' + _("Genealogy") + ')</a></li>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://www.google.com/search?q=' + query + "+intitle:obituary+obituaries" + '">' + _("Google_Search") + ' (' + _("Obituaries") + ')</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildGenealogy(responsedata) {
    let lastname = "";
    let firstname = "";
    if (responsedata.first_name) {
        firstname = responsedata.first_name;
    }
    if (exists(responsedata.last_name)) {
        lastname = responsedata.last_name;
    } else if (exists(responsedata.maiden_name)) {
        lastname = responsedata.maiden_name;
    }
    let query = firstname + " " + lastname;
    let researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>Genealogy.com</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://www.genealogy.com/search/result?type=ftmcontent&keyword=' + query + '">Genealogy.com (' + _("Genealogies") + ')</a></li>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://www.genealogy.com/search/result?type=forumposts&keyword=' + query + '">Genealogy.com (' + _("MessageBoard") + ')</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildGeni(responsedata) {
    let query = responsedata.name.replace(/ /g, "+");
    let researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>Geni</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://www.geni.com/search?search_type=people&names=' + query + '">' + _("Geni_Search") + ' (' + _("Genealogies") + ')</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildFamilySearch(responsedata) {
    let query = 'results?q.givenName=' + wrapEncode(responsedata.first_name.replace("'","")).replace(/%22/g, "");
    let lastname = wrapEncode(responsedata.last_name).replace(/%22/g, "");
    if (exists(responsedata.maiden_name) && responsedata.gender === "female" && responsedata.maiden_name !== responsedata.last_name) {
        lastname = wrapEncode(responsedata.maiden_name.replace(/'/g,"")).replace(/%22/g, "");
        if (exists(responsedata.last_name)) {
            query += '&q.spouseSurname=' + wrapEncode(responsedata.last_name.replace(/'/g,"")).replace(/%22/g, "");
        }
    }
    query += '&q.surname=' + wrapEncode(lastname).replace(/%22/g, "");
    if (exists(responsedata.birth)) {
        if (exists(responsedata.birth.date) && exists(responsedata.birth.date.year)) {
            query += '&q.birthLikeDate.from=' + (responsedata.birth.date.year - 1) + '&q.birthLikeDate.to=' + (responsedata.birth.date.year + 1);
        }
        if (exists(responsedata.birth.location)) {
            query += '&q.birthLikePlace=' + wrapEncode(locationString(responsedata.birth.location)).replace(/%22/g, "");
        }
    }
    if (exists(responsedata.death)) {
        if (exists(responsedata.death.location)) {
            query += '&q.deathLikePlace=' + wrapEncode(locationString(responsedata.death.location)).replace(/%22/g, "");
        }
        if (exists(responsedata.death.date) && exists(responsedata.death.date.year)) {
            query += '&q.deathLikeDate.from=' + (responsedata.death.date.year - 1) + '&q.deathLikeDate.to=' + (responsedata.death.date.year + 1);
        }
    }
    query = query.replace(/[\u2018\u2019]/g, "'").replace(/%252C/g, "%2C").replace(/%2520/g, "%20");
    let researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>FamilySearch</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://familysearch.org/search/all-collections/' + query + '">FamilySearch (' + _("Collections") + ')</a></li>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://familysearch.org/search/genealogies/' + query + '">FamilySearch (' + _("Genealogies") + ')</a></li>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://familysearch.org/search/record/' + query + '">FamilySearch (' + _("Records") + ')</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildFindAGrave(responsedata) {
    let lastname = "";
    let firstname = "";
    if (responsedata.first_name) {
        firstname = wrapEncode(responsedata.first_name.replace(/'/g,""));
    }
    if (exists(responsedata.last_name)) {
        lastname = wrapEncode(responsedata.last_name.replace(/'/g,""));
    } else if (exists(responsedata.maiden_name)) {
        lastname = wrapEncode(responsedata.maiden_name.replace(/'/g,""));
    }
    let query = 'https://www.findagrave.com/memorial/search?firstname=' + firstname.replace(/%22/g, "") + '&middlename=&lastname=' + lastname.replace(/%22/g, "") + '&birthyear=&birthyearfilter=&deathyear=&deathyearfilter=&location=&locationId=&memorialid=&datefilter=&orderby=n&includeNickName=true&includeMaidenName=true';
    if (exists(responsedata.birth)) {
        if (exists(responsedata.birth.date) && exists(responsedata.birth.date.year)) {
            query += '&birthyearfilter=5&birthyear=' + responsedata.birth.date.year;
        }
    }
    if (exists(responsedata.death)) {
        if (exists(responsedata.death.date) && exists(responsedata.death.date.year)) {
            query += '&deathyearfilter=5&deathyear=' + responsedata.death.date.year;
        }
    }
    let researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>FindAGrave</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="' + query + '">FindAGrave (' + _("Gravestones") + ')</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildBillionGraves(responsedata) {
    let lastname = "";
    let firstname = "";
    if (responsedata.first_name) {
        firstname = responsedata.first_name;
    }
    if (exists(responsedata.last_name)) {
        lastname = responsedata.last_name;
    } else if (exists(responsedata.maiden_name)) {
        lastname = responsedata.maiden_name;
    }
    //https://billiongraves.com/search/results?given_names=John&family_names=Smith&birth_year=1830&death_year=1880&year_range=5&lim=0&num=10&action=search&exact=false&phonetic=true&record_type=0&country=United+States&state=Arizona&county=0
    let query = 'https://billiongraves.com/search/results?given_names=' + firstname + '&family_names=' + lastname;
    if (exists(responsedata.birth)) {
        if (exists(responsedata.birth.date) && exists(responsedata.birth.date.year)) {
            query += '&birth_year=' + responsedata.birth.date.year;
        }
    }
    if (exists(responsedata.death)) {
        if (exists(responsedata.death.location)) {
            let location = responsedata.death.location;
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

    let researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>BillionGraves</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="' + query + '">BillionGraves (' + _("Gravestones") + ')</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildGeneanet(responsedata) {
    let lastname = "";
    let firstname = "";
	let searchname = "";
    if (responsedata.first_name) {
        firstname = responsedata.first_name;
    }
    if (exists(responsedata.last_name)) {
        lastname = responsedata.last_name;
    } else if (exists(responsedata.maiden_name)) {
        lastname = responsedata.maiden_name;
    }
    if (exists(responsedata.maiden_name)) {
        searchname = responsedata.maiden_name;
    } else if (exists(responsedata.last_name)) {
        searchname = responsedata.last_name;
    }
    
    let researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>Geneanet</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://en.geneanet.org/fonds/individus/?go=1&size=100&prenom=' + firstname + '&nom=' + lastname + '">Geneanet (' + _("Records") + ')</a></li>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://en.geneanet.org/fonds/individus/?go=1&size=100&prenom=' + firstname + '&nom=' + searchname + '">Geneanet (' + _("Genealogies") + ')</a></li>';
	researchstring += '</div>';
    return researchstring
}

function buildAncestry(responsedata) {
    let lastname = "";
    let firstname = "";
    if (responsedata.first_name) {
        firstname = responsedata.first_name;
    }
    if (exists(responsedata.last_name)) {
        lastname = responsedata.last_name;
    } else if (exists(responsedata.maiden_name)) {
        lastname = responsedata.maiden_name;
    }
    let query = 'https://www.ancestry.com/genealogy/records/results?firstName=' + firstname + '&lastName=' + lastname;
    if (exists(responsedata.birth)) {
        if (exists(responsedata.birth.date) && exists(responsedata.birth.date.year)) {
            query += '&birthYear=' + responsedata.birth.date.year;
        }
    }
    if (exists(responsedata.death)) {
        if (exists(responsedata.death.date) && exists(responsedata.death.date.year)) {
            query += '&deathYear=' + responsedata.death.date.year;
        }
    }
    let researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>Ancestry</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="' + query + '">Ancestry (' + _("Genealogies") + ')</a></li>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://www.ancestry.com/search/?name=' + firstname + "_" + lastname + '">Ancestry (' + _("Collections") + ')</a></li>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://www.ancestry.com/search/categories/freeindexacom/?name=' + firstname + "_" + lastname + '">Ancestry (' + _("Publications") + ')</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildLegacy(responsedata) {
    let lastname = "";
    let firstname = "";
    if (responsedata.first_name) {
        firstname = responsedata.first_name;
    }
    if (exists(responsedata.last_name)) {
        lastname = responsedata.last_name;
    } else if (exists(responsedata.maiden_name)) {
        lastname = responsedata.maiden_name;
    }
    let daterange = "All";
    if (exists(responsedata.death)) {
        if (exists(responsedata.death.date) && exists(responsedata.death.date.year)) {
            let year = responsedata.death.date.year;
            if (year > 2015) {
                daterange = "Last1Yrs";
            } else if (year > 2009) {
                daterange = "2010-2015";
            } else if (year > 1999) {
                daterange = "2000-2009";
            }
        }
    }
    let query = 'https://www.legacy.com/ns/obitfinder/obituary-search.aspx?daterange=' + daterange + '&firstname=' + firstname + '&lastname=' + lastname + '&countryid=0&stateid=all&affiliateid=all';
    let researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>Legacy</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="' + query + '">Legacy (' + _("Obituaries") + ')</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildFilae(responsedata) {
    let lastname = "";
    let firstname = "";
    if (responsedata.first_name) {
        firstname = responsedata.first_name;
    }
    if (exists(responsedata.last_name)) {
        lastname = responsedata.last_name;
    } else if (exists(responsedata.maiden_name)) {
        lastname = responsedata.maiden_name;
    }
    let query = "ln=" + lastname + "&fn=" + firstname;
    if (exists(responsedata.birth)) {
        if (exists(responsedata.birth.date) && exists(responsedata.birth.date.year)) {
            query += '&ay=' + responsedata.birth.date.year;
        }
    }
    let researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>Filae</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://en.filae.com/v4/genealogie/Search.mvc/SearchForm?' + query + '">Filae (' + _("Name_Search") + ')</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildMyHeritage(responsedata) {
    let firstname = wrapEncode(responsedata.first_name.replace(/'/g,"")).replace(/%22/g, "");
    let lastname = wrapEncode(responsedata.last_name).replace(/%22/g, "");
    let query = 'qname=Name+fn.' + firstname;
    query += '%2F3+ln.' + wrapEncode(lastname).replace(/%22/g, "");
    if (exists(responsedata.maiden_name) && responsedata.gender === "female" && responsedata.maiden_name !== responsedata.last_name) {
        query += '%2F' + wrapEncode(responsedata.maiden_name.replace(/'/g,"")).replace(/%22/g, "");
    }
    if (responsedata.gender === "female") {
        query += '+g.F'
    } else {
        query += '+g.M'
    }
    let i = 1
    if (exists(responsedata.birth)) {
        query += '&qevents-any/1event_' + i + '=Event'
        if (exists(responsedata.birth.date) && exists(responsedata.birth.date.year)) {
            query += '+et.birth+ed.9+em.9+ey.' + (responsedata.birth.date.year);
        }
        if (exists(responsedata.birth.location)) {
            query += 'ep.' + wrapEncode(locationString(responsedata.birth.location)).replace(/%22/g, "") + '+epmo.similar';
        }
        i += 1
    }
    if (exists(responsedata.death)) {
        query += '&qevents-any/1event_' + i + '=Event'
        if (exists(responsedata.death.date) && exists(responsedata.death.date.year)) {
            query += 'et.death+ey.' + (responsedata.death.date.year);
        }
        if (exists(responsedata.death.location)) {
            query += '+ep.' + wrapEncode(locationString(responsedata.death.location)).replace(/%22/g, "") + '+epmo.similar';
        }
        i += 1
    }
    query = 'https://www.myheritage.com/research?action=query&exactSearch=0&formId=master&formMode=1&qevents=List&' + query.replace(/[\u2018\u2019]/g, "'").replace(/%252C/g, "%2C").replace(/%2520/g, "%20");
    let researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>MyHeritage</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="' + query + '">MyHeritage (' + _("All_Collections") + ')</a></li>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="https://www.myheritage.com/names/' + firstname + '_' + lastname + '">MyHeritage (' + _("Name_Search") + ')</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildNationalArchive(responsedata) {
    let lastname = "";
    let firstname = "";
    if (responsedata.first_name) {
        firstname = responsedata.first_name;
    }
    if (exists(responsedata.last_name)) {
        lastname = responsedata.last_name;
    } else if (exists(responsedata.maiden_name)) {
        lastname = responsedata.maiden_name;
    }
    let query = "https://aad.archives.gov/aad/free-text-search-results.jsp?cat=all&q=" + firstname + '+' + lastname;
    let researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>National Archives</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="' + query + '">National Archives (' + _("Name_Search") + ')</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildYadVashem(responsedata) {
    // 
    let lastname = "";
    let firstname = "";
    if (responsedata.first_name) {
        firstname = responsedata.first_name;
    }
    if (exists(responsedata.last_name)) {
        lastname = responsedata.last_name;
    } else if (exists(responsedata.maiden_name)) {
        lastname = responsedata.maiden_name;
    }
    let query = "&s_firstName=" + firstname + "&s_lastName=" + lastname;
    if (exists(responsedata.birth)) {
        if (exists(responsedata.birth.date) && exists(responsedata.birth.date.year)) {
            query += "&s_dateOfBirth=" + responsedata.birth.date.year;
        }
    }
    query = "https://yvng.yadvashem.org/index.html?language=en&advancedSearch=true&s_id=&ln_type=literal&fn_type=literal&cluster=true" + query;
    let researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>Yan Vashem</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="' + query + '">Yan Vashem (' + _("Holocaust") + ')</a></li>';
    researchstring += '</div>';
    return researchstring;
}

function buildOpenArchieven(responsedata) {
    const current_date = moment();
	let lastname = "";
    let firstname = "";
    if (responsedata.first_name) {
        firstname = wrapEncode(responsedata.first_name.replace(/'/g,""));
    }
    if (exists(responsedata.maiden_name)) {
        lastname = wrapEncode(responsedata.maiden_name.replace(/'/g,""));
    }
	else if (exists(responsedata.last_name)) {
        lastname = wrapEncode(responsedata.last_name.replace(/'/g,""));
    }
    var query = 'https://www.openarchieven.nl/search.php?&number_show=10&sourcetype=&eventplace=&online=&relationtype=&sort=4&from=&until=&country=&eventtype&name=' + firstname.replace(/%22/g, "") + '+>' + lastname.replace(/%22/g, "");
	if (exists(responsedata.birth) && exists(responsedata.birth.date) && exists(responsedata.birth.date.year)) {
	  query += '+' + (responsedata.birth.date.year - 1)
	}
	else if (exists(responsedata.baptism) && exists(responsedata.baptism.date) && exists(responsedata.baptism.date.year)){
	  query += '+' + (responsedata.baptism.date.year - 1)
	}
	else {
	  query += '+1500'
	}
	if (exists(responsedata.burial) && exists(responsedata.burial.date) && exists(responsedata.burial.date.year)) {
	  query += '-' + (responsedata.burial.date.year + 1)
	}
	else if (exists(responsedata.death) && exists(responsedata.death.date) && exists(responsedata.death.date.year)) {
	  query += '-' + (responsedata.death.date.year + 1)
	}
	else {
	  query += '-' + current_date.format('YYYY')
	}	
    var researchstring = '<div style="text-align: left; padding-top: 4px; padding-left: 5px;"><strong>OpenArchieven</strong>';
    researchstring += '<li style="padding-left: 5px;"><a class="ctrllink" url="' + query + '">Open Archieven (' + _("Records") + ')</a></li>';
    researchstring += '</div>';
    return researchstring;
}


function locationString(location) {
    let locationset = [];
    if (exists(location.county)) {
        locationset.push(location.county.replace(/ /g, "%20"));
    }
    if (exists(location.state)) {
        locationset.push(location.state.replace(/ /g, "%20"));
    }
    if (exists(location.country)) {
        locationset.push(location.country.replace(/ /g, "%20"));
    }
    return locationset.join("%2C%20");
}

function wrapEncode(name) {
    if (!exists(name)) {
        name = "";
    } else if (name.contains(" ")) {
        name = '"' + name + '"';
    }
    name = encodeURIComponent(name);
    return name;
}
