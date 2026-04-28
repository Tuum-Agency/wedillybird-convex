import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { detectCountryFromHeaders, routePayment } from '@/lib/payments/country';

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

  // Tests CinetPay désactivés tant que les credentials prod ne sont pas dispo.
  // Avec le routing actuel, les pays africains tombent sur Stripe + EUR par
  // défaut. Réactiver ces tests quand CinetPay sera décommenté dans
  // `lib/payments/country.ts`.
  it.skip('routes Senegal to CinetPay + XOF', () => {
    expect(routePayment('SN')).toEqual({ provider: 'cinetpay', currency: 'XOF' });
  });

  it.skip('routes Morocco to CinetPay + MAD', () => {
    expect(routePayment('MA')).toEqual({ provider: 'cinetpay', currency: 'MAD' });
  });

  it.skip('routes Tunisia to CinetPay + TND', () => {
    expect(routePayment('TN')).toEqual({ provider: 'cinetpay', currency: 'TND' });
  });

  it('routes African countries to Stripe + EUR while CinetPay is disabled', () => {
    expect(routePayment('SN')).toEqual({ provider: 'stripe', currency: 'EUR' });
    expect(routePayment('CI')).toEqual({ provider: 'stripe', currency: 'EUR' });
    expect(routePayment('MA')).toEqual({ provider: 'stripe', currency: 'EUR' });
  });

  it('falls back to Stripe + EUR for unknown country codes', () => {
    expect(routePayment('XX')).toEqual({ provider: 'stripe', currency: 'EUR' });
    expect(routePayment(undefined)).toEqual({ provider: 'stripe', currency: 'EUR' });
  });

  it.skip('honours preferred currency for African routes', () => {
    expect(routePayment('CI', { currency: 'EUR' })).toEqual({
      provider: 'cinetpay',
      currency: 'EUR',
    });
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
