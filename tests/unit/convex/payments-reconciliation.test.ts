/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { listStalePending, scanOrphanedEntitlements } from '../../../convex/payments';

/**
 * T2-2 (cron de réconciliation) + T2-8 (monitor entitlement) : ces deux
 * queries sont PUBLIQUES (appelées depuis les routes cron via
 * `ConvexHttpClient`, qui ne peut pas invoquer d'`internalQuery`) mais
 * gardées par `CONVEX_WEBHOOK_SECRET` — même approche comportementale que
 * `webhook-secret-gate.test.ts` : invocation directe du `_handler` avec un
 * ctx minimal / un faux `ctx.db` supportant `.withIndex()`.
 */

type AnyFn = { _handler: (ctx: any, args: any) => Promise<unknown> };
const asFn = (m: unknown) => m as unknown as AnyFn;

const SECRET = 'test-webhook-secret-value';

describe('payments.listStalePending', () => {
  beforeEach(() => {
    process.env.CONVEX_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.CONVEX_WEBHOOK_SECRET;
  });

  it('rejette un mauvais secret AVANT tout accès DB', async () => {
    await expect(
      asFn(listStalePending)._handler({}, { webhookSecret: 'wrong', olderThanMs: 1_000 }),
    ).rejects.toThrow('INVALID_WEBHOOK_SECRET');
  });

  it('interroge by_status_createdAt avec status=pending et createdAt < cutoff, plafonné à 200', async () => {
    const now = Date.now();
    const fixtures = [
      { _id: 'pay_old', status: 'pending', createdAt: now - 40 * 60 * 1000 }, // 40 min → stale
      { _id: 'pay_fresh', status: 'pending', createdAt: now - 2 * 60 * 1000 }, // 2 min → pas stale
    ];
    let capturedIndex: string | undefined;
    const captured: { eq?: unknown; lt?: unknown } = {};
    let takeArg: number | undefined;

    const ctx = {
      db: {
        query: (table: string) => {
          expect(table).toBe('payments');
          return {
            withIndex: (indexName: string, rangeFn: (q: any) => any) => {
              capturedIndex = indexName;
              const qBuilder = {
                eq: (_field: string, val: unknown) => {
                  captured.eq = val;
                  return qBuilder;
                },
                lt: (_field: string, val: unknown) => {
                  captured.lt = val;
                  return qBuilder;
                },
              };
              rangeFn(qBuilder);
              return {
                take: async (n: number) => {
                  takeArg = n;
                  return fixtures.filter(
                    (p) => p.status === captured.eq && p.createdAt < (captured.lt as number),
                  );
                },
              };
            },
          };
        },
      },
    };

    const res = (await asFn(listStalePending)._handler(ctx, {
      webhookSecret: SECRET,
      olderThanMs: 30 * 60 * 1000,
    })) as Array<{ _id: string }>;

    expect(capturedIndex).toBe('by_status_createdAt');
    expect(captured.eq).toBe('pending');
    expect(takeArg).toBe(200);
    expect(res.map((p) => p._id)).toEqual(['pay_old']);
  });
});

describe('payments.scanOrphanedEntitlements', () => {
  beforeEach(() => {
    process.env.CONVEX_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.CONVEX_WEBHOOK_SECRET;
  });

  it('rejette un mauvais secret AVANT tout accès DB', async () => {
    await expect(
      asFn(scanOrphanedEntitlements)._handler({}, { webhookSecret: 'wrong' }),
    ).rejects.toThrow('INVALID_WEBHOOK_SECRET');
  });

  it('signale les events planTier sans AUCUN paiement succeeded, ignore ceux sans planTier', async () => {
    const events = [
      { _id: 'ev_ok', planTier: 'essential' }, // a un paiement succeeded → sain
      { _id: 'ev_orphan_wrong_status', planTier: 'premium' }, // paiements présents, aucun succeeded → offender
      { _id: 'ev_orphan_no_payment', planTier: 'essential' }, // aucun paiement du tout → offender
      { _id: 'ev_draft', planTier: undefined }, // pas encore payé/choisi → hors scope, jamais compté
    ];
    const paymentsByEvent: Record<string, Array<{ status: string }>> = {
      ev_ok: [{ status: 'pending' }, { status: 'succeeded' }],
      ev_orphan_wrong_status: [{ status: 'pending' }, { status: 'failed' }],
      ev_orphan_no_payment: [],
    };

    const ctx = {
      db: {
        query: (table: string) => {
          if (table === 'events') {
            return { collect: async () => events };
          }
          if (table === 'payments') {
            return {
              withIndex: (indexName: string, rangeFn: (q: any) => any) => {
                expect(indexName).toBe('by_event');
                let eventId = '';
                const qBuilder = {
                  eq: (_field: string, val: string) => {
                    eventId = val;
                    return qBuilder;
                  },
                };
                rangeFn(qBuilder);
                return { collect: async () => paymentsByEvent[eventId] ?? [] };
              },
            };
          }
          throw new Error(`unexpected table ${table}`);
        },
      },
    };

    const res = (await asFn(scanOrphanedEntitlements)._handler(ctx, {
      webhookSecret: SECRET,
    })) as { scanned: number; offenders: Array<{ eventId: string; planTier: string }> };

    expect(res.scanned).toBe(3); // ev_draft (planTier undefined) exclu du compte
    expect(res.offenders.map((o) => o.eventId).sort()).toEqual([
      'ev_orphan_no_payment',
      'ev_orphan_wrong_status',
    ]);
  });
});
