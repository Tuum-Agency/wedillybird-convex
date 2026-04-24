'use server';

import { revalidatePath } from 'next/cache';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { rsvpSubmitSchema } from '@/lib/validators/rsvp';

export type RsvpActionResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'INVALID_INPUT'
        | 'INVITATION_NOT_FOUND'
        | 'EVENT_CLOSED'
        | 'PLUS_ONES_EXCEEDED'
        | 'UNKNOWN';
      fieldErrors?: Record<string, string[]>;
    };

export async function submitRsvpAction(
  token: string,
  formData: FormData,
): Promise<RsvpActionResult> {
  const raw = {
    rsvpStatus: formData.get('rsvpStatus'),
    plusOnesNames: formData.getAll('plusOnesNames'),
    dietaryRestrictions: formData.get('dietaryRestrictions'),
    notes: formData.get('notes'),
  };

  const parsed = rsvpSubmitSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.submitRsvp, {
      token,
      rsvpStatus: parsed.data.rsvpStatus,
      plusOnesNames: parsed.data.plusOnesNames.length > 0 ? parsed.data.plusOnesNames : undefined,
      dietaryRestrictions: parsed.data.dietaryRestrictions,
      notes: parsed.data.notes,
    });
    revalidatePath(`/i/${token}`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message === 'INVITATION_NOT_FOUND') return { ok: false, error: 'INVITATION_NOT_FOUND' };
    if (message === 'EVENT_CLOSED') return { ok: false, error: 'EVENT_CLOSED' };
    if (message === 'PLUS_ONES_EXCEEDED') return { ok: false, error: 'PLUS_ONES_EXCEEDED' };
    return { ok: false, error: 'UNKNOWN' };
  }
}
