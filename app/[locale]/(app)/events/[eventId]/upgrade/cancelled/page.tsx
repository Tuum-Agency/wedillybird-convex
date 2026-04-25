import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export default async function UpgradeCancelledPage({
  params,
}: {
  params: Promise<{ locale: string; eventId: string }>;
}) {
  const { locale, eventId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('Upgrade');

  return (
    <main className="container-page flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t('cancelledTitle')}</h1>
      <p className="text-base text-[color:var(--color-muted)]">{t('cancelledBody')}</p>
      <Link href={`/events/${eventId}`}>
        <Button>{t('backToEvent')}</Button>
      </Link>
    </main>
  );
}
