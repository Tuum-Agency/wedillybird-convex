/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { purgeExpiredBiometricData } from '../../../convex/events';

/**
 * Cron de purge biométrique (Lane T3, F7) : supprime la Face Collection
 * Rekognition + les rows `photoFaces` de tout event dont `galleryExpiresAt`
 * est dépassé, qu'il ait été archivé ou non. Miroir du cleanup déjà fait par
 * `archive()` (même helper partagé `cleanupEventFaceCollection`).
 */

type AnyFn = { _handler: (ctx: any, args: any) => Promise<any> };
const purgeFn = purgeExpiredBiometricData as unknown as AnyFn;

interface MockEvent {
  _id: string;
  faceCollectionId?: string;
  galleryExpiresAt?: number;
}

function buildCtx(events: MockEvent[], photoFacesByEvent: Record<string, Array<{ _id: string }>>) {
  const deleteCalls: string[] = [];
  const scheduleCalls: Array<{ ref: unknown; args: unknown }> = [];
  const patchCalls: Array<{ id: string; patch: any }> = [];

  const ctx = {
    db: {
      query: vi.fn((table: string) => {
        if (table === 'events') {
          return { collect: async () => events };
        }
        if (table === 'photoFaces') {
          return {
            withIndex: (_indexName: string, filter: (q: any) => any) => {
              const captured: Record<string, unknown> = {};
              filter({
                eq: (field: string, value: unknown) => {
                  captured[field] = value;
                  return { eq: (f: string, v: unknown) => (captured[f] = v) };
                },
              });
              return { collect: async () => photoFacesByEvent[captured.eventId as string] ?? [] };
            },
          };
        }
        throw new Error(`Unexpected query on table=${table}`);
      }),
      delete: vi.fn(async (id: string) => {
        deleteCalls.push(id);
      }),
      patch: vi.fn(async (id: string, patch: any) => {
        patchCalls.push({ id, patch });
      }),
    },
    scheduler: {
      runAfter: vi.fn(async (_delay: number, ref: unknown, args: unknown) => {
        scheduleCalls.push({ ref, args });
      }),
    },
  };

  return { ctx, deleteCalls, scheduleCalls, patchCalls };
}

describe('purgeExpiredBiometricData — cron quotidien', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-25T03:00:00Z'));
  });

  it('purge un event avec galerie expirée et faceCollectionId — supprime photoFaces + schedule + patch', async () => {
    const past = Date.now() - 1000;
    const events: MockEvent[] = [
      { _id: 'evt_expired', faceCollectionId: 'wb-event-evt_expired', galleryExpiresAt: past },
    ];
    const { ctx, deleteCalls, scheduleCalls, patchCalls } = buildCtx(events, {
      evt_expired: [{ _id: 'pf_1' }, { _id: 'pf_2' }],
    });

    const res = await purgeFn._handler(ctx, {});

    expect(res).toEqual({ ok: true, purged: 1 });
    expect(deleteCalls).toEqual(['pf_1', 'pf_2']);
    expect(scheduleCalls).toHaveLength(1);
    expect(scheduleCalls[0]?.args).toEqual({ collectionId: 'wb-event-evt_expired' });
    expect(patchCalls).toHaveLength(1);
    expect(patchCalls[0]).toMatchObject({
      id: 'evt_expired',
      patch: { faceCollectionId: undefined, faceSearchEnabled: false },
    });
  });

  it('ignore un event dont la galerie n’est pas encore expirée', async () => {
    const future = Date.now() + 1000 * 60 * 60;
    const events: MockEvent[] = [
      { _id: 'evt_active', faceCollectionId: 'wb-event-evt_active', galleryExpiresAt: future },
    ];
    const { ctx, deleteCalls, scheduleCalls, patchCalls } = buildCtx(events, {});

    const res = await purgeFn._handler(ctx, {});

    expect(res).toEqual({ ok: true, purged: 0 });
    expect(deleteCalls).toEqual([]);
    expect(scheduleCalls).toEqual([]);
    expect(patchCalls).toEqual([]);
  });

  it('ignore un event sans faceCollectionId (rien à purger), même expiré', async () => {
    const past = Date.now() - 1000;
    const events: MockEvent[] = [{ _id: 'evt_no_collection', galleryExpiresAt: past }];
    const { ctx, scheduleCalls, patchCalls } = buildCtx(events, {});

    const res = await purgeFn._handler(ctx, {});

    expect(res).toEqual({ ok: true, purged: 0 });
    expect(scheduleCalls).toEqual([]);
    expect(patchCalls).toEqual([]);
  });

  it('idempotent : un event déjà purgé (faceCollectionId undefined) ne remonte plus au run suivant', async () => {
    // Simule le state APRÈS un premier passage : faceCollectionId a été clear.
    const past = Date.now() - 1000;
    const events: MockEvent[] = [
      { _id: 'evt_already_purged', faceCollectionId: undefined, galleryExpiresAt: past },
    ];
    const { ctx, deleteCalls, scheduleCalls, patchCalls } = buildCtx(events, {});

    const res = await purgeFn._handler(ctx, {});

    expect(res).toEqual({ ok: true, purged: 0 });
    expect(deleteCalls).toEqual([]);
    expect(scheduleCalls).toEqual([]);
    expect(patchCalls).toEqual([]);
  });

  it('purge plusieurs events éligibles en un seul run et laisse les autres intacts', async () => {
    const past = Date.now() - 1000;
    const future = Date.now() + 1000;
    const events: MockEvent[] = [
      { _id: 'evt_a', faceCollectionId: 'wb-event-a', galleryExpiresAt: past },
      { _id: 'evt_b', faceCollectionId: 'wb-event-b', galleryExpiresAt: future },
      { _id: 'evt_c', faceCollectionId: 'wb-event-c', galleryExpiresAt: past },
    ];
    const { ctx, scheduleCalls, patchCalls } = buildCtx(events, { evt_a: [], evt_c: [] });

    const res = await purgeFn._handler(ctx, {});

    expect(res).toEqual({ ok: true, purged: 2 });
    expect(scheduleCalls.map((c) => c.args)).toEqual([
      { collectionId: 'wb-event-a' },
      { collectionId: 'wb-event-c' },
    ]);
    expect(patchCalls.map((c) => c.id)).toEqual(['evt_a', 'evt_c']);
  });
});
