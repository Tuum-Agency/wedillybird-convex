import { v } from 'convex/values';
import { internalMutation, mutation } from './_generated/server';

const TEST_USERS = [
  {
    phone: '+33612931779',
    email: 'mamadou@wedillybird.test',
    fullName: 'Mamadou Seck',
    role: 'couple' as const,
  },
  {
    phone: '+221771234567',
    email: 'aicha@wedillybird.test',
    fullName: 'Aïcha Diallo',
    role: 'couple' as const,
  },
  {
    phone: '+33698765432',
    email: 'jean@wedillybird.test',
    fullName: 'Jean Dupont',
    role: 'couple' as const,
  },
  {
    phone: '+212661234567',
    email: 'fatima@wedillybird.test',
    fullName: 'Fatima Bennani',
    role: 'couple' as const,
  },
  {
    phone: '+225071234567',
    email: 'kwame@wedillybird.test',
    fullName: 'Kwame Kouassi',
    role: 'pro' as const,
  },
];

export const seedTestUsers = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const results: Array<{ phone: string; userId: string; created: boolean }> = [];

    for (const fixture of TEST_USERS) {
      const existing = await ctx.db
        .query('users')
        .withIndex('by_phone', (q) => q.eq('phone', fixture.phone))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          fullName: fixture.fullName,
          email: fixture.email,
          role: fixture.role,
          lastSeenAt: now,
        });
        results.push({ phone: fixture.phone, userId: existing._id, created: false });
      } else {
        const userId = await ctx.db.insert('users', {
          phone: fixture.phone,
          email: fixture.email,
          fullName: fixture.fullName,
          role: fixture.role,
          locale: 'fr',
          createdAt: now,
          lastSeenAt: now,
        });
        results.push({ phone: fixture.phone, userId, created: true });
      }
    }

    return results;
  },
});

export const _resetTestData = internalMutation({
  args: { confirmPhrase: v.string() },
  handler: async (ctx, { confirmPhrase }) => {
    if (confirmPhrase !== 'RESET_TEST_DATA_CONFIRMED') {
      throw new Error('INVALID_CONFIRMATION');
    }
    const testPhones = TEST_USERS.map((u) => u.phone);
    const toDelete = await ctx.db.query('users').collect();
    let deleted = 0;
    for (const user of toDelete) {
      if (testPhones.includes(user.phone)) {
        await ctx.db.delete(user._id);
        deleted++;
      }
    }
    return { deleted };
  },
});
