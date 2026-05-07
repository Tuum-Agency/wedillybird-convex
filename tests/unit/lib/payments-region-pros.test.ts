import { describe, expect, it } from 'vitest';
import {
  getRegionalPaygPrice,
  getRegionalSubscriptionPrice,
  defaultCurrencyForRegion,
} from '@/lib/payments/region';
import {
  PAYG_PRO_PRICE,
  SUBSCRIPTION_TIER_ANNUAL_PRICES,
  SUBSCRIPTION_TIER_PRICES,
} from '@/lib/payments/subscriptions';

/**
 * Region overlay pros : africa applique une grille réduite (39/79/149 €
 * équivalent) pour matcher le pouvoir d'achat local. Europe + americas
 * gardent la grille canonique 89/179/349.
 */
describe('getRegionalSubscriptionPrice', () => {
  it('africa uses the reduced grid 39 / 79 / 149 € monthly', () => {
    expect(getRegionalSubscriptionPrice('starter', 'africa', 'monthly', 'EUR')).toBe(3900);
    expect(getRegionalSubscriptionPrice('business', 'africa', 'monthly', 'EUR')).toBe(7900);
    expect(getRegionalSubscriptionPrice('agency', 'africa', 'monthly', 'EUR')).toBe(14900);
  });

  it('africa annual is 375 / 759 / 1431 € (-20 % du mensuel × 12, ceil)', () => {
    expect(getRegionalSubscriptionPrice('starter', 'africa', 'annual', 'EUR')).toBe(37500);
    expect(getRegionalSubscriptionPrice('business', 'africa', 'annual', 'EUR')).toBe(75900);
    expect(getRegionalSubscriptionPrice('agency', 'africa', 'annual', 'EUR')).toBe(143100);
  });

  it('africa < europe for every tier and billing', () => {
    for (const tier of ['starter', 'business', 'agency'] as const) {
      for (const billing of ['monthly', 'annual'] as const) {
        const africa = getRegionalSubscriptionPrice(tier, 'africa', billing, 'EUR');
        const europe = getRegionalSubscriptionPrice(tier, 'europe', billing, 'EUR');
        expect(africa, `${tier}/${billing}`).toBeLessThan(europe);
      }
    }
  });

  it('europe matches the canonical grid (no overlay)', () => {
    expect(getRegionalSubscriptionPrice('starter', 'europe', 'monthly', 'EUR')).toBe(
      SUBSCRIPTION_TIER_PRICES.starter.amountMinor,
    );
    expect(getRegionalSubscriptionPrice('agency', 'europe', 'annual', 'EUR')).toBe(
      SUBSCRIPTION_TIER_ANNUAL_PRICES.agency.amountMinor,
    );
  });

  it('americas resolves to USD pricing 1:1 with the canonical grid', () => {
    expect(getRegionalSubscriptionPrice('starter', 'americas', 'monthly', 'USD')).toBe(8900);
    expect(getRegionalSubscriptionPrice('business', 'americas', 'monthly', 'USD')).toBe(17900);
    expect(getRegionalSubscriptionPrice('agency', 'americas', 'monthly', 'USD')).toBe(34900);
  });

  it('annual is strictly cheaper than 12 × monthly across all regions', () => {
    for (const region of ['africa', 'europe', 'americas'] as const) {
      for (const tier of ['starter', 'business', 'agency'] as const) {
        const monthly12 = getRegionalSubscriptionPrice(tier, region, 'monthly', 'EUR') * 12;
        const annual = getRegionalSubscriptionPrice(tier, region, 'annual', 'EUR');
        expect(annual, `${region}/${tier}`).toBeLessThan(monthly12);
      }
    }
  });
});

describe('getRegionalPaygPrice', () => {
  it('africa PAYG is 29 €', () => {
    expect(getRegionalPaygPrice('africa', 'EUR')).toBe(2900);
  });

  it('europe PAYG matches the canonical 69 €', () => {
    expect(getRegionalPaygPrice('europe', 'EUR')).toBe(PAYG_PRO_PRICE.prices.EUR);
  });

  it('americas PAYG is $69', () => {
    expect(getRegionalPaygPrice('americas', 'USD')).toBe(6900);
  });
});

describe('defaultCurrencyForRegion', () => {
  it('americas → USD, africa+europe → EUR', () => {
    expect(defaultCurrencyForRegion('americas')).toBe('USD');
    expect(defaultCurrencyForRegion('europe')).toBe('EUR');
    expect(defaultCurrencyForRegion('africa')).toBe('EUR');
  });
});
