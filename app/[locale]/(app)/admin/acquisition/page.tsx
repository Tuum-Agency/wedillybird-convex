import { setRequestLocale } from 'next-intl/server';
import {
  Users,
  MousePointerClick,
  Eye,
  KeyRound,
  TriangleAlert,
  Languages,
  Tag,
  PlayCircle,
  ExternalLink,
} from 'lucide-react';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient, sessionTokenArg } from '@/lib/auth/convex-server';
import {
  getAcquisitionAnalytics,
  getRecentSessions,
  replayUrl,
  replayListUrl,
  type RecentSessions,
} from '@/lib/analytics/posthog-query';
import { AdminShell } from '@/components/admin/admin-shell';
import { AdminCountChart } from '@/components/admin/admin-count-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Acquisition — analytics MARKETING (PostHog) dans le back-office Super Admin.
 *
 * Complète `/admin/analytics` (données backend Convex, à partir des comptes
 * créés) en montrant le HAUT du funnel : visiteurs, CTA, et où ça décroche
 * AVANT l'inscription. Lecture via l'API Query PostHog (cf. posthog-query.ts).
 *
 * Le contrôle du rôle admin est assuré par `admin/layout.tsx` (redirige les
 * non-admins). Ici on ne fait que récupérer le nom pour la sidebar.
 */
export default async function AdminAcquisitionPage({
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
  const [user, data, sessions] = await Promise.all([
    convex.query(convexApi.currentUser, { sessionToken }),
    getAcquisitionAnalytics(30),
    getRecentSessions(8),
  ]);

  return (
    <AdminShell current="acquisition" adminName={user?.fullName}>
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
            Acquisition
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            Trafic, CTA et funnel marketing — ce qui se passe <em>avant</em> l&apos;inscription.
            Source PostHog, 30 jours glissants.
          </p>
        </header>

        {/* Rejeux de session (PostHog) — liste native + accès player en 1 clic */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <PlayCircle className="h-4 w-4" /> Rejeux de session
                </CardTitle>
                <span className="text-xs text-[color:var(--color-muted-foreground)]">
                  Regarde comment les visiteurs naviguent vraiment — pour repérer les frictions.
                </span>
              </div>
              <a
                href={replayListUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)]"
              >
                Tout voir <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </CardHeader>
          <CardContent>
            <SessionsList sessions={sessions} />
          </CardContent>
        </Card>

        {data.state === 'not_configured' ? (
          <SetupNotice />
        ) : data.state === 'error' ? (
          <ErrorNotice message={data.message} />
        ) : (
          <>
            {/* Trafic */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TrendTile
                icon={<Eye className="h-4 w-4" />}
                label="Pages vues (30 j)"
                value={data.traffic.pageviews.toLocaleString('fr-FR')}
              />
              <TrendTile
                icon={<Users className="h-4 w-4" />}
                label="Visiteurs uniques (30 j)"
                value={data.traffic.uniqueVisitors.toLocaleString('fr-FR')}
              />
            </div>

            {/* Funnel marketing complet */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  Funnel marketing — visite → achat
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Funnel steps={data.funnel} />
              </CardContent>
            </Card>

            {/* CTA par source */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <MousePointerClick className="h-4 w-4" /> Clics CTA par source
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AdminCountChart data={data.ctaBySource} unit="clics" />
              </CardContent>
            </Card>

            {/* Langue + tier */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Languages className="h-4 w-4" /> Inscriptions par langue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AdminCountChart
                    data={data.signupByLocale}
                    color="oklch(60% 0.15 270)"
                    unit="signups"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Tag className="h-4 w-4" /> Forfaits sélectionnés par tier
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AdminCountChart
                    data={data.planByTier}
                    color="oklch(65% 0.12 145)"
                    unit="sélections"
                  />
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-[color:var(--color-muted-foreground)]">
              Données capturées côté visiteur (consentement RGPD requis) + events serveur fiables.
              Le funnel ci-dessus précède « Comptes couple » de la page Analytics.
            </p>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function SetupNotice() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-6">
        <span className="flex items-center gap-2 text-base font-medium text-[color:var(--color-warning)]">
          <KeyRound className="h-5 w-5" /> Analytics marketing à activer
        </span>
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          Cette vue lit les données PostHog via l&apos;API Query, qui nécessite une clé personnelle.
          Crée une clé scopée <code className="font-mono text-xs">query:read</code> dans PostHog
          (Settings → Personal API keys), puis pose-la en variable d&apos;environnement{' '}
          <code className="font-mono text-xs">POSTHOG_PERSONAL_API_KEY</code> (Vercel production +{' '}
          <code className="font-mono text-xs">.env.local</code>). La page s&apos;activera
          automatiquement.
        </p>
      </CardContent>
    </Card>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-6">
        <span className="flex items-center gap-2 text-base font-medium text-[color:var(--color-danger)]">
          <TriangleAlert className="h-5 w-5" /> Requête PostHog en échec
        </span>
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          La clé est peut-être invalide ou sans le scope{' '}
          <code className="font-mono text-xs">query:read</code>.
        </p>
        <p className="font-mono text-xs text-[color:var(--color-muted-foreground)]">{message}</p>
      </CardContent>
    </Card>
  );
}

function TrendTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-[color:var(--color-muted-foreground)]">
          <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase">
            {icon}
            {label}
          </span>
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
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
              <span className="font-medium">{s.label}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono">{s.value.toLocaleString('fr-FR')}</span>
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

function StateText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[color:var(--color-muted-foreground)]">{children}</p>;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function formatSessionDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function SessionsList({ sessions }: { sessions: RecentSessions }) {
  if (sessions.state === 'not_configured') {
    return <StateText>Clé PostHog non configurée.</StateText>;
  }
  if (sessions.state === 'scope_missing') {
    return (
      <StateText>
        Ajoute le scope <code className="font-mono text-xs">session_recording:read</code> à la clé
        pour lister les sessions ici (« Tout voir » reste disponible).
      </StateText>
    );
  }
  if (sessions.state === 'error') {
    return <StateText>Erreur PostHog : {sessions.message}</StateText>;
  }
  if (sessions.sessions.length === 0) {
    return (
      <StateText>
        Aucune session enregistrée pour l&apos;instant — le replay vient d&apos;être activé, les
        sessions consenties apparaîtront ici au fil du trafic.
      </StateText>
    );
  }
  return (
    <div className="flex flex-col divide-y divide-[color:var(--color-border)]">
      {sessions.sessions.map((s) => (
        <a
          key={s.id}
          href={replayUrl(s.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="-mx-2 flex items-center justify-between gap-3 rounded px-2 py-2.5 transition-colors hover:bg-[color:var(--color-surface-elevated)]"
        >
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">{formatSessionDate(s.startTime)}</span>
            <span className="truncate font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
              {s.startUrl ?? s.person ?? '—'}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs text-[color:var(--color-muted-foreground)]">
            <span className="font-mono">{formatDuration(s.durationSec)}</span>
            <span className="font-mono">{s.clicks} clics</span>
            <span style={{ color: 'oklch(65% 0.15 22)' }}>Voir →</span>
          </div>
        </a>
      ))}
    </div>
  );
}
