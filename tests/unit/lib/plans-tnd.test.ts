import { describe, expect, it } from 'vitest';
import { getPlanPrice, getUpsellPrice } from '@/lib/payments/plans';
import { SUBSCRIPTION_TIER_PRICES } from '@/lib/payments/subscriptions';

/**
 * TND amounts are stored in millimes (1 TND = 1 000 millimes).
 *
 * Conversion canonique : 1 EUR ≈ 3,4 TND, arrondi aux 100 millimes les plus
 * proches. Cf. `.context/redesign-direction.md` (section "Pricing figé") +
 * `lib/payments/subscriptions.ts` qui applique la même règle pour les pros.
 *
 * Ce fichier verrouille les valeurs canoniques pour empêcher la régression
 * où les TND particuliers étaient 10× trop bas (oubli de zéro lors de la
 * conversion vers les millimes).
 */
describe('lib/payments/plans — prix TND particuliers (millimes)', () => {
  it('essential : 19 € → 64 600 millimes (= 64,6 TND)', () => {
    expect(getPlanPrice('essential', 'TND')).toBe(64600);
  });

  it('premium : 49 € → 166 600 millimes (= 166,6 TND)', () => {
    expect(getPlanPrice('premium', 'TND')).toBe(166600);
  });

  it('post-event upsell : +29 € → 98 600 millimes (= 98,6 TND)', () => {
    expect(getUpsellPrice('TND')).toBe(98600);
  });

  it('respecte le ratio EUR↔TND ≈ 34 (× 3,4 sur des minor units 1000 vs 100)', () => {
    // EUR est en centimes (÷ 100), TND en millimes (÷ 1000).
    // Donc minor_TND / minor_EUR ≈ 3,4 × (1000/100) = 34.
    const ratioEssential = getPlanPrice('essential', 'TND') / getPlanPrice('essential', 'EUR');
    const ratioPremium = getPlanPrice('premium', 'TND') / getPlanPrice('premium', 'EUR');
    const ratioUpsell = getUpsellPrice('TND') / getUpsellPrice('EUR');

    for (const ratio of [ratioEssential, ratioPremium, ratioUpsell]) {
      expect(ratio).toBeGreaterThanOrEqual(33);
      expect(ratio).toBeLessThanOrEqual(35);
    }
  });

  it('garde la parité existante des pros (subscriptions.ts) — starter = 302 600 millimes', () => {
    // Garde-fou : si le code Pro régresse sur la même classe de bug, ce test
    // tombe en même temps que la grille particuliers.
    expect(SUBSCRIPTION_TIER_PRICES.starter.prices.TND).toBe(302600);
  });
});
