'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient, sessionTokenArg } from '@/lib/auth/convex-server';
import { validatePhotoBookAddress, type PhotoBookAddressInput } from '@/lib/photos/photo-book';

export type RequestPhotoBookResult =
  | { ok: true; status: 'requested' }
  | {
      ok: false;
      error:
        | 'UNAUTHORIZED'
        | 'FORBIDDEN'
        | 'NOT_FOUND'
        | 'UPSELL_REQUIRED'
        | 'ALREADY_ORDERED'
        | 'INVALID_ADDRESS'
        | 'UNKNOWN';
    };

export async function requestPhotoBookAction(
  eventId: string,
  input: PhotoBookAddressInput,
): Promise<RequestPhotoBookResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };

  const validation = validatePhotoBookAddress(input);
  if (!validation.ok) return { ok: false, error: 'INVALID_ADDRESS' };

  try {
    const convex = getConvexServerClient();
    const res = await convex.mutation(convexApi.requestPhotoBook, {
      eventId,
      sessionToken: await sessionTokenArg(),
      recipientName: validation.value.recipientName,
      addressLine1: validation.value.addressLine1,
      addressLine2: validation.value.addressLine2,
      city: validation.value.city,
      postalCode: validation.value.postalCode,
      country: validation.value.country,
      notes: validation.value.notes,
    });
    revalidatePath(`/events/${eventId}`);
    return { ok: true, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message.includes('FORBIDDEN')) return { ok: false, error: 'FORBIDDEN' };
    if (message.includes('EVENT_NOT_FOUND')) return { ok: false, error: 'NOT_FOUND' };
    if (message.includes('UPSELL_REQUIRED')) return { ok: false, error: 'UPSELL_REQUIRED' };
    if (message.includes('ALREADY_ORDERED')) return { ok: false, error: 'ALREADY_ORDERED' };
    if (message.includes('INVALID_ADDRESS')) return { ok: false, error: 'INVALID_ADDRESS' };
    return { ok: false, error: 'UNKNOWN' };
  }
}
