/**
 * Canonical pricing grid — Wedillybird (avril 2026).
 *
 * Source de vérité : `.context/redesign-direction.md` (section "Pricing figé")
 * et CLAUDE.md.
 *
 * Particuliers : paiement one-shot, 2 plans + 1 upsell post-mariage.
 * Pas de tier gratuit. Pas de quota d'invitations particuliers (capacity-based
 * → features-based, cf. spec).
 *
 * **EUR est la source unique** — tous les autres montants (USD, XOF, MAD, TND)
 * sont dérivés via `convertFromEur` (cf. `lib/payments/currency.ts`). Pas
 * d'overlay régional, pas de pricing spécial Afrique : un mariage à 19 € reste
 * 19 € converti pour tout le monde, partout. L'utilisateur peut overrider la
 * devise d'affichage via le sélecteur footer (cf. `stores/currency-store.ts`).
 *
 * Multi-devises : EUR + USD via Stripe, XOF via CinetPay, MAD/TND via Stripe.
 * Les Stripe Prices stables sont nommés `STRIPE_PRICE_<PLAN>_<CURRENCY>` (ex.
 * STRIPE_PRICE_ESSENTIAL_MAD, STRIPE_PRICE_PREMIUM_USD). Le suffix sans devise
 * (`STRIPE_PRICE_ESSENTIAL`) reste un alias EUR pour rétro-compat env.
 */

import { convertFromEur, MINOR_UNIT_DIVISOR, pricesFromEur } from './currency';

export type PlanTier = 'essential' | 'premium';
export type Currency = 'EUR' | 'USD' | 'XOF' | 'MAD' | 'TND';

export interface PlanDefinition {
  tier: PlanTier;
  /** i18n keys (under `Plans.features.*`) listing what's included. */
  featureKeys: ReadonlyArray<string>;
  /** Days of gallery retention after event date. */
  galleryRetentionDays: number;
  /** Montant canonique en centimes d'euro — source de vérité. */
  eurMinor: number;
  /**
   * Table dérivée des prix par devise (en unités mineures). Calculée à partir
   * de `eurMinor` au chargement du module via `pricesFromEur`. Présente pour
   * la rétro-compatibilité des appelants existants (`PLANS[plan].prices.MAD`).
   */
  prices: Record<Currency, number>;
}

export interface PostEventUpsellDefinition {
  /** i18n keys for what the upsell unlocks. */
  featureKeys: ReadonlyArray<string>;
  /** New retention days post-mariage upsell (replaces the plan's default). */
  galleryRetentionDays: number;
  /** Montant canonique en centimes d'euro — source de vérité. */
  eurMinor: number;
  /** Table dérivée (cf. `PlanDefinition.prices`). */
  prices: Record<Currency, number>;
}

const ESSENTIAL_FEATURES = [
  'invitationPage',
  'qrCodes',
  'rsvpRealtime',
  'checkinOffline',
  'basicDashboard',
  'whatsappInvite',
  'guestReminders',
] as const;

const PREMIUM_EXTRA_FEATURES = [
  'gallerySharedExtended',
  'pdfAlbumFinal',
  'aiModeration',
  'faceSearch',
  'cinematicInvitation',
  'photoVariants',
  'galleryZipDownload',
] as const;

const ESSENTIAL_EUR = 1900; // 19 €
const PREMIUM_EUR = 5900; // 59 € (grille v2 — absorbe le coût SMS US)
const UPSELL_EUR = 2900; // +29 €

export const PLANS: Record<PlanTier, PlanDefinition> = {
  essential: {
    tier: 'essential',
    featureKeys: ESSENTIAL_FEATURES,
    galleryRetentionDays: 30,
    eurMinor: ESSENTIAL_EUR,
    prices: pricesFromEur(ESSENTIAL_EUR),
  },
  premium: {
    tier: 'premium',
    featureKeys: [...ESSENTIAL_FEATURES, ...PREMIUM_EXTRA_FEATURES],
    galleryRetentionDays: 180,
    eurMinor: PREMIUM_EUR,
    prices: pricesFromEur(PREMIUM_EUR),
  },
};

export const POST_EVENT_UPSELL: PostEventUpsellDefinition = {
  featureKeys: ['galleryRetention5y', 'photoBookHd', 'exportHd'],
  galleryRetentionDays: 5 * 365, // 5 ans
  eurMinor: UPSELL_EUR,
  prices: pricesFromEur(UPSELL_EUR),
};

export const PAID_PLANS: PlanTier[] = ['essential', 'premium'];

export function isPaidPlan(value: string): value is PlanTier {
  return value === 'essential' || value === 'premium';
}

export function isCurrency(value: string): value is Currency {
  return (
    value === 'EUR' || value === 'USD' || value === 'XOF' || value === 'MAD' || value === 'TND'
  );
}

export function getPlanPrice(plan: PlanTier, currency: Currency): number {
  return convertFromEur(PLANS[plan].eurMinor, currency);
}

export function getUpsellPrice(currency: Currency): number {
  return convertFromEur(POST_EVENT_UPSELL.eurMinor, currency);
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
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
  XOF: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }),
  MAD: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD' }),
  TND: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND' }),
};

export function formatAmount(minor: number, currency: Currency): string {
  const value = minor / MINOR_UNIT_DIVISOR[currency];
  return FORMATTER_BY_CURRENCY[currency].format(value);
}

/**
 * Convenience : prend un montant **en centimes d'euro**, le convertit dans la
 * devise cible et renvoie une chaîne formatée. Utilisé partout dans l'UI où
 * l'on part d'un prix canonique EUR.
 */
export function formatEurAs(eurMinor: number, currency: Currency): string {
  return formatAmount(convertFromEur(eurMinor, currency), currency);
}

/**
 * Renvoie une valeur CSS `font-size` (via `clamp`) adaptée à la longueur de la
 * chaîne de prix formatée. EUR/USD restent grands ; XOF/MAD/TND produisent
 * des nombres beaucoup plus longs (« 228 929 F CFA ») et doivent être réduits
 * pour ne pas déborder de la carte.
 *
 * Les chaînes formatées par `Intl.NumberFormat` contiennent des espaces
 * insécables (U+00A0, U+202F) qui empêchent le retour à la ligne mid-amount —
 * on ne peut donc pas compter sur `flex-wrap` pour absorber le débordement, il
 * faut rétrécir la police elle-même.
 *
 * Deux échelles : `card` (cards particuliers, md:grid-cols-2, plus large) et
 * `card-compact` (cards pros, md:grid-cols-3, plus serrée).
 */
export function priceFontSizeClamp(
  formatted: string,
  scale: 'card' | 'card-compact' = 'card',
): string {
  const len = formatted.length;
  if (scale === 'card') {
    if (len <= 8) return 'clamp(2.75rem, 5vw, 3.75rem)';
    if (len <= 11) return 'clamp(2rem, 3.6vw, 2.75rem)';
    return 'clamp(1.5rem, 2.8vw, 2rem)';
  }
  if (len <= 8) return 'clamp(2.5rem, 4vw, 3.25rem)';
  if (len <= 11) return 'clamp(1.85rem, 3vw, 2.5rem)';
  return 'clamp(1.4rem, 2.4vw, 1.85rem)';
}

/**
 * Stripe Price IDs des plans particuliers (one-shot), résolus par devise.
 *
 * Convention env vars :
 *   STRIPE_PRICE_<PLAN>_<CURRENCY>   (ex. STRIPE_PRICE_ESSENTIAL_MAD)
 *   STRIPE_PRICE_<PLAN>              (alias EUR pour rétro-compat env)
 *
 * Devises XOF et TND : non supportées par Stripe comme settlement currency.
 * Le routage CinetPay s'occupe de XOF et TND — la fonction renvoie `undefined`
 * pour ces devises (le driver Stripe ne devrait jamais être appelé avec XOF ou
 * TND, mais on conserve un comportement défensif).
 *
 * Optionnel — si l'env var n'est pas définie, le driver Stripe peut tomber
 * sur `price_data` à la volée. Préférer toujours les Price IDs stables pour
 * pouvoir changer les tarifs sans déploiement (cf. scripts/sync-stripe-prices.ts).
 */
export function priceIdForPlan(plan: PlanTier, currency: Currency = 'EUR'): string | undefined {
  if (currency === 'XOF' || currency === 'TND') return undefined;
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
  if (currency === 'XOF' || currency === 'TND') return undefined;
  const currencyEnvName = `STRIPE_PRICE_POST_EVENT_UPSELL_${currency}` as const;
  const currencyValue = process.env[currencyEnvName];
  if (currencyValue) return currencyValue;
  if (currency === 'EUR') return process.env.STRIPE_PRICE_POST_EVENT_UPSELL;
  return undefined;
}
