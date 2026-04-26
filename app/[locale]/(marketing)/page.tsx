import { headers } from 'next/headers';
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';
import { LenisProvider } from '@/components/landing/lenis-provider';
import { LandingHero } from '@/components/landing/hero';
import { LandingManifesto } from '@/components/landing/manifesto';
import { LandingFeaturesGrid } from '@/components/landing/features-grid';
import { LandingCinematicInvitation } from '@/components/landing/cinematic-invitation';
import { LandingTestimonials } from '@/components/landing/testimonials';
import { LandingPricingCards } from '@/components/landing/pricing-cards';
import { LandingFaqAccordion } from '@/components/landing/faq-accordion';
import { LandingCtaFinal } from '@/components/landing/cta-final';
import { LandingFooterRich } from '@/components/landing/footer-rich';
import {
  detectPricingRegion,
  formatRegionalPlanPrice,
  formatRegionalUpsellPrice,
} from '@/lib/payments/region';
import { cn } from '@/lib/cn';

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
 *  07. FAQ (8 questions accordion)
 *  Épilogue. CTA final + Footer riche
 *
 * Smooth scroll Lenis sur toute la landing (synced avec GSAP ScrollTrigger).
 */
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const region = detectPricingRegion(await headers());

  const prices = {
    essential: formatRegionalPlanPrice('essential', region, 'EUR'),
    premium: formatRegionalPlanPrice('premium', region, 'EUR'),
  };
  const upsellPriceLabel = formatRegionalUpsellPrice(region, 'EUR');

  return <LandingShell prices={prices} upsellPriceLabel={upsellPriceLabel} />;
}

function LandingShell({
  prices,
  upsellPriceLabel,
}: {
  prices: { essential: string; premium: string };
  upsellPriceLabel: string;
}) {
  const tCommon = useTranslations('Common');

  return (
    <LenisProvider>
      {/* Top nav — sticky transparente, devient opaque au scroll via backdrop-blur */}
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-[color:var(--color-ivory-50)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-ivory-50)]/65">
        <div className="container-page flex items-center justify-between py-4">
          <Link
            href="/"
            className="font-display inline-flex items-center gap-2 text-xl tracking-tight text-[color:var(--color-ink-900)] italic"
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full bg-[color:var(--color-gold-500)]"
            />
            {tCommon('appName')}
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/#features"
              className="hidden font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-ink-900)] sm:inline-block"
            >
              Piliers
            </Link>
            <Link
              href="/#pricing"
              className="hidden font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-ink-900)] sm:inline-block"
            >
              Tarifs
            </Link>
            <Link
              href="/sign-in"
              className="text-sm font-medium text-[color:var(--color-ink-900)] transition-colors hover:text-[color:var(--color-blush-700)]"
            >
              {tCommon('signIn')}
            </Link>
            <Link
              href="/sign-up"
              className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}
            >
              {tCommon('signUp')}
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" className="flex-1" tabIndex={-1}>
        <LandingHero />
        <LandingManifesto />
        <LandingFeaturesGrid />
        <LandingCinematicInvitation />
        <LandingTestimonials />
        <LandingPricingCards prices={prices} upsellPriceLabel={upsellPriceLabel} />
        <LandingFaqAccordion />
        <LandingCtaFinal />
      </main>

      <LandingFooterRich />
    </LenisProvider>
  );
}
