import { v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { requireAdmin } from './lib/verifiedSession';

/**
 * Conservé pour les fonctions INTERNES de ce module (`campaignContext`,
 * `createCampaign`), qui reçoivent un `adminId` déjà vérifié par leur
 * appelant. Les fonctions publiques passent par `requireAdmin`.
 */
async function assertAdmin(
  ctx: { db: { get: (id: Id<'users'>) => Promise<{ role: string } | null> } },
  adminId: Id<'users'>,
) {
  const u = await ctx.db.get(adminId);
  if (!u || u.role !== 'admin') throw new Error('FORBIDDEN: admin role required');
  return u;
}

/**
 * Newsletter subscribers — store-first MVP.
 *
 * `subscribe` est idempotente :
 *  - email inexistant → insert avec status='active'
 *  - email avec status='active' → no-op (return alreadyActive: true)
 *  - email avec status='unsubscribed' → réactivation (patch status + reset
 *    unsubscribedAt + nouveau subscribedAt)
 *
 * Email normalisé en lowercase trim côté Zod, mais on re-trim ici par
 * defense-in-depth (les writes Convex ne passent pas forcément par notre
 * validator — un script seed direct, par ex.).
 */

export const subscribe = mutation({
  args: {
    email: v.string(),
    source: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, { email, source, ipAddress }) => {
    const normalized = email.trim().toLowerCase();
    if (normalized.length === 0) {
      throw new Error('INVALID_EMAIL');
    }
    if (!normalized.includes('@')) {
      throw new Error('INVALID_EMAIL');
    }

    const now = Date.now();
    const existing = await ctx.db
      .query('newsletterSubscribers')
      .withIndex('by_email', (q) => q.eq('email', normalized))
      .first();

    if (!existing) {
      const id = await ctx.db.insert('newsletterSubscribers', {
        email: normalized,
        status: 'active',
        source,
        subscribedAt: now,
        ipAddress,
      });
      return { id, alreadyActive: false as const, reactivated: false as const };
    }

    if (existing.status === 'active') {
      return { id: existing._id, alreadyActive: true as const, reactivated: false as const };
    }

    // status === 'unsubscribed' → réactivation
    await ctx.db.patch(existing._id, {
      status: 'active',
      subscribedAt: now,
      unsubscribedAt: undefined,
      source: source ?? existing.source,
      ipAddress: ipAddress ?? existing.ipAddress,
    });
    return { id: existing._id, alreadyActive: false as const, reactivated: true as const };
  },
});

/**
 * Soft-unsubscribe : flip le status à 'unsubscribed' et store le timestamp.
 * Pas exposé publiquement pour le moment (pas de page /unsubscribe). Sera
 * appelé depuis le lien dans les emails de campagne quand on les enverra.
 */
export const unsubscribe = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.trim().toLowerCase();
    const existing = await ctx.db
      .query('newsletterSubscribers')
      .withIndex('by_email', (q) => q.eq('email', normalized))
      .first();

    if (!existing) return { ok: true as const, found: false as const };
    if (existing.status === 'unsubscribed') return { ok: true as const, found: true as const };

    await ctx.db.patch(existing._id, {
      status: 'unsubscribed',
      unsubscribedAt: Date.now(),
    });
    return { ok: true as const, found: true as const };
  },
});

/**
 * Liste les abonnés actifs — pour usage admin futur (campagnes email).
 * Pour l'instant pas exposé via une page UI, mais la requête est là pour
 * le moment où on en aura besoin.
 */
export const listActive = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const subscribers = await ctx.db
      .query('newsletterSubscribers')
      .withIndex('by_status_subscribedAt', (q) => q.eq('status', 'active'))
      .order('desc')
      .take(limit ?? 500);

    return subscribers.map((s) => ({
      _id: s._id,
      email: s.email,
      source: s.source,
      subscribedAt: s.subscribedAt,
    }));
  },
});

export const countActive = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query('newsletterSubscribers')
      .withIndex('by_status_subscribedAt', (q) => q.eq('status', 'active'))
      .collect();
    return { total: all.length };
  },
});

/* -------------------------------------------------------------------------- */
/*  Campagnes — composées et envoyées depuis l'admin via SES.                  */
/*  L'envoi réel se fait dans l'action `emailActions:sendNewsletterCampaign`   */
/*  (runtime node) ; ici on fournit le contexte + on enregistre le résultat.  */
/* -------------------------------------------------------------------------- */

/** Contexte d'envoi : email de l'admin (pour les tests) + emails actifs. Interne. */
export const campaignContext = internalQuery({
  args: { adminId: v.id('users') },
  handler: async (ctx, { adminId }) => {
    const admin = await assertAdmin(ctx, adminId);
    const subscribers = await ctx.db
      .query('newsletterSubscribers')
      .withIndex('by_status_subscribedAt', (q) => q.eq('status', 'active'))
      .collect();
    return {
      adminEmail: (admin as { email?: string }).email ?? null,
      emails: subscribers.map((s) => s.email),
    };
  },
});

export const createCampaign = internalMutation({
  args: {
    adminId: v.id('users'),
    subject: v.string(),
    bodyText: v.string(),
    totalRecipients: v.number(),
  },
  handler: async (ctx, { adminId, subject, bodyText, totalRecipients }) => {
    await assertAdmin(ctx, adminId);
    const id = await ctx.db.insert('newsletterCampaigns', {
      subject,
      bodyText,
      status: 'sending',
      totalRecipients,
      sentCount: 0,
      failedCount: 0,
      createdBy: adminId,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const finalizeCampaign = internalMutation({
  args: {
    campaignId: v.id('newsletterCampaigns'),
    sentCount: v.number(),
    failedCount: v.number(),
  },
  handler: async (ctx, { campaignId, sentCount, failedCount }) => {
    await ctx.db.patch(campaignId, {
      status: failedCount > 0 && sentCount === 0 ? 'failed' : 'sent',
      sentCount,
      failedCount,
      sentAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Historique des campagnes pour l'admin (plus récentes d'abord). */
export const listCampaigns = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    const campaigns = await ctx.db
      .query('newsletterCampaigns')
      .withIndex('by_createdAt')
      .order('desc')
      .take(50);
    return campaigns.map((c) => ({
      _id: c._id,
      subject: c.subject,
      status: c.status,
      totalRecipients: c.totalRecipients,
      sentCount: c.sentCount,
      failedCount: c.failedCount,
      createdAt: c.createdAt,
      sentAt: c.sentAt,
    }));
  },
});
