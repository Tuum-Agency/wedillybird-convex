import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  cacheGuestsForEvent,
  countPendingCheckIns,
  drainPendingCheckIns,
  findGuestByToken,
  getCacheMeta,
  listPendingCheckIns,
  markCachedCheckedIn,
  queueCheckIn,
} from '@/lib/offline/guests-db';

const EVENT_A = 'evt_a';
const EVENT_B = 'evt_b';

const guestsA = [
  {
    _id: 'g1',
    fullName: 'Aminata',
    plusOnesAllowed: 2,
    rsvpStatus: 'attending' as const,
    qrCodeToken: 'TK1',
  },
  {
    _id: 'g2',
    fullName: 'Mamadou',
    plusOnesAllowed: 0,
    rsvpStatus: 'pending' as const,
    qrCodeToken: 'TK2',
  },
];

const guestsB = [
  {
    _id: 'g3',
    fullName: 'Awa',
    plusOnesAllowed: 1,
    rsvpStatus: 'attending' as const,
    qrCodeToken: 'TK1', // same token as EVENT_A → must not collide
    checkedInAt: 1000,
  },
];

beforeEach(async () => {
  const { indexedDB } = await import('fake-indexeddb');
  globalThis.indexedDB = indexedDB;
  // Force a clean DB for each test
  await new Promise<void>((resolve) => {
    const req = globalThis.indexedDB.deleteDatabase('wedillybird-checkin');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe('offline/guests-db', () => {
  it('caches guests by event and returns them by token', async () => {
    await cacheGuestsForEvent(EVENT_A, guestsA);

    const g1 = await findGuestByToken(EVENT_A, 'TK1');
    expect(g1?.fullName).toBe('Aminata');
    expect(g1?.plusOnesAllowed).toBe(2);

    const missing = await findGuestByToken(EVENT_A, 'UNKNOWN');
    expect(missing).toBeUndefined();
  });

  it('scopes tokens per event (same token across events does not collide)', async () => {
    await cacheGuestsForEvent(EVENT_A, guestsA);
    await cacheGuestsForEvent(EVENT_B, guestsB);

    const inA = await findGuestByToken(EVENT_A, 'TK1');
    const inB = await findGuestByToken(EVENT_B, 'TK1');
    expect(inA?.fullName).toBe('Aminata');
    expect(inB?.fullName).toBe('Awa');
  });

  it('replaces an event cache on re-sync', async () => {
    await cacheGuestsForEvent(EVENT_A, guestsA);
    await cacheGuestsForEvent(EVENT_A, [
      {
        _id: 'g9',
        fullName: 'New',
        plusOnesAllowed: 0,
        rsvpStatus: 'attending',
        qrCodeToken: 'NEW',
      },
    ]);
    const old = await findGuestByToken(EVENT_A, 'TK1');
    const neo = await findGuestByToken(EVENT_A, 'NEW');
    expect(old).toBeUndefined();
    expect(neo?.fullName).toBe('New');
  });

  it('records sync metadata', async () => {
    const before = Date.now();
    await cacheGuestsForEvent(EVENT_A, guestsA);
    const meta = await getCacheMeta(EVENT_A);
    expect(meta?.guestCount).toBe(2);
    expect(meta?.lastSyncedAt).toBeGreaterThanOrEqual(before);
  });

  it('markCachedCheckedIn updates a cached guest and tolerates unknown tokens', async () => {
    await cacheGuestsForEvent(EVENT_A, guestsA);
    await markCachedCheckedIn(EVENT_A, 'TK1', 42);
    const updated = await findGuestByToken(EVENT_A, 'TK1');
    expect(updated?.checkedInAt).toBe(42);

    await expect(markCachedCheckedIn(EVENT_A, 'NOPE', 42)).resolves.toBeUndefined();
  });
});

describe('offline/pending-checkins', () => {
  it('queueCheckIn creates a pending row', async () => {
    await queueCheckIn(EVENT_A, 'TK1', 1000);
    const pending = await listPendingCheckIns(EVENT_A);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.qrCodeToken).toBe('TK1');
    expect(pending[0]?.scannedAt).toBe(1000);
    expect(pending[0]?.syncStatus).toBe('pending');
  });

  it('queueCheckIn is idempotent on (eventId, token)', async () => {
    await queueCheckIn(EVENT_A, 'TK1', 1000);
    await queueCheckIn(EVENT_A, 'TK1', 2000);
    await queueCheckIn(EVENT_A, 'TK1', 3000);
    const pending = await listPendingCheckIns(EVENT_A);
    expect(pending).toHaveLength(1);
    // First-write-wins: scannedAt of the first queued entry is preserved.
    expect(pending[0]?.scannedAt).toBe(1000);
  });

  it('queueCheckIn scopes per event', async () => {
    await queueCheckIn(EVENT_A, 'TK1', 1000);
    await queueCheckIn(EVENT_B, 'TK1', 2000);
    expect(await countPendingCheckIns(EVENT_A)).toBe(1);
    expect(await countPendingCheckIns(EVENT_B)).toBe(1);
    expect(await countPendingCheckIns()).toBe(2);
  });

  it('drainPendingCheckIns POSTs to endpoint and marks rows synced', async () => {
    await queueCheckIn(EVENT_A, 'TK1', 1000);
    await queueCheckIn(EVENT_A, 'TK2', 1100);

    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string) as {
        eventId: string;
        checkIns: Array<{ qrCodeToken: string }>;
      };
      expect(body.eventId).toBe(EVENT_A);
      expect(body.checkIns).toHaveLength(2);
      return new Response(JSON.stringify({ ok: ['TK1', 'TK2'], failed: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const result = await drainPendingCheckIns('/api/checkin/sync', fetchMock);
    expect(result.ok).toEqual(['TK1', 'TK2']);
    expect(result.failed).toEqual([]);
    expect(await countPendingCheckIns(EVENT_A)).toBe(0);
  });

  it('drainPendingCheckIns marks failed rows when server reports them', async () => {
    await queueCheckIn(EVENT_A, 'TK1', 1000);
    await queueCheckIn(EVENT_A, 'TK2', 1100);

    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: ['TK1'],
            failed: [{ token: 'TK2', error: 'GUEST_NOT_FOUND' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    ) as unknown as typeof fetch;

    const result = await drainPendingCheckIns('/api/checkin/sync', fetchMock);
    expect(result.ok).toEqual(['TK1']);
    expect(result.failed).toEqual([{ token: 'TK2', error: 'GUEST_NOT_FOUND' }]);

    // No more rows are 'pending'; failed row remains stored as 'failed'.
    expect(await countPendingCheckIns(EVENT_A)).toBe(0);
  });

  it('drainPendingCheckIns marks failed rows when fetch throws', async () => {
    await queueCheckIn(EVENT_A, 'TK1', 1000);

    const fetchMock = vi.fn(async () => {
      throw new Error('NETWORK_DOWN');
    }) as unknown as typeof fetch;

    const result = await drainPendingCheckIns('/api/checkin/sync', fetchMock);
    expect(result.failed).toEqual([{ token: 'TK1', error: 'NETWORK_DOWN' }]);
    expect(await countPendingCheckIns(EVENT_A)).toBe(0);
  });

  it('drainPendingCheckIns is a no-op when nothing is queued', async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    const result = await drainPendingCheckIns('/api/checkin/sync', fetchMock);
    expect(result).toEqual({ ok: [], failed: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
