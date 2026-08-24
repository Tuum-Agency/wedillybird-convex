import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { assertEventAccess } from './lib/eventAuth';
import { assertWebhookSecret } from './lib/webhookSecret';
import { requireUserId } from './lib/verifiedSession';
import { fetchTwilioMessageStatus, isTwilioConfigured } from './lib/twilioSms';

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
 * Compte les lignes par statut + `terminal` (statuts définitifs) + `undeliveredRate`
 * (part des terminaux non délivrés) — le signal qui révèle un filtrage A2P.
 * Fonction pure, partagée entre `summaryForEvent` (lecture UI) et l'alerte ops.
 */
export function summarizeDeliveries(rows: ReadonlyArray<{ status: SmsDeliveryStatus }>): {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  undelivered: number;
  failed: number;
  unknown: number;
  terminal: number;
  undeliveredRate: number;
} {
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
  return { ...counts, terminal, undeliveredRate };
}

/**
 * Seuils de l'alerte ops : au moins N statuts terminaux ET un taux de non-livraison
 * >= X. En dessous, le signal n'est pas fiable (trop peu de données, ou normal).
 */
export const ALERT_MIN_TERMINAL = 5;
export const ALERT_UNDELIVERED_THRESHOLD = 0.3;
/** Un seul email d'alerte par event sur cette fenêtre (anti-spam du cron). */
export const ALERT_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Réconciliation : on ne va interroger Twilio que pour les lignes non terminales
 * plus vieilles que ce délai (un StatusCallback normal arrive en secondes/minutes ;
 * au-delà, il est probablement perdu). Borne le nombre traité par passage.
 */
export const RECONCILE_STALE_MS = 20 * 60 * 1000;
export const RECONCILE_BATCH_LIMIT = 100;

/**
 * Résumé de livraison par event (UI couple + alerte ops). Le `undeliveredRate`
 * sur les statuts terminaux est le signal qui aurait révélé le filtrage A2P
 * avant le jour J.
 */
export const summaryForEvent = internalQuery({
  args: { eventId: v.id('events') },
  handler: async (ctx, { eventId }) => {
    const rows = await ctx.db
      .query('smsDeliveries')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    return summarizeDeliveries(rows);
  },
});

/**
 * Version AUTHED du résumé, lisible par le couple/l'agence depuis l'app : c'est
 * ce qui remplace le compteur trompeur « X envoyés » par la livraison RÉELLE
 * (délivrés / en attente / non délivrés). Gardée par `assertEventAccess`.
 */
export const deliveryForEvent = query({
  args: { eventId: v.id('events'), sessionToken: v.string() },
  handler: async (ctx, { eventId, sessionToken }) => {
    const requesterId = await requireUserId(ctx, sessionToken);
    await assertEventAccess(ctx, eventId, requesterId);
    const rows = await ctx.db
      .query('smsDeliveries')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    return summarizeDeliveries(rows);
  },
});

/**
 * Relit les statuts de livraison RÉELS d'un event et alerte l'ops par email si
 * le taux de non-livraison dépasse le seuil — le signal qui aurait révélé le
 * filtrage carrier A2P US AVANT le jour J (mode d'échec F4). Planifié ~15 min
 * après un broadcast (cf. `invitationActions.broadcast`). No-op sous le seuil,
 * donc rejouable sans risque de spam pour un event sain.
 */
export const checkEventDeliverabilityAndAlert = internalMutation({
  args: { eventId: v.id('events') },
  handler: async (ctx, { eventId }) => {
    const rows = await ctx.db
      .query('smsDeliveries')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    const s = summarizeDeliveries(rows);
    if (s.terminal < ALERT_MIN_TERMINAL || s.undeliveredRate < ALERT_UNDELIVERED_THRESHOLD) {
      return { alerted: false as const, terminal: s.terminal, undeliveredRate: s.undeliveredRate };
    }
    // Anti-spam : au plus un email par event sur ALERT_DEDUPE_WINDOW_MS. Le cron
    // de réconciliation peut rappeler cette fonction à chaque passage.
    const now = Date.now();
    const prior = await ctx.db
      .query('smsDeliveryAlerts')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .unique();
    if (prior && now - prior.alertedAt < ALERT_DEDUPE_WINDOW_MS) {
      return {
        alerted: false as const,
        deduped: true as const,
        terminal: s.terminal,
        undeliveredRate: s.undeliveredRate,
      };
    }
    if (prior) {
      await ctx.db.patch(prior._id, { alertedAt: now, undeliveredRate: s.undeliveredRate });
    } else {
      await ctx.db.insert('smsDeliveryAlerts', {
        eventId,
        alertedAt: now,
        undeliveredRate: s.undeliveredRate,
      });
    }
    const event = await ctx.db.get(eventId);
    const opsEmail = process.env.OPS_ALERT_EMAIL ?? 'hello@wedillybird.com';
    const pct = Math.round(s.undeliveredRate * 100);
    await ctx.scheduler.runAfter(0, internal.emailActions.sendOpsAlert, {
      to: opsEmail,
      subject: `[Wedillybird] Livraison SMS degradee (${pct}% non delivres)`,
      body:
        `Event : ${event?.title ?? String(eventId)}\n` +
        `Taux de non-livraison : ${pct}% (${s.undelivered + s.failed}/${s.terminal} statuts terminaux)\n` +
        `Detail : delivered=${s.delivered}, undelivered=${s.undelivered}, failed=${s.failed}, en attente=${s.queued + s.sent}\n\n` +
        `Cause probable : filtrage carrier A2P US (Toll-Free non "Verified", opt-in, ou contenu).\n` +
        `A verifier : la Toll-Free Verification Twilio + les error codes Twilio (30007/30008 = message filtre).`,
    });
    return { alerted: true as const, terminal: s.terminal, undeliveredRate: s.undeliveredRate };
  },
});

/* -------------------------------------------------------------------------- */
/*  Réconciliation des callbacks perdus (cron de secours F4)                   */
/* -------------------------------------------------------------------------- */

/**
 * Lignes non terminales (queued/sent) plus vieilles que `cutoff` — candidates à
 * une interrogation directe de Twilio (le StatusCallback a probablement été perdu).
 */
export const listStaleNonTerminal = internalQuery({
  args: { cutoff: v.number(), limit: v.number() },
  handler: async (ctx, { cutoff, limit }) => {
    const out: Array<{ twilioSid: string; eventId?: Id<'events'> }> = [];
    for (const status of ['queued', 'sent'] as const) {
      const rows = await ctx.db
        .query('smsDeliveries')
        .withIndex('by_status_updated', (q) => q.eq('status', status).lt('updatedAt', cutoff))
        .take(limit);
      for (const r of rows) out.push({ twilioSid: r.twilioSid, eventId: r.eventId });
    }
    return out.slice(0, limit);
  },
});

/**
 * Applique un statut réconcilié (issu d'un GET Twilio) à une ligne, par SID.
 * Interne — pas de secret webhook (jamais exposée hors Convex). No-op si la ligne
 * a disparu.
 */
export const applyReconciledStatus = internalMutation({
  args: {
    twilioSid: v.string(),
    twilioStatus: v.string(),
    errorCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('smsDeliveries')
      .withIndex('by_twilio_sid', (q) => q.eq('twilioSid', args.twilioSid))
      .unique();
    if (!row) return { ok: false as const };
    await ctx.db.patch(row._id, {
      status: normalizeTwilioStatus(args.twilioStatus),
      errorCode: args.errorCode ?? row.errorCode,
      updatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});

/**
 * Cron de secours F4 : pour chaque SMS resté « queued/sent » sans callback, on
 * interroge Twilio et on met à jour le statut réel, puis on relance le contrôle
 * d'alerte pour les events touchés. No-op si Twilio n'est pas configuré (dev).
 */
export const reconcileStaleDeliveries = internalAction({
  args: {},
  handler: async (ctx) => {
    if (!isTwilioConfigured()) {
      return { reconciled: 0, checkedEvents: 0, skipped: 'not_configured' as const };
    }
    const cutoff = Date.now() - RECONCILE_STALE_MS;
    const stale = await ctx.runQuery(internal.smsDeliveries.listStaleNonTerminal, {
      cutoff,
      limit: RECONCILE_BATCH_LIMIT,
    });
    let reconciled = 0;
    const eventIds = new Set<string>();
    for (const row of stale) {
      const status = await fetchTwilioMessageStatus(row.twilioSid);
      if (!status) continue;
      await ctx.runMutation(internal.smsDeliveries.applyReconciledStatus, {
        twilioSid: row.twilioSid,
        twilioStatus: status.status,
        errorCode: status.errorCode,
      });
      reconciled += 1;
      if (row.eventId) eventIds.add(row.eventId);
    }
    for (const eventId of eventIds) {
      await ctx.runMutation(internal.smsDeliveries.checkEventDeliverabilityAndAlert, {
        eventId: eventId as Id<'events'>,
      });
    }
    return { reconciled, checkedEvents: eventIds.size, skipped: null };
  },
});
