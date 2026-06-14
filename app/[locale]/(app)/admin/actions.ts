'use server';

import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { getSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import {
  refundPlatformPayment,
  cancelPlatformSubscription,
  reactivatePlatformSubscription,
  listSubscriptionInvoices,
  type SubscriptionInvoice,
} from '@/lib/payments/drivers/stripe';

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Vérifie une session ET le rôle `admin` (la session seule ne suffit pas pour
 * les actions financières qui touchent Stripe LIVE avant tout appel Convex).
 * Renvoie l'id de l'admin pour le passer aux fonctions Convex (qui revérifient).
 */
async function requireAdmin(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  const convex = getConvexServerClient();
  const user = await convex.query(convexApi.currentUser, { userId: session.userId });
  if (!user || user.role !== 'admin') throw new Error('FORBIDDEN');
  return session.userId;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'UNKNOWN';
}

export async function adminSuspendUserAction(targetUserId: string): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.adminSuspendUser, { adminId, targetUserId });
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'UNKNOWN' };
  }
}

export async function adminChangeUserRoleAction(
  targetUserId: string,
  newRole: 'couple' | 'pro' | 'guest' | 'admin',
): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.adminChangeUserRole, { adminId, targetUserId, newRole });
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'UNKNOWN' };
  }
}

export async function adminUpdateEventStatusAction(
  eventId: string,
  newStatus: 'draft' | 'active' | 'archived' | 'cancelled',
): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.adminUpdateEventStatus, { adminId, eventId, newStatus });
    revalidatePath('/admin/events');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'UNKNOWN' };
  }
}

export async function adminDeleteEventAction(eventId: string): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.adminDeleteEvent, { adminId, eventId });
    revalidatePath('/admin/events');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'UNKNOWN' };
  }
}

export async function adminModeratePhotoAction(
  photoId: string,
  decision: 'approved' | 'rejected',
): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.adminModeratePhoto, { adminId, photoId, decision });
    revalidatePath('/admin/moderation');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'UNKNOWN' };
  }
}

/* -------------------------------------------------------------------------- */
/*  Remboursements (paiements one-shot plateforme)                             */
/* -------------------------------------------------------------------------- */

export type RefundResult =
  | { ok: true; status: string; refundedAmountMinor: number }
  | { ok: false; error: string };

/**
 * Rembourse un paiement plateforme. Séquence : (1) garde admin, (2) lit les
 * infos Stripe du paiement via Convex, (3) appelle Stripe (total ou partiel),
 * (4) enregistre le résultat + audit via Convex. `amountMinor` omis = total.
 * Pour les paiements `mock` (dev), saute Stripe et marque directement remboursé.
 */
export async function adminRefundPaymentAction(
  paymentId: string,
  amountMinor?: number,
): Promise<RefundResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    const info = await convex.query(convexApi.adminGetPaymentRefundInfo, { adminId, paymentId });

    if (info.status !== 'succeeded' && info.status !== 'partially_refunded') {
      return { ok: false, error: 'NOT_REFUNDABLE' };
    }
    const remaining = info.amountMinor - info.refundedAmountMinor;
    if (remaining <= 0) return { ok: false, error: 'ALREADY_FULLY_REFUNDED' };

    const requested = amountMinor ?? remaining;
    if (requested <= 0 || requested > remaining) return { ok: false, error: 'INVALID_AMOUNT' };
    const isFull = requested >= remaining;

    let stripeRefundId: string | undefined;
    let appliedAmount = requested;

    if (info.provider === 'stripe') {
      const res = await refundPlatformPayment(
        info.providerSessionId,
        isFull ? undefined : requested,
      );
      stripeRefundId = res.id;
      appliedAmount = res.amountMinor;
    }

    const marked = await convex.mutation(convexApi.adminMarkPaymentRefunded, {
      adminId,
      paymentId,
      refundAmountMinor: appliedAmount,
      stripeRefundId,
    });

    revalidatePath('/admin/payments');
    revalidatePath('/admin/invoices');
    revalidatePath('/admin');
    return { ok: true, status: marked.status, refundedAmountMinor: appliedAmount };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}

/* -------------------------------------------------------------------------- */
/*  Abonnements (annuler / réactiver / factures)                               */
/* -------------------------------------------------------------------------- */

export async function adminCancelSubscriptionAction(
  organizationId: string,
  mode: 'period_end' | 'immediate',
): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    const info = await convex.query(convexApi.adminGetOrgSubscriptionInfo, {
      adminId,
      organizationId,
    });
    if (!info.stripeSubscriptionId) return { ok: false, error: 'NO_SUBSCRIPTION' };

    await cancelPlatformSubscription(info.stripeSubscriptionId, mode);
    await convex.mutation(convexApi.adminMarkSubscriptionCanceled, {
      adminId,
      organizationId,
      mode,
    });

    revalidatePath('/admin/subscriptions');
    revalidatePath('/admin');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}

export async function adminReactivateSubscriptionAction(
  organizationId: string,
): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    const info = await convex.query(convexApi.adminGetOrgSubscriptionInfo, {
      adminId,
      organizationId,
    });
    if (!info.stripeSubscriptionId) return { ok: false, error: 'NO_SUBSCRIPTION' };

    await reactivatePlatformSubscription(info.stripeSubscriptionId);
    await convex.mutation(convexApi.adminMarkSubscriptionReactivated, { adminId, organizationId });

    revalidatePath('/admin/subscriptions');
    revalidatePath('/admin');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}

export type OrgInvoicesResult =
  | { ok: true; invoices: SubscriptionInvoice[]; orgName: string }
  | { ok: false; error: string };

/**
 * Liste les factures d'abonnement Stripe d'une organisation (lecture, pour le
 * Dialog « Voir les factures »). Renvoie `[]` si pas de client Stripe.
 */
export async function adminListOrgInvoicesAction(
  organizationId: string,
): Promise<OrgInvoicesResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    const info = await convex.query(convexApi.adminGetOrgSubscriptionInfo, {
      adminId,
      organizationId,
    });
    if (!info.stripeCustomerId) return { ok: true, invoices: [], orgName: info.name };
    const invoices = await listSubscriptionInvoices(info.stripeCustomerId, 24);
    return { ok: true, invoices, orgName: info.name };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}
