/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyStatusWebhook, normalizeTwilioStatus } from '../../../convex/smsDeliveries';

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
