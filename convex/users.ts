import { v } from 'convex/values';
import { mutation } from './_generated/server';

export const completeOnboarding = mutation({
  args: {
    userId: v.id('users'),
    fullName: v.string(),
    role: v.union(v.literal('couple'), v.literal('pro')),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { userId, fullName, role, email }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    const trimmed = fullName.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      throw new Error('INVALID_NAME');
    }

    await ctx.db.patch(userId, {
      fullName: trimmed,
      role,
      ...(email ? { email: email.toLowerCase() } : {}),
    });

    return { ok: true as const };
  },
});
