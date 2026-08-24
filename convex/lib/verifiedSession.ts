import { v } from 'convex/values';
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
/*  Fenêtre de compatibilité (transitoire — à supprimer après bascule prod)     */
/* -------------------------------------------------------------------------- */

/**
 * Convex et Vercel se déploient indépendamment : il existe donc une fenêtre où
 * le front encore en production envoie l'ancien `requesterId` alors que Convex
 * exige déjà `sessionToken` (et inversement). Comme Convex **rejette** tout
 * argument non déclaré, cette désynchronisation casserait chaque appel
 * authentifié.
 *
 * Ces validateurs acceptent les deux formes le temps de la bascule. Ils sont
 * volontairement `optional` des deux côtés — c'est {@link requireUserIdCompat}
 * qui impose qu'au moins une identité exploitable soit présente.
 *
 * À retirer dès que la prod sert le nouveau front (voir le plan de bascule dans
 * la PR de la fenêtre de compatibilité).
 */
export const IDENTITY_ARGS = {
  sessionToken: v.optional(v.string()),
  /** @deprecated fenêtre de compat — identité NON vérifiée, retirée après bascule. */
  requesterId: v.optional(v.id('users')),
  /** @deprecated idem, pour les fonctions d'administration. */
  adminId: v.optional(v.id('users')),
} as const;

export interface CompatIdentityArgs {
  sessionToken?: string;
  requesterId?: Id<'users'>;
  adminId?: Id<'users'>;
}

/**
 * `true` tant que la fenêtre de compatibilité est ouverte. Piloté par une
 * variable d'environnement Convex — **pas** par un déploiement de code : couper
 * la fenêtre est donc immédiat et réversible, sans attendre un build.
 *
 * Par défaut : fermée. Un environnement qui ne pose pas la variable n'accepte
 * QUE l'identité vérifiée, ce qui est le comportement sûr.
 */
function legacyWindowOpen(): boolean {
  return process.env.LEGACY_IDENTITY_WINDOW === '1';
}

/**
 * Identité de l'appelant pendant la bascule.
 *
 * Ordre strict : un `sessionToken` valide l'emporte TOUJOURS. On ne retombe sur
 * l'identité auto-déclarée que si aucun jeton n'est fourni **et** que la fenêtre
 * est explicitement ouverte — jamais en cas de jeton invalide, sinon il
 * suffirait d'envoyer un jeton bidon accompagné du `requesterId` de sa cible
 * pour contourner la vérification.
 */
export async function requireUserIdCompat(
  ctx: ReadCtx,
  args: CompatIdentityArgs,
): Promise<Id<'users'>> {
  if (args.sessionToken !== undefined) return requireUserId(ctx, args.sessionToken);
  if (legacyWindowOpen()) {
    const legacy = args.requesterId ?? args.adminId;
    if (legacy) return legacy;
  }
  throw new Error('UNAUTHENTICATED');
}

/** Variante « appelant optionnel » (surfaces mixtes invité/connecté). */
export async function optionalUserIdCompat(
  ctx: ReadCtx,
  args: CompatIdentityArgs,
): Promise<Id<'users'> | null> {
  if (args.sessionToken !== undefined) return optionalUserId(ctx, args.sessionToken);
  if (legacyWindowOpen()) return args.requesterId ?? args.adminId ?? null;
  return null;
}

/**
 * Variante admin. Le rôle est TOUJOURS revérifié en base, y compris sur le
 * chemin hérité : c'est ce contrôle-là qui manquait avant l'audit.
 */
export async function requireAdminCompat(
  ctx: ReadCtx,
  args: CompatIdentityArgs,
): Promise<Doc<'users'>> {
  const userId = await requireUserIdCompat(ctx, args);
  const user = await ctx.db.get(userId);
  if (!user) throw new Error('UNAUTHENTICATED');
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

/**
 * Variantes « fenêtre de compatibilité » pour les actions. Même règle que
 * {@link requireUserIdCompat} : un jeton présent est toujours vérifié, le
 * repli hérité ne joue qu'en son absence et fenêtre ouverte.
 */
export async function requireUserIdFromActionCompat(
  ctx: ActionCtx,
  args: CompatIdentityArgs,
): Promise<Id<'users'>> {
  if (args.sessionToken !== undefined) return requireUserIdFromAction(ctx, args.sessionToken);
  if (legacyWindowOpen()) {
    const legacy = args.requesterId ?? args.adminId;
    if (legacy) return legacy;
  }
  throw new Error('UNAUTHENTICATED');
}

export async function requireAdminIdFromActionCompat(
  ctx: ActionCtx,
  args: CompatIdentityArgs,
): Promise<Id<'users'>> {
  if (args.sessionToken !== undefined) return requireAdminIdFromAction(ctx, args.sessionToken);
  if (legacyWindowOpen()) {
    const legacy = args.adminId ?? args.requesterId;
    // Le rôle reste vérifié en base, jamais déduit de l'argument.
    if (legacy) {
      const ok = await ctx.runQuery(internal.authSessions.isAdminUserId, { userId: legacy });
      if (ok) return legacy;
      throw new Error('FORBIDDEN');
    }
  }
  throw new Error('UNAUTHENTICATED');
}
