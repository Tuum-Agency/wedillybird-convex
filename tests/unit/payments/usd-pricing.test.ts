import { describe, expect, it } from 'vitest';

import { PLANS, POST_EVENT_UPSELL, getPlanPrice, getUpsellPrice } from '@/lib/payments/plans';
import { getRegionalPlanPrice, getRegionalUpsellPrice } from '@/lib/payments/region';
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
});
