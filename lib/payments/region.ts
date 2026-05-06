import type { Currency, PlanTier } from './plans';

/**
 * Pricing tiers by geo region.
 *
 * - **africa** : grille de base FCFA-anchored, marché Afrique de l'Ouest +
 *   Maghreb. Prix bas assumés (pouvoir d'achat moindre).
 * - **europe** : grille upliftée ×2 pour le marché européen.
 * - **americas** : marché US/CA, devise USD avec parité psychologique 1:1
 *   sur la grille europe (Essential $39, Premium $99, Upsell +$59 — Premium
 *   capture +11 % marge vs Europe pour matcher le positionnement US wedding
 *   tech haut de gamme).
 *
 * Detection happens server-side via the `x-vercel-ip-country` header that
 * Vercel injects on every request. A user can override the detected region
 * via the `wbb_region` cookie. **Sécurité** : le cookie peut être manipulé,
 * il pilote l'affichage mais le checkout doit re-vérifier le geo header
 * pour bloquer un FR qui se ferait passer pour americas afin de payer en USD.
 */
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

export function detectPricingRegion(headers: Headers): PricingRegion {
  // Override via cookie (priorité utilisateur, affichage uniquement —
  // le checkout doit re-valider la combinaison country/currency).
  const cookieHeader = headers.get('cookie') ?? '';
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)wbb_region=(africa|europe|americas)/);
  if (cookieMatch) return cookieMatch[1] as PricingRegion;

  // GeoIP via Vercel
  const country = headers.get('x-vercel-ip-country')?.toUpperCase();
  if (country && AFRICAN_COUNTRIES.has(country)) return 'africa';
  if (country && AMERICAS_COUNTRIES.has(country)) return 'americas';

  // Fallback Europe (couvre RoW : Asie + Océanie + LATAM hors US/CA — ils
  // paient le tarif "haut" en EUR par défaut jusqu'à ce qu'on ouvre une
  // grille locale dédiée).
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
    USD: 3900, // fallback — la région americas a son propre overlay (ci-dessous)
    XOF: 2560000,
    MAD: 43000,
    TND: 132600, // 132,6 TND (= 39 € × 3,4)
  },
  premium: {
    EUR: 8900, // 89 €
    USD: 8900,
    XOF: 5840000,
    MAD: 97000,
    TND: 302600, // 302,6 TND (= 89 € × 3,4)
  },
};

const EUROPE_UPSELL_OVERRIDE: Record<Currency, number> = {
  EUR: 5900, // +59 €
  USD: 5900,
  XOF: 3870000,
  MAD: 64000,
  TND: 200600, // 200,6 TND (= 59 € × 3,4)
};

/**
 * Grille americas (US + CA) — devise canonique USD, parité psychologique 1:1
 * sur la grille europe sauf Premium qui passe à $99 (capture +11 % marge,
 * matche the Knot premium tier $99-149).
 *
 * Les valeurs EUR/MAD/TND/XOF sont des fallbacks indicatifs : un user americas
 * paie en USD via Stripe en pratique.
 */
const AMERICAS_PRICE_OVERRIDE: Record<PlanTier, Record<Currency, number>> = {
  essential: {
    EUR: 3900,
    USD: 3900, // $39
    XOF: 2560000,
    MAD: 43000,
    TND: 132600,
  },
  premium: {
    EUR: 8900,
    USD: 9900, // $99 (vs $89 EUR-overlay pour matcher marché US wedding tech)
    XOF: 5840000,
    MAD: 97000,
    TND: 302600,
  },
};

const AMERICAS_UPSELL_OVERRIDE: Record<Currency, number> = {
  EUR: 5900,
  USD: 5900, // +$59
  XOF: 3870000,
  MAD: 64000,
  TND: 200600,
};

import { PLANS, POST_EVENT_UPSELL } from './plans';

export function getRegionalPlanPrice(
  plan: PlanTier,
  region: PricingRegion,
  currency: Currency,
): number {
  if (region === 'americas') return AMERICAS_PRICE_OVERRIDE[plan][currency];
  if (region === 'europe') return EUROPE_PRICE_OVERRIDE[plan][currency];
  return PLANS[plan].prices[currency];
}

export function getRegionalUpsellPrice(region: PricingRegion, currency: Currency): number {
  if (region === 'americas') return AMERICAS_UPSELL_OVERRIDE[currency];
  if (region === 'europe') return EUROPE_UPSELL_OVERRIDE[currency];
  return POST_EVENT_UPSELL.prices[currency];
}

/**
 * Devise canonique d'affichage pour une région donnée. Utilisée par les pages
 * de pricing pour résoudre `currency` côté server à partir du `region` détecté
 * sans avoir à hard-coder EUR partout.
 */
export function defaultCurrencyForRegion(region: PricingRegion): Currency {
  if (region === 'americas') return 'USD';
  return 'EUR';
}

/* -------------------------------------------------------------------------- */
/*  Pros (subscriptions) — region overlay                                     */
/* -------------------------------------------------------------------------- */

import {
  PAYG_PRO_PRICE,
  SUBSCRIPTION_TIER_ANNUAL_PRICES,
  SUBSCRIPTION_TIER_PRICES,
  type SubscriptionBilling,
  type SubscriptionTier,
} from './subscriptions';

/**
 * Africa overlay pros — prix réduits pour matcher le pouvoir d'achat local.
 * Aujourd'hui (sans overlay) un solo planner Dakar paierait 89 € ≈ 58 000 XOF
 * (~10 % du salaire d'un cadre confirmé). Inacceptable.
 *
 * Grille africa : 39 / 79 / 149 € équivalent mensuel, 29 € PAYG.
 * Annuel = -20 % sur le total, arrondi à l'entier supérieur.
 *   Starter ann   = 39 × 12 × 0.80 = 374,40 → 375
 *   Business ann  = 79 × 12 × 0.80 = 758,40 → 759
 *   Agency ann    = 149 × 12 × 0.80 = 1430,40 → 1431
 */
const AFRICA_PRO_MONTHLY: Record<SubscriptionTier, Record<Currency, number>> = {
  starter: {
    EUR: 3900,
    USD: 3900,
    XOF: 2560000,
    MAD: 41700, // ≈ 39 € × 10,7
    TND: 132600, // ≈ 39 € × 3,4 (en millimes)
  },
  business: {
    EUR: 7900,
    USD: 7900,
    XOF: 5184000,
    MAD: 84500,
    TND: 268600,
  },
  agency: {
    EUR: 14900,
    USD: 14900,
    XOF: 9776000,
    MAD: 159400,
    TND: 506600,
  },
};

const AFRICA_PRO_ANNUAL: Record<SubscriptionTier, Record<Currency, number>> = {
  starter: { EUR: 37500, USD: 37500, XOF: 24600000, MAD: 401300, TND: 1275000 },
  business: { EUR: 75900, USD: 75900, XOF: 49790000, MAD: 812100, TND: 2580600 },
  agency: { EUR: 143100, USD: 143100, XOF: 93874000, MAD: 1531200, TND: 4865400 },
};

const AFRICA_PAYG: Record<Currency, number> = {
  EUR: 2900,
  USD: 2900,
  XOF: 1900000,
  MAD: 31000,
  TND: 98600,
};

export function getRegionalSubscriptionPrice(
  tier: SubscriptionTier,
  region: PricingRegion,
  billing: SubscriptionBilling,
  currency: Currency,
): number {
  if (region === 'africa') {
    return billing === 'annual'
      ? AFRICA_PRO_ANNUAL[tier][currency]
      : AFRICA_PRO_MONTHLY[tier][currency];
  }
  // Europe + americas : grille canonique EUR/USD telle qu'elle (parité 1:1).
  // Le routing currency par région est résolu par `defaultCurrencyForRegion`.
  return billing === 'annual'
    ? SUBSCRIPTION_TIER_ANNUAL_PRICES[tier].prices[currency]
    : SUBSCRIPTION_TIER_PRICES[tier].prices[currency];
}

export function getRegionalPaygPrice(region: PricingRegion, currency: Currency): number {
  if (region === 'africa') return AFRICA_PAYG[currency];
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
