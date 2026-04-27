'use server';

import { headers } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import {
  requestMagicLinkSchema,
  requestOtpSchema,
  verifyOtpSchema,
  onboardingSchema,
} from '@/lib/validators/auth';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { clearSessionCookie, getSession, setSessionCookie } from '@/lib/auth/session';

type ActionResult =
  | { ok: true; phone?: string; email?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export async function requestOtpAction(formData: FormData): Promise<ActionResult> {
  const parsed = requestOtpSchema.safeParse({ phone: formData.get('phone') });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const convex = getConvexServerClient();
  const headersList = await headers();
  const ipAddress =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    undefined;

  try {
    await convex.action(convexApi.requestOtp, {
      phone: parsed.data.phone,
      ...(ipAddress ? { ipAddress } : {}),
    });
    return { ok: true, phone: parsed.data.phone };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export async function verifyOtpAction(formData: FormData): Promise<ActionResult> {
  const parsed = verifyOtpSchema.safeParse({
    phone: formData.get('phone'),
    code: formData.get('code'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const convex = getConvexServerClient();

  try {
    const result = await convex.mutation(convexApi.verifyOtp, {
      phone: parsed.data.phone,
      code: parsed.data.code,
    });

    await setSessionCookie({
      userId: result.userId,
      phone: result.phone,
      issuedAt: Date.now(),
    });

    return { ok: true, phone: result.phone };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export async function completeOnboardingAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHENTICATED' };

  const parsed = onboardingSchema.safeParse({
    fullName: formData.get('fullName') ?? undefined,
    role: formData.get('role') ?? undefined,
    email: formData.get('email') ?? undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const convex = getConvexServerClient();

  try {
    await convex.mutation(convexApi.completeOnboarding, {
      userId: session.userId,
      fullName: parsed.data.fullName,
      role: parsed.data.role,
      ...(parsed.data.email ? { email: parsed.data.email } : {}),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }

  redirect({ href: '/dashboard', locale: 'fr' });
  return { ok: true };
}

/**
 * Magic Link — fallback auth pour les utilisateurs sans WhatsApp.
 *
 * Côté serveur, on déclenche l'action Convex requestMagicLink qui :
 *  1. valide l'email
 *  2. vérifie le rate limit (3/h par email)
 *  3. génère un token 256 bits + sauvegarde le hash
 *  4. envoie l'email via SES (driver mock en dev)
 *
 * On NE lève PAS d'erreur pour 'NO_USER' — on retourne ok:true même si
 * l'email n'existe pas, pour empêcher l'énumération des comptes (best
 * practice anti user-enumeration).
 */
export async function requestMagicLinkAction(formData: FormData): Promise<ActionResult> {
  const parsed = requestMagicLinkSchema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'INVALID_INPUT',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const convex = getConvexServerClient();
  const headersList = await headers();
  const ipAddress =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    undefined;

  try {
    await convex.action(convexApi.requestMagicLink, {
      email: parsed.data.email,
      ...(ipAddress ? { ipAddress } : {}),
    });
    return { ok: true, email: parsed.data.email };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export async function signOutAction(): Promise<void> {
  await clearSessionCookie();
  redirect({ href: '/', locale: 'fr' });
}
