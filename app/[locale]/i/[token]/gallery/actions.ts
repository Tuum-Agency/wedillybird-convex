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
