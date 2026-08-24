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
import { IDENTITY_ARGS, requireAdminCompat, requireUserIdCompat } from './lib/verifiedSession';

/* ============================ Création (admin) ============================ */

/**
 * Crée un affilié + son code. `partner` = cash (invitation-only, payout
 * différé), `referral` = crédit (boucle particulier). Le garde-fou marge
 * (`isRewardConfigSafe`) refuse tout cumul remise+commission dangereux.
 */
export const createAffiliate = mutation({
  args: {
    ...IDENTITY_ARGS,
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
    await requireAdminCompat(ctx, args);

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
    ...IDENTITY_ARGS,
    affiliateId: v.id('affiliates'),
    status: v.union(v.literal('active'), v.literal('disabled')),
  },
  handler: async (ctx, args) => {
    const { affiliateId, status } = args;
    await requireAdminCompat(ctx, args);
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
  args: { ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    await requireAdminCompat(ctx, args);
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
    ...IDENTITY_ARGS,
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
  handler: async (ctx, args) => {
    const { status } = args;
    await requireAdminCompat(ctx, args);
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
  args: { ...IDENTITY_ARGS, currency: v.string() },
  handler: async (ctx, args) => {
    const { currency } = args;
    const userId = await requireUserIdCompat(ctx, args);
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

/**
 * Récompenses `vested` de type crédit d'un user, devise-matchées, NON réservées,
 * triées FIFO. « Disponible » = dépensable maintenant (exclut le crédit déjà
 * réservé par un checkout en cours → cohérent avec l'anti double-dépense).
 * Lecture bornée via l'index `by_affiliate_status`.
 */
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
      .withIndex('by_affiliate_status', (q) => q.eq('affiliateId', aff._id).eq('status', 'vested'))
      .collect();
    for (const r of refs) {
      if (r.currency === currency && !r.reservedForSession) {
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
  args: { ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    const userId = await requireUserIdCompat(ctx, args);
    return ensureReferralAffiliate(ctx, userId);
  },
});

/** Code de parrainage + crédit disponible d'un user (espace couple). */
export const referralForUser = query({
  args: { ...IDENTITY_ARGS, currency: v.string() },
  handler: async (ctx, args) => {
    const { currency } = args;
    const userId = await requireUserIdCompat(ctx, args);
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
 * RÉSERVE atomiquement le crédit d'un user pour un checkout, AVANT la création du
 * coupon Stripe (le montant réservé = le montant du coupon → jamais de sur-remise
 * ni de crédit gratuit). Sélectionne les lignes `vested` NON réservées (FIFO,
 * entières, cumul ≤ orderMinor) et les marque `reservedForSession = reservationId`
 * dans UNE seule mutation → l'OCC de Convex empêche la double-réservation
 * concurrente (deux checkouts ne peuvent pas réserver la même ligne). Idempotent
 * par `reservationId`. Retourne le montant réellement réservé.
 */
export const reserveCreditForCheckout = mutation({
  args: {
    ...IDENTITY_ARGS,
    reservationId: v.string(),
    currency: v.string(),
    orderMinor: v.number(),
  },
  handler: async (ctx, args) => {
    const { reservationId, currency, orderMinor } = args;
    const userId = await requireUserIdCompat(ctx, args);
    const empty = { appliedMinor: 0, referralIds: [] as Id<'affiliateReferrals'>[] };
    const dup = await ctx.db
      .query('pendingCreditApplications')
      .withIndex('by_reservation', (q) => q.eq('reservationId', reservationId))
      .first();
    if (dup) return { appliedMinor: dup.appliedMinor, referralIds: dup.referralIds };

    // collectVestedCredit exclut déjà les lignes réservées ailleurs.
    const vested = await collectVestedCredit(ctx, userId, currency);
    const { referralIds } = selectReferralsToConsume(
      vested.map((r) => ({ id: r.id, rewardMinor: r.rewardMinor })),
      orderMinor,
    );
    if (referralIds.length === 0) return empty;

    const now = Date.now();
    const reserved: Id<'affiliateReferrals'>[] = [];
    let appliedMinor = 0;
    for (const id of referralIds) {
      const r = await ctx.db.get(id as Id<'affiliateReferrals'>);
      // Re-vérif dans la mutation (fenêtre OCC) : encore vested, crédit, bonne
      // devise, NON réservée.
      if (
        r &&
        r.status === 'vested' &&
        r.rewardType === 'credit' &&
        r.currency === currency &&
        !r.reservedForSession
      ) {
        await ctx.db.patch(r._id, { reservedForSession: reservationId, updatedAt: now });
        reserved.push(r._id);
        appliedMinor += r.rewardMinor;
      }
    }
    if (reserved.length === 0) return empty;
    await ctx.db.insert('pendingCreditApplications', {
      reservationId,
      userId,
      currency,
      appliedMinor,
      referralIds: reserved,
      createdAt: now,
    });
    return { appliedMinor, referralIds: reserved };
  },
});

/**
 * Consomme une réservation à la confirmation du paiement (plan/upsell) : lignes
 * réservées → `credited`, trace `consumedBySession` (= session d'achat, pour
 * restitution au refund), efface la réservation. Idempotent (réservation absente
 * → noop ; ligne déjà non-`vested` → ignorée). Helper intra-Convex.
 */
export async function consumeCreditReservation(
  ctx: MutationCtx,
  reservationId: string | undefined | null,
  purchaseSessionId: string,
): Promise<{ consumedMinor: number; count: number }> {
  if (!reservationId) return { consumedMinor: 0, count: 0 };
  const pending = await ctx.db
    .query('pendingCreditApplications')
    .withIndex('by_reservation', (q) => q.eq('reservationId', reservationId))
    .first();
  if (!pending) return { consumedMinor: 0, count: 0 };
  const now = Date.now();
  let consumedMinor = 0;
  let count = 0;
  for (const id of pending.referralIds) {
    const r = await ctx.db.get(id);
    if (r && r.status === 'vested') {
      await ctx.db.patch(id, {
        status: 'credited',
        reservedForSession: undefined,
        consumedBySession: purchaseSessionId,
        paidAt: now,
        updatedAt: now,
      });
      consumedMinor += r.rewardMinor;
      count += 1;
    }
  }
  await ctx.db.delete(pending._id);
  return { consumedMinor, count };
}

/**
 * Relâche une réservation NON consommée (checkout échoué/abandonné) : ré-ouvre
 * les lignes (`reservedForSession` effacé, restent `vested`) et supprime la
 * réservation. Idempotent — le crédit redevient dépensable.
 */
export async function releaseCreditReservation(
  ctx: MutationCtx,
  reservationId: string | undefined | null,
): Promise<{ released: number }> {
  if (!reservationId) return { released: 0 };
  const pending = await ctx.db
    .query('pendingCreditApplications')
    .withIndex('by_reservation', (q) => q.eq('reservationId', reservationId))
    .first();
  if (!pending) return { released: 0 };
  const now = Date.now();
  let released = 0;
  for (const id of pending.referralIds) {
    const r = await ctx.db.get(id);
    if (r && r.reservedForSession === reservationId) {
      await ctx.db.patch(id, { reservedForSession: undefined, updatedAt: now });
      released += 1;
    }
  }
  await ctx.db.delete(pending._id);
  return { released };
}

/** Mutation publique : la route relâche la réservation si le checkout échoue. */
export const releaseCreditReservationMutation = mutation({
  args: { reservationId: v.string() },
  handler: (ctx, { reservationId }) => releaseCreditReservation(ctx, reservationId),
});

/**
 * RESTITUE le crédit dépensé sur un achat REMBOURSÉ : les lignes `credited` dont
 * `consumedBySession` == la session remboursée repassent `vested` (crédit
 * ré-ouvert pour le parrain). Appelé par `markPaymentRefunded`. Idempotent.
 */
export async function restoreCreditForRefundedSession(
  ctx: MutationCtx,
  purchaseSessionId: string,
): Promise<{ restored: number; restoredMinor: number }> {
  const rows = await ctx.db
    .query('affiliateReferrals')
    .withIndex('by_consumed_session', (q) => q.eq('consumedBySession', purchaseSessionId))
    .collect();
  const now = Date.now();
  let restored = 0;
  let restoredMinor = 0;
  for (const r of rows) {
    if (r.status === 'credited') {
      await ctx.db.patch(r._id, {
        status: 'vested',
        consumedBySession: undefined,
        paidAt: undefined,
        updatedAt: now,
      });
      restored += 1;
      restoredMinor += r.rewardMinor;
    }
  }
  return { restored, restoredMinor };
}

/**
 * GC (cron) : relâche les réservations orphelines (checkout jamais confirmé),
 * plus vieilles que le `redeem_by` du coupon (24 h) → le crédit redevient
 * disponible. Lot borné.
 */
export const releaseStaleCreditReservations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const rows = await ctx.db.query('pendingCreditApplications').take(200);
    let released = 0;
    for (const p of rows) {
      if (p.createdAt < cutoff) {
        await releaseCreditReservation(ctx, p.reservationId);
        released += 1;
      }
    }
    return { released };
  },
});
