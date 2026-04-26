import { headers } from 'next/headers';
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';
import { LandingHero } from '@/components/landing/hero';
import { LandingManifesto } from '@/components/landing/manifesto';
import { LandingComparison } from '@/components/landing/comparison';
import { LandingFeaturesGrid } from '@/components/landing/features-grid';
import { LandingStats } from '@/components/landing/stats';
import { LandingCinematicInvitation } from '@/components/landing/cinematic-invitation';
import { LandingHowItWorks } from '@/components/landing/how-it-works';
import { LandingInspirationGallery } from '@/components/landing/inspiration-gallery';
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

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const region = detectPricingRegion(await headers());

  // Server-rendered prices (region-aware via geoIP) injectés côté client.
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
    <>
      {/* Top nav — sticky avec backdrop blur */}
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-[color:var(--color-background)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-background)]/65">
        <div className="container-page flex items-center justify-between py-4">
          <Link
            href="/"
            className="font-display text-xl tracking-tight text-[color:var(--color-foreground)] italic"
          >
            {tCommon('appName')}
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/#features"
              className="hidden text-sm font-medium text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)] sm:inline-block"
            >
              Fonctionnalités
            </Link>
            <Link
              href="/#pricing"
              className="hidden text-sm font-medium text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)] sm:inline-block"
            >
              Tarifs
            </Link>
            <Link
              href="/sign-in"
              className="text-sm font-medium text-[color:var(--color-foreground)] transition-colors hover:text-[color:var(--color-primary)]"
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
        <LandingComparison />
        <LandingFeaturesGrid />
        <LandingStats />
        <LandingCinematicInvitation />
        <LandingHowItWorks />
        <LandingInspirationGallery />
        <LandingTestimonials />
        <LandingPricingCards prices={prices} upsellPriceLabel={upsellPriceLabel} />
        <LandingFaqAccordion />
        <LandingCtaFinal />
      </main>

      <LandingFooterRich />
    </>
  );
}
