import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { AppShell } from '@/components/app/app-shell';
import { CheckInManager } from '@/components/checkin/checkin-manager';

export default async function CheckInPage({
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

  const guests = await convex.query(convexApi.listGuestsForCheckIn, {
    eventId,
    requesterId: session!.userId,
  });

  const user = await convex.query(convexApi.currentUser, { userId: session!.userId });
  const t = await getTranslations('Checkin');

  return (
    <AppShell userName={user?.fullName}>
      <div className="container-page flex flex-col gap-8 py-12 sm:py-16">
        <header className="flex flex-col gap-3">
          <Link
            href={`/events/${eventId}`}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-ink-900)]"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden />
            {t('backToEvent')}
          </Link>
          <h1
            className="font-display text-balance italic"
            style={{
              fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
              color: 'var(--color-ink-900)',
            }}
          >
            {t('title')}
          </h1>
          <p className="text-sm text-[color:var(--color-ink-500)] sm:text-base">
            {event.coupleNames.partnerA} &amp; {event.coupleNames.partnerB} · {t('subtitle')}
          </p>
        </header>

        <CheckInManager eventId={eventId} initialGuests={guests} />
      </div>
    </AppShell>
  );
}
