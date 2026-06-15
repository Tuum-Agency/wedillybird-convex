import 'server-only';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

/**
 * Charge le contexte commun des pages du back-office pro : session valide +
 * organisation active + user courant. Redirige vers `/sign-in` (pas de session)
 * ou `/pro/onboarding` (pas d'organisation). À utiliser en tête de chaque page
 * `/pro/*` qui n'a pas de logique de chargement spécifique.
 */
export async function requireProContext(locale: string) {
  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const convex = getConvexServerClient();
  const [org, user] = await Promise.all([
    convex.query(convexApi.myOrganization, { userId: session!.userId }),
    convex.query(convexApi.currentUser, { userId: session!.userId }),
  ]);
  if (!org) redirect({ href: '/pro/onboarding', locale });

  return { session: session!, org: org!, user };
}
