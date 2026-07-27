/**
 * Remise « communauté » d'un code partenaire — logique PURE (app-side).
 *
 * Un affilié `partner` (créateur/planner) peut accorder une remise à SON audience
 * (`buyerDiscountBps`, posé en admin). Cette fonction en calcule le montant en
 * centimes au checkout : `buyerDiscountBps × prix / 10000`, arrondi, borné
 * `[0, orderMinor]` (jamais plus que le prix).
 *
 * C'est DISTINCT du crédit de parrainage (la cagnotte perso d'un filleul, gérée
 * côté Convex). Les deux se cumulent dans un unique coupon Stripe `amount_off`
 * (Stripe n'accepte qu'un coupon par session).
 *
 * Miroir app-side de la convention « basis points » de `convex/lib/affiliate.ts`
 * (`rewardMinor`) : les deux projets tsconfig (`app` ⇄ `convex`) ne peuvent pas
 * s'importer, d'où cette petite duplication — même parti pris que la
 * réconciliation dupliquée entre `lib/payments/reconcile.ts` et `convex/payments.ts`.
 */
export function affiliateBuyerDiscountMinor(orderMinor: number, buyerDiscountBps: number): number {
  if (!Number.isFinite(orderMinor) || !Number.isFinite(buyerDiscountBps)) return 0;
  if (orderMinor <= 0 || buyerDiscountBps <= 0) return 0;
  return Math.min(Math.round((orderMinor * buyerDiscountBps) / 10000), orderMinor);
}
