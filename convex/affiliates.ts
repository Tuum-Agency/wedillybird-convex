import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { assertWebhookSecret } from './lib/webhookSecret';

/* ===========================================================================
 * PROGRAMME PARTENAIRES / AFFILIATION INFLUENCEURS
 *
 * Modèle : une influenceuse (`influencers`) reçoit un code promo (remise
 * communauté + attribution) et une commission (`commissions`) sur chaque vente
 * réalisée via son code. Le code promo est un couple Coupon/PromotionCode
 * Stripe créé côté server action ; ici on ne fait que stocker/attribuer.
 *
 * Auth : mêmes patrons que `admin.ts` (mutations admin gardées par `assertAdmin`
 * + audit) et que `payments.ts` (mutations de bridge webhook gardées par
 * `CONVEX_WEBHOOK_SECRET`).
 * ======================================================================== */

const CURRENCY = v.union(
  v.literal('EUR'),
  v.literal('USD'),
  v.literal('XOF'),
  v.literal('MAD'),
  v.literal('TND'),
);

const COMMISSION_SOURCE = v.union(
  v.literal('payment'),
  v.literal('payg'),
  v.literal('subscription'),
);

const PREMIUM_PERK = v.union(v.literal('none'), v.literal('promised'), v.literal('granted'));

async function assertAdmin(
  ctx: { db: { get: (id: Id<'users'>) => Promise<{ role: string } | null> } },
  adminId: Id<'users'>,
) {
  const user = await ctx.db.get(adminId);
  if (!user || user.role !== 'admin') {
    throw new Error('FORBIDDEN: admin role required');
  }
  return user;
}

/**
 * Commission (unités mineures) = round(montant vente × taux% / 100).
 *
 * ⚠️ DUPLIQUÉ de `lib/payments/affiliate.ts:computeCommissionMinor` — `convex/`
 * et `lib/` ne peuvent pas s'importer (projets tsconfig séparés). Les deux
 * copies doivent rester alignées ; la logique est testée côté `lib`.
 */
function computeCommissionMinor(saleAmountMinor: number, commissionPct: number): number {
  if (!Number.isFinite(saleAmountMinor) || !Number.isFinite(commissionPct)) return 0;
  if (saleAmountMinor <= 0 || commissionPct <= 0) return 0;
  return Math.round((saleAmountMinor * commissionPct) / 100);
}

/* -------------------------------------------------------------------------- */
/*  Lectures admin                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Liste les influenceuses avec leurs totaux de commissions (dues / versées).
 * Volume faible → on collecte toutes les commissions et on agrège en mémoire.
 */
export const listInfluencers = query({
  args: { adminId: v.id('users') },
  handler: async (ctx, { adminId }) => {
    await assertAdmin(ctx, adminId);
    const influencers = await ctx.db.query('influencers').collect();
    const commissions = await ctx.db.query('commissions').collect();

    const totals = new Map<
      string,
      { pendingMinor: number; paidMinor: number; pendingCount: number; salesCount: number }
    >();
    for (const c of commissions) {
      const key = c.influencerId;
      const t = totals.get(key) ?? {
        pendingMinor: 0,
        paidMinor: 0,
        pendingCount: 0,
        salesCount: 0,
      };
      t.salesCount += 1;
      if (c.status === 'pending') {
        t.pendingMinor += c.commissionMinor;
        t.pendingCount += 1;
      } else if (c.status === 'paid') {
        t.paidMinor += c.commissionMinor;
      }
      totals.set(key, t);
    }

    return influencers
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((i) => {
        const t = totals.get(i._id) ?? {
          pendingMinor: 0,
          paidMinor: 0,
          pendingCount: 0,
          salesCount: 0,
        };
        return {
          _id: i._id,
          name: i.name,
          handle: i.handle ?? null,
          email: i.email ?? null,
          phone: i.phone ?? null,
          status: i.status,
          commissionPct: i.commissionPct,
          code: i.code ?? null,
          couponId: i.couponId ?? null,
          promotionCodeId: i.promotionCodeId ?? null,
          discountPct: i.discountPct ?? null,
          stripeConnectAccountId: i.stripeConnectAccountId ?? null,
          connectPayoutsEnabled: i.connectPayoutsEnabled ?? false,
          connectDetailsSubmitted: i.connectDetailsSubmitted ?? false,
          premiumPerk: i.premiumPerk,
          notes: i.notes ?? null,
          createdAt: i.createdAt,
          pendingMinor: t.pendingMinor,
          paidMinor: t.paidMinor,
          pendingCount: t.pendingCount,
          salesCount: t.salesCount,
        };
      });
  },
});

/** Registre des commissions (optionnellement filtré par influenceuse). */
export const listCommissions = query({
  args: { adminId: v.id('users'), influencerId: v.optional(v.id('influencers')) },
  handler: async (ctx, { adminId, influencerId }) => {
    await assertAdmin(ctx, adminId);
    const rows = influencerId
      ? await ctx.db
          .query('commissions')
          .withIndex('by_influencer', (q) => q.eq('influencerId', influencerId))
          .collect()
      : await ctx.db.query('commissions').collect();

    const influencers = await ctx.db.query('influencers').collect();
    const nameById = new Map(influencers.map((i) => [i._id, i.name]));

    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 200)
      .map((c) => ({
        _id: c._id,
        influencerId: c.influencerId,
        influencerName: nameById.get(c.influencerId) ?? '—',
        source: c.source,
        sourceId: c.sourceId,
        saleAmountMinor: c.saleAmountMinor,
        currency: c.currency,
        commissionPct: c.commissionPct,
        commissionMinor: c.commissionMinor,
        status: c.status,
        description: c.description ?? null,
        stripeTransferId: c.stripeTransferId ?? null,
        paidAt: c.paidAt ?? null,
        createdAt: c.createdAt,
      }));
  },
});

/** Détail d'une influenceuse (pour les server actions Stripe : email/code/compte). */
export const getInfluencer = query({
  args: { adminId: v.id('users'), influencerId: v.id('influencers') },
  handler: async (ctx, { adminId, influencerId }) => {
    await assertAdmin(ctx, adminId);
    const i = await ctx.db.get(influencerId);
    if (!i) throw new Error('INFLUENCER_NOT_FOUND');
    return i;
  },
});

/** Commissions dues (`pending`) d'une influenceuse — sert à préparer le versement. */
export const listPendingCommissions = query({
  args: { adminId: v.id('users'), influencerId: v.id('influencers') },
  handler: async (ctx, { adminId, influencerId }) => {
    await assertAdmin(ctx, adminId);
    const rows = await ctx.db
      .query('commissions')
      .withIndex('by_influencer_status', (q) =>
        q.eq('influencerId', influencerId).eq('status', 'pending'),
      )
      .collect();
    return rows.map((c) => ({
      _id: c._id,
      commissionMinor: c.commissionMinor,
      currency: c.currency,
      status: c.status,
    }));
  },
});

/* -------------------------------------------------------------------------- */
/*  Mutations admin — CRUD influenceuses                                       */
/* -------------------------------------------------------------------------- */

export const createInfluencer = mutation({
  args: {
    adminId: v.id('users'),
    name: v.string(),
    handle: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    commissionPct: v.number(),
    premiumPerk: v.optional(PREMIUM_PERK),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdmin(ctx, args.adminId);
    if (args.commissionPct < 0 || args.commissionPct > 100) {
      throw new Error('INVALID_COMMISSION_PCT');
    }
    const now = Date.now();
    const influencerId = await ctx.db.insert('influencers', {
      name: args.name.trim(),
      handle: args.handle?.trim() || undefined,
      email: args.email?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      status: 'active',
      commissionPct: args.commissionPct,
      premiumPerk: args.premiumPerk ?? 'none',
      notes: args.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert('adminAuditLog', {
      adminId: args.adminId,
      action: 'create_influencer',
      targetType: 'influencer',
      targetId: influencerId,
      details: JSON.stringify({ name: args.name, commissionPct: args.commissionPct }),
      createdAt: now,
    });
    return { ok: true as const, influencerId };
  },
});

export const updateInfluencer = mutation({
  args: {
    adminId: v.id('users'),
    influencerId: v.id('influencers'),
    name: v.optional(v.string()),
    handle: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    commissionPct: v.optional(v.number()),
    status: v.optional(v.union(v.literal('active'), v.literal('paused'))),
    premiumPerk: v.optional(PREMIUM_PERK),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdmin(ctx, args.adminId);
    const influencer = await ctx.db.get(args.influencerId);
    if (!influencer) throw new Error('INFLUENCER_NOT_FOUND');
    if (args.commissionPct != null && (args.commissionPct < 0 || args.commissionPct > 100)) {
      throw new Error('INVALID_COMMISSION_PCT');
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.handle !== undefined) patch.handle = args.handle.trim() || undefined;
    if (args.email !== undefined) patch.email = args.email.trim() || undefined;
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.commissionPct !== undefined) patch.commissionPct = args.commissionPct;
    if (args.status !== undefined) patch.status = args.status;
    if (args.premiumPerk !== undefined) patch.premiumPerk = args.premiumPerk;
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;
    await ctx.db.patch(args.influencerId, patch);
    await ctx.db.insert('adminAuditLog', {
      adminId: args.adminId,
      action: 'update_influencer',
      targetType: 'influencer',
      targetId: args.influencerId,
      details: JSON.stringify({ fields: Object.keys(patch).filter((k) => k !== 'updatedAt') }),
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
});

/** Rattache le code promo Stripe (coupon + promotion code) à l'influenceuse. */
export const attachPromoCode = mutation({
  args: {
    adminId: v.id('users'),
    influencerId: v.id('influencers'),
    couponId: v.string(),
    promotionCodeId: v.string(),
    code: v.string(),
    discountPct: v.number(),
  },
  handler: async (ctx, args) => {
    await assertAdmin(ctx, args.adminId);
    const influencer = await ctx.db.get(args.influencerId);
    if (!influencer) throw new Error('INFLUENCER_NOT_FOUND');
    await ctx.db.patch(args.influencerId, {
      couponId: args.couponId,
      promotionCodeId: args.promotionCodeId,
      code: args.code.toUpperCase(),
      discountPct: args.discountPct,
      updatedAt: Date.now(),
    });
    await ctx.db.insert('adminAuditLog', {
      adminId: args.adminId,
      action: 'attach_influencer_code',
      targetType: 'influencer',
      targetId: args.influencerId,
      details: JSON.stringify({ code: args.code, discountPct: args.discountPct }),
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
});

/** Enregistre le compte Stripe Connect (versement) de l'influenceuse. */
export const setConnectAccount = mutation({
  args: {
    adminId: v.id('users'),
    influencerId: v.id('influencers'),
    stripeConnectAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertAdmin(ctx, args.adminId);
    const influencer = await ctx.db.get(args.influencerId);
    if (!influencer) throw new Error('INFLUENCER_NOT_FOUND');
    await ctx.db.patch(args.influencerId, {
      stripeConnectAccountId: args.stripeConnectAccountId,
      updatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});

/**
 * Marque un lot de commissions comme versées (après un transfer Stripe réussi).
 * Idempotent par ligne : n'affecte que les `pending`.
 */
export const markCommissionsPaid = mutation({
  args: {
    adminId: v.id('users'),
    commissionIds: v.array(v.id('commissions')),
    stripeTransferId: v.string(),
  },
  handler: async (ctx, { adminId, commissionIds, stripeTransferId }) => {
    await assertAdmin(ctx, adminId);
    const now = Date.now();
    let paidCount = 0;
    let paidMinor = 0;
    for (const id of commissionIds) {
      const c = await ctx.db.get(id);
      if (!c || c.status !== 'pending') continue;
      await ctx.db.patch(id, {
        status: 'paid',
        stripeTransferId,
        paidAt: now,
        updatedAt: now,
      });
      paidCount += 1;
      paidMinor += c.commissionMinor;
    }
    await ctx.db.insert('adminAuditLog', {
      adminId,
      action: 'pay_commissions',
      targetType: 'commission',
      targetId: stripeTransferId,
      details: JSON.stringify({ paidCount, paidMinor, stripeTransferId }),
      createdAt: now,
    });
    return { ok: true as const, paidCount, paidMinor };
  },
});

/* -------------------------------------------------------------------------- */
/*  Bridge webhook — attribution + statut Connect (gardé par le secret)        */
/* -------------------------------------------------------------------------- */

/**
 * Enregistre une commission pour une vente attribuée à une influenceuse via son
 * code promo. Appelé par le webhook après confirmation d'une vente `succeeded`.
 *
 * Idempotent via `by_source` (source, sourceId) : un renvoi de webhook ne crée
 * pas de doublon. Retourne `{ attributed: false }` si aucune influenceuse ne
 * correspond au code (cas nominal : vente sans code promo influenceur).
 */
export const recordCommissionFromSale = mutation({
  args: {
    webhookSecret: v.string(),
    source: COMMISSION_SOURCE,
    sourceId: v.string(),
    saleAmountMinor: v.number(),
    currency: CURRENCY,
    couponId: v.optional(v.string()),
    promotionCodeId: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertWebhookSecret(args.webhookSecret);

    // Résolution de l'influenceuse : par promotion code d'abord (clé la plus
    // précise), puis par coupon en repli.
    let influencer = null;
    if (args.promotionCodeId) {
      influencer = await ctx.db
        .query('influencers')
        .withIndex('by_promotion_code', (q) => q.eq('promotionCodeId', args.promotionCodeId))
        .first();
    }
    if (!influencer && args.couponId) {
      influencer = await ctx.db
        .query('influencers')
        .withIndex('by_coupon', (q) => q.eq('couponId', args.couponId))
        .first();
    }
    if (!influencer) return { attributed: false as const };

    // Idempotence : une vente = au plus une commission.
    const existing = await ctx.db
      .query('commissions')
      .withIndex('by_source', (q) => q.eq('source', args.source).eq('sourceId', args.sourceId))
      .first();
    if (existing) {
      return { attributed: true as const, alreadyApplied: true as const };
    }

    const commissionMinor = computeCommissionMinor(args.saleAmountMinor, influencer.commissionPct);
    const now = Date.now();
    await ctx.db.insert('commissions', {
      influencerId: influencer._id,
      source: args.source,
      sourceId: args.sourceId,
      saleAmountMinor: args.saleAmountMinor,
      currency: args.currency,
      commissionPct: influencer.commissionPct,
      commissionMinor,
      status: 'pending',
      description: args.description,
      createdAt: now,
      updatedAt: now,
    });
    return {
      attributed: true as const,
      alreadyApplied: false as const,
      commissionMinor,
    };
  },
});

/**
 * Lecture minimale du compte Connect d'une influenceuse pour la route de retour
 * d'onboarding (publique). Gardée par le secret webhook — ne renvoie que
 * l'identifiant du compte Stripe, rien de sensible.
 */
export const getConnectForReturn = query({
  args: { webhookSecret: v.string(), influencerId: v.id('influencers') },
  handler: async (ctx, { webhookSecret, influencerId }) => {
    assertWebhookSecret(webhookSecret);
    const influencer = await ctx.db.get(influencerId);
    if (!influencer) return null;
    return { stripeConnectAccountId: influencer.stripeConnectAccountId ?? null };
  },
});

/**
 * Rafraîchit le statut Connect d'une influenceuse au retour d'onboarding.
 * Gardé par le secret webhook car appelé depuis une route publique (le lien de
 * retour Stripe est cliqué par l'influenceuse, pas par un admin connecté).
 */
export const applyConnectStatus = mutation({
  args: {
    webhookSecret: v.string(),
    influencerId: v.id('influencers'),
    chargesEnabled: v.boolean(),
    detailsSubmitted: v.boolean(),
    payoutsEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    assertWebhookSecret(args.webhookSecret);
    const influencer = await ctx.db.get(args.influencerId);
    if (!influencer) throw new Error('INFLUENCER_NOT_FOUND');
    await ctx.db.patch(args.influencerId, {
      connectChargesEnabled: args.chargesEnabled,
      connectDetailsSubmitted: args.detailsSubmitted,
      connectPayoutsEnabled: args.payoutsEnabled,
      updatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});
