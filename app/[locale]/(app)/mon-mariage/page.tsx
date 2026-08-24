import { setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth/session';
import { redirect } from '@/i18n/navigation';
import { convexApi, convexSessionToken, getConvexServerClient } from '@/lib/auth/convex-server';
import { MonMariageApp } from '@/components/mon-mariage/app';

export const metadata = {
  title: 'Mon mariage — Espace couple',
  robots: { index: false, follow: false },
};

/**
 * Espace couple self-serve — le couple gère SON mariage en direct (forfait one-shot,
 * sans agence). Distinct du portail couple géré par une agence (`/espace-couple`).
 * Câblé Convex : un seul snapshot (`coupleSpace.bundle`) hydrate le store client ;
 * les écrans mutent ensuite en optimiste via les server actions. Le rétroplanning
 * par défaut est semé ici (idempotent) pour que la première visite soit complète.
 */
export default async function MonMariagePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const convex = getConvexServerClient();
  const { sessionToken } = await convexSessionToken();
  // Server Component : horloge lue une fois côté serveur puis passée en prop
  // (hydration-safe). Même dérogation que events/[eventId]/gallery/page.tsx.
  // eslint-disable-next-line react-hooks/purity -- Server Component, no re-render concern
  const nowMs = Date.now();
  const [user, initialBundle] = await Promise.all([
    convex.query(convexApi.currentUser, { sessionToken }),
    convex.query(convexApi.coupleSpaceBundle, { sessionToken }),
  ]);

  // Première visite : sème le rétroplanning par défaut puis relit le snapshot
  // (mutation idempotente — no-op dès qu'une phase existe).
  let bundle = initialBundle;
  if (bundle && bundle.phases.length === 0) {
    await convex.mutation(convexApi.coupleEnsureDefaultPlanning, {
      eventId: bundle.event.id,
      sessionToken,
    });
    bundle = await convex.query(convexApi.coupleSpaceBundle, { sessionToken });
  }

  return <MonMariageApp bundle={bundle} now={nowMs} userName={user?.fullName ?? undefined} />;
}
