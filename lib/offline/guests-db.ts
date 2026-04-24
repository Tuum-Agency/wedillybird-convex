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

class GuestsOfflineDB extends Dexie {
  guests!: Table<CachedGuest, [string, string]>;
  meta!: Table<CacheMeta, string>;

  constructor() {
    super('wedillybird-checkin');
    this.version(1).stores({
      guests: '[eventId+qrCodeToken], eventId, checkedInAt',
      meta: 'eventId',
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
