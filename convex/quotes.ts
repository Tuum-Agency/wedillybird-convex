import { v } from 'convex/values';
import { mutation, query, type MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { assertOrgRead, assertOrgWrite } from './lib/orgAuth';
import { proTierAtLeast } from './lib/entitlements';

/**
 * Devis & Factures — back-office agence (module « Finances »).
 *
 * Réservé aux forfaits **Business+** (émission de documents) ; lecture également
 * Business+. Org-level : chaque document appartient à une organisation, peut
 * être rattaché à un client (`clients`) et à un mariage (`events`).
 * Montants en centimes. Numérotation « DEV-AAAA-NNN » / « FAC-AAAA-NNN ».
 */

const STATUS = v.union(
  v.literal('draft'),
  v.literal('sent'),
  v.literal('accepted'),
  v.literal('refused'),
  v.literal('expired'),
  v.literal('partial'),
  v.literal('paid'),
  v.literal('overdue'),
);

const LINE_ITEM = v.object({ label: v.string(), qty: v.number(), unitPriceMinor: v.number() });
const SCHEDULE_ENTRY = v.object({
  label: v.string(),
  amountMinor: v.number(),
  dueDate: v.optional(v.number()),
  paid: v.boolean(),
});

async function assertQuotingAllowed(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
): Promise<void> {
  const org = await ctx.db.get(organizationId);
  if (!org) throw new Error('NOT_FOUND');
  if (!proTierAtLeast(org.subscriptionTier, 'business')) throw new Error('FEATURE_NOT_IN_PLAN');
}

function lineTotal(li: { qty: number; unitPriceMinor: number }): number {
  return Math.round((li.qty || 0) * (li.unitPriceMinor || 0));
}
function subtotal(items: ReadonlyArray<{ qty: number; unitPriceMinor: number }>): number {
  return items.reduce((a, li) => a + lineTotal(li), 0);
}
export function totalMinor(doc: {
  lineItems: ReadonlyArray<{ qty: number; unitPriceMinor: number }>;
  discountMinor?: number;
  discountPct?: number;
  taxRate?: number;
}): number {
  const sub = subtotal(doc.lineItems);
  const disc = doc.discountPct
    ? Math.round((sub * doc.discountPct) / 100)
    : Math.max(0, doc.discountMinor ?? 0);
  const tax = Math.round(((sub - disc) * (doc.taxRate || 0)) / 100);
  return sub - disc + tax;
}

async function logActivity(
  ctx: MutationCtx,
  docId: Id<'quoteDocs'>,
  organizationId: Id<'organizations'>,
  label: string,
  icon: string,
): Promise<void> {
  await ctx.db.insert('quoteActivity', {
    docId,
    organizationId,
    label,
    icon,
    createdAt: Date.now(),
  });
}

/** Numéro suivant pour un type donné dans l'organisation (séquence par année). */
async function nextNumber(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  type: 'quote' | 'invoice',
  year: number,
): Promise<string> {
  const docs = await ctx.db
    .query('quoteDocs')
    .withIndex('by_org_type', (q) => q.eq('organizationId', organizationId).eq('type', type))
    .collect();
  const seq = docs.filter((d) => new Date(d.issueDate).getFullYear() === year).length + 1;
  const prefix = type === 'quote' ? 'DEV' : 'FAC';
  return `${prefix}-${year}-${String(seq).padStart(3, '0')}`;
}

function serialize(d: Doc<'quoteDocs'>) {
  return {
    _id: d._id,
    type: d.type,
    number: d.number,
    clientId: d.clientId,
    clientName: d.clientName,
    eventId: d.eventId,
    status: d.status,
    lineItems: d.lineItems,
    discountMinor: d.discountMinor,
    discountPct: d.discountPct,
    taxRate: d.taxRate,
    schedule: d.schedule,
    issueDate: d.issueDate,
    dueDate: d.dueDate,
    notes: d.notes,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export const listByOrg = query({
  args: { organizationId: v.id('organizations'), requesterId: v.id('users') },
  handler: async (ctx, { organizationId, requesterId }) => {
    await assertOrgRead(ctx, organizationId, requesterId);
    const docs = await ctx.db
      .query('quoteDocs')
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
      docs: docs.map(serialize).sort((a, b) => b.issueDate - a.issueDate),
      clients: clients
        .map((c) => ({
          _id: c._id,
          name: c.partnerB ? `${c.partnerA} & ${c.partnerB}` : c.partnerA,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      weddings: events.map((e) => ({
        _id: e._id,
        coupleNames: `${e.coupleNames.partnerA} & ${e.coupleNames.partnerB}`,
        date: e.eventDate,
      })),
    };
  },
});

export const getById = query({
  args: { docId: v.id('quoteDocs'), requesterId: v.id('users') },
  handler: async (ctx, { docId, requesterId }) => {
    const doc = await ctx.db.get(docId);
    if (!doc) return null;
    await assertOrgRead(ctx, doc.organizationId, requesterId);
    const activity = await ctx.db
      .query('quoteActivity')
      .withIndex('by_doc', (q) => q.eq('docId', docId))
      .collect();
    return {
      doc: serialize(doc),
      activity: activity
        .map((a) => ({ _id: a._id, label: a.label, icon: a.icon, createdAt: a.createdAt }))
        .sort((a, b) => a.createdAt - b.createdAt),
    };
  },
});

export const create = mutation({
  args: {
    organizationId: v.id('organizations'),
    requesterId: v.id('users'),
    type: v.union(v.literal('quote'), v.literal('invoice')),
    clientId: v.optional(v.id('clients')),
    clientName: v.optional(v.string()),
    eventId: v.optional(v.id('events')),
    lineItems: v.array(LINE_ITEM),
    discountMinor: v.optional(v.number()),
    discountPct: v.optional(v.number()),
    taxRate: v.optional(v.number()),
    schedule: v.optional(v.array(SCHEDULE_ENTRY)),
    dueDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    status: v.optional(STATUS),
  },
  handler: async (ctx, args) => {
    await assertOrgWrite(ctx, args.organizationId, args.requesterId);
    await assertQuotingAllowed(ctx, args.organizationId);

    let clientName = args.clientName?.trim() ?? '';
    if (args.clientId) {
      const c = await ctx.db.get(args.clientId);
      if (!c || c.organizationId !== args.organizationId) throw new Error('NOT_FOUND');
      clientName = c.partnerB ? `${c.partnerA} & ${c.partnerB}` : c.partnerA;
    }
    if (!clientName) throw new Error('INVALID_CLIENT');
    if (!args.lineItems.length) throw new Error('INVALID_LINES');

    const now = Date.now();
    const number = await nextNumber(
      ctx,
      args.organizationId,
      args.type,
      new Date(now).getFullYear(),
    );
    const id = await ctx.db.insert('quoteDocs', {
      organizationId: args.organizationId,
      type: args.type,
      number,
      ...(args.clientId ? { clientId: args.clientId } : {}),
      clientName,
      ...(args.eventId ? { eventId: args.eventId } : {}),
      status: args.status ?? 'draft',
      lineItems: args.lineItems.map((l) => ({
        label: l.label.trim(),
        qty: Math.max(0, l.qty),
        unitPriceMinor: Math.max(0, Math.round(l.unitPriceMinor)),
      })),
      ...(args.discountMinor != null
        ? { discountMinor: Math.max(0, Math.round(args.discountMinor)) }
        : {}),
      ...(args.discountPct != null ? { discountPct: args.discountPct } : {}),
      ...(args.taxRate != null ? { taxRate: args.taxRate } : {}),
      ...(args.schedule ? { schedule: args.schedule } : {}),
      issueDate: now,
      ...(args.dueDate ? { dueDate: args.dueDate } : {}),
      ...(args.notes?.trim() ? { notes: args.notes.trim() } : {}),
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(
      ctx,
      id,
      args.organizationId,
      args.type === 'quote' ? 'Devis créé' : 'Facture créée',
      'FilePlus',
    );
    return { id, number };
  },
});

async function loadForWrite(ctx: MutationCtx, docId: Id<'quoteDocs'>, requesterId: Id<'users'>) {
  const doc = await ctx.db.get(docId);
  if (!doc) throw new Error('NOT_FOUND');
  await assertOrgWrite(ctx, doc.organizationId, requesterId);
  await assertQuotingAllowed(ctx, doc.organizationId);
  return doc;
}

export const update = mutation({
  args: {
    docId: v.id('quoteDocs'),
    requesterId: v.id('users'),
    clientId: v.optional(v.id('clients')),
    eventId: v.optional(v.id('events')),
    lineItems: v.optional(v.array(LINE_ITEM)),
    discountMinor: v.optional(v.number()),
    discountPct: v.optional(v.number()),
    taxRate: v.optional(v.number()),
    schedule: v.optional(v.array(SCHEDULE_ENTRY)),
    dueDate: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await loadForWrite(ctx, args.docId, args.requesterId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.clientId !== undefined) {
      const c = await ctx.db.get(args.clientId);
      if (!c || c.organizationId !== doc.organizationId) throw new Error('NOT_FOUND');
      patch.clientId = args.clientId;
      patch.clientName = c.partnerB ? `${c.partnerA} & ${c.partnerB}` : c.partnerA;
    }
    if (args.eventId !== undefined) patch.eventId = args.eventId;
    if (args.lineItems !== undefined) {
      if (!args.lineItems.length) throw new Error('INVALID_LINES');
      patch.lineItems = args.lineItems.map((l) => ({
        label: l.label.trim(),
        qty: Math.max(0, l.qty),
        unitPriceMinor: Math.max(0, Math.round(l.unitPriceMinor)),
      }));
    }
    if (args.discountMinor !== undefined)
      patch.discountMinor = Math.max(0, Math.round(args.discountMinor));
    if (args.discountPct !== undefined) patch.discountPct = args.discountPct;
    if (args.taxRate !== undefined) patch.taxRate = args.taxRate;
    if (args.schedule !== undefined) patch.schedule = args.schedule;
    if (args.dueDate !== undefined) patch.dueDate = args.dueDate;
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;
    await ctx.db.patch(args.docId, patch);
    return { ok: true as const };
  },
});

export const updateStatus = mutation({
  args: { docId: v.id('quoteDocs'), requesterId: v.id('users'), status: STATUS },
  handler: async (ctx, { docId, requesterId, status }) => {
    const doc = await loadForWrite(ctx, docId, requesterId);
    await ctx.db.patch(docId, { status, updatedAt: Date.now() });
    const LABELS: Record<string, string> = {
      sent: doc.type === 'quote' ? 'Devis envoyé au client' : 'Facture envoyée',
      accepted: 'Devis accepté',
      refused: 'Devis refusé',
      paid: 'Marqué payé',
      overdue: 'Passé en retard',
    };
    await logActivity(
      ctx,
      docId,
      doc.organizationId,
      LABELS[status] ?? `Statut : ${status}`,
      status === 'paid' ? 'CircleCheck' : 'Send',
    );
    return { ok: true as const };
  },
});

/** Marque une échéance payée (index dans `schedule`) et recalcule le statut. */
export const recordSchedulePayment = mutation({
  args: { docId: v.id('quoteDocs'), requesterId: v.id('users'), index: v.number() },
  handler: async (ctx, { docId, requesterId, index }) => {
    const doc = await loadForWrite(ctx, docId, requesterId);
    const entry = doc.schedule?.[index];
    if (!doc.schedule || !entry) throw new Error('INVALID_SCHEDULE');
    const schedule = doc.schedule.map((s, i) => (i === index ? { ...s, paid: true } : s));
    const total = totalMinor(doc);
    const paid = schedule.filter((s) => s.paid).reduce((a, s) => a + s.amountMinor, 0);
    const status: Doc<'quoteDocs'>['status'] =
      paid >= total ? 'paid' : paid > 0 ? 'partial' : doc.status;
    await ctx.db.patch(docId, { schedule, status, updatedAt: Date.now() });
    await logActivity(ctx, docId, doc.organizationId, `${entry.label} encaissé`, 'CircleCheck');
    return { ok: true as const, status };
  },
});

/** Crée une facture à partir d'un devis accepté. */
export const convertToInvoice = mutation({
  args: { docId: v.id('quoteDocs'), requesterId: v.id('users') },
  handler: async (ctx, { docId, requesterId }) => {
    const doc = await loadForWrite(ctx, docId, requesterId);
    if (doc.type !== 'quote') throw new Error('NOT_A_QUOTE');
    const now = Date.now();
    const number = await nextNumber(
      ctx,
      doc.organizationId,
      'invoice',
      new Date(now).getFullYear(),
    );
    const id = await ctx.db.insert('quoteDocs', {
      organizationId: doc.organizationId,
      type: 'invoice',
      number,
      ...(doc.clientId ? { clientId: doc.clientId } : {}),
      clientName: doc.clientName,
      ...(doc.eventId ? { eventId: doc.eventId } : {}),
      status: 'draft',
      lineItems: doc.lineItems,
      ...(doc.discountMinor != null ? { discountMinor: doc.discountMinor } : {}),
      ...(doc.discountPct != null ? { discountPct: doc.discountPct } : {}),
      ...(doc.taxRate != null ? { taxRate: doc.taxRate } : {}),
      issueDate: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(docId, { status: 'accepted', updatedAt: now });
    await logActivity(
      ctx,
      id,
      doc.organizationId,
      `Facture créée depuis ${doc.number}`,
      'FileCheck',
    );
    return { id, number };
  },
});

export const remove = mutation({
  args: { docId: v.id('quoteDocs'), requesterId: v.id('users') },
  handler: async (ctx, { docId, requesterId }) => {
    const doc = await loadForWrite(ctx, docId, requesterId);
    const activity = await ctx.db
      .query('quoteActivity')
      .withIndex('by_doc', (q) => q.eq('docId', docId))
      .collect();
    for (const a of activity) await ctx.db.delete(a._id);
    await ctx.db.delete(docId);
    return { ok: true as const };
  },
});
