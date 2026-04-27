import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

const CURRENCY = v.union(
  v.literal('EUR'),
  v.literal('XOF'),
  v.literal('MAD'),
  v.literal('TND'),
);

/**
 * Enregistre un achat Pay-as-you-go pro et crédite l'organisation.
 *
 * Idempotent : si une row avec le même `stripeSessionId` existe déjà, on
 * retourne `{ alreadyApplied: true }` sans rien re-créditer. Cette garantie
 * est importante car Stripe peut redélivrer le même `checkout.session.completed`
 * en cas de timeout webhook.
 */
export const markPurchase = mutation({
  args: {
    organizationId: v.id('organizations'),
    requesterId: v.id('users'),
    stripeSessionId: v.string(),
    amountMinor: v.number(),
    currency: CURRENCY,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('paygPurchases')
      .withIndex('by_session', (q) => q.eq('stripeSessionId', args.stripeSessionId))
      .first();
    if (existing) {
      return { ok: true as const, alreadyApplied: true };
    }

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error('ORGANIZATION_NOT_FOUND');

    const now = Date.now();
    await ctx.db.insert('paygPurchases', {
      organizationId: args.organizationId,
      requesterId: args.requesterId,
      stripeSessionId: args.stripeSessionId,
      amountMinor: args.amountMinor,
      currency: args.currency,
      createdAt: now,
    });

    const currentCredits = org.paygCredits ?? 0;
    await ctx.db.patch(args.organizationId, {
      paygCredits: currentCredits + 1,
      updatedAt: now,
    });

    return { ok: true as const, alreadyApplied: false };
  },
});

export const getCreditsByOrganization = query({
  args: { organizationId: v.id('organizations'), requesterId: v.id('users') },
  handler: async (ctx, { organizationId, requesterId }) => {
    const org = await ctx.db.get(organizationId);
    if (!org) return null;
    if (org.ownerId !== requesterId) {
      const member = await ctx.db
        .query('organizationMemberships')
        .withIndex('by_org_user', (q) =>
          q.eq('organizationId', organizationId).eq('userId', requesterId),
        )
        .first();
      if (!member || member.status !== 'active') throw new Error('FORBIDDEN');
    }
    return { credits: org.paygCredits ?? 0 };
  },
});
