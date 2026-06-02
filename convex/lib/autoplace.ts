/**
 * Placement automatique des invités sur les tables (plan de table v2).
 *
 * Heuristique simple et déterministe :
 *  1. Regroupe les invités par catégorie (Famille, Amis, Travail…), en
 *     conservant l'ordre d'apparition. Les invités sans catégorie forment un
 *     groupe « autres ».
 *  2. Place chaque groupe en gardant ses invités ensemble : on privilégie une
 *     table vide (fraîche) pour démarrer un groupe, puis n'importe quelle table
 *     avec de la place, puis on crée une nouvelle table au besoin.
 *  3. Respecte la capacité : un invité occupe `seats` places (lui + ses
 *     accompagnants confirmés). On ne dépasse jamais la capacité restante.
 *
 * Pur (aucun accès DB) → testable unitairement. La mutation `autoAssignGuests`
 * matérialise le résultat (création des tables + assignations).
 */

export interface AutoPlaceGuest {
  _id: string;
  seats: number;
  category?: string;
}

export interface AutoPlaceTable {
  _id: string;
  /** Places encore libres sur la table (capacité − occupation actuelle). */
  remaining: number;
}

export interface AutoPlaceResult {
  /** Assignations vers des tables existantes. */
  assignments: Array<{ guestId: string; tableId: string }>;
  /** Nouvelles tables à créer, avec les invités à y placer. */
  newTables: Array<{ capacity: number; guestIds: string[] }>;
}

interface Bucket {
  tableId: string | null; // null = nouvelle table à créer
  remaining: number;
  capacity: number;
  guestIds: string[];
}

const NO_CATEGORY = '__none__';

export function autoPlace(
  unassigned: AutoPlaceGuest[],
  tables: AutoPlaceTable[],
  defaultCapacity: number,
): AutoPlaceResult {
  const cap = defaultCapacity > 0 ? defaultCapacity : 8;
  const buckets: Bucket[] = tables.map((t) => ({
    tableId: t._id,
    remaining: Math.max(0, t.remaining),
    capacity: Math.max(0, t.remaining),
    guestIds: [],
  }));

  // Groupe par catégorie en conservant l'ordre d'apparition.
  const groups = new Map<string, AutoPlaceGuest[]>();
  for (const g of unassigned) {
    const key = g.category && g.category.trim() ? g.category.trim() : NO_CATEGORY;
    const arr = groups.get(key) ?? [];
    arr.push(g);
    groups.set(key, arr);
  }

  for (const guests of groups.values()) {
    let lastBucket: Bucket | null = null;
    for (const guest of guests) {
      const seats = Math.max(1, guest.seats);

      // 1) Continuer sur la table déjà entamée pour ce groupe si possible.
      let target: Bucket | null = lastBucket && lastBucket.remaining >= seats ? lastBucket : null;
      // 2) Sinon, privilégier une table vide (démarre proprement le groupe).
      if (!target) {
        target = buckets.find((b) => b.guestIds.length === 0 && b.remaining >= seats) ?? null;
      }
      // 3) Sinon, n'importe quelle table avec de la place.
      if (!target) {
        target = buckets.find((b) => b.remaining >= seats) ?? null;
      }
      // 4) Sinon, ouvrir une nouvelle table (dimensionnée pour le groupe).
      if (!target) {
        const capacity = Math.max(cap, seats);
        target = { tableId: null, remaining: capacity, capacity, guestIds: [] };
        buckets.push(target);
      }

      target.guestIds.push(guest._id);
      target.remaining -= seats;
      lastBucket = target;
    }
  }

  const assignments: AutoPlaceResult['assignments'] = [];
  const newTables: AutoPlaceResult['newTables'] = [];
  for (const b of buckets) {
    if (b.guestIds.length === 0) continue;
    if (b.tableId) {
      for (const guestId of b.guestIds) assignments.push({ guestId, tableId: b.tableId });
    } else {
      newTables.push({ capacity: b.capacity, guestIds: b.guestIds });
    }
  }
  return { assignments, newTables };
}
