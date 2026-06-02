import { describe, expect, it } from 'vitest';
import {
  detectPricingRegion,
  formatRegionalPlanPrice,
  formatRegionalUpsellPrice,
  getRegionalPlanPrice,
  getRegionalUpsellPrice,
} from '@/lib/payments/region';

function makeHeaders(entries: Record<string, string> = {}): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(entries)) h.set(k, v);
  return h;
}

/**
 * Les overlays tarifaires régionaux (Africa réduit / Americas $99 / Europe ×2)
 * ont été retirés au profit d'une grille unique EUR avec conversion automatique
 * pour les autres devises (cf. CLAUDE.md "Pricing — source de vérité").
 *
 * La détection de région reste utile pour le routage des paiements
 * (Stripe vs CinetPay) — c'est ce que ce fichier teste désormais.
 */
describe('detectPricingRegion', () => {
  it("returns africa for XOF zone countries (Senegal, Côte d'Ivoire, Mali, etc.)", () => {
    for (const country of ['SN', 'CI', 'ML', 'BF', 'TG', 'BJ', 'NE']) {
      const region = detectPricingRegion(makeHeaders({ 'x-vercel-ip-country': country }));
      expect(region, `country=${country}`).toBe('africa');
    }
  });

  it('returns africa for Maghreb francophone (MA, TN, DZ)', () => {
    for (const country of ['MA', 'TN', 'DZ']) {
      const region = detectPricingRegion(makeHeaders({ 'x-vercel-ip-country': country }));
      expect(region, `country=${country}`).toBe('africa');
    }
  });

  it('returns europe for FR, BE, CH, GB, DE, ES (default RoW)', () => {
    for (const country of ['FR', 'BE', 'CH', 'LU', 'GB', 'DE', 'ES']) {
      const region = detectPricingRegion(makeHeaders({ 'x-vercel-ip-country': country }));
      expect(region, `country=${country}`).toBe('europe');
    }
  });

  it('returns americas for US and CA', () => {
    for (const country of ['US', 'CA']) {
      const region = detectPricingRegion(makeHeaders({ 'x-vercel-ip-country': country }));
      expect(region, `country=${country}`).toBe('americas');
    }
  });

  it('returns europe by default when geoIP is missing', () => {
    expect(detectPricingRegion(makeHeaders())).toBe('europe');
  });

  it('respects the wbb_region cookie value americas', () => {
    const h = makeHeaders({
      'x-vercel-ip-country': 'FR',
      cookie: 'wbb_region=americas',
    });
    expect(detectPricingRegion(h)).toBe('americas');
  });

  it('respects the wbb_region cookie override over geoIP', () => {
    const h = makeHeaders({
      'x-vercel-ip-country': 'FR',
      cookie: 'wbb_region=africa; sessionId=abc',
    });
    expect(detectPricingRegion(h)).toBe('africa');
  });

  it('cookie value europe overrides african geoIP', () => {
    const h = makeHeaders({
      'x-vercel-ip-country': 'SN',
      cookie: 'wbb_region=europe',
    });
    expect(detectPricingRegion(h)).toBe('europe');
  });

  it('case-insensitive country code (lowercase header still resolves)', () => {
    expect(detectPricingRegion(makeHeaders({ 'x-vercel-ip-country': 'sn' }))).toBe('africa');
  });
});

describe("getRegionalPlanPrice — pas d'overlay (EUR-master)", () => {
  it('returns the same EUR price for every region', () => {
    for (const region of ['africa', 'europe', 'americas'] as const) {
      expect(getRegionalPlanPrice('essential', region, 'EUR')).toBe(1900);
      expect(getRegionalPlanPrice('premium', region, 'EUR')).toBe(5900);
    }
  });

  it('USD pricing is derived from the EUR base (same for every region)', () => {
    const essentialUsd = getRegionalPlanPrice('essential', 'europe', 'USD');
    expect(getRegionalPlanPrice('essential', 'africa', 'USD')).toBe(essentialUsd);
    expect(getRegionalPlanPrice('essential', 'americas', 'USD')).toBe(essentialUsd);
  });

  it('TND derives at 3.4 millimes per cent EUR', () => {
    // 19 € × 3,4 = 64,6 TND = 64 600 millimes.
    expect(getRegionalPlanPrice('essential', 'europe', 'TND')).toBe(64600);
    expect(getRegionalPlanPrice('premium', 'europe', 'TND')).toBe(200600);
  });
});

describe("getRegionalUpsellPrice — pas d'overlay", () => {
  it('29 € upsell for every region', () => {
    for (const region of ['africa', 'europe', 'americas'] as const) {
      expect(getRegionalUpsellPrice(region, 'EUR')).toBe(2900);
    }
  });

  it('upsell TND = 98 600 millimes for every region', () => {
    for (const region of ['africa', 'europe', 'americas'] as const) {
      expect(getRegionalUpsellPrice(region, 'TND')).toBe(98600);
    }
  });
});

describe('formatRegionalPlanPrice', () => {
  it('formats EUR with the canonical 19 / 59 grid in every region', () => {
    for (const region of ['africa', 'europe', 'americas'] as const) {
      expect(formatRegionalPlanPrice('essential', region, 'EUR')).toMatch(/19,00/);
      expect(formatRegionalPlanPrice('premium', region, 'EUR')).toMatch(/59,00/);
    }
  });

  it('formats upsell at 29 € everywhere', () => {
    for (const region of ['africa', 'europe', 'americas'] as const) {
      expect(formatRegionalUpsellPrice(region, 'EUR')).toMatch(/29,00/);
    }
  });
});
