/**
 * Pro subscriptions — grille canonique avril 2026.
 *
 * Source de vérité : `.context/redesign-direction.md` section "Pricing figé".
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
 * Multi-devises : EUR via Stripe, XOF via CinetPay, MAD/TND via Stripe.
 * Les Stripe Prices stables sont nommés `STRIPE_PRICE_<TIER>[_ANNUAL]_<CURRENCY>`
 * (ex. STRIPE_PRICE_STARTER_MAD, STRIPE_PRICE_AGENCY_ANNUAL_TND). Le suffix sans
 * devise (`STRIPE_PRICE_STARTER`) reste un alias EUR pour rétro-compat env.
 */

import type { Currency } from './plans';

export type SubscriptionTier = 'starter' | 'business' | 'agency';

export type SubscriptionBilling = 'monthly' | 'annual';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';

export interface SubscriptionTierDefinition {
  amountMinor: number;
  currency: 'EUR';
  label: string;
  description: string;
  features: readonly string[];
  /** Quota d'events actifs simultanés. `null` = illimité. */
  activeEventsQuota: number | null;
  /** Quota mensuel de messages WhatsApp inclus. */
  whatsappMessagesIncluded: number;
  /**
   * Montants équivalents par devise alternative (en unités mineures).
   * EUR = `amountMinor`. XOF non supporté par Stripe (CinetPay prend le relais
   * pour ce flux). Conversion : EUR × 10,7 (MAD) / × 3,4 (TND), arrondi à
   * 100 unités mineures les plus proches.
   */
  prices: Record<Currency, number>;
}

export const SUBSCRIPTION_TIER_PRICES: Record<SubscriptionTier, SubscriptionTierDefinition> = {
  starter: {
    amountMinor: 8900,
    currency: 'EUR',
    label: 'Starter',
    description: 'Pour démarrer une activité de wedding planner.',
    features: [
      "Jusqu'à 3 événements actifs",
      '2 000 messages WhatsApp inclus / mois',
      'Branding Wedillybird (logo et couleurs imposés)',
      'Support email sous 48h',
    ],
    activeEventsQuota: 3,
    whatsappMessagesIncluded: 2000,
    // 89 € / ≈ 952 MAD / ≈ 302,6 TND
    prices: { EUR: 8900, XOF: 5840000, MAD: 95200, TND: 302600 },
  },
  business: {
    amountMinor: 17900,
    currency: 'EUR',
    label: 'Business',
    description: 'Pour agences confirmées avec plusieurs mariages en parallèle.',
    features: [
      "Jusqu'à 10 événements actifs",
      '6 000 messages WhatsApp inclus / mois',
      'Logo personnalisé et sous-domaine dédié',
      'Support prioritaire',
    ],
    activeEventsQuota: 10,
    whatsappMessagesIncluded: 6000,
    // 179 € / ≈ 1 915 MAD / ≈ 608,6 TND
    prices: { EUR: 17900, XOF: 11744000, MAD: 191500, TND: 608600 },
  },
  agency: {
    amountMinor: 34900,
    currency: 'EUR',
    label: 'Agency',
    description: 'Pour grandes agences multi-marques en marque blanche.',
    features: [
      'Événements illimités',
      '20 000 messages WhatsApp inclus / mois',
      'Marque blanche complète (logo, domaine, emails)',
      'Account manager dédié + SLA 99,9 %',
    ],
    activeEventsQuota: null,
    whatsappMessagesIncluded: 20000,
    // 349 € / ≈ 3 734 MAD / ≈ 1 186,6 TND
    prices: { EUR: 34900, XOF: 22894000, MAD: 373400, TND: 1186600 },
  },
};

/**
 * Variantes annuelles : -20 % sur le total annuel, arrondi à l'euro supérieur.
 * Permet d'afficher l'économie réalisée vs mensuel (12× le tarif mensuel).
 *
 * Conversion vers MAD/TND/XOF identique au mensuel (parité × 10,7 / × 3,4 /
 * × 656, arrondi à 100 unités mineures les plus proches).
 */
export const SUBSCRIPTION_TIER_ANNUAL_PRICES: Record<
  SubscriptionTier,
  { amountMinor: number; prices: Record<Currency, number> }
> = {
  // 855 € / ≈ 9 148 MAD / ≈ 2 907 TND
  starter: {
    amountMinor: 85500,
    prices: { EUR: 85500, XOF: 56088000, MAD: 914800, TND: 2907000 },
  },
  // 1719 € / ≈ 18 393 MAD / ≈ 5 844,6 TND
  business: {
    amountMinor: 171900,
    prices: { EUR: 171900, XOF: 112766000, MAD: 1839300, TND: 5844600 },
  },
  // 3351 € / ≈ 35 856 MAD / ≈ 11 393,4 TND
  agency: {
    amountMinor: 335100,
    prices: { EUR: 335100, XOF: 219826000, MAD: 3585600, TND: 11393400 },
  },
};

/**
 * Pay-as-you-go pro — one-shot 69 € pour 1 événement, sans abonnement.
 * Stripe Price créé pour pouvoir activer le checkout plus tard. Pas de tier
 * `payg` côté schema/code aujourd'hui (cf. BACKLOG).
 *
 * Conversion : 69 € → ≈ 738 MAD / ≈ 234,6 TND.
 */
export const PAYG_PRO_PRICE: {
  amountMinor: number;
  currency: 'EUR';
  label: string;
  prices: Record<Currency, number>;
} = {
  amountMinor: 6900,
  currency: 'EUR',
  label: 'Pay-as-you-go',
  prices: { EUR: 6900, XOF: 4528000, MAD: 73800, TND: 234600 },
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

const STRIPE_TIER_CURRENCIES: ReadonlyArray<Currency> = ['EUR', 'MAD', 'TND'];

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
