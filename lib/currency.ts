/**
 * Devise de **budget** (montants saisis par l'utilisateur : budget couple,
 * budget agence, prestataires). Choisie à l'onboarding, stockée sur le user
 * (`preferredCurrency`), l'organisation (`currency`) et l'event (`currency`).
 *
 * ⚠️ Distinct de la devise de **facturation** Stripe (`lib/payments/plans.ts`)
 * qui ne supporte en live que EUR/USD/MAD. Ici on formate de l'affichage, donc
 * on peut couvrir un panel plus large sans contrainte Stripe.
 */
export const BUDGET_CURRENCIES = ['EUR', 'USD', 'GBP', 'CAD', 'CHF', 'XOF', 'MAD', 'TND'] as const;
export type BudgetCurrency = (typeof BUDGET_CURRENCIES)[number];

export const DEFAULT_BUDGET_CURRENCY: BudgetCurrency = 'EUR';

const SYMBOLS: Record<BudgetCurrency, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CAD: 'CA$',
  CHF: 'CHF',
  XOF: 'FCFA',
  MAD: 'MAD',
  TND: 'TND',
};

export function currencySymbol(c: BudgetCurrency): string {
  return SYMBOLS[c] ?? c;
}

export function isBudgetCurrency(x: unknown): x is BudgetCurrency {
  return typeof x === 'string' && (BUDGET_CURRENCIES as readonly string[]).includes(x);
}

/** Coerce une valeur arbitraire en devise valide (fallback EUR). */
export function asBudgetCurrency(x: unknown): BudgetCurrency {
  return isBudgetCurrency(x) ? x : DEFAULT_BUDGET_CURRENCY;
}

/** Montant en unité majeure (ex. 22000) → « 22 000 $ » selon la locale. */
export function formatMoneyMajor(
  amount: number,
  currency: BudgetCurrency = DEFAULT_BUDGET_CURRENCY,
  locale = 'fr-FR',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/** Montant en centimes (minor units) → chaîne formatée, ou « — » si null. */
export function formatMoneyMinor(
  minor: number | null | undefined,
  currency: BudgetCurrency = DEFAULT_BUDGET_CURRENCY,
  locale = 'fr-FR',
): string {
  if (minor == null) return '—';
  return formatMoneyMajor(minor / 100, currency, locale);
}

/** Nom localisé de la devise (ex. « US Dollar », « Euro »). */
export function currencyName(c: BudgetCurrency, locale = 'en'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'currency' }).of(c) ?? c;
  } catch {
    return c;
  }
}

/** Devise par défaut suggérée selon la locale (modifiable par l'utilisateur). */
export function currencyForLocale(locale: string): BudgetCurrency {
  const map: Record<string, BudgetCurrency> = {
    en: 'USD',
    fr: 'EUR',
    es: 'EUR',
    it: 'EUR',
    pt: 'EUR',
    de: 'EUR',
    ar: 'MAD',
  };
  return map[locale.split('-')[0]!] ?? DEFAULT_BUDGET_CURRENCY;
}

/** Options prêtes pour un <Select> : « US Dollar ($) », etc. */
export function currencyOptions(
  locale = 'en',
): ReadonlyArray<{ value: BudgetCurrency; label: string }> {
  return BUDGET_CURRENCIES.map((c) => ({
    value: c,
    label: `${currencyName(c, locale)} (${currencySymbol(c)})`,
  }));
}
