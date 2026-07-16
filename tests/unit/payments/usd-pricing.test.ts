import { describe, expect, it } from 'vitest';

import { PLANS, POST_EVENT_UPSELL, getPlanPrice, getUpsellPrice } from '@/lib/payments/plans';
import { getRegionalPlanPrice, getRegionalUpsellPrice } from '@/lib/payments/region';
import {
  PAYG_PRO_PRICE,
  SUBSCRIPTION_TIER_ANNUAL_PRICES,
  SUBSCRIPTION_TIER_PRICES,
} from '@/lib/payments/subscriptions';
import { convertFromEur } from '@/lib/payments/currency';

/**
 * Grille USD posée en valeur marché (2026-07-06) — cf. `.context/pricing-v2.md`
 * § « Grille USD ». Le marché US paie des nombres ronds ($40/$80/$30), PAS la
 * conversion mécanique EUR×1,08 ($31.32/$63.72). Les autres devises restent
 * dérivées de l'EUR.
 */
describe('grille USD marché (overrides)', () => {
  it('applique les prix US ronds sur les plans consumer', () => {
    expect(getPlanPrice('essential', 'USD')).toBe(4000); // $40
    expect(getPlanPrice('premium', 'USD')).toBe(8000); // $80
    expect(getUpsellPrice('USD')).toBe(3000); // +$30
  });

  it('expose les mêmes montants via la table prices', () => {
    expect(PLANS.essential.prices.USD).toBe(4000);
    expect(PLANS.premium.prices.USD).toBe(8000);
    expect(POST_EVENT_UPSELL.prices.USD).toBe(3000);
  });

  it('ne touche pas à la grille EUR canonique', () => {
    expect(getPlanPrice('essential', 'EUR')).toBe(2900);
    expect(getPlanPrice('premium', 'EUR')).toBe(5900);
    expect(getUpsellPrice('EUR')).toBe(2900);
  });

  it('laisse les autres devises dérivées de l’EUR', () => {
    expect(getPlanPrice('essential', 'MAD')).toBe(convertFromEur(2900, 'MAD'));
    expect(getPlanPrice('premium', 'XOF')).toBe(convertFromEur(5900, 'XOF'));
  });

  it('aligne les helpers régionaux sur les mêmes overrides', () => {
    expect(getRegionalPlanPrice('essential', 'americas', 'USD')).toBe(4000);
    expect(getRegionalPlanPrice('premium', 'americas', 'USD')).toBe(8000);
    expect(getRegionalUpsellPrice('americas', 'USD')).toBe(3000);
    expect(getRegionalPlanPrice('essential', 'europe', 'EUR')).toBe(2900);
  });

  it('applique la grille USD marché pro (≥ équiv. EUR, v2.4)', () => {
    expect(SUBSCRIPTION_TIER_PRICES.starter.prices.USD).toBe(10900); // $109
    expect(SUBSCRIPTION_TIER_PRICES.business.prices.USD).toBe(23900); // $239
    expect(SUBSCRIPTION_TIER_PRICES.agency.prices.USD).toBe(48900); // $489
    expect(SUBSCRIPTION_TIER_ANNUAL_PRICES.starter.prices.USD).toBe(104700); // $1,047
    expect(SUBSCRIPTION_TIER_ANNUAL_PRICES.business.prices.USD).toBe(229500); // $2,295
    expect(SUBSCRIPTION_TIER_ANNUAL_PRICES.agency.prices.USD).toBe(469500); // $4,695
    expect(PAYG_PRO_PRICE.prices.USD).toBe(8900); // $89
  });

  it('respecte la règle devise : USD pro ≥ équivalent EUR (signe jamais inversé)', () => {
    // Le pro US ne doit JAMAIS payer sous l'euro converti (revenu récurrent).
    for (const tier of ['starter', 'business', 'agency'] as const) {
      const def = SUBSCRIPTION_TIER_PRICES[tier];
      expect(def.prices.USD).toBeGreaterThanOrEqual(convertFromEur(def.prices.EUR, 'USD'));
      const annual = SUBSCRIPTION_TIER_ANNUAL_PRICES[tier];
      expect(annual.prices.USD).toBeGreaterThanOrEqual(convertFromEur(annual.prices.EUR, 'USD'));
    }
    expect(PAYG_PRO_PRICE.prices.USD).toBeGreaterThanOrEqual(
      convertFromEur(PAYG_PRO_PRICE.prices.EUR, 'USD'),
    );
  });

  it('ne touche pas aux montants pro EUR ni aux dérivés MAD', () => {
    expect(SUBSCRIPTION_TIER_PRICES.starter.prices.EUR).toBe(9900);
    expect(SUBSCRIPTION_TIER_ANNUAL_PRICES.agency.prices.EUR).toBe(431100);
    expect(SUBSCRIPTION_TIER_PRICES.starter.prices.MAD).toBe(convertFromEur(9900, 'MAD'));
    expect(PAYG_PRO_PRICE.prices.EUR).toBe(7900);
  });
});
