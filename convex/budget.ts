import { v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { assertOrgRead, assertOrgWrite } from './lib/orgAuth';
import { requireUserId } from './lib/verifiedSession';
import { proTierAtLeast } from './lib/entitlements';

/**
 * Budget mariage — back-office agence.
 *
 * Lecture/suivi pour tous les tiers ; édition des lignes réservée à Business+
 * (`budgetEditing`). Les lignes sont rattachées à un `events` (mariage) ET à son
 * organisation (dénormalisée pour l'autorisation).
 */

async function assertBudgetEditable(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
): Promise<void> {
  const org = await ctx.db.get(organizationId);
  if (!org) throw new Error('NOT_FOUND');
  if (!proTierAtLeast(org.subscriptionTier, 'business')) throw new Error('FEATURE_NOT_IN_PLAN');
}

async function loadLineForWrite(
  ctx: MutationCtx,
  lineId: Id<'budgetLines'>,
  requesterId: Id<'users'>,
) {
  const line = await ctx.db.get(lineId);
  if (!line) throw new Error('NOT_FOUND');
  await assertOrgWrite(ctx, line.organizationId, requesterId);
  await assertBudgetEditable(ctx, line.organizationId);
  return line;
}

export const listByEvent = query({
  args: { eventId: v.id('events'), sessionToken: v.string() },
  handler: async (ctx, { eventId, sessionToken }) => {
    const requesterId = await requireUserId(ctx, sessionToken);
    const event = await ctx.db.get(eventId);
    if (!event || !event.organizationId) return null;
    await assertOrgRead(ctx, event.organizationId, requesterId);
    const lines = await ctx.db
      .query('budgetLines')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    const withPayments = await Promise.all(
      lines.map(async (l) => {
        const payments = await ctx.db
          .query('budgetPayments')
          .withIndex('by_line', (q) => q.eq('budgetLineId', l._id))
          .collect();
        const paymentRows = await Promise.all(
          payments
            .sort((a, b) => b.paidAt - a.paidAt)
            .map(async (p) => ({
              _id: p._id,
              amountMinor: p.amountMinor,
              method: p.method,
              status: p.status,
              paidAt: p.paidAt,
              note: p.note,
              proofFileName: p.proofFileName,
              // Justificatif : blob uploadé (manuel) ou reçu hébergé (en ligne).
              proofUrl: p.proofStorageId
                ? await ctx.storage.getUrl(p.proofStorageId)
                : (p.receiptUrl ?? null),
              provider: p.provider,
              checkoutUrl: p.checkoutUrl,
              createdAt: p.createdAt,
            })),
        );
        return {
          _id: l._id,
          category: l.category,
          label: l.label,
          vendorName: l.vendorName,
          plannedMinor: l.plannedMinor,
          paidMinor: l.paidMinor,
          dueDate: l.dueDate,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
          payments: paymentRows,
        };
      }),
    );
    return {
      eventId: event._id,
      coupleNames: event.coupleNames,
      envelopeMinor: event.budgetEnvelopeMinor ?? 0,
      lines: withPayments.sort((a, b) => a.createdAt - b.createdAt),
    };
  },
});

/**
 * Recalcule et persiste le cache `budgetLines.paidMinor` = somme des paiements
 * `succeeded` de la ligne. Appelé après chaque ajout/suppression de paiement.
 */
async function recomputeLinePaid(ctx: MutationCtx, lineId: Id<'budgetLines'>): Promise<number> {
  const payments = await ctx.db
    .query('budgetPayments')
    .withIndex('by_line', (q) => q.eq('budgetLineId', lineId))
    .collect();
  const paidMinor = payments.reduce(
    (sum, p) => (p.status === 'succeeded' ? sum + p.amountMinor : sum),
    0,
  );
  await ctx.db.patch(lineId, { paidMinor, updatedAt: Date.now() });
  return paidMinor;
}

export const createLine = mutation({
  args: {
    eventId: v.id('events'),
    sessionToken: v.string(),
    category: v.string(),
    label: v.string(),
    vendorName: v.optional(v.string()),
    plannedMinor: v.number(),
    paidMinor: v.optional(v.number()),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const requesterId = await requireUserId(ctx, args.sessionToken);
    const event = await ctx.db.get(args.eventId);
    if (!event || !event.organizationId) throw new Error('NOT_AN_ORG_EVENT');
    await assertOrgWrite(ctx, event.organizationId, requesterId);
    await assertBudgetEditable(ctx, event.organizationId);

    const label = args.label.trim();
    if (label.length < 1 || label.length > 120) throw new Error('INVALID_LABEL');
    if (!Number.isFinite(args.plannedMinor) || args.plannedMinor < 0)
      throw new Error('INVALID_AMOUNT');

    const now = Date.now();
    const initialPaid = Math.max(0, Math.round(args.paidMinor ?? 0));
    const id = await ctx.db.insert('budgetLines', {
      eventId: args.eventId,
      organizationId: event.organizationId,
      category: args.category.trim() || 'Divers',
      label,
      ...(args.vendorName?.trim() ? { vendorName: args.vendorName.trim() } : {}),
      plannedMinor: Math.round(args.plannedMinor),
      paidMinor: initialPaid,
      ...(args.dueDate ? { dueDate: args.dueDate } : {}),
      createdAt: now,
      updatedAt: now,
    });
    // Un montant initial « déjà réglé » devient un premier paiement du registre,
    // pour rester cohérent avec le suivi par paiements (cache = somme).
    if (initialPaid > 0) {
      await ctx.db.insert('budgetPayments', {
        budgetLineId: id,
        eventId: args.eventId,
        organizationId: event.organizationId,
        amountMinor: initialPaid,
        method: 'other',
        status: 'succeeded',
        paidAt: now,
        note: 'Montant initial',
        createdBy: requesterId,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { id };
  },
});

export const updateLine = mutation({
  args: {
    lineId: v.id('budgetLines'),
    sessionToken: v.string(),
    category: v.optional(v.string()),
    label: v.optional(v.string()),
    vendorName: v.optional(v.string()),
    plannedMinor: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    clearDueDate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const requesterId = await requireUserId(ctx, args.sessionToken);
    await loadLineForWrite(ctx, args.lineId, requesterId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.category !== undefined) patch.category = args.category.trim() || 'Divers';
    if (args.label !== undefined) {
      const t = args.label.trim();
      if (t.length < 1) throw new Error('INVALID_LABEL');
      patch.label = t;
    }
    if (args.vendorName !== undefined) patch.vendorName = args.vendorName.trim() || undefined;
    if (args.plannedMinor !== undefined) {
      if (args.plannedMinor < 0 || !Number.isFinite(args.plannedMinor))
        throw new Error('INVALID_AMOUNT');
      patch.plannedMinor = Math.round(args.plannedMinor);
    }
    // `paidMinor` n'est plus éditable directement : il est dérivé du registre
    // des paiements (voir addPayment/removePayment).
    if (args.clearDueDate) patch.dueDate = undefined;
    else if (args.dueDate !== undefined) patch.dueDate = args.dueDate;
    await ctx.db.patch(args.lineId, patch);
    return { ok: true as const };
  },
});

export const removeLine = mutation({
  args: { lineId: v.id('budgetLines'), sessionToken: v.string() },
  handler: async (ctx, { lineId, sessionToken }) => {
    const requesterId = await requireUserId(ctx, sessionToken);
    await loadLineForWrite(ctx, lineId, requesterId);
    // Cascade : supprime les paiements rattachés et leurs justificatifs.
    const payments = await ctx.db
      .query('budgetPayments')
      .withIndex('by_line', (q) => q.eq('budgetLineId', lineId))
      .collect();
    for (const p of payments) {
      if (p.proofStorageId) {
        try {
          await ctx.storage.delete(p.proofStorageId);
        } catch {
          // blob déjà GC — on continue.
        }
      }
      await ctx.db.delete(p._id);
    }
    await ctx.db.delete(lineId);
    return { ok: true as const };
  },
});

/**
 * Enregistre un paiement reçu sur une ligne de budget (saisie manuelle, encaissé
 * immédiatement). Plusieurs paiements partiels s'additionnent ; le cache
 * `paidMinor` de la ligne est recalculé. Justificatif optionnel. Business+.
 */
export const addPayment = mutation({
  args: {
    lineId: v.id('budgetLines'),
    sessionToken: v.string(),
    amountMinor: v.number(),
    method: v.union(
      v.literal('transfer'),
      v.literal('card'),
      v.literal('cash'),
      v.literal('check'),
      v.literal('other'),
    ),
    paidAt: v.optional(v.number()),
    note: v.optional(v.string()),
    proofStorageId: v.optional(v.id('_storage')),
    proofFileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requesterId = await requireUserId(ctx, args.sessionToken);
    const line = await loadLineForWrite(ctx, args.lineId, requesterId);
    if (!Number.isFinite(args.amountMinor) || args.amountMinor <= 0)
      throw new Error('INVALID_AMOUNT');
    const now = Date.now();
    const id = await ctx.db.insert('budgetPayments', {
      budgetLineId: line._id,
      eventId: line.eventId,
      organizationId: line.organizationId,
      amountMinor: Math.round(args.amountMinor),
      method: args.method,
      status: 'succeeded',
      paidAt: args.paidAt ?? now,
      ...(args.note?.trim() ? { note: args.note.trim() } : {}),
      ...(args.proofStorageId ? { proofStorageId: args.proofStorageId } : {}),
      ...(args.proofFileName?.trim() ? { proofFileName: args.proofFileName.trim() } : {}),
      createdBy: requesterId,
      createdAt: now,
      updatedAt: now,
    });
    await recomputeLinePaid(ctx, line._id);
    return { id };
  },
});

/** Supprime un paiement (et son justificatif), puis recalcule le cache. Business+. */
export const removePayment = mutation({
  args: { paymentId: v.id('budgetPayments'), sessionToken: v.string() },
  handler: async (ctx, { paymentId, sessionToken }) => {
    const requesterId = await requireUserId(ctx, sessionToken);
    const payment = await ctx.db.get(paymentId);
    if (!payment) throw new Error('NOT_FOUND');
    await assertOrgWrite(ctx, payment.organizationId, requesterId);
    await assertBudgetEditable(ctx, payment.organizationId);
    if (payment.proofStorageId) {
      try {
        await ctx.storage.delete(payment.proofStorageId);
      } catch {
        // ignore
      }
    }
    await ctx.db.delete(paymentId);
    await recomputeLinePaid(ctx, payment.budgetLineId);
    return { ok: true as const };
  },
});

/**
 * URL d'upload Convex storage à usage unique pour un justificatif de paiement.
 * On vérifie les droits d'écriture (Business+) sur la ligne avant d'allouer un
 * slot, puis le client POST le fichier et passe le `storageId` à `addPayment`.
 */
export const generateProofUploadUrl = mutation({
  args: { lineId: v.id('budgetLines'), sessionToken: v.string() },
  handler: async (ctx, { lineId, sessionToken }) => {
    const requesterId = await requireUserId(ctx, sessionToken);
    await loadLineForWrite(ctx, lineId, requesterId);
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

/* ---------------------- Paiement en ligne (Wedillybird Pay) ---------------------- */

/**
 * Décide si une transition de statut de paiement doit s'appliquer (idempotence
 * webhook). Un paiement `pending` peut devenir `succeeded`/`failed` ; un
 * paiement déjà dans l'état cible (re-livraison webhook) est ignoré. Helper pur
 * pour les tests.
 */
export function decidePaymentTransition(
  currentStatus: 'pending' | 'succeeded' | 'failed',
  target: 'succeeded' | 'failed',
): { apply: boolean; alreadyApplied: boolean } {
  if (currentStatus === target) return { apply: false, alreadyApplied: true };
  // On ne ré-ouvre jamais un paiement déjà encaissé via un event d'échec tardif.
  if (currentStatus === 'succeeded') return { apply: false, alreadyApplied: true };
  return { apply: true, alreadyApplied: false };
}

function assertWebhookSecret(secret: string): void {
  const expected = process.env.CONVEX_WEBHOOK_SECRET;
  if (!expected) throw new Error('WEBHOOK_SECRET_NOT_CONFIGURED');
  if (secret !== expected) throw new Error('INVALID_WEBHOOK_SECRET');
}

/**
 * Crée un paiement « en attente » (en ligne) pour une ligne, avant la création
 * de la session Stripe. Renvoie l'id à placer dans les métadonnées de la
 * session pour la réconciliation webhook. Business+.
 */
export const createOnlinePaymentIntent = mutation({
  args: {
    lineId: v.id('budgetLines'),
    sessionToken: v.string(),
    amountMinor: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requesterId = await requireUserId(ctx, args.sessionToken);
    const line = await loadLineForWrite(ctx, args.lineId, requesterId);
    if (!Number.isFinite(args.amountMinor) || args.amountMinor <= 0)
      throw new Error('INVALID_AMOUNT');
    const now = Date.now();
    // Compte Stripe de l'agence (connecté). S'il est présent, le lien sera une
    // *charge directe* sur SON compte (en-tête `Stripe-Account`) : les fonds y vont
    // directement et Wedillybird n'est jamais dans le flux. On le mémorise sur la
    // ligne pour vérifier l'origine du webhook (anti-falsification). Sans compte
    // connecté → null (pas de lien en ligne).
    const org = await ctx.db.get(line.organizationId);
    const connectAccountId =
      org?.stripeConnectAccountId && org.stripeConnectChargesEnabled
        ? org.stripeConnectAccountId
        : null;
    const id = await ctx.db.insert('budgetPayments', {
      budgetLineId: line._id,
      eventId: line.eventId,
      organizationId: line.organizationId,
      amountMinor: Math.round(args.amountMinor),
      method: 'online',
      status: 'pending',
      paidAt: now,
      ...(args.note?.trim() ? { note: args.note.trim() } : {}),
      provider: 'stripe',
      ...(connectAccountId ? { stripeConnectAccountId: connectAccountId } : {}),
      createdBy: requesterId,
      createdAt: now,
      updatedAt: now,
    });
    return {
      id,
      eventId: line.eventId,
      label: line.label,
      vendorName: line.vendorName,
      connectAccountId,
    };
  },
});

/** Attache l'id de session Stripe + le lien de paiement à un paiement en attente. */
export const attachOnlineSession = mutation({
  args: {
    paymentId: v.id('budgetPayments'),
    sessionToken: v.string(),
    providerSessionId: v.string(),
    checkoutUrl: v.string(),
  },
  handler: async (ctx, { paymentId, sessionToken, providerSessionId, checkoutUrl }) => {
    const requesterId = await requireUserId(ctx, sessionToken);
    const payment = await ctx.db.get(paymentId);
    if (!payment) throw new Error('NOT_FOUND');
    await assertOrgWrite(ctx, payment.organizationId, requesterId);
    await ctx.db.patch(paymentId, { providerSessionId, checkoutUrl, updatedAt: Date.now() });
    return { ok: true as const };
  },
});

/**
 * Bridge webhook (verrouillé par `CONVEX_WEBHOOK_SECRET`, comme les souscriptions) :
 * marque un paiement en ligne encaissé, attache le reçu (preuve auto) et
 * recalcule le cache `paidMinor`. Idempotent sur re-livraison.
 */
export const markOnlinePaymentSucceeded = mutation({
  args: {
    webhookSecret: v.string(),
    paymentId: v.id('budgetPayments'),
    providerSessionId: v.string(),
    stripeConnectAccountId: v.optional(v.string()),
    receiptUrl: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { webhookSecret, paymentId, providerSessionId, stripeConnectAccountId, receiptUrl },
  ) => {
    assertWebhookSecret(webhookSecret);
    const payment = await ctx.db.get(paymentId);
    if (!payment) throw new Error('PAYMENT_NOT_FOUND');
    // Anti-falsification inter-tenant (webhook Connect = secret partagé entre comptes
    // connectés) : l'event doit provenir du compte connecté enregistré pour ce paiement.
    if (
      payment.stripeConnectAccountId &&
      stripeConnectAccountId !== payment.stripeConnectAccountId
    ) {
      throw new Error('ACCOUNT_MISMATCH');
    }
    const decision = decidePaymentTransition(payment.status, 'succeeded');
    if (!decision.apply) return { ok: true as const, alreadyApplied: true };
    await ctx.db.patch(paymentId, {
      status: 'succeeded',
      paidAt: Date.now(),
      providerSessionId,
      ...(receiptUrl ? { receiptUrl } : {}),
      checkoutUrl: undefined,
      updatedAt: Date.now(),
    });
    await recomputeLinePaid(ctx, payment.budgetLineId);
    return { ok: true as const, alreadyApplied: false };
  },
});

/** Bridge webhook : marque un paiement en ligne échoué/expiré (lien caduc). */
export const markOnlinePaymentFailed = mutation({
  args: {
    webhookSecret: v.string(),
    paymentId: v.id('budgetPayments'),
    providerSessionId: v.string(),
  },
  handler: async (ctx, { webhookSecret, paymentId, providerSessionId }) => {
    assertWebhookSecret(webhookSecret);
    const payment = await ctx.db.get(paymentId);
    if (!payment) throw new Error('PAYMENT_NOT_FOUND');
    const decision = decidePaymentTransition(payment.status, 'failed');
    if (!decision.apply) return { ok: true as const, alreadyApplied: true };
    await ctx.db.patch(paymentId, {
      status: 'failed',
      providerSessionId,
      checkoutUrl: undefined,
      updatedAt: Date.now(),
    });
    return { ok: true as const, alreadyApplied: false };
  },
});

/** Définit (ou efface si 0) l'enveloppe budgétaire d'un mariage. Business+. */
export const setEnvelope = mutation({
  args: { eventId: v.id('events'), sessionToken: v.string(), envelopeMinor: v.number() },
  handler: async (ctx, { eventId, sessionToken, envelopeMinor }) => {
    const requesterId = await requireUserId(ctx, sessionToken);
    const event = await ctx.db.get(eventId);
    if (!event || !event.organizationId) throw new Error('NOT_AN_ORG_EVENT');
    await assertOrgWrite(ctx, event.organizationId, requesterId);
    await assertBudgetEditable(ctx, event.organizationId);
    if (!Number.isFinite(envelopeMinor) || envelopeMinor < 0) throw new Error('INVALID_AMOUNT');
    await ctx.db.patch(eventId, {
      budgetEnvelopeMinor: envelopeMinor > 0 ? Math.round(envelopeMinor) : undefined,
      updatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});
