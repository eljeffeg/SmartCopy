const {
    isValidDate,
    getJsonFromUrl,
    getProfileName,
    getUrlFromJson,
} = require('../test-utils');

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

describe('getUrlFromJson', () => {
    test('serializes object to query string', () => {
        const obj = {foo: 'bar', baz: 'qux'};
        expect(getUrlFromJson(obj)).toBe('foo=bar&baz=qux');
    });

    test('encodes special characters', () => {
        const obj = {name: 'John Doe', city: 'New York'};
        expect(getUrlFromJson(obj)).toBe('name=John%20Doe&city=New%20York');
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