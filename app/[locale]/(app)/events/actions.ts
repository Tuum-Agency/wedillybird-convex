'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from '@/i18n/navigation';
import {
  createEventSchema,
  normalizeCreateEvent,
  updateEventSchema,
} from '@/lib/validators/events';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { getSession } from '@/lib/auth/session';

export type CreateEventResult =
  | { ok: true; slug: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export type EventStatusToggleResult =
  | { ok: true; status: 'draft' | 'active' | 'archived' | 'cancelled' }
  | { ok: false; error: string };

export type UpdateEventResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export type UpdateMessagingConfigResult = { ok: true } | { ok: false; error: string };

export type BroadcastInvitationsResult =
  | { ok: true; sent: number; failed: number; total: number; mock: boolean }
  | { ok: false; error: string };

export async function createEventAction(formData: FormData): Promise<CreateEventResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };

  const parsed = createEventSchema.safeParse({
    title: formData.get('title') ?? undefined,
    partnerA: formData.get('partnerA') ?? undefined,
    partnerB: formData.get('partnerB') ?? undefined,
    eventDate: formData.get('eventDate') ?? undefined,
    timezone: formData.get('timezone') ?? undefined,
    venueName: formData.get('venueName') ?? undefined,
    venueAddress: formData.get('venueAddress') ?? undefined,
    themePrimary: formData.get('themePrimary') ?? undefined,
    themeAccent: formData.get('themeAccent') ?? undefined,
    themeFont: formData.get('themeFont') ?? undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const normalized = normalizeCreateEvent(parsed.data);
  const convex = getConvexServerClient();

  let slug: string;
  try {
    const result = await convex.mutation(convexApi.createEvent, {
      ownerId: session.userId,
      ...normalized,
    });
    slug = result.slug;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }

  redirect({ href: `/dashboard?created=${slug}`, locale: 'fr' });
  return { ok: true, slug };
}

/**
 * Toggle Publier/Dépublier — passe l'événement de `draft` à `active` ou
 * inversement. Appelle la mutation Convex correspondante en fonction de
 * l'action demandée. Le revalidatePath force le rerender de la page event.
 *
 * Retour `void` pour pouvoir être utilisée directement comme `<form action={…}>`
 * dans un Server Component (HTML form attend `void | Promise<void>`). En cas
 * d'erreur, log côté serveur — l'utilisateur verra simplement que le statut
 * n'a pas changé. Pour un retour structuré côté client, voir le wrapper
 * `togglePublishActionWithResult` ci-dessous.
 */
export async function togglePublishAction(formData: FormData): Promise<void> {
  await togglePublishActionWithResult(formData);
}

/**
 * Lance le broadcast des invitations WhatsApp à tous les guests qui n'ont
 * pas encore reçu leur invitation. Owner-only (validé côté Convex).
 * L'event doit être `status: 'active'` (publié) — sinon la mutation throw
 * EVENT_NOT_PUBLISHED.
 */
export async function broadcastInvitationsAction(
  eventId: string,
): Promise<BroadcastInvitationsResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };

  const convex = getConvexServerClient();
  try {
    const result = await convex.action(convexApi.broadcastInvitations, {
      eventId,
      requesterId: session.userId,
    });
    revalidatePath(`/fr/events/${eventId}`);
    return {
      ok: true,
      sent: result.sent,
      failed: result.failed,
      total: result.total,
      mock: result.mock,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message.includes('EVENT_NOT_PUBLISHED')) {
      return { ok: false, error: 'EVENT_NOT_PUBLISHED' };
    }
    if (message.includes('FORBIDDEN')) {
      return { ok: false, error: 'FORBIDDEN' };
    }
    return { ok: false, error: 'UNKNOWN' };
  }
}

/**
 * Met à jour la config messaging d'un événement (style template, mot perso,
 * canal préféré). Validation : style ∈ 4 valeurs autorisées, mot perso
 * <= 60 chars, canal ∈ {whatsapp, email, both}.
 */
export async function updateMessagingConfigAction(
  formData: FormData,
): Promise<UpdateMessagingConfigResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };

  const eventId = String(formData.get('eventId') ?? '');
  const templateStyle = String(formData.get('templateStyle') ?? '');
  const personalMessage = String(formData.get('personalMessage') ?? '').trim();
  const preferredChannel = String(formData.get('preferredChannel') ?? '');

  if (!eventId) return { ok: false, error: 'INVALID_INPUT' };
  if (!['classic', 'warm', 'african', 'minimal', 'festive'].includes(templateStyle)) {
    return { ok: false, error: 'INVALID_STYLE' };
  }
  if (!['whatsapp', 'email', 'both'].includes(preferredChannel)) {
    return { ok: false, error: 'INVALID_CHANNEL' };
  }
  if (personalMessage.length > 60) {
    return { ok: false, error: 'PERSONAL_MESSAGE_TOO_LONG' };
  }

  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.updateEventMessagingConfig, {
      eventId,
      requesterId: session.userId,
      templateStyle: templateStyle as 'classic' | 'warm' | 'african' | 'minimal' | 'festive',
      ...(personalMessage ? { personalMessage } : {}),
      preferredChannel: preferredChannel as 'whatsapp' | 'email' | 'both',
    });
    revalidatePath(`/fr/events/${eventId}`);
    revalidatePath(`/fr/events/${eventId}/messaging`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

/**
 * Met à jour les détails d'un événement existant. Champs optionnels —
 * on n'envoie à Convex que ce qui change. Le particulier peut accéder
 * via /events/[id]/edit, le pro peut aussi (collab non implémenté ici).
 */
export async function updateEventAction(
  eventId: string,
  formData: FormData,
): Promise<UpdateEventResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };

  const rawTitle = formData.get('title');
  const rawPartnerA = formData.get('partnerA');
  const rawPartnerB = formData.get('partnerB');
  const rawDate = formData.get('eventDate');
  const rawTimezone = formData.get('timezone');
  const rawVenueName = formData.get('venueName');
  const rawVenueAddress = formData.get('venueAddress');
  const rawClearVenue = formData.get('clearVenue') === '1';
  const rawThemePrimary = formData.get('themePrimary');
  const rawThemeAccent = formData.get('themeAccent');
  const rawThemeFont = formData.get('themeFont');

  const parsed = updateEventSchema.safeParse({
    title: rawTitle ? String(rawTitle) : undefined,
    partnerA: rawPartnerA ? String(rawPartnerA) : undefined,
    partnerB: rawPartnerB ? String(rawPartnerB) : undefined,
    eventDate: rawDate ? String(rawDate) : undefined,
    timezone: rawTimezone ? String(rawTimezone) : undefined,
    venueName: rawVenueName ? String(rawVenueName) : undefined,
    venueAddress: rawVenueAddress ? String(rawVenueAddress) : undefined,
    clearVenue: rawClearVenue || undefined,
    themePrimary: rawThemePrimary ? String(rawThemePrimary) : undefined,
    themeAccent: rawThemeAccent ? String(rawThemeAccent) : undefined,
    themeFont: rawThemeFont ? String(rawThemeFont) : undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const venue =
    data.venueName && data.venueAddress
      ? { name: data.venueName, address: data.venueAddress }
      : undefined;
  const theme =
    data.themePrimary && data.themeAccent && data.themeFont
      ? {
          primaryColor: data.themePrimary,
          accentColor: data.themeAccent,
          fontFamily: data.themeFont,
        }
      : undefined;

  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.updateEvent, {
      eventId,
      requesterId: session.userId,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.partnerA !== undefined ? { partnerA: data.partnerA } : {}),
      ...(data.partnerB !== undefined ? { partnerB: data.partnerB } : {}),
      ...(data.eventDate !== undefined ? { eventDate: data.eventDate } : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      ...(venue ? { venue } : {}),
      ...(data.clearVenue ? { clearVenue: true } : {}),
      ...(theme ? { theme } : {}),
    });
    revalidatePath(`/fr/events/${eventId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export async function togglePublishActionWithResult(
  formData: FormData,
): Promise<EventStatusToggleResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };

  const eventId = String(formData.get('eventId') ?? '');
  const action = String(formData.get('action') ?? '');
  if (!eventId) return { ok: false, error: 'INVALID_INPUT' };
  if (action !== 'publish' && action !== 'unpublish') {
    return { ok: false, error: 'INVALID_INPUT' };
  }

  const convex = getConvexServerClient();
  try {
    const result =
      action === 'publish'
        ? await convex.mutation(convexApi.publishEvent, {
            eventId,
            requesterId: session.userId,
          })
        : await convex.mutation(convexApi.unpublishEvent, {
            eventId,
            requesterId: session.userId,
          });
    revalidatePath(`/fr/events/${eventId}`);
    return { ok: true, status: result.status };
  } catch (err) {
    console.error('[togglePublish] failed', err);
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}
