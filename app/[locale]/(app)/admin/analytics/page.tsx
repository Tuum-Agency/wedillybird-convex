import { setRequestLocale } from 'next-intl/server';
import {
  TrendingUp,
  TrendingDown,
  Users,
  CalendarDays,
  CreditCard,
  Timer,
  CalendarClock,
  Percent,
} from 'lucide-react';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient, sessionTokenArg } from '@/lib/auth/convex-server';
import { AdminShell } from '@/components/admin/admin-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminCountChart } from '@/components/admin/admin-count-chart';

function formatEur(amountMinor: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)} %`;
}

function delta(current: number, previous: number): { label: string; up: boolean } | null {
  if (previous === 0) return current > 0 ? { label: 'nouveau', up: true } : null;
  const change = (current - previous) / previous;
  return { label: `${change >= 0 ? '+' : ''}${(change * 100).toFixed(0)} %`, up: change >= 0 };
}

const WEEKDAYS = [
  { idx: 1, label: 'Lun' },
  { idx: 2, label: 'Mar' },
  { idx: 3, label: 'Mer' },
  { idx: 4, label: 'Jeu' },
  { idx: 5, label: 'Ven' },
  { idx: 6, label: 'Sam' },
  { idx: 0, label: 'Dim' },
];

export default async function AdminAnalyticsPage({
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
  const [user, a] = await Promise.all([
    convex.query(convexApi.currentUser, { sessionToken }),
    convex.query(convexApi.adminPlatformAnalytics, { sessionToken }),
  ]);

  const monthArr = (rec: Record<string, number>) =>
    Object.entries(rec)
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([m, v]) => ({ label: m.slice(2), value: v }));

  const weekdayArr = WEEKDAYS.map((w) => ({
    label: w.label,
    value: a.seasonality.eventsByWeekday[w.idx] ?? 0,
  }));

  const paidDelta = delta(a.trend.paidLast30, a.trend.paidPrev30);
  const revDelta = delta(a.trend.revenueLast30Minor, a.trend.revenuePrev30Minor);
  const evDelta = delta(a.trend.newEventsLast30, a.trend.newEventsPrev30);

  const totalMrr =
    a.subscriptions.mrrByTierMinor.starter +
    a.subscriptions.mrrByTierMinor.business +
    a.subscriptions.mrrByTierMinor.agency;

  return (
    <AdminShell current="analytics" adminName={user?.fullName}>
      <div className="flex flex-col gap-8">
        <header>
          <h1
            className="font-display italic"
            style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.022em',
            }}
          >
            Analytics
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            Conversion, abandon, saisonnalité et cohortes — sur 30 jours glissants.
          </p>
        </header>

        {/* Tendance 30 j */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TrendTile
            icon={<CreditCard className="h-4 w-4" />}
            label="Revenu (30 j)"
            value={formatEur(a.trend.revenueLast30Minor)}
            delta={revDelta}
            sub={`${formatEur(a.trend.revenuePrev30Minor)} les 30 j précédents`}
          />
          <TrendTile
            icon={<CreditCard className="h-4 w-4" />}
            label="Ventes (30 j)"
            value={a.trend.paidLast30.toString()}
            delta={paidDelta}
            sub={`${a.trend.paidPrev30} les 30 j précédents`}
          />
          <TrendTile
            icon={<CalendarDays className="h-4 w-4" />}
            label="Nouveaux events (30 j)"
            value={a.trend.newEventsLast30.toString()}
            delta={evDelta}
            sub={`${a.trend.newEventsPrev30} les 30 j précédents`}
          />
        </div>

        {/* Funnel + abandon */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Funnel de conversion (particuliers)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Funnel
                steps={[
                  {
                    label: 'Comptes couple',
                    value: a.funnel.couplesSignedUp,
                    icon: <Users className="h-4 w-4" />,
                  },
                  { label: 'Events créés', value: a.funnel.eventsCreated },
                  { label: 'Events publiés', value: a.funnel.eventsPublished },
                  { label: 'Checkout démarré', value: a.funnel.checkoutStarted },
                  { label: 'Payé', value: a.funnel.paid },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Abandon de checkout</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-[color:var(--color-warning)]">
                  <Percent className="h-5 w-5" />
                  {pct(a.checkout.abandonmentRate)}
                </span>
                <span className="text-xs text-[color:var(--color-muted-foreground)]">
                  {a.checkout.intentsStarted} intents démarrés · {a.checkout.byStatus.succeeded}{' '}
                  aboutis
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <StatusBar
                  label="Réussis"
                  value={a.checkout.byStatus.succeeded}
                  total={a.checkout.intentsStarted}
                  tone="success"
                />
                <StatusBar
                  label="En attente"
                  value={a.checkout.byStatus.pending}
                  total={a.checkout.intentsStarted}
                  tone="warning"
                />
                <StatusBar
                  label="Échoués"
                  value={a.checkout.byStatus.failed}
                  total={a.checkout.intentsStarted}
                  tone="danger"
                />
                <StatusBar
                  label="Annulés"
                  value={a.checkout.byStatus.cancelled}
                  total={a.checkout.intentsStarted}
                  tone="neutral"
                />
                <StatusBar
                  label="Remboursés"
                  value={a.checkout.byStatus.refunded}
                  total={a.checkout.intentsStarted}
                  tone="neutral"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timing + valeurs */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MiniTile
            icon={<Timer className="h-4 w-4" />}
            label="Durée checkout médiane"
            value={`${a.timing.medianCheckoutMinutes.toFixed(0)} min`}
          />
          <MiniTile
            icon={<CalendarClock className="h-4 w-4" />}
            label="Délai création → paiement"
            value={`${a.timing.medianCreateToPayHours.toFixed(0)} h`}
          />
          <MiniTile
            icon={<CreditCard className="h-4 w-4" />}
            label="Panier moyen (AOV)"
            value={formatEur(a.mix.aovMinor)}
          />
          <MiniTile
            icon={<Users className="h-4 w-4" />}
            label="Invités moyens / event"
            value={a.mix.avgGuests.toString()}
          />
        </div>

        {/* Saisonnalité / rush */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Rush mariages — events par mois d&apos;événement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdminCountChart data={monthArr(a.seasonality.eventsByEventMonth)} unit="events" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Croissance — events créés par mois
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdminCountChart
                data={monthArr(a.seasonality.eventsByCreatedMonth)}
                color="oklch(60% 0.15 270)"
                unit="events"
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Jour de la semaine des mariages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdminCountChart data={weekdayArr} color="oklch(65% 0.12 145)" unit="events" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Rush à venir</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <UpcomingRow label="Sous 30 jours" value={a.seasonality.upcoming.next30} />
                <UpcomingRow label="Sous 60 jours" value={a.seasonality.upcoming.next60} />
                <UpcomingRow label="Sous 90 jours" value={a.seasonality.upcoming.next90} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mix d'offres + abonnements */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Mix des offres</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-muted-foreground)] uppercase">
                Particuliers (events payés)
              </p>
              <div className="flex flex-col gap-2">
                <StatusBar
                  label="Essentiel"
                  value={a.mix.planMix.essential}
                  total={a.mix.planMix.essential + a.mix.planMix.premium}
                  tone="neutral"
                />
                <StatusBar
                  label="Premium"
                  value={a.mix.planMix.premium}
                  total={a.mix.planMix.essential + a.mix.planMix.premium}
                  tone="success"
                />
              </div>
              <p className="mt-4 mb-2 font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-muted-foreground)] uppercase">
                Pros (par tier)
              </p>
              <div className="flex flex-col gap-2">
                <StatusBar
                  label="Starter"
                  value={a.mix.proTierMix.starter}
                  total={
                    a.mix.proTierMix.starter + a.mix.proTierMix.business + a.mix.proTierMix.agency
                  }
                  tone="neutral"
                />
                <StatusBar
                  label="Business"
                  value={a.mix.proTierMix.business}
                  total={
                    a.mix.proTierMix.starter + a.mix.proTierMix.business + a.mix.proTierMix.agency
                  }
                  tone="success"
                />
                <StatusBar
                  label="Agency"
                  value={a.mix.proTierMix.agency}
                  total={
                    a.mix.proTierMix.starter + a.mix.proTierMix.business + a.mix.proTierMix.agency
                  }
                  tone="success"
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Abonnements pro · MRR {formatEur(totalMrr)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <SubStat label="Actifs" value={a.subscriptions.byStatus.active} />
                <SubStat label="Essai" value={a.subscriptions.byStatus.trialing} />
                <SubStat label="Impayés" value={a.subscriptions.byStatus.past_due} tone="danger" />
                <SubStat label="Annulés" value={a.subscriptions.byStatus.canceled} />
                <SubStat label="Non réglés" value={a.subscriptions.byStatus.unpaid} tone="danger" />
              </div>
              <div className="mt-4 flex flex-col gap-2 border-t border-[color:var(--color-border)] pt-4">
                <MrrRow label="Starter" value={a.subscriptions.mrrByTierMinor.starter} />
                <MrrRow label="Business" value={a.subscriptions.mrrByTierMinor.business} />
                <MrrRow label="Agency" value={a.subscriptions.mrrByTierMinor.agency} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}

function TrendTile({
  icon,
  label,
  value,
  delta,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: { label: string; up: boolean } | null;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-[color:var(--color-muted-foreground)]">
          <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase">
            {icon}
            {label}
          </span>
          {delta ? (
            <span
              className={`flex items-center gap-1 text-xs font-medium ${delta.up ? 'text-[color:var(--color-success)]' : 'text-[color:var(--color-danger)]'}`}
            >
              {delta.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {delta.label}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-[color:var(--color-muted-foreground)]">{sub}</p>
      </CardContent>
    </Card>
  );
}

function MiniTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-[color:var(--color-muted-foreground)]">
          {icon}
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase">{label}</span>
        </div>
        <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number; icon?: React.ReactNode }[] }) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {steps.map((s, i) => {
        const widthPct = Math.max((s.value / max) * 100, 2);
        const prev = i > 0 ? steps[i - 1]!.value : null;
        const conv = prev && prev > 0 ? (s.value / prev) * 100 : null;
        return (
          <div key={s.label} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium">
                {s.icon}
                {s.label}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono">{s.value}</span>
                {conv != null ? (
                  <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                    {conv.toFixed(0)} %
                  </span>
                ) : null}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${widthPct}%`, background: 'oklch(65% 0.15 22)' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const TONE_BG: Record<string, string> = {
  success: 'oklch(65% 0.12 145)',
  warning: 'oklch(70% 0.14 78)',
  danger: 'oklch(60% 0.18 22)',
  neutral: 'oklch(55% 0.03 280)',
};

function StatusBar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const widthPct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[color:var(--color-muted-foreground)]">{label}</span>
        <span className="font-mono">
          {value}
          {total > 0 ? (
            <span className="ml-1 text-[color:var(--color-muted-foreground)]">
              ({widthPct.toFixed(0)} %)
            </span>
          ) : null}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(widthPct, value > 0 ? 2 : 0)}%`, background: TONE_BG[tone] }}
        />
      </div>
    </div>
  );
}

function UpcomingRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2.5">
      <span className="text-sm text-[color:var(--color-muted-foreground)]">{label}</span>
      <span className="font-mono text-lg font-semibold">{value}</span>
    </div>
  );
}

function SubStat({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
      <p className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-semibold ${tone === 'danger' && value > 0 ? 'text-[color:var(--color-danger)]' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}

function MrrRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[color:var(--color-muted-foreground)]">{label}</span>
      <span className="font-mono">{formatEur(value)}/mois</span>
    </div>
  );
}
