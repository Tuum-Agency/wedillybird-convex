import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { TeamManager } from '@/components/pro/team-manager';

export default async function ProTeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session!.userId });
  if (!org) redirect({ href: '/pro/onboarding', locale });

  const members = await convex.query(convexApi.listOrgMembers, {
    organizationId: org!._id,
    requesterId: session!.userId,
  });

  const t = await getTranslations('Pro');

  return (
    <main className="container-page flex flex-1 flex-col gap-6 py-10">
      <header className="flex flex-col gap-2">
        <Link
          href="/pro/dashboard"
          className="text-sm text-[color:var(--color-muted)] hover:underline"
        >
          ← {t('backToDashboard')}
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t('teamTitle')}</h1>
        <p className="text-sm text-[color:var(--color-muted)]">{t('teamSubtitle')}</p>
      </header>

      <TeamManager
        organizationId={org!._id}
        canManage={org!.myRole === 'owner' || org!.myRole === 'admin'}
        initialMembers={members}
      />
    </main>
  );
}
