const {isValidDate, getJsonFromUrl, getProfileName} = require('../test-utils');

describe('isValidDate', () => {
    test('returns true for valid Date', () => {
        expect(isValidDate(new Date('2020-01-01'))).toBe(true);
    });

    test('returns false for invalid Date', () => {
        expect(isValidDate(new Date('invalid'))).toBe(false);
        expect(isValidDate('not a date')).toBe(false);
    });
});

describe('getJsonFromUrl', () => {
    test('parses query string', () => {
        expect(getJsonFromUrl('foo=bar&baz=qux')).toEqual({foo: 'bar', baz: 'qux'});
    });

    test('returns object if input is already object', () => {
        const obj = {a: 1};
        expect(getJsonFromUrl(obj)).toBe(obj);
    });
});

describe('getProfileName', () => {
    test('returns displayname property', () => {
        const obj = {displayname: 'Jane Doe'};
        expect(getProfileName(obj)).toBe('Jane Doe');
    });

    test('falls back to display_name property', () => {
        const obj = {display_name: 'Jane Doe'};
        expect(getProfileName(obj)).toBe('Jane Doe');
    });

    test('returns original string if no known properties', () => {
        expect(getProfileName('John Doe')).toBe('John Doe');
    });
});