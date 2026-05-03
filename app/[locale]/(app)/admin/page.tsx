import { setRequestLocale } from 'next-intl/server';
import {
  Users,
  CalendarDays,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { AdminShell } from '@/components/admin/admin-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminRevenueChart } from '@/components/admin/admin-revenue-chart';
import { AdminUsersChart } from '@/components/admin/admin-users-chart';
import { AdminCurrencyChart } from '@/components/admin/admin-currency-chart';
import { Link } from '@/i18n/navigation';

function formatEur(amountMinor: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)} %`;
}

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const convex = getConvexServerClient();
  const [user, kpi] = await Promise.all([
    convex.query(convexApi.currentUser, { userId: session!.userId }),
    convex.query(convexApi.adminDashboardKpi, { adminId: session!.userId }),
  ]);

  return (
    <AdminShell current="overview" adminName={user?.fullName}>
      <div className="flex flex-col gap-8">
        <header>
          <h1
            className="font-display italic"
            style={{
              fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.022em',
            }}
          >
            Vue d&apos;ensemble
          </h1>
          <p className="mt-2 text-sm text-[color:var(--color-muted-foreground)]">
            Tableau de bord de la plateforme Wedillybird
          </p>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            icon={<CreditCard className="h-4 w-4" />}
            label="Revenu total"
            value={formatEur(kpi.totalRevenueMinor)}
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="MRR"
            value={formatEur(kpi.mrrMinor)}
            sub={`${kpi.activeSubscriptions} abonnements`}
          />
          <KpiCard
            icon={<Users className="h-4 w-4" />}
            label="Utilisateurs"
            value={kpi.totalUsers.toString()}
            sub={`${kpi.usersByRole.couple} couples · ${kpi.usersByRole.pro} pros`}
          />
          <KpiCard
            icon={<CalendarDays className="h-4 w-4" />}
            label="Événements actifs"
            value={kpi.activeEvents.toString()}
            sub={`${kpi.totalEvents} total`}
          />
          <KpiCard
            icon={<Building2 className="h-4 w-4" />}
            label="Taux de conversion"
            value={formatPercent(kpi.conversionRate)}
            sub={`${kpi.paidEvents} payés / ${kpi.totalEvents} créés`}
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Paiements échoués"
            value={kpi.failedPaymentsCount.toString()}
            sub={formatEur(kpi.failedPaymentsAmountMinor)}
            variant="destructive"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Revenus par mois</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminRevenueChart data={kpi.revenueByMonth} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Nouveaux utilisateurs par mois
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdminUsersChart data={kpi.usersByMonth} />
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Répartition par devise</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminCurrencyChart data={kpi.revenueByCurrency} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Répartition par provider</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminCurrencyChart data={kpi.revenueByProvider} />
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink href="/admin/users" label="Gérer les utilisateurs" count={kpi.totalUsers} />
          <QuickLink href="/admin/events" label="Gérer les événements" count={kpi.totalEvents} />
          <QuickLink
            href="/admin/payments"
            label="Voir les paiements"
            count={kpi.failedPaymentsCount}
            suffix="échoués"
          />
          <QuickLink
            href="/admin/subscriptions"
            label="Voir les abonnements"
            count={kpi.activeSubscriptions}
            suffix="actifs"
          />
        </div>
      </div>
    </AdminShell>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  variant?: 'destructive';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-[color:var(--color-muted-foreground)]">
          {icon}
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase">{label}</span>
        </div>
        <p
          className={`mt-2 text-2xl font-semibold tracking-tight ${variant === 'destructive' ? 'text-red-400' : ''}`}
        >
          {value}
        </p>
        {sub ? (
          <p className="mt-1 text-xs text-[color:var(--color-muted-foreground)]">{sub}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function QuickLink({
  href,
  label,
  count,
  suffix,
}: {
  href: string;
  label: string;
  count: number;
  suffix?: string;
}) {
  return (
    <Link
      href={href as never}
      className="group flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 transition-colors hover:border-[color:var(--color-border-strong)]"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
        {count}
        {suffix ? ` ${suffix}` : ''}
      </span>
    </Link>
  );
}
