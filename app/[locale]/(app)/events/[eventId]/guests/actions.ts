'use server';

import { revalidatePath } from 'next/cache';
import { addGuestSchema, updateGuestSchema } from '@/lib/validators/guests';
import { convexApi, getConvexServerClient, sessionTokenArg } from '@/lib/auth/convex-server';
import { getSession } from '@/lib/auth/session';

export type GuestActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

function rawFromForm(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function addGuestAction(
  eventId: string,
  formData: FormData,
): Promise<GuestActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };

  const parsed = addGuestSchema.safeParse({
    fullName: rawFromForm(formData, 'fullName'),
    phone: rawFromForm(formData, 'phone'),
    email: rawFromForm(formData, 'email'),
    category: rawFromForm(formData, 'category'),
    plusOnesAllowed: rawFromForm(formData, 'plusOnesAllowed') ?? '0',
    notes: rawFromForm(formData, 'notes'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.addGuest, {
      eventId,
      sessionToken: await sessionTokenArg(),
      fullName: parsed.data.fullName,
      plusOnesAllowed: parsed.data.plusOnesAllowed,
      ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
      ...(parsed.data.email ? { email: parsed.data.email } : {}),
      ...(parsed.data.category ? { category: parsed.data.category } : {}),
      ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message.includes('INVITATION_LIMIT_REACHED')) {
      return { ok: false, error: 'INVITATION_LIMIT_REACHED' };
    }
    return { ok: false, error: message };
  }

  revalidatePath(`/events/${eventId}/guests`);
  return { ok: true };
}

export async function updateGuestAction(
  guestId: string,
  eventId: string,
  formData: FormData,
): Promise<GuestActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };

  const parsed = updateGuestSchema.safeParse({
    fullName: rawFromForm(formData, 'fullName'),
    phone: rawFromForm(formData, 'phone'),
    email: rawFromForm(formData, 'email'),
    category: rawFromForm(formData, 'category'),
    plusOnesAllowed: rawFromForm(formData, 'plusOnesAllowed'),
    notes: rawFromForm(formData, 'notes'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.updateGuest, {
      guestId,
      sessionToken: await sessionTokenArg(),
      ...(parsed.data.fullName !== undefined ? { fullName: parsed.data.fullName } : {}),
      ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
      ...(parsed.data.email !== undefined ? { email: parsed.data.email } : {}),
      ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
      ...(parsed.data.plusOnesAllowed !== undefined
        ? { plusOnesAllowed: parsed.data.plusOnesAllowed }
        : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }

  revalidatePath(`/events/${eventId}/guests`);
  return { ok: true };
}

export async function removeGuestAction(
  guestId: string,
  eventId: string,
): Promise<GuestActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };

  const convex = getConvexServerClient();
  try {
    await convex.mutation(convexApi.removeGuest, {
      guestId,
      sessionToken: await sessionTokenArg(),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }

  revalidatePath(`/events/${eventId}/guests`);
  return { ok: true };
}
