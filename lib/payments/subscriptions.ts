export type SubscriptionTier = 'starter' | 'business' | 'agency';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';

export const SUBSCRIPTION_TIER_PRICES: Record<
  SubscriptionTier,
  {
    amountMinor: number;
    currency: 'EUR';
    label: string;
    description: string;
    features: readonly string[];
  }
> = {
  starter: {
    amountMinor: 2900,
    currency: 'EUR',
    label: 'Starter',
    description: 'Pour planificateurs en démarrage',
    features: [
      "Jusqu'à 5 événements actifs",
      'Branding minimal (logo + couleur)',
      'Support email sous 48h',
    ],
  },
  business: {
    amountMinor: 7900,
    currency: 'EUR',
    label: 'Business',
    description: 'Pour agences confirmées',
    features: [
      'Événements illimités',
      'Branding complet (logo, couleurs, typographie)',
      "Gestion d'équipe (jusqu'à 10 membres)",
      'Support prioritaire',
    ],
  },
  agency: {
    amountMinor: 19900,
    currency: 'EUR',
    label: 'Agency',
    description: 'Pour grandes agences multi-marques',
    features: [
      'Tout Business +',
      'Sous-domaines branded (multi-tenant)',
      'Account manager dédié',
      'SLA contractuel 99.9%',
    ],
  },
};

export function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  return value === 'starter' || value === 'business' || value === 'agency';
}

export function priceIdForTier(tier: SubscriptionTier): string {
  const envName = `STRIPE_PRICE_${tier.toUpperCase()}` as const;
  const value = process.env[envName];
  if (!value) throw new Error(`MISSING_${envName}`);
  return value;
}

export function tierForPriceId(priceId: string): SubscriptionTier | null {
  if (priceId === process.env.STRIPE_PRICE_STARTER) return 'starter';
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return 'business';
  if (priceId === process.env.STRIPE_PRICE_AGENCY) return 'agency';
  return null;
}
