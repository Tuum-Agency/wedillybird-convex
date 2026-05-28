/**
 * Pro subscriptions — grille canonique avril 2026.
 *
 * Source de vérité : `.context/redesign-direction.md` section "Pricing figé"
 * et CLAUDE.md.
 *
 * Tarifs mensuels :
 *   Starter 89 € / Business 179 € / Agency 349 €
 *
 * Variantes annuelles : -20 % sur le total annuel (= mensuel × 12 × 0.80),
 * arrondi à l'euro supérieur. Convention figée pour cette première version.
 *
 *   Starter annual = 89 × 12 × 0.80 = 854,40 → 855 € (∼71,25 €/mois équivalent)
 *   Business annual = 179 × 12 × 0.80 = 1718,40 → 1719 € (∼143,25 €/mois équivalent)
 *   Agency annual = 349 × 12 × 0.80 = 3350,40 → 3351 € (∼279,25 €/mois équivalent)
 *
 * Pay-as-you-go : tier one-shot 69 €/event pour les pros qui ne veulent pas
 * d'abonnement. Code-side l'intégration n'est PAS encore branchée — seul le
 * Stripe Price est créé pour pouvoir basculer plus tard sans déploiement.
 * Cf. BACKLOG "Pay-as-you-go pro code-side".
 *
 * **EUR est la source unique** — USD/MAD/TND/XOF sont dérivés via
 * `convertFromEur` (cf. `lib/payments/currency.ts`). Pas d'overlay régional :
 * un Starter à 89 € reste 89 € converti pour tout le monde.
 *
 * Multi-devises : EUR + USD via Stripe, XOF via CinetPay, MAD/TND via Stripe.
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
   * par Stripe (CinetPay prend le relais).
   */
  prices: Record<Currency, number>;
}

const STARTER_EUR = 8900; // 89 €
const BUSINESS_EUR = 17900; // 179 €
const AGENCY_EUR = 34900; // 349 €

export const SUBSCRIPTION_TIER_PRICES: Record<SubscriptionTier, SubscriptionTierDefinition> = {
  starter: {
    amountMinor: STARTER_EUR,
    currency: 'EUR',
    label: 'Starter',
    descriptionKey: 'starter',
    featureKeys: ['events3', 'whatsapp2k', 'brandingWedillybird', 'supportEmail48h'],
    activeEventsQuota: 3,
    whatsappMessagesIncluded: 2000,
    prices: pricesFromEur(STARTER_EUR),
  },
  business: {
    amountMinor: BUSINESS_EUR,
    currency: 'EUR',
    label: 'Business',
    descriptionKey: 'business',
    featureKeys: ['events10', 'whatsapp6k', 'brandingLogoSubdomain', 'supportPriority24h'],
    activeEventsQuota: 10,
    whatsappMessagesIncluded: 6000,
    prices: pricesFromEur(BUSINESS_EUR),
  },
  agency: {
    amountMinor: AGENCY_EUR,
    currency: 'EUR',
    label: 'Agency',
    descriptionKey: 'agency',
    featureKeys: ['eventsUnlimited', 'whatsapp20k', 'brandingWhiteLabel', 'accountManager'],
    activeEventsQuota: null,
    whatsappMessagesIncluded: 20000,
    prices: pricesFromEur(AGENCY_EUR),
  },
};

/**
 * Variantes annuelles : -20 % sur le total annuel, arrondi à l'euro supérieur.
 * Les prix non-EUR sont dérivés des `amountMinor` annuels (mêmes taux que le
 * mensuel).
 */
const STARTER_ANNUAL_EUR = 85500; // 855 €
const BUSINESS_ANNUAL_EUR = 171900; // 1 719 €
const AGENCY_ANNUAL_EUR = 335100; // 3 351 €

export const SUBSCRIPTION_TIER_ANNUAL_PRICES: Record<
  SubscriptionTier,
  { amountMinor: number; prices: Record<Currency, number> }
> = {
  starter: { amountMinor: STARTER_ANNUAL_EUR, prices: pricesFromEur(STARTER_ANNUAL_EUR) },
  business: { amountMinor: BUSINESS_ANNUAL_EUR, prices: pricesFromEur(BUSINESS_ANNUAL_EUR) },
  agency: { amountMinor: AGENCY_ANNUAL_EUR, prices: pricesFromEur(AGENCY_ANNUAL_EUR) },
};

/**
 * Pay-as-you-go pro — one-shot 69 € pour 1 événement, sans abonnement.
 * Stripe Price créé pour pouvoir activer le checkout plus tard. Pas de tier
 * `payg` côté schema/code aujourd'hui (cf. BACKLOG).
 */
const PAYG_EUR = 6900; // 69 €

export const PAYG_PRO_PRICE: {
  amountMinor: number;
  currency: 'EUR';
  label: string;
  prices: Record<Currency, number>;
} = {
  amountMinor: PAYG_EUR,
  currency: 'EUR',
  label: 'Pay-as-you-go',
  prices: pricesFromEur(PAYG_EUR),
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
 * Devise XOF : non supportée par Stripe (paiement routé vers CinetPay) — la
 * fonction throw `UNSUPPORTED_STRIPE_CURRENCY` si on l'invoque avec XOF.
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
