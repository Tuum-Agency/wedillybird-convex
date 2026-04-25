import { describe, expect, it } from 'vitest';
import {
  PLANS,
  formatAmount,
  getPlanMaxGuests,
  getPlanPrice,
  isCurrency,
  isPaidPlan,
} from '@/lib/payments/plans';

describe('payments/plans', () => {
  it('exposes a free, essential and premium plan', () => {
    expect(PLANS.free.tier).toBe('free');
    expect(PLANS.essential.tier).toBe('essential');
    expect(PLANS.premium.tier).toBe('premium');
  });

  it('free plan has zero price in every currency', () => {
    expect(PLANS.free.prices.EUR).toBe(0);
    expect(PLANS.free.prices.XOF).toBe(0);
    expect(PLANS.free.prices.MAD).toBe(0);
    expect(PLANS.free.prices.TND).toBe(0);
  });

  it('essential is cheaper than premium across currencies', () => {
    for (const currency of ['EUR', 'XOF', 'MAD', 'TND'] as const) {
      expect(PLANS.essential.prices[currency]).toBeLessThan(PLANS.premium.prices[currency]);
    }
  });

  it('isPaidPlan rejects free, accepts paid tiers', () => {
    expect(isPaidPlan('essential')).toBe(true);
    expect(isPaidPlan('premium')).toBe(true);
    expect(isPaidPlan('free')).toBe(false);
    expect(isPaidPlan('garbage')).toBe(false);
  });

  it('isCurrency only accepts supported currencies', () => {
    expect(isCurrency('EUR')).toBe(true);
    expect(isCurrency('XOF')).toBe(true);
    expect(isCurrency('USD')).toBe(false);
    expect(isCurrency('')).toBe(false);
  });

  it('getPlanPrice + getPlanMaxGuests read from the catalog', () => {
    expect(getPlanPrice('essential', 'EUR')).toBe(PLANS.essential.prices.EUR);
    expect(getPlanMaxGuests('premium')).toBe(PLANS.premium.maxGuests);
  });

  it('formatAmount divides by minor units and outputs locale-aware string', () => {
    expect(formatAmount(4900, 'EUR')).toMatch(/49,00/);
    expect(formatAmount(11900, 'EUR')).toMatch(/119,00/);
    expect(formatAmount(40000, 'TND')).toMatch(/40,000/); // TND uses millimes
  });
});
