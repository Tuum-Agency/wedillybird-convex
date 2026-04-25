import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

const PROVIDER = v.union(v.literal('stripe'), v.literal('cinetpay'), v.literal('mock'));
const CURRENCY = v.union(v.literal('EUR'), v.literal('XOF'), v.literal('MAD'), v.literal('TND'));
const PLAN = v.union(v.literal('essential'), v.literal('premium'));

const PLAN_MAX_GUESTS: Record<'free' | 'essential' | 'premium', number> = {
  free: 30,
  essential: 150,
  premium: 1000,
};

export const recordIntent = mutation({
  args: {
    userId: v.id('users'),
    eventId: v.id('events'),
    plan: PLAN,
    currency: CURRENCY,
    amountMinor: v.number(),
    provider: PROVIDER,
    providerSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error('EVENT_NOT_FOUND');
    if (event.ownerId !== args.userId) throw new Error('FORBIDDEN');

    const id = await ctx.db.insert('payments', {
      userId: args.userId,
      eventId: args.eventId,
      plan: args.plan,
      currency: args.currency,
      amountMinor: args.amountMinor,
      provider: args.provider,
      providerSessionId: args.providerSessionId,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { id };
  },
});

export const findBySession = query({
  args: { provider: PROVIDER, providerSessionId: v.string() },
  handler: async (ctx, { provider, providerSessionId }) => {
    return ctx.db
      .query('payments')
      .withIndex('by_session', (q) =>
        q.eq('provider', provider).eq('providerSessionId', providerSessionId),
      )
      .first();
  },
});

export const markSucceeded = mutation({
  args: {
    provider: PROVIDER,
    providerSessionId: v.string(),
    providerEventId: v.string(),
  },
  handler: async (ctx, { provider, providerSessionId, providerEventId }) => {
    const payment = await ctx.db
      .query('payments')
      .withIndex('by_session', (q) =>
        q.eq('provider', provider).eq('providerSessionId', providerSessionId),
      )
      .first();
    if (!payment) throw new Error('PAYMENT_NOT_FOUND');

    if (payment.providerEventId === providerEventId && payment.status === 'succeeded') {
      return { ok: true as const, alreadyApplied: true };
    }
    if (payment.status === 'succeeded') {
      return { ok: true as const, alreadyApplied: true };
    }

    await ctx.db.patch(payment._id, {
      status: 'succeeded',
      providerEventId,
      updatedAt: Date.now(),
    });

    const event = await ctx.db.get(payment.eventId);
    if (event && event.planTier !== payment.plan) {
      await ctx.db.patch(event._id, {
        planTier: payment.plan,
        maxGuests: PLAN_MAX_GUESTS[payment.plan],
        updatedAt: Date.now(),
      });
    }

    return { ok: true as const, alreadyApplied: false };
  },
});

export const markFailed = mutation({
  args: {
    provider: PROVIDER,
    providerSessionId: v.string(),
    providerEventId: v.string(),
    status: v.union(v.literal('failed'), v.literal('cancelled')),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query('payments')
      .withIndex('by_session', (q) =>
        q.eq('provider', args.provider).eq('providerSessionId', args.providerSessionId),
      )
      .first();
    if (!payment) throw new Error('PAYMENT_NOT_FOUND');

    if (payment.status === 'succeeded') {
      return { ok: true as const, alreadyApplied: true };
    }

    await ctx.db.patch(payment._id, {
      status: args.status,
      providerEventId: args.providerEventId,
      failureReason: args.failureReason,
      updatedAt: Date.now(),
    });
    return { ok: true as const, alreadyApplied: false };
  },
});

export const listByEvent = query({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error('EVENT_NOT_FOUND');
    if (event.ownerId !== requesterId) throw new Error('FORBIDDEN');

    return ctx.db
      .query('payments')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .order('desc')
      .collect();
  },
});
