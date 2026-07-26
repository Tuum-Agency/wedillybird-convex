'use server';

import { revalidatePath } from 'next/cache';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { rsvpSubmitSchema } from '@/lib/validators/rsvp';
import type { CustomAnswer } from '@/lib/rsvp/questions';

export type RsvpActionResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'INVALID_INPUT'
        | 'INVITATION_NOT_FOUND'
        | 'EVENT_CLOSED'
        | 'PLUS_ONES_EXCEEDED'
        | 'CUSTOM_ANSWER_REQUIRED'
        | 'UNKNOWN';
      fieldErrors?: Record<string, string[]>;
    };

/**
 * Parse le champ `customAnswers` (JSON sérialisé par le formulaire) en un
 * tableau best-effort. La mutation Convex re-valide de façon autoritaire contre
 * `event.rsvpConfig` — ici on ne fait qu'un parsing défensif de la forme.
 */
function parseCustomAnswers(raw: FormDataEntryValue | null): CustomAnswer[] | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const answers = parsed
      .filter(
        (a): a is { questionId: string; values: unknown[] } =>
          !!a &&
          typeof a === 'object' &&
          typeof (a as { questionId?: unknown }).questionId === 'string' &&
          Array.isArray((a as { values?: unknown }).values),
      )
      .map((a) => ({
        questionId: a.questionId,
        values: a.values.filter((v): v is string => typeof v === 'string'),
      }))
      .filter((a) => a.values.length > 0);
    return answers.length > 0 ? answers : undefined;
  } catch {
    return undefined;
  }
}

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

  const customAnswers = parseCustomAnswers(formData.get('customAnswers'));

  try {
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.submitRsvp, {
      token,
      rsvpStatus: parsed.data.rsvpStatus,
      plusOnesNames: parsed.data.plusOnesNames.length > 0 ? parsed.data.plusOnesNames : undefined,
      dietaryRestrictions: parsed.data.dietaryRestrictions,
      notes: parsed.data.notes,
      ...(customAnswers ? { customAnswers } : {}),
    });
    revalidatePath(`/i/${token}`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message === 'INVITATION_NOT_FOUND') return { ok: false, error: 'INVITATION_NOT_FOUND' };
    if (message === 'EVENT_CLOSED') return { ok: false, error: 'EVENT_CLOSED' };
    if (message === 'PLUS_ONES_EXCEEDED') return { ok: false, error: 'PLUS_ONES_EXCEEDED' };
    if (message.includes('CUSTOM_ANSWER_REQUIRED')) {
      return { ok: false, error: 'CUSTOM_ANSWER_REQUIRED' };
    }
    return { ok: false, error: 'UNKNOWN' };
  }
}
