import { describe, expect, it } from 'vitest';
import { detectPreferredLocale, parseAcceptLanguage } from '@/lib/i18n/detect-preferred-locale';

describe('parseAcceptLanguage', () => {
  it('returns empty for null/undefined/empty', () => {
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage(undefined)).toEqual([]);
    expect(parseAcceptLanguage('')).toEqual([]);
  });

  it('parses single tag without q-value (defaults to q=1)', () => {
    expect(parseAcceptLanguage('fr')).toEqual(['fr']);
    expect(parseAcceptLanguage('en-US')).toEqual(['en-us']);
  });

  it('parses multiple tags ordered by descending q', () => {
    expect(parseAcceptLanguage('fr-FR,fr;q=0.9,en;q=0.8')).toEqual(['fr-fr', 'fr', 'en']);
  });

  it('skips tags with q=0', () => {
    expect(parseAcceptLanguage('en;q=1,fr;q=0,es;q=0.5')).toEqual(['en', 'es']);
  });

  it('preserves preference even when q is unspecified for first tag', () => {
    expect(parseAcceptLanguage('en-GB,en;q=0.9,fr;q=0.5')).toEqual(['en-gb', 'en', 'fr']);
  });

  it('discards malformed q values gracefully', () => {
    expect(parseAcceptLanguage('fr;q=oops,en;q=0.7')).toEqual(['en']);
  });
});

describe('detectPreferredLocale', () => {
  it('returns null when header is missing', () => {
    expect(detectPreferredLocale(null)).toBeNull();
    expect(detectPreferredLocale('')).toBeNull();
  });

  it('returns the exact match (en → en)', () => {
    expect(detectPreferredLocale('en')).toBe('en');
    expect(detectPreferredLocale('fr')).toBe('fr');
    expect(detectPreferredLocale('ar')).toBe('ar');
  });

  it('falls back to language prefix when region is given (en-US → en, fr-CA → fr)', () => {
    expect(detectPreferredLocale('en-US')).toBe('en');
    expect(detectPreferredLocale('fr-CA')).toBe('fr');
    expect(detectPreferredLocale('pt-BR')).toBe('pt');
  });

  it('respects q-value priority order', () => {
    // English wins over French because q is higher
    expect(detectPreferredLocale('fr;q=0.5,en;q=0.9')).toBe('en');
  });

  it('falls through to second preference if first is unsupported', () => {
    // Japanese unsupported → fall back to fr
    expect(detectPreferredLocale('ja,fr;q=0.9,en;q=0.8')).toBe('fr');
  });

  it('returns null when no supported locale matches', () => {
    expect(detectPreferredLocale('ja,ko,zh')).toBeNull();
  });

  it('handles complex realistic browser headers', () => {
    expect(detectPreferredLocale('fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7')).toBe('fr');
    expect(detectPreferredLocale('en-GB,en;q=0.9,fr;q=0.8,de;q=0.7')).toBe('en');
  });
});
