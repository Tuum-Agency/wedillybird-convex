'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

export type UploadUrlResult =
  | { ok: true; uploadUrl: string; s3Key: string }
  | { ok: false; error: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_TYPE' | 'UNKNOWN' };

export async function createOwnerUploadUrlAction(
  eventId: string,
  contentType: string,
): Promise<UploadUrlResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };

  try {
    const convex = getConvexServerClient();
    const { uploadUrl, s3Key } = await convex.action(convexApi.createOwnerS3UploadUrl, {
      eventId,
      requesterId: session.userId,
      contentType,
    });
    return { ok: true, uploadUrl, s3Key };
  } catch (err) {
    console.error('[gallery] createOwnerUploadUrlAction failed', err);
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message.includes('FORBIDDEN')) return { ok: false, error: 'FORBIDDEN' };
    if (message.includes('EVENT_NOT_FOUND')) return { ok: false, error: 'NOT_FOUND' };
    if (message.includes('INVALID_CONTENT_TYPE')) return { ok: false, error: 'INVALID_TYPE' };
    return { ok: false, error: 'UNKNOWN' };
  }
}

export type ConfirmUploadResult = { ok: true; id: string } | { ok: false; error: string };

export async function confirmOwnerUploadAction(input: {
  eventId: string;
  s3Key: string;
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
      s3Key: input.s3Key,
      sizeBytes: input.sizeBytes,
      contentType: input.contentType,
      width: input.width,
      height: input.height,
    });
    revalidatePath(`/events/${input.eventId}/gallery`);
    return { ok: true, id };
  } catch (err) {
    console.error('[gallery] confirmOwnerUploadAction failed', err);
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

export type FaceSearchResult =
  | { ok: true; photoIds: string[]; matchCount: number }
  | { ok: false; error: string };

export async function faceSearchOwnerAction(
  eventId: string,
  selfieBase64: string,
): Promise<FaceSearchResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'FORBIDDEN' };

  try {
    const convex = getConvexServerClient();
    const result = await convex.action(convexApi.searchPhotosByFace, {
      eventId,
      selfieBase64,
      requesterId: session.userId,
    });
    if (result.ok) {
      return { ok: true, photoIds: result.photoIds, matchCount: result.matchCount };
    }
    return { ok: false, error: result.error };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message.includes('NO_FACE_DETECTED')) return { ok: false, error: 'NO_FACE_DETECTED' };
    if (message.includes('NO_COLLECTION_YET')) return { ok: false, error: 'NO_COLLECTION_YET' };
    if (message.includes('FACE_SEARCH_DISABLED'))
      return { ok: false, error: 'FACE_SEARCH_DISABLED' };
    if (message.includes('RATE_LIMITED')) return { ok: false, error: 'RATE_LIMITED' };
    if (message.includes('FORBIDDEN')) return { ok: false, error: 'FORBIDDEN' };
    return { ok: false, error: 'UNKNOWN' };
  }
}
