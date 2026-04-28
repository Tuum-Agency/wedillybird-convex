import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  countPendingCheckIns,
  drainPendingCheckIns,
  enqueueCheckIn,
  listPendingCheckIns,
} from '@/lib/checkin/queue';

const EVENT_A = 'evt_a';
const EVENT_B = 'evt_b';

beforeEach(async () => {
  const { indexedDB } = await import('fake-indexeddb');
  globalThis.indexedDB = indexedDB;
  await new Promise<void>((resolve) => {
    const req = globalThis.indexedDB.deleteDatabase('wedillybird-checkin-queue');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe('checkin/queue', () => {
  it('enqueues and counts pending check-ins per event', async () => {
    await enqueueCheckIn({ eventId: EVENT_A, token: 'TK1', scannedAt: 100 });
    await enqueueCheckIn({ eventId: EVENT_A, token: 'TK2', scannedAt: 200 });
    await enqueueCheckIn({ eventId: EVENT_B, token: 'TK3', scannedAt: 300 });

    expect(await countPendingCheckIns(EVENT_A)).toBe(2);
    expect(await countPendingCheckIns(EVENT_B)).toBe(1);
  });

  it('lists pending in FIFO order', async () => {
    await enqueueCheckIn({ eventId: EVENT_A, token: 'TK1', scannedAt: 100 });
    await enqueueCheckIn({ eventId: EVENT_A, token: 'TK2', scannedAt: 110 });
    await enqueueCheckIn({ eventId: EVENT_A, token: 'TK3', scannedAt: 120 });

    const items = await listPendingCheckIns(EVENT_A);
    expect(items.map((i) => i.token)).toEqual(['TK1', 'TK2', 'TK3']);
  });

  it('drain posts the queue and removes successfully synced items', async () => {
    await enqueueCheckIn({ eventId: EVENT_A, token: 'TK1', scannedAt: 100 });
    await enqueueCheckIn({ eventId: EVENT_A, token: 'TK2', scannedAt: 200 });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        results: [
          { token: 'TK1', ok: true, alreadyCheckedIn: false },
          { token: 'TK2', ok: true, alreadyCheckedIn: true },
        ],
      }),
    } as Response);

    const result = await drainPendingCheckIns(EVENT_A, fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.eventId).toBe(EVENT_A);
    expect(body.checkIns).toHaveLength(2);

    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(await countPendingCheckIns(EVENT_A)).toBe(0);
  });

  it('drain keeps failed items in queue and marks them not-ok', async () => {
    await enqueueCheckIn({ eventId: EVENT_A, token: 'TK1', scannedAt: 100 });
    await enqueueCheckIn({ eventId: EVENT_A, token: 'TK2', scannedAt: 200 });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        results: [
          { token: 'TK1', ok: true, alreadyCheckedIn: false },
          { token: 'TK2', ok: false, error: 'GUEST_NOT_FOUND' },
        ],
      }),
    } as Response);

    const result = await drainPendingCheckIns(EVENT_A, fetchMock as unknown as typeof fetch);
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(1);
    expect(await countPendingCheckIns(EVENT_A)).toBe(1);
    const remaining = await listPendingCheckIns(EVENT_A);
    expect(remaining[0]?.token).toBe('TK2');
  });

  it('drain returns failed/total when fetch throws (network down)', async () => {
    await enqueueCheckIn({ eventId: EVENT_A, token: 'TK1', scannedAt: 100 });

    const fetchMock = vi.fn().mockRejectedValue(new Error('NETWORK_DOWN'));
    const result = await drainPendingCheckIns(EVENT_A, fetchMock as unknown as typeof fetch);
    expect(result.failed).toBe(1);
    expect(result.synced).toBe(0);
    expect(await countPendingCheckIns(EVENT_A)).toBe(1);
  });

  it('drain handles HTTP error response', async () => {
    await enqueueCheckIn({ eventId: EVENT_A, token: 'TK1', scannedAt: 100 });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);
    const result = await drainPendingCheckIns(EVENT_A, fetchMock as unknown as typeof fetch);
    expect(result.failed).toBe(1);
    expect(await countPendingCheckIns(EVENT_A)).toBe(1);
  });

  it('drain on empty queue is a no-op', async () => {
    const fetchMock = vi.fn();
    const result = await drainPendingCheckIns(EVENT_A, fetchMock as unknown as typeof fetch);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 0, synced: 0, failed: 0, items: [] });
  });
});
