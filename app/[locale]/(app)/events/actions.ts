'use server';

import { redirect } from '@/i18n/navigation';
import { createEventSchema, normalizeCreateEvent } from '@/lib/validators/events';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { getSession } from '@/lib/auth/session';

export type CreateEventResult =
  | { ok: true; slug: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

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
