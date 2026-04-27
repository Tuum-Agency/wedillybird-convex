import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
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
    templateStyle: v.union(
      v.literal('classic'),
      v.literal('warm'),
      v.literal('african'),
      v.literal('minimal'),
    ),
    personalMessage: v.optional(v.string()),
    preferredChannel: v.union(v.literal('whatsapp'), v.literal('email'), v.literal('both')),
  },
  handler: async (ctx, args) => {
    const ev = await ctx.db.get(args.eventId);
    if (!ev) throw new Error('EVENT_NOT_FOUND');
    if (ev.ownerId !== args.requesterId) throw new Error('FORBIDDEN');

    const personalMessage = args.personalMessage?.trim() ?? '';
    if (personalMessage.length > 60) throw new Error('PERSONAL_MESSAGE_TOO_LONG');

    await ctx.db.patch(args.eventId, {
      messagingConfig: {
        templateStyle: args.templateStyle,
        ...(personalMessage ? { personalMessage } : {}),
        preferredChannel: args.preferredChannel,
      },
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

export type EventListItem = {
  _id: Id<'events'>;
  slug: string;
  title: string;
  coupleNames: { partnerA: string; partnerB: string };
  eventDate: number;
  timezone: string;
  status: 'draft' | 'active' | 'archived' | 'cancelled';
  planTier?: 'essential' | 'premium';
  paidAt?: number;
  galleryExpiresAt?: number;
  maxGuests: number;
  venue?: { name: string; address: string; lat?: number; lng?: number };
  updatedAt: number;
};
