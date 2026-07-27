import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { internal } from './_generated/api';

/**
 * Commandes de livre photo HD imprimé. Débloquées par l'upsell HD post-event
 * (`events.hdUpsellPurchasedAt`). Pas d'intégration imprimeur : la commande est
 * enregistrée, l'équipe ops est notifiée par email et assure la fabrication et
 * l'expédition à la main, puis fait évoluer le `status`.
 */

const OPS_FALLBACK_EMAIL = 'hello@wedillybird.com';

function opsEmail(): string {
  return process.env.OPS_CONTACT_EMAIL ?? OPS_FALLBACK_EMAIL;
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://wedillybird.com';
}

export const request = mutation({
  args: {
    eventId: v.id('events'),
    requesterId: v.id('users'),
    recipientName: v.string(),
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    city: v.string(),
    postalCode: v.string(),
    country: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error('EVENT_NOT_FOUND');
    if (event.ownerId !== args.requesterId) throw new Error('FORBIDDEN');
    // Le livre photo HD fait partie de l'upsell post-event (+29 €).
    if (!event.hdUpsellPurchasedAt) throw new Error('UPSELL_REQUIRED');

    const recipientName = args.recipientName.trim();
    const addressLine1 = args.addressLine1.trim();
    const addressLine2 = args.addressLine2?.trim() || undefined;
    const city = args.city.trim();
    const postalCode = args.postalCode.trim();
    const country = args.country.trim();
    const notes = args.notes?.trim() || undefined;
    if (!recipientName || !addressLine1 || !city || !postalCode || !country) {
      throw new Error('INVALID_ADDRESS');
    }

    // Une seule commande active par event (on autorise une nouvelle commande
    // uniquement si la précédente a été annulée).
    const orders = await ctx.db
      .query('photoBookOrders')
      .withIndex('by_event', (q) => q.eq('eventId', args.eventId))
      .collect();
    if (orders.some((o) => o.status !== 'cancelled')) {
      throw new Error('ALREADY_ORDERED');
    }

    const now = Date.now();
    const id = await ctx.db.insert('photoBookOrders', {
      eventId: args.eventId,
      userId: args.requesterId,
      status: 'requested',
      recipientName,
      addressLine1,
      addressLine2,
      city,
      postalCode,
      country,
      notes,
      createdAt: now,
      updatedAt: now,
    });

    const eventTitle = event.title;
    const addressBlock = [
      recipientName,
      addressLine1,
      addressLine2,
      `${postalCode} ${city}`,
      country,
    ]
      .filter(Boolean)
      .join(', ');
    const ctaUrl = `${appUrl()}/events/${args.eventId}`;

    // Notification ops (toujours) — c'est elle qui fabrique et expédie.
    await ctx.scheduler.runAfter(0, internal.emailActions.sendProNotification, {
      to: opsEmail(),
      recipientName: 'Wedillybird Ops',
      organizationName: eventTitle,
      kind: 'photo-book-ordered' as const,
      detail: `Nouvelle commande de livre photo HD pour « ${eventTitle} ». Livraison : ${addressBlock}.${
        notes ? ` Note du couple : ${notes}.` : ''
      }`,
      ctaLabel: 'Voir l’événement',
      ctaUrl,
      locale: 'fr',
    });

    // Confirmation au couple (si email connu).
    const owner = await ctx.db.get(args.requesterId);
    if (owner?.email) {
      await ctx.scheduler.runAfter(0, internal.emailActions.sendProNotification, {
        to: owner.email,
        recipientName: owner.fullName ?? owner.phone ?? '',
        organizationName: eventTitle,
        kind: 'photo-book-ordered' as const,
        detail: `Votre commande de livre photo HD pour « ${eventTitle} » est enregistrée. Nous le préparons et l’expédions à : ${addressBlock}.`,
        ctaLabel: 'Voir mon mariage',
        ctaUrl,
        locale: owner.locale,
      });
    }

    return { id, status: 'requested' as const };
  },
});

export const getForEvent = query({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error('EVENT_NOT_FOUND');
    if (event.ownerId !== requesterId) throw new Error('FORBIDDEN');

    const orders = await ctx.db
      .query('photoBookOrders')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .order('desc')
      .collect();
    // La plus récente non annulée fait foi pour l'UI (sinon la dernière).
    const active = orders.find((o) => o.status !== 'cancelled');
    const latest = active ?? orders[0];
    if (!latest) return null;
    return {
      _id: latest._id,
      status: latest.status,
      recipientName: latest.recipientName,
      city: latest.city,
      country: latest.country,
      createdAt: latest.createdAt,
    };
  },
});
