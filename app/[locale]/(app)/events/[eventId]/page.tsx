import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, MapPin, Camera, QrCode, Users } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { buttonVariants } from '@/components/ui/button';
import { AppShell } from '@/components/app/app-shell';
import { LiveGuestStats } from '@/components/events/live-guest-stats';
import { UpgradeCard } from '@/components/payments/upgrade-card';
import { routePayment } from '@/lib/payments/country';
import { cn } from '@/lib/cn';

type EventStatus = 'draft' | 'active' | 'archived' | 'cancelled';

const STATUS_CONFIG: Record<
  EventStatus,
  { labelKey: string; bg: string; fg: string; dot: string }
> = {
  draft: {
    labelKey: 'draftBadge',
    bg: 'oklch(94% 0.022 78)',
    fg: 'var(--color-ink-700)',
    dot: 'oklch(78% 0.075 78)',
  },
  active: {
    labelKey: 'activeBadge',
    bg: 'oklch(96% 0.018 145)',
    fg: 'oklch(50% 0.08 145)',
    dot: 'oklch(50% 0.08 145)',
  },
  archived: {
    labelKey: 'archivedBadge',
    bg: 'oklch(94% 0.012 78)',
    fg: 'var(--color-ink-500)',
    dot: 'var(--color-ink-500)',
  },
  cancelled: {
    labelKey: 'cancelledBadge',
    bg: 'oklch(96% 0.025 25)',
    fg: 'var(--color-blush-700)',
    dot: 'var(--color-blush-700)',
  },
};

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

  const user = await convex.query(convexApi.currentUser, { userId: session!.userId });
  const t = await getTranslations('EventDetail');
  const tDash = await getTranslations('Dashboard');
  const statusCfg = STATUS_CONFIG[event.status];

  const dateFormatted = new Intl.DateTimeFormat('fr', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: event.timezone,
  }).format(new Date(event.eventDate));

  return (
    <AppShell userName={user?.fullName}>
      <div className="container-page flex flex-col gap-12 py-12 sm:py-16">
        {/* Breadcrumb + header éditorial.
            Pour un compte particulier (couple) le dashboard EST cette page :
            on lui redirige déjà vers ici depuis /dashboard. Le breadcrumb
            "Retour au tableau de bord" est donc caché pour ne pas le
            renvoyer dans une boucle (on garde le breadcrumb pour les pros
            et admins qui ont une vraie liste à laquelle revenir). */}
        <div className="flex flex-col gap-5">
          {user?.role !== 'couple' ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-ink-900)]"
            >
              <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden />
              {t('backToDashboard')}
            </Link>
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1
                className="font-display text-balance italic"
                style={{
                  fontSize: 'clamp(2rem, 4.5vw, 3rem)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.022em',
                  color: 'var(--color-ink-900)',
                }}
              >
                {event.coupleNames.partnerA}{' '}
                <span style={{ color: 'var(--color-gold-500)' }}>&amp;</span>{' '}
                {event.coupleNames.partnerB}
              </h1>
              <p className="text-sm text-[color:var(--color-ink-500)]">{event.title}</p>
            </div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase"
              style={{ background: statusCfg.bg, color: statusCfg.fg }}
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: statusCfg.dot }}
              />
              {tDash(statusCfg.labelKey)}
            </span>
          </div>
        </div>

        {/* Cards date + lieu */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DetailCard
            Icon={Calendar}
            label={t('dateSection')}
            primary={dateFormatted}
            secondary={event.timezone}
          />
          <DetailCard
            Icon={MapPin}
            label={t('venueSection')}
            primary={event.venue?.name ?? t('noVenue')}
            secondary={event.venue?.address}
          />
        </section>

        {/* Live guest stats (component existant) */}
        <LiveGuestStats
          eventId={eventId}
          requesterId={session!.userId}
          initialCounts={counts}
          maxGuests={event.maxGuests}
        />

        {/* Upgrade card (component existant) */}
        <UpgradeCard
          eventId={eventId}
          currentTier={event.planTier}
          currency={routePayment(undefined).currency}
        />

        {/* Actions section */}
        <section className="flex flex-col gap-5 rounded-3xl border border-[color:var(--color-border)] bg-white p-7 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-blush-700)] uppercase">
              Vos invités
            </span>
            <h2
              className="font-display italic"
              style={{
                fontSize: 'clamp(1.5rem, 2.4vw, 2rem)',
                lineHeight: 1.15,
                letterSpacing: '-0.018em',
                color: 'var(--color-ink-900)',
              }}
            >
              {t('guestsTitle')}
            </h2>
            <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)] sm:text-base">
              {t('guestsSummary', {
                total: counts.total,
                attending: counts.attending,
                max: event.maxGuests,
              })}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Link
              href={`/events/${eventId}/guests`}
              className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'flex-1')}
            >
              <Users className="h-4 w-4" strokeWidth={2} aria-hidden />
              {t('manageGuests')}
            </Link>
            <Link
              href={`/events/${eventId}/check-in`}
              className={cn(buttonVariants({ variant: 'outline', size: 'md' }), 'flex-1')}
            >
              <QrCode className="h-4 w-4" strokeWidth={2} aria-hidden />
              {t('openCheckIn')}
            </Link>
            <Link
              href={`/events/${eventId}/gallery`}
              className={cn(buttonVariants({ variant: 'outline', size: 'md' }), 'flex-1')}
            >
              <Camera className="h-4 w-4" strokeWidth={2} aria-hidden />
              {t('openGallery')}
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function DetailCard({
  Icon,
  label,
  primary,
  secondary,
}: {
  Icon: typeof Calendar;
  label: string;
  primary: string;
  secondary?: string;
}) {
  return (
    <article className="flex items-start gap-4 rounded-3xl border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-soft)]">
      <span
        aria-hidden
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
        style={{
          background: 'oklch(95% 0.025 22)',
          color: 'var(--color-blush-700)',
        }}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
          {label}
        </span>
        <p className="text-base font-medium text-[color:var(--color-ink-900)]">{primary}</p>
        {secondary ? (
          <p className="text-sm text-[color:var(--color-ink-500)]">{secondary}</p>
        ) : null}
      </div>
    </article>
  );
}
