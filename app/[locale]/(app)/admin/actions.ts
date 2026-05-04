'use server';

import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { getSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session.userId;
}

export async function adminSuspendUserAction(targetUserId: string): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.adminSuspendUser, { adminId, targetUserId });
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'UNKNOWN' };
  }
}

export async function adminChangeUserRoleAction(
  targetUserId: string,
  newRole: 'couple' | 'pro' | 'guest' | 'admin',
): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.adminChangeUserRole, { adminId, targetUserId, newRole });
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'UNKNOWN' };
  }
}

export async function adminUpdateEventStatusAction(
  eventId: string,
  newStatus: 'draft' | 'active' | 'archived' | 'cancelled',
): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.adminUpdateEventStatus, { adminId, eventId, newStatus });
    revalidatePath('/admin/events');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'UNKNOWN' };
  }
}

export async function adminDeleteEventAction(eventId: string): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.adminDeleteEvent, { adminId, eventId });
    revalidatePath('/admin/events');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'UNKNOWN' };
  }
}

export async function adminModeratePhotoAction(
  photoId: string,
  decision: 'approved' | 'rejected',
): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin();
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.adminModeratePhoto, { adminId, photoId, decision });
    revalidatePath('/admin/moderation');
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'UNKNOWN' };
  }
}
