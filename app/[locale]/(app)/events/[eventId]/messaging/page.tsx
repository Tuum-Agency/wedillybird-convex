import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { AppShell } from '@/components/app/app-shell';
import { EventMessagingForm } from '@/components/events/event-messaging-form';
import { DEFAULT_INVITATION_STYLE } from '@/lib/whatsapp/templates';

/**
 * Page de personnalisation du message d'invitation WhatsApp.
 * Le couple choisit un style préfabriqué + saisit un mot perso (60 chars
 * max) + définit son canal préféré (WhatsApp / Email / les 2). Aperçu live
 * du rendu côté invité.
 */
export default async function MessagingPage({
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

  const eventDateFormatted = new Intl.DateTimeFormat('fr', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: event.timezone,
  }).format(new Date(event.eventDate));

  const baseUrl =
    process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://wedillybird.com';
  const previewInvitationUrl = `${baseUrl.replace(/\/$/, '')}/i/preview-token`;

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
              Personnaliser
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
              Le message d&apos;invitation
            </h1>
            <p className="max-w-2xl text-sm text-[color:var(--color-ink-500)] sm:text-base">
              Choisissez le style du message qui partira sur WhatsApp à chacun de vos invités. Vous
              pouvez ajouter un mot perso qui sera glissé dans le texte. L&apos;aperçu à droite met
              à jour en temps réel.
            </p>
          </header>
        </div>

        <EventMessagingForm
          eventId={eventId}
          coupleNames={`${event.coupleNames.partnerA} & ${event.coupleNames.partnerB}`}
          eventDate={eventDateFormatted}
          previewInvitationUrl={previewInvitationUrl}
          initialValues={{
            templateStyle: event.messagingConfig?.templateStyle ?? DEFAULT_INVITATION_STYLE,
            personalMessage: event.messagingConfig?.personalMessage ?? '',
            preferredChannel: event.messagingConfig?.preferredChannel ?? 'whatsapp',
          }}
        />
      </div>
    </AppShell>
  );
}
