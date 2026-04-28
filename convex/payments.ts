import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
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

// keep in sync with lib/payments/reconcile.ts
// `convex/` and `lib/` cannot import each other (separate tsconfig projects),
// so the reconciliation logic is duplicated. Both copies must stay aligned.
type ReconciliationPatch = {
  planTier: 'essential' | 'premium';
  paidAt: number;
  galleryExpiresAt: number;
};
function computeEventReconciliation(input: {
  event: {
    planTier?: 'essential' | 'premium';
    paidAt?: number;
    galleryExpiresAt?: number;
    eventDate: number;
  };
  payment: { plan: 'essential' | 'premium' };
  now: number;
}): ReconciliationPatch | null {
  const { event, payment, now } = input;
  const expectedExpiresAt = event.eventDate + GALLERY_RETENTION_DAYS[payment.plan] * MS_PER_DAY;
  const needsUpdate =
    event.planTier !== payment.plan ||
    event.paidAt === undefined ||
    event.galleryExpiresAt !== expectedExpiresAt;
  if (!needsUpdate) return null;
  return {
    planTier: payment.plan,
    paidAt: event.paidAt ?? now,
    galleryExpiresAt: expectedExpiresAt,
  };
}

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

    const alreadyApplied = payment.status === 'succeeded';
    const now = Date.now();

    if (!alreadyApplied) {
      await ctx.db.patch(payment._id, {
        status: 'succeeded',
        providerEventId,
        updatedAt: now,
      });
    }

    // Self-healing event reconciliation: even when the payment is already
    // marked `succeeded`, the corresponding event document may have been left
    // in an inconsistent state (e.g. `planTier` set but `paidAt` /
    // `galleryExpiresAt` missing because of a partial earlier write or a bug
    // in a previous webhook handler). We always attempt to bring the event
    // back in line with the payment's plan — but only patch when something
    // actually diverges, to avoid spurious `updatedAt` churn.
    const event = await ctx.db.get(payment.eventId);
    if (event) {
      const patch = computeEventReconciliation({
        event: {
          planTier: event.planTier,
          paidAt: event.paidAt,
          galleryExpiresAt: event.galleryExpiresAt,
          eventDate: event.eventDate,
        },
        payment: { plan: payment.plan },
        now,
      });
      if (patch) {
        // Clear pendingPlanTier — il a servi à pré-remplir le checkout, le
        // tier officiel `planTier` prend le relais une fois le paiement
        // confirmé. On laisse `pendingPlanTier` à `undefined` plutôt que de
        // supprimer le champ pour éviter les diffs inutiles si déjà absent.
        const fullPatch =
          event.pendingPlanTier !== undefined
            ? { ...patch, pendingPlanTier: undefined, updatedAt: now }
            : { ...patch, updatedAt: now };
        await ctx.db.patch(event._id, fullPatch);
      }
    }

    if (alreadyApplied) {
      return { ok: true as const, alreadyApplied: true };
    }

    // Best-effort owner notification (only if owner has an email on file).
    // Only sent on the first transition to `succeeded` — repeat webhooks for
    // an already-applied payment must not retrigger the email.
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

      // Facture associée — envoyée juste après la confirmation. Le numéro de
      // facture est dérivé de `providerSessionId` (suffix court humain) ;
      // suffisant tant qu'on n'a pas une vraie séquence comptable. Si un PDF
      // est généré côté `lib/payments/invoice.ts`, on lui passera l'URL.
      const invoiceNumber = `INV-${providerSessionId.slice(-8).toUpperCase()}`;
      const periodLabel = new Date(now).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://wedillybird.com'}/events/${payment.eventId}/invoice?session=${providerSessionId}`;
      await ctx.scheduler.runAfter(0, internal.emailActions.sendStripeInvoice, {
        to: owner.email,
        recipientName: owner.fullName ?? owner.phone ?? 'Bonjour',
        organizationName: eventTitle,
        invoiceNumber,
        amountFormatted,
        periodLabel,
        invoiceUrl,
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

/**
 * One-shot repair for events whose denormalised payment fields drifted
 * from their corresponding `payments` row (typically because an earlier
 * version of `markSucceeded` returned early on the idempotency guard
 * without ever patching the event).
 *
 * Scans every event with `planTier !== undefined` AND (`paidAt === undefined`
 * OR `galleryExpiresAt === undefined`), then for each finds the most recent
 * `succeeded` payment and applies the same reconciliation as `markSucceeded`.
 *
 * Internal-only — invoke via:
 *   pnpx convex run payments:_repairOrphanedEventGalleries
 */
export const _repairOrphanedEventGalleries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const skipped: Array<{ eventId: string; reason: string }> = [];
    let scanned = 0;
    let repaired = 0;

    const events = await ctx.db.query('events').collect();
    for (const event of events) {
      if (event.planTier === undefined) continue;
      if (event.paidAt !== undefined && event.galleryExpiresAt !== undefined) continue;

      scanned += 1;

      const payments = await ctx.db
        .query('payments')
        .withIndex('by_event', (q) => q.eq('eventId', event._id))
        .collect();
      const succeeded = payments
        .filter((p) => p.status === 'succeeded')
        .sort((a, b) => b.updatedAt - a.updatedAt);
      const payment = succeeded[0];

      if (!payment) {
        skipped.push({ eventId: event._id, reason: 'NO_SUCCEEDED_PAYMENT' });
        continue;
      }

      const patch = computeEventReconciliation({
        event: {
          planTier: event.planTier,
          paidAt: event.paidAt,
          galleryExpiresAt: event.galleryExpiresAt,
          eventDate: event.eventDate,
        },
        payment: { plan: payment.plan },
        now,
      });

      if (!patch) {
        skipped.push({ eventId: event._id, reason: 'ALREADY_CONSISTENT' });
        continue;
      }

      await ctx.db.patch(event._id, { ...patch, updatedAt: now });
      repaired += 1;
    }

    return { scanned, repaired, skipped };
  },
});
