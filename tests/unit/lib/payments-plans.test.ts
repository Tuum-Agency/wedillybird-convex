import { describe, expect, it } from 'vitest';
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
} from '@/lib/payments/plans';

describe('payments/plans — canonical grid v2', () => {
  it('exposes essential and premium plans only (no free tier)', () => {
    expect(PLANS.essential.tier).toBe('essential');
    expect(PLANS.premium.tier).toBe('premium');
    expect(Object.keys(PLANS).sort()).toEqual(['essential', 'premium']);
  });

  it('matches the canonical grid: 19 € essential, 49 € premium', () => {
    expect(PLANS.essential.prices.EUR).toBe(1900);
    expect(PLANS.premium.prices.EUR).toBe(4900);
  });

  it('post-event upsell is +29 € for 5 years of retention', () => {
    expect(POST_EVENT_UPSELL.prices.EUR).toBe(2900);
    expect(POST_EVENT_UPSELL.galleryRetentionDays).toBe(5 * 365);
  });

  it('essential is cheaper than premium across all currencies', () => {
    for (const currency of ['EUR', 'XOF', 'MAD', 'TND'] as const) {
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
    expect(isCurrency('XOF')).toBe(true);
    expect(isCurrency('USD')).toBe(false);
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
