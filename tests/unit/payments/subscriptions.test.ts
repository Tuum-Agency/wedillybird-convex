import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PAYG_PRO_PRICE,
  SUBSCRIPTION_TIER_ANNUAL_PRICES,
  SUBSCRIPTION_TIER_PRICES,
  isSubscriptionBilling,
  isSubscriptionTier,
  priceIdForTier,
  tierForPriceId,
} from '@/lib/payments/subscriptions';

const ORIGINAL_ENV = { ...process.env };

const PER_CURRENCY_ENV_KEYS = [
  'STRIPE_PRICE_STARTER_EUR',
  'STRIPE_PRICE_STARTER_MAD',
  'STRIPE_PRICE_STARTER_TND',
  'STRIPE_PRICE_BUSINESS_EUR',
  'STRIPE_PRICE_BUSINESS_MAD',
  'STRIPE_PRICE_BUSINESS_TND',
  'STRIPE_PRICE_AGENCY_EUR',
  'STRIPE_PRICE_AGENCY_MAD',
  'STRIPE_PRICE_AGENCY_TND',
  'STRIPE_PRICE_STARTER_ANNUAL_EUR',
  'STRIPE_PRICE_STARTER_ANNUAL_MAD',
  'STRIPE_PRICE_STARTER_ANNUAL_TND',
  'STRIPE_PRICE_BUSINESS_ANNUAL_EUR',
  'STRIPE_PRICE_BUSINESS_ANNUAL_MAD',
  'STRIPE_PRICE_BUSINESS_ANNUAL_TND',
  'STRIPE_PRICE_AGENCY_ANNUAL_EUR',
  'STRIPE_PRICE_AGENCY_ANNUAL_MAD',
  'STRIPE_PRICE_AGENCY_ANNUAL_TND',
] as const;

beforeEach(() => {
  process.env.STRIPE_PRICE_STARTER = 'price_starter_TEST';
  process.env.STRIPE_PRICE_BUSINESS = 'price_business_TEST';
  process.env.STRIPE_PRICE_AGENCY = 'price_agency_TEST';
  process.env.STRIPE_PRICE_STARTER_ANNUAL = 'price_starter_annual_TEST';
  process.env.STRIPE_PRICE_BUSINESS_ANNUAL = 'price_business_annual_TEST';
  process.env.STRIPE_PRICE_AGENCY_ANNUAL = 'price_agency_annual_TEST';
  // Reset per-currency env vars between tests pour éviter les fuites.
  for (const key of PER_CURRENCY_ENV_KEYS) {
    delete process.env[key];
  }
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('isSubscriptionTier', () => {
  it('accepts the three known tiers', () => {
    expect(isSubscriptionTier('starter')).toBe(true);
    expect(isSubscriptionTier('business')).toBe(true);
    expect(isSubscriptionTier('agency')).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(isSubscriptionTier('free')).toBe(false);
    expect(isSubscriptionTier('')).toBe(false);
    expect(isSubscriptionTier(null)).toBe(false);
    expect(isSubscriptionTier(undefined)).toBe(false);
    expect(isSubscriptionTier(42)).toBe(false);
  });
});

describe('isSubscriptionBilling', () => {
  it('accepts monthly and annual', () => {
    expect(isSubscriptionBilling('monthly')).toBe(true);
    expect(isSubscriptionBilling('annual')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isSubscriptionBilling('weekly')).toBe(false);
    expect(isSubscriptionBilling('')).toBe(false);
    expect(isSubscriptionBilling(null)).toBe(false);
  });
});

describe('priceIdForTier', () => {
  it('defaults to monthly + EUR when billing/currency are omitted', () => {
    expect(priceIdForTier('starter')).toBe('price_starter_TEST');
    expect(priceIdForTier('business')).toBe('price_business_TEST');
    expect(priceIdForTier('agency')).toBe('price_agency_TEST');
  });

  it('returns the annual env var when billing=annual (EUR alias)', () => {
    expect(priceIdForTier('starter', 'annual')).toBe('price_starter_annual_TEST');
    expect(priceIdForTier('business', 'annual')).toBe('price_business_annual_TEST');
    expect(priceIdForTier('agency', 'annual')).toBe('price_agency_annual_TEST');
  });

  it('prefers STRIPE_PRICE_<TIER>_EUR over the legacy alias when both are set', () => {
    process.env.STRIPE_PRICE_STARTER_EUR = 'price_starter_EUR_TEST';
    expect(priceIdForTier('starter', 'monthly', 'EUR')).toBe('price_starter_EUR_TEST');
    expect(priceIdForTier('starter')).toBe('price_starter_EUR_TEST');
  });

  it('reads STRIPE_PRICE_<TIER>_MAD for currency=MAD (no legacy fallback)', () => {
    process.env.STRIPE_PRICE_STARTER_MAD = 'price_starter_MAD_TEST';
    expect(priceIdForTier('starter', 'monthly', 'MAD')).toBe('price_starter_MAD_TEST');
    delete process.env.STRIPE_PRICE_STARTER_MAD;
    expect(() => priceIdForTier('starter', 'monthly', 'MAD')).toThrow(
      'MISSING_STRIPE_PRICE_STARTER_MAD',
    );
  });

  it('reads STRIPE_PRICE_<TIER>_TND for currency=TND', () => {
    process.env.STRIPE_PRICE_AGENCY_TND = 'price_agency_TND_TEST';
    expect(priceIdForTier('agency', 'monthly', 'TND')).toBe('price_agency_TND_TEST');
  });

  it('reads STRIPE_PRICE_<TIER>_ANNUAL_<CURRENCY> for billing=annual', () => {
    process.env.STRIPE_PRICE_BUSINESS_ANNUAL_MAD = 'price_business_annual_MAD_TEST';
    expect(priceIdForTier('business', 'annual', 'MAD')).toBe('price_business_annual_MAD_TEST');
    delete process.env.STRIPE_PRICE_BUSINESS_ANNUAL_MAD;
    expect(() => priceIdForTier('business', 'annual', 'MAD')).toThrow(
      'MISSING_STRIPE_PRICE_BUSINESS_ANNUAL_MAD',
    );
  });

  it('throws UNSUPPORTED_STRIPE_CURRENCY for XOF (CinetPay path only)', () => {
    expect(() => priceIdForTier('starter', 'monthly', 'XOF')).toThrow(
      'UNSUPPORTED_STRIPE_CURRENCY',
    );
    expect(() => priceIdForTier('agency', 'annual', 'XOF')).toThrow(
      'UNSUPPORTED_STRIPE_CURRENCY',
    );
  });

  it('throws when the env var is missing (EUR uses legacy alias name)', () => {
    delete process.env.STRIPE_PRICE_AGENCY;
    expect(() => priceIdForTier('agency')).toThrow('MISSING_STRIPE_PRICE_AGENCY');
    delete process.env.STRIPE_PRICE_BUSINESS_ANNUAL;
    expect(() => priceIdForTier('business', 'annual')).toThrow(
      'MISSING_STRIPE_PRICE_BUSINESS_ANNUAL',
    );
  });
});

describe('tierForPriceId (round-trip)', () => {
  it('reverses priceIdForTier for monthly (legacy alias = EUR)', () => {
    expect(tierForPriceId('price_starter_TEST')).toEqual({
      tier: 'starter',
      billing: 'monthly',
      currency: 'EUR',
    });
    expect(tierForPriceId('price_business_TEST')).toEqual({
      tier: 'business',
      billing: 'monthly',
      currency: 'EUR',
    });
    expect(tierForPriceId('price_agency_TEST')).toEqual({
      tier: 'agency',
      billing: 'monthly',
      currency: 'EUR',
    });
  });

  it('reverses priceIdForTier for annual (legacy alias = EUR)', () => {
    expect(tierForPriceId('price_starter_annual_TEST')).toEqual({
      tier: 'starter',
      billing: 'annual',
      currency: 'EUR',
    });
    expect(tierForPriceId('price_business_annual_TEST')).toEqual({
      tier: 'business',
      billing: 'annual',
      currency: 'EUR',
    });
    expect(tierForPriceId('price_agency_annual_TEST')).toEqual({
      tier: 'agency',
      billing: 'annual',
      currency: 'EUR',
    });
  });

  it('recognises per-currency suffixed env vars (MAD / TND)', () => {
    process.env.STRIPE_PRICE_STARTER_MAD = 'price_starter_MAD_TEST';
    process.env.STRIPE_PRICE_AGENCY_ANNUAL_TND = 'price_agency_annual_TND_TEST';
    expect(tierForPriceId('price_starter_MAD_TEST')).toEqual({
      tier: 'starter',
      billing: 'monthly',
      currency: 'MAD',
    });
    expect(tierForPriceId('price_agency_annual_TND_TEST')).toEqual({
      tier: 'agency',
      billing: 'annual',
      currency: 'TND',
    });
  });

  it('returns null for unknown price id', () => {
    expect(tierForPriceId('price_unknown')).toBeNull();
  });

  it('returns null when env vars are unset', () => {
    delete process.env.STRIPE_PRICE_STARTER;
    delete process.env.STRIPE_PRICE_BUSINESS;
    delete process.env.STRIPE_PRICE_AGENCY;
    delete process.env.STRIPE_PRICE_STARTER_ANNUAL;
    delete process.env.STRIPE_PRICE_BUSINESS_ANNUAL;
    delete process.env.STRIPE_PRICE_AGENCY_ANNUAL;
    expect(tierForPriceId('price_starter_TEST')).toBeNull();
  });
});

describe('SUBSCRIPTION_TIER_PRICES — grille canonique avril 2026', () => {
  it('matches 89 / 179 / 349 EUR/mo', () => {
    expect(SUBSCRIPTION_TIER_PRICES.starter.amountMinor).toBe(8900);
    expect(SUBSCRIPTION_TIER_PRICES.business.amountMinor).toBe(17900);
    expect(SUBSCRIPTION_TIER_PRICES.agency.amountMinor).toBe(34900);
  });

  it('all monthly tiers are billed in EUR (canonical reference currency)', () => {
    for (const tier of ['starter', 'business', 'agency'] as const) {
      expect(SUBSCRIPTION_TIER_PRICES[tier].currency).toBe('EUR');
    }
  });

  it('exposes per-currency prices (EUR/XOF/MAD/TND) for each monthly tier', () => {
    for (const tier of ['starter', 'business', 'agency'] as const) {
      const def = SUBSCRIPTION_TIER_PRICES[tier];
      expect(def.prices.EUR).toBe(def.amountMinor);
      expect(def.prices.MAD).toBeGreaterThan(0);
      expect(def.prices.TND).toBeGreaterThan(0);
      expect(def.prices.XOF).toBeGreaterThan(0);
    }
  });

  it('annual prices expose the same currency map keyed on EUR/XOF/MAD/TND', () => {
    for (const tier of ['starter', 'business', 'agency'] as const) {
      const def = SUBSCRIPTION_TIER_ANNUAL_PRICES[tier];
      expect(def.prices.EUR).toBe(def.amountMinor);
      expect(def.prices.MAD).toBeGreaterThan(0);
      expect(def.prices.TND).toBeGreaterThan(0);
    }
  });

  it('exposes active events quota and WhatsApp inclusion', () => {
    expect(SUBSCRIPTION_TIER_PRICES.starter.activeEventsQuota).toBe(3);
    expect(SUBSCRIPTION_TIER_PRICES.starter.whatsappMessagesIncluded).toBe(2000);
    expect(SUBSCRIPTION_TIER_PRICES.business.activeEventsQuota).toBe(10);
    expect(SUBSCRIPTION_TIER_PRICES.business.whatsappMessagesIncluded).toBe(6000);
    expect(SUBSCRIPTION_TIER_PRICES.agency.activeEventsQuota).toBeNull();
    expect(SUBSCRIPTION_TIER_PRICES.agency.whatsappMessagesIncluded).toBe(20000);
  });
});

describe('SUBSCRIPTION_TIER_ANNUAL_PRICES — -20 % arrondi à l\'euro supérieur', () => {
  it('starter annual = 855 € (89 × 12 × 0.80 = 854,40 → ceil 855)', () => {
    expect(SUBSCRIPTION_TIER_ANNUAL_PRICES.starter.amountMinor).toBe(85500);
  });

  it('business annual = 1719 € (179 × 12 × 0.80 = 1718,40 → ceil 1719)', () => {
    expect(SUBSCRIPTION_TIER_ANNUAL_PRICES.business.amountMinor).toBe(171900);
  });

  it('agency annual = 3351 € (349 × 12 × 0.80 = 3350,40 → ceil 3351)', () => {
    expect(SUBSCRIPTION_TIER_ANNUAL_PRICES.agency.amountMinor).toBe(335100);
  });

  it('annual is strictly cheaper than 12 × monthly for every tier', () => {
    for (const tier of ['starter', 'business', 'agency'] as const) {
      const monthlyTimes12 = SUBSCRIPTION_TIER_PRICES[tier].amountMinor * 12;
      expect(SUBSCRIPTION_TIER_ANNUAL_PRICES[tier].amountMinor).toBeLessThan(monthlyTimes12);
    }
  });
});

describe('PAYG_PRO_PRICE', () => {
  it('is 69 € EUR one-shot', () => {
    expect(PAYG_PRO_PRICE.amountMinor).toBe(6900);
    expect(PAYG_PRO_PRICE.currency).toBe('EUR');
  });

  it('exposes per-currency prices for the multi-currency router', () => {
    expect(PAYG_PRO_PRICE.prices.EUR).toBe(6900);
    expect(PAYG_PRO_PRICE.prices.MAD).toBeGreaterThan(0);
    expect(PAYG_PRO_PRICE.prices.TND).toBeGreaterThan(0);
    expect(PAYG_PRO_PRICE.prices.XOF).toBeGreaterThan(0);
  });
});
