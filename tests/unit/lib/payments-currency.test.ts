import { describe, expect, it } from 'vitest';
import {
  convertFromEur,
  defaultCurrencyForLocale,
  EUR_CONVERSION_RATE,
  pricesFromEur,
  SELECTABLE_CURRENCIES,
} from '@/lib/payments/currency';

describe('convertFromEur', () => {
  it('identity for EUR', () => {
    expect(convertFromEur(1900, 'EUR')).toBe(1900);
    expect(convertFromEur(0, 'EUR')).toBe(0);
  });

  it('19 € → USD via taux 1,08', () => {
    expect(convertFromEur(1900, 'USD')).toBe(Math.round(19 * EUR_CONVERSION_RATE.USD * 100));
  });

  it('19 € → TND = 64 600 millimes (3,4)', () => {
    expect(convertFromEur(1900, 'TND')).toBe(64600);
  });

  it('29 € → TND = 98 600 millimes (upsell parity)', () => {
    expect(convertFromEur(2900, 'TND')).toBe(98600);
  });

  it('49 € → TND = 166 600 millimes (premium parity)', () => {
    expect(convertFromEur(4900, 'TND')).toBe(166600);
  });

  it('89 € → TND = 302 600 millimes (starter pro parity)', () => {
    expect(convertFromEur(8900, 'TND')).toBe(302600);
  });

  it('19 € → XOF utilise le peg fixe 655,957', () => {
    expect(convertFromEur(1900, 'XOF')).toBe(Math.round(19 * 655.957 * 100));
  });
});

describe('defaultCurrencyForLocale', () => {
  it('en → USD', () => {
    expect(defaultCurrencyForLocale('en')).toBe('USD');
  });

  it('fr, es, it, pt, de, ar → EUR', () => {
    for (const locale of ['fr', 'es', 'it', 'pt', 'de', 'ar'] as const) {
      expect(defaultCurrencyForLocale(locale)).toBe('EUR');
    }
  });
});

describe('pricesFromEur', () => {
  it('preserves EUR and converts every other currency', () => {
    const prices = pricesFromEur(1900);
    expect(prices.EUR).toBe(1900);
    expect(prices.USD).toBe(convertFromEur(1900, 'USD'));
    expect(prices.XOF).toBe(convertFromEur(1900, 'XOF'));
    expect(prices.MAD).toBe(convertFromEur(1900, 'MAD'));
    expect(prices.TND).toBe(convertFromEur(1900, 'TND'));
  });
});

describe('SELECTABLE_CURRENCIES', () => {
  it('inclut les 3 devises settleables EUR/USD/MAD', () => {
    expect(SELECTABLE_CURRENCIES).toEqual(['EUR', 'USD', 'MAD']);
  });
});
