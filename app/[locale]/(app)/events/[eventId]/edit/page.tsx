import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { AppShell } from '@/components/app/app-shell';
import { EventEditForm } from '@/components/events/event-edit-form';

/**
 * Page d'édition des détails d'un événement.
 * Charge l'event côté serveur, passe les valeurs initiales au form client.
 * Les modifications sont persistées via la server action `updateEventAction`.
 */
export default async function EditEventPage({
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

  // Format date pour <input type="datetime-local"> = "yyyy-MM-ddTHH:mm" en
  // local timezone du browser. On reconstruit côté client à partir d'ISO.
  const initialIsoDate = new Date(event.eventDate).toISOString().slice(0, 16);

  return (
    <AppShell>
      <div className="container-page flex flex-col gap-12 py-12 sm:py-16">
        <div className="flex flex-col gap-5">
          <Link
            href={`/events/${eventId}` as never}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-ink-900)]"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden />
            Retour à l&apos;événement
          </Link>
          <header className="flex flex-col gap-2">
            <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-gold-700)] uppercase">
              Modifier
            </span>
            <h1
              className="font-display text-balance italic"
              style={{
                fontSize: 'clamp(2rem, 4.5vw, 3rem)',
                lineHeight: 1.05,
                letterSpacing: '-0.022em',
                color: 'var(--color-ink-900)',
              }}
            >
              Détails de votre mariage
            </h1>
            <p className="text-sm text-[color:var(--color-ink-500)]">
              Mettez à jour les informations qui apparaîtront sur l&apos;invitation et le tableau de
              bord.
            </p>
          </header>
        </div>

        <EventEditForm
          eventId={eventId}
          initialValues={{
            title: event.title,
            partnerA: event.coupleNames.partnerA,
            partnerB: event.coupleNames.partnerB,
            eventDate: initialIsoDate,
            timezone: event.timezone,
            venueName: event.venue?.name ?? '',
            venueAddress: event.venue?.address ?? '',
            themePrimary: event.theme?.primaryColor ?? '#C4996C',
            themeAccent: event.theme?.accentColor ?? '#2B2B2B',
            themeFont: event.theme?.fontFamily ?? 'Playfair Display',
          }}
        />
      </div>
    </AppShell>
  );
}
