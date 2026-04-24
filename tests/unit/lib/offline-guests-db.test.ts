import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  cacheGuestsForEvent,
  findGuestByToken,
  getCacheMeta,
  markCachedCheckedIn,
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
