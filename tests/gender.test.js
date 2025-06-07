const {getAncestryGender} = require('../ancestry-utils');

describe('getAncestryGender', () => {
    test('parses gender from PersonCard', () => {
        expect(getAncestryGender({gender: 'F'}, {})).toBe('female');
        expect(getAncestryGender({gender: 'm'}, {})).toBe('male');
    });

    test('parses gender from PersonFacts', () => {
        const pf1 = {PersonInfo: {Gender: 'Male'}};
        const pf2 = {PersonInfo: {Gender: 'f'}};
        expect(getAncestryGender({}, pf1)).toBe('male');
        expect(getAncestryGender({}, pf2)).toBe('female');
    });

    test('returns unknown when no gender found', () => {
        expect(getAncestryGender({}, {})).toBe('unknown');
    });
});