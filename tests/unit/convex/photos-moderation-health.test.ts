/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ALERT_MIN_STALE,
  reconcileStalePendingPhotos,
} from '../../../convex/photosModerationHealth';

/**
 * Filet de secours du pipeline média (F4) : détecter les photos coincées en
 * `pending` parce que le callback de modération Lambda n'est jamais arrivé
 * (galerie vide le jour J). Même approche que sms-deliveries.test.ts : invocation
 * directe du `_handler` avec un ctx minimal mocké.
 *
 * Point clé métier : une photo `manual_review` reste `pending` LÉGITIMEMENT (objet
 * `moderation` renseigné) — elle ne doit PAS compter comme panne.
 */

type AnyFn = { _handler: (ctx: any, args: any) => Promise<unknown> };
const asFn = (m: unknown) => m as unknown as AnyFn;

const mkPhoto = (eventId: string, moderated: boolean) => ({
  eventId,
  createdAt: Date.now() - 60 * 60 * 1000,
  ...(moderated
    ? { moderation: { source: 'rekognition', decision: 'manual_review', decidedAt: Date.now() } }
    : {}),
});

const mkCtx = (photos: any[], priorAlert: any = null) => {
  const scheduled: any[] = [];
  const inserted: any[] = [];
  const patched: any[] = [];
  const ctx = {
    db: {
      query: (table: string) => ({
        withIndex: () => ({
          take: async () => photos,
          unique: async () => (table === 'photoModerationAlerts' ? priorAlert : null),
        }),
      }),
      get: async () => ({ title: 'Mariage Test' }),
      insert: async (_t: string, row: any) => {
        inserted.push(row);
        return 'alert_1';
      },
      patch: async (id: string, p: any) => {
        patched.push({ id, p });
      },
    },
    scheduler: {
      runAfter: async (...args: any[]) => {
        scheduled.push(args);
      },
    },
  };
  return { ctx, scheduled, inserted, patched };
};

describe('photosModerationHealth.reconcileStalePendingPhotos — filet F4', () => {
  beforeEach(() => {
    process.env.LAMBDA_CALLBACK_SECRET = 'lambda-secret';
  });
  afterEach(() => {
    delete process.env.LAMBDA_CALLBACK_SECRET;
    delete process.env.OPS_ALERT_EMAIL;
  });

  it('no-op si le pipeline média n’est pas câblé (LAMBDA_CALLBACK_SECRET absent)', async () => {
    delete process.env.LAMBDA_CALLBACK_SECRET;
    const { ctx, scheduled } = mkCtx([mkPhoto('evt_1', false), mkPhoto('evt_1', false)]);
    const res: any = await asFn(reconcileStalePendingPhotos)._handler(ctx, {});
    expect(res).toMatchObject({ skipped: 'media_not_configured', alerted: 0 });
    expect(scheduled).toHaveLength(0);
  });

  it('alerte quand >= seuil de photos pending JAMAIS modérées sur un event', async () => {
    const photos = Array.from({ length: ALERT_MIN_STALE }, () => mkPhoto('evt_1', false));
    const { ctx, scheduled, inserted } = mkCtx(photos);
    const res: any = await asFn(reconcileStalePendingPhotos)._handler(ctx, {});
    expect(res.alerted).toBe(1);
    expect(scheduled).toHaveLength(1);
    const emailArgs = scheduled[0][2]; // runAfter(delay, fnRef, args)
    expect(emailArgs.to).toBe('hello@wedillybird.com');
    expect(emailArgs.subject).toContain('bloque');
    expect(emailArgs.body).toContain('Mariage Test');
    expect(inserted[0]).toMatchObject({ eventId: 'evt_1', stalePendingCount: ALERT_MIN_STALE });
  });

  it('n’alerte PAS : les photos manual_review (moderation présent) ne comptent pas', async () => {
    // 2 jamais modérées + 3 en manual_review → count effectif = 2 < seuil (3).
    const photos = [
      mkPhoto('evt_1', false),
      mkPhoto('evt_1', false),
      mkPhoto('evt_1', true),
      mkPhoto('evt_1', true),
      mkPhoto('evt_1', true),
    ];
    const { ctx, scheduled } = mkCtx(photos);
    const res: any = await asFn(reconcileStalePendingPhotos)._handler(ctx, {});
    expect(res.alerted).toBe(0);
    expect(scheduled).toHaveLength(0);
  });

  it('dedupe : pas de nouvel email si une alerte récente existe pour l’event', async () => {
    const photos = Array.from({ length: ALERT_MIN_STALE }, () => mkPhoto('evt_1', false));
    const recent = { _id: 'a1', alertedAt: Date.now() - 60_000, stalePendingCount: 5 };
    const { ctx, scheduled } = mkCtx(photos, recent);
    const res: any = await asFn(reconcileStalePendingPhotos)._handler(ctx, {});
    expect(res.alerted).toBe(0);
    expect(scheduled).toHaveLength(0);
  });

  it('respecte OPS_ALERT_EMAIL', async () => {
    process.env.OPS_ALERT_EMAIL = 'alerts@example.com';
    const photos = Array.from({ length: ALERT_MIN_STALE }, () => mkPhoto('evt_1', false));
    const { ctx, scheduled } = mkCtx(photos);
    await asFn(reconcileStalePendingPhotos)._handler(ctx, {});
    expect(scheduled[0][2].to).toBe('alerts@example.com');
  });
});
