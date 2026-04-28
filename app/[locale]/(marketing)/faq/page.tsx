import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { WedillybirdMark } from '@/components/brand/wedillybird-mark';
import { LandingFaqAccordion } from '@/components/landing/faq-accordion';
import { LandingFooterRich } from '@/components/landing/footer-rich';

const FAQ_KEYS = [
  'whyWhatsapp',
  'olderGuests',
  'guestLimit',
  'cancellation',
  'afterEvent',
  'africa3g',
  'branding',
  'data',
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata.faq' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/faq' },
    openGraph: {
      type: 'website',
      title: t('title'),
      description: t('description'),
      url: '/faq',
      siteName: 'Wedillybird',
      locale: 'fr_FR',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
  };
}

/**
 * Page FAQ dédiée — réutilise `LandingFaqAccordion` (8 Q/R single-expand)
 * et expose le même JSON-LD `FAQPage` que la landing pour rich snippets.
 *
 * Liée depuis le footer (`components/landing/footer-rich.tsx`) et la nav
 * principale. Autonome côté metadata (canonical `/faq`) pour éviter la
 * duplication avec le bloc FAQ embarqué sur la landing.
 */
export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tFaq = await getTranslations({ locale, namespace: 'Landing.faq.items' });
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_KEYS.map((key) => ({
      '@type': 'Question',
      name: tFaq(`${key}.q`),
      acceptedAnswer: {
        '@type': 'Answer',
        text: tFaq(`${key}.a`),
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <FaqShell />
    </>
  );
}

function FaqShell() {
  const tCommon = useTranslations('Common');
  const tMeta = useTranslations('Metadata.faq');

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

      <main id="main-content" className="flex-1" tabIndex={-1}>
        {/* Mini-hero */}
        <section className="paper-grain relative bg-[color:var(--color-surface)] pt-24 pb-0">
          <div className="container-page mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
            <span className="font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
              Foire aux questions
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
              {tMeta('title')}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[color:var(--color-ink-500)]">
              {tMeta('description')}
            </p>
          </div>
        </section>

        <LandingFaqAccordion />
      </main>

      <LandingFooterRich />
    </>
  );
}
