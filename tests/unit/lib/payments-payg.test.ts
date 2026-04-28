import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PAYG_PRO_PRICE } from '@/lib/payments/subscriptions';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.STRIPE_PRICE_PAYG_EVENT = 'price_payg_eur_TEST';
  process.env.STRIPE_PRICE_PAYG_EVENT_EUR = 'price_payg_eur_TEST';
  process.env.STRIPE_PRICE_PAYG_EVENT_MAD = 'price_payg_mad_TEST';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('PAYG_PRO_PRICE constant', () => {
  it('matches the canonical pricing grid (69 € for one event)', () => {
    expect(PAYG_PRO_PRICE.amountMinor).toBe(6900);
    expect(PAYG_PRO_PRICE.currency).toBe('EUR');
  });

  it('exposes prices for all four supported currencies', () => {
    expect(PAYG_PRO_PRICE.prices.EUR).toBe(6900);
    expect(PAYG_PRO_PRICE.prices.XOF).toBeGreaterThan(0);
    expect(PAYG_PRO_PRICE.prices.MAD).toBeGreaterThan(0);
    expect(PAYG_PRO_PRICE.prices.TND).toBeGreaterThan(0);
  });

  it('keeps a sensible MAD/TND parity with the EUR base price', () => {
    // Sanity bounds: ~10x for MAD (≈ 738), ~3.4x for TND (≈ 234.6)
    // (les montants sont en unités mineures — MAD en centimes, TND en millimes)
    expect(PAYG_PRO_PRICE.prices.MAD / 100).toBeGreaterThan(500);
    expect(PAYG_PRO_PRICE.prices.MAD / 100).toBeLessThan(900);
    expect(PAYG_PRO_PRICE.prices.TND / 1000).toBeGreaterThan(150);
    expect(PAYG_PRO_PRICE.prices.TND / 1000).toBeLessThan(300);
  });
});
