import { v } from 'convex/values';
import { internalQuery, mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { pickUniqueSlug } from './lib/uniqueSlug';
import { eventQuotaForTier, eventHasFeature, orgHasActiveAccess } from './lib/entitlements';
import { assertEventAccess } from './lib/eventAuth';
import { assertOrgWrite } from './lib/orgAuth';
import { normalizePhone, isValidE164 } from './lib/phone';
import { summarizeGuestRsvp } from './lib/guestStats';
import { sanitizeRsvpConfig } from '../lib/rsvp/questions';
import { notifyEventParties } from './lib/notify';

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

/**
 * Met à jour la configuration du formulaire RSVP (`events.rsvpConfig`) :
 * (dé)activation + renommage des champs built-in et questions custom typées.
 *
 * Accès : propriétaire OU collaborateur gestionnaire (couple rattaché / planner
 * d'agence). Feature **gated Premium/Pro** (`customRsvpQuestions`) — un event
 * Essentiel ou non payé est refusé (`FEATURE_LOCKED`). Les entrées sont
 * nettoyées via `sanitizeRsvpConfig` (labels clampés, options dédoublonnées,
 * questions plafonnées, ids jamais fabriqués).
 */
export const updateRsvpConfig = mutation({
  args: {
    eventId: v.id('events'),
    requesterId: v.id('users'),
    config: v.object({
      askDietary: v.optional(v.boolean()),
      dietaryLabel: v.optional(v.string()),
      askNotes: v.optional(v.boolean()),
      notesLabel: v.optional(v.string()),
      askPlusOnes: v.optional(v.boolean()),
      coupleCanEdit: v.optional(v.boolean()),
      customQuestions: v.optional(
        v.array(
          v.object({
            id: v.string(),
            type: v.union(
              v.literal('short_text'),
              v.literal('long_text'),
              v.literal('single_choice'),
              v.literal('multi_choice'),
              v.literal('boolean'),
            ),
            label: v.string(),
            options: v.optional(v.array(v.string())),
            required: v.optional(v.boolean()),
            onlyIfAttending: v.optional(v.boolean()),
          }),
        ),
      ),
    }),
  },
  handler: async (ctx, args) => {
    const event = await assertEventAccess(ctx, args.eventId, args.requesterId, { write: true });
    if (!eventHasFeature(event, 'customRsvpQuestions')) throw new Error('FEATURE_LOCKED');

    const previous = event.rsvpConfig;
    const isOwner = event.ownerId === args.requesterId;

    // Le couple rattaché (collaborateur rôle `couple`) ne peut modifier le
    // questionnaire que si l'agence l'y a autorisé. Le personnel d'agence
    // (co_owner / planner) et le propriétaire ne sont pas concernés par ce gate.
    let isDelegateCouple = false;
    if (!isOwner) {
      const collab = await ctx.db
        .query('eventCollaborators')
        .withIndex('by_event_user', (q) =>
          q.eq('eventId', args.eventId).eq('userId', args.requesterId),
        )
        .first();
      isDelegateCouple = collab?.role === 'couple';
    }
    if (isDelegateCouple && previous?.coupleCanEdit !== true) throw new Error('FORBIDDEN');

    // Seul le propriétaire (l'agence) contrôle la délégation ; les autres
    // conservent la valeur existante.
    const coupleCanEdit = isOwner
      ? (args.config.coupleCanEdit ?? previous?.coupleCanEdit ?? false)
      : (previous?.coupleCanEdit ?? false);

    const clean = sanitizeRsvpConfig(args.config);
    await ctx.db.patch(args.eventId, {
      rsvpConfig: {
        askDietary: clean.askDietary ?? true,
        askNotes: clean.askNotes ?? true,
        askPlusOnes: clean.askPlusOnes ?? true,
        coupleCanEdit,
        customQuestions: clean.customQuestions ?? [],
        ...(clean.dietaryLabel ? { dietaryLabel: clean.dietaryLabel } : {}),
        ...(clean.notesLabel ? { notesLabel: clean.notesLabel } : {}),
      },
      updatedAt: Date.now(),
    });

    // Le couple a modifié le questionnaire d'un event d'agence → prévenir l'agence.
    if (isDelegateCouple && event.organizationId) {
      const actor = await ctx.db.get(args.requesterId);
      await notifyEventParties(ctx, {
        eventId: args.eventId,
        type: 'rsvp_config_changed',
        data: actor?.fullName ? { actorName: actor.fullName } : undefined,
        excludeUserId: args.requesterId,
        includeCouple: false,
      });
    }

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
    organizationId: v.optional(v.id('organizations')),
  },
  handler: async (ctx, args) => {
    const owner = await ctx.db.get(args.ownerId);
    if (!owner) throw new Error('OWNER_NOT_FOUND');

    // Garde-fou agence : un mariage rattaché à une organisation exige que (a) le
    // demandeur soit un membre habilité de l'orga et (b) l'orga ait **choisi un
    // forfait** (abonnement actif/essai ou crédit Pay-as-you-go). Sans forfait,
    // la création est refusée — une agence fraîchement onboardée doit d'abord
    // s'abonner. Miroir du publish gate ; le parcours couple (sans orga) n'est
    // pas concerné.
    if (args.organizationId) {
      await assertOrgWrite(ctx, args.organizationId, args.ownerId);
      const org = await ctx.db.get(args.organizationId);
      if (!orgHasActiveAccess(org)) throw new Error('SUBSCRIPTION_REQUIRED');
    }

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
    const slug = await pickUniqueSlug(ctx, 'events', 'by_slug', 'slug', base);

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
      ...(args.organizationId ? { organizationId: args.organizationId } : {}),
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
      // Ni propriétaire ni collaborateur → renvoyer `null` (et non un throw
      // FORBIDDEN) : les pages font `if (!event) notFound()` → 404 propre au
      // lieu d'un 500 non géré. Bonus sécurité : ne révèle pas à un tiers
      // l'existence de l'event (pas de distinction not-found / forbidden).
      if (!collab) return null;
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
    subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
    paygCredits?: number;
  } | null;
  /**
   * Quota d'events actifs simultanés du tier Pro (5/20/50 ; `null`/absent =
   * aucun quota appliqué). Optionnel pour rétro-compat : un appelant qui ne le
   * passe pas ne déclenche aucun check de quota.
   */
  activeEventsQuota?: number | null;
  /** Nb d'events déjà `active` pour l'orga, hors celui en cours de publication. */
  activeEventCount?: number;
};

export type PaygPublishGateDecision =
  | { ok: true; consumeCredit: false }
  | { ok: true; consumeCredit: true; nextCredits: number }
  | { ok: false; error: 'PLAN_REQUIRED' | 'PAYG_CREDIT_REQUIRED' | 'EVENT_QUOTA_EXCEEDED' };

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
    // Quota d'events actifs simultanés : si l'orga est déjà à son quota de
    // tier, on bloque (l'event simultané supplémentaire est un upsell payant,
    // pas inclus). Skip si quota/compte non fournis (rétro-compat).
    if (
      input.activeEventsQuota != null &&
      input.activeEventCount != null &&
      input.activeEventCount >= input.activeEventsQuota
    ) {
      return { ok: false as const, error: 'EVENT_QUOTA_EXCEEDED' as const };
    }
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

    const orgId = ev.organizationId;
    const org = orgId ? await ctx.db.get(orgId) : null;

    // Quota d'events actifs simultanés (Pro avec sub active) : on compte les
    // events `active` de l'orga hors celui en cours de publication.
    let activeEventsQuota: number | null | undefined;
    let activeEventCount: number | undefined;
    if (orgId && org) {
      activeEventsQuota = eventQuotaForTier(org.subscriptionTier);
      if (activeEventsQuota != null) {
        const orgEvents = await ctx.db
          .query('events')
          .withIndex('by_organization', (q) => q.eq('organizationId', orgId))
          .collect();
        activeEventCount = orgEvents.filter(
          (e) => e.status === 'active' && e._id !== eventId,
        ).length;
      }
    }

    const decision = decidePublishGate({
      event: { planTier: ev.planTier, organizationId: ev.organizationId },
      organization: org
        ? { subscriptionStatus: org.subscriptionStatus, paygCredits: org.paygCredits }
        : null,
      activeEventsQuota,
      activeEventCount,
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
 * Renseigne l'UI sur l'état du quota d'events actifs simultanés d'une orga Pro,
 * pour pré-désactiver le bouton « Publier » et afficher un hint clair plutôt
 * que de laisser la mutation `publishEvent` throw EVENT_QUOTA_EXCEEDED en
 * silence (le form action ne remonte pas l'erreur).
 *
 * `applicable: false` quand le quota ne s'applique pas (event non-pro, orga
 * sans sub active — le PAYG paie à l'event, pas de quota — ou tier sans cap).
 * Le compte exclut l'event courant (celui qu'on s'apprête à publier).
 */
export const orgPublishQuotaStatus = query({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    const event = await ctx.db.get(eventId);
    if (!event || !event.organizationId) return { applicable: false as const };
    const orgId = event.organizationId;

    const membership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) => q.eq('organizationId', orgId).eq('userId', requesterId))
      .first();
    if (!membership || membership.status !== 'active') return { applicable: false as const };

    const org = await ctx.db.get(orgId);
    if (!org) return { applicable: false as const };
    const hasActiveSub =
      org.subscriptionStatus === 'active' || org.subscriptionStatus === 'trialing';
    if (!hasActiveSub) return { applicable: false as const };

    const quota = eventQuotaForTier(org.subscriptionTier);
    if (quota == null) return { applicable: false as const };

    const orgEvents = await ctx.db
      .query('events')
      .withIndex('by_organization', (q) => q.eq('organizationId', orgId))
      .collect();
    const activeEventCount = orgEvents.filter(
      (e) => e.status === 'active' && e._id !== eventId,
    ).length;

    return {
      applicable: true as const,
      quota,
      activeEventCount,
      atQuota: activeEventCount >= quota,
    };
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
 * Lookup public d'un event qui appartient à une organisation donnée et qui
 * est `status: 'active'`. Sert la page d'événement publique sous le
 * sous-domaine `<slug>.wedillybird.com/event/<eventSlug>`.
 *
 * Le slug d'event est globalement unique (index `by_slug`) mais on filtre
 * en plus sur l'organizationId pour empêcher qu'un sous-domaine d'orga A
 * affiche un event de l'orga B (même si l'attaquant connaît le slug).
 *
 * On retourne uniquement le shape "public" (pas d'ownerId, pas de
 * planTier, pas de messagingConfig) — la page publique n'a pas à les
 * exposer.
 */
export const findPublicEventBySlug = query({
  args: {
    orgSlug: v.string(),
    eventSlug: v.string(),
  },
  handler: async (ctx, { orgSlug, eventSlug }) => {
    const slug = eventSlug.trim();
    const orgSlugTrim = orgSlug.trim().toLowerCase();
    if (!slug || !orgSlugTrim) return null;

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', (q) => q.eq('slug', orgSlugTrim))
      .first();
    if (!org) return null;

    const ev = await ctx.db
      .query('events')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .first();
    if (!ev) return null;
    if (ev.organizationId !== org._id) return null;
    if (ev.status !== 'active') return null;

    return {
      _id: ev._id,
      slug: ev.slug,
      title: ev.title,
      coupleNames: ev.coupleNames,
      eventDate: ev.eventDate,
      timezone: ev.timezone,
      venue: ev.venue,
      theme: ev.theme,
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

/* ============================ ESPACE COUPLE (mariages d'agence) ============================ */

/**
 * Rattache un couple à un mariage créé par l'agence : retrouve (ou crée) l'user par
 * téléphone et l'ajoute en collaborateur rôle `couple`. Le couple accède ensuite à
 * son espace en se connectant avec ce numéro (OTP réutilise l'user par téléphone,
 * cf. auth.verifyOtp). Réservé à l'agence propriétaire du mariage (org-write).
 */
export const linkCouple = mutation({
  args: { eventId: v.id('events'), requesterId: v.id('users'), phone: v.string() },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error('EVENT_NOT_FOUND');
    if (!event.organizationId) throw new Error('NOT_AN_ORG_EVENT');
    await assertOrgWrite(ctx, event.organizationId, args.requesterId);

    const normalized = normalizePhone(args.phone);
    if (!normalized || !isValidE164(normalized)) throw new Error('INVALID_PHONE');

    const now = Date.now();
    let user = await ctx.db
      .query('users')
      .withIndex('by_phone', (q) => q.eq('phone', normalized))
      .first();
    if (!user) {
      const userId = await ctx.db.insert('users', {
        phone: normalized,
        locale: 'fr',
        role: 'couple',
        createdAt: now,
        lastSeenAt: now,
      });
      user = await ctx.db.get(userId);
    }
    if (!user) throw new Error('USER_CREATE_FAILED');

    const existing = await ctx.db
      .query('eventCollaborators')
      .withIndex('by_event_user', (q) => q.eq('eventId', args.eventId).eq('userId', user!._id))
      .first();
    if (existing) {
      if (existing.role !== 'couple') await ctx.db.patch(existing._id, { role: 'couple' });
      return { ok: true as const, userId: user._id, alreadyLinked: true };
    }
    await ctx.db.insert('eventCollaborators', {
      eventId: args.eventId,
      userId: user._id,
      role: 'couple',
      invitedBy: args.requesterId,
      invitedAt: now,
      acceptedAt: now,
    });
    return { ok: true as const, userId: user._id, alreadyLinked: false };
  },
});

/** Détache le couple d'un mariage (retire les collaborateurs rôle `couple`). Org-write. */
export const unlinkCouple = mutation({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error('EVENT_NOT_FOUND');
    if (!event.organizationId) throw new Error('NOT_AN_ORG_EVENT');
    await assertOrgWrite(ctx, event.organizationId, requesterId);
    const collabs = await ctx.db
      .query('eventCollaborators')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    for (const c of collabs.filter((c) => c.role === 'couple')) await ctx.db.delete(c._id);
    return { ok: true as const };
  },
});

/** Le ou les couples rattachés à un mariage (affichage agence). Org-read implicite via owner. */
export const coupleLinks = query({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    const event = await ctx.db.get(eventId);
    if (!event || !event.organizationId) return [];
    await assertOrgWrite(ctx, event.organizationId, requesterId);
    const collabs = await ctx.db
      .query('eventCollaborators')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    const couples = collabs.filter((c) => c.role === 'couple');
    const rows = await Promise.all(
      couples.map(async (c) => {
        const u = await ctx.db.get(c.userId);
        return u ? { userId: u._id, phone: u.phone, invitedAt: c.invitedAt } : null;
      }),
    );
    return rows.filter((r): r is { userId: Id<'users'>; phone: string; invitedAt: number } => !!r);
  },
});

/**
 * Vue « espace couple » d'un mariage : infos couple-safe (date, lieu, statut) + stats
 * invités/RSVP. Propriétaire OU collaborateur (donc le couple rattaché). N'expose
 * PAS le budget ni les marges de l'agence.
 */
export const coupleOverview = query({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    const event = await assertEventAccess(ctx, eventId, requesterId);
    const guests = await ctx.db
      .query('guests')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .collect();
    return {
      _id: event._id,
      title: event.title,
      coupleNames: event.coupleNames,
      eventDate: event.eventDate,
      timezone: event.timezone,
      venue: event.venue ?? null,
      status: event.status,
      guestStats: summarizeGuestRsvp(guests),
    };
  },
});

/** Mariages où l'user est rattaché comme `couple` — entrée de l'espace couple. */
export const listMineAsCouple = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const collabs = await ctx.db
      .query('eventCollaborators')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const events = await Promise.all(
      collabs.filter((c) => c.role === 'couple').map((c) => ctx.db.get(c.eventId)),
    );
    return events
      .filter((e): e is Doc<'events'> => e !== null)
      .map((e) => ({
        _id: e._id,
        title: e.title,
        coupleNames: e.coupleNames,
        eventDate: e.eventDate,
        venue: e.venue ?? null,
        status: e.status,
      }));
  },
});
