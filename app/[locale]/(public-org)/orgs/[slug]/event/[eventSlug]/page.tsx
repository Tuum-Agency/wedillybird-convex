import type { CSSProperties } from 'react';
import { Calendar, MapPin } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

export const dynamic = 'force-dynamic';

/**
 * Page publique d'un événement servi sous le sous-domaine d'une
 * organisation : `<orgSlug>.wedillybird.com/event/<eventSlug>`.
 *
 * Contrairement à la page invitation par token (`/i/[token]`) qui
 * personnalise l'invité, cette page-ci affiche un descriptif générique
 * de l'événement (couple, date, lieu) — lien partageable que l'orga
 * peut envoyer à ses propres clients.
 *
 * Le filtrage sur `status === 'active'` et l'appartenance à l'orga est
 * fait côté Convex (`events.findPublicEventBySlug`). Toute incohérence
 * (event d'une autre orga, draft, archived) tombe sur `notFound()`.
 */
export default async function PublicOrgEventPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; eventSlug: string }>;
}) {
  const { locale, slug, eventSlug } = await params;
  setRequestLocale(locale);

  const convex = getConvexServerClient();
  const event = await convex.query(convexApi.findPublicEventBySlug, {
    orgSlug: slug,
    eventSlug,
  });
  if (!event) notFound();

  const t = await getTranslations('OrgPublic');

  const accentColor = event.theme?.primaryColor ?? 'var(--brand-primary, var(--color-primary))';
  const themeStyle = { '--invitation-accent': accentColor } as CSSProperties;

  const eventDateFormatted = new Intl.DateTimeFormat('fr', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: event.timezone,
  }).format(new Date(event.eventDate));

  return (
    <article
      className="container-page mx-auto flex w-full max-w-2xl flex-col gap-12 py-16 sm:py-24"
      style={themeStyle}
    >
      <header className="flex flex-col items-center gap-5 text-center">
        <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
          {t('eventEyebrow')}
        </span>
        <h1
          className="font-display text-balance italic"
          style={{
            fontSize: 'clamp(2.5rem, 6vw, 4rem)',
            lineHeight: 1.05,
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
          {event.title}
        </p>
      </header>

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
              {t('dateLabel')}
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
                {t('venueLabel')}
              </span>
              <p className="text-base font-medium text-[color:var(--color-ink-900)] sm:text-lg">
                {event.venue.name}
              </p>
              <p className="text-sm text-[color:var(--color-ink-500)]">{event.venue.address}</p>
            </div>
          </div>
        ) : null}
      </section>

      <p className="text-center text-sm text-[color:var(--color-ink-500)]">{t('eventCta')}</p>
    </article>
  );
}
