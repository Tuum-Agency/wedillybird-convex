import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { currencyForCountry, detectCountryFromHeaders, routePayment } from '@/lib/payments/country';

const ORIGINAL_DRIVER = process.env.PAYMENTS_DRIVER;

beforeEach(() => {
  delete process.env.PAYMENTS_DRIVER;
});

afterEach(() => {
  if (ORIGINAL_DRIVER === undefined) delete process.env.PAYMENTS_DRIVER;
  else process.env.PAYMENTS_DRIVER = ORIGINAL_DRIVER;
});

describe('payments/country — routePayment', () => {
  it('routes France to Stripe + EUR', () => {
    expect(routePayment('FR')).toEqual({ provider: 'stripe', currency: 'EUR' });
  });

  it('routes US to Stripe + USD', () => {
    expect(routePayment('US')).toEqual({ provider: 'stripe', currency: 'USD' });
  });

  it('routes CA to Stripe + USD (USD-billed bloc)', () => {
    expect(routePayment('CA')).toEqual({ provider: 'stripe', currency: 'USD' });
  });

  it('honours preferred currency override for US (e.g. EU customer travelling)', () => {
    expect(routePayment('US', { currency: 'EUR' })).toEqual({
      provider: 'stripe',
      currency: 'EUR',
    });
  });

  it('routes African + Maghreb countries to Stripe + EUR (no dedicated processor)', () => {
    expect(routePayment('SN')).toEqual({ provider: 'stripe', currency: 'EUR' });
    expect(routePayment('CI')).toEqual({ provider: 'stripe', currency: 'EUR' });
    expect(routePayment('TN')).toEqual({ provider: 'stripe', currency: 'EUR' });
    expect(routePayment('MA')).toEqual({ provider: 'stripe', currency: 'EUR' });
  });

  it('falls back to Stripe + EUR for unknown country codes', () => {
    expect(routePayment('XX')).toEqual({ provider: 'stripe', currency: 'EUR' });
    expect(routePayment(undefined)).toEqual({ provider: 'stripe', currency: 'EUR' });
  });

  it('forces mock driver when PAYMENTS_DRIVER=mock', () => {
    process.env.PAYMENTS_DRIVER = 'mock';
    expect(routePayment('FR')).toEqual({ provider: 'mock', currency: 'EUR' });
    expect(routePayment('SN', { currency: 'XOF' })).toEqual({
      provider: 'mock',
      currency: 'XOF',
    });
  });
});

describe('payments/country — currencyForCountry (devise = géographie, pas langue)', () => {
  it('facture US/CA en USD', () => {
    expect(currencyForCountry('US')).toBe('USD');
    expect(currencyForCountry('CA')).toBe('USD');
    expect(currencyForCountry('us')).toBe('USD'); // insensible à la casse
  });

  it('facture le reste du monde en EUR (FR, MA, SN, inconnu, absent)', () => {
    expect(currencyForCountry('FR')).toBe('EUR');
    expect(currencyForCountry('MA')).toBe('EUR');
    expect(currencyForCountry('SN')).toBe('EUR');
    expect(currencyForCountry('XX')).toBe('EUR');
    expect(currencyForCountry(undefined)).toBe('EUR');
  });
});

describe('payments/country — detectCountryFromHeaders', () => {
  it('reads x-vercel-ip-country first', () => {
    const headers = new Headers({ 'x-vercel-ip-country': 'FR' });
    expect(detectCountryFromHeaders(headers)).toBe('FR');
  });

  it('falls back to cf-ipcountry', () => {
    const headers = new Headers({ 'cf-ipcountry': 'CI' });
    expect(detectCountryFromHeaders(headers)).toBe('CI');
  });

  it('returns undefined when no header is present', () => {
    expect(detectCountryFromHeaders(new Headers())).toBeUndefined();
  });
});
