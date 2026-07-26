import { v } from 'convex/values';
import { internalMutation, internalQuery, mutation } from './_generated/server';
import { assertWebhookSecret } from './lib/webhookSecret';

/**
 * Journal de livraison SMS — la vérité sur ce qui a été *reçu*, pas juste
 * *accepté en file*.
 *
 * `broadcast` / les reminders enregistrent une ligne à l'envoi (`record`), puis
 * le webhook StatusCallback Twilio (`/api/webhooks/twilio` → `applyStatusWebhook`)
 * la fait passer en `delivered` / `undelivered` / `failed`. C'est le correctif
 * du mode d'échec F4 du premortem : « 180 envoyés » alors que les carriers A2P
 * US filtraient en silence.
 */

export type SmsDeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'undelivered'
  | 'failed'
  | 'unknown';

const deliveryStatus = v.union(
  v.literal('queued'),
  v.literal('sent'),
  v.literal('delivered'),
  v.literal('undelivered'),
  v.literal('failed'),
  v.literal('unknown'),
);

/** Mappe un `MessageStatus` Twilio vers notre statut normalisé. */
export function normalizeTwilioStatus(raw: string): SmsDeliveryStatus {
  switch (raw) {
    case 'delivered':
      return 'delivered';
    case 'undelivered':
      return 'undelivered';
    case 'failed':
      return 'failed';
    case 'sent':
      return 'sent';
    case 'queued':
    case 'accepted':
    case 'scheduled':
    case 'sending':
      return 'queued';
    default:
      return 'unknown';
  }
}

/**
 * Enregistre (ou met à jour) une ligne de livraison à l'envoi. Idempotent par
 * `twilioSid` : un re-run ne duplique pas. Appelé par les actions d'envoi juste
 * après un send réel réussi (jamais en mode mock).
 */
export const record = internalMutation({
  args: {
    twilioSid: v.string(),
    kind: v.union(v.literal('invitation'), v.literal('reminder'), v.literal('otp')),
    status: deliveryStatus,
    guestId: v.optional(v.id('guests')),
    eventId: v.optional(v.id('events')),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('smsDeliveries')
      .withIndex('by_twilio_sid', (q) => q.eq('twilioSid', args.twilioSid))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { status: args.status, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert('smsDeliveries', {
      twilioSid: args.twilioSid,
      kind: args.kind,
      status: args.status,
      guestId: args.guestId,
      eventId: args.eventId,
      to: args.to,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Webhook StatusCallback Twilio → statut RÉEL de livraison.
 *
 * PUBLIQUE mais gardée par `CONVEX_WEBHOOK_SECRET` (la route Next vérifie EN PLUS
 * la signature `X-Twilio-Signature`). C'est la seule barrière contre un appel
 * direct à `*.convex.cloud` — même patron que `payments.markSucceeded` &co.
 */
export const applyStatusWebhook = mutation({
  args: {
    webhookSecret: v.string(),
    twilioSid: v.string(),
    twilioStatus: v.string(),
    errorCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertWebhookSecret(args.webhookSecret);
    const status = normalizeTwilioStatus(args.twilioStatus);
    const now = Date.now();
    const row = await ctx.db
      .query('smsDeliveries')
      .withIndex('by_twilio_sid', (q) => q.eq('twilioSid', args.twilioSid))
      .unique();
    if (!row) {
      // Course rare : le callback précède le `record`. On ne perd pas l'info.
      await ctx.db.insert('smsDeliveries', {
        twilioSid: args.twilioSid,
        kind: 'unknown',
        status,
        errorCode: args.errorCode,
        createdAt: now,
        updatedAt: now,
      });
      return { ok: true as const, created: true };
    }
    await ctx.db.patch(row._id, {
      status,
      errorCode: args.errorCode ?? row.errorCode,
      updatedAt: now,
    });
    return { ok: true as const, created: false };
  },
});

/**
 * Résumé de livraison par event (UI couple + alerte ops). Compte les lignes par
 * statut, et calcule un `undeliveredRate` sur les statuts terminaux — le signal
 * qui aurait révélé le filtrage A2P avant le jour J.
 */
export const summaryForEvent = internalQuery({
  args: { eventId: v.id('events') },
  handler: async (ctx, { eventId }) => {
    const rows = await ctx.db
      .query('smsDeliveries')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    const counts = {
      total: rows.length,
      queued: 0,
      sent: 0,
      delivered: 0,
      undelivered: 0,
      failed: 0,
      unknown: 0,
    };
    for (const r of rows) counts[r.status] += 1;
    const terminal = counts.delivered + counts.undelivered + counts.failed;
    const undeliveredRate = terminal > 0 ? (counts.undelivered + counts.failed) / terminal : 0;
    return { ...counts, undeliveredRate };
  },
});
