// based on PHP Name Parser by Josh Fraser (joshfraser.com)
// http://www.onlineaspect.com/2009/08/17/splitting-names/
// ported to JavaScript by Mark Pemburn (pemburnia.com)
// released under Apache 2.0 license

var NameParse = (function(){
    function NameParse() {
        return NameParse;
    }

    // split full names into the following parts:
    // - prefix / salutation  (Mr., Mrs., etc)
    // - given name / first name
    // - middle name
    // - surname / last name
    // - birth / maiden name
    // - suffix (II, Phd, Jr, etc)
    NameParse.parse = function (fullastName, detectMiddleName) {

        var displayname = fullastName;
        if (fullastName.match(/\s\/\w+\//g,'')) {
            //Strip "/" from names like Daniel /Bubier/
            fullastName = fullastName.replace(/\//g, "");
        }
        fullastName = fullastName.replace(/\s*\/\s*/g,'/');
        var nameParts = [];
        var nickParts = [];
        var lastName = "";
        var firstName = "";
        var middleName = "";
        var birthName = "";
        var nickName = "";
        var prefix = "";
        var word = null;
        var j = 0;
        var i = 0;

        detectMiddleName = typeof detectMiddleName !== 'undefined' ? detectMiddleName : true;
        fullastName = fullastName.trim();

        // Look for a birth / maiden name: Mary Smith (Jones)
        if ((fullastName.indexOf(")", fullastName.length - 1) !== -1) && (fullastName.indexOf("(") !== -1)) {
            birthName = fullastName.substring(fullastName.lastIndexOf("(") + 1, fullastName.length).replace(")","");
            birthName = NameParse.fix_case(birthName.replace(/^born /, ''));
            fullastName = fullastName.substring(0, fullastName.lastIndexOf("(")).trim();
        }

        nameParts = fullastName.split(" ");
        fullastName = removeprefix(nameParts);
        // split into words
        // completely ignore any words in parentheses
        var testNickStart = new RegExp('^"', 'i');
        var testNickEnd = new RegExp('"$', 'i');
        var testNickStart2 = new RegExp("^'", 'i');
        var testNickEnd2 = new RegExp("'$", 'i');
        nameParts = fullastName.split(" ").filter(function(namePart){
            if (namePart.indexOf("(") !== -1 || namePart.indexOf(")") !== -1 || testNickStart.test(namePart) || testNickEnd.test(namePart) || testNickStart2.test(namePart) || testNickEnd2.test(namePart)) {
                nickParts.push(namePart);
                return false;
            } else {
                return true;
            }
        });
        if (nickParts.length > 1 && !fullastName.contains(nickParts.join(" "))) {
            //This process is done to capture nicknames with more than 1 space, such as John "Captain Black Jack" Geary.
            var start = false;
            var nameParts2 = fullastName.split(" ");
            for (var n = 0; n < nameParts2.length; n++) {
                if (!start && nameParts2[n] === nickParts[0]) {
                    start = true;
                } else if (start) {
                    nickParts.splice(nickParts.length - 1, 0, nameParts2[n]);
                    if (fullastName.contains(nickParts.join(" "))) {
                        break;
                    }
                }
            }

            for (var n = 1; n < nickParts.length - 1; n++) {
                for (var x = 0; x < nameParts.length; x++) {
                    if (nickParts[n] === nameParts[x]) {
                        nameParts.splice(x, 1);
                        break;
                    }
                }
            }
        }
        if (nickParts.length > 0) {
            for (var n = 0; n < nickParts.length; n++) {
                namePart = nickParts[n];
                namePart = namePart.replace(testNickStart, "");
                namePart = namePart.replace(testNickEnd, "");
                namePart = namePart.replace(testNickStart2, "");
                namePart = namePart.replace(testNickEnd2, "");
                nickParts[n] = capFL(namePart);
            }
        }

        var numWords = nameParts.length;
        // is the first word a title? (Mr. Mrs, etc)
        var salutation = this.is_salutation(nameParts[0]);
        var suffix = this.is_suffix(nameParts[numWords - 1]);
        // set the range for the middle part of the name (trim prefixes & suffixes)
        var checkmiddlesuffix = true; //sometimes the suffix is in the middle of the name like "William Edwin Jr. Butts"
        while (checkmiddlesuffix) {
            checkmiddlesuffix = false;
            var start = (salutation) ? 1 : 0;
            var end = (suffix) ? numWords - 1 : numWords;
            word = nameParts[start];
            // if we start off with an initial, we'll call it the first name
            if (this.is_initial(word)) {
                // if so, do a look-ahead to see if they go by their middle name
                // for ex: "R. Jason Smith" => "Jason Smith" & "R." is stored as an initial
                // but "R. J. Smith" => "R. Smith" and "J." is stored as an initial
                if (nameParts.length > 1) {
                   if (start > 0 && this.is_initial(nameParts[start + 1])) {
                        firstName += " " + word.toLocaleUpperCase();
                    } else {
                        middleName += " " + word.toLocaleUpperCase();
                    }
                }
            } else {
                firstName += " " + this.fix_case(word);
            }

            // concat the first name
            for (i=start + 1; i<(end - 1); i++) {
                word = nameParts[i];
                // move on to parsing the last name if we find an indicator of a compound last name (Von, Van, etc)
                // we do not check earlier to allow for rare cases where an indicator is actually the first name (like "Von Fabella")
                if (this.is_compound_lastName(word)) {
                    break;
                }

                if (this.is_initial(word)) {
                    middleName += " " + word.toLocaleUpperCase();
                } else {
                    firstName += " " + this.fix_case(word);
                }
            }

            // check that we have more than 1 word in our string
            if ((end - start) > 1) {
                // concat the last name
                for (j=i; j<end; j++) {
                    lastName += " " + this.fix_case(nameParts[j]);
                }
                lastName = this.removeIgnoredChars(lastName);
            }

            if (detectMiddleName) {
                var checkmiddle = firstName.trim().split(" ");
                if ((middleName.trim() === "") && (checkmiddle.length > 1)) {
                    middleName = checkmiddle.pop();
                    while (checkmiddle.length > 2) {
                        middleName = checkmiddle.pop() + " " + middleName;
                    }
                    firstName = checkmiddle.join(" ");
                }
                if (NameParse.removeIgnoredChars(middleName) === "") {
                    middleName = "";
                }
            }

            if (!suffix && this.is_suffix(middleName)) {
                var testsuffix = NameParse.removeIgnoredChars(middleName).trim();
                //If it's just one letter, it might be an initial, such as "I." or "V."
                if (testsuffix.length > 1) {
                    suffix = this.is_suffix(middleName);
                    checkmiddlesuffix = true;
                    for (i=start + 1; i<(end - 1); i++) {
                        if (nameParts[i] === middleName) {
                            nameParts.splice(i,1);
                            break;
                        }
                    }
                    firstName = "";
                    middleName = "";
                    lastName = "";
                }
            }
        }

        if (nickParts.length > 0) {
            /*
            Can't recall why I did all this... commenting for now and just doing a join(" ")
            if (nickParts[0].indexOf("(") !== -1 && nickParts[0].indexOf(")") === -1 && nickParts.length > 1) {
                if (nickParts[1].indexOf(")") !== -1) {
                    nickParts[0] += " " + nickParts.pop(nickParts[1]);
                }
            } else if (testNickStart.test(nickParts[0]) && !testNickEnd.test(nickParts[0]) && nickParts.length > 1) {
                if (testNickEnd.test(nickParts[1])) {
                    nickParts[0] += " " + nickParts.pop(nickParts[1]);
                }
            }
            var nickfirst = nickParts[0].replace("(","");
            */
            var nickfirst = nickParts.join(" ");
            nickfirst = nickfirst.replace("(","");
            nickfirst = nickfirst.replace(")","");
            nickfirst = nickfirst.replace(/"/g,'');
            nickfirst = this.fix_case(nickfirst.trim());
            nickName = nickfirst + " " + lastName.trim();
            if (birthName !== "") {
                var nickborn = nickfirst + " " + birthName.trim();
                if (nickborn !== nickName) {
                    nickName += ", " + nickborn;
                }
            }
        }

        // return the various parts in an array
        return {
            "prefix": prefix || "",
            "salutation": salutation || "",
            "firstName": firstName.replace(/\//g,' / ').trim(),
            "middleName": middleName.replace(/\//g,' / ').trim(),
            "lastName": lastName.replace(/\//g,' / ').trim(),
            "birthName": birthName.replace(/\//g,' / ').trim(),
            "nickName": nickName.replace(/\//g,' / ').trim(),
            "suffix": suffix || "",
            "displayname": displayname.replace(/\//g,' / ').trim()
        };

        //  detect and format common suffixes
        function removeprefix(word) {
            var tempword1 = NameParse.removeIgnoredChars(word[0]).toLocaleLowerCase() + " ";
            if (word.length > 1) {
                tempword1 += " " + NameParse.removeIgnoredChars(word[1]).toLocaleLowerCase() + " ";
            }
            var tempword2 = NameParse.removeIgnoredChars(word[0]).toLocaleLowerCase() + " ";
            // these are some common suffixes - what am I missing?
            var prefixArray = [
                'dr', 'rev', 'fr', 'bro', 'chap', 'jud', 'prof', "rabbi", "sr", 'sen', 'the hon',
                'hon', 'amd', 'bg', 'bgen', 'brig gen', 'cpt', 'capt', 'cwo', 'lady',
                'col', 'cdr', 'cpl', 'ens', '1lt', '1st lt', 'ltjg', '2lt', '2nd lt',
                'lt', 'gen', 'ltc', 'lt col', 'lcdr', 'ltg', 'lt gen', 'maj gen', 'mg',
                'pvt', 'maj', 'msg', 'msgt', 'sgt', 'radm', 'vadm', 'brother', 'chaplain',
                'doctor', 'father', 'judge', 'missus', 'madam', 'professor', 'reverend', 'baron',
                'senator', 'congressman', 'governor', 'sister', 'the honorable', 'honerable',
                'admiral', 'brigadier general', 'captain', 'chief warrant officer', 'colonel',
                'commander', 'corporal', 'ensign', 'first lieutenant', 'lieutenant colonel',
                'lieutenant general', 'lieutenant commander', 'lieutenant', 'master sergeant',
                'major general', 'major', 'general', 'rear admiral', 'vice admiral', 'admiral',
                'second lieutenant', 'sergeant'
            ];
            for (var i=0; i < prefixArray.length; i++) {
                if (tempword1.startsWith(prefixArray[i] + " ")) {
                    prefix = word.shift();
                    if (!tempword2.startsWith(prefixArray[i] + " ")) {
                        prefix += " " + word.shift();
                    }
                    return word.join(" ");
                }
            }
            return word.join(" ");
        }
    };

    NameParse.removeIgnoredChars = function (word) {
        //ignore periods and commas
        word = word.replace(".","");
        word = word.replace(",","");
        return word;
    };

    // detect and format standard salutations
    // I'm only considering english honorifics for now & not words like
    NameParse.is_salutation = function (word) {
        word = this.removeIgnoredChars(word).toLocaleLowerCase();
        // returns normalized values
        if (word === "mr" || word === "master" || word === "mister") {
            return "Mr.";
        } else if (word === "mrs") {
            return "Mrs.";
        } else if (word === "miss" || word === "ms") {
            return "Ms.";
        } else {
            return false;
        }
    };



    //  detect and format common suffixes
    NameParse.is_suffix = function (word) {
        word = this.removeIgnoredChars(word).toLocaleLowerCase().trim();
        // these are some common suffixes - what am I missing?
        var suffixArray = [
            'I','II','III','IV','V','Senior','Junior','Jr','Sr','PhD','APR','RPh','PE','MD','MA','DMD','CME',
            "BVM","CFRE","CLU","CPA","CSC","CSJ","DC","DD","DDS","DO","DVM","EdD","Esq",
            "JD","LLD","OD","OSB","PC","Ret","RGS","RN","RNC","SHCJ","SJ","SNJM","SSMO",
            "USA","USAF","USAFR","USAR","USCG","USMC","USMCR","USN","USNR"
        ];

        var suffixIndex = suffixArray.map(function(suffix){
            return suffix.toLocaleLowerCase();
        }).indexOf(word);

        if(suffixIndex >= 0) {
            return suffixArray[suffixIndex];
        } else {
            return false;
        }
    };

    // detect compound last names like "Von Fange"
    NameParse.is_compound_lastName = function (word) {
        word = word.toLocaleLowerCase();
        // these are some common prefixes that identify a compound last names - what am I missing?
        var words = ['vere','von','van','de','del','della','di','da','pietro','vanden','du','st.','st','la','lo','ter'];
        return (words.indexOf(word) >= 0);
    };

    // single letter, possibly followed by a period
    NameParse.is_initial = function (word) {
        word = this.removeIgnoredChars(word);
        return (word.length === 1);
    };

    // detect mixed case words like "McDonald"
    // returns false if the string is all one case
    NameParse.is_camel_case = function (word) {
        var ucReg = /[A-Z]+/;
        var lcReg = /[a-z]+/;
        return (ucReg.exec(word) && lcReg.exec(word));
    };

    // ucfirst words split by dashes or periods
    // ucfirst all upper/lower strings, but leave camelcase words alone
    NameParse.fix_case = function (word) {
        // uppercase words split by dashes, like "Kimura-Fay"
        word = this.safe_ucfirst("-",word);
        // uppercase words split by periods, like "J.P."
        word = this.safe_ucfirst(".",word);
        return word;
    };

    // helper for this.fix_case
    // uppercase words split by the seperator (ex. dashes or periods)
    NameParse.safe_ucfirst = function (seperator, word) {
        return word.split(seperator).map(function(thisWord){
            if(this.is_camel_case(thisWord)) {
                return thisWord;
            } else {
                return thisWord.substr(0,1).toLocaleUpperCase() + thisWord.substr(1).toLocaleLowerCase();
            }
        }, this).join(seperator);
    };

    return NameParse;
})();
