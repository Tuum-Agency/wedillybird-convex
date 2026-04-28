import { v } from 'convex/values';
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
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

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

function assertHexColor(value: string, field: string): void {
  if (!HEX_COLOR_RE.test(value.trim())) throw new Error(`INVALID_${field}`);
}

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
    if (args.primaryColor !== undefined) {
      assertHexColor(args.primaryColor, 'PRIMARY_COLOR');
      patch.primaryColor = args.primaryColor.trim();
    }
    if (args.accentColor !== undefined) {
      assertHexColor(args.accentColor, 'ACCENT_COLOR');
      patch.accentColor = args.accentColor.trim();
    }
    if (args.logoStorageId !== undefined) patch.logoStorageId = args.logoStorageId;
    await ctx.db.patch(args.organizationId, patch);
    return { ok: true as const };
  },
});

/**
 * Generates a single-use upload URL pointing at Convex storage. The client
 * POSTs the logo file directly to this URL (multipart) and gets back a
 * `{ storageId }` it then commits via `setLogo`.
 *
 * Permission : seuls les owners/admins de l'orga peuvent obtenir une URL
 * d'upload. On vérifie d'abord la membership avant d'allouer un slot storage,
 * pour éviter qu'un user authentifié sans droit obtienne une URL signée.
 */
export const generateLogoUploadUrl = mutation({
  args: {
    organizationId: v.id('organizations'),
    requesterId: v.id('users'),
  },
  handler: async (ctx, { organizationId, requesterId }) => {
    await assertCanManage(ctx, organizationId, requesterId);
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

/**
 * Commits a freshly uploaded logo : remplace `logoStorageId` et supprime
 * l'ancien blob si présent (économie de stockage). On ne touche pas aux
 * couleurs ici — le composant `BrandingForm` enchaîne logo + couleurs via
 * `updateBranding` quand l'utilisateur soumet.
 */
export const setLogo = mutation({
  args: {
    organizationId: v.id('organizations'),
    requesterId: v.id('users'),
    logoStorageId: v.id('_storage'),
  },
  handler: async (ctx, { organizationId, requesterId, logoStorageId }) => {
    await assertCanManage(ctx, organizationId, requesterId);
    const org = await ctx.db.get(organizationId);
    if (!org) throw new Error('NOT_FOUND');
    const previous = org.logoStorageId;
    await ctx.db.patch(organizationId, {
      logoStorageId,
      updatedAt: Date.now(),
    });
    if (previous && previous !== logoStorageId) {
      // Best-effort cleanup — si la suppression rate (storage déjà GC), on
      // continue sans bloquer.
      try {
        await ctx.storage.delete(previous);
      } catch {
        // ignore
      }
    }
    return { ok: true as const };
  },
});

/**
 * Supprime le logo courant (si présent) et nettoie le storage Convex
 * associé. Pratique pour permettre au pro de revenir à l'état "pas de logo
 * → mark Wedillybird".
 */
export const clearLogo = mutation({
  args: {
    organizationId: v.id('organizations'),
    requesterId: v.id('users'),
  },
  handler: async (ctx, { organizationId, requesterId }) => {
    await assertCanManage(ctx, organizationId, requesterId);
    const org = await ctx.db.get(organizationId);
    if (!org) throw new Error('NOT_FOUND');
    if (!org.logoStorageId) return { ok: true as const, alreadyEmpty: true };
    const previous = org.logoStorageId;
    await ctx.db.patch(organizationId, {
      logoStorageId: undefined,
      updatedAt: Date.now(),
    });
    try {
      await ctx.storage.delete(previous);
    } catch {
      // ignore
    }
    return { ok: true as const, alreadyEmpty: false };
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

/**
 * Lookup public d'une organisation par slug — utilisé par le layout
 * `(public-org)` côté Next pour appliquer le branding orga (logo,
 * primaryColor, accentColor) sur les pages servies sous le sous-domaine
 * `<slug>.wedillybird.com`.
 *
 * Aucune PII n'est exposée (pas de stripeCustomerId, pas de membership,
 * pas d'email/phone). On retourne uniquement ce qui est nécessaire pour
 * le rendu public d'une page d'événement ou d'invitation sous le
 * sous-domaine de l'orga.
 */
export const findBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const trimmed = slug.trim().toLowerCase();
    if (!trimmed) return null;
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', (q) => q.eq('slug', trimmed))
      .first();
    if (!org) return null;
    const logoUrl = org.logoStorageId ? await ctx.storage.getUrl(org.logoStorageId) : null;
    return {
      _id: org._id,
      name: org.name,
      slug: org.slug,
      primaryColor: org.primaryColor,
      accentColor: org.accentColor,
      logoUrl,
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

// Alphabet 32 caractères sans ambiguïtés visuelles (pas de I/O/0/1).
// 256 % 32 === 0 → pas de biais modulo, distribution uniforme.
const INVITE_TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVITE_TOKEN_LENGTH = 20;

/**
 * Génère un token d'invitation Pro cryptographiquement sûr. Il sert à valider
 * la mutation `acceptInvite` ; un token devinable permettrait à un attaquant
 * de rejoindre n'importe quelle organisation. `crypto.getRandomValues`
 * (disponible dans le runtime Convex) garantit une entropie non prédictible.
 */
function generateInviteToken(): string {
  const buffer = new Uint8Array(INVITE_TOKEN_LENGTH);
  crypto.getRandomValues(buffer);
  let token = '';
  for (const b of buffer) token += INVITE_TOKEN_ALPHABET[b % INVITE_TOKEN_ALPHABET.length];
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

/* -------------------------------------------------------------------------- */
/*  Subscription updates — fix sécurité F-01 (audit avril 2026)               */
/*                                                                            */
/*  Avant le fix, `updateSubscription` était une mutation publique sans       */
/*  aucun check d'authorization : tout user authentifié pouvait s'upgrader    */
/*  Agency `active` 10 ans gratuitement (IDOR, CVSS 8.8). On la transforme    */
/*  en `internalMutation` (donc inaccessible au client), et on expose deux    */
/*  points d'entrée publics ciblés :                                          */
/*    - `updateSubscriptionFromWebhook` : protégé par un secret partagé entre */
/*      la route Next /api/webhooks/[provider] et l'env Convex. La signature  */
/*      Stripe a déjà été vérifiée à la frontière API ; le secret partagé    */
/*      empêche un attaquant de bypass-er la route en tapant directement      */
/*      l'API Convex publique.                                                */
/*  Les call sites côté webhook ont été migrés vers ce wrapper.               */
/* -------------------------------------------------------------------------- */

const SUBSCRIPTION_TIER = v.optional(
  v.union(v.literal('starter'), v.literal('business'), v.literal('agency')),
);
const SUBSCRIPTION_STATUS = v.optional(
  v.union(
    v.literal('trialing'),
    v.literal('active'),
    v.literal('past_due'),
    v.literal('canceled'),
    v.literal('unpaid'),
  ),
);

type SubscriptionPatchInput = {
  organizationId: Id<'organizations'>;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionTier?: 'starter' | 'business' | 'agency';
  subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  subscriptionPeriodEnd?: number;
};

async function applySubscriptionPatch(
  ctx: MutationCtx,
  args: SubscriptionPatchInput,
): Promise<{ ok: true }> {
  const { organizationId, ...rest } = args;
  const before = await ctx.db.get(organizationId);
  const patch: Partial<Doc<'organizations'>> = { updatedAt: Date.now() };
  if (rest.stripeCustomerId !== undefined) patch.stripeCustomerId = rest.stripeCustomerId;
  if (rest.stripeSubscriptionId !== undefined)
    patch.stripeSubscriptionId = rest.stripeSubscriptionId;
  if (rest.subscriptionTier !== undefined) patch.subscriptionTier = rest.subscriptionTier;
  if (rest.subscriptionStatus !== undefined) patch.subscriptionStatus = rest.subscriptionStatus;
  if (rest.subscriptionPeriodEnd !== undefined)
    patch.subscriptionPeriodEnd = rest.subscriptionPeriodEnd;
  await ctx.db.patch(organizationId, patch);

  // Best-effort transition email to the org owner. Triggered once per
  // distinct transition: trialing → active (welcome), active → past_due
  // (alert), * → canceled (notice). Idempotent: only fires when the
  // status actually changed.
  if (before && rest.subscriptionStatus !== undefined) {
    const prevStatus = before.subscriptionStatus;
    const nextStatus = rest.subscriptionStatus;
    if (prevStatus !== nextStatus) {
      const owner = await ctx.db.get(before.ownerId);
      if (owner?.email) {
        let kind: 'subscription-renewed' | 'subscription-failed' | null = null;
        let detail = '';
        if ((prevStatus === 'trialing' || prevStatus === undefined) && nextStatus === 'active') {
          kind = 'subscription-renewed';
          detail = `Votre abonnement ${before.name} est désormais actif. Bienvenue !`;
        } else if (nextStatus === 'past_due') {
          kind = 'subscription-failed';
          detail = `Le paiement de votre abonnement ${before.name} a échoué. Mettez à jour votre moyen de paiement pour conserver l’accès.`;
        } else if (nextStatus === 'canceled') {
          kind = 'subscription-failed';
          detail = `Votre abonnement ${before.name} a été annulé. Vous pouvez le réactiver à tout moment depuis votre espace Pro.`;
        } else if (prevStatus === 'past_due' && nextStatus === 'active') {
          kind = 'subscription-renewed';
          detail = `Le paiement de votre abonnement ${before.name} a bien été reçu. Merci !`;
        }
        if (kind) {
          await ctx.scheduler.runAfter(0, internal.emailActions.sendProNotification, {
            to: owner.email,
            recipientName: owner.fullName ?? owner.phone ?? 'Bonjour',
            organizationName: before.name,
            kind,
            detail,
            ctaLabel: 'Gérer mon abonnement',
            ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://wedillybird.com'}/pro/billing`,
          });
        }
      }
    }
  }

  return { ok: true as const };
}

/**
 * Mutation interne — patche les champs de souscription d'une organisation.
 * Inaccessible directement depuis le client : la seule façon de la déclencher
 * est via le bridge `updateSubscriptionFromWebhook` (qui valide un secret
 * partagé) ou via une autre fonction Convex via `ctx.scheduler` / `runMutation`.
 */
export const updateSubscription = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionTier: SUBSCRIPTION_TIER,
    subscriptionStatus: SUBSCRIPTION_STATUS,
    subscriptionPeriodEnd: v.optional(v.number()),
  },
  handler: applySubscriptionPatch,
});

/**
 * Bridge public pour la route webhook Stripe (`app/api/webhooks/[provider]`).
 * Verrouillé par un secret partagé `CONVEX_WEBHOOK_SECRET`. Le secret doit
 * être posé à la fois dans l'env Vercel (côté Next) et dans l'env Convex.
 *
 * Cette mutation NE doit JAMAIS être appelée depuis du code client. La
 * vérification de signature Stripe se fait à la frontière API ; ce secret
 * partagé est une seconde ligne de défense (l'attaquant qui parle directement
 * à `*.convex.cloud` n'a pas le secret et est rejeté).
 *
 * Si `CONVEX_WEBHOOK_SECRET` n'est pas posé côté Convex, on rejette toutes
 * les requêtes — pas de fallback silencieux qui retomberait dans le bug F-01.
 */
export const updateSubscriptionFromWebhook = mutation({
  args: {
    webhookSecret: v.string(),
    organizationId: v.id('organizations'),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionTier: SUBSCRIPTION_TIER,
    subscriptionStatus: SUBSCRIPTION_STATUS,
    subscriptionPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, { webhookSecret, ...rest }) => {
    const expected = process.env.CONVEX_WEBHOOK_SECRET;
    if (!expected) throw new Error('WEBHOOK_SECRET_NOT_CONFIGURED');
    if (webhookSecret !== expected) throw new Error('INVALID_WEBHOOK_SECRET');
    return applySubscriptionPatch(ctx, rest);
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
