'use server';

import { revalidatePath } from 'next/cache';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

export type UploadUrlResult =
  | { ok: true; uploadUrl: string; s3Key: string }
  | {
      ok: false;
      error: 'INVITATION_NOT_FOUND' | 'EVENT_CLOSED' | 'INVALID_TYPE' | 'UNKNOWN';
    };

export async function createGuestUploadUrlAction(
  token: string,
  contentType: string,
): Promise<UploadUrlResult> {
  try {
    const convex = getConvexServerClient();
    const { uploadUrl, s3Key } = await convex.action(convexApi.createGuestS3UploadUrl, {
      token,
      contentType,
    });
    return { ok: true, uploadUrl, s3Key };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message.includes('INVITATION_NOT_FOUND'))
      return { ok: false, error: 'INVITATION_NOT_FOUND' };
    if (message.includes('EVENT_CLOSED')) return { ok: false, error: 'EVENT_CLOSED' };
    if (message.includes('INVALID_CONTENT_TYPE')) return { ok: false, error: 'INVALID_TYPE' };
    return { ok: false, error: 'UNKNOWN' };
  }
}

export type ConfirmUploadResult = { ok: true; id: string } | { ok: false; error: string };

export async function confirmGuestUploadAction(input: {
  token: string;
  s3Key: string;
  sizeBytes: number;
  contentType: string;
  width?: number;
  height?: number;
  uploaderName?: string;
}): Promise<ConfirmUploadResult> {
  try {
    const convex = getConvexServerClient();
    const { id } = await convex.mutation(convexApi.confirmGuestUpload, input);
    revalidatePath(`/i/${input.token}/gallery`);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export type FaceSearchResult =
  | { ok: true; photoIds: string[]; matchCount: number }
  | { ok: false; error: string };

export async function faceSearchGuestAction(
  token: string,
  selfieBase64: string,
): Promise<FaceSearchResult> {
  try {
    const convex = getConvexServerClient();
    // L'eventId est résolu côté Convex via le guestToken — on délègue
    // l'authentification au token (l'invité n'a pas de session).
    const data = await convex.query(convexApi.getGuestByToken, { token });
    if (!data) return { ok: false, error: 'INVALID_TOKEN' };

    const result = await convex.action(convexApi.searchPhotosByFace, {
      eventId: data.event._id,
      selfieBase64,
      guestToken: token,
    });
    if (result.ok) {
      return { ok: true, photoIds: result.photoIds, matchCount: result.matchCount };
    }
    return { ok: false, error: result.error };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message.includes('NO_FACE_DETECTED')) return { ok: false, error: 'NO_FACE_DETECTED' };
    if (message.includes('NO_COLLECTION_YET')) return { ok: false, error: 'NO_COLLECTION_YET' };
    if (message.includes('INVALID_TOKEN')) return { ok: false, error: 'INVALID_TOKEN' };
    if (message.includes('FORBIDDEN')) return { ok: false, error: 'FORBIDDEN' };
    return { ok: false, error: 'UNKNOWN' };
  }
}
