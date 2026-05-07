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

  it('returns europe for FR, BE, CH, GB, DE, ES (default uplift)', () => {
    for (const country of ['FR', 'BE', 'CH', 'LU', 'GB', 'DE', 'ES']) {
      const region = detectPricingRegion(makeHeaders({ 'x-vercel-ip-country': country }));
      expect(region, `country=${country}`).toBe('europe');
    }
  });

  it('returns americas for US and CA (USD-billed bloc)', () => {
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

describe('getRegionalPlanPrice', () => {
  it('returns base African prices unchanged (anchor)', () => {
    expect(getRegionalPlanPrice('essential', 'africa', 'EUR')).toBe(1900);
    expect(getRegionalPlanPrice('premium', 'africa', 'EUR')).toBe(4900);
  });

  it('uplifts to European prices: 39 € essential, 89 € premium', () => {
    expect(getRegionalPlanPrice('essential', 'europe', 'EUR')).toBe(3900);
    expect(getRegionalPlanPrice('premium', 'europe', 'EUR')).toBe(8900);
  });

  it('Europe price > Africa price for every plan and currency', () => {
    for (const plan of ['essential', 'premium'] as const) {
      for (const currency of ['EUR', 'USD', 'XOF', 'MAD', 'TND'] as const) {
        const africa = getRegionalPlanPrice(plan, 'africa', currency);
        const europe = getRegionalPlanPrice(plan, 'europe', currency);
        expect(europe, `${plan}/${currency}`).toBeGreaterThan(africa);
      }
    }
  });

  it('americas Essential is $39 USD', () => {
    expect(getRegionalPlanPrice('essential', 'americas', 'USD')).toBe(3900);
  });

  it('americas Premium is $99 USD (capture +11 % marge vs europe $89)', () => {
    expect(getRegionalPlanPrice('premium', 'americas', 'USD')).toBe(9900);
    // L'overlay americas est strictement supérieur à l'overlay europe en USD.
    expect(getRegionalPlanPrice('premium', 'americas', 'USD')).toBeGreaterThan(
      getRegionalPlanPrice('premium', 'europe', 'USD'),
    );
  });
});

describe('getRegionalUpsellPrice', () => {
  it('Africa upsell is 29 € EUR (anchor)', () => {
    expect(getRegionalUpsellPrice('africa', 'EUR')).toBe(2900);
  });

  it('Europe upsell is 59 € EUR (uplift)', () => {
    expect(getRegionalUpsellPrice('europe', 'EUR')).toBe(5900);
  });

  it('Americas upsell is +$59 USD', () => {
    expect(getRegionalUpsellPrice('americas', 'USD')).toBe(5900);
  });
});

describe('formatRegionalPlanPrice', () => {
  it('formats with locale-aware EUR symbol', () => {
    expect(formatRegionalPlanPrice('essential', 'africa', 'EUR')).toMatch(/19,00/);
    expect(formatRegionalPlanPrice('essential', 'europe', 'EUR')).toMatch(/39,00/);
    expect(formatRegionalPlanPrice('premium', 'europe', 'EUR')).toMatch(/89,00/);
  });

  it('formats upsell price', () => {
    expect(formatRegionalUpsellPrice('africa', 'EUR')).toMatch(/29,00/);
    expect(formatRegionalUpsellPrice('europe', 'EUR')).toMatch(/59,00/);
  });
});
