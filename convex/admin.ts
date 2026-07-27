import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { computePlatformAnalytics, computeRefundOutcome } from './lib/analytics';

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

// ---------------------------------------------------------------------------
// Dashboard KPI
// ---------------------------------------------------------------------------

export const dashboardKpi = query({
  args: { adminId: v.id('users') },
  handler: async (ctx, { adminId }) => {
    await assertAdmin(ctx, adminId);

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
  args: { adminId: v.id('users'), now: v.optional(v.number()) },
  handler: async (ctx, { adminId, now: nowArg }) => {
    await assertAdmin(ctx, adminId);
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
  args: { adminId: v.id('users') },
  handler: async (ctx, { adminId }) => {
    await assertAdmin(ctx, adminId);
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
  args: { adminId: v.id('users') },
  handler: async (ctx, { adminId }) => {
    await assertAdmin(ctx, adminId);
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
  args: { adminId: v.id('users') },
  handler: async (ctx, { adminId }) => {
    await assertAdmin(ctx, adminId);
    const payments = await ctx.db.query('payments').collect();
    const userIds = [...new Set(payments.map((p) => p.userId))];
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    const userMap = new Map(users.filter(Boolean).map((u) => [u!._id, u!]));

    return payments.map((p) => ({
      _id: p._id,
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
    adminId: v.id('users'),
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
  handler: async (ctx, { adminId, action, targetType, targetId, details }) => {
    await assertAdmin(ctx, adminId);
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
  args: { adminId: v.id('users'), paymentId: v.id('payments') },
  handler: async (ctx, { adminId, paymentId }) => {
    await assertAdmin(ctx, adminId);
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
    adminId: v.id('users'),
    paymentId: v.id('payments'),
    refundAmountMinor: v.number(),
    stripeRefundId: v.optional(v.string()),
  },
  handler: async (ctx, { adminId, paymentId, refundAmountMinor, stripeRefundId }) => {
    await assertAdmin(ctx, adminId);
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

    // Affiliation : si un remboursement TOTAL annule une vente attribuée à une
    // influenceuse, on annule la commission correspondante (status `reversed`).
    // Une commission déjà `paid` est aussi passée `reversed` — l'argent est parti,
    // mais le registre reflète la reprise à opérer (geste manuel côté admin).
    if (status === 'refunded') {
      const commission = await ctx.db
        .query('commissions')
        .withIndex('by_source', (q) => q.eq('source', 'payment').eq('sourceId', paymentId))
        .first();
      if (commission && commission.status !== 'reversed') {
        await ctx.db.patch(commission._id, { status: 'reversed', updatedAt: Date.now() });
        await ctx.db.insert('adminAuditLog', {
          adminId,
          action: 'reverse_commission',
          targetType: 'commission',
          targetId: commission._id,
          details: JSON.stringify({
            reason: 'payment_refunded',
            paymentId,
            wasPaid: commission.status === 'paid',
          }),
          createdAt: Date.now(),
        });
      }
    }

    return { ok: true, status };
  },
});

// ---------------------------------------------------------------------------
// Subscriptions (organizations)
// ---------------------------------------------------------------------------

export const listAllOrganizations = query({
  args: { adminId: v.id('users') },
  handler: async (ctx, { adminId }) => {
    await assertAdmin(ctx, adminId);
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
  args: { adminId: v.id('users'), organizationId: v.id('organizations') },
  handler: async (ctx, { adminId, organizationId }) => {
    await assertAdmin(ctx, adminId);
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
    adminId: v.id('users'),
    organizationId: v.id('organizations'),
    mode: v.union(v.literal('period_end'), v.literal('immediate')),
  },
  handler: async (ctx, { adminId, organizationId, mode }) => {
    await assertAdmin(ctx, adminId);
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
  args: { adminId: v.id('users'), organizationId: v.id('organizations') },
  handler: async (ctx, { adminId, organizationId }) => {
    await assertAdmin(ctx, adminId);
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
  args: { adminId: v.id('users') },
  handler: async (ctx, { adminId }) => {
    await assertAdmin(ctx, adminId);
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
  args: { adminId: v.id('users') },
  handler: async (ctx, { adminId }) => {
    await assertAdmin(ctx, adminId);
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
  args: { adminId: v.id('users') },
  handler: async (ctx, { adminId }) => {
    await assertAdmin(ctx, adminId);
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
  args: { adminId: v.id('users') },
  handler: async (ctx, { adminId }) => {
    await assertAdmin(ctx, adminId);
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
    adminId: v.id('users'),
    targetUserId: v.id('users'),
  },
  handler: async (ctx, { adminId, targetUserId }) => {
    await assertAdmin(ctx, adminId);
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
    adminId: v.id('users'),
    targetUserId: v.id('users'),
    newRole: v.union(v.literal('couple'), v.literal('pro'), v.literal('guest'), v.literal('admin')),
  },
  handler: async (ctx, { adminId, targetUserId, newRole }) => {
    await assertAdmin(ctx, adminId);
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
    adminId: v.id('users'),
    eventId: v.id('events'),
    newStatus: v.union(
      v.literal('draft'),
      v.literal('active'),
      v.literal('archived'),
      v.literal('cancelled'),
    ),
  },
  handler: async (ctx, { adminId, eventId, newStatus }) => {
    await assertAdmin(ctx, adminId);
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
    adminId: v.id('users'),
    photoId: v.id('photos'),
    decision: v.union(v.literal('approved'), v.literal('rejected')),
  },
  handler: async (ctx, { adminId, photoId, decision }) => {
    await assertAdmin(ctx, adminId);
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
    adminId: v.id('users'),
    eventId: v.id('events'),
  },
  handler: async (ctx, { adminId, eventId }) => {
    await assertAdmin(ctx, adminId);
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
