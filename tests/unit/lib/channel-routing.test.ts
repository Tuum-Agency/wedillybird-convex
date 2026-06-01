import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSmsCountryCodes, resolveChannel } from '../../../convex/lib/channelRouting';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.SMS_COUNTRY_CODES;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('getSmsCountryCodes', () => {
  it('defaults to +1 (US/Canada) when env unset', () => {
    expect(getSmsCountryCodes()).toEqual(['+1']);
  });

  it('parses a CSV override and trims whitespace', () => {
    process.env.SMS_COUNTRY_CODES = '+1, +44 , +61';
    expect(getSmsCountryCodes()).toEqual(['+1', '+44', '+61']);
  });

  it('falls back to default when override is empty/garbage', () => {
    process.env.SMS_COUNTRY_CODES = '  ,  ';
    expect(getSmsCountryCodes()).toEqual(['+1']);
  });
});

describe('resolveChannel', () => {
  it('routes US numbers to SMS', () => {
    expect(resolveChannel('+14155550123')).toBe('sms');
  });

  it('routes Canadian numbers (NANP +1) to SMS', () => {
    expect(resolveChannel('+15145550123')).toBe('sms');
  });

  it('routes France to WhatsApp', () => {
    expect(resolveChannel('+33612345678')).toBe('whatsapp');
  });

  it('routes Senegal to WhatsApp', () => {
    expect(resolveChannel('+221771234567')).toBe('whatsapp');
  });

  it("routes Côte d'Ivoire to WhatsApp", () => {
    expect(resolveChannel('+2250701234567')).toBe('whatsapp');
  });

  it('honors an extended SMS country list from env', () => {
    process.env.SMS_COUNTRY_CODES = '+1,+44';
    expect(resolveChannel('+447911123456')).toBe('sms');
    expect(resolveChannel('+33612345678')).toBe('whatsapp');
  });

  it('matches the longest prefix first', () => {
    // +1242 (Bahamas) explicitly listed alongside parent +1 — both resolve to
    // SMS here, but the longest-prefix sort guarantees deterministic matching
    // if the two prefixes were ever routed differently.
    process.env.SMS_COUNTRY_CODES = '+1,+1242';
    expect(resolveChannel('+12425550123')).toBe('sms');
  });
});
