'use server';

import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import type { SeatingPlan } from '@/lib/seating/board';

export type SeatingActionResult = { ok: true } | { ok: false; error: string };

const KNOWN_ERRORS = [
  'FEATURE_NOT_IN_PLAN',
  'FORBIDDEN',
  'EVENT_NOT_FOUND',
  'TABLE_NOT_FOUND',
  'GUEST_NOT_FOUND',
] as const;

function mapError(err: unknown): { ok: false; error: string } {
  const message = err instanceof Error ? err.message : 'UNKNOWN';
  const hit = KNOWN_ERRORS.find((code) => message.includes(code));
  return { ok: false, error: hit ?? 'UNKNOWN' };
}

export async function createTableAction(
  eventId: string,
  input?: { name?: string; capacity?: number },
): Promise<SeatingActionResult & { tableId?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  try {
    const convex = getConvexServerClient();
    const res = await convex.mutation(convexApi.createTable, {
      eventId,
      requesterId: session.userId,
      ...(input?.name ? { name: input.name } : {}),
      ...(input?.capacity ? { capacity: input.capacity } : {}),
    });
    return { ok: true, tableId: res.tableId };
  } catch (err) {
    return mapError(err);
  }
}

export async function updateTableAction(
  tableId: string,
  input: {
    name?: string;
    capacity?: number;
    shape?: 'round' | 'rect';
    posX?: number;
    posY?: number;
  },
): Promise<SeatingActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  try {
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.updateTable, {
      tableId,
      requesterId: session.userId,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
      ...(input.shape !== undefined ? { shape: input.shape } : {}),
      ...(input.posX !== undefined ? { posX: input.posX } : {}),
      ...(input.posY !== undefined ? { posY: input.posY } : {}),
    });
    return { ok: true };
  } catch (err) {
    return mapError(err);
  }
}

/**
 * Placement automatique : assigne les invités non placés + crée les tables
 * nécessaires côté serveur, puis renvoie le plan rafraîchi pour que le board
 * remplace son état local (opération en masse → vérité serveur).
 */
export interface AutoPlaceSettings {
  groupByCategory?: boolean;
  keepGroupsTogether?: boolean;
  balanceTables?: boolean;
  createTables?: boolean;
}

export async function autoAssignGuestsAction(
  eventId: string,
  opts?: { mode?: 'unplaced' | 'all'; settings?: AutoPlaceSettings },
): Promise<
  | { ok: true; assigned: number; tablesCreated: number; unplaced: number; plan: SeatingPlan }
  | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  try {
    const convex = getConvexServerClient();
    const res = await convex.mutation(convexApi.autoAssignGuests, {
      eventId,
      requesterId: session.userId,
      ...(opts?.mode ? { mode: opts.mode } : {}),
      ...(opts?.settings ? { settings: opts.settings } : {}),
    });
    const plan = (await convex.query(convexApi.getSeatingPlan, {
      eventId,
      requesterId: session.userId,
    })) as SeatingPlan;
    return {
      ok: true,
      assigned: res.assigned,
      tablesCreated: res.tablesCreated,
      unplaced: res.unplaced,
      plan,
    };
  } catch (err) {
    return mapError(err);
  }
}

export async function deleteTableAction(tableId: string): Promise<SeatingActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  try {
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.deleteTable, { tableId, requesterId: session.userId });
    return { ok: true };
  } catch (err) {
    return mapError(err);
  }
}

export async function assignSeatAction(
  eventId: string,
  guestId: string,
  memberIndex: number,
  tableId: string | null,
): Promise<SeatingActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  try {
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.assignSeat, {
      eventId,
      guestId,
      memberIndex,
      tableId,
      requesterId: session.userId,
    });
    return { ok: true };
  } catch (err) {
    return mapError(err);
  }
}
