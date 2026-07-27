import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { eventHasFeature } from '@/convex/lib/entitlements';
import { AppShell } from '@/components/app/app-shell';
import { EventEditForm } from '@/components/events/event-edit-form';
import { RsvpQuestionsEditor } from '@/components/events/rsvp-questions-editor';
import { FaceSearchPrivacySection } from '@/components/events/face-search-privacy-section';
import { eventHasPremiumOnlyFeature } from '@/lib/payments/entitlements';

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

  // Propriétaire (couple solo ou agence) vs couple rattaché : ce dernier ne peut
  // éditer le questionnaire que si l'agence l'a autorisé (rsvpConfig.coupleCanEdit).
  const isOwner = event.ownerId === session!.userId;

  const t = await getTranslations('CoupleSpace');

  return (
    <AppShell>
      <div className="container-page flex flex-col gap-12 py-12 sm:py-16">
        <div className="flex flex-col gap-5">
          <Link
            href={`/events/${eventId}` as never}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-ink-900)]"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden />
            {t('backToEvent')}
          </Link>
          <header className="flex flex-col gap-2">
            <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-gold-700)] uppercase">
              {t('editEyebrow')}
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
              {t('editTitle')}
            </h1>
            <p className="text-sm text-[color:var(--color-ink-500)]">{t('editSubtitle')}</p>
          </header>
        </div>

        <EventEditForm
          eventId={eventId}
          cinematicUnlocked={eventHasFeature(
            { planTier: event.planTier, organizationId: event.organizationId },
            'cinematicInvitation',
          )}
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
            invitationCinematic: event.invitationCinematic ?? 'seal',
            musicChoice:
              event.invitationMusic?.source === 'custom'
                ? 'custom'
                : (event.invitationMusic?.trackId ?? 'none'),
            musicCustomTitle: event.invitationMusic?.title ?? '',
            invitationPhotoUrl:
              event.invitationPhoto?.s3Key && process.env.CLOUDFRONT_DOMAIN
                ? `https://${process.env.CLOUDFRONT_DOMAIN}/${event.invitationPhoto.s3Key}`
                : '',
            ceremonySchedule: event.ceremonySchedule ?? [],
          }}
        />

        <RsvpQuestionsEditor
          eventId={eventId}
          initialConfig={event.rsvpConfig}
          unlocked={eventHasPremiumOnlyFeature(event)}
          upgradeHref={`/events/${eventId}`}
          canEdit={isOwner || (event.rsvpConfig?.coupleCanEdit ?? false)}
          showDelegation={isOwner && !!event.organizationId}
        />

        <FaceSearchPrivacySection
          eventId={eventId}
          initialWeddingState={event.weddingState}
          initialFaceSearchEnabled={event.faceSearchEnabled === true}
          consentAt={event.faceSearchConsent?.enabledAt}
          unlocked={eventHasPremiumOnlyFeature(event)}
          upgradeHref={`/events/${eventId}`}
        />
      </div>
    </AppShell>
  );
}
