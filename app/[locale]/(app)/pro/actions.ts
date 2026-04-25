'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

const E164 = /^\+[1-9]\d{6,14}$/;

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
