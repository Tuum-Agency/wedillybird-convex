import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';

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

    const succeededPayments = allPayments.filter((p) => p.status === 'succeeded');
    const failedPayments = allPayments.filter((p) => p.status === 'failed');

    const totalRevenueMinor = succeededPayments.reduce((sum, p) => sum + p.amountMinor, 0);

    const activeSubscriptions = allOrgs.filter(
      (o) => o.subscriptionStatus === 'active' || o.subscriptionStatus === 'trialing',
    );

    const mrrMinor = activeSubscriptions.reduce((sum, o) => {
      const tierPrices: Record<string, number> = {
        starter: 8900,
        business: 17900,
        agency: 34900,
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
      mrrMinor,
      failedPaymentsCount: failedPayments.length,
      failedPaymentsAmountMinor: failedPayments.reduce((s, p) => s + p.amountMinor, 0),
      activeSubscriptions: activeSubscriptions.length,
      revenueByMonth,
      usersByMonth,
      revenueByCurrency,
      revenueByProvider,
    };
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
      userName: userMap.get(p.userId)?.fullName ?? null,
      userEmail: userMap.get(p.userId)?.email ?? null,
      eventId: p.eventId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
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
      ownerName: ownerMap.get(o.ownerId)?.fullName ?? null,
      ownerEmail: ownerMap.get(o.ownerId)?.email ?? null,
      createdAt: o.createdAt,
    }));
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
