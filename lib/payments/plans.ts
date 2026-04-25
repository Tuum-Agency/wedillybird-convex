export type PlanTier = 'free' | 'essential' | 'premium';
export type PaidPlanTier = Exclude<PlanTier, 'free'>;
export type Currency = 'EUR' | 'XOF' | 'MAD' | 'TND';

export interface PlanDefinition {
  tier: PlanTier;
  maxGuests: number;
  prices: Record<Currency, number>; // amount in minor units (cents, sub-units)
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    tier: 'free',
    maxGuests: 30,
    prices: { EUR: 0, XOF: 0, MAD: 0, TND: 0 },
  },
  essential: {
    tier: 'essential',
    maxGuests: 150,
    prices: { EUR: 4900, XOF: 3200000, MAD: 53000, TND: 16500 },
  },
  premium: {
    tier: 'premium',
    maxGuests: 1000,
    prices: { EUR: 11900, XOF: 7800000, MAD: 129000, TND: 40000 },
  },
};

export const PAID_PLANS: PaidPlanTier[] = ['essential', 'premium'];

export function isPaidPlan(value: string): value is PaidPlanTier {
  return value === 'essential' || value === 'premium';
}

export function isCurrency(value: string): value is Currency {
  return value === 'EUR' || value === 'XOF' || value === 'MAD' || value === 'TND';
}

export function getPlanPrice(plan: PaidPlanTier, currency: Currency): number {
  return PLANS[plan].prices[currency];
}

export function getPlanMaxGuests(plan: PlanTier): number {
  return PLANS[plan].maxGuests;
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
