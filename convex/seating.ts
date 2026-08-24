import { v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { eventHasFeature } from './lib/entitlements';
import { autoPlace } from './lib/autoplace';
import { IDENTITY_ARGS, requireUserIdCompat } from './lib/verifiedSession';

/**
 * Plan de table / seating. Feature Premium + Pro (`seatingPlan`) — Essentiel
 * exclu.
 *
 * Modèle **unité-personne** (v2.1) : chaque place se gère par personne.
 *  - L'invité principal (memberIndex 0) est porté par `guests.tableId`
 *    (rétro-compat V1/V2).
 *  - Chaque accompagnant `plusOnesNames[k]` = memberIndex `k + 1`, placé
 *    **indépendamment** via la table `tableAssignments` (absence de row = non
 *    placé). Une personne = une place.
 *
 * Toutes les mutations / la query vérifient : (1) l'appelant gère l'event
 * (owner ou collaborateur), (2) l'event a l'entitlement `seatingPlan`. Sinon
 * throw `FORBIDDEN` / `FEATURE_NOT_IN_PLAN`.
 */

const DEFAULT_CAPACITY = 8;
const MAX_CAPACITY = 30;

/** Unité-personne placeable (invité principal ou accompagnant). */
interface SeatUnit {
  _id: string; // `${guestId}` (principal) ou `${guestId}:${memberIndex}` (accompagnant)
  guestId: Id<'guests'>;
  memberIndex: number;
  fullName: string;
  hostName?: string; // nom de l'invité principal (pour les accompagnants)
  seats: 1;
  plusOnesNames: string[]; // toujours [] en modèle unité-personne (compat type UI)
  category?: string;
  tableId: Id<'tables'> | null;
}

function unitId(guestId: Id<'guests'>, memberIndex: number): string {
  return memberIndex === 0 ? guestId : `${guestId}:${memberIndex}`;
}

function parseUnitId(id: string): { guestId: Id<'guests'>; memberIndex: number } {
  const sep = id.lastIndexOf(':');
  if (sep === -1) return { guestId: id as Id<'guests'>, memberIndex: 0 };
  return {
    guestId: id.slice(0, sep) as Id<'guests'>,
    memberIndex: Number.parseInt(id.slice(sep + 1), 10) || 0,
  };
}

/**
 * Construit toutes les unités-personnes des invités confirmés, avec leur table
 * résolue (principal ← guests.tableId ; accompagnant ← tableAssignments).
 */
function buildUnits(
  guests: Doc<'guests'>[],
  assignmentMap: Map<string, Doc<'tableAssignments'>>,
): SeatUnit[] {
  const units: SeatUnit[] = [];
  for (const g of guests) {
    if (g.rsvpStatus !== 'attending') continue;
    const category = g.category;
    units.push({
      _id: unitId(g._id, 0),
      guestId: g._id,
      memberIndex: 0,
      fullName: g.fullName,
      seats: 1,
      plusOnesNames: [],
      ...(category ? { category } : {}),
      tableId: g.tableId ?? null,
    });
    const plusOnes = g.plusOnesNames ?? [];
    for (let k = 0; k < plusOnes.length; k += 1) {
      const memberIndex = k + 1;
      const row = assignmentMap.get(unitId(g._id, memberIndex));
      units.push({
        _id: unitId(g._id, memberIndex),
        guestId: g._id,
        memberIndex,
        fullName: plusOnes[k] ?? `${g.fullName} +${memberIndex}`,
        hostName: g.fullName,
        seats: 1,
        plusOnesNames: [],
        ...(category ? { category } : {}),
        tableId: row?.tableId ?? null,
      });
    }
  }
  return units;
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

/** Persiste l'assignation d'une unité-personne (principal → guests.tableId ;
 * accompagnant → tableAssignments upsert/delete). */
async function persistSeat(
  ctx: MutationCtx,
  eventId: Id<'events'>,
  guestId: Id<'guests'>,
  memberIndex: number,
  tableId: Id<'tables'> | null,
  now: number,
): Promise<void> {
  if (memberIndex === 0) {
    await ctx.db.patch(guestId, { tableId: tableId ?? undefined, updatedAt: now });
    return;
  }
  const existing = await ctx.db
    .query('tableAssignments')
    .withIndex('by_guest_member', (q) => q.eq('guestId', guestId).eq('memberIndex', memberIndex))
    .first();
  if (tableId === null) {
    if (existing) await ctx.db.delete(existing._id);
  } else if (existing) {
    await ctx.db.patch(existing._id, { tableId, updatedAt: now });
  } else {
    await ctx.db.insert('tableAssignments', {
      eventId,
      guestId,
      memberIndex,
      tableId,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export const createTable = mutation({
  args: {
    eventId: v.id('events'),
    ...IDENTITY_ARGS,
    name: v.optional(v.string()),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { eventId, name, capacity } = args;
    const requesterId = await requireUserIdCompat(ctx, args);
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
    ...IDENTITY_ARGS,
    name: v.optional(v.string()),
    capacity: v.optional(v.number()),
    shape: v.optional(v.union(v.literal('round'), v.literal('rect'))),
    posX: v.optional(v.number()),
    posY: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tableId, name, capacity, shape, posX, posY } = args;
    const requesterId = await requireUserIdCompat(ctx, args);
    await requireTableAccess(ctx, tableId, requesterId);
    const patch: Partial<Doc<'tables'>> = { updatedAt: Date.now() };
    if (name !== undefined && name.trim()) patch.name = name.trim();
    if (capacity !== undefined && capacity > 0) {
      patch.capacity = Math.min(Math.round(capacity), MAX_CAPACITY);
    }
    if (shape !== undefined) patch.shape = shape;
    if (posX !== undefined) patch.posX = Math.max(0, Math.min(Math.round(posX), 4000));
    if (posY !== undefined) patch.posY = Math.max(0, Math.min(Math.round(posY), 4000));
    await ctx.db.patch(tableId, patch);
    return { ok: true as const };
  },
});

export const deleteTable = mutation({
  args: { tableId: v.id('tables'), ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    const { tableId } = args;
    const requesterId = await requireUserIdCompat(ctx, args);
    await requireTableAccess(ctx, tableId, requesterId);
    const now = Date.now();
    // Désassigne les invités principaux placés ici (guests.tableId).
    const mainOccupants = await ctx.db
      .query('guests')
      .withIndex('by_table', (q) => q.eq('tableId', tableId))
      .collect();
    for (const g of mainOccupants) {
      await ctx.db.patch(g._id, { tableId: undefined, updatedAt: now });
    }
    // Supprime les assignations d'accompagnants vers cette table.
    const rows = await ctx.db
      .query('tableAssignments')
      .withIndex('by_table', (q) => q.eq('tableId', tableId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    await ctx.db.delete(tableId);
    return { ok: true as const, unassigned: mainOccupants.length + rows.length };
  },
});

/**
 * Assigne une **personne** (invité principal `memberIndex: 0` ou accompagnant
 * `memberIndex >= 1`) à une table — ou `tableId: null` pour la désassigner.
 * Cœur du drag-and-drop par personne.
 */
export const assignSeat = mutation({
  args: {
    eventId: v.id('events'),
    guestId: v.id('guests'),
    memberIndex: v.number(),
    tableId: v.union(v.id('tables'), v.null()),
    ...IDENTITY_ARGS,
  },
  handler: async (ctx, args) => {
    const { eventId, guestId, memberIndex, tableId } = args;
    const requesterId = await requireUserIdCompat(ctx, args);
    await requireSeatingAccess(ctx, eventId, requesterId);
    const guest = await ctx.db.get(guestId);
    if (!guest || guest.eventId !== eventId) throw new Error('GUEST_NOT_FOUND');
    if (tableId !== null) {
      const table = await ctx.db.get(tableId);
      if (!table || table.eventId !== eventId) throw new Error('TABLE_NOT_FOUND');
    }
    await persistSeat(
      ctx,
      eventId,
      guestId,
      Math.max(0, Math.round(memberIndex)),
      tableId,
      Date.now(),
    );
    return { ok: true as const };
  },
});

/**
 * Placement automatique : assigne toutes les **personnes** non placées
 * (invités + accompagnants) aux tables, en regroupant par catégorie et en
 * gardant une même « party » ensemble par défaut (unités du même invité
 * consécutives). Crée les tables manquantes. Ne touche que les non-placés.
 */
export const autoAssignGuests = mutation({
  args: {
    eventId: v.id('events'),
    ...IDENTITY_ARGS,
    // 'unplaced' (défaut) : ne touche qu'aux personnes non placées.
    // 'all' : vide d'abord toutes les assignations puis replace tout le monde.
    mode: v.optional(v.union(v.literal('unplaced'), v.literal('all'))),
    settings: v.optional(
      v.object({
        groupByCategory: v.optional(v.boolean()),
        keepGroupsTogether: v.optional(v.boolean()),
        balanceTables: v.optional(v.boolean()),
        createTables: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { eventId, mode, settings } = args;
    const requesterId = await requireUserIdCompat(ctx, args);
    await requireSeatingAccess(ctx, eventId, requesterId);
    const now = Date.now();
    const replaceAll = mode === 'all';

    const tables = await ctx.db
      .query('tables')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    let guests = await ctx.db
      .query('guests')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    let assignmentRows = await ctx.db
      .query('tableAssignments')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();

    if (replaceAll) {
      // Tout replacer : on désassigne d'abord tout le monde (principaux + accompagnants).
      for (const g of guests) {
        if (g.tableId) await ctx.db.patch(g._id, { tableId: undefined, updatedAt: now });
      }
      for (const row of assignmentRows) await ctx.db.delete(row._id);
      guests = guests.map((g) => ({ ...g, tableId: undefined }));
      assignmentRows = [];
    }

    const assignmentMap = new Map<string, Doc<'tableAssignments'>>();
    for (const row of assignmentRows) assignmentMap.set(unitId(row.guestId, row.memberIndex), row);

    const allUnits = buildUnits(guests, assignmentMap);
    const occupancy = new Map<string, number>();
    const unassigned: Array<{ _id: string; seats: number; category?: string }> = [];
    for (const u of allUnits) {
      if (u.tableId) {
        occupancy.set(u.tableId, (occupancy.get(u.tableId) ?? 0) + 1);
      } else {
        unassigned.push({ _id: u._id, seats: 1, ...(u.category ? { category: u.category } : {}) });
      }
    }
    if (unassigned.length === 0) return { assigned: 0, tablesCreated: 0, unplaced: 0 };

    const placeTables = tables.map((t) => ({
      _id: t._id,
      remaining: Math.max(0, t.capacity - (occupancy.get(t._id) ?? 0)),
    }));
    const result = autoPlace(unassigned, placeTables, DEFAULT_CAPACITY, settings ?? {});

    let created = 0;
    let assigned = 0;
    let order = tables.length;
    for (const nt of result.newTables) {
      const idx = order;
      const newTableId = await ctx.db.insert('tables', {
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
      for (const id of nt.guestIds) {
        const { guestId, memberIndex } = parseUnitId(id);
        await persistSeat(ctx, eventId, guestId, memberIndex, newTableId, now);
        assigned += 1;
      }
    }
    for (const a of result.assignments) {
      const { guestId, memberIndex } = parseUnitId(a.guestId);
      await persistSeat(ctx, eventId, guestId, memberIndex, a.tableId as Id<'tables'>, now);
      assigned += 1;
    }

    return { assigned, tablesCreated: created, unplaced: result.unplaced.length };
  },
});

export const getSeatingPlan = query({
  args: { eventId: v.id('events'), ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    const { eventId } = args;
    const requesterId = await requireUserIdCompat(ctx, args);
    await requireSeatingAccess(ctx, eventId, requesterId);

    const tablesRaw = await ctx.db
      .query('tables')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    const guests = await ctx.db
      .query('guests')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    const assignmentRows = await ctx.db
      .query('tableAssignments')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    const assignmentMap = new Map<string, Doc<'tableAssignments'>>();
    for (const row of assignmentRows) assignmentMap.set(unitId(row.guestId, row.memberIndex), row);

    type UnitOut = Omit<SeatUnit, 'tableId'>;
    const toOut = (u: SeatUnit): UnitOut => ({
      _id: u._id,
      guestId: u.guestId,
      memberIndex: u.memberIndex,
      fullName: u.fullName,
      seats: u.seats,
      plusOnesNames: u.plusOnesNames,
      ...(u.hostName ? { hostName: u.hostName } : {}),
      ...(u.category ? { category: u.category } : {}),
    });

    const byTable = new Map<string, UnitOut[]>();
    const unassigned: UnitOut[] = [];
    for (const u of buildUnits(guests, assignmentMap)) {
      if (u.tableId) {
        const arr = byTable.get(u.tableId) ?? [];
        arr.push(toOut(u));
        byTable.set(u.tableId, arr);
      } else {
        unassigned.push(toOut(u));
      }
    }

    const tables = tablesRaw
      .sort((a, b) => a.order - b.order)
      .map((t) => {
        const assigned = byTable.get(t._id) ?? [];
        const occupancy = assigned.reduce((sum, u) => sum + u.seats, 0);
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

    const unassignedSeats = unassigned.reduce((sum, u) => sum + u.seats, 0);
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
