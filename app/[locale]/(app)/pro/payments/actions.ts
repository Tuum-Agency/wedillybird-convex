'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { parseEurToMinor } from '@/lib/pro/format';
import {
  createPaymentLinkCheckout,
  listConnectedPayments,
  listConnectedPayouts,
  retrieveConnectedBalance,
} from '@/lib/payments/drivers/stripe';
import type { ConnectedFinances } from '@/lib/pro/payments';
import { appOrigin } from '@/lib/reminders/window';

export type PaymentLinkResult =
  | { ok: true; url: string; id: string }
  | { ok: false; error: string };

type LinkIntent =
  | { kind: 'invoice'; invoiceDocId: string; invoiceMilestoneIndex: number }
  | { kind: 'free'; amountMinor: number; description: string; clientName?: string };

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'UNKNOWN';
}

/**
 * Flux commun de création de lien de paiement : (1) crée l'intent Convex (valide
 * droits Business+, montant, connexion Stripe), (2) crée la session Checkout sur
 * le compte connecté de l'agence (charge directe), (3) attache la session + l'URL.
 * Nettoie le lien en attente si la création Checkout échoue.
 */
async function runPaymentLink(intent: LinkIntent): Promise<PaymentLinkResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org) return { ok: false, error: 'NO_ORG' };

  let created;
  try {
    created = await convex.mutation(convexApi.createPaymentLinkIntent, {
      organizationId: org._id,
      requesterId: session.userId,
      ...intent,
    });
  } catch (e) {
    return { ok: false, error: msg(e) };
  }

  const origin = appOrigin();
  try {
    const { providerSessionId, redirectUrl } = await createPaymentLinkCheckout({
      amountMinor: created.amountMinor,
      description: created.description,
      paymentLinkId: created.id,
      successUrl: `${origin}/pay/merci`,
      cancelUrl: `${origin}/pay/annule`,
      stripeAccountId: created.connectAccountId,
    });
    await convex.mutation(convexApi.attachPaymentLinkSession, {
      paymentLinkId: created.id,
      requesterId: session.userId,
      providerSessionId,
      checkoutUrl: redirectUrl,
    });
    revalidatePath('/pro/payments');
    return { ok: true, url: redirectUrl, id: created.id };
  } catch (e) {
    // Stripe indisponible / non configuré → on nettoie le lien en attente orphelin.
    try {
      await convex.mutation(convexApi.removePaymentLink, {
        paymentLinkId: created.id,
        requesterId: session.userId,
      });
    } catch {
      // best-effort
    }
    const m = msg(e);
    return {
      ok: false,
      error: m === 'STRIPE_DRIVER_NOT_CONFIGURED' ? 'PAYMENTS_NOT_CONFIGURED' : m,
    };
  }
}

/** Crée un lien de paiement pour une échéance de facture (Devis & Factures). */
export async function createInvoicePaymentLinkAction(
  docId: string,
  milestoneIndex: number,
): Promise<PaymentLinkResult> {
  if (!Number.isInteger(milestoneIndex) || milestoneIndex < 0) {
    return { ok: false, error: 'INVALID_SCHEDULE' };
  }
  return runPaymentLink({
    kind: 'invoice',
    invoiceDocId: docId,
    invoiceMilestoneIndex: milestoneIndex,
  });
}

/** Crée un lien de paiement libre (montant + libellé ad hoc pour un service). */
export async function createFreePaymentLinkAction(input: {
  amountEur: string;
  description: string;
  clientName?: string;
}): Promise<PaymentLinkResult> {
  const amountMinor = parseEurToMinor(input.amountEur);
  if (amountMinor == null || amountMinor <= 0) return { ok: false, error: 'INVALID_AMOUNT' };
  const description = input.description?.trim();
  if (!description) return { ok: false, error: 'INVALID_DESCRIPTION' };
  const clientName = input.clientName?.trim();
  return runPaymentLink({
    kind: 'free',
    amountMinor,
    description,
    ...(clientName ? { clientName } : {}),
  });
}

export type FinancesResult = { ok: true; data: ConnectedFinances } | { ok: false; error: string };

/**
 * Lit le solde, les virements et les encaissements sur le compte Stripe connecté
 * de l'agence — pour tout voir depuis la plateforme, sans ouvrir Stripe. Lecture
 * seule (en-tête Stripe-Account). `NOT_CONNECTED` si aucun compte connecté.
 */
export async function getConnectedFinancesAction(): Promise<FinancesResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org) return { ok: false, error: 'NO_ORG' };

  let accountId: string | null = null;
  try {
    const status = await convex.query(convexApi.orgConnectStatus, {
      organizationId: org._id,
      requesterId: session.userId,
    });
    accountId = status.accountId;
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
  if (!accountId) return { ok: false, error: 'NOT_CONNECTED' };

  try {
    const [balance, payouts, payments] = await Promise.all([
      retrieveConnectedBalance(accountId),
      listConnectedPayouts(accountId),
      listConnectedPayments(accountId),
    ]);
    return { ok: true, data: { balance, payouts, payments } };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
