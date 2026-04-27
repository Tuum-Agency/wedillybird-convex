import { v } from 'convex/values';
import { internalQuery, mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';

const SLUG_MAX_ATTEMPTS = 10;

function toSlugBase(partnerA: string, partnerB: string): string {
  const raw = `${partnerA}-${partnerB}`
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return raw || 'event';
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

async function pickUniqueSlug(
  ctx: { db: { query: (table: 'events') => unknown } },
  base: string,
): Promise<string> {
  for (let i = 0; i < SLUG_MAX_ATTEMPTS; i++) {
    const candidate = i === 0 ? base : `${base}-${randomSuffix()}`;
    const existing = await (
      ctx.db as unknown as {
        query: (t: 'events') => {
          withIndex: (
            i: 'by_slug',
            fn: (q: { eq: (k: 'slug', v: string) => unknown }) => unknown,
          ) => { first: () => Promise<Doc<'events'> | null> };
        };
      }
    )
      .query('events')
      .withIndex('by_slug', (q) => q.eq('slug', candidate))
      .first();
    if (!existing) return candidate;
  }
  throw new Error('SLUG_GENERATION_FAILED');
}

// Anti-abuse cap, uniform across plans (B2C is now feature-based, not capacity-based).
const ANTI_ABUSE_GUEST_CAP = 5000;

export const reconcileMaxGuests = mutation({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    const ev = await ctx.db.get(eventId);
    if (!ev) throw new Error('EVENT_NOT_FOUND');
    if (ev.ownerId !== requesterId) throw new Error('FORBIDDEN');
    if (ev.maxGuests === ANTI_ABUSE_GUEST_CAP) return { ok: true as const, changed: false };
    await ctx.db.patch(eventId, { maxGuests: ANTI_ABUSE_GUEST_CAP, updatedAt: Date.now() });
    return {
      ok: true as const,
      changed: true,
      planTier: ev.planTier,
      maxGuests: ANTI_ABUSE_GUEST_CAP,
    };
  },
});

export const update = mutation({
  args: {
    eventId: v.id('events'),
    requesterId: v.id('users'),
    title: v.optional(v.string()),
    partnerA: v.optional(v.string()),
    partnerB: v.optional(v.string()),
    eventDate: v.optional(v.number()),
    timezone: v.optional(v.string()),
    venue: v.optional(
      v.object({
        name: v.string(),
        address: v.string(),
      }),
    ),
    clearVenue: v.optional(v.boolean()),
    theme: v.optional(
      v.object({
        primaryColor: v.string(),
        accentColor: v.string(),
        fontFamily: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const ev = await ctx.db.get(args.eventId);
    if (!ev) throw new Error('EVENT_NOT_FOUND');
    if (ev.ownerId !== args.requesterId) throw new Error('FORBIDDEN');

    const patch: Partial<Doc<'events'>> = {};

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (title.length < 2 || title.length > 120) throw new Error('INVALID_TITLE');
      patch.title = title;
    }

    if (args.partnerA !== undefined || args.partnerB !== undefined) {
      const partnerA = (args.partnerA ?? ev.coupleNames.partnerA).trim();
      const partnerB = (args.partnerB ?? ev.coupleNames.partnerB).trim();
      if (partnerA.length < 1 || partnerB.length < 1) throw new Error('INVALID_COUPLE_NAMES');
      patch.coupleNames = { partnerA, partnerB };
    }

    if (args.eventDate !== undefined) {
      if (!Number.isFinite(args.eventDate) || args.eventDate <= Date.now()) {
        throw new Error('INVALID_DATE');
      }
      patch.eventDate = args.eventDate;
    }

    if (args.timezone !== undefined) {
      if (args.timezone.length === 0) throw new Error('INVALID_TIMEZONE');
      patch.timezone = args.timezone;
    }

    if (args.clearVenue) {
      patch.venue = undefined;
    } else if (args.venue) {
      patch.venue = {
        name: args.venue.name.trim(),
        address: args.venue.address.trim(),
      };
    }

    if (args.theme) {
      patch.theme = args.theme;
    }

    patch.updatedAt = Date.now();
    await ctx.db.patch(args.eventId, patch);
    return { ok: true as const };
  },
});

/**
 * Met à jour la config messaging d'un événement (style template, mot perso,
 * canal préféré). Owner-only. Permet au couple de personnaliser comment
 * l'invitation arrive aux guests.
 */
export const updateMessagingConfig = mutation({
  args: {
    eventId: v.id('events'),
    requesterId: v.id('users'),
    templateStyle: v.optional(
      v.union(
        v.literal('classic'),
        v.literal('warm'),
        v.literal('african'),
        v.literal('minimal'),
        v.literal('festive'),
      ),
    ),
    personalMessage: v.optional(v.string()),
    preferredChannel: v.optional(
      v.union(v.literal('whatsapp'), v.literal('email'), v.literal('both')),
    ),
    customTemplateId: v.optional(v.id('whatsappTemplates')),
    clearCustomTemplate: v.optional(v.boolean()),
    templateNotifyChannel: v.optional(
      v.union(v.literal('whatsapp'), v.literal('email'), v.literal('both')),
    ),
  },
  handler: async (ctx, args) => {
    const ev = await ctx.db.get(args.eventId);
    if (!ev) throw new Error('EVENT_NOT_FOUND');
    if (ev.ownerId !== args.requesterId) throw new Error('FORBIDDEN');

    const personalMessage = args.personalMessage?.trim() ?? undefined;
    if (personalMessage !== undefined && personalMessage.length > 60) {
      throw new Error('PERSONAL_MESSAGE_TOO_LONG');
    }

    const previous = ev.messagingConfig;
    const next = {
      templateStyle: args.templateStyle ?? previous?.templateStyle ?? ('warm' as const),
      preferredChannel:
        args.preferredChannel ?? previous?.preferredChannel ?? ('whatsapp' as const),
      ...(personalMessage
        ? { personalMessage }
        : args.personalMessage === undefined && previous?.personalMessage
          ? { personalMessage: previous.personalMessage }
          : {}),
      ...(args.clearCustomTemplate
        ? {}
        : args.customTemplateId !== undefined
          ? { customTemplateId: args.customTemplateId }
          : previous?.customTemplateId
            ? { customTemplateId: previous.customTemplateId }
            : {}),
      ...(args.templateNotifyChannel !== undefined
        ? { templateNotifyChannel: args.templateNotifyChannel }
        : previous?.templateNotifyChannel
          ? { templateNotifyChannel: previous.templateNotifyChannel }
          : {}),
    };

    await ctx.db.patch(args.eventId, {
      messagingConfig: next,
      updatedAt: Date.now(),
    });

    return { ok: true as const };
  },
});

export const create = mutation({
  args: {
    ownerId: v.id('users'),
    title: v.string(),
    partnerA: v.string(),
    partnerB: v.string(),
    eventDate: v.number(),
    timezone: v.string(),
    venue: v.optional(
      v.object({
        name: v.string(),
        address: v.string(),
      }),
    ),
    theme: v.optional(
      v.object({
        primaryColor: v.string(),
        accentColor: v.string(),
        fontFamily: v.string(),
      }),
    ),
    /**
     * Plan envisagé par le couple lors de la création (étape "Choisir votre
     * forfait" du wizard). Devient le `planTier` officiel après paiement
     * réussi via Stripe Checkout.
     */
    pendingPlanTier: v.optional(v.union(v.literal('essential'), v.literal('premium'))),
  },
  handler: async (ctx, args) => {
    const owner = await ctx.db.get(args.ownerId);
    if (!owner) throw new Error('OWNER_NOT_FOUND');

    const title = args.title.trim();
    const partnerA = args.partnerA.trim();
    const partnerB = args.partnerB.trim();
    if (title.length < 2 || title.length > 120) throw new Error('INVALID_TITLE');
    if (partnerA.length < 1 || partnerB.length < 1) throw new Error('INVALID_COUPLE_NAMES');
    if (args.timezone.length === 0) throw new Error('INVALID_TIMEZONE');
    if (!Number.isFinite(args.eventDate) || args.eventDate <= Date.now()) {
      throw new Error('INVALID_DATE');
    }

    const base = toSlugBase(partnerA, partnerB);
    const slug = await pickUniqueSlug(ctx, base);

    const now = Date.now();
    const id = await ctx.db.insert('events', {
      ownerId: args.ownerId,
      slug,
      title,
      coupleNames: { partnerA, partnerB },
      eventDate: args.eventDate,
      timezone: args.timezone,
      ...(args.venue
        ? { venue: { name: args.venue.name.trim(), address: args.venue.address.trim() } }
        : {}),
      ...(args.theme ? { theme: args.theme } : {}),
      status: 'draft' as const,
      // planTier left undefined until the owner pays (Essentiel or Premium).
      ...(args.pendingPlanTier ? { pendingPlanTier: args.pendingPlanTier } : {}),
      maxGuests: ANTI_ABUSE_GUEST_CAP,
      createdAt: now,
      updatedAt: now,
    });

    return { id, slug };
  },
});

export const listByOwner = query({
  args: { ownerId: v.id('users') },
  handler: async (ctx, { ownerId }) => {
    const rows = await ctx.db
      .query('events')
      .withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
      .order('desc')
      .collect();
    return rows.map((e) => ({
      _id: e._id,
      slug: e.slug,
      title: e.title,
      coupleNames: e.coupleNames,
      eventDate: e.eventDate,
      timezone: e.timezone,
      status: e.status,
      planTier: e.planTier,
      pendingPlanTier: e.pendingPlanTier,
      maxGuests: e.maxGuests,
      venue: e.venue,
      updatedAt: e.updatedAt,
    }));
  },
});

export const getById = query({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    const ev = await ctx.db.get(eventId);
    if (!ev) return null;
    if (ev.ownerId !== requesterId) {
      const collab = await ctx.db
        .query('eventCollaborators')
        .withIndex('by_event_user', (q) => q.eq('eventId', eventId).eq('userId', requesterId))
        .first();
      if (!collab) throw new Error('FORBIDDEN');
    }
    return ev;
  },
});

/**
 * Décide si un event peut être publié et, le cas échéant, ce qu'il faut
 * patcher côté orga (consommation d'un crédit Pay-as-you-go). Fonction pure
 * extraite pour être testable sans environnement Convex.
 *
 * Trois cas valides :
 *  1. Particulier payé (`planTier !== undefined`) → publish OK, rien à faire
 *     côté orga.
 *  2. Pro avec subscription `active`/`trialing` → publish OK, pas de
 *     consommation de crédit (la sub couvre).
 *  3. Pro sans sub mais `paygCredits > 0` → publish OK, consomme 1 crédit
 *     atomiquement.
 *
 * Cas refusés :
 *  - Particulier sans plan ET sans orga → PLAN_REQUIRED.
 *  - Pro sans sub ET sans crédit → PAYG_CREDIT_REQUIRED.
 */
export type PaygPublishGateInput = {
  event: {
    planTier?: 'essential' | 'premium';
    organizationId?: Id<'organizations'>;
  };
  organization: {
    subscriptionStatus?:
      | 'trialing'
      | 'active'
      | 'past_due'
      | 'canceled'
      | 'unpaid';
    paygCredits?: number;
  } | null;
};

export type PaygPublishGateDecision =
  | { ok: true; consumeCredit: false }
  | { ok: true; consumeCredit: true; nextCredits: number }
  | { ok: false; error: 'PLAN_REQUIRED' | 'PAYG_CREDIT_REQUIRED' };

export function decidePublishGate(input: PaygPublishGateInput): PaygPublishGateDecision {
  const { event, organization } = input;
  // Particulier déjà payé : pas besoin de toucher l'orga.
  if (event.planTier !== undefined) {
    return { ok: true as const, consumeCredit: false as const };
  }
  // Particulier sans plan ET sans organisation → bloqué.
  if (!event.organizationId) {
    return { ok: false as const, error: 'PLAN_REQUIRED' as const };
  }
  // Pro : check subscription active OU PAYG credit.
  const status = organization?.subscriptionStatus;
  const hasActiveSub = status === 'active' || status === 'trialing';
  if (hasActiveSub) {
    return { ok: true as const, consumeCredit: false as const };
  }
  const credits = organization?.paygCredits ?? 0;
  if (credits <= 0) {
    return { ok: false as const, error: 'PAYG_CREDIT_REQUIRED' as const };
  }
  return {
    ok: true as const,
    consumeCredit: true as const,
    nextCredits: credits - 1,
  };
}

/**
 * Bascule un event en `active` (publié). Owner-only. Le payment-gating
 * (= refus de publier si pas de plan particulier ET orga sans sub ni crédit
 * PAYG) est appliqué ici car c'est le seul point d'entrée serveur. L'UI le
 * double côté client en désactivant le bouton, mais la mutation DOIT le
 * rejeter aussi pour sécuriser le funnel.
 *
 * Cas pro PAYG : consomme atomiquement 1 crédit `paygCredits` sur l'orga
 * avant de basculer le statut. Si l'orga a une subscription active, le
 * crédit n'est pas touché.
 */
export const publish = mutation({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    const ev = await ctx.db.get(eventId);
    if (!ev) throw new Error('EVENT_NOT_FOUND');
    if (ev.ownerId !== requesterId) throw new Error('FORBIDDEN');

    const org = ev.organizationId ? await ctx.db.get(ev.organizationId) : null;
    const decision = decidePublishGate({
      event: { planTier: ev.planTier, organizationId: ev.organizationId },
      organization: org
        ? { subscriptionStatus: org.subscriptionStatus, paygCredits: org.paygCredits }
        : null,
    });
    if (!decision.ok) {
      throw new Error(decision.error);
    }

    const now = Date.now();
    if (decision.consumeCredit && ev.organizationId) {
      await ctx.db.patch(ev.organizationId, {
        paygCredits: decision.nextCredits,
        updatedAt: now,
      });
    }
    await ctx.db.patch(eventId, { status: 'active' as const, updatedAt: now });
    return { ok: true as const, status: 'active' as const };
  },
});

/**
 * Archive un event (soft delete). Owner-only. Bascule le status à `archived`
 * et déclenche le cleanup AWS associé (Face Collection Rekognition + rows
 * `photoFaces` côté DB). Pas de hard-delete des `events` ni des `photos` :
 * la rétention métier (factures, RGPD) doit pouvoir s'appuyer dessus.
 *
 * Idempotent : si l'event est déjà `archived`, retourne `{ alreadyArchived:
 * true }` sans rien faire.
 */
export const archive = mutation({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    const ev = await ctx.db.get(eventId);
    if (!ev) throw new Error('EVENT_NOT_FOUND');
    if (ev.ownerId !== requesterId) throw new Error('FORBIDDEN');
    if (ev.status === 'archived') {
      return { ok: true as const, alreadyArchived: true as const };
    }

    const collectionId = ev.faceCollectionId;
    const now = Date.now();

    // Cleanup DB : supprime les rows `photoFaces` de l'event. Le
    // `DeleteCollection` Rekognition libère côté AWS, mais on veut aussi
    // les rows DB nettoyées pour ne pas laisser de pointers orphelins.
    const photoFaceRows = await ctx.db
      .query('photoFaces')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    for (const row of photoFaceRows) {
      await ctx.db.delete(row._id);
    }

    // Cleanup AWS : delete la Face Collection en best-effort.
    if (collectionId) {
      await ctx.scheduler.runAfter(0, internal.photosFaceSearch.deleteFaceCollection, {
        collectionId,
      });
    }

    await ctx.db.patch(eventId, {
      status: 'archived' as const,
      faceCollectionId: undefined,
      updatedAt: now,
    });
    return { ok: true as const, alreadyArchived: false as const };
  },
});

export const unpublish = mutation({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    const ev = await ctx.db.get(eventId);
    if (!ev) throw new Error('EVENT_NOT_FOUND');
    if (ev.ownerId !== requesterId) throw new Error('FORBIDDEN');
    await ctx.db.patch(eventId, { status: 'draft' as const, updatedAt: Date.now() });
    return { ok: true as const, status: 'draft' as const };
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const ev = await ctx.db
      .query('events')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .first();
    if (!ev) return null;
    return {
      _id: ev._id,
      slug: ev.slug,
      title: ev.title,
      coupleNames: ev.coupleNames,
      eventDate: ev.eventDate,
      timezone: ev.timezone,
      venue: ev.venue,
      theme: ev.theme,
      status: ev.status,
      maxGuests: ev.maxGuests,
    };
  },
});

/**
 * Récupère un event vérifié pour ownership + sa messagingConfig — utilisé
 * par les actions Convex (broadcast invitations, rappels) qui doivent
 * accéder à la DB depuis un contexte sans mutation. Owner-only.
 */
export const _getForBroadcast = internalQuery({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    const ev = await ctx.db.get(eventId);
    if (!ev) return null;
    if (ev.ownerId !== requesterId) return null;
    return {
      _id: ev._id,
      title: ev.title,
      coupleNames: ev.coupleNames,
      eventDate: ev.eventDate,
      timezone: ev.timezone,
      status: ev.status,
      messagingConfig: ev.messagingConfig,
    };
  },
});

export type EventListItem = {
  _id: Id<'events'>;
  slug: string;
  title: string;
  coupleNames: { partnerA: string; partnerB: string };
  eventDate: number;
  timezone: string;
  status: 'draft' | 'active' | 'archived' | 'cancelled';
  planTier?: 'essential' | 'premium';
  pendingPlanTier?: 'essential' | 'premium';
  paidAt?: number;
  galleryExpiresAt?: number;
  maxGuests: number;
  venue?: { name: string; address: string; lat?: number; lng?: number };
  updatedAt: number;
};
