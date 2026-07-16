'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { analytics } from '@/lib/analytics/posthog-client';
import { inViewOnce, scrollReveal } from '@/lib/motion/presets';

/**
 * CTA final de la page Pros. Même grammaire que la landing (`cta-final`) :
 * carte gradient blush + champagne, ornement gold, un seul CTA.
 */
export function ProsCta() {
  const t = useTranslations('Pros');

  return (
    <section className="container-page py-28">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        variants={scrollReveal}
        className="paper-grain relative isolate overflow-hidden rounded-[2.5rem] px-8 py-20 text-center sm:px-16 sm:py-28"
      >
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background: [
              'radial-gradient(60% 70% at 50% 0%, oklch(85% 0.06 22 / 65%) 0%, transparent 75%)',
              'radial-gradient(40% 50% at 80% 100%, oklch(92% 0.035 80 / 55%) 0%, transparent 75%)',
              'oklch(98% 0.012 25)',
            ].join(', '),
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-[2.5rem]"
          style={{ boxShadow: 'inset 0 0 0 1px oklch(91% 0.045 22)' }}
        />

        <div aria-hidden className="ornament-divider mb-6 text-[color:var(--color-champagne-700)]">
          <Sparkles
            className="h-3.5 w-3.5 fill-[oklch(78%_0.075_78)]"
            strokeWidth={1.5}
            aria-hidden
          />
        </div>

        <h2
          className="font-display mx-auto max-w-3xl text-balance italic"
          style={{
            fontSize: 'clamp(2.25rem, 5.5vw, 4rem)',
            lineHeight: 1.02,
            letterSpacing: '-0.025em',
            color: 'var(--color-ink-900)',
          }}
        >
          {t('cta.title')}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base text-[color:var(--color-ink-500)] sm:text-lg">
          {t('cta.subtitle')}
        </p>
        <Link
          href={'/sign-up?plan=business&billing=monthly' as never}
          onClick={() =>
            analytics.ctaClicked({
              source: 'pros_cta',
              destination: '/sign-up',
              plan: 'business',
              billing: 'monthly',
              audience: 'pro',
            })
          }
          className={cn(
            buttonVariants({ variant: 'primary', size: 'xl' }),
            'group mt-10 inline-flex min-w-64',
          )}
        >
          {t('cta.button')}
          <ArrowRight
            className="ml-1 h-4 w-4 transition-transform [@media(hover:hover)]:group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
        <p className="mt-7 text-xs text-[color:var(--color-ink-400)]">{t('cta.footnote')}</p>
      </motion.div>
    </section>
  );
}
