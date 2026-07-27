import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

const LIST_LIMIT = 30;
const MARK_SCAN_LIMIT = 200;

/**
 * Notifications récentes d'un utilisateur + compteur de non-lus. Réactif :
 * consommé via `useQuery` (la cloche se met à jour en direct à l'insertion).
 * `unread` est calculé sur la fenêtre récente (badge « 30+ » au-delà).
 */
export const listForUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_user_created', (q) => q.eq('userId', userId))
      .order('desc')
      .take(LIST_LIMIT);
    const unread = rows.filter((n) => n.readAt === undefined).length;
    return {
      unread,
      items: rows.map((n) => ({
        _id: n._id,
        type: n.type,
        eventId: n.eventId,
        data: n.data,
        link: n.link,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
    };
  },
});

export const markAllRead = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const now = Date.now();
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_user_created', (q) => q.eq('userId', userId))
      .order('desc')
      .take(MARK_SCAN_LIMIT);
    let marked = 0;
    for (const notif of rows) {
      if (notif.readAt === undefined) {
        await ctx.db.patch(notif._id, { readAt: now });
        marked++;
      }
    }
    return { ok: true as const, marked };
  },
});

export const markRead = mutation({
  args: { notificationId: v.id('notifications'), userId: v.id('users') },
  handler: async (ctx, { notificationId, userId }) => {
    const notif = await ctx.db.get(notificationId);
    if (!notif || notif.userId !== userId) throw new Error('NOT_FOUND');
    if (notif.readAt === undefined) await ctx.db.patch(notificationId, { readAt: Date.now() });
    return { ok: true as const };
  },
});
