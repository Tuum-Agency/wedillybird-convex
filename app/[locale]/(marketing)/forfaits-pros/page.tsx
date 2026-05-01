import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { OG_DEFAULT_IMAGES, TWITTER_DEFAULT_IMAGES } from '@/lib/seo/og';
import { Link } from '@/i18n/navigation';
import { WedillybirdLogo } from '@/components/brand/wedillybird-logo';
import { LandingPricingPros } from '@/components/landing/pricing-pros';
import { LandingFooterRich } from '@/components/landing/footer-rich';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata.forfaitsPros' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/forfaits-pros' },
    openGraph: {
      type: 'website',
      title: t('title'),
      description: t('description'),
      url: '/forfaits-pros',
      siteName: 'Wedillybird',
      locale: 'fr_FR',
      images: [...OG_DEFAULT_IMAGES],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: [...TWITTER_DEFAULT_IMAGES],
    },
  };
}

export default async function ForfaitsProsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ForfaitsProsShell />;
}

function ForfaitsProsShell() {
  const t = useTranslations('Landing.forfaitsPros');
  const tCommon = useTranslations('Common');

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-[color:var(--color-ivory-50)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-ivory-50)]/65">
        <div className="container-page flex items-center justify-between gap-6 py-4">
          <Link
            href="/"
            className="focus-ring inline-flex items-center"
            aria-label={tCommon('appName')}
          >
            <WedillybirdLogo />
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

      <main id="main-content" className="flex-1" tabIndex={-1}>
        {/* Mini-hero */}
        <section className="paper-grain relative bg-[color:var(--color-surface)] pt-24 pb-0">
          <div className="container-page mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
            <span className="font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
              {t('eyebrow')}
            </span>
            <h1
              className="font-display text-balance italic"
              style={{
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                lineHeight: 1.05,
                letterSpacing: '-0.022em',
                color: 'var(--color-ink-900)',
              }}
            >
              {t('title')}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[color:var(--color-ink-500)]">
              {t('subtitle')}
            </p>
          </div>
        </section>

        {/* Pricing Pros section (toggle + 3 cards + PAYG aside) */}
        <LandingPricingPros />

        {/* FAQ rapide */}
        <section className="bg-[color:var(--color-surface)] py-20">
          <div className="container-page mx-auto max-w-3xl">
            <span className="mb-8 inline-block font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
              Questions fréquentes
            </span>
            <dl className="flex flex-col divide-y divide-[color:var(--color-border)]">
              {(
                [
                  ['faq.q1', 'faq.q1Body'],
                  ['faq.q2', 'faq.q2Body'],
                  ['faq.q3', 'faq.q3Body'],
                ] as const
              ).map(([qKey, aKey]) => (
                <div key={qKey} className="py-6">
                  <dt className="font-display text-lg text-[color:var(--color-ink-900)] italic">
                    {t(qKey)}
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-[color:var(--color-ink-500)]">
                    {t(aKey)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <LandingFooterRich />
    </>
  );
}
