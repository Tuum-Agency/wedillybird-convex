'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { parseEurToMinor } from '@/lib/pro/format';
import { createBudgetCheckout } from '@/lib/payments/drivers/stripe';
import { appOrigin } from '@/lib/reminders/window';

export type BudgetActionResult = { ok: true; id?: string } | { ok: false; error: string };
export type BudgetLinkResult =
  | { ok: true; url: string; paymentId: string }
  | { ok: false; error: string };

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function dateMs(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : undefined;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'UNKNOWN';
}

export async function createBudgetLineAction(
  eventId: string,
  formData: FormData,
): Promise<BudgetActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const label = str(formData, 'label');
  if (!label) return { ok: false, error: 'INVALID_LABEL' };
  const convex = getConvexServerClient();
  try {
    const r = await convex.mutation(convexApi.createBudgetLine, {
      eventId,
      requesterId: session.userId,
      category: str(formData, 'category') ?? 'Divers',
      label,
      vendorName: str(formData, 'vendorName'),
      plannedMinor: parseEurToMinor(str(formData, 'plannedEur')) ?? 0,
      paidMinor: parseEurToMinor(str(formData, 'paidEur')) ?? 0,
      dueDate: dateMs(str(formData, 'dueDate')),
    });
    revalidatePath('/pro/budget');
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function updateBudgetLineAction(
  lineId: string,
  formData: FormData,
): Promise<BudgetActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const label = str(formData, 'label');
  if (!label) return { ok: false, error: 'INVALID_LABEL' };
  const convex = getConvexServerClient();
  const dd = dateMs(str(formData, 'dueDate'));
  try {
    await convex.mutation(convexApi.updateBudgetLine, {
      lineId,
      requesterId: session.userId,
      category: str(formData, 'category') ?? 'Divers',
      label,
      vendorName: str(formData, 'vendorName') ?? '',
      plannedMinor: parseEurToMinor(str(formData, 'plannedEur')) ?? 0,
      ...(dd ? { dueDate: dd } : { clearDueDate: true }),
    });
    revalidatePath('/pro/budget');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function setBudgetEnvelopeAction(
  eventId: string,
  envelopeEur: string,
): Promise<BudgetActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  const envelopeMinor = parseEurToMinor(envelopeEur) ?? 0;
  try {
    await convex.mutation(convexApi.setBudgetEnvelope, {
      eventId,
      requesterId: session.userId,
      envelopeMinor,
    });
    revalidatePath('/pro/budget');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function removeBudgetLineAction(lineId: string): Promise<BudgetActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.removeBudgetLine, { lineId, requesterId: session.userId });
    revalidatePath('/pro/budget');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

const PROOF_MAX_BYTES = 10 * 1024 * 1024; // 10 Mo
const PROOF_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const PAYMENT_METHODS = new Set(['transfer', 'card', 'cash', 'check', 'other']);
type PaymentMethodArg = 'transfer' | 'card' | 'cash' | 'check' | 'other';

/**
 * Enregistre un paiement reçu sur une ligne de budget. Justificatif optionnel :
 * on génère une upload URL Convex, on POST le fichier côté serveur (même méca
 * que le logo d'agence), puis on commit le `storageId` avec le paiement.
 */
export async function addBudgetPaymentAction(
  lineId: string,
  formData: FormData,
): Promise<BudgetActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const amountMinor = parseEurToMinor(str(formData, 'amountEur'));
  if (amountMinor == null || amountMinor <= 0) return { ok: false, error: 'INVALID_AMOUNT' };
  const methodRaw = str(formData, 'method') ?? 'transfer';
  const method: PaymentMethodArg = PAYMENT_METHODS.has(methodRaw)
    ? (methodRaw as PaymentMethodArg)
    : 'transfer';
  const paidAt = dateMs(str(formData, 'paidAt'));
  const note = str(formData, 'note');

  const convex = getConvexServerClient();

  let proofStorageId: string | undefined;
  let proofFileName: string | undefined;
  const file = formData.get('proof');
  if (file instanceof File && file.size > 0) {
    if (!PROOF_TYPES.has(file.type)) return { ok: false, error: 'INVALID_PROOF_TYPE' };
    if (file.size > PROOF_MAX_BYTES) return { ok: false, error: 'INVALID_PROOF_SIZE' };
    try {
      const { uploadUrl } = await convex.mutation(convexApi.generateBudgetProofUploadUrl, {
        lineId,
        requesterId: session.userId,
      });
      const buffer = Buffer.from(await file.arrayBuffer());
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: buffer,
      });
      if (!res.ok) return { ok: false, error: 'UPLOAD_FAILED' };
      const json = (await res.json()) as { storageId: string };
      proofStorageId = json.storageId;
      proofFileName = file.name;
    } catch {
      return { ok: false, error: 'UPLOAD_FAILED' };
    }
  }

  try {
    const r = await convex.mutation(convexApi.addBudgetPayment, {
      lineId,
      requesterId: session.userId,
      amountMinor,
      method,
      ...(paidAt ? { paidAt } : {}),
      ...(note ? { note } : {}),
      ...(proofStorageId ? { proofStorageId } : {}),
      ...(proofFileName ? { proofFileName } : {}),
    });
    revalidatePath('/pro/budget');
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function removeBudgetPaymentAction(paymentId: string): Promise<BudgetActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.removeBudgetPayment, {
      paymentId,
      requesterId: session.userId,
    });
    revalidatePath('/pro/budget');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * Crée un lien de paiement en ligne (Wedillybird Pay / Stripe) pour une ligne :
 * (1) crée un paiement « en attente », (2) crée la session Checkout du montant,
 * (3) attache la session + l'URL. Le webhook encaisse et attache le reçu auto.
 * Dégrade proprement si Stripe n'est pas configuré.
 */
export async function createBudgetPaymentLinkAction(
  lineId: string,
  amountEur: string,
): Promise<BudgetLinkResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const amountMinor = parseEurToMinor(amountEur);
  if (amountMinor == null || amountMinor <= 0) return { ok: false, error: 'INVALID_AMOUNT' };

  const convex = getConvexServerClient();

  let intent: { id: string; label: string; vendorName?: string; connectAccountId: string | null };
  try {
    intent = await convex.mutation(convexApi.createBudgetOnlinePaymentIntent, {
      lineId,
      requesterId: session.userId,
      amountMinor,
    });
  } catch (e) {
    return { ok: false, error: msg(e) };
  }

  const origin = appOrigin();
  const description = `Paiement — ${intent.label}${intent.vendorName ? ` · ${intent.vendorName}` : ''}`;
  // Encaissement en ligne = direct charge sur le compte Stripe de l'agence
  // (connecté via OAuth). Sans compte connecté, pas de lien possible : on ne
  // place jamais de fonds sur la plateforme. On nettoie le paiement en attente.
  const stripeAccountId = intent.connectAccountId ?? undefined;
  if (!stripeAccountId) {
    try {
      await convex.mutation(convexApi.removeBudgetPayment, {
        paymentId: intent.id,
        requesterId: session.userId,
      });
    } catch {
      // best-effort
    }
    return { ok: false, error: 'STRIPE_NOT_CONNECTED' };
  }
  try {
    const { providerSessionId, redirectUrl } = await createBudgetCheckout({
      amountMinor,
      description,
      budgetPaymentId: intent.id,
      successUrl: `${origin}/pay/merci`,
      cancelUrl: `${origin}/pay/annule`,
      stripeAccountId,
    });
    await convex.mutation(convexApi.attachBudgetOnlineSession, {
      paymentId: intent.id,
      requesterId: session.userId,
      providerSessionId,
      checkoutUrl: redirectUrl,
    });
    revalidatePath('/pro/budget');
    return { ok: true, url: redirectUrl, paymentId: intent.id };
  } catch (e) {
    // Stripe indisponible / non configuré → on nettoie le paiement en attente
    // orphelin pour ne pas polluer le registre.
    try {
      await convex.mutation(convexApi.removeBudgetPayment, {
        paymentId: intent.id,
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
