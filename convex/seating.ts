import { v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { eventHasFeature } from './lib/entitlements';
import { autoPlace } from './lib/autoplace';

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
    shape: v.optional(v.union(v.literal('round'), v.literal('rect'))),
    posX: v.optional(v.number()),
    posY: v.optional(v.number()),
  },
  handler: async (ctx, { tableId, requesterId, name, capacity, shape, posX, posY }) => {
    await requireTableAccess(ctx, tableId, requesterId);
    const patch: Partial<Doc<'tables'>> = { updatedAt: Date.now() };
    if (name !== undefined && name.trim()) patch.name = name.trim();
    if (capacity !== undefined && capacity > 0) {
      patch.capacity = Math.min(Math.round(capacity), MAX_CAPACITY);
    }
    if (shape !== undefined) patch.shape = shape;
    // Position du plan visuel : clampée à des bornes raisonnables (le canvas
    // gère le rendu ; on borne juste pour éviter des valeurs aberrantes).
    if (posX !== undefined) patch.posX = Math.max(0, Math.min(Math.round(posX), 4000));
    if (posY !== undefined) patch.posY = Math.max(0, Math.min(Math.round(posY), 4000));
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

/**
 * Placement automatique : assigne tous les invités confirmés non placés aux
 * tables existantes (en regroupant par catégorie + respectant la capacité),
 * créant de nouvelles tables au besoin (positionnées en grille sur le canvas).
 * Idempotent au sens « ne touche que les non-placés » — les assignations
 * manuelles existantes sont préservées.
 */
export const autoAssignGuests = mutation({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    await requireSeatingAccess(ctx, eventId, requesterId);
    const now = Date.now();

    const tables = await ctx.db
      .query('tables')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    const guests = await ctx.db
      .query('guests')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();

    const occupancy = new Map<string, number>();
    const unassigned: Array<{ _id: string; seats: number; category?: string }> = [];
    for (const g of guests) {
      if (g.rsvpStatus !== 'attending') continue;
      const seats = seatsForGuest(g);
      if (g.tableId) {
        occupancy.set(g.tableId, (occupancy.get(g.tableId) ?? 0) + seats);
      } else {
        unassigned.push({ _id: g._id, seats, ...(g.category ? { category: g.category } : {}) });
      }
    }
    if (unassigned.length === 0) {
      return { assigned: 0, tablesCreated: 0 };
    }

    const placeTables = tables.map((t) => ({
      _id: t._id,
      remaining: Math.max(0, t.capacity - (occupancy.get(t._id) ?? 0)),
    }));

    const result = autoPlace(unassigned, placeTables, DEFAULT_CAPACITY);

    let created = 0;
    let assigned = 0;
    let order = tables.length;
    for (const nt of result.newTables) {
      const idx = order;
      const tableId = await ctx.db.insert('tables', {
        eventId,
        name: `Table ${idx + 1}`,
        capacity: Math.min(nt.capacity, MAX_CAPACITY),
        shape: 'round' as const,
        posX: 40 + (idx % 4) * 210,
        posY: 40 + Math.floor(idx / 4) * 190,
        order: idx,
        createdAt: now,
        updatedAt: now,
      });
      order += 1;
      created += 1;
      for (const guestId of nt.guestIds) {
        await ctx.db.patch(guestId as Id<'guests'>, { tableId, updatedAt: now });
        assigned += 1;
      }
    }
    for (const a of result.assignments) {
      await ctx.db.patch(a.guestId as Id<'guests'>, {
        tableId: a.tableId as Id<'tables'>,
        updatedAt: now,
      });
      assigned += 1;
    }

    return { assigned, tablesCreated: created };
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
          posX: t.posX,
          posY: t.posY,
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
