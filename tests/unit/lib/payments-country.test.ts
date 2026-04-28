import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { detectCountryFromHeaders, routePayment } from '@/lib/payments/country';

const ORIGINAL_DRIVER = process.env.PAYMENTS_DRIVER;
const ORIGINAL_CINETPAY_ENABLED = process.env.CINETPAY_ENABLED;

beforeEach(() => {
  delete process.env.PAYMENTS_DRIVER;
  delete process.env.CINETPAY_ENABLED;
});

afterEach(() => {
  if (ORIGINAL_DRIVER === undefined) delete process.env.PAYMENTS_DRIVER;
  else process.env.PAYMENTS_DRIVER = ORIGINAL_DRIVER;

  if (ORIGINAL_CINETPAY_ENABLED === undefined) delete process.env.CINETPAY_ENABLED;
  else process.env.CINETPAY_ENABLED = ORIGINAL_CINETPAY_ENABLED;
});

describe('payments/country — routePayment', () => {
  it('routes France to Stripe + EUR', () => {
    expect(routePayment('FR')).toEqual({ provider: 'stripe', currency: 'EUR' });
  });

  it('routes African countries to Stripe + EUR when CINETPAY_ENABLED is not set', () => {
    expect(routePayment('SN')).toEqual({ provider: 'stripe', currency: 'EUR' });
    expect(routePayment('CI')).toEqual({ provider: 'stripe', currency: 'EUR' });
    expect(routePayment('MA')).toEqual({ provider: 'stripe', currency: 'EUR' });
  });

  it('routes African countries to Stripe + EUR when CINETPAY_ENABLED=false', () => {
    process.env.CINETPAY_ENABLED = 'false';
    expect(routePayment('SN')).toEqual({ provider: 'stripe', currency: 'EUR' });
    expect(routePayment('TN')).toEqual({ provider: 'stripe', currency: 'EUR' });
    expect(routePayment('MA')).toEqual({ provider: 'stripe', currency: 'EUR' });
  });

  describe('CINETPAY_ENABLED=true', () => {
    beforeEach(() => {
      process.env.CINETPAY_ENABLED = 'true';
    });

    it('routes Senegal to CinetPay + XOF', () => {
      expect(routePayment('SN')).toEqual({ provider: 'cinetpay', currency: 'XOF' });
    });

    it('routes Tunisia to CinetPay + TND', () => {
      expect(routePayment('TN')).toEqual({ provider: 'cinetpay', currency: 'TND' });
    });

    it('routes Morocco to CinetPay + MAD', () => {
      expect(routePayment('MA')).toEqual({ provider: 'cinetpay', currency: 'MAD' });
    });

    it('does not affect European countries — France still routes to Stripe + EUR', () => {
      expect(routePayment('FR')).toEqual({ provider: 'stripe', currency: 'EUR' });
    });

    it('honours preferred currency for African routes', () => {
      expect(routePayment('CI', { currency: 'EUR' })).toEqual({
        provider: 'cinetpay',
        currency: 'EUR',
      });
    });
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
