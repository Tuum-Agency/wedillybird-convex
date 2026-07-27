import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalMutation } from './_generated/server';

/**
 * Filet de secours du pipeline média (mode d'échec F4 du premortem).
 *
 * Une photo entre en `status: 'pending'` à l'upload, puis le callback de la
 * Lambda de modération (`photos.internalMarkModerated`, via `convex/http.ts`)
 * la passe en `approved` / `rejected`. Si ce callback n'arrive jamais — secret
 * `LAMBDA_CALLBACK_SECRET` désaligné, Lambda en erreur, IAM cassé, quota
 * Rekognition, région down — la photo reste `pending` pour toujours et la
 * galerie reste vide le soir du mariage, sans que rien ne le signale. Ce cron
 * détecte le SYMPTÔME (photos jamais modérées) quelle qu'en soit la cause, et
 * alerte l'ops par email — exact pendant de la réconciliation SMS.
 *
 * Nuance importante : une photo mise en `manual_review` par Rekognition reste
 * LÉGITIMEMENT `pending` (avec un objet `moderation` renseigné) en attendant la
 * décision de l'owner. On ne compte donc QUE les `pending` SANS objet
 * `moderation` = le callback n'a jamais eu lieu (vraie panne pipeline).
 */

/** N photos jamais modérées sur un même event avant d'alerter (bruit sinon). */
export const ALERT_MIN_STALE = 3;
/** Un seul email d'alerte par event sur cette fenêtre (anti-spam du cron). */
export const ALERT_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Une photo `pending` non modérée au-delà de ce délai est « bloquée » (un
 *  callback de modération normal arrive en secondes). */
export const STALE_PENDING_MS = 20 * 60 * 1000;
/** Borne le nombre de photos scannées par passage. */
export const RECONCILE_BATCH_LIMIT = 200;

export const reconcileStalePendingPhotos = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Pipeline média non câblé sur ce déploiement (dev / pas encore live) → rien
    // à surveiller. Même discipline que la réconciliation SMS (`isTwilioConfigured`).
    if (!process.env.LAMBDA_CALLBACK_SECRET) {
      return { skipped: 'media_not_configured' as const, staleEvents: 0, alerted: 0 };
    }

    const cutoff = Date.now() - STALE_PENDING_MS;
    const stale = await ctx.db
      .query('photos')
      .withIndex('by_status_createdAt', (q) => q.eq('status', 'pending').lt('createdAt', cutoff))
      .take(RECONCILE_BATCH_LIMIT);

    // Ne compter que les photos JAMAIS modérées (callback perdu). Les
    // `manual_review` (objet `moderation` présent) sont un état légitime en
    // attente de décision owner, pas une panne.
    const byEvent = new Map<string, number>();
    for (const p of stale) {
      if (p.moderation !== undefined) continue;
      byEvent.set(p.eventId, (byEvent.get(p.eventId) ?? 0) + 1);
    }

    const now = Date.now();
    let alerted = 0;
    for (const [eventIdStr, staleCount] of byEvent) {
      if (staleCount < ALERT_MIN_STALE) continue;
      const eventId = eventIdStr as Id<'events'>;

      // Anti-spam : au plus un email par event sur ALERT_DEDUPE_WINDOW_MS.
      const prior = await ctx.db
        .query('photoModerationAlerts')
        .withIndex('by_event', (q) => q.eq('eventId', eventId))
        .unique();
      if (prior && now - prior.alertedAt < ALERT_DEDUPE_WINDOW_MS) continue;
      if (prior) {
        await ctx.db.patch(prior._id, { alertedAt: now, stalePendingCount: staleCount });
      } else {
        await ctx.db.insert('photoModerationAlerts', {
          eventId,
          alertedAt: now,
          stalePendingCount: staleCount,
        });
      }

      const event = await ctx.db.get(eventId);
      const opsEmail = process.env.OPS_ALERT_EMAIL ?? 'hello@wedillybird.com';
      await ctx.scheduler.runAfter(0, internal.emailActions.sendOpsAlert, {
        to: opsEmail,
        subject: `[Wedillybird] Pipeline moderation photo bloque (${staleCount} en attente)`,
        body:
          `Event : ${event?.title ?? String(eventId)}\n` +
          `${staleCount} photo(s) "pending" depuis plus de 20 min SANS verdict de moderation ` +
          `= le callback Lambda n'est jamais arrive (galerie qui reste vide le jour J).\n\n` +
          `Cause probable : LAMBDA_CALLBACK_SECRET / CONVEX_SITE_URL de la Lambda desalignes, ` +
          `Lambda en erreur (CloudWatch ModerationFunction / VariantsFunction), IAM, ou quota Rekognition.\n` +
          `Remediation manuelle : pnpx convex run --prod photosReprocess:reprocessStuckPending.`,
      });
      alerted += 1;
    }

    return { staleEvents: byEvent.size, alerted, skipped: null };
  },
});
