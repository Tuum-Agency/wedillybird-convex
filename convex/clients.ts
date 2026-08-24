import { v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { assertOrgRead, assertOrgWrite } from './lib/orgAuth';
import { IDENTITY_ARGS, requireUserIdCompat } from './lib/verifiedSession';
import { proTierAtLeast } from './lib/entitlements';
import { pickUniqueSlug } from './lib/uniqueSlug';

/**
 * CRM clients — back-office agence (feature Business+).
 *
 * Pipeline 6 étapes (lead → contacted → quote → booked → in_progress →
 * delivered), conversion lead → mariage, assignation, et **timeline d'activité**
 * (`clientNotes` : notes manuelles + événements auto comme les changements de
 * statut). RBAC + gating d'abonnement sur chaque mutation.
 */

const STAGE = v.union(
  v.literal('lead'),
  v.literal('contacted'),
  v.literal('quote'),
  v.literal('booked'),
  v.literal('in_progress'),
  v.literal('delivered'),
);

const STAGE_LABEL: Record<string, string> = {
  lead: 'Lead',
  contacted: 'Contacté',
  quote: 'Devis envoyé',
  booked: 'Réservé',
  in_progress: 'En cours',
  delivered: 'Livré',
};

const ANTI_ABUSE_GUEST_CAP = 5000;

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

async function addNote(
  ctx: MutationCtx,
  client: Pick<Doc<'clients'>, '_id' | 'organizationId'>,
  type: 'note' | 'status' | 'call' | 'email' | 'payment',
  text: string,
  authorId?: Id<'users'>,
): Promise<void> {
  await ctx.db.insert('clientNotes', {
    clientId: client._id,
    organizationId: client.organizationId,
    type,
    text,
    ...(authorId ? { authorId } : {}),
    createdAt: Date.now(),
  });
}

async function loadClientForWrite(
  ctx: MutationCtx,
  clientId: Id<'clients'>,
  requesterId: Id<'users'>,
): Promise<Doc<'clients'>> {
  const client = await ctx.db.get(clientId);
  if (!client) throw new Error('NOT_FOUND');
  await assertOrgWrite(ctx, client.organizationId, requesterId);
  return client;
}

async function assertCrmEnabled(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
): Promise<Doc<'organizations'>> {
  const org = await ctx.db.get(organizationId);
  if (!org) throw new Error('NOT_FOUND');
  if (!proTierAtLeast(org.subscriptionTier, 'business')) throw new Error('FEATURE_NOT_IN_PLAN');
  return org;
}

function trimmedOrThrow(value: string, field: string, min = 1, max = 120): string {
  const t = value.trim();
  if (t.length < min || t.length > max) throw new Error(`INVALID_${field}`);
  return t;
}

export const listByOrg = query({
  args: { organizationId: v.id('organizations'), ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    const { organizationId } = args;
    const requesterId = await requireUserIdCompat(ctx, args);
    await assertOrgRead(ctx, organizationId, requesterId);
    const clients = await ctx.db
      .query('clients')
      .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
      .order('desc')
      .collect();

    const nameCache = new Map<string, string | undefined>();
    const resolved = [];
    for (const c of clients) {
      let assigneeName: string | undefined;
      if (c.assigneeId) {
        if (nameCache.has(c.assigneeId)) {
          assigneeName = nameCache.get(c.assigneeId);
        } else {
          const u = await ctx.db.get(c.assigneeId);
          assigneeName = u?.fullName;
          nameCache.set(c.assigneeId, assigneeName);
        }
      }
      resolved.push({
        _id: c._id,
        partnerA: c.partnerA,
        partnerB: c.partnerB,
        phone: c.phone,
        email: c.email,
        whatsapp: c.whatsapp,
        stage: c.stage,
        source: c.source,
        weddingDate: c.weddingDate,
        venue: c.venue,
        budgetMinor: c.budgetMinor,
        budgetBookedMinor: c.budgetBookedMinor,
        assigneeId: c.assigneeId,
        assigneeName,
        notes: c.notes,
        eventId: c.eventId,
        lastContactAt: c.lastContactAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      });
    }
    return resolved;
  },
});

/** Timeline d'activité d'un client (ordre antéchronologique). */
export const notesByClient = query({
  args: { clientId: v.id('clients'), ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    const { clientId } = args;
    const requesterId = await requireUserIdCompat(ctx, args);
    const client = await ctx.db.get(clientId);
    if (!client) return null;
    await assertOrgRead(ctx, client.organizationId, requesterId);
    const notes = await ctx.db
      .query('clientNotes')
      .withIndex('by_client', (q) => q.eq('clientId', clientId))
      .collect();
    return notes
      .map((n) => ({
        _id: n._id,
        type: n.type,
        text: n.text,
        authorName: n.authorName,
        createdAt: n.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const create = mutation({
  args: {
    organizationId: v.id('organizations'),
    ...IDENTITY_ARGS,
    partnerA: v.string(),
    partnerB: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    stage: v.optional(STAGE),
    source: v.optional(v.string()),
    weddingDate: v.optional(v.number()),
    venue: v.optional(v.string()),
    budgetMinor: v.optional(v.number()),
    budgetBookedMinor: v.optional(v.number()),
    assigneeId: v.optional(v.id('users')),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requesterId = await requireUserIdCompat(ctx, args);
    await assertOrgWrite(ctx, args.organizationId, requesterId);
    await assertCrmEnabled(ctx, args.organizationId);

    const partnerA = trimmedOrThrow(args.partnerA, 'PARTNER_A');
    if (args.budgetMinor != null && (args.budgetMinor < 0 || !Number.isFinite(args.budgetMinor))) {
      throw new Error('INVALID_BUDGET');
    }

    const now = Date.now();
    const id = await ctx.db.insert('clients', {
      organizationId: args.organizationId,
      partnerA,
      ...(args.partnerB?.trim() ? { partnerB: args.partnerB.trim() } : {}),
      ...(args.phone?.trim() ? { phone: args.phone.trim() } : {}),
      ...(args.email?.trim() ? { email: args.email.trim().toLowerCase() } : {}),
      ...(args.whatsapp?.trim() ? { whatsapp: args.whatsapp.trim() } : {}),
      stage: args.stage ?? 'lead',
      ...(args.source?.trim() ? { source: args.source.trim() } : {}),
      ...(args.weddingDate ? { weddingDate: args.weddingDate } : {}),
      ...(args.venue?.trim() ? { venue: args.venue.trim() } : {}),
      ...(args.budgetMinor != null ? { budgetMinor: Math.round(args.budgetMinor) } : {}),
      ...(args.budgetBookedMinor != null
        ? { budgetBookedMinor: Math.round(args.budgetBookedMinor) }
        : {}),
      ...(args.assigneeId ? { assigneeId: args.assigneeId } : {}),
      ...(args.notes?.trim() ? { notes: args.notes.trim() } : {}),
      lastContactAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await addNote(
      ctx,
      { _id: id, organizationId: args.organizationId },
      'note',
      'Client créé dans le CRM.',
      requesterId,
    );
    if (args.notes?.trim()) {
      await addNote(
        ctx,
        { _id: id, organizationId: args.organizationId },
        'note',
        args.notes.trim(),
        requesterId,
      );
    }
    return { id };
  },
});

export const update = mutation({
  args: {
    clientId: v.id('clients'),
    ...IDENTITY_ARGS,
    partnerA: v.optional(v.string()),
    partnerB: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    stage: v.optional(STAGE),
    source: v.optional(v.string()),
    weddingDate: v.optional(v.number()),
    venue: v.optional(v.string()),
    budgetMinor: v.optional(v.number()),
    budgetBookedMinor: v.optional(v.number()),
    assigneeId: v.optional(v.id('users')),
    clearAssignee: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requesterId = await requireUserIdCompat(ctx, args);
    const client = await loadClientForWrite(ctx, args.clientId, requesterId);
    await assertCrmEnabled(ctx, client.organizationId);

    const prevStage = client.stage;
    const patch: Partial<Doc<'clients'>> = { updatedAt: Date.now() };
    if (args.partnerA !== undefined) patch.partnerA = trimmedOrThrow(args.partnerA, 'PARTNER_A');
    if (args.partnerB !== undefined) patch.partnerB = args.partnerB.trim() || undefined;
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.email !== undefined) patch.email = args.email.trim().toLowerCase() || undefined;
    if (args.whatsapp !== undefined) patch.whatsapp = args.whatsapp.trim() || undefined;
    if (args.stage !== undefined) patch.stage = args.stage;
    if (args.source !== undefined) patch.source = args.source.trim() || undefined;
    if (args.weddingDate !== undefined) patch.weddingDate = args.weddingDate || undefined;
    if (args.venue !== undefined) patch.venue = args.venue.trim() || undefined;
    if (args.budgetMinor !== undefined) {
      if (args.budgetMinor < 0 || !Number.isFinite(args.budgetMinor))
        throw new Error('INVALID_BUDGET');
      patch.budgetMinor = Math.round(args.budgetMinor);
    }
    if (args.budgetBookedMinor !== undefined) {
      if (args.budgetBookedMinor < 0 || !Number.isFinite(args.budgetBookedMinor))
        throw new Error('INVALID_BUDGET');
      patch.budgetBookedMinor = Math.round(args.budgetBookedMinor);
    }
    if (args.clearAssignee) patch.assigneeId = undefined;
    else if (args.assigneeId !== undefined) patch.assigneeId = args.assigneeId;
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;

    await ctx.db.patch(args.clientId, patch);
    if (args.stage !== undefined && args.stage !== prevStage) {
      await addNote(
        ctx,
        client,
        'status',
        `Statut passé de « ${STAGE_LABEL[prevStage]} » à « ${STAGE_LABEL[args.stage]} ».`,
        requesterId,
      );
    }
    return { ok: true as const };
  },
});

export const updateStage = mutation({
  args: { clientId: v.id('clients'), ...IDENTITY_ARGS, stage: STAGE },
  handler: async (ctx, args) => {
    const { clientId, stage } = args;
    const requesterId = await requireUserIdCompat(ctx, args);
    const client = await loadClientForWrite(ctx, clientId, requesterId);
    await assertCrmEnabled(ctx, client.organizationId);
    if (client.stage !== stage) {
      const now = Date.now();
      await ctx.db.patch(clientId, { stage, lastContactAt: now, updatedAt: now });
      await addNote(
        ctx,
        client,
        'status',
        `Statut passé de « ${STAGE_LABEL[client.stage]} » à « ${STAGE_LABEL[stage]} ».`,
        requesterId,
      );
    }
    return { ok: true as const };
  },
});

export const addClientNote = mutation({
  args: { clientId: v.id('clients'), ...IDENTITY_ARGS, text: v.string() },
  handler: async (ctx, args) => {
    const { clientId, text } = args;
    const requesterId = await requireUserIdCompat(ctx, args);
    const client = await loadClientForWrite(ctx, clientId, requesterId);
    const t = text.trim();
    if (t.length < 1 || t.length > 2000) throw new Error('INVALID_NOTE');
    const now = Date.now();
    await ctx.db.patch(clientId, { lastContactAt: now, updatedAt: now });
    await addNote(ctx, client, 'note', t, requesterId);
    return { ok: true as const };
  },
});

export const remove = mutation({
  args: { clientId: v.id('clients'), ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    const { clientId } = args;
    const requesterId = await requireUserIdCompat(ctx, args);
    await loadClientForWrite(ctx, clientId, requesterId);
    const notes = await ctx.db
      .query('clientNotes')
      .withIndex('by_client', (q) => q.eq('clientId', clientId))
      .collect();
    for (const n of notes) await ctx.db.delete(n._id);
    await ctx.db.delete(clientId);
    return { ok: true as const };
  },
});

export const convertToWedding = mutation({
  args: { clientId: v.id('clients'), ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    const { clientId } = args;
    const requesterId = await requireUserIdCompat(ctx, args);
    const client = await loadClientForWrite(ctx, clientId, requesterId);
    await assertCrmEnabled(ctx, client.organizationId);

    if (client.eventId) {
      const existing = await ctx.db.get(client.eventId);
      if (existing) return { eventId: client.eventId, alreadyConverted: true as const };
    }
    if (!client.weddingDate || client.weddingDate <= Date.now()) {
      throw new Error('NEEDS_FUTURE_DATE');
    }

    const partnerA = client.partnerA.trim();
    const partnerB = (client.partnerB ?? '').trim() || partnerA;
    const base = slugify(`${partnerA}-${partnerB}`) || 'mariage';
    const slug = await pickUniqueSlug(ctx, 'events', 'by_slug', 'slug', base);

    const now = Date.now();
    const eventId = await ctx.db.insert('events', {
      ownerId: requesterId,
      organizationId: client.organizationId,
      slug,
      title: `${partnerA} & ${partnerB}`,
      coupleNames: { partnerA, partnerB },
      eventDate: client.weddingDate,
      timezone: 'Europe/Paris',
      status: 'draft' as const,
      maxGuests: ANTI_ABUSE_GUEST_CAP,
      createdAt: now,
      updatedAt: now,
    });

    const nextStage =
      client.stage === 'lead' || client.stage === 'contacted' || client.stage === 'quote'
        ? 'booked'
        : client.stage;
    await ctx.db.patch(clientId, { eventId, stage: nextStage, updatedAt: now });
    await addNote(ctx, client, 'status', 'Mariage créé et rattaché à la fiche.', requesterId);
    return { eventId, alreadyConverted: false as const };
  },
});
