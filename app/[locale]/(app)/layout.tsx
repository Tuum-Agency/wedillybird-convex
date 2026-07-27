import type { ReactNode } from 'react';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { PostHogIdentify } from '@/components/analytics/posthog-identify';
import { BugReportWidget } from '@/components/bug-report/bug-report-widget';
import { SessionHydrator } from '@/components/providers/session-hydrator';

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) {
    redirect({ href: '/sign-in', locale });
  }

  // Profil non-PII pour l'identité analytics. Best-effort : ne doit jamais
  // bloquer le rendu de l'espace authentifié.
  const user = session
    ? await getConvexServerClient()
        .query(convexApi.currentUser, { userId: session.userId })
        .catch(() => null)
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--color-background)]">
      {session ? (
        <>
          <PostHogIdentify
            userId={session.userId}
            role={user?.role}
            planTier={user?.planTier}
            locale={user?.locale ?? locale}
            createdAt={user?.createdAt}
          />
          <SessionHydrator
            userId={session.userId}
            role={user?.role}
            phone={user?.phone}
            fullName={user?.fullName}
          />
        </>
      ) : null}
      {children}
      <BugReportWidget />
    </div>
  );
}
