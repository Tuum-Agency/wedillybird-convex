import { v } from 'convex/values';

/**
 * Validateur Convex pour la devise de **budget** (montants saisis par
 * l'utilisateur). Source de vérité partagée par le schéma et les mutations.
 * Doit rester aligné sur `BUDGET_CURRENCIES` dans `lib/currency.ts` (front).
 * Distinct de la devise de facturation Stripe.
 */
export const BUDGET_CURRENCY = v.union(
  v.literal('EUR'),
  v.literal('USD'),
  v.literal('GBP'),
  v.literal('CAD'),
  v.literal('CHF'),
  v.literal('XOF'),
  v.literal('MAD'),
  v.literal('TND'),
);
