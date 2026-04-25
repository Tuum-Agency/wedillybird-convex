import { v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';

const SLUG_MAX_ATTEMPTS = 8;
const ROLE = v.union(
  v.literal('owner'),
  v.literal('admin'),
  v.literal('planner'),
  v.literal('viewer'),
);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

async function uniqueSlug(ctx: MutationCtx, base: string): Promise<string> {
  let candidate = base;
  for (let i = 0; i < SLUG_MAX_ATTEMPTS; i++) {
    const existing = await ctx.db
      .query('organizations')
      .withIndex('by_slug', (q) => q.eq('slug', candidate))
      .first();
    if (!existing) return candidate;
    candidate = `${base}-${randomSuffix()}`;
  }
  throw new Error('SLUG_GENERATION_FAILED');
}

async function getMembership(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  userId: Id<'users'>,
): Promise<Doc<'organizationMemberships'> | null> {
  return ctx.db
    .query('organizationMemberships')
    .withIndex('by_org_user', (q) => q.eq('organizationId', organizationId).eq('userId', userId))
    .first();
}

async function assertCanManage(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  userId: Id<'users'>,
): Promise<void> {
  const membership = await getMembership(ctx, organizationId, userId);
  if (!membership || membership.status !== 'active') throw new Error('FORBIDDEN');
  if (membership.role !== 'owner' && membership.role !== 'admin') throw new Error('FORBIDDEN');
}

async function assertCanRead(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  userId: Id<'users'>,
): Promise<Doc<'organizationMemberships'>> {
  const membership = await getMembership(ctx, organizationId, userId);
  if (!membership || membership.status !== 'active') throw new Error('FORBIDDEN');
  return membership;
}

export const create = mutation({
  args: {
    ownerId: v.id('users'),
    name: v.string(),
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await ctx.db.get(args.ownerId);
    if (!owner) throw new Error('USER_NOT_FOUND');
    if (owner.role !== 'pro' && owner.role !== 'admin') throw new Error('NOT_PRO');

    const trimmed = args.name.trim();
    if (trimmed.length < 1 || trimmed.length > 120) throw new Error('INVALID_NAME');

    const baseSlug = slugify(trimmed) || `org-${randomSuffix()}`;
    const slug = await uniqueSlug(ctx, baseSlug);
    const now = Date.now();

    const id = await ctx.db.insert('organizations', {
      ownerId: args.ownerId,
      name: trimmed,
      slug,
      primaryColor: args.primaryColor,
      accentColor: args.accentColor,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert('organizationMemberships', {
      organizationId: id,
      userId: args.ownerId,
      role: 'owner',
      status: 'active',
      invitedBy: args.ownerId,
      invitedAt: now,
      acceptedAt: now,
    });

    return { id, slug };
  },
});

export const updateBranding = mutation({
  args: {
    organizationId: v.id('organizations'),
    requesterId: v.id('users'),
    name: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    logoStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    await assertCanManage(ctx, args.organizationId, args.requesterId);
    const patch: Partial<Doc<'organizations'>> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const trimmed = args.name.trim();
      if (trimmed.length < 1 || trimmed.length > 120) throw new Error('INVALID_NAME');
      patch.name = trimmed;
    }
    if (args.primaryColor !== undefined) patch.primaryColor = args.primaryColor;
    if (args.accentColor !== undefined) patch.accentColor = args.accentColor;
    if (args.logoStorageId !== undefined) patch.logoStorageId = args.logoStorageId;
    await ctx.db.patch(args.organizationId, patch);
    return { ok: true as const };
  },
});

export const myOrganization = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const membership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .first();
    if (!membership) return null;
    const org = await ctx.db.get(membership.organizationId);
    if (!org) return null;
    const logoUrl = org.logoStorageId ? await ctx.storage.getUrl(org.logoStorageId) : null;
    return {
      _id: org._id,
      name: org.name,
      slug: org.slug,
      primaryColor: org.primaryColor,
      accentColor: org.accentColor,
      logoUrl,
      stripeCustomerId: org.stripeCustomerId,
      subscriptionTier: org.subscriptionTier,
      subscriptionStatus: org.subscriptionStatus,
      subscriptionPeriodEnd: org.subscriptionPeriodEnd,
      myRole: membership.role,
    };
  },
});

export const getById = query({
  args: { organizationId: v.id('organizations'), requesterId: v.id('users') },
  handler: async (ctx, { organizationId, requesterId }) => {
    const membership = await assertCanRead(ctx, organizationId, requesterId);
    const org = await ctx.db.get(organizationId);
    if (!org) throw new Error('NOT_FOUND');
    const logoUrl = org.logoStorageId ? await ctx.storage.getUrl(org.logoStorageId) : null;
    return {
      _id: org._id,
      name: org.name,
      slug: org.slug,
      primaryColor: org.primaryColor,
      accentColor: org.accentColor,
      logoUrl,
      subscriptionTier: org.subscriptionTier,
      subscriptionStatus: org.subscriptionStatus,
      myRole: membership.role,
    };
  },
});

export const listEvents = query({
  args: { organizationId: v.id('organizations'), requesterId: v.id('users') },
  handler: async (ctx, { organizationId, requesterId }) => {
    await assertCanRead(ctx, organizationId, requesterId);
    const events = await ctx.db
      .query('events')
      .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
      .order('desc')
      .collect();
    return events.map((e) => ({
      _id: e._id,
      title: e.title,
      slug: e.slug,
      coupleNames: e.coupleNames,
      eventDate: e.eventDate,
      timezone: e.timezone,
      status: e.status,
      planTier: e.planTier,
      maxGuests: e.maxGuests,
      ownerId: e.ownerId,
    }));
  },
});

export const listMembers = query({
  args: { organizationId: v.id('organizations'), requesterId: v.id('users') },
  handler: async (ctx, { organizationId, requesterId }) => {
    await assertCanRead(ctx, organizationId, requesterId);
    const memberships = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
      .collect();
    return Promise.all(
      memberships.map(async (m) => {
        const user = m.userId ? await ctx.db.get(m.userId) : null;
        return {
          _id: m._id,
          role: m.role,
          status: m.status,
          fullName: user?.fullName,
          phone: user?.phone ?? m.invitedPhone,
          email: user?.email ?? m.invitedEmail,
          invitedAt: m.invitedAt,
          acceptedAt: m.acceptedAt,
        };
      }),
    );
  },
});

function generateInviteToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 20; i++) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return token;
}

export const invite = mutation({
  args: {
    organizationId: v.id('organizations'),
    requesterId: v.id('users'),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    role: ROLE,
  },
  handler: async (ctx, args) => {
    await assertCanManage(ctx, args.organizationId, args.requesterId);
    if (args.role === 'owner') throw new Error('CANNOT_ASSIGN_OWNER');
    if (!args.phone && !args.email) throw new Error('NO_CONTACT');

    let userId: Id<'users'> | undefined;
    if (args.phone) {
      const existing = await ctx.db
        .query('users')
        .withIndex('by_phone', (q) => q.eq('phone', args.phone!))
        .first();
      userId = existing?._id;
    }

    if (userId) {
      const dup = await getMembership(ctx, args.organizationId, userId);
      if (dup && dup.status !== 'revoked') throw new Error('ALREADY_MEMBER');
    }

    const token = generateInviteToken();
    const now = Date.now();
    const id = await ctx.db.insert('organizationMemberships', {
      organizationId: args.organizationId,
      userId,
      invitedPhone: args.phone,
      invitedEmail: args.email,
      role: args.role,
      status: 'pending',
      inviteToken: token,
      invitedBy: args.requesterId,
      invitedAt: now,
    });

    // Notify any existing org members that someone was invited (best effort).
    if (args.email) {
      const org = await ctx.db.get(args.organizationId);
      const inviter = await ctx.db.get(args.requesterId);
      if (org && inviter) {
        const inviteeName = args.email.split('@')[0] ?? 'collègue';
        const inviterLabel = inviter.fullName ?? inviter.phone ?? 'un membre';
        await ctx.scheduler.runAfter(0, internal.emailActions.sendProNotification, {
          to: args.email,
          recipientName: inviteeName,
          organizationName: org.name,
          kind: 'team-member-added' as const,
          detail: `${inviterLabel} vous invite à rejoindre ${org.name} sur Wedillybird.`,
          ctaLabel: 'Accepter l’invitation',
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://wedillybird.com'}/pro/invite/${token}`,
        });
      }
    }

    return { id, inviteToken: token };
  },
});

export const acceptInvite = mutation({
  args: { token: v.string(), userId: v.id('users') },
  handler: async (ctx, { token, userId }) => {
    const membership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_invite_token', (q) => q.eq('inviteToken', token))
      .first();
    if (!membership) throw new Error('INVITE_NOT_FOUND');
    if (membership.status !== 'pending') throw new Error('INVITE_ALREADY_USED');

    await ctx.db.patch(membership._id, {
      userId,
      status: 'active',
      acceptedAt: Date.now(),
      inviteToken: undefined,
    });
    return { ok: true as const, organizationId: membership.organizationId };
  },
});

export const revokeMembership = mutation({
  args: { membershipId: v.id('organizationMemberships'), requesterId: v.id('users') },
  handler: async (ctx, { membershipId, requesterId }) => {
    const m = await ctx.db.get(membershipId);
    if (!m) throw new Error('NOT_FOUND');
    await assertCanManage(ctx, m.organizationId, requesterId);
    if (m.role === 'owner') throw new Error('CANNOT_REVOKE_OWNER');
    await ctx.db.patch(membershipId, { status: 'revoked' });
    return { ok: true as const };
  },
});

export const updateSubscription = mutation({
  args: {
    organizationId: v.id('organizations'),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionTier: v.optional(
      v.union(v.literal('starter'), v.literal('business'), v.literal('agency')),
    ),
    subscriptionStatus: v.optional(
      v.union(
        v.literal('trialing'),
        v.literal('active'),
        v.literal('past_due'),
        v.literal('canceled'),
        v.literal('unpaid'),
      ),
    ),
    subscriptionPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organizationId, ...rest } = args;
    const patch: Partial<Doc<'organizations'>> = { updatedAt: Date.now() };
    if (rest.stripeCustomerId !== undefined) patch.stripeCustomerId = rest.stripeCustomerId;
    if (rest.stripeSubscriptionId !== undefined)
      patch.stripeSubscriptionId = rest.stripeSubscriptionId;
    if (rest.subscriptionTier !== undefined) patch.subscriptionTier = rest.subscriptionTier;
    if (rest.subscriptionStatus !== undefined) patch.subscriptionStatus = rest.subscriptionStatus;
    if (rest.subscriptionPeriodEnd !== undefined)
      patch.subscriptionPeriodEnd = rest.subscriptionPeriodEnd;
    await ctx.db.patch(organizationId, patch);
    return { ok: true as const };
  },
});

export const findByStripeSubscription = query({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, { stripeSubscriptionId }) => {
    return ctx.db
      .query('organizations')
      .withIndex('by_stripe_subscription', (q) =>
        q.eq('stripeSubscriptionId', stripeSubscriptionId),
      )
      .first();
  },
});

export const findByStripeCustomer = query({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, { stripeCustomerId }) => {
    return ctx.db
      .query('organizations')
      .withIndex('by_stripe_customer', (q) => q.eq('stripeCustomerId', stripeCustomerId))
      .first();
  },
});
