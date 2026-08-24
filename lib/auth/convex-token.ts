import 'server-only';
import { getSession, type SessionPayload } from './session';

/**
 * Pont d'identité Next → Convex.
 *
 * Convex ne peut pas lire le cookie httpOnly : on lui présente donc un
 * `sessionToken` opaque, dérivé **déterministiquement** du cookie déjà vérifié
 * (HMAC-SHA256 avec `SESSION_SECRET`, que Convex ne connaît pas).
 *
 * Déterministe = aucun aller-retour ni écriture DB à chaque appel : le même
 * cookie redonne toujours le même token, dont Convex a déjà la ligne. La ligne
 * n'est (re)créée que par `ensureConvexSession`, appelé à la connexion puis en
 * rattrapage quand Convex répond `UNAUTHENTICATED` (cf. `convex-server.ts`).
 *
 * Deux porteurs distincts, jamais interchangeables :
 *  - `server` : reste côté serveur (server actions, route handlers).
 *  - `client` : remis au JS du navigateur pour les appels Convex directs, TTL
 *    court côté Convex. Il ne permet PAS de s'authentifier auprès de Next (il
 *    n'est pas le cookie), ce qui borne l'impact d'un vol par XSS.
 */

export type ConvexSessionKind = 'server' | 'client';

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set and >= 32 chars');
  }
  return secret;
}

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Dérive le token Convex d'une session. Lié à `userId` ET `issuedAt` : une
 * reconnexion (nouveau cookie) produit un token neuf, ce qui évite de
 * ressusciter une session révoquée côté Convex.
 */
export async function deriveConvexToken(
  session: SessionPayload,
  kind: ConvexSessionKind,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const material = `convex-session:v1:${kind}:${session.userId}:${session.issuedAt}`;
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(material));
  return toHex(new Uint8Array(signature));
}

/**
 * Token Convex de la session courante, ou `null` si non connecté.
 * Ne garantit pas que la ligne existe côté Convex — c'est le rôle de
 * `ensureConvexSession` / du rattrapage automatique.
 */
export async function getConvexToken(kind: ConvexSessionKind = 'server'): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  return deriveConvexToken(session, kind);
}

/**
 * Comme {@link getConvexToken} mais throw `UNAUTHENTICATED` — pour les server
 * actions qui exigent déjà une session.
 */
export async function requireConvexToken(
  kind: ConvexSessionKind = 'server',
): Promise<{ session: SessionPayload; sessionToken: string }> {
  const session = await getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return { session, sessionToken: await deriveConvexToken(session, kind) };
}
