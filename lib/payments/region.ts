/**
 * Détection de région — utilisée historiquement pour appliquer des overlays
 * tarifaires régionaux. Les overlays ont été retirés (cf. CLAUDE.md "Pricing —
 * source de vérité") : toute la grille s'aligne sur EUR avec conversion
 * automatique pour les autres devises, partout (Afrique incluse).
 *
 * Cette fonction reste utile pour le routage des paiements (Stripe vs CinetPay)
 * et pour pré-sélectionner une devise locale pertinente (XOF/MAD/TND) lors du
 * rendu initial — l'utilisateur peut ensuite ré-override via le sélecteur
 * footer (cf. `stores/currency-store.ts`).
 */
import type { Currency, PlanTier } from './plans';
import { convertFromEur } from './currency';
import { PLANS, POST_EVENT_UPSELL } from './plans';
import {
  PAYG_PRO_PRICE,
  SUBSCRIPTION_TIER_ANNUAL_PRICES,
  SUBSCRIPTION_TIER_PRICES,
  type SubscriptionBilling,
  type SubscriptionTier,
} from './subscriptions';

export type PricingRegion = 'africa' | 'europe' | 'americas';

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

const AMERICAS_COUNTRIES = new Set(['US', 'CA']);

/**
 * Région tarifaire détectée à partir du header geoIP Vercel. Sert au routage
 * paiement (Africa → CinetPay, autres → Stripe) et au choix d'une devise par
 * défaut pertinente côté serveur. Override possible via cookie `wbb_region`.
 */
export function detectPricingRegion(headers: Headers): PricingRegion {
  const cookieHeader = headers.get('cookie') ?? '';
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)wbb_region=(africa|europe|americas)/);
  if (cookieMatch) return cookieMatch[1] as PricingRegion;

  const country = headers.get('x-vercel-ip-country')?.toUpperCase();
  if (country && AFRICAN_COUNTRIES.has(country)) return 'africa';
  if (country && AMERICAS_COUNTRIES.has(country)) return 'americas';

  return 'europe';
}

/**
 * Prix par plan / devise — pas d'overlay régional. Conserve la signature
 * historique pour les appelants existants ; en pratique équivalent à
 * `getPlanPrice(plan, currency)` de `plans.ts`.
 */
export function getRegionalPlanPrice(
  plan: PlanTier,
  _region: PricingRegion,
  currency: Currency,
): number {
  return convertFromEur(PLANS[plan].eurMinor, currency);
}

export function getRegionalUpsellPrice(_region: PricingRegion, currency: Currency): number {
  return convertFromEur(POST_EVENT_UPSELL.eurMinor, currency);
}

/**
 * Devise canonique d'affichage par défaut pour une région donnée. Utilisé par
 * les pages server pour pré-rendre dans une devise locale pertinente — le
 * client peut ensuite override via le sélecteur footer.
 *
 * Note : la dérivation par locale (`defaultCurrencyForLocale` dans
 * `currency.ts`) est désormais la voie privilégiée pour l'affichage marketing.
 * Cette fonction reste utile pour les pages d'app où la locale n'a pas de
 * mapping pertinent (ex. utilisateur africain en page de checkout).
 */
export function defaultCurrencyForRegion(region: PricingRegion): Currency {
  if (region === 'americas') return 'USD';
  return 'EUR';
}

/* -------------------------------------------------------------------------- */
/*  Pros (subscriptions) — pas d'overlay régional non plus.                   */
/* -------------------------------------------------------------------------- */

export function getRegionalSubscriptionPrice(
  tier: SubscriptionTier,
  _region: PricingRegion,
  billing: SubscriptionBilling,
  currency: Currency,
): number {
  return billing === 'annual'
    ? SUBSCRIPTION_TIER_ANNUAL_PRICES[tier].prices[currency]
    : SUBSCRIPTION_TIER_PRICES[tier].prices[currency];
}

export function getRegionalPaygPrice(_region: PricingRegion, currency: Currency): number {
  return PAYG_PRO_PRICE.prices[currency];
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
