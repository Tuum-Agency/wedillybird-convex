import { v } from 'convex/values';
import { mutation, query, type MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { assertOrgRead, assertOrgWrite } from './lib/orgAuth';
import { assertEventAccess } from './lib/eventAuth';
import { IDENTITY_ARGS, requireUserIdCompat } from './lib/verifiedSession';
import { proTierAtLeast } from './lib/entitlements';
import { decidePaymentTransition } from './budget';
import { totalMinor } from './quotes';

/**
 * Liens de paiement en ligne (générique) — l'agence crée un lien Stripe sur SON
 * compte connecté (charge directe). Deux origines :
 *  - `invoice` : adossé à une échéance d'une facture (`quoteDocs.schedule[i]`) —
 *    l'échéance passe `paid` automatiquement à l'encaissement (webhook) ;
 *  - `free`    : montant + libellé libres (lien ad hoc pour un service).
 *
 * Réservé Business+ (comme le budget). Distinct de `budgetPayments` (budget interne).
 */

function assertWebhookSecret(secret: string): void {
  const expected = process.env.CONVEX_WEBHOOK_SECRET;
  if (!expected) throw new Error('WEBHOOK_SECRET_NOT_CONFIGURED');
  if (secret !== expected) throw new Error('INVALID_WEBHOOK_SECRET');
}

/** Compte Stripe connecté de l'agence, ou null si pas (encore) connecté. */
function connectedAccountId(org: Doc<'organizations'> | null): string | null {
  return org?.stripeConnectAccountId && org.stripeConnectChargesEnabled
    ? org.stripeConnectAccountId
    : null;
}

/**
 * Crée un lien de paiement « en attente » et renvoie le compte connecté sur lequel
 * créer la session Checkout. Lève `STRIPE_NOT_CONNECTED` AVANT toute insertion si
 * l'agence n'a pas connecté son Stripe (pas de ligne orpheline). Business+.
 */
export const createIntent = mutation({
  args: {
    organizationId: v.id('organizations'),
    ...IDENTITY_ARGS,
    kind: v.union(v.literal('invoice'), v.literal('free')),
    invoiceDocId: v.optional(v.id('quoteDocs')),
    invoiceMilestoneIndex: v.optional(v.number()),
    amountMinor: v.optional(v.number()),
    description: v.optional(v.string()),
    clientName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requesterId = await requireUserIdCompat(ctx, args);
    await assertOrgWrite(ctx, args.organizationId, requesterId);
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error('NOT_FOUND');
    if (!proTierAtLeast(org.subscriptionTier, 'business')) throw new Error('FEATURE_NOT_IN_PLAN');

    let amountMinor: number;
    let description: string;
    let clientName: string | undefined = args.clientName?.trim() || undefined;
    let invoiceDocId = args.invoiceDocId;
    let invoiceMilestoneIndex = args.invoiceMilestoneIndex;
    let linkEventId: Id<'events'> | undefined;

    if (args.kind === 'invoice') {
      if (!args.invoiceDocId || args.invoiceMilestoneIndex == null) {
        throw new Error('INVALID_INVOICE_REF');
      }
      const doc = await ctx.db.get(args.invoiceDocId);
      if (!doc || doc.organizationId !== args.organizationId) throw new Error('NOT_FOUND');
      const entry = doc.schedule?.[args.invoiceMilestoneIndex];
      if (!entry) throw new Error('INVALID_SCHEDULE');
      if (entry.paid) throw new Error('ALREADY_PAID');
      amountMinor = entry.amountMinor;
      description = `${doc.number} · ${entry.label}`;
      clientName = clientName ?? doc.clientName;
      invoiceDocId = args.invoiceDocId;
      invoiceMilestoneIndex = args.invoiceMilestoneIndex;
      linkEventId = doc.eventId ?? undefined;
    } else {
      // free
      const desc = args.description?.trim();
      if (!desc) throw new Error('INVALID_DESCRIPTION');
      if (!args.amountMinor || !Number.isFinite(args.amountMinor) || args.amountMinor <= 0) {
        throw new Error('INVALID_AMOUNT');
      }
      amountMinor = Math.round(args.amountMinor);
      description = desc;
      invoiceDocId = undefined;
      invoiceMilestoneIndex = undefined;
    }

    const connectAccountId = connectedAccountId(org);
    if (!connectAccountId) throw new Error('STRIPE_NOT_CONNECTED');

    const now = Date.now();
    const id = await ctx.db.insert('paymentLinks', {
      organizationId: args.organizationId,
      kind: args.kind,
      ...(invoiceDocId ? { invoiceDocId } : {}),
      ...(invoiceMilestoneIndex != null ? { invoiceMilestoneIndex } : {}),
      ...(linkEventId ? { eventId: linkEventId } : {}),
      amountMinor,
      currency: 'EUR',
      description,
      ...(clientName ? { clientName } : {}),
      status: 'pending',
      provider: 'stripe',
      stripeConnectAccountId: connectAccountId,
      createdBy: requesterId,
      createdAt: now,
      updatedAt: now,
    });
    return { id, connectAccountId, description, amountMinor };
  },
});

/** Attache l'id de session Stripe + le lien au paiement en attente. */
export const attachSession = mutation({
  args: {
    paymentLinkId: v.id('paymentLinks'),
    ...IDENTITY_ARGS,
    providerSessionId: v.string(),
    checkoutUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const { paymentLinkId, providerSessionId, checkoutUrl } = args;
    const requesterId = await requireUserIdCompat(ctx, args);
    const row = await ctx.db.get(paymentLinkId);
    if (!row) throw new Error('NOT_FOUND');
    await assertOrgWrite(ctx, row.organizationId, requesterId);
    await ctx.db.patch(paymentLinkId, { providerSessionId, checkoutUrl, updatedAt: Date.now() });
    return { ok: true as const };
  },
});

/** Supprime un lien en attente (nettoyage si la création Checkout échoue). */
export const remove = mutation({
  args: { paymentLinkId: v.id('paymentLinks'), ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    const { paymentLinkId } = args;
    const requesterId = await requireUserIdCompat(ctx, args);
    const row = await ctx.db.get(paymentLinkId);
    if (!row) return { ok: true as const };
    await assertOrgWrite(ctx, row.organizationId, requesterId);
    await ctx.db.delete(paymentLinkId);
    return { ok: true as const };
  },
});

/**
 * Bridge webhook (verrouillé par `CONVEX_WEBHOOK_SECRET`) : marque le lien encaissé,
 * attache le reçu, et — si le lien est adossé à une facture — bascule l'échéance
 * correspondante `paid` + recalcule le statut de la facture. Idempotent.
 */
export const markSucceeded = mutation({
  args: {
    webhookSecret: v.string(),
    paymentLinkId: v.id('paymentLinks'),
    providerSessionId: v.string(),
    stripeConnectAccountId: v.optional(v.string()),
    receiptUrl: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { webhookSecret, paymentLinkId, providerSessionId, stripeConnectAccountId, receiptUrl },
  ) => {
    assertWebhookSecret(webhookSecret);
    const row = await ctx.db.get(paymentLinkId);
    if (!row) throw new Error('PAYMENT_NOT_FOUND');
    // Anti-falsification : le webhook Connect est signé avec un secret PARTAGÉ entre
    // tous les comptes connectés. On exige que le compte d'origine de l'event soit le
    // compte connecté enregistré pour ce lien — sinon une agence pourrait marquer la
    // facture d'une AUTRE comme payée en émettant un event depuis son propre compte.
    if (row.stripeConnectAccountId && stripeConnectAccountId !== row.stripeConnectAccountId) {
      throw new Error('ACCOUNT_MISMATCH');
    }
    const decision = decidePaymentTransition(row.status, 'succeeded');
    if (!decision.apply) return { ok: true as const, alreadyApplied: true };
    const now = Date.now();
    await ctx.db.patch(paymentLinkId, {
      status: 'succeeded',
      paidAt: now,
      providerSessionId,
      ...(receiptUrl ? { receiptUrl } : {}),
      checkoutUrl: undefined,
      updatedAt: now,
    });
    await settleLinkedInvoice(ctx, row);
    return { ok: true as const, alreadyApplied: false };
  },
});

/** Bridge webhook : marque le lien échoué/expiré (caduc). */
export const markFailed = mutation({
  args: {
    webhookSecret: v.string(),
    paymentLinkId: v.id('paymentLinks'),
    providerSessionId: v.string(),
  },
  handler: async (ctx, { webhookSecret, paymentLinkId, providerSessionId }) => {
    assertWebhookSecret(webhookSecret);
    const row = await ctx.db.get(paymentLinkId);
    if (!row) throw new Error('PAYMENT_NOT_FOUND');
    const decision = decidePaymentTransition(row.status, 'failed');
    if (!decision.apply) return { ok: true as const, alreadyApplied: true };
    await ctx.db.patch(paymentLinkId, {
      status: 'failed',
      providerSessionId,
      checkoutUrl: undefined,
      updatedAt: Date.now(),
    });
    return { ok: true as const, alreadyApplied: false };
  },
});

/**
 * Bascule l'échéance liée `paid` et recalcule le statut de la facture (même logique
 * que la saisie manuelle `quotes:recordSchedulePayment`, pour rester cohérent).
 */
async function settleLinkedInvoice(ctx: MutationCtx, row: Doc<'paymentLinks'>): Promise<void> {
  if (row.kind !== 'invoice' || !row.invoiceDocId || row.invoiceMilestoneIndex == null) return;
  const doc = await ctx.db.get(row.invoiceDocId);
  const idx = row.invoiceMilestoneIndex;
  if (!doc || !doc.schedule || !doc.schedule[idx]) return;
  const schedule = doc.schedule.map((s, i) => (i === idx ? { ...s, paid: true } : s));
  const total = totalMinor(doc);
  const paid = schedule.filter((s) => s.paid).reduce((a, s) => a + s.amountMinor, 0);
  const status: Doc<'quoteDocs'>['status'] =
    paid >= total ? 'paid' : paid > 0 ? 'partial' : doc.status;
  await ctx.db.patch(row.invoiceDocId, { schedule, status, updatedAt: Date.now() });
}

/** Liste les liens de paiement récents d'une agence (cockpit). Business+ implicite. */
export const listByOrg = query({
  args: { organizationId: v.id('organizations'), ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    const { organizationId } = args;
    const requesterId = await requireUserIdCompat(ctx, args);
    await assertOrgRead(ctx, organizationId, requesterId);
    const rows = await ctx.db
      .query('paymentLinks')
      .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
      .collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50)
      .map((r) => ({
        _id: r._id,
        kind: r.kind,
        amountMinor: r.amountMinor,
        description: r.description,
        clientName: r.clientName,
        status: r.status,
        checkoutUrl: r.checkoutUrl,
        receiptUrl: r.receiptUrl,
        createdAt: r.createdAt,
        paidAt: r.paidAt,
      }));
  },
});

/**
 * Liens de paiement d'un mariage — pour l'**espace couple**. Accessible au
 * propriétaire OU à un collaborateur (le couple rattaché). Renvoie de quoi payer
 * (montant, libellé, statut, lien Checkout) ; aucune info interne agence.
 */
export const listForEvent = query({
  args: { eventId: v.id('events'), ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    const { eventId } = args;
    const requesterId = await requireUserIdCompat(ctx, args);
    await assertEventAccess(ctx, eventId, requesterId);
    const rows = await ctx.db
      .query('paymentLinks')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({
        _id: r._id,
        amountMinor: r.amountMinor,
        currency: r.currency,
        description: r.description,
        status: r.status,
        checkoutUrl: r.checkoutUrl,
        receiptUrl: r.receiptUrl,
        createdAt: r.createdAt,
        paidAt: r.paidAt,
      }));
  },
});
