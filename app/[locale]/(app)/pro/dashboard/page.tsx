import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { ProSidebarShell } from '@/components/pro/pro-sidebar-shell';
import { Cockpit } from '@/components/pro/cockpit';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ProPages');
  return { title: t('dashboardMetaTitle') };
}

/**
 * Cockpit agence — tableau de bord du back-office pro (dark Linear-grade).
 *
 * Server component : valide la session, charge les agrégats réels via la query
 * `pro:cockpit`, puis rend le shell sidebar + le cockpit. Sans organisation →
 * redirection vers l'onboarding pro.
 */
export default async function ProDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const convex = getConvexServerClient();
  const [data, user] = await Promise.all([
    convex.query(convexApi.proCockpit, { userId: session!.userId }),
    convex.query(convexApi.currentUser, { userId: session!.userId }),
  ]);
  if (!data) redirect({ href: '/pro/onboarding', locale });

  return (
    <ProSidebarShell
      current="dashboard"
      org={{
        name: data!.org.name,
        primaryColor: data!.org.primaryColor,
        tier: data!.org.subscriptionTier ?? null,
        role: data!.myRole,
      }}
      user={{ name: user?.fullName }}
      eventsUsed={data!.usage.activeEvents}
    >
      <Cockpit
        org={data!.org}
        usage={data!.usage}
        kpis={data!.kpis}
        kpiTrends={data!.kpiTrends}
        upcoming={data!.upcoming}
        pipeline={data!.pipeline}
        deadlines={data!.deadlines}
        overdueTasks={data!.overdueTasks}
        recentActivity={data!.recentActivity}
        rsvpTrend={data!.rsvpTrend}
        userName={user?.fullName}
        locale={locale}
      />
    </ProSidebarShell>
  );
}
