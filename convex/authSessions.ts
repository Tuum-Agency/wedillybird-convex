import { v } from 'convex/values';
import { internalQuery, mutation } from './_generated/server';
import { assertWebhookSecret } from './lib/webhookSecret';
import { hashSessionToken, resolveSession } from './lib/verifiedSession';

/**
 * Cycle de vie des sessions vérifiables côté Convex (table `authSessions`).
 *
 * Émission : Next dérive un token opaque à partir du cookie de session signé
 * (`lib/auth/convex-token.ts`) puis appelle `ensure` — protégé par le secret
 * partagé Vercel↔Convex, comme les bridges webhook existants. Convex ne voit
 * jamais le `SESSION_SECRET` de Next, et ne stocke que le SHA-256 du token.
 *
 * Révocation : `revokeAllForUser` invalide toutes les sessions d'un compte
 * (déconnexion, suspension admin, changement de rôle). Une ligne révoquée
 * n'est jamais ressuscitée par `ensure` — sinon la dérivation déterministe
 * rendrait la révocation inopérante. Une nouvelle connexion produit un cookie
 * avec un `issuedAt` neuf, donc un token neuf, donc une nouvelle ligne.
 */

const TTL_MS = {
  /** Aligné sur le maxAge du cookie httpOnly (30 j). */
  server: 60 * 60 * 24 * 30 * 1000,
  /** Court : ce token-là est lisible par le JS du navigateur. */
  client: 60 * 60 * 1000,
} as const;

/** En deçà, on ne réécrit pas `expiresAt` (cf. `ensure`). */
const RENEW_THRESHOLD_MS = 5 * 60 * 1000;

export const ensure = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id('users'),
    kind: v.union(v.literal('server'), v.literal('client')),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertWebhookSecret(args.secret);

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    const tokenHash = await hashSessionToken(args.sessionToken);
    const now = Date.now();
    const expiresAt = now + TTL_MS[args.kind];

    const existing = await ctx.db
      .query('authSessions')
      .withIndex('by_token_hash', (q) => q.eq('tokenHash', tokenHash))
      .first();

    if (existing) {
      // Ne jamais ressusciter une session révoquée (cf. en-tête de fichier).
      if (existing.revokedAt !== undefined) throw new Error('SESSION_REVOKED');
      // Écriture seulement si la prolongation est significative : toute
      // écriture ici invaliderait les `useQuery` abonnées qui lisent cette
      // ligne pour résoudre l'identité. Inutile de les réveiller pour
      // quelques secondes de TTL supplémentaires.
      if (expiresAt - existing.expiresAt > RENEW_THRESHOLD_MS) {
        await ctx.db.patch(existing._id, { expiresAt });
        return { ok: true as const, expiresAt };
      }
      return { ok: true as const, expiresAt: existing.expiresAt };
    }

    await ctx.db.insert('authSessions', {
      tokenHash,
      userId: args.userId,
      kind: args.kind,
      createdAt: now,
      expiresAt,
    });
    return { ok: true as const, expiresAt };
  },
});

export const revokeAllForUser = mutation({
  args: { userId: v.id('users'), secret: v.string() },
  handler: async (ctx, args) => {
    assertWebhookSecret(args.secret);
    const now = Date.now();
    const sessions = await ctx.db
      .query('authSessions')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();
    let revoked = 0;
    for (const session of sessions) {
      if (session.revokedAt !== undefined) continue;
      await ctx.db.patch(session._id, { revokedAt: now });
      revoked++;
    }
    return { ok: true as const, revoked };
  },
});

/* -------------------------------------------------------------------------- */
/*  Résolution pour les actions (pas de `ctx.db` dans un ActionCtx)            */
/* -------------------------------------------------------------------------- */

export const resolveUserId = internalQuery({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const session = await resolveSession(ctx, sessionToken);
    return session ? session.userId : null;
  },
});

export const resolveAdminUserId = internalQuery({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const session = await resolveSession(ctx, sessionToken);
    if (!session) return null;
    const user = await ctx.db.get(session.userId);
    if (!user) return null;
    if (user.role !== 'admin') throw new Error('FORBIDDEN');
    return session.userId;
  },
});
