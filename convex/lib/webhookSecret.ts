/**
 * Garde partagée des bridges webhook Convex.
 *
 * Vérifie le secret partagé `CONVEX_WEBHOOK_SECRET` (posé À LA FOIS côté Vercel
 * — env Next — ET côté Convex). Ces mutations restent PUBLIQUES parce que les
 * routes webhook les appellent via `ConvexHttpClient`, qui ne peut pas invoquer
 * d'`internalMutation`. Le secret est donc leur seule barrière contre un appel
 * direct à `*.convex.cloud` : la signature Stripe/Meta est vérifiée à la
 * frontière API, ce secret est la seconde ligne de défense.
 *
 * Pas de fallback silencieux : si l'env n'est pas configurée, on rejette TOUT
 * (ne jamais retomber dans le bug F-01 où un appelant anonyme pouvait marquer
 * un paiement encaissé / créditer une org sans jamais payer).
 *
 * C'est la version partagée du contrôle déjà présent, dupliqué, dans
 * `budget.ts`, `paymentLinks.ts` et `organizations.ts` (à migrer vers ici).
 */
export function assertWebhookSecret(secret: string): void {
  const expected = process.env.CONVEX_WEBHOOK_SECRET;
  if (!expected) throw new Error('WEBHOOK_SECRET_NOT_CONFIGURED');
  if (secret !== expected) throw new Error('INVALID_WEBHOOK_SECRET');
}
