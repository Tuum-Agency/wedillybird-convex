import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LegalFooter } from '@/components/layout/legal-footer';
import { PLANS, type PlanTier } from '@/lib/payments/plans';
import { cn } from '@/lib/cn';

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LandingContent />;
}

function LandingContent() {
  const t = useTranslations('Landing');
  const tCommon = useTranslations('Common');
  const tPlans = useTranslations('Plans');

  const features = [
    { key: 'invites', icon: '\u2709' },
    { key: 'rsvp', icon: '\u2713' },
    { key: 'checkin', icon: '\u25A1' },
    { key: 'gallery', icon: '\u2740' },
  ] as const;

  return (
    <>
      <header className="container-page flex items-center justify-between py-6">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          {tCommon('appName')}
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-[color:var(--color-foreground)] hover:text-[color:var(--color-primary)]"
          >
            {tCommon('signIn')}
          </Link>
          <Link href="/sign-up" className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}>
            {tCommon('signUp')}
          </Link>
        </nav>
      </header>

      <main id="main-content" className="flex-1" tabIndex={-1}>
        <section className="container-page flex flex-col items-center pt-16 pb-24 text-center sm:pt-24 sm:pb-32">
          <Badge variant="accent" className="mb-6">
            WhatsApp-first
          </Badge>
          <h1 className="font-display mx-auto max-w-4xl text-5xl leading-[1.05] font-semibold tracking-tight sm:text-6xl md:text-7xl">
            {t('hero.title')}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[color:var(--color-muted)]">
            {t('hero.subtitle')}
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}
            >
              {t('hero.ctaPrimary')}
            </Link>
            <Link
              href="/#features"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
            >
              {t('hero.ctaSecondary')}
            </Link>
          </div>
        </section>

        <section
          id="features"
          className="border-y border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-20"
        >
          <div className="container-page">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {features.map(({ key, icon }) => (
                <Card key={key} className="h-full border-0 bg-transparent shadow-none">
                  <CardContent className="flex flex-col gap-3 p-0">
                    <span
                      aria-hidden
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--color-terracotta-100)] text-xl text-[color:var(--color-terracotta-700)]"
                    >
                      {icon}
                    </span>
                    <h3 className="font-display text-xl leading-tight font-semibold">
                      {t(`features.${key}.title`)}
                    </h3>
                    <p className="text-sm leading-relaxed text-[color:var(--color-muted)]">
                      {t(`features.${key}.description`)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="container-page py-24">
          <div className="mb-12 text-center">
            <h2 className="font-display text-4xl leading-tight font-semibold sm:text-5xl">
              {t('pricing.title')}
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {(['free', 'essential', 'premium'] as const).map((tier, idx) => {
              const plan = PLANS[tier as PlanTier];
              return (
                <Card
                  key={tier}
                  className={
                    idx === 1
                      ? 'border-[color:var(--color-primary)] ring-1 ring-[color:var(--color-primary)]'
                      : ''
                  }
                >
                  <CardContent className="flex h-full flex-col gap-4 p-8">
                    {idx === 1 && <Badge variant="primary">Recommandé</Badge>}
                    <div>
                      <h3 className="font-display text-2xl font-semibold">
                        {t(`pricing.${tier}.name`)}
                      </h3>
                      <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                        {t(`pricing.${tier}.description`)}
                      </p>
                    </div>
                    <div className="text-4xl font-semibold tracking-tight">
                      {t(`pricing.${tier}.price`)}
                    </div>
                    <ul className="flex flex-col gap-2 text-sm">
                      {plan.featureKeys.map((key) => (
                        <li key={key} className="flex items-start gap-2">
                          <span aria-hidden className="mt-0.5 text-[color:var(--color-accent)]">
                            ✓
                          </span>
                          <span>{tPlans(`features.${key}` as const)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 rounded-lg bg-[color:var(--color-ivory-100)] p-3 text-xs leading-relaxed text-[color:var(--color-muted)]">
                      {tPlans('quotaNoteShort')}
                    </p>
                    <Link
                      href="/sign-up"
                      className={cn(
                        buttonVariants({
                          variant: idx === 1 ? 'primary' : 'outline',
                          size: 'md',
                        }),
                        'mt-auto w-full',
                      )}
                    >
                      {tCommon('continue')}
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-[color:var(--color-muted)]">
            {tPlans('quotaNoteLong')}
          </p>
        </section>
      </main>

      <LegalFooter />
    </>
  );
}
