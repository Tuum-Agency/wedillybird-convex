'use server';

import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { getSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import {
  refundPlatformPayment,
  cancelPlatformSubscription,
  reactivatePlatformSubscription,
  listSubscriptionInvoices,
  createCoupon,
  resolveProPlanProductIds,
  listCoupons,
  deleteCoupon,
  createPromotionCode,
  listPromotionCodes,
  setPromotionCodeActive,
  applyCouponToSubscription,
  removeSubscriptionDiscount,
  type SubscriptionInvoice,
  type AdminCoupon,
  type AdminPromotionCode,
} from '@/lib/payments/drivers/stripe';
import type { Currency } from '@/lib/payments/plans';

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

/* -------------------------------------------------------------------------- */
/*  Promotions — coupons, codes promo & remises (gestes commerciaux)           */
/* -------------------------------------------------------------------------- */

export type PromotionsResult =
  | { ok: true; coupons: AdminCoupon[]; promoCodes: AdminPromotionCode[] }
  | { ok: false; error: string };

export async function adminListPromotionsAction(): Promise<PromotionsResult> {
  try {
    await requireAdmin();
    const [coupons, promoCodes] = await Promise.all([listCoupons(), listPromotionCodes()]);
    return { ok: true, coupons, promoCodes };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}

export type CreateCouponInput = {
  name: string;
  kind: 'percent' | 'amount';
  percentOff?: number;
  amountOffMajor?: number; // saisi en unité majeure (€), converti en minor
  currency?: Currency;
  duration: 'once' | 'repeating' | 'forever';
  durationInMonths?: number;
  maxRedemptions?: number;
  redeemBy?: number; // ms epoch
  // Génère aussi un code promo lisible rattaché au coupon.
  promoCode?: string;
  // Restreint le coupon aux forfaits pros (Starter/Business/Agency, mensuel +
  // annuel) — ne s'applique alors ni aux forfaits couples ni au PAYG.
  restrictToProProducts?: boolean;
};

export async function adminCreateCouponAction(input: CreateCouponInput): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();

    const amountOffMinor =
      input.kind === 'amount' && input.amountOffMajor != null
        ? Math.round(input.amountOffMajor * 100)
        : undefined;

    // Restriction « forfaits pros » : on résout les produits Stripe des abos
    // pros dans l'environnement courant. Si aucun n'est résolu (env vars prix
    // manquantes), on refuse plutôt que de créer par erreur un coupon sans
    // restriction (qui s'appliquerait aussi aux forfaits couples).
    let appliesToProducts: string[] | undefined;
    if (input.restrictToProProducts) {
      appliesToProducts = await resolveProPlanProductIds();
      if (appliesToProducts.length === 0) {
        return { ok: false, error: 'NO_PRO_PRODUCTS_RESOLVED' };
      }
    }

    const coupon = await createCoupon({
      name: input.name,
      percentOff: input.kind === 'percent' ? input.percentOff : undefined,
      amountOffMinor,
      currency: input.currency,
      duration: input.duration,
      durationInMonths: input.durationInMonths,
      maxRedemptions: input.maxRedemptions,
      redeemBy: input.redeemBy,
      appliesToProducts,
    });

    let promoCode: string | undefined;
    if (input.promoCode) {
      const pc = await createPromotionCode({ couponId: coupon.id, code: input.promoCode });
      promoCode = pc.code;
    }

    await convex.mutation(convexApi.adminLogAction, {
      adminId,
      action: 'create_coupon',
      targetType: 'coupon',
      targetId: coupon.id,
      details: JSON.stringify({
        name: input.name,
        kind: input.kind,
        promoCode,
        ...(input.restrictToProProducts ? { restrictToProProducts: true } : {}),
      }),
    });
    revalidatePath('/admin/promotions');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}

export async function adminDeleteCouponAction(couponId: string): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    await deleteCoupon(couponId);
    await convex.mutation(convexApi.adminLogAction, {
      adminId,
      action: 'delete_coupon',
      targetType: 'coupon',
      targetId: couponId,
    });
    revalidatePath('/admin/promotions');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}

export async function adminCreatePromotionCodeAction(input: {
  couponId: string;
  code?: string;
  maxRedemptions?: number;
  expiresAt?: number;
  restrictToFirstTime?: boolean;
}): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    const pc = await createPromotionCode(input);
    await convex.mutation(convexApi.adminLogAction, {
      adminId,
      action: 'create_promo_code',
      targetType: 'coupon',
      targetId: input.couponId,
      details: JSON.stringify({ code: pc.code }),
    });
    revalidatePath('/admin/promotions');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}

export async function adminSetPromotionCodeActiveAction(
  promotionCodeId: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    await setPromotionCodeActive(promotionCodeId, active);
    await convex.mutation(convexApi.adminLogAction, {
      adminId,
      action: active ? 'enable_promo_code' : 'disable_promo_code',
      targetType: 'coupon',
      targetId: promotionCodeId,
    });
    revalidatePath('/admin/promotions');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}

/** Applique une remise (coupon) à l'abonnement d'une organisation — geste commercial. */
export async function adminApplyDiscountToOrgAction(
  organizationId: string,
  couponId: string,
): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    const info = await convex.query(convexApi.adminGetOrgSubscriptionInfo, {
      adminId,
      organizationId,
    });
    if (!info.stripeSubscriptionId) return { ok: false, error: 'NO_SUBSCRIPTION' };
    await applyCouponToSubscription(info.stripeSubscriptionId, couponId);
    await convex.mutation(convexApi.adminLogAction, {
      adminId,
      action: 'apply_discount',
      targetType: 'discount',
      targetId: organizationId,
      details: JSON.stringify({ couponId }),
    });
    revalidatePath('/admin/subscriptions');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}

export async function adminRemoveOrgDiscountAction(organizationId: string): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    const info = await convex.query(convexApi.adminGetOrgSubscriptionInfo, {
      adminId,
      organizationId,
    });
    if (!info.stripeSubscriptionId) return { ok: false, error: 'NO_SUBSCRIPTION' };
    await removeSubscriptionDiscount(info.stripeSubscriptionId);
    await convex.mutation(convexApi.adminLogAction, {
      adminId,
      action: 'remove_discount',
      targetType: 'discount',
      targetId: organizationId,
    });
    revalidatePath('/admin/subscriptions');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}

/* -------------------------------------------------------------------------- */
/*  Newsletter — campagnes (composer + envoyer via SES)                        */
/* -------------------------------------------------------------------------- */

export type NewsletterCampaign = {
  _id: string;
  subject: string;
  status: 'sending' | 'sent' | 'failed';
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: number;
  sentAt?: number;
};

export async function adminListNewsletterCampaignsAction(): Promise<
  { ok: true; campaigns: NewsletterCampaign[] } | { ok: false; error: string }
> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    const campaigns = await convex.query(convexApi.newsletterListCampaigns, { adminId });
    return { ok: true, campaigns };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}

/** Envoi de TEST : envoie la campagne à l'email de l'admin connecté uniquement. */
export async function adminSendNewsletterTestAction(
  subject: string,
  bodyText: string,
): Promise<{ ok: true; recipient: string } | { ok: false; error: string }> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    const me = await convex.query(convexApi.currentUser, { userId: adminId });
    const testEmail = me?.email;
    if (!testEmail) return { ok: false, error: 'NO_ADMIN_EMAIL' };

    const res = await convex.action(convexApi.newsletterSendCampaign, {
      adminId,
      subject,
      bodyText,
      testEmail,
    });
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, recipient: res.test ? res.recipient : testEmail };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}

/** Envoi RÉEL à tous les abonnés actifs. Outward/irréversible — confirmé côté UI. */
export async function adminSendNewsletterAction(
  subject: string,
  bodyText: string,
): Promise<{ ok: true; sentCount: number; failedCount: number } | { ok: false; error: string }> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    const res = await convex.action(convexApi.newsletterSendCampaign, {
      adminId,
      subject,
      bodyText,
    });
    if (!res.ok) return { ok: false, error: res.error };
    if (res.test) return { ok: false, error: 'UNEXPECTED_TEST_MODE' };
    revalidatePath('/admin/newsletter');
    return { ok: true, sentCount: res.sentCount, failedCount: res.failedCount };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}

export async function adminUpdatePhotoBookStatusAction(
  orderId: string,
  status: 'requested' | 'in_production' | 'shipped' | 'cancelled',
): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.adminUpdatePhotoBookStatus, { adminId, orderId, status });
    revalidatePath('/admin/photo-books');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}

/* -------------------------------------------------------------------------- */
/*  Affiliation — création d'affilié (invitation-only) + activation           */
/* -------------------------------------------------------------------------- */

export async function adminCreateAffiliateAction(input: {
  code: string;
  kind: 'referral' | 'partner';
  rewardType: 'credit' | 'cash';
  rateBps: number;
  buyerDiscountBps: number;
  ownerEmail?: string;
  displayName?: string;
}): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.createAffiliate, {
      adminId,
      code: input.code,
      kind: input.kind,
      rewardType: input.rewardType,
      rateBps: input.rateBps,
      buyerDiscountBps: input.buyerDiscountBps,
      ...(input.ownerEmail ? { ownerEmail: input.ownerEmail } : {}),
      ...(input.displayName ? { displayName: input.displayName } : {}),
    });
    revalidatePath('/admin/affiliates');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}

export async function adminSetAffiliateStatusAction(
  affiliateId: string,
  status: 'active' | 'disabled',
): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.setAffiliateStatus, { adminId, affiliateId, status });
    revalidatePath('/admin/affiliates');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: msg(e) };
  }
}
