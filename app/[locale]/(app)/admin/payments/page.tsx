import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { AdminShell } from '@/components/admin/admin-shell';
import { AdminPaymentsTable } from '@/components/admin/admin-payments-table';

export default async function AdminPaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const convex = getConvexServerClient();
  const [user, payments] = await Promise.all([
    convex.query(convexApi.currentUser, { userId: session!.userId }),
    convex.query(convexApi.adminListAllPayments, { adminId: session!.userId }),
  ]);

  return (
    <AdminShell current="payments" adminName={user?.fullName}>
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
            Paiements
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            {payments.length} transactions enregistrées
          </p>
        </header>
        <AdminPaymentsTable payments={payments} />
      </div>
    </AdminShell>
  );
}
