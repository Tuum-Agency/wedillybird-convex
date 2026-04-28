'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

const E164 = /^\+[1-9]\d{6,14}$/;
const HEX_COLOR_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export type CreateOrgResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: 'UNAUTHORIZED' | 'NOT_PRO' | 'INVALID_NAME' | 'UNKNOWN' };

export async function createOrganizationAction(formData: FormData): Promise<CreateOrgResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };

  const name = ((formData.get('name') as string | null) ?? '').trim();
  if (name.length < 1 || name.length > 120) return { ok: false, error: 'INVALID_NAME' };

  const primary = (formData.get('primaryColor') as string | null)?.trim() || undefined;
  const accent = (formData.get('accentColor') as string | null)?.trim() || undefined;

  try {
    const convex = getConvexServerClient();
    const { id, slug } = await convex.mutation(convexApi.createOrganization, {
      ownerId: session.userId,
      name,
      primaryColor: primary,
      accentColor: accent,
    });
    revalidatePath('/pro/dashboard');
    return { ok: true, id, slug };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message === 'NOT_PRO') return { ok: false, error: 'NOT_PRO' };
    if (message === 'INVALID_NAME') return { ok: false, error: 'INVALID_NAME' };
    return { ok: false, error: 'UNKNOWN' };
  }
}

export type InviteMemberResult =
  | { ok: true; inviteToken: string }
  | {
      ok: false;
      error:
        | 'UNAUTHORIZED'
        | 'FORBIDDEN'
        | 'INVALID_PHONE'
        | 'NO_CONTACT'
        | 'ALREADY_MEMBER'
        | 'CANNOT_ASSIGN_OWNER'
        | 'UNKNOWN';
    };

export async function inviteMemberAction(
  organizationId: string,
  formData: FormData,
): Promise<InviteMemberResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };

  const phone = ((formData.get('phone') as string | null) ?? '').trim() || undefined;
  const email = ((formData.get('email') as string | null) ?? '').trim().toLowerCase() || undefined;
  const role = formData.get('role') as 'admin' | 'planner' | 'viewer' | null;

  if (!phone && !email) return { ok: false, error: 'NO_CONTACT' };
  if (phone && !E164.test(phone)) return { ok: false, error: 'INVALID_PHONE' };
  if (role !== 'admin' && role !== 'planner' && role !== 'viewer') {
    return { ok: false, error: 'CANNOT_ASSIGN_OWNER' };
  }

  try {
    const convex = getConvexServerClient();
    const result = await convex.mutation(convexApi.inviteOrgMember, {
      organizationId,
      requesterId: session.userId,
      phone,
      email,
      role,
    });
    revalidatePath('/pro/team');
    return { ok: true, inviteToken: result.inviteToken };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message === 'FORBIDDEN') return { ok: false, error: 'FORBIDDEN' };
    if (message === 'ALREADY_MEMBER') return { ok: false, error: 'ALREADY_MEMBER' };
    if (message === 'CANNOT_ASSIGN_OWNER') return { ok: false, error: 'CANNOT_ASSIGN_OWNER' };
    if (message === 'NO_CONTACT') return { ok: false, error: 'NO_CONTACT' };
    return { ok: false, error: 'UNKNOWN' };
  }
}

export async function revokeMemberAction(
  membershipId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };

  try {
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.revokeOrgMembership, {
      membershipId,
      requesterId: session.userId,
    });
    revalidatePath('/pro/team');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export async function acceptInviteAction(
  token: string,
): Promise<{ ok: true; organizationId: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };

  try {
    const convex = getConvexServerClient();
    const result = await convex.mutation(convexApi.acceptOrgInvite, {
      token,
      userId: session.userId,
    });
    revalidatePath('/pro/dashboard');
    return { ok: true, organizationId: result.organizationId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export type UpdateBrandingResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'UNAUTHORIZED'
        | 'NO_ORG'
        | 'FORBIDDEN'
        | 'INVALID_COLOR'
        | 'INVALID_LOGO_TYPE'
        | 'INVALID_LOGO_SIZE'
        | 'UPLOAD_FAILED'
        | 'UNKNOWN';
    };

/**
 * Met à jour le branding (logo + couleurs) de l'organisation du pro
 * connecté.
 *
 * Pour le logo : on génère une upload URL Convex (mutation
 * `organizations:generateLogoUploadUrl`), on POST le blob côté serveur, on
 * récupère le `storageId` retourné par Convex, puis on commit via
 * `setLogo`. C'est la même mécanique que `ConvexHttpClient` côté browser,
 * mais en server-side : on évite de passer par le client (limite 4 Mo des
 * server actions, mais le logo fait max 2 Mo donc OK).
 *
 * Pour les couleurs : validation hex côté serveur en plus du `accept` côté
 * input (l'input color pourrait être contourné via un client modifié).
 */
export async function updateOrgBrandingAction(formData: FormData): Promise<UpdateBrandingResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };

  const primary = ((formData.get('primaryColor') as string | null) ?? '').trim();
  const accent = ((formData.get('accentColor') as string | null) ?? '').trim();
  const file = formData.get('logo');
  const removeLogo = formData.get('removeLogo') === 'true';

  if (primary && !HEX_COLOR_RE.test(primary)) return { ok: false, error: 'INVALID_COLOR' };
  if (accent && !HEX_COLOR_RE.test(accent)) return { ok: false, error: 'INVALID_COLOR' };

  const convex = getConvexServerClient();

  let org;
  try {
    org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  } catch {
    return { ok: false, error: 'UNKNOWN' };
  }
  if (!org) return { ok: false, error: 'NO_ORG' };
  if (org.myRole !== 'owner' && org.myRole !== 'admin') {
    return { ok: false, error: 'FORBIDDEN' };
  }

  let logoStorageId: string | undefined;
  if (file instanceof File && file.size > 0) {
    if (!(ALLOWED_LOGO_TYPES as readonly string[]).includes(file.type)) {
      return { ok: false, error: 'INVALID_LOGO_TYPE' };
    }
    if (file.size > LOGO_MAX_BYTES) return { ok: false, error: 'INVALID_LOGO_SIZE' };

    let uploadUrl: string;
    try {
      const r = await convex.mutation(convexApi.generateOrgLogoUploadUrl, {
        organizationId: org._id,
        requesterId: session.userId,
      });
      uploadUrl = r.uploadUrl;
    } catch {
      return { ok: false, error: 'UPLOAD_FAILED' };
    }

    let storageId: string;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: buffer,
      });
      if (!res.ok) return { ok: false, error: 'UPLOAD_FAILED' };
      const json = (await res.json()) as { storageId?: string };
      if (!json.storageId) return { ok: false, error: 'UPLOAD_FAILED' };
      storageId = json.storageId;
    } catch {
      return { ok: false, error: 'UPLOAD_FAILED' };
    }

    try {
      await convex.mutation(convexApi.setOrgLogo, {
        organizationId: org._id,
        requesterId: session.userId,
        logoStorageId: storageId,
      });
      logoStorageId = storageId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNKNOWN';
      if (message === 'FORBIDDEN') return { ok: false, error: 'FORBIDDEN' };
      return { ok: false, error: 'UNKNOWN' };
    }
  } else if (removeLogo) {
    try {
      await convex.mutation(convexApi.clearOrgLogo, {
        organizationId: org._id,
        requesterId: session.userId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNKNOWN';
      if (message === 'FORBIDDEN') return { ok: false, error: 'FORBIDDEN' };
      return { ok: false, error: 'UNKNOWN' };
    }
  }

  // Patch couleurs (et nom optionnellement plus tard) si renseignées.
  if (primary || accent) {
    try {
      await convex.mutation(convexApi.updateOrgBranding, {
        organizationId: org._id,
        requesterId: session.userId,
        primaryColor: primary || undefined,
        accentColor: accent || undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNKNOWN';
      if (message === 'FORBIDDEN') return { ok: false, error: 'FORBIDDEN' };
      if (message.startsWith('INVALID_')) return { ok: false, error: 'INVALID_COLOR' };
      return { ok: false, error: 'UNKNOWN' };
    }
  }

  // Side-effect: silence the lint about unused value after early returns.
  void logoStorageId;

  revalidatePath('/pro/settings');
  revalidatePath('/pro/dashboard');
  revalidatePath('/pro/billing');
  return { ok: true };
}
