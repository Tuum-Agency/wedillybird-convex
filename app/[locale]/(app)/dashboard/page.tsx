import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { signOutAction } from '@/app/[locale]/(auth)/actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Dashboard' });
  return { title: t('greeting', { name: '' }).trim() };
}

type EventStatus = 'draft' | 'active' | 'archived' | 'cancelled';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect({ href: '/sign-in', locale });
  }

  const convex = getConvexServerClient();
  const user = await convex.query(convexApi.currentUser, { userId: session!.userId });

  if (!user?.fullName) {
    redirect({ href: '/onboarding', locale });
  }

  const events = await convex.query(convexApi.listEventsByOwner, { ownerId: session!.userId });

  const t = await getTranslations('Dashboard');
  const tCommon = await getTranslations('Common');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container-page flex h-16 items-center justify-between border-b border-[color:var(--color-border)]">
        <span className="font-display text-xl font-semibold">Wedillybird</span>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            {tCommon('signOut')}
          </Button>
        </form>
      </header>

      <main className="container-page flex flex-1 flex-col gap-8 py-10">
        <section className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {t('greeting', { name: user!.fullName ?? '' })}
          </h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            {events.length === 0 ? t('noEvents') : t('eventsTitle')}
          </p>
        </section>

        {events.length === 0 ? (
          <section>
            <Link href="/events/new">
              <Button size="lg">{t('createEvent')}</Button>
            </Link>
          </section>
        ) : (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">{t('eventsTitle')}</h2>
              <Link href="/events/new">
                <Button size="sm">{t('createEvent')}</Button>
              </Link>
            </div>
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {events.map((ev) => (
                <li key={ev._id}>
                  <Link
                    href={`/events/${ev._id}`}
                    className="focus-ring flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 transition-colors hover:bg-[color:var(--color-ivory-100)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-lg leading-tight font-semibold">
                        {ev.title}
                      </h3>
                      <Badge variant={statusVariant(ev.status)}>{t(statusKey(ev.status))}</Badge>
                    </div>
                    <p className="text-sm text-[color:var(--color-muted)]">
                      {ev.coupleNames.partnerA} & {ev.coupleNames.partnerB}
                    </p>
                    <p className="text-sm">
                      {new Intl.DateTimeFormat('fr', {
                        dateStyle: 'long',
                        timeStyle: 'short',
                        timeZone: ev.timezone,
                      }).format(new Date(ev.eventDate))}
                    </p>
                    {ev.venue ? (
                      <p className="text-xs text-[color:var(--color-muted)]">{ev.venue.name}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function statusKey(
  status: EventStatus,
): 'draftBadge' | 'activeBadge' | 'archivedBadge' | 'cancelledBadge' {
  switch (status) {
    case 'active':
      return 'activeBadge';
    case 'archived':
      return 'archivedBadge';
    case 'cancelled':
      return 'cancelledBadge';
    default:
      return 'draftBadge';
  }
}

function statusVariant(status: EventStatus): 'primary' | 'neutral' | 'destructive' | 'accent' {
  switch (status) {
    case 'active':
      return 'accent';
    case 'cancelled':
      return 'destructive';
    case 'archived':
      return 'neutral';
    default:
      return 'primary';
  }
}
