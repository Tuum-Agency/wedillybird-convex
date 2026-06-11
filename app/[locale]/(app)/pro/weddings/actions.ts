'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

export type WeddingActionResult =
  | { ok: true; status: 'draft' | 'active' | 'archived' | 'cancelled' }
  | { ok: false; error: string };

/** Publie / dépublie un mariage (back-office agence). */
export async function togglePublishAction(
  eventId: string,
  publish: boolean,
): Promise<WeddingActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };
  const convex = getConvexServerClient();
  try {
    const r = publish
      ? await convex.mutation(convexApi.publishEvent, { eventId, requesterId: session.userId })
      : await convex.mutation(convexApi.unpublishEvent, { eventId, requesterId: session.userId });
    revalidatePath(`/pro/weddings/${eventId}`);
    return { ok: true, status: r.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'UNKNOWN' };
  }
}
