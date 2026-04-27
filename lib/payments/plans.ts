/**
 * Canonical pricing grid — Wedillybird (avril 2026).
 *
 * Source de vérité : `.context/redesign-direction.md` (section "Pricing figé").
 *
 * Particuliers : paiement one-shot, 2 plans + 1 upsell post-mariage.
 * Pas de tier gratuit. Pas de quota d'invitations particuliers (capacity-based
 * → features-based, cf. spec).
 *
 * Multi-devises : EUR via Stripe, XOF via CinetPay, MAD/TND via Stripe.
 * Les Stripe Prices stables sont nommés `STRIPE_PRICE_<PLAN>_<CURRENCY>` (ex.
 * STRIPE_PRICE_ESSENTIAL_MAD). Le suffix sans devise (`STRIPE_PRICE_ESSENTIAL`)
 * reste un alias EUR pour rétro-compat env.
 */

export type PlanTier = 'essential' | 'premium';
export type Currency = 'EUR' | 'XOF' | 'MAD' | 'TND';

export interface PlanDefinition {
  tier: PlanTier;
  /** i18n keys (under `Plans.features.*`) listing what's included. */
  featureKeys: ReadonlyArray<string>;
  /** Days of gallery retention after event date. */
  galleryRetentionDays: number;
  prices: Record<Currency, number>; // amount in minor units (cents, sub-units)
}

export interface PostEventUpsellDefinition {
  /** i18n keys for what the upsell unlocks. */
  featureKeys: ReadonlyArray<string>;
  /** New retention days post-mariage upsell (replaces the plan's default). */
  galleryRetentionDays: number;
  prices: Record<Currency, number>;
}

const ESSENTIAL_FEATURES = [
  'invitationPage',
  'qrCodes',
  'rsvpRealtime',
  'checkinOffline',
  'basicDashboard',
] as const;

const PREMIUM_EXTRA_FEATURES = ['gallerySharedExtended', 'pdfAlbumFinal'] as const;

export const PLANS: Record<PlanTier, PlanDefinition> = {
  essential: {
    tier: 'essential',
    featureKeys: ESSENTIAL_FEATURES,
    galleryRetentionDays: 30,
    // 19 € EUR / ≈ 12 500 XOF / ≈ 21 000 MAD / ≈ 6 500 TND
    prices: { EUR: 1900, XOF: 1250000, MAD: 21000, TND: 6500 },
  },
  premium: {
    tier: 'premium',
    featureKeys: [...ESSENTIAL_FEATURES, ...PREMIUM_EXTRA_FEATURES],
    galleryRetentionDays: 180,
    // 49 € EUR / ≈ 32 200 XOF / ≈ 53 000 MAD / ≈ 16 500 TND
    prices: { EUR: 4900, XOF: 3220000, MAD: 53000, TND: 16500 },
  },
};

export const POST_EVENT_UPSELL: PostEventUpsellDefinition = {
  featureKeys: ['galleryRetention5y', 'photoBookHd', 'exportHd'],
  galleryRetentionDays: 5 * 365, // 5 ans
  // +29 € EUR / ≈ 19 000 XOF
  prices: { EUR: 2900, XOF: 1900000, MAD: 32000, TND: 10000 },
};

export const PAID_PLANS: PlanTier[] = ['essential', 'premium'];

export function isPaidPlan(value: string): value is PlanTier {
  return value === 'essential' || value === 'premium';
}

export function isCurrency(value: string): value is Currency {
  return value === 'EUR' || value === 'XOF' || value === 'MAD' || value === 'TND';
}

export function getPlanPrice(plan: PlanTier, currency: Currency): number {
  return PLANS[plan].prices[currency];
}

export function getUpsellPrice(currency: Currency): number {
  return POST_EVENT_UPSELL.prices[currency];
}

export function getGalleryRetentionDays(plan: PlanTier): number {
  return PLANS[plan].galleryRetentionDays;
}

/**
 * Computes the gallery expiry timestamp for a given event start date and plan.
 * Used by `convex/payments.markSucceeded` to set `events.galleryExpiresAt` when
 * a one-shot purchase succeeds. The post-event upsell extends this further (5y).
 */
export function computeGalleryExpiresAt(eventDateMs: number, plan: PlanTier): number {
  const days = getGalleryRetentionDays(plan);
  return eventDateMs + days * 24 * 60 * 60 * 1000;
}

export function computeGalleryExpiresAtAfterUpsell(eventDateMs: number): number {
  return eventDateMs + POST_EVENT_UPSELL.galleryRetentionDays * 24 * 60 * 60 * 1000;
}

const FORMATTER_BY_CURRENCY: Record<Currency, Intl.NumberFormat> = {
  EUR: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }),
  XOF: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }),
  MAD: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD' }),
  TND: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND' }),
};

const MINOR_UNIT_DIVISOR: Record<Currency, number> = {
  EUR: 100,
  XOF: 100, // we store XOF in centimes for consistency even though XOF is normally not subdivided
  MAD: 100,
  TND: 1000, // millimes
};

export function formatAmount(minor: number, currency: Currency): string {
  const value = minor / MINOR_UNIT_DIVISOR[currency];
  return FORMATTER_BY_CURRENCY[currency].format(value);
}

/**
 * Stripe Price IDs des plans particuliers (one-shot), résolus par devise.
 *
 * Convention env vars :
 *   STRIPE_PRICE_<PLAN>_<CURRENCY>   (ex. STRIPE_PRICE_ESSENTIAL_MAD)
 *   STRIPE_PRICE_<PLAN>              (alias EUR pour rétro-compat env)
 *
 * Devise XOF : non supportée par Stripe (Stripe rejette la création d'un Price
 * en XOF). Le routage CinetPay s'occupe de XOF — la fonction renvoie
 * `undefined` pour cette devise (le driver Stripe ne devrait jamais être
 * appelé avec XOF, mais on conserve un comportement défensif).
 *
 * Optionnel — si l'env var n'est pas définie, le driver Stripe peut tomber
 * sur `price_data` à la volée. Préférer toujours les Price IDs stables pour
 * pouvoir changer les tarifs sans déploiement (cf. scripts/sync-stripe-prices.ts).
 */
export function priceIdForPlan(plan: PlanTier, currency: Currency = 'EUR'): string | undefined {
  if (currency === 'XOF') return undefined;
  const planUpper = plan.toUpperCase();
  const currencyEnvName = `STRIPE_PRICE_${planUpper}_${currency}` as const;
  const currencyValue = process.env[currencyEnvName];
  if (currencyValue) return currencyValue;
  if (currency === 'EUR') {
    const legacyName = `STRIPE_PRICE_${planUpper}` as const;
    return process.env[legacyName];
  }
  return undefined;
}

export function priceIdForPostEventUpsell(currency: Currency = 'EUR'): string | undefined {
  if (currency === 'XOF') return undefined;
  const currencyEnvName = `STRIPE_PRICE_POST_EVENT_UPSELL_${currency}` as const;
  const currencyValue = process.env[currencyEnvName];
  if (currencyValue) return currencyValue;
  if (currency === 'EUR') return process.env.STRIPE_PRICE_POST_EVENT_UPSELL;
  return undefined;
}
