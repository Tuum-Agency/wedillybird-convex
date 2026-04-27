/**
 * Templates WhatsApp custom — module Convex.
 *
 * Le couple Premium peut écrire son propre template ; on le soumet à
 * Meta Cloud API et on track son cycle de vie (`pending` → `approved` /
 * `rejected`). Webhook `app/api/webhooks/whatsapp/route.ts` met à jour le
 * status quand Meta renvoie un `message_template_status_update`.
 *
 * Polling fallback (`pollPendingStatuses`) appelé par cron toutes les 30
 * min pour les templates dont le webhook n'aurait pas remonté.
 */

import { v } from 'convex/values';
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

// Meta : nom de template = 1-512 chars, lowercase alphanumeric + underscore.
const NAME_MAX = 512;
const BODY_MAX = 1024;
const CTA_LABEL_MAX = 25;

const STATUS_VALUES = [
  'draft',
  'pending',
  'approved',
  'rejected',
  'paused',
  'disabled',
] as const;
type TemplateStatus = (typeof STATUS_VALUES)[number];

function slugifyForMetaName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}

function generateMetaName(eventId: string, hint: string): string {
  // Doit être unique par WABA. On préfixe `couple_` + eventId court + slug du
  // titre fourni, troncé à 64 chars total puis suffixé d'un random pour éviter
  // les collisions sur re-submission.
  const slug = slugifyForMetaName(hint).slice(0, 24) || 'invite';
  const random = Math.random().toString(36).slice(2, 8);
  const eventShort = eventId.slice(-8).toLowerCase().replace(/[^a-z0-9]/g, '');
  return `couple_${eventShort}_${slug}_${random}`.slice(0, NAME_MAX);
}

function validateBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length < 20) throw new Error('BODY_TOO_SHORT');
  if (trimmed.length > BODY_MAX) throw new Error('BODY_TOO_LONG');
  // Au moins {{1}} (prénom invité) doit être présent — c'est la convention
  // qu'on utilise pour personnaliser chaque envoi.
  if (!/\{\{1\}\}/.test(trimmed)) throw new Error('BODY_MISSING_GUEST_PLACEHOLDER');
  // Bloquer les vars hors plage 1..5 — on supporte que 5 paramètres.
  const vars = Array.from(trimmed.matchAll(/\{\{(\d+)\}\}/g)).map((m) => Number(m[1]));
  if (vars.some((n) => n < 1 || n > 5)) throw new Error('BODY_INVALID_PLACEHOLDER_INDEX');
  return trimmed;
}

function validateCtaLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length === 0) throw new Error('CTA_LABEL_REQUIRED');
  if (trimmed.length > CTA_LABEL_MAX) throw new Error('CTA_LABEL_TOO_LONG');
  return trimmed;
}

/**
 * Crée un template custom en `draft` (pas encore soumis à Meta).
 * Le couple peut continuer à éditer tant qu'il n'a pas cliqué "Soumettre".
 */
export const create = mutation({
  args: {
    eventId: v.id('events'),
    requesterId: v.id('users'),
    bodyText: v.string(),
    ctaLabel: v.string(),
    nameHint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ev = await ctx.db.get(args.eventId);
    if (!ev) throw new Error('EVENT_NOT_FOUND');
    if (ev.ownerId !== args.requesterId) throw new Error('FORBIDDEN');

    const body = validateBody(args.bodyText);
    const ctaLabel = validateCtaLabel(args.ctaLabel);

    const baseUrl = (
      process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://wedillybird.com'
    ).replace(/\/$/, '');
    const ctaUrlPattern = `${baseUrl}/i/{{1}}`;

    const name = generateMetaName(args.eventId, args.nameHint ?? ev.title);
    const now = Date.now();

    const id = await ctx.db.insert('whatsappTemplates', {
      ownerId: args.requesterId,
      eventId: args.eventId,
      name,
      language: 'fr' as const,
      category: 'MARKETING' as const,
      bodyText: body,
      ctaLabel,
      ctaUrlPattern,
      status: 'draft' as const,
      createdAt: now,
      updatedAt: now,
    });

    return { id, name };
  },
});

export const updateDraft = mutation({
  args: {
    templateId: v.id('whatsappTemplates'),
    requesterId: v.id('users'),
    bodyText: v.optional(v.string()),
    ctaLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tpl = await ctx.db.get(args.templateId);
    if (!tpl) throw new Error('TEMPLATE_NOT_FOUND');
    if (tpl.ownerId !== args.requesterId) throw new Error('FORBIDDEN');
    if (tpl.status !== 'draft') throw new Error('TEMPLATE_NOT_EDITABLE');

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.bodyText !== undefined) patch.bodyText = validateBody(args.bodyText);
    if (args.ctaLabel !== undefined) patch.ctaLabel = validateCtaLabel(args.ctaLabel);

    await ctx.db.patch(args.templateId, patch);
    return { ok: true as const };
  },
});

/**
 * Mutation appelée juste avant la soumission Meta : passe le draft à
 * `pending` + set `submittedAt`. La soumission HTTP elle-même se fait dans
 * l'action `submitToMeta`.
 */
export const markSubmitting = internalMutation({
  args: { templateId: v.id('whatsappTemplates') },
  handler: async (ctx, { templateId }) => {
    const tpl = await ctx.db.get(templateId);
    if (!tpl) throw new Error('TEMPLATE_NOT_FOUND');
    await ctx.db.patch(templateId, {
      status: 'pending' as const,
      submittedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const markSubmissionResult = internalMutation({
  args: {
    templateId: v.id('whatsappTemplates'),
    metaTemplateId: v.optional(v.string()),
    status: v.union(
      v.literal('pending'),
      v.literal('approved'),
      v.literal('rejected'),
      v.literal('paused'),
      v.literal('disabled'),
    ),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.metaTemplateId !== undefined) patch.metaTemplateId = args.metaTemplateId;
    if (args.rejectionReason !== undefined) patch.rejectionReason = args.rejectionReason;
    if (args.status === 'approved' || args.status === 'rejected' || args.status === 'disabled') {
      patch.reviewedAt = Date.now();
    }
    await ctx.db.patch(args.templateId, patch);
  },
});

type TemplateRecord = {
  _id: Id<'whatsappTemplates'>;
  ownerId: Id<'users'>;
  status: TemplateStatus;
  bodyText: string;
  ctaLabel: string;
  ctaUrlPattern: string;
  name: string;
  category: 'MARKETING';
  language: 'fr';
};

type SubmitResult =
  | { ok: true; mock: true }
  | { ok: true; mock: false; metaTemplateId: string | undefined }
  | { ok: false; error: string };

/**
 * Soumet un template à Meta Cloud API. Action (HTTP autorisé), appelée
 * depuis le formulaire UI après création du draft.
 */
export const submitToMeta = action({
  args: {
    templateId: v.id('whatsappTemplates'),
    requesterId: v.id('users'),
  },
  handler: async (ctx, args): Promise<SubmitResult> => {
    const tpl: TemplateRecord | null = await ctx.runQuery(
      internal.whatsappTemplates._getForSubmission,
      {
        templateId: args.templateId,
        requesterId: args.requesterId,
      },
    );
    if (!tpl) throw new Error('TEMPLATE_NOT_FOUND_OR_FORBIDDEN');
    if (tpl.status !== 'draft') throw new Error('TEMPLATE_ALREADY_SUBMITTED');

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const wabaId = process.env.WHATSAPP_WABA_ID;
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0';

    if (!accessToken || !wabaId) {
      // Mock : on simule l'acceptation immédiate pour le dev local.
      console.info(`[whatsappTemplates:mock] Auto-approving "${tpl.name}"`);
      await ctx.runMutation(internal.whatsappTemplates.markSubmitting, {
        templateId: args.templateId,
      });
      await ctx.runMutation(internal.whatsappTemplates.markSubmissionResult, {
        templateId: args.templateId,
        metaTemplateId: `mock_${Date.now()}`,
        status: 'approved' as const,
      });
      return { ok: true as const, mock: true as const };
    }

    await ctx.runMutation(internal.whatsappTemplates.markSubmitting, {
      templateId: args.templateId,
    });

    const sampleVars = [
      'Aminata',
      'Mamadou & Marie',
      '30 avril 2026',
      'On compte sur toi pour ce grand jour !',
      'Précisions ou hommage',
    ];
    const placeholdersInBody = Array.from(tpl.bodyText.matchAll(/\{\{(\d+)\}\}/g))
      .map((m: RegExpMatchArray) => Number(m[1]))
      .filter((n: number) => n >= 1 && n <= 5);
    const maxIndex = placeholdersInBody.length > 0 ? Math.max(...placeholdersInBody) : 0;
    const bodyExample = sampleVars.slice(0, maxIndex);

    const payload = {
      name: tpl.name,
      category: tpl.category,
      language: tpl.language,
      components: [
        {
          type: 'BODY' as const,
          text: tpl.bodyText,
          example: bodyExample.length > 0 ? { body_text: [bodyExample] } : undefined,
        },
        {
          type: 'BUTTONS' as const,
          buttons: [
            {
              type: 'URL' as const,
              text: tpl.ctaLabel,
              url: tpl.ctaUrlPattern,
              example: [tpl.ctaUrlPattern.replace('{{1}}', 'abc123')],
            },
          ],
        },
      ],
    };

    const url = `https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as {
      id?: string;
      status?: string;
      error?: { message: string; code: number; error_subcode?: number };
    };

    if (!res.ok || data.error) {
      const reason = data.error?.message ?? `HTTP ${res.status}`;
      await ctx.runMutation(internal.whatsappTemplates.markSubmissionResult, {
        templateId: args.templateId,
        status: 'rejected' as const,
        rejectionReason: reason,
      });
      return { ok: false as const, error: reason };
    }

    const metaStatus = (data.status ?? 'PENDING').toLowerCase();
    const mappedStatus: TemplateStatus =
      metaStatus === 'approved'
        ? 'approved'
        : metaStatus === 'rejected'
          ? 'rejected'
          : metaStatus === 'paused'
            ? 'paused'
            : metaStatus === 'disabled'
              ? 'disabled'
              : 'pending';

    await ctx.runMutation(internal.whatsappTemplates.markSubmissionResult, {
      templateId: args.templateId,
      metaTemplateId: data.id,
      status: mappedStatus,
    });

    return { ok: true as const, mock: false as const, metaTemplateId: data.id };
  },
});

export const _getForSubmission = internalQuery({
  args: {
    templateId: v.id('whatsappTemplates'),
    requesterId: v.id('users'),
  },
  handler: async (ctx, { templateId, requesterId }) => {
    const tpl = await ctx.db.get(templateId);
    if (!tpl || tpl.ownerId !== requesterId) return null;
    return tpl;
  },
});

export const listByEvent = query({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    const ev = await ctx.db.get(eventId);
    if (!ev) throw new Error('EVENT_NOT_FOUND');
    if (ev.ownerId !== requesterId) {
      const collab = await ctx.db
        .query('eventCollaborators')
        .withIndex('by_event_user', (q) => q.eq('eventId', eventId).eq('userId', requesterId))
        .first();
      if (!collab) throw new Error('FORBIDDEN');
    }
    const rows = await ctx.db
      .query('whatsappTemplates')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .order('desc')
      .collect();
    return rows.map((t) => ({
      _id: t._id,
      name: t.name,
      bodyText: t.bodyText,
      ctaLabel: t.ctaLabel,
      ctaUrlPattern: t.ctaUrlPattern,
      status: t.status,
      metaTemplateId: t.metaTemplateId,
      rejectionReason: t.rejectionReason,
      submittedAt: t.submittedAt,
      reviewedAt: t.reviewedAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  },
});

export const getByMetaId = query({
  args: { metaTemplateId: v.string() },
  handler: async (ctx, { metaTemplateId }) => {
    return ctx.db
      .query('whatsappTemplates')
      .withIndex('by_meta_id', (q) => q.eq('metaTemplateId', metaTemplateId))
      .first();
  },
});

/**
 * Mutation appelée par le webhook Meta pour mettre à jour le status d'un
 * template suite à un `message_template_status_update`. Idempotente.
 */
export const applyWebhookStatusUpdate = mutation({
  args: {
    metaTemplateId: v.string(),
    metaName: v.optional(v.string()),
    status: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tpl = await ctx.db
      .query('whatsappTemplates')
      .withIndex('by_meta_id', (q) => q.eq('metaTemplateId', args.metaTemplateId))
      .first();
    if (!tpl) {
      // Match secondaire par nom (cas où on n'a pas encore stocké le metaId).
      if (args.metaName) {
        const byName = await ctx.db
          .query('whatsappTemplates')
          .filter((q) => q.eq(q.field('name'), args.metaName))
          .first();
        if (!byName) return { ok: false as const, error: 'TEMPLATE_NOT_FOUND' as const };
        await ctx.db.patch(byName._id, {
          metaTemplateId: args.metaTemplateId,
          updatedAt: Date.now(),
        });
        return await applyStatus(ctx, byName._id, args.status, args.reason);
      }
      return { ok: false as const, error: 'TEMPLATE_NOT_FOUND' as const };
    }
    return await applyStatus(ctx, tpl._id, args.status, args.reason);
  },
});

async function applyStatus(
  ctx: { db: { get: (id: Id<'whatsappTemplates'>) => Promise<unknown>; patch: (id: Id<'whatsappTemplates'>, patch: Record<string, unknown>) => Promise<void> } },
  id: Id<'whatsappTemplates'>,
  rawStatus: string,
  reason: string | undefined,
): Promise<{ ok: true; status: TemplateStatus; changed: boolean } | { ok: false; error: 'TEMPLATE_NOT_FOUND' }> {
  const normalized = rawStatus.toLowerCase();
  const mapped: TemplateStatus =
    normalized === 'approved'
      ? 'approved'
      : normalized === 'rejected'
        ? 'rejected'
        : normalized === 'paused'
          ? 'paused'
          : normalized === 'disabled'
            ? 'disabled'
            : 'pending';

  const current = (await ctx.db.get(id)) as { status: TemplateStatus } | null;
  if (!current) return { ok: false as const, error: 'TEMPLATE_NOT_FOUND' as const };
  if (current.status === mapped) {
    return { ok: true as const, status: mapped, changed: false };
  }
  const patch: Record<string, unknown> = { status: mapped, updatedAt: Date.now() };
  if (reason !== undefined) patch.rejectionReason = reason;
  if (mapped === 'approved' || mapped === 'rejected' || mapped === 'disabled') {
    patch.reviewedAt = Date.now();
  }
  await ctx.db.patch(id, patch);
  return { ok: true as const, status: mapped, changed: true };
}

export const markNotified = internalMutation({
  args: { templateId: v.id('whatsappTemplates') },
  handler: async (ctx, { templateId }) => {
    await ctx.db.patch(templateId, { notifiedAt: Date.now() });
  },
});

/**
 * Liste les templates dont le status est `approved`/`rejected`/`disabled`
 * mais qui n'ont pas encore été notifiés à leur owner. Utilisé par le
 * dispatcher de notifications.
 */
export const listPendingNotifications = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('whatsappTemplates')
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field('status'), 'approved'),
            q.eq(q.field('status'), 'rejected'),
            q.eq(q.field('status'), 'disabled'),
          ),
          q.eq(q.field('notifiedAt'), undefined),
        ),
      )
      .collect();
    return rows;
  },
});

/**
 * Polling fallback : pour chaque template `pending` avec un metaTemplateId,
 * va checker l'état actuel chez Meta et applique la mise à jour. Utile si
 * le webhook n'est pas configuré ou si on a raté un event.
 */
export const pollPendingStatuses = internalAction({
  args: {},
  handler: async (ctx) => {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const wabaId = process.env.WHATSAPP_WABA_ID;
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0';
    if (!accessToken || !wabaId) {
      return { skipped: true as const, reason: 'NO_CREDENTIALS' as const };
    }

    const pending: Array<{ _id: Id<'whatsappTemplates'>; metaTemplateId?: string; name: string }> =
      await ctx.runQuery(internal.whatsappTemplates._listPending, {});
    let updated = 0;

    for (const tpl of pending) {
      if (!tpl.metaTemplateId) continue;
      try {
        const res = await fetch(
          `https://graph.facebook.com/${graphVersion}/${tpl.metaTemplateId}?fields=name,status,quality_score,rejected_reason`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        if (!res.ok) continue;
        const data = (await res.json()) as { status?: string; rejected_reason?: string };
        if (!data.status) continue;
        const result: { ok: true; changed: boolean } | { ok: false } = await ctx.runMutation(
          internal.whatsappTemplates._applyPolledStatus,
          {
            templateId: tpl._id,
            status: data.status,
            reason: data.rejected_reason,
          },
        );
        if (result.ok && result.changed) updated += 1;
      } catch (err) {
        console.warn(`[whatsappTemplates:poll] ${tpl.name} failed`, err);
      }
    }
    return { skipped: false as const, polled: pending.length, updated };
  },
});

/**
 * Liste les templates en transition non-notifiée, joints à event + owner.
 * Vit dans ce module (runtime Convex) parce que `whatsappTemplateNotifications.ts`
 * est un fichier `'use node'` qui ne peut contenir que des actions.
 */
export const _listToNotify = internalQuery({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db
      .query('whatsappTemplates')
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field('status'), 'approved'),
            q.eq(q.field('status'), 'rejected'),
            q.eq(q.field('status'), 'disabled'),
            q.eq(q.field('status'), 'paused'),
          ),
          q.eq(q.field('notifiedAt'), undefined),
        ),
      )
      .collect();

    const enriched: Array<{
      templateId: Id<'whatsappTemplates'>;
      ownerId: Id<'users'>;
      eventId: Id<'events'>;
      name: string;
      status: TemplateStatus;
      rejectionReason?: string;
      ownerFullName: string;
      ownerEmail?: string;
      ownerPhone?: string;
      eventTitle: string;
      templateNotifyChannel: 'whatsapp' | 'email' | 'both';
    }> = [];

    for (const t of templates) {
      if (
        t.status !== 'approved' &&
        t.status !== 'rejected' &&
        t.status !== 'disabled' &&
        t.status !== 'paused'
      )
        continue;
      const event = await ctx.db.get(t.eventId);
      const owner = await ctx.db.get(t.ownerId);
      if (!event || !owner) continue;
      enriched.push({
        templateId: t._id,
        ownerId: t.ownerId,
        eventId: t.eventId,
        name: t.name,
        status: t.status,
        rejectionReason: t.rejectionReason,
        ownerFullName: owner.fullName ?? 'Bonjour',
        ownerEmail: owner.email,
        ownerPhone: owner.phone,
        eventTitle: event.title,
        templateNotifyChannel: event.messagingConfig?.templateNotifyChannel ?? 'email',
      });
    }

    return enriched;
  },
});

export const _listPending = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('whatsappTemplates')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .collect();
    return rows.map((t) => ({ _id: t._id, metaTemplateId: t.metaTemplateId, name: t.name }));
  },
});

export const _applyPolledStatus = internalMutation({
  args: {
    templateId: v.id('whatsappTemplates'),
    status: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await applyStatus(ctx, args.templateId, args.status, args.reason);
  },
});
