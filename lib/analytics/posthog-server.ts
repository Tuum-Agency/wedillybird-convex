import 'server-only';
import { PostHog } from 'posthog-node';
import { EVENTS, type AnalyticsEventName } from './events';

/**
 * Couche analytics PostHog CÔTÉ SERVEUR (Node SDK).
 *
 * À utiliser pour les conversions critiques qui DOIVENT être fiables même si le
 * JS client est bloqué (adblock, no-JS) : `purchase_completed` (webhook Stripe),
 * `checkout_started` (route checkout), signup serveur…
 *
 * `distinctId` DOIT être l'`userId` Convex : le client appelle
 * `posthog.identify(userId)`, donc les events serveur (distinctId = userId) se
 * rattachent à la même personne → funnel client + serveur unifié.
 */

let client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host:
        process.env.POSTHOG_HOST ??
        process.env.NEXT_PUBLIC_POSTHOG_HOST ??
        'https://us.i.posthog.com',
      // Fonctions serverless courtes : flush immédiat, pas de batch.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/**
 * Capture un event serveur puis force le flush (l'instance étant réutilisée en
 * Fluid Compute, on `flush()` plutôt que `shutdown()` pour garder le client
 * vivant). N'échoue jamais : l'analytics ne doit pas casser le chemin métier.
 *
 * Person-props : passer `properties.$set` pour mettre à jour le profil
 * (ex. `{ $set: { plan_tier: 'premium' } }`).
 */
export async function captureServer(args: {
  distinctId: string;
  event: AnalyticsEventName | string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  const ph = getClient();
  if (!ph || !args.distinctId) return;
  try {
    ph.capture({ distinctId: args.distinctId, event: args.event, properties: args.properties });
    await ph.flush();
  } catch {
    /* no-op — l'analytics ne doit jamais casser le chemin de paiement */
  }
}

export { EVENTS };
