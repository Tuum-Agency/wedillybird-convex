'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

export type UploadUrlResult =
  | { ok: true; uploadUrl: string }
  | { ok: false; error: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'UNKNOWN' };

export async function createOwnerUploadUrlAction(eventId: string): Promise<UploadUrlResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };

  try {
    const convex = getConvexServerClient();
    const { uploadUrl } = await convex.mutation(convexApi.createOwnerUploadUrl, {
      eventId,
      requesterId: session.userId,
    });
    return { ok: true, uploadUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message === 'FORBIDDEN') return { ok: false, error: 'FORBIDDEN' };
    if (message === 'EVENT_NOT_FOUND') return { ok: false, error: 'NOT_FOUND' };
    return { ok: false, error: 'UNKNOWN' };
  }
}

export type ConfirmUploadResult = { ok: true; id: string } | { ok: false; error: string };

export async function confirmOwnerUploadAction(input: {
  eventId: string;
  storageId: string;
  sizeBytes: number;
  contentType: string;
  width?: number;
  height?: number;
}): Promise<ConfirmUploadResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };

  try {
    const convex = getConvexServerClient();
    const { id } = await convex.mutation(convexApi.confirmOwnerUpload, {
      eventId: input.eventId,
      requesterId: session.userId,
      storageId: input.storageId,
      sizeBytes: input.sizeBytes,
      contentType: input.contentType,
      width: input.width,
      height: input.height,
    });
    revalidatePath(`/events/${input.eventId}/gallery`);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export async function moderatePhotoAction(
  eventId: string,
  photoId: string,
  decision: 'approved' | 'rejected',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };

  try {
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.moderatePhoto, {
      photoId,
      requesterId: session.userId,
      decision,
    });
    revalidatePath(`/events/${eventId}/gallery`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export async function removePhotoAction(
  eventId: string,
  photoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };

  try {
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.removePhoto, {
      photoId,
      requesterId: session.userId,
    });
    revalidatePath(`/events/${eventId}/gallery`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}
