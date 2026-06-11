import { v } from 'convex/values';
import { mutation, query, type MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { assertOrgRead, assertOrgWrite } from './lib/orgAuth';
import { proTierAtLeast } from './lib/entitlements';

/**
 * Contrats — back-office agence (module « Finances »), réservé Business+.
 * Cycle de vie : brouillon → envoyé → signé couple → contre-signé → actif
 * (ou annulé). La signature est matérialisée par des transitions de statut ;
 * chaque étape est tracée dans `contractAudit`. Numérotation « CON-AAAA-NNN ».
 */

const STATUS = v.union(
  v.literal('draft'),
  v.literal('sent'),
  v.literal('signed_client'),
  v.literal('countersigned'),
  v.literal('active'),
  v.literal('cancelled'),
);
const SECTION = v.object({ title: v.string(), body: v.string() });

type Status = Doc<'contracts'>['status'];

async function assertAllowed(ctx: MutationCtx, organizationId: Id<'organizations'>): Promise<void> {
  const org = await ctx.db.get(organizationId);
  if (!org) throw new Error('NOT_FOUND');
  if (!proTierAtLeast(org.subscriptionTier, 'business')) throw new Error('FEATURE_NOT_IN_PLAN');
}

async function logAudit(
  ctx: MutationCtx,
  contractId: Id<'contracts'>,
  organizationId: Id<'organizations'>,
  event: string,
  by?: string,
): Promise<void> {
  await ctx.db.insert('contractAudit', {
    contractId,
    organizationId,
    event,
    ...(by ? { by } : {}),
    createdAt: Date.now(),
  });
}

async function nextNumber(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  year: number,
): Promise<string> {
  const all = await ctx.db
    .query('contracts')
    .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
    .collect();
  const seq = all.filter((c) => new Date(c.createdAt).getFullYear() === year).length + 1;
  return `CON-${year}-${String(seq).padStart(3, '0')}`;
}

function serialize(c: Doc<'contracts'>) {
  return {
    _id: c._id,
    number: c.number,
    clientId: c.clientId,
    clientName: c.clientName,
    eventId: c.eventId,
    quoteId: c.quoteId,
    status: c.status,
    sections: c.sections,
    totalMinor: c.totalMinor,
    jurisdiction: c.jurisdiction,
    sentAt: c.sentAt,
    signedAt: c.signedAt,
    countersignedAt: c.countersignedAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export const listByOrg = query({
  args: { organizationId: v.id('organizations'), requesterId: v.id('users') },
  handler: async (ctx, { organizationId, requesterId }) => {
    await assertOrgRead(ctx, organizationId, requesterId);
    const contracts = await ctx.db
      .query('contracts')
      .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
      .collect();
    const clients = await ctx.db
      .query('clients')
      .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
      .collect();
    const events = await ctx.db
      .query('events')
      .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
      .collect();
    return {
      contracts: contracts.map(serialize).sort((a, b) => b.createdAt - a.createdAt),
      clients: clients
        .map((c) => ({
          _id: c._id,
          name: c.partnerB ? `${c.partnerA} & ${c.partnerB}` : c.partnerA,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      weddings: events.map((e) => ({
        _id: e._id,
        coupleNames: `${e.coupleNames.partnerA} & ${e.coupleNames.partnerB}`,
        eventDate: e.eventDate,
        venue: e.venue?.name,
      })),
    };
  },
});

export const getById = query({
  args: { contractId: v.id('contracts'), requesterId: v.id('users') },
  handler: async (ctx, { contractId, requesterId }) => {
    const c = await ctx.db.get(contractId);
    if (!c) return null;
    await assertOrgRead(ctx, c.organizationId, requesterId);
    const audit = await ctx.db
      .query('contractAudit')
      .withIndex('by_contract', (q) => q.eq('contractId', contractId))
      .collect();
    return {
      contract: serialize(c),
      audit: audit
        .map((a) => ({ _id: a._id, event: a.event, by: a.by, ip: a.ip, createdAt: a.createdAt }))
        .sort((a, b) => a.createdAt - b.createdAt),
    };
  },
});

export const create = mutation({
  args: {
    organizationId: v.id('organizations'),
    requesterId: v.id('users'),
    clientId: v.optional(v.id('clients')),
    clientName: v.optional(v.string()),
    eventId: v.optional(v.id('events')),
    quoteId: v.optional(v.id('quoteDocs')),
    totalMinor: v.number(),
    sections: v.array(SECTION),
    jurisdiction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertOrgWrite(ctx, args.organizationId, args.requesterId);
    await assertAllowed(ctx, args.organizationId);

    let clientName = args.clientName?.trim() ?? '';
    if (args.clientId) {
      const c = await ctx.db.get(args.clientId);
      if (!c || c.organizationId !== args.organizationId) throw new Error('NOT_FOUND');
      clientName = c.partnerB ? `${c.partnerA} & ${c.partnerB}` : c.partnerA;
    }
    if (!clientName) throw new Error('INVALID_CLIENT');
    if (!args.sections.length) throw new Error('INVALID_SECTIONS');

    const now = Date.now();
    const number = await nextNumber(ctx, args.organizationId, new Date(now).getFullYear());
    const id = await ctx.db.insert('contracts', {
      organizationId: args.organizationId,
      number,
      ...(args.clientId ? { clientId: args.clientId } : {}),
      clientName,
      ...(args.eventId ? { eventId: args.eventId } : {}),
      ...(args.quoteId ? { quoteId: args.quoteId } : {}),
      ...(args.jurisdiction ? { jurisdiction: args.jurisdiction } : {}),
      status: 'draft',
      sections: args.sections,
      totalMinor: Math.max(0, Math.round(args.totalMinor)),
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, id, args.organizationId, 'Contrat créé');
    return { id, number };
  },
});

async function loadForWrite(
  ctx: MutationCtx,
  contractId: Id<'contracts'>,
  requesterId: Id<'users'>,
) {
  const c = await ctx.db.get(contractId);
  if (!c) throw new Error('NOT_FOUND');
  await assertOrgWrite(ctx, c.organizationId, requesterId);
  await assertAllowed(ctx, c.organizationId);
  return c;
}

const ADVANCE: Record<Status, { to: Status; event: string } | null> = {
  draft: { to: 'sent', event: 'Envoyé pour signature' },
  sent: { to: 'signed_client', event: 'Signé par le couple' },
  signed_client: { to: 'countersigned', event: 'Contre-signé par l’agence' },
  countersigned: { to: 'active', event: 'Contrat actif' },
  active: null,
  cancelled: null,
};

/** Avance le contrat à l'étape suivante du cycle de vie. */
export const advance = mutation({
  args: { contractId: v.id('contracts'), requesterId: v.id('users') },
  handler: async (ctx, { contractId, requesterId }) => {
    const c = await loadForWrite(ctx, contractId, requesterId);
    const step = ADVANCE[c.status];
    if (!step) throw new Error('TERMINAL_STATUS');
    const now = Date.now();
    const patch: Record<string, unknown> = { status: step.to, updatedAt: now };
    if (step.to === 'sent') patch.sentAt = now;
    if (step.to === 'signed_client') patch.signedAt = now;
    if (step.to === 'countersigned') patch.countersignedAt = now;
    await ctx.db.patch(contractId, patch);
    // audit enrichi : la signature du couple porte son nom (piste e-signature)
    const event = step.to === 'signed_client' ? `Signé par ${c.clientName}` : step.event;
    const by = step.to === 'signed_client' ? c.clientName : undefined;
    await logAudit(ctx, contractId, c.organizationId, event, by);
    return { ok: true as const, status: step.to };
  },
});

/** Met à jour les sections / le montant / la juridiction d'un contrat (éditeur). */
export const update = mutation({
  args: {
    contractId: v.id('contracts'),
    requesterId: v.id('users'),
    sections: v.optional(v.array(SECTION)),
    totalMinor: v.optional(v.number()),
    jurisdiction: v.optional(v.string()),
  },
  handler: async (ctx, { contractId, requesterId, sections, totalMinor, jurisdiction }) => {
    const c = await loadForWrite(ctx, contractId, requesterId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (sections !== undefined) {
      if (!sections.length) throw new Error('INVALID_SECTIONS');
      patch.sections = sections;
    }
    if (totalMinor !== undefined) patch.totalMinor = Math.max(0, Math.round(totalMinor));
    if (jurisdiction !== undefined) patch.jurisdiction = jurisdiction;
    await ctx.db.patch(contractId, patch);
    await logAudit(ctx, contractId, c.organizationId, 'Contrat modifié');
    return { ok: true as const };
  },
});

export const setStatus = mutation({
  args: { contractId: v.id('contracts'), requesterId: v.id('users'), status: STATUS },
  handler: async (ctx, { contractId, requesterId, status }) => {
    const c = await loadForWrite(ctx, contractId, requesterId);
    await ctx.db.patch(contractId, { status, updatedAt: Date.now() });
    await logAudit(
      ctx,
      contractId,
      c.organizationId,
      status === 'cancelled' ? 'Contrat annulé' : `Statut : ${status}`,
    );
    return { ok: true as const };
  },
});

export const remove = mutation({
  args: { contractId: v.id('contracts'), requesterId: v.id('users') },
  handler: async (ctx, { contractId, requesterId }) => {
    await loadForWrite(ctx, contractId, requesterId); // assertion d'accès (owner/admin + tier)
    const audit = await ctx.db
      .query('contractAudit')
      .withIndex('by_contract', (q) => q.eq('contractId', contractId))
      .collect();
    for (const a of audit) await ctx.db.delete(a._id);
    await ctx.db.delete(contractId);
    return { ok: true as const };
  },
});
