import { describe, it, expect } from 'vitest';
import { priceWord, vendorCategoryHue, vendorInitials } from '../../../lib/pro/vendors';

describe('priceWord', () => {
  it('mappe la gamme de prix', () => {
    expect(priceWord(1)).toBe('Économique');
    expect(priceWord(2)).toBe('Modéré');
    expect(priceWord(3)).toBe('Premium');
    expect(priceWord(0)).toBeNull();
    expect(priceWord(undefined)).toBeNull();
  });
});

describe('vendorCategoryHue', () => {
  it('teintes connues + fallback déterministe', () => {
    expect(vendorCategoryHue('Lieu')).toBe(22);
    expect(vendorCategoryHue('Traiteur')).toBe(60);
    const h = vendorCategoryHue('Studio Lumen'); // nom → hash déterministe
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
    expect(vendorCategoryHue('Studio Lumen')).toBe(h);
  });
});

describe('vendorInitials', () => {
  it('deux initiales max', () => {
    expect(vendorInitials('Studio Lumen')).toBe('SL');
    expect(vendorInitials('Maison Diop')).toBe('MD');
    expect(vendorInitials('Domaine')).toBe('D');
    expect(vendorInitials('  ')).toBe('·');
  });
});
