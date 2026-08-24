import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient, sessionTokenArg } from '@/lib/auth/convex-server';
import { AdminShell } from '@/components/admin/admin-shell';
import { AdminBugReportsTable } from '@/components/admin/admin-bug-reports-table';

/**
 * /admin/bug-reports — triage des signalements de bug soumis depuis l'app
 * (bouton flottant couple/agence). FR-only comme le reste de /admin.
 */
export default async function AdminBugReportsPage({
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
  const [user, reports] = await Promise.all([
    convex.query(convexApi.currentUser, { sessionToken }),
    convex.query(convexApi.listBugReports, { sessionToken }),
  ]);

  const open = reports.filter((r) => r.status === 'open');

  return (
    <AdminShell current="bug-reports" adminName={user?.fullName}>
      <div className="flex flex-col gap-6">
        <header>
          <h1
            className="font-display italic"
            style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.022em',
            }}
          >
            Rapports de bug
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            {reports.length} signalement{reports.length > 1 ? 's' : ''} · {open.length} à traiter.
            Soumis depuis le bouton flottant de l’app — faites évoluer le statut au fil du triage.
          </p>
        </header>
        <AdminBugReportsTable reports={reports} />
      </div>
    </AdminShell>
  );
}
