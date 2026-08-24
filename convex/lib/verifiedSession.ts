import type { Doc, Id } from '../_generated/dataModel';
import type { ActionCtx, MutationCtx, QueryCtx } from '../_generated/server';
import { internal } from '../_generated/api';

/**
 * Résolution d'identité **côté Convex**.
 *
 * Règle du projet depuis l'audit archi 2026-08-23 : une fonction publique ne
 * déduit JAMAIS l'appelant d'un `requesterId` / `userId` / `adminId` passé en
 * argument. Le déploiement Convex est joignable directement (l'URL est
 * publique, cf. `NEXT_PUBLIC_CONVEX_URL`), donc un tel argument n'est qu'une
 * affirmation du client, pas une preuve.
 *
 * À la place l'appelant présente un `sessionToken` opaque, émis par Next après
 * vérification du cookie de session signé, et dont seul le SHA-256 est stocké
 * (table `authSessions`). On re-résout l'identité ici, à chaque appel.
 *
 * Usage dans une query/mutation :
 * ```ts
 * export const add = mutation({
 *   args: { eventId: v.id('events'), sessionToken: v.string(), ... },
 *   handler: async (ctx, args) => {
 *     const requesterId = await requireUserId(ctx, args.sessionToken);
 *     const event = await assertEventAccess(ctx, args.eventId, requesterId, { write: true });
 *     ...
 *   },
 * });
 * ```
 *
 * Codes d'erreur (déjà mappés par les server actions Next) :
 *  - `UNAUTHENTICATED` : token absent, inconnu, expiré ou révoqué.
 *  - `FORBIDDEN`       : identité valide mais rôle insuffisant.
 */

type ReadCtx = QueryCtx | MutationCtx;

/**
 * SHA-256 hex. `crypto.subtle` est disponible dans le runtime par défaut de
 * Convex (déjà utilisé par `lib/otp.ts` depuis la mutation `verifyOtp`) : pas
 * besoin de `'use node'`.
 */
export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Résout la ligne de session valide pour ce token, ou `null`. Ne throw pas :
 * les appelants « optionnels » (surfaces publiques invité) s'en servent pour
 * distinguer visiteur anonyme et utilisateur connecté.
 */
export async function resolveSession(
  ctx: ReadCtx,
  sessionToken: string | undefined | null,
): Promise<Doc<'authSessions'> | null> {
  if (!sessionToken) return null;
  const tokenHash = await hashSessionToken(sessionToken);
  const session = await ctx.db
    .query('authSessions')
    .withIndex('by_token_hash', (q) => q.eq('tokenHash', tokenHash))
    .first();
  if (!session) return null;
  if (session.revokedAt !== undefined) return null;
  if (session.expiresAt <= Date.now()) return null;
  return session;
}

/** Identité de l'appelant, ou `null` s'il n'est pas authentifié. */
export async function optionalUserId(
  ctx: ReadCtx,
  sessionToken: string | undefined | null,
): Promise<Id<'users'> | null> {
  const session = await resolveSession(ctx, sessionToken);
  return session ? session.userId : null;
}

/** Identité de l'appelant. Throw `UNAUTHENTICATED` si la session est invalide. */
export async function requireUserId(
  ctx: ReadCtx,
  sessionToken: string | undefined | null,
): Promise<Id<'users'>> {
  const userId = await optionalUserId(ctx, sessionToken);
  if (!userId) throw new Error('UNAUTHENTICATED');
  return userId;
}

/**
 * Comme {@link requireUserId} mais renvoie le document utilisateur (évite un
 * second `ctx.db.get` quand l'appelant a besoin du rôle ou du plan).
 */
export async function requireUser(
  ctx: ReadCtx,
  sessionToken: string | undefined | null,
): Promise<Doc<'users'>> {
  const userId = await requireUserId(ctx, sessionToken);
  const user = await ctx.db.get(userId);
  // Session valide mais utilisateur supprimé : on refuse plutôt que de laisser
  // passer une identité fantôme.
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}

/**
 * Identité admin plateforme. Remplace l'ancien `assertAdmin(ctx, adminId)` qui
 * ne vérifiait que le rôle *du doc pointé par l'argument*, sans jamais établir
 * que l'appelant était bien cet admin.
 */
export async function requireAdmin(
  ctx: ReadCtx,
  sessionToken: string | undefined | null,
): Promise<Doc<'users'>> {
  const user = await requireUser(ctx, sessionToken);
  if (user.role !== 'admin') throw new Error('FORBIDDEN');
  return user;
}

/* -------------------------------------------------------------------------- */
/*  Variantes « action »                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Les actions n'ont pas accès à `ctx.db` : elles passent par une internalQuery
 * dédiée. Même contrat que {@link requireUserId}.
 */
export async function requireUserIdFromAction(
  ctx: ActionCtx,
  sessionToken: string | undefined | null,
): Promise<Id<'users'>> {
  if (!sessionToken) throw new Error('UNAUTHENTICATED');
  const userId = await ctx.runQuery(internal.authSessions.resolveUserId, { sessionToken });
  if (!userId) throw new Error('UNAUTHENTICATED');
  return userId;
}

/** Variante action de {@link requireAdmin}. */
export async function requireAdminIdFromAction(
  ctx: ActionCtx,
  sessionToken: string | undefined | null,
): Promise<Id<'users'>> {
  if (!sessionToken) throw new Error('UNAUTHENTICATED');
  const userId = await ctx.runQuery(internal.authSessions.resolveAdminUserId, { sessionToken });
  if (!userId) throw new Error('UNAUTHENTICATED');
  return userId;
}
