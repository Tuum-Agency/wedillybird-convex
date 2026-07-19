import 'server-only';
import { NextResponse } from 'next/server';

/**
 * Défense CSRF pour les Route Handlers `app/api/*` mutatifs authentifiés par
 * cookie de session.
 *
 * Contexte : le cookie de session est `sameSite: 'lax'`, ce qui ne bloque pas
 * tous les scénarios cross-site. Les **Server Actions** Next 16 vérifient déjà
 * nativement Origin/Host ; les **webhooks** (`/api/webhooks/*`) sont exemptés
 * (cross-origin par nature, protégés par signature). Il reste les Route
 * Handlers POST authentifiés (liaison de compte, checkout, sync check-in).
 *
 * Règle : on refuse une requête dont l'en-tête `Origin` est présent ET dont
 * l'hôte diffère de celui de la requête. Un POST CSRF déclenché depuis un site
 * tiers porte toujours l'`Origin` de l'attaquant (le navigateur l'ajoute sur
 * toute requête cross-origin) → mismatch → 403. Une requête same-origin
 * (y compris depuis un sous-domaine tenant, qui poste vers son propre hôte)
 * porte un `Origin` identique à son `Host` → OK. `Origin` absent (client non
 * navigateur, health-check) → toléré pour ne pas casser les intégrations.
 *
 * Retourne une `Response` 403 à renvoyer telle quelle si l'origine est refusée,
 * sinon `null` (la requête peut continuer).
 */
export function assertSameOrigin(request: Request): Response | null {
  const origin = request.headers.get('origin');
  // Pas d'Origin : aucune attaque CSRF navigateur cross-site possible sans lui.
  if (!origin) return null;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ error: 'CROSS_ORIGIN_FORBIDDEN' }, { status: 403 });
  }

  // Sur Vercel, l'hôte public arrive dans `x-forwarded-host` ; en local c'est
  // `host`. On compare l'hôte de l'Origin à l'hôte réellement servi.
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (host && originHost === host) return null;

  return NextResponse.json({ error: 'CROSS_ORIGIN_FORBIDDEN' }, { status: 403 });
}
