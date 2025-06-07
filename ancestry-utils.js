function isFemale(value) {
    if (!value) return false;
    value = value.toLowerCase();
    return (value === 'wife' || value === 'ex-wife' || value === 'mother' ||
            value === 'sister' || value === 'daughter' || value === 'female' ||
            value === 'f');
}

function isMale(value) {
    if (!value) return false;
    value = value.toLowerCase();
    return (value === 'husband' || value === 'ex-husband' || value === 'father' ||
            value === 'brother' || value === 'son' || value === 'male' ||
            value === 'm');
}

function getAncestryGender(personCard, personFacts) {
    let genderval = 'unknown';
    if (personCard && (isFemale(personCard.gender) || isMale(personCard.gender))) {
        genderval = personCard.gender.toLowerCase();
        if (genderval === 'f') {
            genderval = 'female';
        } else if (genderval === 'm') {
            genderval = 'male';
        }
    } else if (personFacts && personFacts.PersonInfo && personFacts.PersonInfo.Gender) {
        genderval = personFacts.PersonInfo.Gender.toLowerCase();
        if (genderval === 'f') {
            genderval = 'female';
        } else if (genderval === 'm') {
            genderval = 'male';
        }
        if (!isFemale(genderval) && !isMale(genderval)) {
            genderval = 'unknown';
        }
    }
    return genderval;
}

if (typeof module !== 'undefined') {
    module.exports = {getAncestryGender};
}