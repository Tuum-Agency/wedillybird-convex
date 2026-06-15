import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { WedillybirdLogo } from '@/components/brand/wedillybird-logo';
import { LandingFooterRich } from '@/components/landing/footer-rich';
import { Card, CardContent } from '@/components/ui/card';

const GUIDE_STEPS = [
  { id: 1, key: 'step1', itemCount: 4 },
  { id: 2, key: 'step2', itemCount: 4 },
  { id: 3, key: 'step3', itemCount: 4 },
  { id: 4, key: 'step4', itemCount: 4 },
  { id: 5, key: 'step5', itemCount: 4 },
] as const;

export default async function GuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Marketing');

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-[color:var(--color-ivory-50)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-ivory-50)]/65">
        <div className="container-page flex items-center justify-between gap-6 py-4">
          <Link href="/" className="focus-ring inline-flex items-center">
            <WedillybirdLogo />
          </Link>
          <Link
            href="/"
            className="focus-ring inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-ink-900)]"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            {t('guide.back')}
          </Link>
        </div>
      </header>

      <main className="flex-1 py-16 lg:py-24" tabIndex={-1}>
        <div className="container-page flex flex-col gap-16">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <span className="mb-4 font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-gold-700)] uppercase">
              {t('guide.eyebrow')}
            </span>
            <h1 className="font-display text-4xl leading-tight text-[color:var(--color-ink-900)] italic lg:text-5xl">
              {t('guide.title')}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-[color:var(--color-ink-500)]">
              {t('guide.subtitle')}
            </p>
          </div>

          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
            {GUIDE_STEPS.map((step) => (
              <Card key={step.id} className="border-none shadow-[var(--shadow-soft)]">
                <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:gap-12 sm:p-8">
                  <div className="shrink-0 sm:w-32">
                    <span className="inline-block rounded-full bg-[color:var(--color-ivory-100)] px-3 py-1 font-mono text-xs font-semibold tracking-wider text-[color:var(--color-gold-700)]">
                      {t(`guide.${step.key}.timeline`)}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-5">
                    <h2 className="font-display text-2xl text-[color:var(--color-ink-900)]">
                      {t(`guide.${step.key}.title`)}
                    </h2>
                    <ul className="flex flex-col gap-3">
                      {Array.from({ length: step.itemCount }, (_, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--color-blush-500)]" />
                          <span className="leading-relaxed text-[color:var(--color-ink-700)]">
                            {t(`guide.${step.key}.item${index + 1}`)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <LandingFooterRich />
    </>
  );
}
