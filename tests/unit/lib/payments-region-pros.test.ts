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
 * L'overlay africa réduit (39/79/149 €) a été retiré : la grille s'aligne
 * sur EUR 89/179/349 partout, avec conversion automatique pour les autres
 * devises. Cf. CLAUDE.md "Pricing — source de vérité".
 */
describe("getRegionalSubscriptionPrice — pas d'overlay", () => {
  it('returns the canonical EUR monthly price for every region', () => {
    for (const region of ['africa', 'europe', 'americas'] as const) {
      expect(getRegionalSubscriptionPrice('starter', region, 'monthly', 'EUR')).toBe(
        SUBSCRIPTION_TIER_PRICES.starter.amountMinor,
      );
      expect(getRegionalSubscriptionPrice('business', region, 'monthly', 'EUR')).toBe(
        SUBSCRIPTION_TIER_PRICES.business.amountMinor,
      );
      expect(getRegionalSubscriptionPrice('agency', region, 'monthly', 'EUR')).toBe(
        SUBSCRIPTION_TIER_PRICES.agency.amountMinor,
      );
    }
  });

  it('returns the canonical EUR annual price for every region', () => {
    for (const region of ['africa', 'europe', 'americas'] as const) {
      expect(getRegionalSubscriptionPrice('starter', region, 'annual', 'EUR')).toBe(
        SUBSCRIPTION_TIER_ANNUAL_PRICES.starter.amountMinor,
      );
      expect(getRegionalSubscriptionPrice('agency', region, 'annual', 'EUR')).toBe(
        SUBSCRIPTION_TIER_ANNUAL_PRICES.agency.amountMinor,
      );
    }
  });

  it('annual is strictly cheaper than 12 × monthly for every tier', () => {
    for (const tier of ['starter', 'business', 'agency'] as const) {
      const monthly12 = getRegionalSubscriptionPrice(tier, 'europe', 'monthly', 'EUR') * 12;
      const annual = getRegionalSubscriptionPrice(tier, 'europe', 'annual', 'EUR');
      expect(annual, tier).toBeLessThan(monthly12);
    }
  });
});

describe("getRegionalPaygPrice — pas d'overlay", () => {
  it('returns 69 € for every region', () => {
    for (const region of ['africa', 'europe', 'americas'] as const) {
      expect(getRegionalPaygPrice(region, 'EUR')).toBe(PAYG_PRO_PRICE.prices.EUR);
    }
  });
});

describe('defaultCurrencyForRegion', () => {
  it('americas → USD, africa+europe → EUR', () => {
    expect(defaultCurrencyForRegion('americas')).toBe('USD');
    expect(defaultCurrencyForRegion('europe')).toBe('EUR');
    expect(defaultCurrencyForRegion('africa')).toBe('EUR');
  });
});
