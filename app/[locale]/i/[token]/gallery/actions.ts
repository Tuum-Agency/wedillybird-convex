'use server';

import { revalidatePath } from 'next/cache';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

export type UploadUrlResult =
  | { ok: true; uploadUrl: string }
  | { ok: false; error: 'INVITATION_NOT_FOUND' | 'EVENT_CLOSED' | 'UNKNOWN' };

export async function createGuestUploadUrlAction(token: string): Promise<UploadUrlResult> {
  try {
    const convex = getConvexServerClient();
    const { uploadUrl } = await convex.mutation(convexApi.createGuestUploadUrl, { token });
    return { ok: true, uploadUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message === 'INVITATION_NOT_FOUND') return { ok: false, error: 'INVITATION_NOT_FOUND' };
    if (message === 'EVENT_CLOSED') return { ok: false, error: 'EVENT_CLOSED' };
    return { ok: false, error: 'UNKNOWN' };
  }
}

export type ConfirmUploadResult = { ok: true; id: string } | { ok: false; error: string };

export async function confirmGuestUploadAction(input: {
  token: string;
  storageId: string;
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
