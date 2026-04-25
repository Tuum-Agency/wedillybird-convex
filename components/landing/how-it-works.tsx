'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

const STEPS = ['create', 'invite', 'celebrate'] as const;

/**
 * Landing — "Comment ça marche" V2.
 *
 * 3 étapes en colonnes (créer / inviter / célébrer), avec un tracé connecteur
 * animé entre les badges numérotés. Scroll reveal stagger.
 */
export function LandingHowItWorks() {
  const t = useTranslations('Landing.how');

  return (
    <section className="container-page py-24">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        variants={scrollRevealParent}
        className="mb-14 flex flex-col items-center gap-3 text-center"
      >
        <motion.span
          variants={scrollReveal}
          className="text-xs font-medium tracking-[0.2em] text-[color:var(--color-primary)] uppercase"
        >
          {t('eyebrow')}
        </motion.span>
        <motion.h2
          variants={scrollReveal}
          className="font-display max-w-2xl text-3xl text-balance italic sm:text-4xl md:text-5xl"
          style={{ letterSpacing: '-0.02em', lineHeight: 1.05 }}
        >
          {t('title')}
        </motion.h2>
      </motion.div>

      <motion.ol
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        variants={scrollRevealParent}
        className="relative grid gap-12 md:grid-cols-3 md:gap-8"
      >
        {/* Connector line desktop */}
        <span
          aria-hidden
          className="absolute top-7 right-[16.66%] left-[16.66%] hidden h-px bg-gradient-to-r from-transparent via-[color:var(--color-border-strong)] to-transparent md:block"
        />

        {STEPS.map((step, idx) => (
          <motion.li
            key={step}
            variants={scrollReveal}
            className="relative flex flex-col items-center gap-4 text-center"
          >
            <span
              className="font-display flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-surface)] text-2xl italic shadow-[var(--shadow-soft)]"
              style={{
                color: 'var(--color-primary)',
                border: '1px solid var(--color-border-strong)',
              }}
            >
              {idx + 1}
            </span>
            <h3
              className="font-display text-2xl italic"
              style={{ letterSpacing: '-0.015em', lineHeight: 1.1 }}
            >
              {t(`steps.${step}.title`)}
            </h3>
            <p className="max-w-xs text-sm leading-relaxed text-[color:var(--color-muted-foreground)]">
              {t(`steps.${step}.description`)}
            </p>
          </motion.li>
        ))}
      </motion.ol>
    </section>
  );
}
