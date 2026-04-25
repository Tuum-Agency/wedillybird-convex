import Dexie, { type Table } from 'dexie';

export interface CachedGuest {
  eventId: string;
  qrCodeToken: string;
  _id: string;
  fullName: string;
  category?: string;
  plusOnesAllowed: number;
  rsvpStatus: 'pending' | 'attending' | 'declined' | 'maybe';
  checkedInAt?: number;
  cachedAt: number;
}

export interface CacheMeta {
  eventId: string;
  lastSyncedAt: number;
  guestCount: number;
}

export type PendingCheckInStatus = 'pending' | 'synced' | 'failed';

export interface PendingCheckIn {
  /** Auto-incremented Dexie primary key. */
  id?: number;
  qrCodeToken: string;
  eventId: string;
  scannedAt: number;
  syncStatus: PendingCheckInStatus;
  lastError?: string;
  attempts: number;
}

class GuestsOfflineDB extends Dexie {
  guests!: Table<CachedGuest, [string, string]>;
  meta!: Table<CacheMeta, string>;
  pendingCheckIns!: Table<PendingCheckIn, number>;

  constructor() {
    super('wedillybird-checkin');
    this.version(1).stores({
      guests: '[eventId+qrCodeToken], eventId, checkedInAt',
      meta: 'eventId',
    });
    this.version(2).stores({
      guests: '[eventId+qrCodeToken], eventId, checkedInAt',
      meta: 'eventId',
      pendingCheckIns: '++id, eventId, syncStatus, [eventId+syncStatus], qrCodeToken',
    });
  }
}

let db: GuestsOfflineDB | null = null;

export function getGuestsDb(): GuestsOfflineDB {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in the browser');
  }
  if (!db) db = new GuestsOfflineDB();
  return db;
}

export async function cacheGuestsForEvent(
  eventId: string,
  guests: Array<{
    _id: string;
    fullName: string;
    category?: string;
    plusOnesAllowed: number;
    rsvpStatus: 'pending' | 'attending' | 'declined' | 'maybe';
    qrCodeToken: string;
    checkedInAt?: number;
  }>,
): Promise<void> {
  const now = Date.now();
  const d = getGuestsDb();
  const rows: CachedGuest[] = guests.map((g) => ({
    eventId,
    qrCodeToken: g.qrCodeToken,
    _id: g._id,
    fullName: g.fullName,
    category: g.category,
    plusOnesAllowed: g.plusOnesAllowed,
    rsvpStatus: g.rsvpStatus,
    checkedInAt: g.checkedInAt,
    cachedAt: now,
  }));

  await d.transaction('rw', d.guests, d.meta, async () => {
    await d.guests.where('eventId').equals(eventId).delete();
    if (rows.length > 0) await d.guests.bulkPut(rows);
    await d.meta.put({ eventId, lastSyncedAt: now, guestCount: rows.length });
  });
}

export async function findGuestByToken(
  eventId: string,
  token: string,
): Promise<CachedGuest | undefined> {
  const d = getGuestsDb();
  return d.guests.get([eventId, token]);
}

export async function markCachedCheckedIn(
  eventId: string,
  token: string,
  checkedInAt: number | undefined,
): Promise<void> {
  const d = getGuestsDb();
  const guest = await d.guests.get([eventId, token]);
  if (!guest) return;
  await d.guests.put({ ...guest, checkedInAt });
}

export async function getCacheMeta(eventId: string): Promise<CacheMeta | undefined> {
  const d = getGuestsDb();
  return d.meta.get(eventId);
}

/* -------------------------------------------------------------------------- */
/*  Pending check-ins queue (offline → online drain)                          */
/* -------------------------------------------------------------------------- */

/**
 * Queue an offline check-in for later sync. Idempotent on (eventId, qrCodeToken):
 * if a pending row already exists, the existing scannedAt is kept (first scan wins).
 */
export async function queueCheckIn(
  eventId: string,
  qrCodeToken: string,
  scannedAt: number = Date.now(),
): Promise<PendingCheckIn> {
  const d = getGuestsDb();
  return d.transaction('rw', d.pendingCheckIns, async () => {
    const existing = await d.pendingCheckIns
      .where('qrCodeToken')
      .equals(qrCodeToken)
      .filter((row) => row.eventId === eventId && row.syncStatus !== 'synced')
      .first();
    if (existing) return existing;
    const id = await d.pendingCheckIns.add({
      eventId,
      qrCodeToken,
      scannedAt,
      syncStatus: 'pending',
      attempts: 0,
    });
    return { id, eventId, qrCodeToken, scannedAt, syncStatus: 'pending', attempts: 0 };
  });
}

export async function listPendingCheckIns(eventId?: string): Promise<PendingCheckIn[]> {
  const d = getGuestsDb();
  if (eventId) {
    return d.pendingCheckIns.where('[eventId+syncStatus]').equals([eventId, 'pending']).toArray();
  }
  return d.pendingCheckIns.where('syncStatus').equals('pending').toArray();
}

export async function countPendingCheckIns(eventId?: string): Promise<number> {
  const items = await listPendingCheckIns(eventId);
  return items.length;
}

export interface DrainCheckInResult {
  ok: string[];
  failed: Array<{ token: string; error: string }>;
}

/**
 * Drain pending check-ins by POSTing them in bulk to {@link endpoint} (default
 * `/api/checkin/sync`). Marks each row as `synced` or `failed` based on the
 * server response. Idempotent: rows already `synced` are skipped.
 */
export async function drainPendingCheckIns(
  endpoint: string = '/api/checkin/sync',
  fetchImpl: typeof fetch = typeof fetch !== 'undefined'
    ? fetch
    : ((() => Promise.reject(new Error('NO_FETCH'))) as typeof fetch),
): Promise<DrainCheckInResult> {
  const d = getGuestsDb();
  const pending = await d.pendingCheckIns.where('syncStatus').equals('pending').toArray();
  if (pending.length === 0) {
    return { ok: [], failed: [] };
  }

  // Group by eventId — the API expects a single eventId per call so the server
  // can authorize ownership once. Most check-in sessions involve a single event.
  const byEvent = new Map<string, PendingCheckIn[]>();
  for (const row of pending) {
    const list = byEvent.get(row.eventId) ?? [];
    list.push(row);
    byEvent.set(row.eventId, list);
  }

  const ok: string[] = [];
  const failed: Array<{ token: string; error: string }> = [];

  for (const [eventId, rows] of byEvent) {
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          checkIns: rows.map((r) => ({ qrCodeToken: r.qrCodeToken, scannedAt: r.scannedAt })),
        }),
      });
      if (!response.ok) {
        const error = `HTTP_${response.status}`;
        for (const r of rows) {
          if (r.id !== undefined) {
            await d.pendingCheckIns.update(r.id, {
              syncStatus: 'failed',
              lastError: error,
              attempts: r.attempts + 1,
            });
          }
          failed.push({ token: r.qrCodeToken, error });
        }
        continue;
      }
      const body = (await response.json()) as DrainCheckInResult;
      const okSet = new Set(body.ok ?? []);
      const failedMap = new Map((body.failed ?? []).map((f) => [f.token, f.error] as const));
      for (const r of rows) {
        if (r.id === undefined) continue;
        if (okSet.has(r.qrCodeToken)) {
          await d.pendingCheckIns.update(r.id, {
            syncStatus: 'synced',
            attempts: r.attempts + 1,
          });
          ok.push(r.qrCodeToken);
        } else if (failedMap.has(r.qrCodeToken)) {
          const error = failedMap.get(r.qrCodeToken) ?? 'UNKNOWN';
          await d.pendingCheckIns.update(r.id, {
            syncStatus: 'failed',
            lastError: error,
            attempts: r.attempts + 1,
          });
          failed.push({ token: r.qrCodeToken, error });
        } else {
          // Server didn't acknowledge — leave as pending for retry.
          await d.pendingCheckIns.update(r.id, { attempts: r.attempts + 1 });
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'UNKNOWN';
      for (const r of rows) {
        if (r.id !== undefined) {
          await d.pendingCheckIns.update(r.id, {
            syncStatus: 'failed',
            lastError: error,
            attempts: r.attempts + 1,
          });
        }
        failed.push({ token: r.qrCodeToken, error });
      }
    }
  }

  return { ok, failed };
}

/** Test helper: clears all pending check-ins (status pending+synced+failed). */
export async function clearPendingCheckIns(): Promise<void> {
  const d = getGuestsDb();
  await d.pendingCheckIns.clear();
}
