import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';
import { AppShell } from '@/components/app/app-shell';
import { cn } from '@/lib/cn';

export default async function UpgradeCancelledPage({
  params,
}: {
  params: Promise<{ locale: string; eventId: string }>;
}) {
  const { locale, eventId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Upgrade');

  return (
    <AppShell>
      <div className="container-page mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-7 py-16 text-center">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-ivory-100)] text-[color:var(--color-ink-500)]"
          aria-hidden
        >
          <X className="h-7 w-7" strokeWidth={1.75} />
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
          {t('cancelledTitle')}
        </h1>
        <p className="max-w-md text-base leading-relaxed text-[color:var(--color-ink-500)] sm:text-lg">
          {t('cancelledBody')}
        </p>
        <Link
          href={`/events/${eventId}`}
          className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'mt-4')}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
          {t('backToEvent')}
        </Link>
      </div>
    </AppShell>
  );
}
