import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Clock, Mail } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { WedillybirdMark } from '@/components/brand/wedillybird-mark';
import { ContactForm } from '@/components/marketing/contact-form';
import { LegalFooter } from '@/components/layout/legal-footer';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Contact' });
  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ContactShell />;
}

function ContactShell() {
  const t = useTranslations('Contact');
  const tCommon = useTranslations('Common');

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-[color:var(--color-ivory-50)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-ivory-50)]/65">
        <div className="container-page flex items-center justify-between gap-6 py-4">
          <Link
            href="/"
            className="font-display inline-flex items-center gap-2.5 text-xl tracking-tight text-[color:var(--color-ink-900)] italic"
          >
            <WedillybirdMark className="h-6 w-6 text-[color:var(--color-blush-500)]" />
            {tCommon('appName')}
          </Link>
          <Link
            href="/"
            className="focus-ring inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-ink-900)]"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            {tCommon('back')}
          </Link>
        </div>
      </header>

      <main id="main-content" className="container-page flex-1 py-16 lg:py-24" tabIndex={-1}>
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <section className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <span className="font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-gold-700)] uppercase">
                {t('eyebrow')}
              </span>
              <h1
                className="font-display text-balance italic"
                style={{
                  fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.022em',
                  color: 'var(--color-ink-900)',
                }}
              >
                {t('title')}
              </h1>
              <p className="max-w-md text-base leading-relaxed text-[color:var(--color-ink-700)]">
                {t('subtitle')}
              </p>
              <span
                aria-hidden
                className="mt-2 inline-block h-px w-16"
                style={{ background: 'oklch(78% 0.075 78)' }}
              />
            </div>

            <div className="flex flex-col gap-4">
              <h2 className="font-mono text-[11px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase">
                {t('infoTitle')}
              </h2>
              <ul className="flex flex-col gap-4">
                <ContactInfoRow
                  icon={<Mail className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
                  label={t('infoEmail')}
                >
                  <a
                    href={`mailto:${t('infoEmailValue')}`}
                    className="text-base text-[color:var(--color-ink-900)] underline-offset-4 transition-colors hover:text-[color:var(--color-blush-700)] hover:underline"
                  >
                    {t('infoEmailValue')}
                  </a>
                </ContactInfoRow>
                <ContactInfoRow
                  icon={<Mail className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
                  label={t('infoSupport')}
                >
                  <a
                    href={`mailto:${t('infoSupportValue')}`}
                    className="text-base text-[color:var(--color-ink-900)] underline-offset-4 transition-colors hover:text-[color:var(--color-blush-700)] hover:underline"
                  >
                    {t('infoSupportValue')}
                  </a>
                </ContactInfoRow>
                <ContactInfoRow
                  icon={<Mail className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
                  label={t('infoPrivacy')}
                >
                  <a
                    href={`mailto:${t('infoPrivacyValue')}`}
                    className="text-base text-[color:var(--color-ink-900)] underline-offset-4 transition-colors hover:text-[color:var(--color-blush-700)] hover:underline"
                  >
                    {t('infoPrivacyValue')}
                  </a>
                </ContactInfoRow>
                <ContactInfoRow
                  icon={<Clock className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
                  label={t('infoHours')}
                >
                  <span className="text-base text-[color:var(--color-ink-700)]">
                    {t('infoHoursValue')}
                  </span>
                </ContactInfoRow>
              </ul>
            </div>
          </section>

          <section className="rounded-3xl border border-[color:var(--color-border)] bg-white p-7 shadow-[var(--shadow-soft)] sm:p-9">
            <ContactForm />
          </section>
        </div>
      </main>

      <LegalFooter />
    </>
  );
}

function ContactInfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--color-blush-50)] text-[color:var(--color-blush-700)]"
      >
        {icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase">
          {label}
        </span>
        {children}
      </div>
    </li>
  );
}
