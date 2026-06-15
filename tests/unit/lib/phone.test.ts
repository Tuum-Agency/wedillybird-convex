import { describe, expect, it } from 'vitest';
import { isValidE164, maskPhone, normalizePhoneE164, splitE164 } from '@/lib/phone';

describe('normalizePhoneE164', () => {
  it('accepts already formatted E.164', () => {
    expect(normalizePhoneE164('+33612345678')).toBe('+33612345678');
  });

  it('strips spaces, dots, and dashes', () => {
    expect(normalizePhoneE164('+33 6 12 34 56 78')).toBe('+33612345678');
    expect(normalizePhoneE164('+33.6.12.34.56.78')).toBe('+33612345678');
    expect(normalizePhoneE164('+33-6-12-34-56-78')).toBe('+33612345678');
  });

  it('converts 00 prefix to +', () => {
    expect(normalizePhoneE164('0033612345678')).toBe('+33612345678');
  });

  it('applies default country code for 0 prefix', () => {
    expect(normalizePhoneE164('0612345678')).toBe('+33612345678');
  });

  it('supports custom default country code', () => {
    expect(normalizePhoneE164('0612345678', '221')).toBe('+221612345678');
  });

  it('accepts bare number without 0 prefix', () => {
    expect(normalizePhoneE164('221771234567')).toBe('+221771234567');
  });

  it('rejects empty and gibberish input', () => {
    expect(normalizePhoneE164('')).toBeNull();
    expect(normalizePhoneE164('abc')).toBeNull();
  });

  it('rejects too short / too long numbers', () => {
    expect(normalizePhoneE164('+331234')).toBeNull();
    expect(normalizePhoneE164('+1234567890123456')).toBeNull();
  });
});

describe('isValidE164', () => {
  it('accepts valid E.164', () => {
    expect(isValidE164('+33612345678')).toBe(true);
    expect(isValidE164('+221771234567')).toBe(true);
  });

  it('rejects missing +', () => {
    expect(isValidE164('33612345678')).toBe(false);
  });

  it('rejects leading 0 in country code', () => {
    expect(isValidE164('+0612345678')).toBe(false);
  });
});

describe('splitE164', () => {
  const dials = ['33', '32', '1', '221', '212'];

  it('splits a French number into dial + local', () => {
    expect(splitE164('+33612345678', dials)).toEqual({ dial: '33', local: '612345678' });
  });

  it('picks the longest matching dial code (221 over 2)', () => {
    expect(splitE164('+221771234567', dials)).toEqual({ dial: '221', local: '771234567' });
  });

  it('matches single-digit dial codes (US +1)', () => {
    expect(splitE164('+14165550123', dials)).toEqual({ dial: '1', local: '4165550123' });
  });

  it('strips spaces before splitting', () => {
    expect(splitE164('+33 6 12 34 56 78', dials)).toEqual({ dial: '33', local: '612345678' });
  });

  it('returns null without a + prefix', () => {
    expect(splitE164('33612345678', dials)).toBeNull();
  });

  it('returns null when no dial code matches', () => {
    expect(splitE164('+999123456', dials)).toBeNull();
  });

  it('returns null on empty / non-string input', () => {
    expect(splitE164('+', dials)).toBeNull();
    expect(splitE164('', dials)).toBeNull();
  });
});

describe('maskPhone', () => {
  it('keeps prefix and suffix visible', () => {
    const masked = maskPhone('+33612345678');
    expect(masked.startsWith('+33')).toBe(true);
    expect(masked.endsWith('78')).toBe(true);
    expect(masked).not.toContain('61234');
  });

  it('returns untouched short strings', () => {
    expect(maskPhone('+331')).toBe('+331');
  });
});
