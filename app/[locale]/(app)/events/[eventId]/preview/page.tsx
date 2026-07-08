import type { CSSProperties } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Camera, Eye, MapPin } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { asCinematicId, isCinematicId } from '@/components/invitation/cinematics/registry';
import { isMusicTrackId, musicTrackSrc } from '@/lib/invitation/music';
import { InvitationShell } from '@/components/invitation/invitation-shell';
import { InvitationPortrait } from '@/components/invitation/invitation-portrait';
import { InvitationSchedule } from '@/components/invitation/invitation-schedule';
import { WeddingCountdown } from '@/components/invitation/wedding-countdown';
import { LandingFooterRich } from '@/components/landing/footer-rich';
import { InvitationFooter } from '@/components/invitation/invitation-footer';

export const dynamic = 'force-dynamic';

/**
 * Page d'aperçu de l'invitation publique pour le couple.
 *
 * Rend la même cinematic + détails que `/i/[token]` mais :
 *  - charge l'event directement (pas via guest token, vu qu'on est en mode
 *    aperçu avant d'avoir des invités)
 *  - injecte un destinataire fictif "{prénom de l'invité}"
 *  - désactive le RSVP form (placeholder à la place)
 *  - bandeau "Aperçu" en haut, fixed, pour rappeler que c'est une démo
 *  - bouton "Retour à l'événement" toujours visible
 *
 * Restreint au owner de l'event (le particulier qui veut voir son rendu).
 */
export default async function EventPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; eventId: string }>;
  searchParams: Promise<{ cinematic?: string; music?: string }>;
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

  // Overrides d'aperçu (?cinematic=floral&music=jardin|off) — permettent aux
  // pickers d'essayer un thème/une piste AVANT d'enregistrer le choix.
  const overrides = await searchParams;
  const cinematic = isCinematicId(overrides.cinematic)
    ? overrides.cinematic
    : (event.invitationCinematic ?? null);
  let music: { url: string; title?: string } | null = null;
  if (overrides.music === 'off') {
    music = null;
  } else if (isMusicTrackId(overrides.music)) {
    music = { url: musicTrackSrc(overrides.music) };
  } else if (
    event.invitationMusic?.source === 'library' &&
    isMusicTrackId(event.invitationMusic.trackId)
  ) {
    music = { url: musicTrackSrc(event.invitationMusic.trackId) };
  } else if (event.invitationMusic?.source === 'custom' && event.invitationMusic.s3Key) {
    const cdn = process.env.CLOUDFRONT_DOMAIN;
    music = cdn
      ? { url: `https://${cdn}/${event.invitationMusic.s3Key}`, title: event.invitationMusic.title }
      : null;
  }

  // Photo du couple — même résolution CDN que la musique (event brut côté owner).
  const cdnDomain = process.env.CLOUDFRONT_DOMAIN;
  const photo =
    event.invitationPhoto?.s3Key && cdnDomain
      ? {
          url: `https://${cdnDomain}/${event.invitationPhoto.s3Key}`,
          width: event.invitationPhoto.width,
          height: event.invitationPhoto.height,
        }
      : null;

  const accentColor = event.theme?.primaryColor ?? 'oklch(72% 0.09 20)';

  const eventDateFormatted = new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: event.timezone,
  }).format(new Date(event.eventDate));

  const eventDateCompact = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: event.timezone,
  })
    .format(new Date(event.eventDate))
    .toUpperCase();

  const themeStyle = {
    '--invitation-accent': accentColor,
  } as CSSProperties;

  const t = await getTranslations('CoupleSpace');
  const tInv = await getTranslations('Invitation');

  return (
    <main
      className="paper-grain relative flex min-h-screen flex-col bg-[color:var(--color-ivory-50)]"
      style={themeStyle}
    >
      {/* Bandeau aperçu — fixed top, signal clair qu'on n'est pas sur la
          vraie invitation. Inclut un retour à la page event. */}
      <div className="fixed top-0 right-0 left-0 z-40 flex items-center justify-between gap-4 border-b border-[color:var(--color-border)] bg-[color:var(--color-ink-900)] px-5 py-2.5 text-white shadow-md">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.32em] uppercase">
          <Eye className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          {t('previewBanner')}
        </span>
        <Link
          href={`/events/${eventId}` as never}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.24em] text-white/80 uppercase transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden />
          {t('previewBack')}
        </Link>
      </div>

      {/* Padding-top pour ne pas que le bandeau couvre la cinematic */}
      <div className="pt-12">
        <InvitationShell
          token="preview"
          partnerA={event.coupleNames.partnerA}
          partnerB={event.coupleNames.partnerB}
          formattedDate={eventDateCompact}
          venueName={event.venue?.name}
          accentColor={accentColor}
          eventDate={event.eventDate}
          photoUrl={photo?.url}
          cinematic={cinematic}
          music={music}
        >
          <article className="container-page mx-auto flex w-full max-w-2xl flex-col gap-16 py-16 sm:py-24">
            {/* Header couple */}
            <header className="flex flex-col items-center gap-5 text-center">
              <InvitationPortrait
                photo={photo}
                alt={`${event.coupleNames.partnerA} & ${event.coupleNames.partnerB}`}
              />
              <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
                {tInv('youreInvited')}
              </span>
              <h1
                className="font-display text-balance italic"
                style={{
                  fontSize: 'clamp(2.75rem, 7vw, 4.5rem)',
                  lineHeight: 1,
                  letterSpacing: '-0.025em',
                  color: 'var(--color-ink-900)',
                }}
              >
                {event.coupleNames.partnerA}
                <br />
                <span
                  className="not-italic"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.4em',
                    fontWeight: 300,
                    letterSpacing: '0.4em',
                    color: 'var(--invitation-accent)',
                    display: 'inline-block',
                    margin: '0.25em 0',
                  }}
                >
                  &amp;
                </span>
                <br />
                {event.coupleNames.partnerB}
              </h1>
              <span
                aria-hidden
                className="my-2 inline-block h-px w-16"
                style={{ background: 'var(--invitation-accent)' }}
              />
              <p className="text-base leading-relaxed text-[color:var(--color-ink-700)] sm:text-lg">
                {t.rich('previewAddressing', {
                  name: (chunks) => (
                    <span className="font-medium text-[color:var(--color-ink-900)] underline decoration-dotted underline-offset-4">
                      {chunks}
                    </span>
                  ),
                })}
              </p>
            </header>

            {/* Countdown live */}
            <section className="flex flex-col items-center gap-5">
              <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
                {tInv('countdownLabel')}
              </span>
              <WeddingCountdown eventDate={event.eventDate} accentColor={accentColor} />
            </section>

            {/* Détails — date + lieu */}
            <section className="inv-card flex flex-col gap-6 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 shadow-[var(--shadow-soft)]">
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ background: 'var(--invitation-accent)' }}
                >
                  <Calendar className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
                    {tInv('dateAndTime')}
                  </span>
                  <p className="text-base text-[color:var(--color-ink-900)] sm:text-lg">
                    {eventDateFormatted}
                  </p>
                </div>
              </div>

              {event.venue ? (
                <div className="flex items-start gap-4 border-t border-[color:var(--color-border)] pt-6">
                  <span
                    aria-hidden
                    className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ background: 'var(--invitation-accent)' }}
                  >
                    <MapPin className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
                      {tInv('venue')}
                    </span>
                    <p className="text-base font-medium text-[color:var(--color-ink-900)] sm:text-lg">
                      {event.venue.name}
                    </p>
                    <p className="text-sm text-[color:var(--color-ink-500)]">
                      {event.venue.address}
                    </p>
                  </div>
                </div>
              ) : null}
            </section>

            {/* Déroulé de la journée */}
            <InvitationSchedule
              schedule={event.ceremonySchedule ?? []}
              title={tInv('scheduleTitle')}
            />

            {/* Placeholder RSVP — pas de form en mode aperçu */}
            <section className="inv-card flex flex-col items-center gap-4 rounded-3xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/60 p-8 text-center">
              <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
                {t('previewRsvpEyebrow')}
              </span>
              <p
                className="font-display text-balance italic"
                style={{
                  fontSize: 'clamp(1.125rem, 2vw, 1.375rem)',
                  lineHeight: 1.2,
                  letterSpacing: '-0.018em',
                  color: 'var(--color-ink-900)',
                }}
              >
                {t('previewRsvpTitle')}
              </p>
              <p className="text-sm text-[color:var(--color-ink-500)]">{t('previewRsvpHint')}</p>
            </section>

            {/* Lien galerie (statique en preview) */}
            <div className="group inv-card flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-5 opacity-80">
              <span className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                  style={{ background: 'var(--invitation-accent)' }}
                >
                  <Camera className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="flex flex-col">
                  <span className="text-base font-medium text-[color:var(--color-ink-900)]">
                    {tInv('openGallery')}
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
                    {t('previewGalleryCaption')}
                  </span>
                </span>
              </span>
              <span aria-hidden className="text-lg text-[color:var(--color-ink-500)]">
                →
              </span>
            </div>
          </article>
          {asCinematicId(cinematic) === 'seal' ? <LandingFooterRich /> : <InvitationFooter />}
        </InvitationShell>
      </div>
    </main>
  );
}
