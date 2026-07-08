/**
 * Programme d'affiliation / parrainage — backend Convex (le « moteur »).
 *
 * S'appuie sur la logique pure de `lib/affiliate.ts` (déjà testée). Le ledger
 * (`affiliateReferrals`) est la source de vérité : écriture IDEMPOTENTE sur
 * `sourceSessionId` (webhooks Stripe at-least-once), vesting à la date event,
 * reversal sur remboursement/litige. Le VERSEMENT (crédit auto / cash) se
 * branche par-dessus (phase suivante) — ici on ne calcule et ne suit que le dû.
 */
import { v } from 'convex/values';
import {
  mutation,
  query,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import type { Id } from './_generated/dataModel';
import {
  DEFAULT_RATE_BPS,
  isRewardConfigSafe,
  isSelfReferral,
  isValidAffiliateCode,
  normalizeAffiliateCode,
  rewardMinor,
  settledStatusFor,
  vestsAt as computeVestsAt,
  isVestable,
  canReverse,
  generateReferralCode,
  selectReferralsToConsume,
} from './lib/affiliate';

/** Garde admin (miroir de `admin.ts`, volontairement convex-local). */
async function assertAdmin(
  ctx: { db: { get: (id: Id<'users'>) => Promise<{ role: string } | null> } },
  adminId: Id<'users'>,
) {
  const user = await ctx.db.get(adminId);
  if (!user || user.role !== 'admin') throw new Error('FORBIDDEN: admin role required');
  return user;
}

/* ============================ Création (admin) ============================ */

/**
 * Crée un affilié + son code. `partner` = cash (invitation-only, payout
 * différé), `referral` = crédit (boucle particulier). Le garde-fou marge
 * (`isRewardConfigSafe`) refuse tout cumul remise+commission dangereux.
 */
export const createAffiliate = mutation({
  args: {
    adminId: v.id('users'),
    code: v.string(),
    kind: v.union(v.literal('referral'), v.literal('partner')),
    rewardType: v.union(v.literal('credit'), v.literal('cash')),
    rateBps: v.number(),
    buyerDiscountBps: v.number(),
    ownerUserId: v.optional(v.id('users')),
    ownerEmail: v.optional(v.string()),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdmin(ctx, args.adminId);

    const code = normalizeAffiliateCode(args.code);
    if (!isValidAffiliateCode(code)) throw new Error('INVALID_CODE');
    if (!isRewardConfigSafe({ rateBps: args.rateBps, buyerDiscountBps: args.buyerDiscountBps })) {
      throw new Error('UNSAFE_REWARD_CONFIG');
    }

    const existing = await ctx.db
      .query('affiliates')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first();
    if (existing) throw new Error('CODE_ALREADY_EXISTS');

    const now = Date.now();
    const id = await ctx.db.insert('affiliates', {
      code,
      kind: args.kind,
      rewardType: args.rewardType,
      rateBps: args.rateBps,
      buyerDiscountBps: args.buyerDiscountBps,
      ownerUserId: args.ownerUserId,
      ownerEmail: args.ownerEmail?.trim().toLowerCase(),
      displayName: args.displayName?.trim(),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    return { id, code };
  },
});

/** Active/désactive un affilié (admin). */
export const setAffiliateStatus = mutation({
  args: {
    adminId: v.id('users'),
    affiliateId: v.id('affiliates'),
    status: v.union(v.literal('active'), v.literal('disabled')),
  },
  handler: async (ctx, { adminId, affiliateId, status }) => {
    await assertAdmin(ctx, adminId);
    await ctx.db.patch(affiliateId, { status, updatedAt: Date.now() });
    return null;
  },
});

/* ============================ Attribution ============================ */

/**
 * Résout un code (`?ref=CODE`) vers l'affilié actif — utilisé au checkout pour
 * poser `metadata.affiliateId` sur la Session. Ne révèle que le strict
 * nécessaire (jamais d'infos internes).
 */
export const getAffiliateByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const normalized = normalizeAffiliateCode(code);
    if (!isValidAffiliateCode(normalized)) return null;
    const aff = await ctx.db
      .query('affiliates')
      .withIndex('by_code', (q) => q.eq('code', normalized))
      .first();
    if (!aff || aff.status !== 'active') return null;
    return {
      id: aff._id,
      code: aff.code,
      kind: aff.kind,
      rewardType: aff.rewardType,
      buyerDiscountBps: aff.buyerDiscountBps,
    };
  },
});

/**
 * Cœur d'écriture du ledger — helper Convex réutilisable DANS une transaction
 * existante (pas un endpoint) : appelé par `payments.markSucceeded` à la
 * confirmation d'un paiement attribué, en best-effort. Idempotent sur
 * `sourceSessionId` (webhook Stripe rejoué safe), anti-self-referral, récompense
 * calculée sur le net, vesting à la date event.
 */
export async function applyReferral(
  ctx: MutationCtx,
  args: {
    affiliateId: Id<'affiliates'>;
    sourceSessionId: string;
    grossMinor: number;
    netMinor: number;
    currency: string;
    purchasedAt: number;
    eventDate?: number;
    eventId?: Id<'events'>;
    buyerUserId?: Id<'users'>;
    buyerEmail?: string | null;
  },
): Promise<
  | { outcome: 'deduped'; referralId: Id<'affiliateReferrals'> }
  | { outcome: 'inactive' }
  | { outcome: 'self_referral' }
  | { outcome: 'recorded'; referralId: Id<'affiliateReferrals'> }
> {
  const dup = await ctx.db
    .query('affiliateReferrals')
    .withIndex('by_source_session', (q) => q.eq('sourceSessionId', args.sourceSessionId))
    .first();
  if (dup) return { outcome: 'deduped', referralId: dup._id };

  const aff = await ctx.db.get(args.affiliateId);
  if (!aff || aff.status !== 'active') return { outcome: 'inactive' };

  if (
    isSelfReferral({
      affiliateOwnerUserId: aff.ownerUserId ?? null,
      buyerUserId: args.buyerUserId ?? null,
      affiliateEmail: aff.ownerEmail ?? null,
      buyerEmail: args.buyerEmail ?? null,
    })
  ) {
    return { outcome: 'self_referral' };
  }

  const now = Date.now();
  const referralId = await ctx.db.insert('affiliateReferrals', {
    affiliateId: aff._id,
    code: aff.code,
    sourceSessionId: args.sourceSessionId,
    paymentId: undefined,
    eventId: args.eventId,
    buyerUserId: args.buyerUserId,
    grossMinor: args.grossMinor,
    netMinor: args.netMinor,
    currency: args.currency,
    rewardMinor: rewardMinor(args.netMinor, aff.rateBps),
    rewardType: aff.rewardType,
    status: 'pending',
    vestsAt: computeVestsAt(args.eventDate ?? Number.NaN, args.purchasedAt),
    createdAt: now,
    updatedAt: now,
  });
  return { outcome: 'recorded', referralId };
}

/** Wrapper interne (ops / rejeu manuel). Le flux nominal passe par markSucceeded. */
export const recordReferral = internalMutation({
  args: {
    affiliateId: v.id('affiliates'),
    sourceSessionId: v.string(),
    grossMinor: v.number(),
    netMinor: v.number(),
    currency: v.string(),
    purchasedAt: v.number(),
    eventDate: v.optional(v.number()),
    eventId: v.optional(v.id('events')),
    buyerUserId: v.optional(v.id('users')),
    buyerEmail: v.optional(v.string()),
  },
  handler: (ctx, args) => applyReferral(ctx, args),
});

/**
 * Annule une récompense (remboursement / litige) tant qu'elle n'est pas versée.
 * Helper réutilisable dans une transaction (appelé par la mutation de refund).
 * Idempotent et sans effet si déjà terminale (paid/credited/reversed).
 */
export async function reverseReferralBySession(
  ctx: MutationCtx,
  sourceSessionId: string,
): Promise<{ outcome: 'noop' } | { outcome: 'reversed'; referralId: Id<'affiliateReferrals'> }> {
  const ref = await ctx.db
    .query('affiliateReferrals')
    .withIndex('by_source_session', (q) => q.eq('sourceSessionId', sourceSessionId))
    .first();
  if (!ref || !canReverse(ref.status)) return { outcome: 'noop' };
  await ctx.db.patch(ref._id, {
    status: 'reversed',
    reversedAt: Date.now(),
    updatedAt: Date.now(),
  });
  return { outcome: 'reversed', referralId: ref._id };
}

export const reverseReferral = internalMutation({
  args: { sourceSessionId: v.string() },
  handler: (ctx, { sourceSessionId }) => reverseReferralBySession(ctx, sourceSessionId),
});

/* ============================ Vesting (cron) ============================ */

/**
 * Passe `pending` → `vested` toute récompense dont `vestsAt` est atteint (fin
 * du risque de remboursement « event non envoyé »). Lot borné par appel.
 */
export const vestDueReferrals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query('affiliateReferrals')
      .withIndex('by_status_vests', (q) => q.eq('status', 'pending').lte('vestsAt', now))
      .take(200);
    let vested = 0;
    for (const ref of due) {
      if (!isVestable({ status: ref.status, vestsAt: ref.vestsAt }, now)) continue;
      await ctx.db.patch(ref._id, { status: 'vested', updatedAt: now });
      vested += 1;
    }
    return { vested };
  },
});

/* ============================ Lecture admin ============================ */

export const listAffiliates = query({
  args: { adminId: v.id('users') },
  handler: async (ctx, { adminId }) => {
    await assertAdmin(ctx, adminId);
    const rows = await ctx.db.query('affiliates').order('desc').collect();
    return rows.map((a) => ({
      id: a._id,
      code: a.code,
      kind: a.kind,
      rewardType: a.rewardType,
      rateBps: a.rateBps,
      buyerDiscountBps: a.buyerDiscountBps,
      ownerEmail: a.ownerEmail ?? null,
      displayName: a.displayName ?? null,
      status: a.status,
      createdAt: a.createdAt,
    }));
  },
});

/**
 * Ledger pour l'admin : lignes + agrégats par statut (montants par devise).
 * Sert le dashboard « commissions dues » (payout groupé manuel au MVP).
 */
export const listReferrals = query({
  args: {
    adminId: v.id('users'),
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('vested'),
        v.literal('paid'),
        v.literal('credited'),
        v.literal('reversed'),
      ),
    ),
  },
  handler: async (ctx, { adminId, status }) => {
    await assertAdmin(ctx, adminId);
    const rows = status
      ? await ctx.db
          .query('affiliateReferrals')
          .withIndex('by_status', (q) => q.eq('status', status))
          .order('desc')
          .take(500)
      : await ctx.db.query('affiliateReferrals').order('desc').take(500);
    return rows.map((r) => ({
      id: r._id,
      affiliateId: r.affiliateId,
      code: r.code,
      status: r.status,
      rewardType: r.rewardType,
      rewardMinor: r.rewardMinor,
      netMinor: r.netMinor,
      currency: r.currency,
      vestsAt: r.vestsAt,
      createdAt: r.createdAt,
    }));
  },
});

/**
 * Crédit disponible d'un parrain (referral, type crédit) : somme des
 * récompenses `vested` non encore consommées. Base de l'application du crédit
 * (coupon Stripe généré à la volée) au prochain checkout — phase suivante.
 */
export const referrerCreditMinor = query({
  args: { userId: v.id('users'), currency: v.string() },
  handler: async (ctx, { userId, currency }) => {
    const affiliates = await ctx.db
      .query('affiliates')
      .withIndex('by_owner', (q) => q.eq('ownerUserId', userId))
      .collect();
    const creditIds = new Set(
      affiliates.filter((a) => a.rewardType === 'credit').map((a) => a._id),
    );
    if (creditIds.size === 0) return { availableMinor: 0 };
    let availableMinor = 0;
    for (const affId of creditIds) {
      const vested = await ctx.db
        .query('affiliateReferrals')
        .withIndex('by_affiliate', (q) => q.eq('affiliateId', affId))
        .collect();
      for (const r of vested) {
        if (r.status === 'vested' && r.currency === currency) availableMinor += r.rewardMinor;
      }
    }
    return { availableMinor };
  },
});

/**
 * Marque une récompense comme versée (crédit consommé / cash payé). Idempotent :
 * sans effet si déjà terminale. `settledStatusFor` choisit credited|paid.
 */
export const markReferralSettled = internalMutation({
  args: { referralId: v.id('affiliateReferrals') },
  handler: async (ctx, { referralId }) => {
    const ref = await ctx.db.get(referralId);
    if (!ref || ref.status !== 'vested') return { outcome: 'noop' as const };
    await ctx.db.patch(referralId, {
      status: settledStatusFor(ref.rewardType),
      paidAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { outcome: 'settled' as const };
  },
});

/* ======================= Parrainage — code + crédit ======================= */

/** Récompenses `vested` de type crédit d'un user, devise-matchées, triées FIFO. */
export async function collectVestedCredit(
  ctx: QueryCtx,
  userId: Id<'users'>,
  currency: string,
): Promise<Array<{ id: Id<'affiliateReferrals'>; rewardMinor: number; createdAt: number }>> {
  const affiliates = await ctx.db
    .query('affiliates')
    .withIndex('by_owner', (q) => q.eq('ownerUserId', userId))
    .collect();
  const rows: Array<{ id: Id<'affiliateReferrals'>; rewardMinor: number; createdAt: number }> = [];
  for (const aff of affiliates) {
    if (aff.rewardType !== 'credit') continue;
    const refs = await ctx.db
      .query('affiliateReferrals')
      .withIndex('by_affiliate', (q) => q.eq('affiliateId', aff._id))
      .collect();
    for (const r of refs) {
      if (r.status === 'vested' && r.currency === currency) {
        rows.push({ id: r._id, rewardMinor: r.rewardMinor, createdAt: r.createdAt });
      }
    }
  }
  rows.sort((a, b) => a.createdAt - b.createdAt); // FIFO
  return rows;
}

/**
 * Garantit qu'un user a son code de parrainage (kind referral / crédit, taux
 * défaut, 0 % de remise filleul). Idempotent — retourne l'existant, sinon crée
 * avec un code déterministe unique (collision → tentative suivante). Helper
 * appelé à la confirmation d'un achat ET par l'espace couple.
 */
export async function ensureReferralAffiliate(
  ctx: MutationCtx,
  userId: Id<'users'>,
): Promise<{ affiliateId: Id<'affiliates'>; code: string }> {
  const existing = await ctx.db
    .query('affiliates')
    .withIndex('by_owner', (q) => q.eq('ownerUserId', userId))
    .collect();
  const referral = existing.find((a) => a.kind === 'referral');
  if (referral) return { affiliateId: referral._id, code: referral.code };

  let code = generateReferralCode(userId, 0);
  for (let attempt = 1; attempt < 12; attempt++) {
    const clash = await ctx.db
      .query('affiliates')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first();
    if (!clash) break;
    code = generateReferralCode(userId, attempt);
  }
  const now = Date.now();
  const affiliateId = await ctx.db.insert('affiliates', {
    code,
    kind: 'referral',
    rewardType: 'credit',
    rateBps: DEFAULT_RATE_BPS,
    buyerDiscountBps: 0,
    ownerUserId: userId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  return { affiliateId, code };
}

/** Mutation publique : l'espace couple garantit/récupère son code de parrainage. */
export const ensureReferralCode = mutation({
  args: { userId: v.id('users') },
  handler: (ctx, { userId }) => ensureReferralAffiliate(ctx, userId),
});

/** Code de parrainage + crédit disponible d'un user (espace couple). */
export const referralForUser = query({
  args: { userId: v.id('users'), currency: v.string() },
  handler: async (ctx, { userId, currency }) => {
    const affiliates = await ctx.db
      .query('affiliates')
      .withIndex('by_owner', (q) => q.eq('ownerUserId', userId))
      .collect();
    const referral = affiliates.find((a) => a.kind === 'referral');
    const vested = await collectVestedCredit(ctx, userId, currency);
    const availableMinor = vested.reduce((s, r) => s + r.rewardMinor, 0);
    return { code: referral?.code ?? null, availableMinor };
  },
});

/**
 * Aperçu (lecture seule) du crédit applicable à une commande : sélectionne les
 * récompenses `vested` (crédit) ENTIÈRES dont le cumul reste ≤ `orderMinor`.
 */
export const previewCreditApplication = query({
  args: { userId: v.id('users'), currency: v.string(), orderMinor: v.number() },
  handler: async (ctx, { userId, currency, orderMinor }) => {
    const vested = await collectVestedCredit(ctx, userId, currency);
    const { referralIds, consumedMinor } = selectReferralsToConsume(
      vested.map((r) => ({ id: r.id, rewardMinor: r.rewardMinor })),
      orderMinor,
    );
    return { appliedMinor: consumedMinor, referralIds };
  },
});

/**
 * Réserve le crédit pour un checkout : re-valide côté serveur (vested + crédit +
 * owner + devise) et pose une ligne `pendingCreditApplications` liée à la
 * session. Idempotent par session. Consommée à la confirmation.
 */
export const registerCreditApplication = mutation({
  args: {
    userId: v.id('users'),
    sourceSessionId: v.string(),
    currency: v.string(),
    referralIds: v.array(v.id('affiliateReferrals')),
  },
  handler: async (ctx, { userId, sourceSessionId, currency, referralIds }) => {
    const dup = await ctx.db
      .query('pendingCreditApplications')
      .withIndex('by_source_session', (q) => q.eq('sourceSessionId', sourceSessionId))
      .first();
    if (dup) return { appliedMinor: dup.appliedMinor };

    const owned = new Set(
      (
        await ctx.db
          .query('affiliates')
          .withIndex('by_owner', (q) => q.eq('ownerUserId', userId))
          .collect()
      )
        .filter((a) => a.rewardType === 'credit')
        .map((a) => a._id as string),
    );
    const valid: Id<'affiliateReferrals'>[] = [];
    let appliedMinor = 0;
    for (const id of referralIds) {
      const r = await ctx.db.get(id);
      if (
        r &&
        r.status === 'vested' &&
        r.rewardType === 'credit' &&
        r.currency === currency &&
        owned.has(r.affiliateId as string)
      ) {
        valid.push(id);
        appliedMinor += r.rewardMinor;
      }
    }
    if (valid.length === 0) return { appliedMinor: 0 };
    await ctx.db.insert('pendingCreditApplications', {
      sourceSessionId,
      userId,
      currency,
      appliedMinor,
      referralIds: valid,
      createdAt: Date.now(),
    });
    return { appliedMinor };
  },
});

/**
 * Consomme la réservation de crédit d'une session à la confirmation (plan ou
 * upsell) : passe les lignes réservées en `credited` et supprime la réservation.
 * Idempotent (2e appel = pas de réservation → noop). Helper intra-Convex.
 */
export async function consumePendingCreditApplication(
  ctx: MutationCtx,
  sourceSessionId: string,
): Promise<{ consumedMinor: number; count: number }> {
  const pending = await ctx.db
    .query('pendingCreditApplications')
    .withIndex('by_source_session', (q) => q.eq('sourceSessionId', sourceSessionId))
    .first();
  if (!pending) return { consumedMinor: 0, count: 0 };
  const now = Date.now();
  let consumedMinor = 0;
  let count = 0;
  for (const id of pending.referralIds) {
    const r = await ctx.db.get(id);
    if (r && r.status === 'vested') {
      await ctx.db.patch(id, { status: 'credited', paidAt: now, updatedAt: now });
      consumedMinor += r.rewardMinor;
      count += 1;
    }
  }
  await ctx.db.delete(pending._id);
  return { consumedMinor, count };
}
