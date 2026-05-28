import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { OG_DEFAULT_IMAGES, TWITTER_DEFAULT_IMAGES } from '@/lib/seo/og';
import { toOgLocale } from '@/lib/i18n/locale-tags';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';
import { LenisProvider } from '@/components/landing/lenis-provider';
import { LandingHero } from '@/components/landing/hero';
import { LandingManifesto } from '@/components/landing/manifesto';
import { LandingFeaturesGrid } from '@/components/landing/features-grid';
import { LandingCinematicInvitation } from '@/components/landing/cinematic-invitation';
import { LandingTestimonials } from '@/components/landing/testimonials';
import { LandingPricingCards } from '@/components/landing/pricing-cards';
import { LandingPricingPros } from '@/components/landing/pricing-pros';
import { MobileMenu } from '@/components/landing/mobile-menu';
import { LandingFaqAccordion } from '@/components/landing/faq-accordion';
import { LandingCtaFinal } from '@/components/landing/cta-final';
import { LandingFooterRich } from '@/components/landing/footer-rich';
import { SectionNav } from '@/components/landing/section-nav';
import { WedillybirdLogo } from '@/components/brand/wedillybird-logo';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { defaultCurrencyForLocale } from '@/lib/payments/currency';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/cn';

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

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wedillybird.com';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata.landing' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      url: BASE_URL,
      siteName: 'Wedillybird',
      title: t('title'),
      description: t('description'),
      locale: toOgLocale(locale),
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

/**
 * Landing page V4 — direction "mariage éditorial Awwwards-grade".
 *
 * Refonte post-audit (V3 jugée 64/100). Sections coupées : Comparison, Stats,
 * HowItWorks, InspirationGallery — leur essence absorbée dans Manifesto V4.
 *
 * Structure narrative en 7 chapitres :
 *  01. Hero (carte d'invitation 3D + photo couple Provence)
 *  02. Manifesto enrichi (lede + diptyque + pull-quote + 3 stats)
 *  03. 4 piliers (asymétrie : Invitations large + 3 cards)
 *  04. Cinématique invitation (texture papier + sceau fendu + cursor cire)
 *  05. Témoignages (3 voix avec photos Unsplash)
 *  06. Pricing (geoIP auto, sparkle gold Premium hover)
 *  06b. Pricing Pros (toggle mensuel/annuel + 3 cards + PAYG aside)
 *  07. FAQ (8 questions accordion)
 *  Épilogue. CTA final + Footer riche
 *
 * Smooth scroll Lenis sur toute la landing (synced avec GSAP ScrollTrigger).
 *
 * SEO : JSON-LD FAQPage côté server (8 Q/R, mêmes clés que l'accordion client).
 */
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const defaultCurrency = defaultCurrencyForLocale(locale as Locale);

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
      <LandingShell defaultCurrency={defaultCurrency} />
    </>
  );
}

function LandingShell({
  defaultCurrency,
}: {
  defaultCurrency: ReturnType<typeof defaultCurrencyForLocale>;
}) {
  const tCommon = useTranslations('Common');

  return (
    <LenisProvider>
      {/* Top nav — sticky, layout 3 colonnes : logo gauche, nav centrée,
          CTA droite. Grid 3-cols pour que la nav soit vraiment centrée
          dans le viewport indépendamment de la largeur du logo et du CTA
          (un flex justify-between recentre faussement, biaisé par les
          tailles asymétriques des blocs latéraux). */}
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-[color:var(--color-ivory-50)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-ivory-50)]/65">
        <div className="container-page flex items-center justify-between gap-4 py-4 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-6">
          {/* Colonne gauche : logo */}
          <div className="flex items-center">
            <Link
              href="/"
              className="focus-ring inline-flex items-center"
              aria-label={tCommon('appName')}
            >
              <WedillybirdLogo priority />
            </Link>
          </div>

          {/* Colonne centrale : navigation éditoriale */}
          <nav
            aria-label="Navigation principale"
            className="hidden items-center justify-center gap-7 md:flex"
          >
            <SectionNav />
          </nav>

          {/* Colonne droite — desktop : sélecteur de langue + CTA primary
              (un seul bouton car le flow OTP WhatsApp unifie sign-in/sign-up).
              Mobile : CTA sign-up reste visible à côté du hamburger qui héberge
              nav + locale dans un bottom-sheet Vaul. */}
          <div className="flex items-center justify-end gap-2 md:gap-3">
            <LocaleSwitcher className="hidden md:inline-flex" />
            <span aria-hidden className="hidden h-5 w-px bg-[color:var(--color-border)] md:block" />
            <Link
              href="/sign-up"
              className={cn(
                buttonVariants({ variant: 'primary', size: 'sm' }),
                'whitespace-nowrap',
              )}
            >
              {tCommon('signUp')}
            </Link>
            <div className="md:hidden">
              <MobileMenu />
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1" tabIndex={-1}>
        <LandingHero />
        <LandingManifesto />
        <LandingFeaturesGrid />
        <LandingCinematicInvitation />
        <LandingTestimonials />
        <LandingPricingCards defaultCurrency={defaultCurrency} />
        <LandingPricingPros defaultCurrency={defaultCurrency} />
        <LandingFaqAccordion />
        <LandingCtaFinal />
      </main>

      <LandingFooterRich />
    </LenisProvider>
  );
}
