import { describe, expect, it } from 'vitest';
import { isValidHexColor } from '@/lib/branding/validate';

describe('isValidHexColor', () => {
  it('accepts 3- and 6-digit hex colors', () => {
    expect(isValidHexColor('#fff')).toBe(true);
    expect(isValidHexColor('#FFF')).toBe(true);
    expect(isValidHexColor('#1a2b3c')).toBe(true);
    expect(isValidHexColor('#7E2F50')).toBe(true);
  });

  it('rejects malformed values', () => {
    expect(isValidHexColor('white')).toBe(false);
    expect(isValidHexColor('#ggg')).toBe(false);
    expect(isValidHexColor('#12345')).toBe(false);
    expect(isValidHexColor('rgb(0,0,0)')).toBe(false);
    expect(isValidHexColor('')).toBe(false);
    expect(isValidHexColor(null)).toBe(false);
    expect(isValidHexColor(123)).toBe(false);
  });
});
