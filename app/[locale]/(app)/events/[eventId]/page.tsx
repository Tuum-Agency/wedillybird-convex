import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LiveGuestStats } from '@/components/events/live-guest-stats';
import { UpgradeCard } from '@/components/payments/upgrade-card';
import { routePayment } from '@/lib/payments/country';

type EventStatus = 'draft' | 'active' | 'archived' | 'cancelled';

function statusKey(
  status: EventStatus,
): 'draftBadge' | 'activeBadge' | 'archivedBadge' | 'cancelledBadge' {
  if (status === 'active') return 'activeBadge';
  if (status === 'archived') return 'archivedBadge';
  if (status === 'cancelled') return 'cancelledBadge';
  return 'draftBadge';
}

function statusVariant(status: EventStatus): 'primary' | 'neutral' | 'destructive' | 'accent' {
  if (status === 'active') return 'accent';
  if (status === 'cancelled') return 'destructive';
  if (status === 'archived') return 'neutral';
  return 'primary';
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ locale: string; eventId: string }>;
}) {
  const { locale, eventId } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect({ href: '/sign-in', locale });
  }

  const convex = getConvexServerClient();
  const event = await convex.query(convexApi.getEventById, {
    eventId,
    requesterId: session!.userId,
  });
  if (!event) notFound();

  const counts = await convex.query(convexApi.countGuestsByEvent, {
    eventId,
    requesterId: session!.userId,
  });

  const t = await getTranslations('EventDetail');
  const tDash = await getTranslations('Dashboard');

  return (
    <main className="container-page flex flex-1 flex-col gap-8 py-10">
      <section className="flex flex-col gap-2">
        <Link href="/dashboard" className="text-sm text-[color:var(--color-muted)] hover:underline">
          ← {t('backToDashboard')}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{event.title}</h1>
            <p className="text-sm text-[color:var(--color-muted)]">
              {event.coupleNames.partnerA} &amp; {event.coupleNames.partnerB}
            </p>
          </div>
          <Badge variant={statusVariant(event.status)}>{tDash(statusKey(event.status))}</Badge>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="flex flex-col gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <h2 className="font-display text-lg font-semibold">{t('dateSection')}</h2>
          <p>
            {new Intl.DateTimeFormat('fr', {
              dateStyle: 'long',
              timeStyle: 'short',
              timeZone: event.timezone,
            }).format(new Date(event.eventDate))}
          </p>
          <p className="text-xs text-[color:var(--color-muted)]">{event.timezone}</p>
        </article>

        <article className="flex flex-col gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <h2 className="font-display text-lg font-semibold">{t('venueSection')}</h2>
          {event.venue ? (
            <>
              <p>{event.venue.name}</p>
              <p className="text-sm text-[color:var(--color-muted)]">{event.venue.address}</p>
            </>
          ) : (
            <p className="text-sm text-[color:var(--color-muted)]">{t('noVenue')}</p>
          )}
        </article>
      </section>

      <LiveGuestStats
        eventId={eventId}
        requesterId={session!.userId}
        initialCounts={counts}
        maxGuests={event.maxGuests}
      />

      <UpgradeCard
        eventId={eventId}
        currentTier={event.planTier}
        currency={routePayment(undefined).currency}
      />

      <section className="flex flex-col gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">{t('guestsTitle')}</h2>
            <p className="text-sm text-[color:var(--color-muted)]">
              {t('guestsSummary', {
                total: counts.total,
                attending: counts.attending,
                max: event.maxGuests,
              })}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/events/${eventId}/gallery`}>
              <Button variant="ghost">{t('openGallery')}</Button>
            </Link>
            <Link href={`/events/${eventId}/check-in`}>
              <Button variant="ghost">{t('openCheckIn')}</Button>
            </Link>
            <Link href={`/events/${eventId}/guests`}>
              <Button>{t('manageGuests')}</Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
