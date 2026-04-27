import Dexie, { type Table } from 'dexie';

/**
 * Queue Dexie pour les check-ins effectués offline.
 *
 * Le jour J, le scanner peut perdre le réseau (lieu rural, salle profonde).
 * Quand `navigator.onLine` est false, on enregistre le scan dans cette queue
 * locale, on affiche un toast "en attente de synchronisation", puis on draine
 * la queue dès que `online` revient (event listener côté composant).
 *
 * - `id` auto-incrémenté pour préserver l'ordre d'arrivée (un même invité peut
 *   être scanné 2× : on garde la 1ère, le serveur retourne `alreadyCheckedIn`
 *   pour les suivantes — pattern idempotent).
 * - `scannedAt` = timestamp local du scan (= moment réel d'arrivée), pas le
 *   timestamp de sync. Utilisé tel quel par le serveur pour patcher
 *   `guests.checkedInAt`.
 */
export interface PendingCheckIn {
  id?: number;
  eventId: string;
  token: string;
  scannedAt: number;
}

class CheckInQueueDB extends Dexie {
  pendingCheckIns!: Table<PendingCheckIn, number>;

  constructor() {
    super('wedillybird-checkin-queue');
    this.version(1).stores({
      pendingCheckIns: '++id, eventId, token, scannedAt',
    });
  }
}

let db: CheckInQueueDB | null = null;

export function getQueueDb(): CheckInQueueDB {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in the browser');
  }
  if (!db) db = new CheckInQueueDB();
  return db;
}

/** Ajoute un check-in offline à la queue. */
export async function enqueueCheckIn(input: {
  eventId: string;
  token: string;
  scannedAt: number;
}): Promise<number> {
  const d = getQueueDb();
  return (await d.pendingCheckIns.add({
    eventId: input.eventId,
    token: input.token,
    scannedAt: input.scannedAt,
  })) as number;
}

/** Liste tous les check-ins en attente pour un event (ordre FIFO). */
export async function listPendingCheckIns(eventId: string): Promise<PendingCheckIn[]> {
  const d = getQueueDb();
  return d.pendingCheckIns.where('eventId').equals(eventId).sortBy('id');
}

/** Compte les check-ins en attente pour un event. */
export async function countPendingCheckIns(eventId: string): Promise<number> {
  const d = getQueueDb();
  return d.pendingCheckIns.where('eventId').equals(eventId).count();
}

/** Supprime des entrées par id (post-sync réussi). */
export async function removePendingCheckIns(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const d = getQueueDb();
  await d.pendingCheckIns.bulkDelete(ids);
}

/** Reset complet (tests / outil de debug). */
export async function clearPendingCheckIns(eventId: string): Promise<void> {
  const d = getQueueDb();
  await d.pendingCheckIns.where('eventId').equals(eventId).delete();
}

interface DrainResultItem {
  id: number;
  token: string;
  ok: boolean;
  alreadyCheckedIn?: boolean;
  error?: string;
}

export interface DrainResult {
  total: number;
  synced: number;
  failed: number;
  items: DrainResultItem[];
}

/**
 * Vide la queue en POST-ant tous les pending vers `/api/checkin/sync`.
 *
 * Le serveur traite chaque entrée idempotamment (un check-in déjà appliqué
 * retourne `alreadyCheckedIn: true` sans erreur). Les entrées synchronisées
 * avec succès sont supprimées localement ; celles qui échouent (réseau,
 * 401, mauvais token) restent en place pour un retry suivant.
 *
 * `fetchImpl` est injectable pour les tests.
 */
export async function drainPendingCheckIns(
  eventId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DrainResult> {
  const items = await listPendingCheckIns(eventId);
  if (items.length === 0) {
    return { total: 0, synced: 0, failed: 0, items: [] };
  }

  let response: Response;
  try {
    response = await fetchImpl('/api/checkin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        checkIns: items.map((it) => ({
          token: it.token,
          scannedAt: it.scannedAt,
        })),
      }),
    });
  } catch (err) {
    // Réseau down — on reste avec la queue en place.
    return {
      total: items.length,
      synced: 0,
      failed: items.length,
      items: items.map((it) => ({
        id: it.id!,
        token: it.token,
        ok: false,
        error: err instanceof Error ? err.message : 'NETWORK_ERROR',
      })),
    };
  }

  if (!response.ok) {
    return {
      total: items.length,
      synced: 0,
      failed: items.length,
      items: items.map((it) => ({
        id: it.id!,
        token: it.token,
        ok: false,
        error: `HTTP_${response.status}`,
      })),
    };
  }

  const json = (await response.json()) as {
    results?: Array<{ token: string; ok: boolean; alreadyCheckedIn?: boolean; error?: string }>;
  };
  const byToken = new Map<string, { ok: boolean; alreadyCheckedIn?: boolean; error?: string }>();
  for (const r of json.results ?? []) byToken.set(r.token, r);

  const idsToDelete: number[] = [];
  const resultItems: DrainResultItem[] = [];
  for (const it of items) {
    const r = byToken.get(it.token);
    if (r && r.ok) {
      idsToDelete.push(it.id!);
      resultItems.push({
        id: it.id!,
        token: it.token,
        ok: true,
        alreadyCheckedIn: r.alreadyCheckedIn,
      });
    } else {
      resultItems.push({
        id: it.id!,
        token: it.token,
        ok: false,
        error: r?.error ?? 'UNKNOWN',
      });
    }
  }

  await removePendingCheckIns(idsToDelete);

  return {
    total: items.length,
    synced: idsToDelete.length,
    failed: items.length - idsToDelete.length,
    items: resultItems,
  };
}
