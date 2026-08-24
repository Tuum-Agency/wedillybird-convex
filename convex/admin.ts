import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { computePlatformAnalytics, computeRefundOutcome } from './lib/analytics';
import { reverseReferralBySession, restoreCreditForRefundedSession } from './affiliate';
import { IDENTITY_ARGS, requireAdminCompat } from './lib/verifiedSession';

// ---------------------------------------------------------------------------
// Dashboard KPI
// ---------------------------------------------------------------------------

export const dashboardKpi = query({
  args: { ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    await requireAdminCompat(ctx, args);

    const allUsers = await ctx.db.query('users').collect();
    const allEvents = await ctx.db.query('events').collect();
    const allPayments = await ctx.db.query('payments').collect();
    const allOrgs = await ctx.db.query('organizations').collect();

    const succeededPayments = allPayments.filter(
      (p) => p.status === 'succeeded' || p.status === 'partially_refunded',
    );
    const failedPayments = allPayments.filter((p) => p.status === 'failed');
    const refundedPayments = allPayments.filter(
      (p) => p.status === 'refunded' || p.status === 'partially_refunded',
    );

    const totalRevenueMinor = succeededPayments.reduce((sum, p) => sum + p.amountMinor, 0);
    const totalRefundedMinor = refundedPayments.reduce(
      (sum, p) => sum + (p.refundedAmountMinor ?? 0),
      0,
    );

    const activeSubscriptions = allOrgs.filter(
      (o) => o.subscriptionStatus === 'active' || o.subscriptionStatus === 'trialing',
    );

    const mrrMinor = activeSubscriptions.reduce((sum, o) => {
      // Miroir de SUBSCRIPTION_TIER_PRICES (lib/payments/subscriptions.ts) —
      // grille v2. Approximation MRR (mensuel uniquement ; les abonnements
      // annuels ne sont pas proratisés ici).
      const tierPrices: Record<string, number> = {
        starter: 9900,
        business: 21900,
        agency: 44900,
      };
      return sum + (tierPrices[o.subscriptionTier ?? ''] ?? 0);
    }, 0);

    const activeEvents = allEvents.filter((e) => e.status === 'active');
    const paidEvents = allEvents.filter((e) => e.planTier !== undefined);

    const revenueByMonth: Record<string, number> = {};
    const usersByMonth: Record<string, { couple: number; pro: number; guest: number }> = {};

    for (const p of succeededPayments) {
      const key = new Date(p.createdAt).toISOString().slice(0, 7);
      revenueByMonth[key] = (revenueByMonth[key] ?? 0) + p.amountMinor;
    }

    for (const u of allUsers) {
      const key = new Date(u.createdAt).toISOString().slice(0, 7);
      if (!usersByMonth[key]) usersByMonth[key] = { couple: 0, pro: 0, guest: 0 };
      const role = u.role === 'admin' ? 'couple' : u.role;
      const bucket = usersByMonth[key];
      if (bucket && role in bucket) {
        bucket[role as keyof typeof bucket] += 1;
      }
    }

    const revenueByCurrency: Record<string, number> = {};
    for (const p of succeededPayments) {
      revenueByCurrency[p.currency] = (revenueByCurrency[p.currency] ?? 0) + p.amountMinor;
    }

    const revenueByProvider: Record<string, number> = {};
    for (const p of succeededPayments) {
      revenueByProvider[p.provider] = (revenueByProvider[p.provider] ?? 0) + p.amountMinor;
    }

    const pastDueSubscriptions = allOrgs.filter((o) => o.subscriptionStatus === 'past_due');
    const canceledSubscriptions = allOrgs.filter((o) => o.subscriptionStatus === 'canceled');

    return {
      totalUsers: allUsers.length,
      usersByRole: {
        couple: allUsers.filter((u) => u.role === 'couple').length,
        pro: allUsers.filter((u) => u.role === 'pro').length,
        guest: allUsers.filter((u) => u.role === 'guest').length,
        admin: allUsers.filter((u) => u.role === 'admin').length,
      },
      totalEvents: allEvents.length,
      activeEvents: activeEvents.length,
      paidEvents: paidEvents.length,
      conversionRate: allEvents.length > 0 ? paidEvents.length / allEvents.length : 0,
      totalRevenueMinor,
      netRevenueMinor: totalRevenueMinor - totalRefundedMinor,
      totalRefundedMinor,
      refundedPaymentsCount: refundedPayments.length,
      mrrMinor,
      failedPaymentsCount: failedPayments.length,
      failedPaymentsAmountMinor: failedPayments.reduce((s, p) => s + p.amountMinor, 0),
      activeSubscriptions: activeSubscriptions.length,
      pastDueSubscriptions: pastDueSubscriptions.length,
      canceledSubscriptions: canceledSubscriptions.length,
      revenueByMonth,
      usersByMonth,
      revenueByCurrency,
      revenueByProvider,
    };
  },
});

// ---------------------------------------------------------------------------
// Analytics plateforme — funnel de conversion, abandon de checkout,
// saisonnalité (rush), mix d'offres, cohortes. Vue « façon Stripe » pour
// piloter l'acquisition et la conversion sans quitter la plateforme.
//
// `now` est passé en argument (déterminisme Convex + cohérence SSR) : la page
// serveur calcule Date.now() et le transmet.
// ---------------------------------------------------------------------------

export const platformAnalytics = query({
  args: { ...IDENTITY_ARGS, now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { now: nowArg } = args;
    await requireAdminCompat(ctx, args);
    const now = nowArg ?? Date.now();

    const [users, events, payments, orgs] = await Promise.all([
      ctx.db.query('users').collect(),
      ctx.db.query('events').collect(),
      ctx.db.query('payments').collect(),
      ctx.db.query('organizations').collect(),
    ]);

    return computePlatformAnalytics({ users, events, payments, orgs }, now);
  },
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const listUsers = query({
  args: { ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    await requireAdminCompat(ctx, args);
    const users = await ctx.db.query('users').collect();
    return users.map((u) => ({
      _id: u._id,
      phone: u.phone,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      planTier: u.planTier,
      createdAt: u.createdAt,
      lastSeenAt: u.lastSeenAt,
    }));
  },
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const listAllEvents = query({
  args: { ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    await requireAdminCompat(ctx, args);
    const events = await ctx.db.query('events').collect();
    const ownerIds = [...new Set(events.map((e) => e.ownerId))];
    const owners = await Promise.all(ownerIds.map((id) => ctx.db.get(id)));
    const ownerMap = new Map(owners.filter(Boolean).map((o) => [o!._id, o!]));

    return events.map((e) => ({
      _id: e._id,
      title: e.title,
      coupleNames: e.coupleNames,
      eventDate: e.eventDate,
      timezone: e.timezone,
      status: e.status,
      planTier: e.planTier,
      maxGuests: e.maxGuests,
      ownerName: ownerMap.get(e.ownerId)?.fullName ?? null,
      ownerEmail: ownerMap.get(e.ownerId)?.email ?? null,
      organizationId: e.organizationId,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));
  },
});

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const listAllPayments = query({
  args: { ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    await requireAdminCompat(ctx, args);
    const payments = await ctx.db.query('payments').collect();
    const userIds = [...new Set(payments.map((p) => p.userId))];
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    const userMap = new Map(users.filter(Boolean).map((u) => [u!._id, u!]));

    return payments.map((p) => ({
      _id: p._id,
      kind: p.kind,
      plan: p.plan,
      currency: p.currency,
      amountMinor: p.amountMinor,
      provider: p.provider,
      status: p.status,
      failureReason: p.failureReason,
      refundedAmountMinor: p.refundedAmountMinor,
      refundedAt: p.refundedAt,
      userName: userMap.get(p.userId)?.fullName ?? null,
      userEmail: userMap.get(p.userId)?.email ?? null,
      eventId: p.eventId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  },
});

// ---------------------------------------------------------------------------
// Audit générique — pour les actions purement Stripe (coupons, codes promo,
// remises) qui n'ont pas d'entité Convex. La server action appelle ceci après
// l'opération Stripe pour tracer qui a fait quoi.
// ---------------------------------------------------------------------------

export const logAction = mutation({
  args: {
    ...IDENTITY_ARGS,
    action: v.string(),
    targetType: v.union(
      v.literal('coupon'),
      v.literal('discount'),
      v.literal('subscription'),
      v.literal('organization'),
    ),
    targetId: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { action, targetType, targetId, details } = args;
    const admin = await requireAdminCompat(ctx, args);
    const adminId = admin._id;
    await ctx.db.insert('adminAuditLog', {
      adminId,
      action,
      targetType,
      targetId,
      details,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Refunds — un super admin peut rembourser un paiement plateforme (Essentiel /
// Premium). L'appel Stripe se fait côté server action ; ici on n'expose que les
// infos nécessaires + on enregistre le résultat (statut + montant + audit).
// ---------------------------------------------------------------------------

export const getPaymentRefundInfo = query({
  args: { ...IDENTITY_ARGS, paymentId: v.id('payments') },
  handler: async (ctx, args) => {
    const { paymentId } = args;
    await requireAdminCompat(ctx, args);
    const p = await ctx.db.get(paymentId);
    if (!p) throw new Error('PAYMENT_NOT_FOUND');
    return {
      _id: p._id,
      provider: p.provider,
      providerSessionId: p.providerSessionId,
      status: p.status,
      currency: p.currency,
      amountMinor: p.amountMinor,
      refundedAmountMinor: p.refundedAmountMinor ?? 0,
    };
  },
});

export const markPaymentRefunded = mutation({
  args: {
    ...IDENTITY_ARGS,
    paymentId: v.id('payments'),
    refundAmountMinor: v.number(),
    stripeRefundId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { paymentId, refundAmountMinor, stripeRefundId } = args;
    const admin = await requireAdminCompat(ctx, args);
    const adminId = admin._id;
    const p = await ctx.db.get(paymentId);
    if (!p) throw new Error('PAYMENT_NOT_FOUND');

    const { status, totalRefunded } = computeRefundOutcome(
      p.amountMinor,
      p.refundedAmountMinor ?? 0,
      refundAmountMinor,
    );
    await ctx.db.patch(paymentId, {
      status,
      refundedAmountMinor: totalRefunded,
      refundedAt: Date.now(),
      stripeRefundId: stripeRefundId ?? p.stripeRefundId,
      updatedAt: Date.now(),
    });

    // Affiliation : rembourser une vente (a) annule la commission qu'elle a
    // GÉNÉRÉE pour le parrain de l'acheteur, et (b) RESTITUE le crédit que
    // l'acheteur avait DÉPENSÉ sur cet achat (lignes `credited` → `vested`).
    // Best-effort, idempotent.
    try {
      await reverseReferralBySession(ctx, p.providerSessionId);
    } catch {
      // best-effort — le remboursement prime.
    }
    try {
      await restoreCreditForRefundedSession(ctx, p.providerSessionId);
    } catch {
      // best-effort
    }

    await ctx.db.insert('adminAuditLog', {
      adminId,
      action: status === 'refunded' ? 'refund_payment' : 'partial_refund_payment',
      targetType: 'payment',
      targetId: paymentId,
      details: JSON.stringify({
        refundAmountMinor,
        totalRefunded,
        currency: p.currency,
        stripeRefundId,
      }),
      createdAt: Date.now(),
    });
    return { ok: true, status };
  },
});

// ---------------------------------------------------------------------------
// Subscriptions (organizations)
// ---------------------------------------------------------------------------

export const listAllOrganizations = query({
  args: { ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    await requireAdminCompat(ctx, args);
    const orgs = await ctx.db.query('organizations').collect();
    const ownerIds = [...new Set(orgs.map((o) => o.ownerId))];
    const owners = await Promise.all(ownerIds.map((id) => ctx.db.get(id)));
    const ownerMap = new Map(owners.filter(Boolean).map((o) => [o!._id, o!]));

    return orgs.map((o) => ({
      _id: o._id,
      name: o.name,
      slug: o.slug,
      subscriptionTier: o.subscriptionTier,
      subscriptionStatus: o.subscriptionStatus,
      subscriptionPeriodEnd: o.subscriptionPeriodEnd,
      paygCredits: o.paygCredits,
      // Présence des identifiants Stripe → l'admin sait quelles actions
      // (annuler, réactiver, factures) sont disponibles pour cette org.
      hasStripeSubscription: Boolean(o.stripeSubscriptionId),
      hasStripeCustomer: Boolean(o.stripeCustomerId),
      ownerName: ownerMap.get(o.ownerId)?.fullName ?? null,
      ownerEmail: ownerMap.get(o.ownerId)?.email ?? null,
      createdAt: o.createdAt,
    }));
  },
});

// ---------------------------------------------------------------------------
// Subscriptions — gestion par le super admin (annuler / réactiver). L'appel
// Stripe se fait côté server action ; ici on expose les identifiants et on
// reflète le résultat sur l'organisation + audit. Le webhook Stripe
// (`subscription.deleted/updated`) reste la source de vérité et réconciliera.
// ---------------------------------------------------------------------------

export const getOrgSubscriptionInfo = query({
  args: { ...IDENTITY_ARGS, organizationId: v.id('organizations') },
  handler: async (ctx, args) => {
    const { organizationId } = args;
    await requireAdminCompat(ctx, args);
    const o = await ctx.db.get(organizationId);
    if (!o) throw new Error('ORG_NOT_FOUND');
    return {
      _id: o._id,
      name: o.name,
      stripeSubscriptionId: o.stripeSubscriptionId ?? null,
      stripeCustomerId: o.stripeCustomerId ?? null,
      subscriptionTier: o.subscriptionTier ?? null,
      subscriptionStatus: o.subscriptionStatus ?? null,
      subscriptionPeriodEnd: o.subscriptionPeriodEnd ?? null,
    };
  },
});

export const markSubscriptionCanceled = mutation({
  args: {
    ...IDENTITY_ARGS,
    organizationId: v.id('organizations'),
    mode: v.union(v.literal('period_end'), v.literal('immediate')),
  },
  handler: async (ctx, args) => {
    const { organizationId, mode } = args;
    const admin = await requireAdminCompat(ctx, args);
    const adminId = admin._id;
    const o = await ctx.db.get(organizationId);
    if (!o) throw new Error('ORG_NOT_FOUND');
    const previousStatus = o.subscriptionStatus;

    if (mode === 'immediate') {
      // Coupe l'accès tout de suite : statut canceled + plus de date de fin.
      await ctx.db.patch(organizationId, {
        subscriptionStatus: 'canceled' as const,
        subscriptionPeriodEnd: undefined,
        updatedAt: Date.now(),
      });
    }
    // mode === 'period_end' : on conserve le statut actif et la date de fin ;
    // Stripe émettra `subscription.deleted` à l'échéance. L'audit trace l'intention.

    await ctx.db.insert('adminAuditLog', {
      adminId,
      action: 'cancel_subscription',
      targetType: 'subscription',
      targetId: organizationId,
      details: JSON.stringify({ mode, previousStatus, tier: o.subscriptionTier }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const markSubscriptionReactivated = mutation({
  args: { ...IDENTITY_ARGS, organizationId: v.id('organizations') },
  handler: async (ctx, args) => {
    const { organizationId } = args;
    const admin = await requireAdminCompat(ctx, args);
    const adminId = admin._id;
    const o = await ctx.db.get(organizationId);
    if (!o) throw new Error('ORG_NOT_FOUND');
    await ctx.db.patch(organizationId, {
      subscriptionStatus: 'active' as const,
      updatedAt: Date.now(),
    });
    await ctx.db.insert('adminAuditLog', {
      adminId,
      action: 'reactivate_subscription',
      targetType: 'subscription',
      targetId: organizationId,
      details: JSON.stringify({ previousStatus: o.subscriptionStatus, tier: o.subscriptionTier }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Moderation — photos pending + templates
// ---------------------------------------------------------------------------

export const listPendingPhotos = query({
  args: { ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    await requireAdminCompat(ctx, args);
    const photos = await ctx.db.query('photos').collect();
    const pending = photos.filter((p) => p.status === 'pending');

    return pending.map((p) => ({
      _id: p._id,
      eventId: p.eventId,
      s3Key: p.s3Key,
      status: p.status,
      sizeBytes: p.sizeBytes,
      contentType: p.contentType,
      uploaderName: p.uploaderName,
      moderation: p.moderation,
      variants: p.variants,
      createdAt: p.createdAt,
    }));
  },
});

export const listAllWhatsappTemplates = query({
  args: { ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    await requireAdminCompat(ctx, args);
    const templates = await ctx.db.query('whatsappTemplates').collect();
    return templates.map((t) => ({
      _id: t._id,
      eventId: t.eventId,
      name: t.name,
      bodyText: t.bodyText,
      ctaLabel: t.ctaLabel,
      status: t.status,
      rejectionReason: t.rejectionReason,
      submittedAt: t.submittedAt,
      reviewedAt: t.reviewedAt,
      createdAt: t.createdAt,
    }));
  },
});

// ---------------------------------------------------------------------------
// Newsletter
// ---------------------------------------------------------------------------

export const listNewsletterSubscribers = query({
  args: { ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    await requireAdminCompat(ctx, args);
    const subs = await ctx.db.query('newsletterSubscribers').collect();
    return subs.map((s) => ({
      _id: s._id,
      email: s.email,
      status: s.status,
      source: s.source,
      subscribedAt: s.subscribedAt,
      unsubscribedAt: s.unsubscribedAt,
    }));
  },
});

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export const listAuditLog = query({
  args: { ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    await requireAdminCompat(ctx, args);
    const logs = await ctx.db.query('adminAuditLog').order('desc').collect();

    const adminIds = [...new Set(logs.map((l) => l.adminId))];
    const admins = await Promise.all(adminIds.map((id) => ctx.db.get(id)));
    const adminMap = new Map(admins.filter(Boolean).map((a) => [a!._id, a!]));

    return logs.map((l) => ({
      _id: l._id,
      adminName: adminMap.get(l.adminId)?.fullName ?? null,
      adminEmail: adminMap.get(l.adminId)?.email ?? null,
      action: l.action,
      targetType: l.targetType,
      targetId: l.targetId,
      details: l.details,
      createdAt: l.createdAt,
    }));
  },
});

// ---------------------------------------------------------------------------
// Admin mutations
// ---------------------------------------------------------------------------

export const suspendUser = mutation({
  args: {
    ...IDENTITY_ARGS,
    targetUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const { targetUserId } = args;
    const admin = await requireAdminCompat(ctx, args);
    const adminId = admin._id;
    const target = await ctx.db.get(targetUserId);
    if (!target) throw new Error('USER_NOT_FOUND');
    if (target.role === 'admin') throw new Error('CANNOT_SUSPEND_ADMIN');

    await ctx.db.patch(targetUserId, { role: 'guest' as const });
    await ctx.db.insert('adminAuditLog', {
      adminId,
      action: 'suspend_user',
      targetType: 'user',
      targetId: targetUserId,
      details: JSON.stringify({ previousRole: target.role }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const changeUserRole = mutation({
  args: {
    ...IDENTITY_ARGS,
    targetUserId: v.id('users'),
    newRole: v.union(v.literal('couple'), v.literal('pro'), v.literal('guest'), v.literal('admin')),
  },
  handler: async (ctx, args) => {
    const { targetUserId, newRole } = args;
    const admin = await requireAdminCompat(ctx, args);
    const adminId = admin._id;
    const target = await ctx.db.get(targetUserId);
    if (!target) throw new Error('USER_NOT_FOUND');

    const previousRole = target.role;
    await ctx.db.patch(targetUserId, { role: newRole });
    await ctx.db.insert('adminAuditLog', {
      adminId,
      action: 'change_role',
      targetType: 'user',
      targetId: targetUserId,
      details: JSON.stringify({ previousRole, newRole }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const updateEventStatus = mutation({
  args: {
    ...IDENTITY_ARGS,
    eventId: v.id('events'),
    newStatus: v.union(
      v.literal('draft'),
      v.literal('active'),
      v.literal('archived'),
      v.literal('cancelled'),
    ),
  },
  handler: async (ctx, args) => {
    const { eventId, newStatus } = args;
    const admin = await requireAdminCompat(ctx, args);
    const adminId = admin._id;
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error('EVENT_NOT_FOUND');

    const previousStatus = event.status;
    await ctx.db.patch(eventId, { status: newStatus, updatedAt: Date.now() });
    await ctx.db.insert('adminAuditLog', {
      adminId,
      action: 'update_event_status',
      targetType: 'event',
      targetId: eventId,
      details: JSON.stringify({ previousStatus, newStatus }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const adminModeratePhoto = mutation({
  args: {
    ...IDENTITY_ARGS,
    photoId: v.id('photos'),
    decision: v.union(v.literal('approved'), v.literal('rejected')),
  },
  handler: async (ctx, args) => {
    const { photoId, decision } = args;
    const admin = await requireAdminCompat(ctx, args);
    const adminId = admin._id;
    const photo = await ctx.db.get(photoId);
    if (!photo) throw new Error('PHOTO_NOT_FOUND');

    await ctx.db.patch(photoId, {
      status: decision,
      moderatedAt: Date.now(),
      moderatedBy: adminId,
      moderation: {
        source: 'manual' as const,
        decision,
        decidedAt: Date.now(),
      },
    });
    await ctx.db.insert('adminAuditLog', {
      adminId,
      action: 'moderate_photo',
      targetType: 'photo',
      targetId: photoId,
      details: JSON.stringify({ decision, eventId: photo.eventId }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const deleteEvent = mutation({
  args: {
    ...IDENTITY_ARGS,
    eventId: v.id('events'),
  },
  handler: async (ctx, args) => {
    const { eventId } = args;
    const admin = await requireAdminCompat(ctx, args);
    const adminId = admin._id;
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error('EVENT_NOT_FOUND');

    await ctx.db.patch(eventId, { status: 'cancelled' as const, updatedAt: Date.now() });
    await ctx.db.insert('adminAuditLog', {
      adminId,
      action: 'delete_event',
      targetType: 'event',
      targetId: eventId,
      details: JSON.stringify({ title: event.title }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Livres photo (upsell HD post-event) — fabrication & expédition manuelles
// par l'équipe ops. Cette vue liste les commandes et permet de faire évoluer
// leur statut (en fabrication → expédié), ou de les annuler.
// ---------------------------------------------------------------------------

export const listPhotoBookOrders = query({
  args: { ...IDENTITY_ARGS },
  handler: async (ctx, args) => {
    await requireAdminCompat(ctx, args);
    const orders = await ctx.db.query('photoBookOrders').order('desc').collect();
    const eventIds = [...new Set(orders.map((o) => o.eventId))];
    const userIds = [...new Set(orders.map((o) => o.userId))];
    const [events, users] = await Promise.all([
      Promise.all(eventIds.map((id) => ctx.db.get(id))),
      Promise.all(userIds.map((id) => ctx.db.get(id))),
    ]);
    const eventMap = new Map(events.filter(Boolean).map((e) => [e!._id, e!]));
    const userMap = new Map(users.filter(Boolean).map((u) => [u!._id, u!]));

    return orders.map((o) => ({
      _id: o._id,
      eventId: o.eventId,
      eventTitle: eventMap.get(o.eventId)?.title ?? null,
      status: o.status,
      recipientName: o.recipientName,
      addressLine1: o.addressLine1,
      addressLine2: o.addressLine2,
      city: o.city,
      postalCode: o.postalCode,
      country: o.country,
      notes: o.notes,
      ownerName: userMap.get(o.userId)?.fullName ?? null,
      ownerEmail: userMap.get(o.userId)?.email ?? null,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));
  },
});

export const updatePhotoBookStatus = mutation({
  args: {
    ...IDENTITY_ARGS,
    orderId: v.id('photoBookOrders'),
    status: v.union(
      v.literal('requested'),
      v.literal('in_production'),
      v.literal('shipped'),
      v.literal('cancelled'),
    ),
  },
  handler: async (ctx, args) => {
    const { orderId, status } = args;
    const admin = await requireAdminCompat(ctx, args);
    const adminId = admin._id;
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error('ORDER_NOT_FOUND');

    await ctx.db.patch(orderId, { status, updatedAt: Date.now() });
    await ctx.db.insert('adminAuditLog', {
      adminId,
      action: 'update_photo_book_status',
      targetType: 'photo_book',
      targetId: orderId,
      details: JSON.stringify({ from: order.status, to: status }),
      createdAt: Date.now(),
    });
    return { ok: true as const, status };
  },
});
