import { v } from 'convex/values';
import { query } from './_generated/server';

/**
 * Health-check indépendant du money-path (T2-1, plan de lancement).
 *
 * Le webhook (`app/api/webhooks/[provider]/route.ts`) et le filet de la page
 * success (`upgrade/success/page.tsx`) partagent le même
 * `getConvexServerClient()` + `CONVEX_WEBHOOK_SECRET` — une dérive de config
 * (ex. `NEXT_PUBLIC_CONVEX_URL` qui pointe encore sur dev en prod, précédent
 * exact du bug Lambda Moderation du 2026-05-23) casse les deux identiquement,
 * en silence, jusqu'au premier paiement perdu.
 *
 * Cette **query** (jamais une mutation : aucun effet de bord, rien à
 * autoriser côté DB) fait faire l'aller-retour au secret : Vercel envoie sa
 * copie de `CONVEX_WEBHOOK_SECRET`, Convex compare à SA copie. Un mismatch
 * (ou une env absente d'un côté) prouve la dérive AVANT qu'un vrai paiement
 * ne la découvre. Volontairement PUBLIQUE — un round-trip de secret ne fuit
 * rien (booléen seul, jamais la valeur), donc pas besoin de la gate
 * `assertWebhookSecret` réservée au mutations money-path.
 *
 * Appelée par `app/api/health/webhook-secret/route.ts`, qui vérifie EN PLUS
 * `NEXT_PUBLIC_CONVEX_URL` côté Vercel (cf. `lib/convex-deployment.ts`).
 */
export const verifyWebhookSecret = query({
  args: { secret: v.string() },
  handler: async (_ctx, { secret }) => {
    const expected = process.env.CONVEX_WEBHOOK_SECRET;
    if (!expected) {
      return { ok: false as const, reason: 'NOT_CONFIGURED' as const };
    }
    if (secret !== expected) {
      return { ok: false as const, reason: 'MISMATCH' as const };
    }
    return { ok: true as const };
  },
});
