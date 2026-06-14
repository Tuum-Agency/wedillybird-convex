import { setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth/session';
import { redirect } from '@/i18n/navigation';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { MonMariageApp } from '@/components/mon-mariage/app';

export const metadata = {
  title: 'Mon mariage — Espace couple',
  robots: { index: false, follow: false },
};

/**
 * Espace couple self-serve — le couple gère SON mariage en direct (forfait one-shot,
 * sans agence). Refonte « Mon mariage » : accueil, dashboard, rétroplanning,
 * prestataires, budget, plan de table, forfait. Distinct du portail couple géré par
 * une agence (`/espace-couple`). Données mock pour l'instant ; câblage Convex
 * (invités/RSVP, prestataires, budget, planning, paiement one-shot) en cours.
 */
export default async function MonMariagePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const convex = getConvexServerClient();
  const user = await convex.query(convexApi.currentUser, { userId: session!.userId });

  return <MonMariageApp userName={user?.fullName ?? undefined} />;
}
