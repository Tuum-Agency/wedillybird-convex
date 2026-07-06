/**
 * Pro subscriptions — grille canonique avril 2026.
 *
 * Source de vérité : `.context/redesign-direction.md` section "Pricing figé"
 * et CLAUDE.md.
 *
 * Tarifs mensuels (grille v2) :
 *   Starter 99 € / Business 219 € / Agency 449 €
 *
 * Variantes annuelles : -20 % sur le total annuel (= mensuel × 12 × 0.80),
 * arrondi à l'euro supérieur. Convention figée pour cette première version.
 *
 *   Starter annual = 99 × 12 × 0.80 = 950,40 → 951 €
 *   Business annual = 219 × 12 × 0.80 = 2102,40 → 2103 €
 *   Agency annual = 449 × 12 × 0.80 = 4310,40 → 4311 €
 *
 * Pay-as-you-go : tier one-shot 79 €/event pour les pros qui ne veulent pas
 * d'abonnement.
 *
 * **EUR est la source unique** pour MAD/TND/XOF (dérivés via `convertFromEur`).
 * **USD est posé en parité numérique** (v2.3, 2026-07-06, cf. `.context/
 * pricing-v2.md` § « Grille USD ») : un Starter à 99 € coûte $99 — même
 * chiffre, devise locale — au lieu de l'illisible $106.92 (×1,08). Même
 * convention annuelle qu'en EUR (ceil du total remisé).
 *
 * Multi-devises : EUR + USD + MAD réglés via Stripe. XOF/TND restent des
 * devises d'affichage uniquement (pas de processeur de paiement).
 * Les Stripe Prices stables sont nommés `STRIPE_PRICE_<TIER>[_ANNUAL]_<CURRENCY>`
 * (ex. STRIPE_PRICE_STARTER_MAD, STRIPE_PRICE_AGENCY_ANNUAL_USD). Le suffix sans
 * devise (`STRIPE_PRICE_STARTER`) reste un alias EUR pour rétro-compat env.
 */

import type { Currency } from './plans';
import { pricesFromEur } from './currency';

export type SubscriptionTier = 'starter' | 'business' | 'agency';

export type SubscriptionBilling = 'monthly' | 'annual';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';

export interface SubscriptionTierDefinition {
  amountMinor: number;
  currency: 'EUR';
  label: string;
  /** i18n key under Plans.pro.descriptions.{tier} */
  descriptionKey: string;
  /** i18n keys under Plans.pro.features.{key} */
  featureKeys: readonly string[];
  /** Quota d'events actifs simultanés. `null` = illimité. */
  activeEventsQuota: number | null;
  /** Quota mensuel de messages WhatsApp inclus. */
  whatsappMessagesIncluded: number;
  /**
   * Montants équivalents par devise alternative (en unités mineures). Dérivés
   * d'`amountMinor` via `pricesFromEur`. EUR = `amountMinor`. XOF non supporté
   * par Stripe (devise d'affichage uniquement).
   */
  prices: Record<Currency, number>;
}

const STARTER_EUR = 9900; // 99 € (grille v2)
const BUSINESS_EUR = 21900; // 219 € (grille v2)
const AGENCY_EUR = 44900; // 449 € (grille v2)

// USD marché — parité numérique avec l'EUR (99 € ↔ $99), cf. doc d'en-tête.
const STARTER_USD = 9900; // $99
const BUSINESS_USD = 21900; // $219
const AGENCY_USD = 44900; // $449

export const SUBSCRIPTION_TIER_PRICES: Record<SubscriptionTier, SubscriptionTierDefinition> = {
  starter: {
    amountMinor: STARTER_EUR,
    currency: 'EUR',
    label: 'Starter',
    descriptionKey: 'starter',
    featureKeys: ['events3', 'whatsapp2k', 'brandingWedillybird', 'supportEmail48h'],
    activeEventsQuota: 5,
    whatsappMessagesIncluded: 3000,
    prices: { ...pricesFromEur(STARTER_EUR), USD: STARTER_USD },
  },
  business: {
    amountMinor: BUSINESS_EUR,
    currency: 'EUR',
    label: 'Business',
    descriptionKey: 'business',
    featureKeys: ['events10', 'whatsapp6k', 'brandingLogoSubdomain', 'supportPriority24h'],
    activeEventsQuota: 20,
    whatsappMessagesIncluded: 10000,
    prices: { ...pricesFromEur(BUSINESS_EUR), USD: BUSINESS_USD },
  },
  agency: {
    amountMinor: AGENCY_EUR,
    currency: 'EUR',
    label: 'Agency',
    descriptionKey: 'agency',
    featureKeys: ['eventsUnlimited', 'whatsapp20k', 'brandingWhiteLabel', 'accountManager'],
    activeEventsQuota: 50,
    whatsappMessagesIncluded: 25000,
    prices: { ...pricesFromEur(AGENCY_EUR), USD: AGENCY_USD },
  },
};

/**
 * Variantes annuelles : -20 % sur le total annuel, arrondi à l'euro supérieur.
 * Les prix non-EUR sont dérivés des `amountMinor` annuels (mêmes taux que le
 * mensuel).
 */
const STARTER_ANNUAL_EUR = 95100; // 951 € (99 × 12 × 0,80 = 950,40 → ceil 951)
const BUSINESS_ANNUAL_EUR = 210300; // 2 103 € (219 × 12 × 0,80 = 2102,40 → ceil 2103)
const AGENCY_ANNUAL_EUR = 431100; // 4 311 € (449 × 12 × 0,80 = 4310,40 → ceil 4311)

// USD annuels : même convention que l'EUR (ceil(mensuel USD × 12 × 0,80)) —
// parité numérique oblige, les montants coïncident avec l'EUR.
const STARTER_ANNUAL_USD = 95100; // $951
const BUSINESS_ANNUAL_USD = 210300; // $2,103
const AGENCY_ANNUAL_USD = 431100; // $4,311

export const SUBSCRIPTION_TIER_ANNUAL_PRICES: Record<
  SubscriptionTier,
  { amountMinor: number; prices: Record<Currency, number> }
> = {
  starter: {
    amountMinor: STARTER_ANNUAL_EUR,
    prices: { ...pricesFromEur(STARTER_ANNUAL_EUR), USD: STARTER_ANNUAL_USD },
  },
  business: {
    amountMinor: BUSINESS_ANNUAL_EUR,
    prices: { ...pricesFromEur(BUSINESS_ANNUAL_EUR), USD: BUSINESS_ANNUAL_USD },
  },
  agency: {
    amountMinor: AGENCY_ANNUAL_EUR,
    prices: { ...pricesFromEur(AGENCY_ANNUAL_EUR), USD: AGENCY_ANNUAL_USD },
  },
};

/**
 * Pay-as-you-go pro — one-shot 69 € pour 1 événement, sans abonnement.
 * Stripe Price créé pour pouvoir activer le checkout plus tard. Pas de tier
 * `payg` côté schema/code aujourd'hui (cf. BACKLOG).
 */
const PAYG_EUR = 7900; // 79 € (grille v2)
const PAYG_USD = 7900; // $79 — parité numérique

export const PAYG_PRO_PRICE: {
  amountMinor: number;
  currency: 'EUR';
  label: string;
  prices: Record<Currency, number>;
} = {
  amountMinor: PAYG_EUR,
  currency: 'EUR',
  label: 'Pay-as-you-go',
  prices: { ...pricesFromEur(PAYG_EUR), USD: PAYG_USD },
};

export function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  return value === 'starter' || value === 'business' || value === 'agency';
}

export function isSubscriptionBilling(value: unknown): value is SubscriptionBilling {
  return value === 'monthly' || value === 'annual';
}

/**
 * Retourne le Stripe Price ID configuré dans l'environnement pour un tier
 * donné, une cadence de facturation et une devise.
 *
 * Convention env vars :
 *   STRIPE_PRICE_<TIER>[_ANNUAL]_<CURRENCY>   (ex. STRIPE_PRICE_STARTER_MAD,
 *                                              STRIPE_PRICE_AGENCY_ANNUAL_TND)
 *   STRIPE_PRICE_<TIER>[_ANNUAL]              (alias EUR pour rétro-compat env)
 *
 * Devise XOF : non supportée par Stripe (devise d'affichage uniquement, pas de
 * processeur de paiement) — la fonction throw `UNSUPPORTED_STRIPE_CURRENCY` si
 * on l'invoque avec XOF.
 *
 * Throw `MISSING_<ENVNAME>` si la variable n'est pas définie.
 */
export function priceIdForTier(
  tier: SubscriptionTier,
  billing: SubscriptionBilling = 'monthly',
  currency: Currency = 'EUR',
): string {
  if (currency === 'XOF') throw new Error('UNSUPPORTED_STRIPE_CURRENCY');
  const billingSuffix = billing === 'annual' ? '_ANNUAL' : '';
  const currencyEnvName = `STRIPE_PRICE_${tier.toUpperCase()}${billingSuffix}_${currency}` as const;
  const currencyValue = process.env[currencyEnvName];
  if (currencyValue) return currencyValue;
  // Fallback : l'env legacy `STRIPE_PRICE_STARTER` (sans suffix devise) reste
  // un alias EUR pour ne pas casser les déploiements existants.
  if (currency === 'EUR') {
    const legacyName = `STRIPE_PRICE_${tier.toUpperCase()}${billingSuffix}` as const;
    const legacyValue = process.env[legacyName];
    if (legacyValue) return legacyValue;
    throw new Error(`MISSING_${legacyName}`);
  }
  throw new Error(`MISSING_${currencyEnvName}`);
}

const TIER_VARIANTS: ReadonlyArray<{
  tier: SubscriptionTier;
  billing: SubscriptionBilling;
  envBase: string;
}> = [
  { tier: 'starter', billing: 'monthly', envBase: 'STRIPE_PRICE_STARTER' },
  { tier: 'starter', billing: 'annual', envBase: 'STRIPE_PRICE_STARTER_ANNUAL' },
  { tier: 'business', billing: 'monthly', envBase: 'STRIPE_PRICE_BUSINESS' },
  { tier: 'business', billing: 'annual', envBase: 'STRIPE_PRICE_BUSINESS_ANNUAL' },
  { tier: 'agency', billing: 'monthly', envBase: 'STRIPE_PRICE_AGENCY' },
  { tier: 'agency', billing: 'annual', envBase: 'STRIPE_PRICE_AGENCY_ANNUAL' },
];

const STRIPE_TIER_CURRENCIES: ReadonlyArray<Currency> = ['EUR', 'USD', 'MAD', 'TND'];

export function tierForPriceId(
  priceId: string,
): { tier: SubscriptionTier; billing: SubscriptionBilling; currency: Currency } | null {
  for (const variant of TIER_VARIANTS) {
    for (const currency of STRIPE_TIER_CURRENCIES) {
      const envName = `${variant.envBase}_${currency}`;
      if (priceId === process.env[envName]) {
        return { tier: variant.tier, billing: variant.billing, currency };
      }
    }
    // Fallback alias EUR sans suffix.
    if (priceId === process.env[variant.envBase]) {
      return { tier: variant.tier, billing: variant.billing, currency: 'EUR' };
    }
  }
  return null;
}
