import { v } from 'convex/values';
import { query } from './_generated/server';
import { proTierAtLeast } from './lib/entitlements';
import { requireUserId } from './lib/verifiedSession';

/**
 * Analytics consolidé multi-mariages (feature Agency). Agrège, sur toute
 * l'organisation et à partir de données réelles : mariages, pipeline CRM
 * (conversion lead→réservé, budget en pipeline) et budget engagé.
 */

type ClientStage = 'lead' | 'contacted' | 'quote' | 'booked' | 'in_progress' | 'delivered';

export const consolidated = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const userId = await requireUserId(ctx, sessionToken);
    const membership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .first();
    if (!membership) return null;
    const org = await ctx.db.get(membership.organizationId);
    if (!org) return null;
    if (!proTierAtLeast(org.subscriptionTier, 'agency')) throw new Error('FEATURE_NOT_IN_PLAN');

    const orgId = org._id;

    const events = await ctx.db
      .query('events')
      .withIndex('by_organization', (q) => q.eq('organizationId', orgId))
      .collect();

    const clients = await ctx.db
      .query('clients')
      .withIndex('by_organization', (q) => q.eq('organizationId', orgId))
      .collect();

    const budgetLines = await ctx.db
      .query('budgetLines')
      .withIndex('by_organization', (q) => q.eq('organizationId', orgId))
      .collect();

    const byStage: Record<ClientStage, number> = {
      lead: 0,
      contacted: 0,
      quote: 0,
      booked: 0,
      in_progress: 0,
      delivered: 0,
    };
    let pipelineBudgetMinor = 0;
    for (const c of clients) {
      byStage[c.stage] += 1;
      pipelineBudgetMinor += c.budgetMinor ?? 0;
    }
    const bookedOrBeyond = byStage.booked + byStage.in_progress + byStage.delivered;
    const conversionRate = clients.length === 0 ? 0 : bookedOrBeyond / clients.length;

    let plannedMinor = 0;
    let paidMinor = 0;
    for (const l of budgetLines) {
      plannedMinor += l.plannedMinor;
      paidMinor += l.paidMinor;
    }

    return {
      events: {
        total: events.length,
        active: events.filter((e) => e.status === 'active').length,
        draft: events.filter((e) => e.status === 'draft').length,
        archived: events.filter((e) => e.status === 'archived').length,
      },
      clients: {
        total: clients.length,
        byStage,
        bookedCount: bookedOrBeyond,
        conversionRate,
        pipelineBudgetMinor,
      },
      budget: {
        plannedMinor,
        paidMinor,
      },
    };
  },
});
