import { describe, expect, it } from 'vitest';
import { affiliateBuyerDiscountMinor } from '../../../lib/payments/affiliate-discount';

describe('affiliateBuyerDiscountMinor — remise « communauté » d’un code partenaire', () => {
  it('applique le % en basis points sur le prix (arrondi entier)', () => {
    expect(affiliateBuyerDiscountMinor(5900, 1000)).toBe(590); // Premium 59 € · -10 % = 5,90 €
    expect(affiliateBuyerDiscountMinor(2900, 1000)).toBe(290); // Essentiel 29 € · -10 %
    expect(affiliateBuyerDiscountMinor(8000, 2000)).toBe(1600); // $80 · -20 %
  });

  it('arrondit sans laisser fuir de flottant', () => {
    expect(affiliateBuyerDiscountMinor(2999, 1500)).toBe(450); // 449,85 → 450
    expect(affiliateBuyerDiscountMinor(3333, 500)).toBe(167); // 166,65 → 167
  });

  it('borne la remise au prix (jamais de sur-remise, même si bps aberrant)', () => {
    expect(affiliateBuyerDiscountMinor(5900, 10000)).toBe(5900); // 100 %
    expect(affiliateBuyerDiscountMinor(5900, 30000)).toBe(5900); // borné à l’ordre
  });

  it('renvoie 0 sur entrées nulles / négatives / non finies', () => {
    expect(affiliateBuyerDiscountMinor(0, 1000)).toBe(0);
    expect(affiliateBuyerDiscountMinor(5900, 0)).toBe(0);
    expect(affiliateBuyerDiscountMinor(-5900, 1000)).toBe(0);
    expect(affiliateBuyerDiscountMinor(5900, -1000)).toBe(0);
    expect(affiliateBuyerDiscountMinor(Number.NaN, 1000)).toBe(0);
    expect(affiliateBuyerDiscountMinor(5900, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
