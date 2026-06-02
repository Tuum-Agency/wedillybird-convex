import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLANS, POST_EVENT_UPSELL, priceIdForPlan } from '@/lib/payments/plans';
import { SUBSCRIPTION_TIER_PRICES, priceIdForTier } from '@/lib/payments/subscriptions';

/**
 * Couverture des devises côté Stripe — anti-régression.
 *
 * Stripe ne supporte pas TND comme settlement currency : aucun Price TND n'est
 * créé pour le moment. Ce fichier documente le comportement actuel afin d'éviter
 * une régression silencieuse au moment où on activera TND (création des Prices
 * et set des env vars STRIPE_PRICE_*_TND).
 *
 * Hypothèses :
 *   - `priceIdForPlan('essential', 'TND')` → `undefined` (env var absente, pas
 *      de fallback legacy hors EUR).
 *   - `priceIdForPlan('essential', 'XOF')` → `undefined` (XOF routé CinetPay).
 *   - `priceIdForTier('starter', 'monthly', 'TND')` → throw
 *      `MISSING_STRIPE_PRICE_STARTER_TND` (aucune env var TND).
 *   - `priceIdForTier('starter', 'monthly', 'XOF')` → throw
 *      `UNSUPPORTED_STRIPE_CURRENCY`.
 */
describe('priceIdForPlan currency coverage', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    // Isolation : on repart d'un env propre où on ne maîtrise que les vars
    // ciblées par chaque test.
    delete process.env.STRIPE_PRICE_ESSENTIAL;
    delete process.env.STRIPE_PRICE_ESSENTIAL_EUR;
    delete process.env.STRIPE_PRICE_ESSENTIAL_MAD;
    delete process.env.STRIPE_PRICE_ESSENTIAL_TND;
    delete process.env.STRIPE_PRICE_ESSENTIAL_XOF;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns undefined for XOF (CinetPay-routed)', () => {
    process.env.STRIPE_PRICE_ESSENTIAL_XOF = 'price_should_be_ignored_xof';
    expect(priceIdForPlan('essential', 'XOF')).toBeUndefined();
  });

  it('returns undefined for TND (no Stripe Price configured)', () => {
    // Le scénario actuel : aucune env var STRIPE_PRICE_*_TND n'existe.
    expect(priceIdForPlan('essential', 'TND')).toBeUndefined();
    expect(priceIdForPlan('premium', 'TND')).toBeUndefined();
  });

  it('returns a string for EUR', () => {
    process.env.STRIPE_PRICE_ESSENTIAL = 'price_essential_EUR_TEST';
    const result = priceIdForPlan('essential', 'EUR');
    expect(typeof result).toBe('string');
    expect(result).toBe('price_essential_EUR_TEST');
  });

  it('returns a string for MAD', () => {
    process.env.STRIPE_PRICE_ESSENTIAL_MAD = 'price_essential_MAD_TEST';
    const result = priceIdForPlan('essential', 'MAD');
    expect(typeof result).toBe('string');
    expect(result).toBe('price_essential_MAD_TEST');
  });
});

describe('priceIdForTier currency coverage', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.STRIPE_PRICE_STARTER;
    delete process.env.STRIPE_PRICE_STARTER_EUR;
    delete process.env.STRIPE_PRICE_STARTER_MAD;
    delete process.env.STRIPE_PRICE_STARTER_TND;
    delete process.env.STRIPE_PRICE_STARTER_ANNUAL;
    delete process.env.STRIPE_PRICE_STARTER_ANNUAL_EUR;
    delete process.env.STRIPE_PRICE_STARTER_ANNUAL_MAD;
    delete process.env.STRIPE_PRICE_STARTER_ANNUAL_TND;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('throws UNSUPPORTED_STRIPE_CURRENCY for XOF', () => {
    expect(() => priceIdForTier('starter', 'monthly', 'XOF')).toThrow(
      'UNSUPPORTED_STRIPE_CURRENCY',
    );
  });

  it('throws MISSING_STRIPE_PRICE_STARTER_TND for TND (no Price configured)', () => {
    expect(() => priceIdForTier('starter', 'monthly', 'TND')).toThrow(
      'MISSING_STRIPE_PRICE_STARTER_TND',
    );
  });

  it('returns a string for EUR with monthly billing', () => {
    process.env.STRIPE_PRICE_STARTER = 'price_starter_EUR_TEST';
    const result = priceIdForTier('starter', 'monthly', 'EUR');
    expect(typeof result).toBe('string');
    expect(result).toBe('price_starter_EUR_TEST');
  });

  it('returns a string for MAD with annual billing', () => {
    process.env.STRIPE_PRICE_STARTER_ANNUAL_MAD = 'price_starter_annual_MAD_TEST';
    const result = priceIdForTier('starter', 'annual', 'MAD');
    expect(typeof result).toBe('string');
    expect(result).toBe('price_starter_annual_MAD_TEST');
  });
});

describe('TND pricing sanity (anti-regression)', () => {
  it('PLANS.essential.prices.TND === 98600 (~ 29 € × 3.4)', () => {
    expect(PLANS.essential.prices.TND).toBe(98600);
  });

  it('PLANS.premium.prices.TND === 200600', () => {
    expect(PLANS.premium.prices.TND).toBe(200600);
  });

  it('POST_EVENT_UPSELL.prices.TND === 98600', () => {
    expect(POST_EVENT_UPSELL.prices.TND).toBe(98600);
  });

  it('SUBSCRIPTION_TIER_PRICES.starter.prices.TND === 336600', () => {
    expect(SUBSCRIPTION_TIER_PRICES.starter.prices.TND).toBe(336600);
  });
});
