import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { Button } from '@/components/ui/button';

export default async function UpgradeSuccessPage({
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

  const t = await getTranslations('Upgrade');

  return (
    <main className="container-page flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t('successTitle')}</h1>
      <p className="text-base text-[color:var(--color-muted)]">
        {t('successBody', {
          plan: t(`plans.${event.planTier}` as const),
          max: event.maxGuests,
        })}
      </p>
      <Link href={`/events/${eventId}`}>
        <Button>{t('backToEvent')}</Button>
      </Link>
    </main>
  );
}
