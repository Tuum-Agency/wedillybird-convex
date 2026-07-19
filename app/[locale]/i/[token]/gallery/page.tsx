import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { GuestGallery } from '@/components/gallery/guest-gallery';
import { TrackOnMount } from '@/components/analytics/track-on-mount';

export const dynamic = 'force-dynamic';

export default async function GuestGalleryPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const convex = getConvexServerClient();
  const data = await convex.query(convexApi.getGuestByToken, { token });
  if (!data) notFound();

  const photos = await convex.query(convexApi.listApprovedPhotosForGuest, { token });

  const t = await getTranslations('Gallery');

  return (
    <main className="container-page flex min-h-screen flex-1 flex-col gap-6 py-10">
      {/* Vue galerie publique (boucle virale invité). */}
      <TrackOnMount event="gallery_viewed" />
      <header className="flex flex-col gap-2">
        <Link
          href={`/i/${token}`}
          className="text-sm text-[color:var(--color-muted)] hover:underline"
        >
          ← {t('backToInvitation')}
        </Link>
        <h1 className="font-display text-3xl tracking-tight italic">
          {data.event.coupleNames.partnerA} &amp; {data.event.coupleNames.partnerB}
        </h1>
        <p className="text-sm text-[color:var(--color-muted)]">{t('guestHeader')}</p>
      </header>

      <GuestGallery token={token} inviteeName={data.guest.fullName} initialPhotos={photos} />
    </main>
  );
}
