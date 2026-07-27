/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  applyReconciledStatus,
  applyStatusWebhook,
  checkEventDeliverabilityAndAlert,
  normalizeTwilioStatus,
  reconcileStaleDeliveries,
  summarizeDeliveries,
} from '../../../convex/smsDeliveries';

/**
 * Livraison SMS (F4) : le statut réel doit venir du webhook StatusCallback, pas
 * du HTTP 200 d'acceptation. On teste (a) le mapping des statuts Twilio et (b) la
 * garde `CONVEX_WEBHOOK_SECRET` de la mutation de bridge — même approche
 * comportementale que webhook-secret-gate.test.ts (invocation directe du
 * `_handler` avec un ctx minimal).
 */

type AnyFn = { _handler: (ctx: any, args: any) => Promise<unknown> };
const asFn = (m: unknown) => m as unknown as AnyFn;

const SECRET = 'test-webhook-secret-value';

describe('normalizeTwilioStatus', () => {
  it('mappe les statuts terminaux et transitoires', () => {
    expect(normalizeTwilioStatus('delivered')).toBe('delivered');
    expect(normalizeTwilioStatus('undelivered')).toBe('undelivered');
    expect(normalizeTwilioStatus('failed')).toBe('failed');
    expect(normalizeTwilioStatus('sent')).toBe('sent');
    expect(normalizeTwilioStatus('queued')).toBe('queued');
    expect(normalizeTwilioStatus('accepted')).toBe('queued');
    expect(normalizeTwilioStatus('sending')).toBe('queued');
    expect(normalizeTwilioStatus('banana')).toBe('unknown');
  });
});

describe('smsDeliveries.applyStatusWebhook — garde webhook', () => {
  beforeEach(() => {
    process.env.CONVEX_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.CONVEX_WEBHOOK_SECRET;
  });

  it('rejette un mauvais secret AVANT tout accès DB', async () => {
    await expect(
      asFn(applyStatusWebhook)._handler(
        {},
        { webhookSecret: 'wrong', twilioSid: 'SM1', twilioStatus: 'delivered' },
      ),
    ).rejects.toThrow('INVALID_WEBHOOK_SECRET');
  });

  it('rejette quand l’env secret n’est pas configurée', async () => {
    delete process.env.CONVEX_WEBHOOK_SECRET;
    await expect(
      asFn(applyStatusWebhook)._handler(
        {},
        { webhookSecret: SECRET, twilioSid: 'SM1', twilioStatus: 'delivered' },
      ),
    ).rejects.toThrow('WEBHOOK_SECRET_NOT_CONFIGURED');
  });

  it('patche le statut de livraison réel une fois le secret validé', async () => {
    let patched: any = null;
    const ctx = {
      db: {
        query: () => ({
          withIndex: () => ({
            unique: async () => ({ _id: 'sms_1', status: 'sent', errorCode: undefined }),
          }),
        }),
        patch: async (_id: string, p: any) => {
          patched = p;
        },
        insert: async () => 'sms_new',
      },
    };
    const res = await asFn(applyStatusWebhook)._handler(ctx, {
      webhookSecret: SECRET,
      twilioSid: 'SM1',
      twilioStatus: 'undelivered',
      errorCode: '30007',
    });
    expect(res).toMatchObject({ ok: true, created: false });
    expect(patched.status).toBe('undelivered');
    expect(patched.errorCode).toBe('30007');
  });

  it('crée une ligne si le callback précède le record (course rare)', async () => {
    const inserted: any[] = [];
    const ctx = {
      db: {
        query: () => ({ withIndex: () => ({ unique: async () => null }) }),
        patch: async () => {},
        insert: async (_t: string, row: any) => {
          inserted.push(row);
          return 'sms_new';
        },
      },
    };
    const res = await asFn(applyStatusWebhook)._handler(ctx, {
      webhookSecret: SECRET,
      twilioSid: 'SM2',
      twilioStatus: 'delivered',
    });
    expect(res).toMatchObject({ ok: true, created: true });
    expect(inserted[0]).toMatchObject({ twilioSid: 'SM2', status: 'delivered', kind: 'unknown' });
  });
});

describe('summarizeDeliveries', () => {
  const mk = (status: string) => ({ status: status as any });

  it('compte par statut + terminal + undeliveredRate', () => {
    const s = summarizeDeliveries([
      mk('delivered'),
      mk('delivered'),
      mk('undelivered'),
      mk('failed'),
      mk('queued'),
      mk('sent'),
      mk('unknown'),
    ]);
    expect(s.total).toBe(7);
    expect(s.delivered).toBe(2);
    expect(s.undelivered).toBe(1);
    expect(s.failed).toBe(1);
    expect(s.terminal).toBe(4); // delivered + undelivered + failed
    expect(s.undeliveredRate).toBeCloseTo(2 / 4); // (undelivered + failed) / terminal
  });

  it('undeliveredRate = 0 sans statut terminal (pas de division par zéro)', () => {
    const s = summarizeDeliveries([mk('queued'), mk('sent')]);
    expect(s.terminal).toBe(0);
    expect(s.undeliveredRate).toBe(0);
  });
});

describe('smsDeliveries.checkEventDeliverabilityAndAlert — alerte ops F4', () => {
  const mkCtx = (statuses: string[], priorAlert: any = null) => {
    const scheduled: any[] = [];
    const inserted: any[] = [];
    const patched: any[] = [];
    const ctx = {
      db: {
        query: (table: string) => ({
          withIndex: () => ({
            collect: async () => statuses.map((s) => ({ status: s })),
            unique: async () => (table === 'smsDeliveryAlerts' ? priorAlert : null),
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

  afterEach(() => {
    delete process.env.OPS_ALERT_EMAIL;
  });

  it('alerte quand terminal >= seuil ET undeliveredRate >= seuil', async () => {
    // terminal=7, non délivrés=4 → 57 %
    const { ctx, scheduled } = mkCtx([
      'delivered',
      'delivered',
      'delivered',
      'undelivered',
      'undelivered',
      'failed',
      'failed',
    ]);
    const res: any = await asFn(checkEventDeliverabilityAndAlert)._handler(ctx, {
      eventId: 'evt_1',
    });
    expect(res.alerted).toBe(true);
    expect(scheduled).toHaveLength(1);
    const emailArgs = scheduled[0][2]; // runAfter(delay, fnRef, args)
    expect(emailArgs.to).toBe('hello@wedillybird.com');
    expect(emailArgs.subject).toContain('%');
    expect(emailArgs.body).toContain('Mariage Test');
  });

  it('n’alerte PAS sous le seuil de statuts terminaux', async () => {
    const { ctx, scheduled } = mkCtx(['undelivered', 'failed', 'queued']); // terminal=2 < 5
    const res: any = await asFn(checkEventDeliverabilityAndAlert)._handler(ctx, {
      eventId: 'evt_1',
    });
    expect(res.alerted).toBe(false);
    expect(scheduled).toHaveLength(0);
  });

  it('n’alerte PAS quand la livraison est saine (taux sous le seuil)', async () => {
    // terminal=6, non délivrés=1 → 17 %
    const { ctx, scheduled } = mkCtx([
      'delivered',
      'delivered',
      'delivered',
      'delivered',
      'delivered',
      'undelivered',
    ]);
    const res: any = await asFn(checkEventDeliverabilityAndAlert)._handler(ctx, {
      eventId: 'evt_1',
    });
    expect(res.alerted).toBe(false);
    expect(scheduled).toHaveLength(0);
  });

  it('respecte OPS_ALERT_EMAIL', async () => {
    process.env.OPS_ALERT_EMAIL = 'alerts@example.com';
    const { ctx, scheduled } = mkCtx([
      'undelivered',
      'undelivered',
      'undelivered',
      'undelivered',
      'undelivered',
    ]); // terminal=5, taux=100 %
    const res: any = await asFn(checkEventDeliverabilityAndAlert)._handler(ctx, {
      eventId: 'evt_1',
    });
    expect(res.alerted).toBe(true);
    expect(scheduled[0][2].to).toBe('alerts@example.com');
  });

  it('ne ré-alerte pas si un email a déjà été envoyé récemment (dedupe)', async () => {
    const recentAlert = { _id: 'a1', alertedAt: Date.now() - 60_000, undeliveredRate: 0.9 };
    const { ctx, scheduled } = mkCtx(
      ['undelivered', 'undelivered', 'undelivered', 'undelivered', 'undelivered'],
      recentAlert,
    );
    const res: any = await asFn(checkEventDeliverabilityAndAlert)._handler(ctx, {
      eventId: 'evt_1',
    });
    expect(res.alerted).toBe(false);
    expect(res.deduped).toBe(true);
    expect(scheduled).toHaveLength(0);
  });
});

describe('smsDeliveries — réconciliation (cron de secours F4)', () => {
  it('reconcileStaleDeliveries no-op si Twilio non configuré', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    const res: any = await asFn(reconcileStaleDeliveries)._handler({}, {});
    expect(res).toMatchObject({ reconciled: 0, skipped: 'not_configured' });
  });

  it('applyReconciledStatus patche le statut normalisé par SID', async () => {
    const patched: any[] = [];
    const ctx = {
      db: {
        query: () => ({
          withIndex: () => ({ unique: async () => ({ _id: 'sms_1', errorCode: undefined }) }),
        }),
        patch: async (_id: string, p: any) => {
          patched.push(p);
        },
      },
    };
    const res: any = await asFn(applyReconciledStatus)._handler(ctx, {
      twilioSid: 'SM9',
      twilioStatus: 'undelivered',
      errorCode: '30008',
    });
    expect(res.ok).toBe(true);
    expect(patched[0].status).toBe('undelivered');
    expect(patched[0].errorCode).toBe('30008');
  });

  it('applyReconciledStatus no-op si la ligne a disparu', async () => {
    const ctx = {
      db: {
        query: () => ({ withIndex: () => ({ unique: async () => null }) }),
        patch: async () => {
          throw new Error('should not patch');
        },
      },
    };
    const res: any = await asFn(applyReconciledStatus)._handler(ctx, {
      twilioSid: 'SMx',
      twilioStatus: 'delivered',
    });
    expect(res.ok).toBe(false);
  });
});
