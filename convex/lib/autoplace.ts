/**
 * Placement automatique des invités sur les tables (plan de table v2).
 *
 * Heuristique déterministe, paramétrable par l'agence (réglages exposés dans
 * l'UI « Auto-placer ») :
 *
 *  - **groupByCategory** : regroupe d'abord les personnes par catégorie
 *    (Famille, Amis, Collègues, Prestataires…) — on assoit ensemble ceux qui
 *    vont ensemble. Désactivé → un seul groupe (ordre d'arrivée).
 *  - **keepGroupsTogether** : démarre chaque groupe sur une table fraîche et le
 *    garde sur le moins de tables possible. Désactivé → simple remplissage.
 *  - **balanceTables** : répartit pour équilibrer le remplissage (table la plus
 *    vide d'abord). Désactivé → tasse les tables au maximum (remplissage serré).
 *  - **createTables** : ouvre de nouvelles tables quand tout est plein.
 *    Désactivé → laisse les surplus non placés (renvoyés dans `unplaced`).
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

export interface AutoPlaceOptions {
  groupByCategory?: boolean;
  keepGroupsTogether?: boolean;
  balanceTables?: boolean;
  createTables?: boolean;
}

export interface AutoPlaceResult {
  /** Assignations vers des tables existantes. */
  assignments: Array<{ guestId: string; tableId: string }>;
  /** Nouvelles tables à créer, avec les invités à y placer. */
  newTables: Array<{ capacity: number; guestIds: string[] }>;
  /** Personnes qui n'ont pas pu être placées (createTables désactivé, plus de place). */
  unplaced: string[];
}

interface Bucket {
  tableId: string | null; // null = nouvelle table à créer
  remaining: number;
  capacity: number;
  guestIds: string[];
}

const NO_CATEGORY = '__none__';

export const AUTO_PLACE_DEFAULTS: Required<AutoPlaceOptions> = {
  groupByCategory: true,
  keepGroupsTogether: true,
  balanceTables: false,
  createTables: true,
};

export function autoPlace(
  unassigned: AutoPlaceGuest[],
  tables: AutoPlaceTable[],
  defaultCapacity: number,
  options: AutoPlaceOptions = {},
): AutoPlaceResult {
  const opts = { ...AUTO_PLACE_DEFAULTS, ...options };
  const cap = defaultCapacity > 0 ? defaultCapacity : 8;
  const buckets: Bucket[] = tables.map((t) => ({
    tableId: t._id,
    remaining: Math.max(0, t.remaining),
    capacity: Math.max(0, t.remaining),
    guestIds: [],
  }));

  // Groupe par catégorie (ordre d'apparition conservé) — ou un seul groupe.
  const groups = new Map<string, AutoPlaceGuest[]>();
  for (const g of unassigned) {
    const key =
      opts.groupByCategory && g.category && g.category.trim() ? g.category.trim() : NO_CATEGORY;
    const arr = groups.get(key) ?? [];
    arr.push(g);
    groups.set(key, arr);
  }

  const unplaced: string[] = [];

  /** Choisit la meilleure table parmi celles qui peuvent accueillir `seats`. */
  function pickBucket(seats: number, preferEmpty: boolean): Bucket | null {
    let candidates = buckets.filter((b) => b.remaining >= seats);
    if (candidates.length === 0) return null;
    if (preferEmpty) {
      const empties = candidates.filter((b) => b.guestIds.length === 0);
      if (empties.length) candidates = empties;
    }
    // balanceTables → la plus vide (max remaining) pour étaler ;
    // sinon → la plus pleine qui rentre encore (min remaining) pour tasser.
    return candidates.reduce((best, b) =>
      opts.balanceTables
        ? b.remaining > best.remaining
          ? b
          : best
        : b.remaining < best.remaining
          ? b
          : best,
    );
  }

  for (const guests of groups.values()) {
    let lastBucket: Bucket | null = null;
    for (const guest of guests) {
      const seats = Math.max(1, guest.seats);

      let target: Bucket | null = null;
      // 1) Continuer sur la table déjà entamée pour ce groupe (si on garde les groupes ensemble).
      if (opts.keepGroupsTogether && lastBucket && lastBucket.remaining >= seats) {
        target = lastBucket;
      }
      // 2) Sinon, choisir une table existante (vide en priorité si on garde les groupes ensemble).
      if (!target) {
        target = pickBucket(seats, opts.keepGroupsTogether);
      }
      // 3) Sinon, ouvrir une nouvelle table — ou laisser non placé.
      if (!target) {
        if (!opts.createTables) {
          unplaced.push(guest._id);
          continue;
        }
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
  return { assignments, newTables, unplaced };
}
