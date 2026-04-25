'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/**
 * Landing — Hero V2.
 *
 * Direction artistique : typo Fraunces Italic géante (signature éditoriale,
 * proxy Migra), dégradé mesh OKLCH brand-50 → ivory derrière, deux CTAs
 * distincts (couple / pro), badge WhatsApp-first, micro stats live.
 *
 * Animations sobres — fade + slide up stagger sur l'apparition. Tout désactivé
 * si `prefers-reduced-motion`. Pas de hero video, pas de parallax (perf 3G
 * Afrique critique).
 */
export function LandingHero() {
  const t = useTranslations('Landing');
  const reduced = useReducedMotion();

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: reduced ? 0 : 0.08, delayChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: reduced ? 0 : 14 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
  };

  return (
    <section className="relative isolate overflow-hidden">
      {/* Dégradé mesh OKLCH terracotta → ivoire */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: [
            'radial-gradient(60% 40% at 75% 0%, oklch(86% 0.085 38 / 35%) 0%, transparent 70%)',
            'radial-gradient(50% 35% at 15% 30%, oklch(91% 0.035 142 / 25%) 0%, transparent 75%)',
            'radial-gradient(70% 50% at 50% 110%, oklch(96% 0.025 40 / 70%) 0%, transparent 80%)',
            'oklch(98% 0.012 75)',
          ].join(', '),
        }}
      />
      {/* Grille subtile */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(oklch(22% 0.025 40) 1px, transparent 1px), linear-gradient(90deg, oklch(22% 0.025 40) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <motion.div
        className="container-page relative flex flex-col items-center pt-20 pb-28 text-center sm:pt-28 sm:pb-36"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.span
          variants={itemVariants}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/80 px-4 py-1.5 text-xs font-medium tracking-wide text-[color:var(--color-foreground)] shadow-[var(--shadow-soft)] backdrop-blur"
        >
          <span
            className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]"
            aria-hidden
          />
          {t('hero.badge')}
        </motion.span>

        <motion.h1
          variants={itemVariants}
          className="mx-auto max-w-5xl text-balance"
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(2.75rem, 9vw, 6.5rem)',
            lineHeight: 0.98,
            letterSpacing: '-0.025em',
            color: 'var(--color-foreground)',
          }}
        >
          {t('hero.title')}
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="mt-7 max-w-2xl text-pretty text-base leading-relaxed text-[color:var(--color-muted-foreground)] sm:text-lg"
        >
          {t('hero.subtitle')}
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link
            href="/sign-up"
            className={cn(buttonVariants({ variant: 'primary', size: 'xl' }), 'min-w-56')}
          >
            {t('hero.ctaPrimary')}
            <span aria-hidden className="ml-1">
              →
            </span>
          </Link>
          <Link
            href="/#pricing"
            className={cn(buttonVariants({ variant: 'outline', size: 'xl' }), 'min-w-56')}
          >
            {t('hero.ctaSecondary')}
          </Link>
        </motion.div>

        {/* Trust line */}
        <motion.p
          variants={itemVariants}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[color:var(--color-muted-foreground)]"
        >
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden>✓</span>
            {t('hero.trust.noCard')}
          </span>
          <span aria-hidden className="opacity-30">
            ·
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden>✓</span>
            {t('hero.trust.refund')}
          </span>
          <span aria-hidden className="opacity-30">
            ·
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden>✓</span>
            {t('hero.trust.frAndAfrica')}
          </span>
        </motion.p>
      </motion.div>
    </section>
  );
}
