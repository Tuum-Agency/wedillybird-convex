import type { CSSProperties } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Calendar, MapPin, Camera } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { resolveInvitationMusic } from '@/lib/invitation/music';
import { InvitationShell } from '@/components/invitation/invitation-shell';
import { WeddingCountdown } from '@/components/invitation/wedding-countdown';
import { RsvpFormV4 } from '@/components/invitation/rsvp-form-v4';
import { TrackOnMount } from '@/components/analytics/track-on-mount';

export const dynamic = 'force-dynamic';

/**
 * Page invitation guest sous le sous-domaine de l'orga :
 * `<orgSlug>.wedillybird.com/i/<token>`. Strictement la même logique que
 * `app/[locale]/i/[token]/page.tsx` côté lecture du guest, mais rendue
 * dans le wrapper `(public-org)` qui apply le branding orga.
 *
 * Le token reste globalement unique (pas scopé à l'orga) — un invité
 * d'une autre orga arrivant ici verra son invitation, simplement
 * encadrée du branding orga courant. C'est volontaire : le sous-domaine
 * est une vitrine, le token reste universel.
 */
export default async function PublicOrgInvitationPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const convex = getConvexServerClient();
  const data = await convex.query(convexApi.getGuestByToken, { token });
  if (!data) notFound();

  const { guest, event } = data;
  const t = await getTranslations('Invitation');

  const accentColor = event.theme?.primaryColor ?? 'var(--brand-primary, oklch(72% 0.09 20))';

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

  const themeStyle = { '--invitation-accent': accentColor } as CSSProperties;

  return (
    <main
      className="paper-grain relative flex min-h-screen flex-col bg-[color:var(--color-ivory-50)]"
      style={themeStyle}
    >
      {/* Vue invitation publique sous marque blanche (sous-domaine orga). */}
      <TrackOnMount event="invitation_viewed" properties={{ white_label: true }} />
      <InvitationShell
        token={token}
        partnerA={event.coupleNames.partnerA}
        partnerB={event.coupleNames.partnerB}
        formattedDate={eventDateCompact}
        venueName={event.venue?.name}
        accentColor={accentColor}
        eventDate={event.eventDate}
        cinematic={event.invitationCinematic}
        music={resolveInvitationMusic(event.invitationMusic)}
      >
        <article className="container-page mx-auto flex w-full max-w-2xl flex-col gap-16 py-16 sm:py-24">
          <header className="flex flex-col items-center gap-5 text-center">
            <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
              {t('youreInvited')}
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
              {t('addressing', { name: guest.fullName })}
            </p>
          </header>

          <section className="flex flex-col items-center gap-5">
            <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
              Compte à rebours
            </span>
            <WeddingCountdown eventDate={event.eventDate} accentColor={accentColor} />
          </section>

          <section className="flex flex-col gap-6 rounded-3xl border border-[color:var(--color-border)] bg-white p-8 shadow-[var(--shadow-soft)]">
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
                  Date &amp; heure
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
                    Lieu
                  </span>
                  <p className="text-base font-medium text-[color:var(--color-ink-900)] sm:text-lg">
                    {event.venue.name}
                  </p>
                  <p className="text-sm text-[color:var(--color-ink-500)]">{event.venue.address}</p>
                </div>
              </div>
            ) : null}
          </section>

          <section className="flex flex-col gap-5">
            <header className="flex flex-col items-center gap-3 text-center">
              <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
                Votre réponse
              </span>
            </header>
            <RsvpFormV4
              token={token}
              plusOnesAllowed={guest.plusOnesAllowed}
              accentColor={accentColor}
              initial={{
                rsvpStatus: guest.rsvpStatus,
                plusOnesNames: guest.plusOnesNames,
                dietaryRestrictions: guest.dietaryRestrictions,
                notes: guest.notes,
              }}
            />
          </section>

          <Link
            href={`/i/${token}/gallery`}
            className="focus-ring group flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--color-border)] bg-white px-6 py-5 transition-all hover:border-[color:var(--color-border-strong)] hover:shadow-[var(--shadow-soft)]"
          >
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
                  {t('openGallery')}
                </span>
                <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
                  Photos partagées par les invités
                </span>
              </span>
            </span>
            <span
              aria-hidden
              className="text-lg text-[color:var(--color-ink-500)] transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </article>
      </InvitationShell>
    </main>
  );
}
