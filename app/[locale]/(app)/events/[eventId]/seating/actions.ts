'use server';

import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

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
  input: { name?: string; capacity?: number },
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
    });
    return { ok: true };
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

export async function assignGuestAction(
  guestId: string,
  tableId: string | null,
): Promise<SeatingActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  try {
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.assignGuestToTable, {
      guestId,
      tableId,
      requesterId: session.userId,
    });
    return { ok: true };
  } catch (err) {
    return mapError(err);
  }
}
