import type { Currency, PlanTier } from './plans';

/**
 * Pricing tiers by geo region. The B2C grid uses two regions: **africa** (base
 * prices, FCFA-anchored marché Afrique de l'Ouest) and **europe** (uplifted
 * prices for marché européen et amériques où le pouvoir d'achat est ~×2).
 *
 * Detection happens server-side via the `x-vercel-ip-country` header that
 * Vercel injects on every request. A user can override the detected region
 * via the `wbb_region` cookie (used by the future "change region" UI affordance,
 * not exposed yet).
 */
export type PricingRegion = 'africa' | 'europe';

const AFRICAN_COUNTRIES = new Set([
  // XOF zone (UEMOA + EMCCA)
  'SN',
  'CI',
  'ML',
  'BF',
  'TG',
  'BJ',
  'GW',
  'NE',
  'CM',
  'GA',
  'CG',
  'TD',
  'CF',
  'GQ',
  // Maghreb francophone
  'MA',
  'TN',
  'DZ',
  // Autres pays africains où le pricing local est pertinent
  'GN',
  'MR',
]);

export function detectPricingRegion(headers: Headers): PricingRegion {
  // Override via cookie (priorité utilisateur)
  const cookieHeader = headers.get('cookie') ?? '';
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)wbb_region=(africa|europe)/);
  if (cookieMatch) return cookieMatch[1] as PricingRegion;

  // GeoIP via Vercel
  const country = headers.get('x-vercel-ip-country')?.toUpperCase();
  if (country && AFRICAN_COUNTRIES.has(country)) return 'africa';

  // Fallback Europe (couvre Amériques + Asie + Océanie aussi — ils paient le tarif "haut")
  return 'europe';
}

/**
 * Regional price overrides. Base prices in `PLANS[tier].prices` are the
 * **Africa** pricing (anchor of the grid). Europe prices are an overlay for
 * countries with higher purchasing power.
 *
 * Conversions XOF/MAD/TND restent indicatives — en pratique en zone Europe
 * les paiements passent quasi-systématiquement par EUR.
 */
const EUROPE_PRICE_OVERRIDE: Record<PlanTier, Record<Currency, number>> = {
  essential: {
    EUR: 3900, // 39 €
    XOF: 2560000,
    MAD: 43000,
    TND: 13500,
  },
  premium: {
    EUR: 8900, // 89 €
    XOF: 5840000,
    MAD: 97000,
    TND: 30900,
  },
};

const EUROPE_UPSELL_OVERRIDE: Record<Currency, number> = {
  EUR: 5900, // +59 €
  XOF: 3870000,
  MAD: 64000,
  TND: 20500,
};

import { PLANS, POST_EVENT_UPSELL } from './plans';

export function getRegionalPlanPrice(
  plan: PlanTier,
  region: PricingRegion,
  currency: Currency,
): number {
  if (region === 'europe') return EUROPE_PRICE_OVERRIDE[plan][currency];
  return PLANS[plan].prices[currency];
}

export function getRegionalUpsellPrice(region: PricingRegion, currency: Currency): number {
  if (region === 'europe') return EUROPE_UPSELL_OVERRIDE[currency];
  return POST_EVENT_UPSELL.prices[currency];
}

/**
 * Returns the price as a localized string for display, in the appropriate
 * currency for the given region.
 */
import { formatAmount } from './plans';

export function formatRegionalPlanPrice(
  plan: PlanTier,
  region: PricingRegion,
  currency: Currency,
): string {
  return formatAmount(getRegionalPlanPrice(plan, region, currency), currency);
}

export function formatRegionalUpsellPrice(region: PricingRegion, currency: Currency): string {
  return formatAmount(getRegionalUpsellPrice(region, currency), currency);
}
