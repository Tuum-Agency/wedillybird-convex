import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { GuestsManager } from '@/components/guests/guests-manager';

export default async function GuestsPage({
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

  const guests = await convex.query(convexApi.listGuestsByEvent, {
    eventId,
    requesterId: session!.userId,
  });

  const t = await getTranslations('Guests');

  return (
    <main className="container-page flex flex-1 flex-col gap-6 py-10">
      <header className="flex flex-col gap-2">
        <Link
          href={`/events/${eventId}`}
          className="text-sm text-[color:var(--color-muted)] hover:underline"
        >
          ← {t('backToEvent')}
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            {t('summary', { total: guests.length, max: event.maxGuests })}
          </p>
        </div>
      </header>

      <GuestsManager eventId={eventId} initialGuests={guests} />
    </main>
  );
}
