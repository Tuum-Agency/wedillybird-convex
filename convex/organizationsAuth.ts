import { v } from 'convex/values';
import { internalQuery } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';

/**
 * Internal query consumed by Node-runtime actions (e.g. brandingActions) that
 * cannot import the V8-runtime helpers from `organizations.ts` directly.
 *
 * Mirrors the assertCanManage helper colocated in organizations.ts.
 */
export const assertCanManageOrg = internalQuery({
  args: {
    organizationId: v.id('organizations'),
    requesterId: v.id('users'),
  },
  handler: async (ctx, { organizationId, requesterId }) => {
    const membership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) =>
        q.eq('organizationId', organizationId).eq('userId', requesterId as Id<'users'>),
      )
      .first();
    if (!membership || membership.status !== 'active') throw new Error('FORBIDDEN');
    if (membership.role !== 'owner' && membership.role !== 'admin') throw new Error('FORBIDDEN');
    return { ok: true as const };
  },
});

// Suppress unused-type lint warning.
export type _Unused = Doc<'organizationMemberships'>;
