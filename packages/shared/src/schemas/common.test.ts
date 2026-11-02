import { describe, expect, it } from 'vitest';
import { normalisePhone, phoneSchema } from './common.js';

describe('normalisePhone', () => {
  it.each([
    ['96570 61122', '+919657061122'],
    ['09657061122', '+919657061122'],
    ['+91-96570-41122', '+919657041122'],
    ['0044 7700 900123', '+447700900123'],
    ['+44 7700 900123', '+447700900123'],
  ])('normalises %s', (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });
});

describe('phoneSchema', () => {
  it('rejects numbers without a country code that are not Indian mobiles', () => {
    expect(phoneSchema.safeParse('12345678').success).toBe(false);
  });

  it('accepts Indian mobiles and returns E.164', () => {
    expect(phoneSchema.parse('9657061122')).toBe('+919657061122');
  });
});
