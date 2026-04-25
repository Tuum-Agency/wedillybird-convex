'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { inViewOnce, scrollReveal } from '@/lib/motion/presets';

/**
 * Landing — CTA final V2.
 *
 * Reprend l'esthétique du hero (dégradé mesh) en plus compact, avec un seul
 * CTA proéminent. Pour fermer le scroll de la landing sur une note d'action.
 */
export function LandingCtaFinal() {
  const t = useTranslations('Landing.ctaFinal');

  return (
    <section className="container-page py-28">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        variants={scrollReveal}
        className="relative isolate overflow-hidden rounded-[2rem] px-8 py-16 text-center sm:px-16 sm:py-20"
      >
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background: [
              'radial-gradient(60% 70% at 50% 0%, oklch(86% 0.085 38 / 60%) 0%, transparent 75%)',
              'oklch(96% 0.018 70)',
            ].join(', '),
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem]"
          style={{
            boxShadow: 'inset 0 0 0 1px oklch(86% 0.020 65)',
          }}
        />
        <h2
          className="font-display mx-auto max-w-3xl text-balance italic"
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
          }}
        >
          {t('title')}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base text-[color:var(--color-muted-foreground)]">
          {t('subtitle')}
        </p>
        <Link
          href="/sign-up"
          className={cn(
            buttonVariants({ variant: 'primary', size: 'xl' }),
            'mt-9 inline-flex min-w-64',
          )}
        >
          {t('cta')}
          <span aria-hidden className="ml-1">
            →
          </span>
        </Link>
      </motion.div>
    </section>
  );
}
