import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PLANS,
  POST_EVENT_UPSELL,
  computeGalleryExpiresAt,
  computeGalleryExpiresAtAfterUpsell,
  formatAmount,
  getGalleryRetentionDays,
  getPlanPrice,
  getUpsellPrice,
  isCurrency,
  isPaidPlan,
  priceIdForPlan,
  priceIdForPostEventUpsell,
} from '@/lib/payments/plans';

describe('payments/plans — canonical grid v2', () => {
  it('exposes essential and premium plans only (no free tier)', () => {
    expect(PLANS.essential.tier).toBe('essential');
    expect(PLANS.premium.tier).toBe('premium');
    expect(Object.keys(PLANS).sort()).toEqual(['essential', 'premium']);
  });

  it('matches the canonical grid: 29 € essential, 59 € premium', () => {
    expect(PLANS.essential.prices.EUR).toBe(2900);
    expect(PLANS.premium.prices.EUR).toBe(5900);
  });

  it('post-event upsell is +29 € for 5 years of retention', () => {
    expect(POST_EVENT_UPSELL.prices.EUR).toBe(2900);
    expect(POST_EVENT_UPSELL.galleryRetentionDays).toBe(5 * 365);
  });

  it('essential is cheaper than premium across all currencies', () => {
    for (const currency of ['EUR', 'USD', 'XOF', 'MAD', 'TND'] as const) {
      expect(PLANS.essential.prices[currency]).toBeLessThan(PLANS.premium.prices[currency]);
    }
  });

  it('isPaidPlan rejects free + only accepts essential / premium', () => {
    expect(isPaidPlan('essential')).toBe(true);
    expect(isPaidPlan('premium')).toBe(true);
    expect(isPaidPlan('free')).toBe(false);
    expect(isPaidPlan('garbage')).toBe(false);
  });

  it('isCurrency only accepts supported currencies', () => {
    expect(isCurrency('EUR')).toBe(true);
    expect(isCurrency('USD')).toBe(true);
    expect(isCurrency('XOF')).toBe(true);
    expect(isCurrency('MAD')).toBe(true);
    expect(isCurrency('TND')).toBe(true);
    expect(isCurrency('GBP')).toBe(false);
    expect(isCurrency('')).toBe(false);
  });

  it('getPlanPrice + getUpsellPrice read from the catalog', () => {
    expect(getPlanPrice('essential', 'EUR')).toBe(PLANS.essential.prices.EUR);
    expect(getUpsellPrice('EUR')).toBe(POST_EVENT_UPSELL.prices.EUR);
  });

  it('gallery retention is feature-tiered (J+30 essential, J+180 premium)', () => {
    expect(getGalleryRetentionDays('essential')).toBe(30);
    expect(getGalleryRetentionDays('premium')).toBe(180);
  });

  it('computeGalleryExpiresAt adds the retention window to the event date', () => {
    const eventDate = Date.parse('2026-06-15T12:00:00Z');
    const MS_PER_DAY = 86_400_000;
    expect(computeGalleryExpiresAt(eventDate, 'essential')).toBe(eventDate + 30 * MS_PER_DAY);
    expect(computeGalleryExpiresAt(eventDate, 'premium')).toBe(eventDate + 180 * MS_PER_DAY);
    expect(computeGalleryExpiresAtAfterUpsell(eventDate)).toBe(eventDate + 5 * 365 * MS_PER_DAY);
  });

  it('formatAmount divides by minor units and outputs locale-aware string', () => {
    expect(formatAmount(1900, 'EUR')).toMatch(/19,00/);
    expect(formatAmount(4900, 'EUR')).toMatch(/49,00/);
    expect(formatAmount(40000, 'TND')).toMatch(/40,000/); // TND uses millimes
  });
});

describe('priceIdForPlan / priceIdForPostEventUpsell', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.STRIPE_PRICE_ESSENTIAL = 'price_essential_TEST';
    process.env.STRIPE_PRICE_PREMIUM = 'price_premium_TEST';
    process.env.STRIPE_PRICE_POST_EVENT_UPSELL = 'price_upsell_TEST';
    delete process.env.STRIPE_PRICE_ESSENTIAL_EUR;
    delete process.env.STRIPE_PRICE_ESSENTIAL_MAD;
    delete process.env.STRIPE_PRICE_ESSENTIAL_TND;
    delete process.env.STRIPE_PRICE_PREMIUM_EUR;
    delete process.env.STRIPE_PRICE_PREMIUM_MAD;
    delete process.env.STRIPE_PRICE_PREMIUM_TND;
    delete process.env.STRIPE_PRICE_POST_EVENT_UPSELL_EUR;
    delete process.env.STRIPE_PRICE_POST_EVENT_UPSELL_MAD;
    delete process.env.STRIPE_PRICE_POST_EVENT_UPSELL_TND;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('reads env vars per plan tier (EUR by default)', () => {
    expect(priceIdForPlan('essential')).toBe('price_essential_TEST');
    expect(priceIdForPlan('premium')).toBe('price_premium_TEST');
  });

  it('returns undefined when env var is missing (driver fallback to price_data)', () => {
    delete process.env.STRIPE_PRICE_ESSENTIAL;
    expect(priceIdForPlan('essential')).toBeUndefined();
  });

  it('priceIdForPlan(plan, "EUR") prefers _EUR suffix and falls back to legacy alias', () => {
    process.env.STRIPE_PRICE_ESSENTIAL_EUR = 'price_essential_EUR_TEST';
    expect(priceIdForPlan('essential', 'EUR')).toBe('price_essential_EUR_TEST');
    delete process.env.STRIPE_PRICE_ESSENTIAL_EUR;
    expect(priceIdForPlan('essential', 'EUR')).toBe('price_essential_TEST');
  });

  it('priceIdForPlan(plan, "MAD") reads STRIPE_PRICE_<PLAN>_MAD only', () => {
    process.env.STRIPE_PRICE_ESSENTIAL_MAD = 'price_essential_MAD_TEST';
    expect(priceIdForPlan('essential', 'MAD')).toBe('price_essential_MAD_TEST');
    delete process.env.STRIPE_PRICE_ESSENTIAL_MAD;
    // Legacy alias only applies to EUR — MAD must be undefined when missing.
    expect(priceIdForPlan('essential', 'MAD')).toBeUndefined();
  });

  it('priceIdForPlan(plan, "TND") is always undefined (TND non settleable par Stripe)', () => {
    // TND, comme XOF, n'est pas supporté par Stripe comme settlement currency et
    // n'a pas de processeur dédié — le driver Stripe ne doit jamais recevoir TND.
    process.env.STRIPE_PRICE_ESSENTIAL_TND = 'price_should_be_ignored';
    expect(priceIdForPlan('essential', 'TND')).toBeUndefined();
    expect(priceIdForPlan('premium', 'TND')).toBeUndefined();
    delete process.env.STRIPE_PRICE_ESSENTIAL_TND;
  });

  it('priceIdForPlan(plan, "XOF") is always undefined (XOF non settleable par Stripe)', () => {
    process.env.STRIPE_PRICE_ESSENTIAL_XOF = 'price_should_be_ignored';
    expect(priceIdForPlan('essential', 'XOF')).toBeUndefined();
    expect(priceIdForPlan('premium', 'XOF')).toBeUndefined();
  });

  it('reads the upsell env var (EUR)', () => {
    expect(priceIdForPostEventUpsell()).toBe('price_upsell_TEST');
    delete process.env.STRIPE_PRICE_POST_EVENT_UPSELL;
    expect(priceIdForPostEventUpsell()).toBeUndefined();
  });

  it('priceIdForPostEventUpsell honours per-currency env vars', () => {
    process.env.STRIPE_PRICE_POST_EVENT_UPSELL_MAD = 'price_upsell_MAD_TEST';
    expect(priceIdForPostEventUpsell('MAD')).toBe('price_upsell_MAD_TEST');
    expect(priceIdForPostEventUpsell('XOF')).toBeUndefined();
    expect(priceIdForPostEventUpsell('TND')).toBeUndefined();
  });
});
