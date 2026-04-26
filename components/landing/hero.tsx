'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { ArrowRight, ShieldCheck, Sparkles, Globe } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { PhoneMockup } from './phone-mockup';

/**
 * Landing — Hero V3.
 *
 * Layout split desktop : copy à gauche (titre Fraunces géant + sous-titre +
 * 2 CTAs + trust line), mockup phone WhatsApp à droite. Mobile : copy en haut,
 * phone en bas.
 *
 * Palette V3 : ivoire + blush, mesh radial gold/blush. Plus de terracotta.
 */
export function LandingHero() {
  const t = useTranslations('Landing.hero');
  const reduced = useReducedMotion();

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: reduced ? 0 : 0.08, delayChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: reduced ? 0 : 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
  };

  return (
    <section className="paper-grain relative isolate overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
      {/* Mesh gradient blush + champagne sur ivoire */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: [
            'radial-gradient(50% 35% at 80% 10%, oklch(85% 0.06 22 / 45%) 0%, transparent 75%)',
            'radial-gradient(45% 30% at 12% 28%, oklch(92% 0.035 80 / 40%) 0%, transparent 75%)',
            'radial-gradient(70% 50% at 50% 110%, oklch(95% 0.025 22 / 75%) 0%, transparent 80%)',
            'oklch(98.5% 0.008 85)',
          ].join(', '),
        }}
      />

      <motion.div
        className="container-wide relative grid items-center gap-14 lg:grid-cols-[1.05fr_0.9fr] lg:gap-20"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Copy column */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <motion.span
            variants={itemVariants}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border-strong)] bg-white/85 px-4 py-1.5 text-xs font-medium tracking-wide text-[color:var(--color-foreground)] shadow-[var(--shadow-soft)] backdrop-blur"
          >
            <Sparkles
              className="h-3.5 w-3.5 text-[color:var(--color-champagne-700)]"
              strokeWidth={2}
              aria-hidden
            />
            {t('badge')}
          </motion.span>

          <motion.h1
            variants={itemVariants}
            className="max-w-2xl text-balance"
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(2.5rem, 7.5vw, 5.5rem)',
              lineHeight: 0.98,
              letterSpacing: '-0.025em',
              color: 'var(--color-ink-900)',
            }}
          >
            {t('title')}
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mt-7 max-w-xl text-base leading-relaxed text-pretty text-[color:var(--color-ink-500)] sm:text-lg"
          >
            {t('subtitle')}
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="mt-10 flex w-full flex-col items-center gap-3 sm:flex-row sm:flex-wrap lg:items-start lg:justify-start"
          >
            <Link
              href="/sign-up"
              className={cn(buttonVariants({ variant: 'primary', size: 'xl' }), 'group min-w-56')}
            >
              {t('ctaPrimary')}
              <ArrowRight
                className="ml-1 h-4 w-4 transition-transform [@media(hover:hover)]:group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <Link
              href="/#pricing"
              className={cn(buttonVariants({ variant: 'outline', size: 'xl' }), 'min-w-56')}
            >
              {t('ctaSecondary')}
            </Link>
          </motion.div>

          <motion.ul
            variants={itemVariants}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[color:var(--color-ink-500)] lg:justify-start"
          >
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck
                className="h-3.5 w-3.5 text-[color:var(--color-sage-700)]"
                strokeWidth={2.25}
                aria-hidden
              />
              {t('trust.noCard')}
            </li>
            <li aria-hidden className="text-[color:var(--color-border-strong)]">
              ·
            </li>
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck
                className="h-3.5 w-3.5 text-[color:var(--color-sage-700)]"
                strokeWidth={2.25}
                aria-hidden
              />
              {t('trust.refund')}
            </li>
            <li aria-hidden className="text-[color:var(--color-border-strong)]">
              ·
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Globe
                className="h-3.5 w-3.5 text-[color:var(--color-champagne-700)]"
                strokeWidth={2.25}
                aria-hidden
              />
              {t('trust.frAndAfrica')}
            </li>
          </motion.ul>
        </div>

        {/* Phone mockup column */}
        <motion.div variants={itemVariants} className="flex items-center justify-center">
          <PhoneMockup />
        </motion.div>
      </motion.div>
    </section>
  );
}
