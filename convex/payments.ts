import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { internal } from './_generated/api';

const PROVIDER = v.union(v.literal('stripe'), v.literal('cinetpay'), v.literal('mock'));
const CURRENCY = v.union(v.literal('EUR'), v.literal('XOF'), v.literal('MAD'), v.literal('TND'));
const PLAN = v.union(v.literal('essential'), v.literal('premium'));

// Gallery retention is feature-based now: Essentiel = J+30, Premium = J+180.
// Post-event upsell pushes this to J+5y (cf. extendRetentionPostEvent below).
const GALLERY_RETENTION_DAYS: Record<'essential' | 'premium', number> = {
  essential: 30,
  premium: 180,
};
const POST_EVENT_UPSELL_RETENTION_DAYS = 5 * 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
    if (event) {
      const galleryExpiresAt = event.eventDate + GALLERY_RETENTION_DAYS[payment.plan] * MS_PER_DAY;
      const now = Date.now();
      const needsUpdate =
        event.planTier !== payment.plan ||
        event.paidAt === undefined ||
        event.galleryExpiresAt !== galleryExpiresAt;
      if (needsUpdate) {
        await ctx.db.patch(event._id, {
          planTier: payment.plan,
          paidAt: event.paidAt ?? now,
          galleryExpiresAt,
          updatedAt: now,
        });
      }
    }

    // Best-effort owner notification (only if owner has an email on file).
    const owner = await ctx.db.get(payment.userId);
    if (owner?.email) {
      const amountFormatted = formatAmount(payment.amountMinor, payment.currency);
      const eventTitle = event?.title ?? 'votre événement';
      await ctx.scheduler.runAfter(0, internal.emailActions.sendProNotification, {
        to: owner.email,
        recipientName: owner.fullName ?? owner.phone ?? 'Bonjour',
        organizationName: eventTitle,
        kind: 'payment-received' as const,
        detail: `Votre paiement de ${amountFormatted} pour le plan ${payment.plan} a été reçu.`,
        ctaLabel: 'Voir l’événement',
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://wedillybird.com'}/events/${payment.eventId}`,
      });
    }

    return { ok: true as const, alreadyApplied: false };
  },
});

function formatAmount(amountMinor: number, currency: string): string {
  const amount = amountMinor / 100;
  if (currency === 'EUR')
    return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`;
  if (currency === 'XOF') return `${amount.toLocaleString('fr-FR')} FCFA`;
  return `${amount.toLocaleString('fr-FR')} ${currency}`;
}

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

/**
 * Post-event upsell: pushes gallery retention to J+5y for a one-shot fee.
 * Called from the upsell checkout success webhook (provider="stripe"|"cinetpay"|"mock"
 * with a payment row whose plan stays at the original tier — the upsell is
 * recorded as a separate `payments` row marked with providerSessionId distinct
 * from the original purchase).
 */
export const extendRetentionPostEvent = mutation({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error('EVENT_NOT_FOUND');
    if (event.ownerId !== requesterId) throw new Error('FORBIDDEN');

    const newExpiresAt = event.eventDate + POST_EVENT_UPSELL_RETENTION_DAYS * MS_PER_DAY;
    if (event.galleryExpiresAt && event.galleryExpiresAt >= newExpiresAt) {
      return { ok: true as const, alreadyExtended: true };
    }
    await ctx.db.patch(eventId, { galleryExpiresAt: newExpiresAt, updatedAt: Date.now() });
    return { ok: true as const, alreadyExtended: false };
  },
});
