'use client';

import Image from 'next/image';
import heroBg from './hero-bg.jpg';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { analytics } from '@/lib/analytics/posthog-client';
import { InvitationCard3D } from './invitation-card-3d';
import { MagneticCta } from './magnetic-cta';

/**
 * Landing — Hero V4.
 *
 * Composition éditoriale asymétrique inspirée Adovasio (SOTD wedding éditorial)
 * et Mercury (rigueur compositionnelle). Pas de téléphone — la figure héroïque
 * est une carte d'invitation 3D scannée qui slow-rotate au mouse-move.
 *
 * Layout :
 * - Photo hero plein cadre derrière, floutée + overlay ivoire 65 % pour
 *   garantir la lisibilité tout en posant l'émotion mariage
 * - Copy géant gauche (clamp 3rem → 7rem), titre split italique + roman
 * - Carte d'invitation 3D droite, ratio 5:7, rotation suit le curseur
 * - Trust strip mono caps en bas
 * - Magnetic CTA primary + canvas-confetti au hover
 *
 * Eyebrow "CHAPITRE 01 — L'INVITATION" (mono caps tracking large).
 *
 * Promesse retenue après brainstorming : "Le mariage se vit dans la conversation."
 */
export function LandingHero() {
  const t = useTranslations('Landing.hero');
  const reduced = useReducedMotion();

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduced ? 0 : 0.1, delayChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: reduced ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
  };

  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden">
      {/* Photo hero plein cadre — couple Provence golden hour, Unsplash regradé */}
      <div className="absolute inset-0 -z-20">
        <Image
          src={heroBg}
          alt=""
          fill
          priority
          quality={55}
          placeholder="blur"
          // Overlay ivoire ~70 % → la finesse est invisible : on sert une
          // variante plus légère sur mobile (gain de transfert = LCP).
          sizes="(max-width: 768px) 62vw, 100vw"
          className="object-cover"
        />
      </div>

      {/* Overlay ivoire 70 % pour garder l'émotion sans écraser la copy */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: [
            'radial-gradient(60% 50% at 12% 30%, oklch(98.5% 0.008 85 / 88%) 0%, oklch(98.5% 0.008 85 / 70%) 60%, transparent 100%)',
            'linear-gradient(135deg, oklch(98.5% 0.008 85 / 70%) 0%, oklch(95% 0.025 22 / 50%) 60%, oklch(92% 0.035 80 / 40%) 100%)',
          ].join(', '),
        }}
      />

      {/* Texture grain global */}
      <div aria-hidden className="paper-grain pointer-events-none absolute inset-0 -z-10" />

      <motion.div
        className="container-wide relative grid min-h-[100svh] items-center gap-16 py-24 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:py-32"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Copy column */}
        <div className="flex flex-col">
          <motion.span
            variants={itemVariants}
            className="mb-10 font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase"
          >
            {t('chapter')}
          </motion.span>

          <motion.h1
            variants={itemVariants}
            className="text-balance"
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 400,
              fontSize: 'clamp(2.75rem, 7.5vw, 5.75rem)',
              lineHeight: 0.97,
              letterSpacing: '-0.035em',
              color: 'var(--color-ink-900)',
            }}
          >
            {t('title')}
            <br />
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontWeight: 400,
                color: 'var(--color-blush-700)',
                letterSpacing: '-0.025em',
              }}
            >
              {t('titleAccent')}
            </span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mt-9 max-w-xl text-base leading-relaxed text-pretty text-[color:var(--color-ink-700)] sm:text-lg"
          >
            {t('subtitle')}
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="mt-12 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center"
          >
            <MagneticCta
              href="/sign-up"
              variant="primary"
              size="xl"
              className="w-full justify-center sm:w-auto sm:min-w-60"
              wrapperClassName="block w-full sm:inline-block sm:w-auto"
              withConfetti
              onClick={() =>
                analytics.ctaClicked({ source: 'hero_primary', destination: '/sign-up' })
              }
            >
              {t('ctaPrimary')}
              <ArrowRight
                className="ml-1 h-4 w-4 transition-transform [@media(hover:hover)]:group-hover:translate-x-0.5"
                aria-hidden
              />
            </MagneticCta>
            <MagneticCta
              href="/#pricing"
              variant="outline"
              size="xl"
              className="w-full justify-center sm:w-auto sm:min-w-52"
              wrapperClassName="block w-full sm:inline-block sm:w-auto"
              onClick={() =>
                analytics.ctaClicked({ source: 'hero_secondary', destination: '#pricing' })
              }
            >
              {t('ctaSecondary')}
            </MagneticCta>
          </motion.div>

          {/* Trust strip — mono caps */}
          <motion.div
            variants={itemVariants}
            className="mt-16 flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-6 font-mono text-[10px] font-semibold tracking-[0.28em] text-[color:var(--color-ink-700)] uppercase sm:flex-row sm:items-center sm:gap-8 sm:pt-7"
          >
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-1 w-1 rounded-full bg-[color:var(--color-gold-500)]"
              />
              {t('trust.stat')}
            </span>
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-1 w-1 rounded-full bg-[color:var(--color-gold-500)]"
              />
              {t('trust.rating')}
            </span>
            <span className="hidden items-center gap-2 lg:inline-flex">
              <span
                aria-hidden
                className="inline-block h-1 w-1 rounded-full bg-[color:var(--color-gold-500)]"
              />
              {t('trust.regions')}
            </span>
          </motion.div>
        </div>

        {/* Carte invitation 3D column */}
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-center lg:justify-end"
        >
          <InvitationCard3D />
        </motion.div>
      </motion.div>

      {/* Scroll cue subtil */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 lg:block"
      >
        <span className="font-mono text-[9px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
          Scroll
        </span>
        <div className="mx-auto mt-2 h-10 w-px bg-gradient-to-b from-[color:var(--color-ink-500)] to-transparent" />
      </motion.div>
    </section>
  );
}
