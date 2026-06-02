import { v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { eventHasFeature } from './lib/entitlements';

/**
 * Plan de table / seating. Tables (`tables`) + assignation invité→table portée
 * par `guests.tableId`. Feature Premium + Pro (`seatingPlan`) — Essentiel exclu.
 *
 * Toutes les mutations/la query vérifient : (1) l'appelant gère l'event (owner
 * ou collaborateur), (2) l'event a l'entitlement `seatingPlan`. Sinon throw
 * `FORBIDDEN` / `FEATURE_NOT_IN_PLAN` (la page gate aussi en amont pour afficher
 * un upsell plutôt qu'une erreur).
 */

const DEFAULT_CAPACITY = 8;
const MAX_CAPACITY = 30;

/** Sièges réellement occupés par un invité = lui + ses plus-ones confirmés. */
function seatsForGuest(g: Doc<'guests'>): number {
  return 1 + (g.plusOnesNames?.length ?? 0);
}

async function requireSeatingAccess(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<'events'>,
  requesterId: Id<'users'>,
): Promise<Doc<'events'>> {
  const event = await ctx.db.get(eventId);
  if (!event) throw new Error('EVENT_NOT_FOUND');
  let allowed = event.ownerId === requesterId;
  if (!allowed) {
    const collab = await ctx.db
      .query('eventCollaborators')
      .withIndex('by_event_user', (q) => q.eq('eventId', eventId).eq('userId', requesterId))
      .first();
    allowed = collab !== null;
  }
  if (!allowed) throw new Error('FORBIDDEN');
  if (!eventHasFeature(event, 'seatingPlan')) throw new Error('FEATURE_NOT_IN_PLAN');
  return event;
}

async function requireTableAccess(
  ctx: MutationCtx,
  tableId: Id<'tables'>,
  requesterId: Id<'users'>,
): Promise<Doc<'tables'>> {
  const table = await ctx.db.get(tableId);
  if (!table) throw new Error('TABLE_NOT_FOUND');
  await requireSeatingAccess(ctx, table.eventId, requesterId);
  return table;
}

export const createTable = mutation({
  args: {
    eventId: v.id('events'),
    requesterId: v.id('users'),
    name: v.optional(v.string()),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, { eventId, requesterId, name, capacity }) => {
    await requireSeatingAccess(ctx, eventId, requesterId);
    const existing = await ctx.db
      .query('tables')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    const order = existing.length;
    const now = Date.now();
    const tableId = await ctx.db.insert('tables', {
      eventId,
      name: name?.trim() || `Table ${order + 1}`,
      capacity:
        capacity && capacity > 0 ? Math.min(Math.round(capacity), MAX_CAPACITY) : DEFAULT_CAPACITY,
      order,
      createdAt: now,
      updatedAt: now,
    });
    return { tableId };
  },
});

export const updateTable = mutation({
  args: {
    tableId: v.id('tables'),
    requesterId: v.id('users'),
    name: v.optional(v.string()),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, { tableId, requesterId, name, capacity }) => {
    await requireTableAccess(ctx, tableId, requesterId);
    const patch: Partial<Doc<'tables'>> = { updatedAt: Date.now() };
    if (name !== undefined && name.trim()) patch.name = name.trim();
    if (capacity !== undefined && capacity > 0) {
      patch.capacity = Math.min(Math.round(capacity), MAX_CAPACITY);
    }
    await ctx.db.patch(tableId, patch);
    return { ok: true as const };
  },
});

export const deleteTable = mutation({
  args: { tableId: v.id('tables'), requesterId: v.id('users') },
  handler: async (ctx, { tableId, requesterId }) => {
    await requireTableAccess(ctx, tableId, requesterId);
    // Désassigne les invités de cette table avant suppression.
    const assigned = await ctx.db
      .query('guests')
      .withIndex('by_table', (q) => q.eq('tableId', tableId))
      .collect();
    const now = Date.now();
    for (const g of assigned) {
      await ctx.db.patch(g._id, { tableId: undefined, updatedAt: now });
    }
    await ctx.db.delete(tableId);
    return { ok: true as const, unassigned: assigned.length };
  },
});

/**
 * Assigne un invité à une table (ou `tableId: null` pour le désassigner →
 * retour au panneau « non assignés »). Cœur du drag-and-drop.
 */
export const assignGuest = mutation({
  args: {
    guestId: v.id('guests'),
    tableId: v.union(v.id('tables'), v.null()),
    requesterId: v.id('users'),
  },
  handler: async (ctx, { guestId, tableId, requesterId }) => {
    const guest = await ctx.db.get(guestId);
    if (!guest) throw new Error('GUEST_NOT_FOUND');
    await requireSeatingAccess(ctx, guest.eventId, requesterId);
    if (tableId !== null) {
      const table = await ctx.db.get(tableId);
      if (!table || table.eventId !== guest.eventId) throw new Error('TABLE_NOT_FOUND');
    }
    await ctx.db.patch(guestId, { tableId: tableId ?? undefined, updatedAt: Date.now() });
    return { ok: true as const };
  },
});

export const getSeatingPlan = query({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    await requireSeatingAccess(ctx, eventId, requesterId);

    const tablesRaw = await ctx.db
      .query('tables')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    const guests = await ctx.db
      .query('guests')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();

    type SeatGuest = {
      _id: Id<'guests'>;
      fullName: string;
      seats: number;
      plusOnesNames: string[];
      category?: string;
    };

    const byTable = new Map<string, SeatGuest[]>();
    const unassigned: SeatGuest[] = [];

    for (const g of guests) {
      // On ne place que les invités confirmés (présents).
      if (g.rsvpStatus !== 'attending') continue;
      const item: SeatGuest = {
        _id: g._id,
        fullName: g.fullName,
        seats: seatsForGuest(g),
        plusOnesNames: g.plusOnesNames ?? [],
        ...(g.category ? { category: g.category } : {}),
      };
      if (g.tableId) {
        const arr = byTable.get(g.tableId) ?? [];
        arr.push(item);
        byTable.set(g.tableId, arr);
      } else {
        unassigned.push(item);
      }
    }

    const tables = tablesRaw
      .sort((a, b) => a.order - b.order)
      .map((t) => {
        const assigned = byTable.get(t._id) ?? [];
        const occupancy = assigned.reduce((sum, g) => sum + g.seats, 0);
        return {
          _id: t._id,
          name: t.name,
          capacity: t.capacity,
          shape: t.shape,
          order: t.order,
          assigned,
          occupancy,
          overCapacity: occupancy > t.capacity,
        };
      });

    const unassignedSeats = unassigned.reduce((sum, g) => sum + g.seats, 0);
    const seatedSeats = tables.reduce((sum, t) => sum + t.occupancy, 0);

    return {
      tables,
      unassigned,
      stats: {
        tableCount: tables.length,
        totalCapacity: tables.reduce((sum, t) => sum + t.capacity, 0),
        seatedSeats,
        unassignedSeats,
        attendingParties: tables.reduce((n, t) => n + t.assigned.length, 0) + unassigned.length,
      },
    };
  },
});
