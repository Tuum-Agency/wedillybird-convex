import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type EventStatus = 'draft' | 'active' | 'archived' | 'cancelled';

function statusVariant(status: EventStatus): 'primary' | 'neutral' | 'destructive' | 'accent' {
  if (status === 'active') return 'accent';
  if (status === 'cancelled') return 'destructive';
  if (status === 'archived') return 'neutral';
  return 'primary';
}

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
  const org = await convex.query(convexApi.myOrganization, { userId: session!.userId });
  if (!org) redirect({ href: '/pro/onboarding', locale });

  const events = await convex.query(convexApi.listOrgEvents, {
    organizationId: org!._id,
    requesterId: session!.userId,
  });

  const t = await getTranslations('Pro');
  const tDash = await getTranslations('Dashboard');

  return (
    <main className="container-page flex flex-1 flex-col gap-8 py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs tracking-[0.25em] text-[color:var(--color-muted)] uppercase">
            {t('orgBadge')}
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{org!.name}</h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            {t('memberRole')} : {t(`roles.${org!.myRole}` as const)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/pro/team">
            <Button variant="ghost">{t('manageTeam')}</Button>
          </Link>
          <Link href="/events/new">
            <Button>{t('createEvent')}</Button>
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-semibold">{t('orgEventsTitle')}</h2>
        {events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[color:var(--color-border)] p-10 text-center text-sm text-[color:var(--color-muted)]">
            {t('emptyEvents')}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {events.map((ev) => (
              <li key={ev._id}>
                <Link
                  href={`/events/${ev._id}`}
                  className="focus-ring flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 transition-colors hover:bg-[color:var(--color-ivory-100)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-lg leading-tight font-semibold">{ev.title}</h3>
                    <Badge variant={statusVariant(ev.status)}>
                      {tDash(
                        (ev.status === 'active'
                          ? 'activeBadge'
                          : ev.status === 'archived'
                            ? 'archivedBadge'
                            : ev.status === 'cancelled'
                              ? 'cancelledBadge'
                              : 'draftBadge') as
                          | 'draftBadge'
                          | 'activeBadge'
                          | 'archivedBadge'
                          | 'cancelledBadge',
                      )}
                    </Badge>
                  </div>
                  <p className="text-sm text-[color:var(--color-muted)]">
                    {ev.coupleNames.partnerA} &amp; {ev.coupleNames.partnerB}
                  </p>
                  <p className="text-sm">
                    {new Intl.DateTimeFormat('fr', {
                      dateStyle: 'long',
                      timeZone: ev.timezone,
                    }).format(new Date(ev.eventDate))}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
