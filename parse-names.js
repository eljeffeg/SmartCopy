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
        detectMiddleName = typeof detectMiddleName !== 'undefined' ? detectMiddleName : true;
        fullastName = fullastName.trim();

        var nameParts = [];
        var nickParts = [];
        var lastName = "";
        var firstName = "";
        var middleName = "";
        var birthName = "";
        var nickName = "";
        var word = null;
        var j = 0;
        var i = 0;

        // Look for a birth / maiden name: Mary Smith (Jones)
        if ((fullastName.indexOf(")", fullastName.length - 1) !== -1) && (fullastName.indexOf("(") !== -1)) {
            birthName = fullastName.substring(fullastName.lastIndexOf("(") + 1, fullastName.length).replace(")","");
            birthName = birthName.replace(/^born /, '');
            fullastName = fullastName.substring(0, fullastName.lastIndexOf("(")).trim();
        }
        // split into words
        // completely ignore any words in parentheses
        var testNickStart = new RegExp('^"', 'i');
        var testNickEnd = new RegExp('"$', 'i');
        nameParts = fullastName.split(" ").filter(function(namePart){
            if (namePart.indexOf("(") !== -1 || namePart.indexOf(")") !== -1 || testNickStart.test(namePart) || testNickEnd.test(namePart)) {
                nickParts.push(namePart);
            } else {
                return true;
            }
        });


        var numWords = nameParts.length;
        // is the first word a title? (Mr. Mrs, etc)
        var salutation = this.is_salutation(nameParts[0]);
        var suffix = this.is_suffix(nameParts[numWords - 1]);
        // set the range for the middle part of the name (trim prefixes & suffixes)
        var start = (salutation) ? 1 : 0;
        var end = (suffix) ? numWords - 1 : numWords;

        word = nameParts[start];
        // if we start off with an initial, we'll call it the first name
        if (this.is_initial(word)) {
            // if so, do a look-ahead to see if they go by their middle name
            // for ex: "R. Jason Smith" => "Jason Smith" & "R." is stored as an initial
            // but "R. J. Smith" => "R. Smith" and "J." is stored as an initial
            if (this.is_initial(nameParts[start + 1])) {
                firstName += " " + word.toUpperCase();
            } else {
                middleName += " " + word.toUpperCase();
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
                middleName += " " + word.toUpperCase();
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
        }

        if (nickParts.length > 0) {
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
            "salutation": salutation || "",
            "firstName": firstName.trim(),
            "middleName": middleName.trim(),
            "lastName": lastName.trim(),
            "birthName": birthName.trim(),
            "nickName": nickName.trim(),
            "suffix": suffix || ""
        };
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
        word = this.removeIgnoredChars(word).toLowerCase();
        // returns normalized values
        if (word === "mr" || word === "master" || word === "mister") {
            return "Mr.";
        } else if (word === "mrs") {
            return "Mrs.";
        } else if (word === "miss" || word === "ms") {
            return "Ms.";
        } else if (word === "dr") {
            return "Dr.";
        } else if (word === "rev") {
            return "Rev.";
        } else if (word === "fr") {
            return "Fr.";
        } else {
            return false;
        }
    };

    //  detect and format common suffixes
    NameParse.is_suffix = function (word) {
        word = this.removeIgnoredChars(word).toLowerCase();
        // these are some common suffixes - what am I missing?
        var suffixArray = [
            'I','II','III','IV','V','Senior','Junior','Jr','Sr','PhD','APR','RPh','PE','MD','MA','DMD','CME',
            "BVM","CFRE","CLU","CPA","CSC","CSJ","DC","DD","DDS","DO","DVM","EdD","Esq",
            "JD","LLD","OD","OSB","PC","Ret","RGS","RN","RNC","SHCJ","SJ","SNJM","SSMO",
            "USA","USAF","USAFR","USAR","USCG","USMC","USMCR","USN","USNR"
        ];

        var suffixIndex = suffixArray.map(function(suffix){
            return suffix.toLowerCase();
        }).indexOf(word);

        if(suffixIndex >= 0) {
            return suffixArray[suffixIndex];
        } else {
            return false;
        }
    };

    // detect compound last names like "Von Fange"
    NameParse.is_compound_lastName = function (word) {
        word = word.toLowerCase();
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
                return thisWord.substr(0,1).toUpperCase() + thisWord.substr(1).toLowerCase();
            }
        }, this).join(seperator);
    };

    return NameParse;
})();
