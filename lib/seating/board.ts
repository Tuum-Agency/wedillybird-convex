/**
 * Logique pure du board de plan de table (seating), extraite du composant
 * client pour être testable unitairement. Aucune dépendance React/DOM.
 *
 * Conventions :
 *  - `UNASSIGNED` est le conteneur des invités non placés.
 *  - `seats` d'un invité = lui + ses plus-ones confirmés (déjà calculé côté
 *    Convex `getSeatingPlan`). On le traite ici comme une donnée d'entrée.
 */

export const UNASSIGNED = 'unassigned';

export interface SeatGuest {
  _id: string;
  fullName: string;
  seats: number;
  plusOnesNames: string[];
  category?: string;
}

export interface SeatTable {
  _id: string;
  name: string;
  capacity: number;
  shape?: 'round' | 'rect';
  order: number;
  assigned: SeatGuest[];
  occupancy: number;
  overCapacity: boolean;
}

export interface BoardState {
  tables: SeatTable[];
  unassigned: SeatGuest[];
}

/** Recalcule l'occupation (somme des sièges) et le flag sur-capacité d'une table. */
export function withOccupancy(table: SeatTable): SeatTable {
  const occupancy = table.assigned.reduce((sum, g) => sum + g.seats, 0);
  return { ...table, occupancy, overCapacity: occupancy > table.capacity };
}

/** Conteneur courant d'un invité : id de table, ou UNASSIGNED. */
export function containerOf(state: BoardState, guestId: string): string {
  if (state.unassigned.some((g) => g._id === guestId)) return UNASSIGNED;
  const table = state.tables.find((t) => t.assigned.some((g) => g._id === guestId));
  return table?._id ?? UNASSIGNED;
}

/**
 * Déplace un invité vers `target` (id de table ou UNASSIGNED), en le retirant
 * de son conteneur d'origine et en recalculant l'occupation des tables
 * touchées. Renvoie un nouvel état (immutable). No-op si l'invité est
 * introuvable.
 */
export function applyMove(state: BoardState, guestId: string, target: string): BoardState {
  let moved: SeatGuest | null = state.unassigned.find((g) => g._id === guestId) ?? null;
  let unassigned = moved ? state.unassigned.filter((g) => g._id !== guestId) : state.unassigned;
  let tables = state.tables.map((t) => {
    const hit = t.assigned.find((g) => g._id === guestId);
    if (hit) {
      moved = hit;
      return withOccupancy({ ...t, assigned: t.assigned.filter((g) => g._id !== guestId) });
    }
    return t;
  });

  if (!moved) return state;

  if (target === UNASSIGNED) {
    unassigned = [...unassigned, moved];
  } else {
    tables = tables.map((t) =>
      t._id === target ? withOccupancy({ ...t, assigned: [...t.assigned, moved as SeatGuest] }) : t,
    );
  }
  return { tables, unassigned };
}
