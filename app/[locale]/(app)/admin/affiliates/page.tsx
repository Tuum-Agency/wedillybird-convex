import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient, sessionTokenArg } from '@/lib/auth/convex-server';
import { AdminShell } from '@/components/admin/admin-shell';
import { AdminAffiliatesBoard } from '@/components/admin/admin-affiliates-board';

/**
 * Admin affiliation (FR-only, comme le reste de /admin). Crée des affiliés
 * (invitation-only) et visualise le ledger de commissions/crédits. Le payout
 * cash reste groupé/manuel au MVP (décision conseil) ; le crédit particulier
 * est appliqué automatiquement au prochain checkout (phase 2c).
 */
export default async function AdminAffiliatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const sessionToken = await sessionTokenArg();
  const convex = getConvexServerClient();
  const [user, affiliates, referrals] = await Promise.all([
    convex.query(convexApi.currentUser, { sessionToken }),
    convex.query(convexApi.listAffiliates, { sessionToken }),
    convex.query(convexApi.listReferrals, { sessionToken }),
  ]);

  return (
    <AdminShell current="affiliates" adminName={user?.fullName ?? undefined}>
      <AdminAffiliatesBoard affiliates={affiliates} referrals={referrals} />
    </AdminShell>
  );
}
