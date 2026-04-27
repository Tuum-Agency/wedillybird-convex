'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from '@/i18n/navigation';
import { createEventSchema, normalizeCreateEvent } from '@/lib/validators/events';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { getSession } from '@/lib/auth/session';

export type CreateEventResult =
  | { ok: true; slug: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export type EventStatusToggleResult =
  | { ok: true; status: 'draft' | 'active' | 'archived' | 'cancelled' }
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
