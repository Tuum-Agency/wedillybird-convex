'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

function redirectUnsafe(url: string): never {
  return redirect(url as never);
}

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export async function updateBrandingAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirectUnsafe('/login?next=/pro/branding');

  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org) redirectUnsafe('/pro/onboarding');

  const primary = (formData.get('primaryColor') ?? '').toString().trim();
  const accent = (formData.get('accentColor') ?? '').toString().trim();
  const logoS3KeyRaw = formData.get('logoS3Key');
  const logoS3Key =
    typeof logoS3KeyRaw === 'string' && logoS3KeyRaw.length > 0 ? logoS3KeyRaw : undefined;

  if (primary && !HEX_COLOR_RE.test(primary)) {
    redirectUnsafe('/pro/branding?status=error&code=invalid_primary');
  }
  if (accent && !HEX_COLOR_RE.test(accent)) {
    redirectUnsafe('/pro/branding?status=error&code=invalid_accent');
  }

  await convex.mutation(convexApi.updateOrgBranding, {
    organizationId: org._id,
    requesterId: session.userId,
    primaryColor: primary || undefined,
    accentColor: accent || undefined,
    logoS3Key,
  });

  revalidatePath('/pro/branding');
  redirectUnsafe('/pro/branding?status=saved');
}

export async function requestLogoUploadUrlAction(input: {
  contentType: string;
}): Promise<{ ok: true; uploadUrl: string; s3Key: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };

  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org) return { ok: false, error: 'NO_ORG' };

  try {
    const res = await convex.action(convexApi.createOrgLogoUploadUrl, {
      organizationId: org._id,
      requesterId: session.userId,
      contentType: input.contentType,
    });
    return { ok: true, ...res };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}
