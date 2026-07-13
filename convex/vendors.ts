import { v } from 'convex/values';
import { mutation, query, type MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { assertOrgRead, assertOrgWrite, assertOrgProvisioned } from './lib/orgAuth';
import { vendorCapForTier } from './lib/entitlements';

/**
 * Annuaire prestataires — back-office agence (org-level, tous tiers ; Starter
 * plafonné à 25 fiches via `vendorCapForTier`).
 */

async function loadVendorForWrite(
  ctx: MutationCtx,
  vendorId: Id<'vendors'>,
  requesterId: Id<'users'>,
) {
  const vendor = await ctx.db.get(vendorId);
  if (!vendor) throw new Error('NOT_FOUND');
  await assertOrgWrite(ctx, vendor.organizationId, requesterId);
  return vendor;
}

export const listByOrg = query({
  args: { organizationId: v.id('organizations'), requesterId: v.id('users') },
  handler: async (ctx, { organizationId, requesterId }) => {
    await assertOrgRead(ctx, organizationId, requesterId);
    const vendors = await ctx.db
      .query('vendors')
      .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
      .collect();
    return vendors
      .map((vd) => ({
        _id: vd._id,
        name: vd.name,
        category: vd.category,
        location: vd.location,
        phone: vd.phone,
        email: vd.email,
        whatsapp: vd.whatsapp,
        website: vd.website,
        priceRange: vd.priceRange,
        rating: vd.rating,
        notes: vd.notes,
        createdAt: vd.createdAt,
        updatedAt: vd.updatedAt,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: {
    organizationId: v.id('organizations'),
    requesterId: v.id('users'),
    name: v.string(),
    category: v.string(),
    location: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    website: v.optional(v.string()),
    priceRange: v.optional(v.number()),
    rating: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertOrgWrite(ctx, args.organizationId, args.requesterId);
    // Garde-fou forfait : pas d'ajout de prestataire sans abonnement actif / crédit
    // PAYG (agence non finalisée). Réutilise le doc org pour le plafond annuaire.
    const org = await assertOrgProvisioned(ctx, args.organizationId);
    const name = args.name.trim();
    if (name.length < 1 || name.length > 120) throw new Error('INVALID_NAME');

    // Plafond annuaire (Starter ≤ 25).
    const cap = vendorCapForTier(org.subscriptionTier);
    if (cap !== null) {
      const existing = await ctx.db
        .query('vendors')
        .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
        .collect();
      if (existing.length >= cap) throw new Error('VENDOR_LIMIT_REACHED');
    }

    const now = Date.now();
    const id = await ctx.db.insert('vendors', {
      organizationId: args.organizationId,
      name,
      category: args.category.trim() || 'Autre',
      ...(args.location?.trim() ? { location: args.location.trim() } : {}),
      ...(args.phone?.trim() ? { phone: args.phone.trim() } : {}),
      ...(args.email?.trim() ? { email: args.email.trim().toLowerCase() } : {}),
      ...(args.whatsapp?.trim() ? { whatsapp: args.whatsapp.trim() } : {}),
      ...(args.website?.trim() ? { website: args.website.trim() } : {}),
      ...(args.priceRange != null
        ? { priceRange: Math.max(1, Math.min(3, Math.round(args.priceRange))) }
        : {}),
      ...(args.rating != null ? { rating: Math.max(0, Math.min(5, args.rating)) } : {}),
      ...(args.notes?.trim() ? { notes: args.notes.trim() } : {}),
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  },
});

export const update = mutation({
  args: {
    vendorId: v.id('vendors'),
    requesterId: v.id('users'),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    location: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    website: v.optional(v.string()),
    priceRange: v.optional(v.number()),
    rating: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await loadVendorForWrite(ctx, args.vendorId, args.requesterId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const t = args.name.trim();
      if (!t) throw new Error('INVALID_NAME');
      patch.name = t;
    }
    if (args.category !== undefined) patch.category = args.category.trim() || 'Autre';
    if (args.location !== undefined) patch.location = args.location.trim() || undefined;
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.email !== undefined) patch.email = args.email.trim().toLowerCase() || undefined;
    if (args.whatsapp !== undefined) patch.whatsapp = args.whatsapp.trim() || undefined;
    if (args.website !== undefined) patch.website = args.website.trim() || undefined;
    if (args.priceRange !== undefined) {
      patch.priceRange = args.priceRange
        ? Math.max(1, Math.min(3, Math.round(args.priceRange)))
        : undefined;
    }
    if (args.rating !== undefined) patch.rating = Math.max(0, Math.min(5, args.rating));
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;
    await ctx.db.patch(args.vendorId, patch);
    return { ok: true as const };
  },
});

export const remove = mutation({
  args: { vendorId: v.id('vendors'), requesterId: v.id('users') },
  handler: async (ctx, { vendorId, requesterId }) => {
    await loadVendorForWrite(ctx, vendorId, requesterId);
    // Détache aussi les engagements liés à ce prestataire.
    const engagements = await ctx.db
      .query('vendorEngagements')
      .withIndex('by_vendor', (q) => q.eq('vendorId', vendorId))
      .collect();
    for (const e of engagements) await ctx.db.delete(e._id);
    await ctx.db.delete(vendorId);
    return { ok: true as const };
  },
});

/* -------------------------------------------------------------------------- */
/*  Engagements prestataire ↔ mariage (« Par mariage »)                       */
/* -------------------------------------------------------------------------- */

const ENGAGEMENT_STATUS = v.union(
  v.literal('contacted'),
  v.literal('quoted'),
  v.literal('booked'),
  v.literal('confirmed'),
);

/** Tous les engagements de l'organisation, enrichis (prestataire + mariage). */
export const listEngagementsByOrg = query({
  args: { organizationId: v.id('organizations'), requesterId: v.id('users') },
  handler: async (ctx, { organizationId, requesterId }) => {
    await assertOrgRead(ctx, organizationId, requesterId);
    const engagements = await ctx.db
      .query('vendorEngagements')
      .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
      .collect();
    const rows = await Promise.all(
      engagements.map(async (e) => {
        const vendor = await ctx.db.get(e.vendorId);
        return {
          _id: e._id,
          vendorId: e.vendorId,
          eventId: e.eventId,
          status: e.status,
          plannedMinor: e.plannedMinor,
          budgetLineId: e.budgetLineId ?? null,
          vendorName: vendor?.name ?? '—',
          vendorCategory: vendor?.category ?? 'Autre',
          vendorRating: vendor?.rating,
          createdAt: e.createdAt,
        };
      }),
    );
    return rows.sort((a, b) => a.vendorName.localeCompare(b.vendorName));
  },
});

/** Rattache un prestataire à un mariage (option : créer la ligne budget). */
export const attachVendor = mutation({
  args: {
    organizationId: v.id('organizations'),
    requesterId: v.id('users'),
    vendorId: v.id('vendors'),
    eventId: v.id('events'),
    status: ENGAGEMENT_STATUS,
    plannedMinor: v.optional(v.number()),
    createBudgetLine: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await assertOrgWrite(ctx, args.organizationId, args.requesterId);
    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor || vendor.organizationId !== args.organizationId)
      throw new Error('VENDOR_NOT_FOUND');
    const event = await ctx.db.get(args.eventId);
    if (!event || event.organizationId !== args.organizationId) throw new Error('EVENT_NOT_FOUND');

    // Un seul engagement par couple (prestataire, mariage).
    const existing = await ctx.db
      .query('vendorEngagements')
      .withIndex('by_vendor_event', (q) =>
        q.eq('vendorId', args.vendorId).eq('eventId', args.eventId),
      )
      .first();
    if (existing) throw new Error('ALREADY_ATTACHED');

    const now = Date.now();
    const planned =
      args.plannedMinor != null && args.plannedMinor > 0
        ? Math.round(args.plannedMinor)
        : undefined;

    // Option : créer la ligne budget correspondante sur l'événement.
    let budgetLineId: Id<'budgetLines'> | undefined;
    if (args.createBudgetLine && planned != null) {
      budgetLineId = await ctx.db.insert('budgetLines', {
        eventId: args.eventId,
        organizationId: args.organizationId,
        category: vendor.category,
        label: vendor.name,
        vendorName: vendor.name,
        plannedMinor: planned,
        paidMinor: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    const id = await ctx.db.insert('vendorEngagements', {
      organizationId: args.organizationId,
      vendorId: args.vendorId,
      eventId: args.eventId,
      status: args.status,
      ...(planned != null ? { plannedMinor: planned } : {}),
      ...(budgetLineId ? { budgetLineId } : {}),
      createdAt: now,
      updatedAt: now,
    });
    return { id, budgetLineCreated: budgetLineId != null };
  },
});

export const setEngagementStatus = mutation({
  args: {
    engagementId: v.id('vendorEngagements'),
    requesterId: v.id('users'),
    status: ENGAGEMENT_STATUS,
  },
  handler: async (ctx, { engagementId, requesterId, status }) => {
    const eng = await ctx.db.get(engagementId);
    if (!eng) throw new Error('NOT_FOUND');
    await assertOrgWrite(ctx, eng.organizationId, requesterId);
    await ctx.db.patch(engagementId, { status, updatedAt: Date.now() });
    return { ok: true as const };
  },
});

export const detachVendor = mutation({
  args: { engagementId: v.id('vendorEngagements'), requesterId: v.id('users') },
  handler: async (ctx, { engagementId, requesterId }) => {
    const eng = await ctx.db.get(engagementId);
    if (!eng) throw new Error('NOT_FOUND');
    await assertOrgWrite(ctx, eng.organizationId, requesterId);
    await ctx.db.delete(engagementId);
    return { ok: true as const };
  },
});
