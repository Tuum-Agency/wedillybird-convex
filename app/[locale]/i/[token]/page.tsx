import type { CSSProperties } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { RsvpForm } from '@/components/invitee/rsvp-form';

export const dynamic = 'force-dynamic';

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const convex = getConvexServerClient();
  const data = await convex.query(convexApi.getGuestByToken, { token });
  if (!data) notFound();

  const { guest, event, organization } = data;
  const t = await getTranslations('Invitation');

  // Org branding (if event belongs to an org with branding) takes priority over
  // the per-event theme — pros customise their org once, not every event.
  const primaryColor =
    organization?.primaryColor ?? event.theme?.primaryColor ?? 'var(--color-primary)';
  const accentColor =
    organization?.accentColor ?? event.theme?.accentColor ?? 'var(--color-accent)';
  const fontFamily = event.theme?.fontFamily ?? 'var(--font-serif)';

  const themeStyle = {
    '--color-primary': primaryColor,
    '--color-accent': accentColor,
  } as CSSProperties;

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={themeStyle}
    >
      <article className="flex w-full max-w-xl flex-col gap-8">
        {organization?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={organization.logoUrl}
            alt={organization.name}
            className="mx-auto h-16 w-auto object-contain"
            data-testid="org-logo"
          />
        ) : null}
        <header className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm tracking-[0.3em] text-[color:var(--color-muted)] uppercase">
            {t('youreInvited')}
          </p>
          <h1
            className="font-display text-4xl leading-tight font-semibold sm:text-5xl"
            style={{ fontFamily }}
          >
            {event.coupleNames.partnerA}
            <span className="mx-3 text-[color:var(--color-accent)]">&amp;</span>
            {event.coupleNames.partnerB}
          </h1>
          <p className="text-base text-[color:var(--color-muted)]">
            {new Intl.DateTimeFormat('fr', {
              dateStyle: 'full',
              timeStyle: 'short',
              timeZone: event.timezone,
            }).format(new Date(event.eventDate))}
          </p>
          {event.venue ? (
            <p className="text-sm text-[color:var(--color-muted)]">
              {event.venue.name} — {event.venue.address}
            </p>
          ) : null}
        </header>

        <section className="flex flex-col gap-3 text-center">
          <p className="text-base">{t('addressing', { name: guest.fullName })}</p>
        </section>

        <RsvpForm
          token={token}
          plusOnesAllowed={guest.plusOnesAllowed}
          initial={{
            rsvpStatus: guest.rsvpStatus,
            plusOnesNames: guest.plusOnesNames,
            dietaryRestrictions: guest.dietaryRestrictions,
            notes: guest.notes,
          }}
        />

        <Link
          href={`/i/${token}/gallery`}
          className="focus-ring rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-center text-sm font-medium hover:bg-[color:var(--color-ivory-100)]"
        >
          {t('openGallery')}
        </Link>

        <footer className="text-center text-xs text-[color:var(--color-muted)]">
          {t('poweredBy')} <span className="font-display font-semibold">Wedillybird</span>
        </footer>
      </article>
    </main>
  );
}
