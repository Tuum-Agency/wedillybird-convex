import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SUBSCRIPTION_TIER_PRICES,
  isSubscriptionTier,
  priceIdForTier,
  tierForPriceId,
} from '@/lib/payments/subscriptions';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.STRIPE_PRICE_STARTER = 'price_starter_TEST';
  process.env.STRIPE_PRICE_BUSINESS = 'price_business_TEST';
  process.env.STRIPE_PRICE_AGENCY = 'price_agency_TEST';
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

describe('priceIdForTier', () => {
  it('returns the matching env var value', () => {
    expect(priceIdForTier('starter')).toBe('price_starter_TEST');
    expect(priceIdForTier('business')).toBe('price_business_TEST');
    expect(priceIdForTier('agency')).toBe('price_agency_TEST');
  });

  it('throws when the env var is missing', () => {
    delete process.env.STRIPE_PRICE_AGENCY;
    expect(() => priceIdForTier('agency')).toThrow('MISSING_STRIPE_PRICE_AGENCY');
  });
});

describe('tierForPriceId (round-trip)', () => {
  it('reverses priceIdForTier', () => {
    expect(tierForPriceId('price_starter_TEST')).toBe('starter');
    expect(tierForPriceId('price_business_TEST')).toBe('business');
    expect(tierForPriceId('price_agency_TEST')).toBe('agency');
  });

  it('returns null for unknown price id', () => {
    expect(tierForPriceId('price_unknown')).toBeNull();
  });

  it('returns null when env vars are unset', () => {
    delete process.env.STRIPE_PRICE_STARTER;
    delete process.env.STRIPE_PRICE_BUSINESS;
    delete process.env.STRIPE_PRICE_AGENCY;
    expect(tierForPriceId('price_starter_TEST')).toBeNull();
  });
});

describe('SUBSCRIPTION_TIER_PRICES', () => {
  it('matches the Stripe Prices created via CLI (29 / 79 / 199 EUR/mo)', () => {
    expect(SUBSCRIPTION_TIER_PRICES.starter.amountMinor).toBe(2900);
    expect(SUBSCRIPTION_TIER_PRICES.business.amountMinor).toBe(7900);
    expect(SUBSCRIPTION_TIER_PRICES.agency.amountMinor).toBe(19900);
  });

  it('all tiers are billed in EUR (matches Stripe Price currency)', () => {
    for (const tier of ['starter', 'business', 'agency'] as const) {
      expect(SUBSCRIPTION_TIER_PRICES[tier].currency).toBe('EUR');
    }
  });

  it('each tier has at least three features', () => {
    for (const tier of ['starter', 'business', 'agency'] as const) {
      expect(SUBSCRIPTION_TIER_PRICES[tier].features.length).toBeGreaterThanOrEqual(3);
    }
  });
});
