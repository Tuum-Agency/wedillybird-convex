'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';
import { JOURNEY_STEPS } from './content';

/**
 * Constat → promesse : le parcours « de A à Z » en 6 étapes. Pose le récit de
 * valeur avant le détail des 11 piliers.
 */
export function ProsJourney() {
  const t = useTranslations('Pros');

  return (
    <section className="relative bg-[color:var(--color-background)] py-28">
      <div className="container-page">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mb-16 flex max-w-3xl flex-col gap-5"
        >
          <motion.span
            variants={scrollReveal}
            className="font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase"
          >
            {t('journey.eyebrow')}
          </motion.span>
          <motion.h2
            variants={scrollReveal}
            className="font-display text-balance italic"
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              lineHeight: 1.03,
              letterSpacing: '-0.025em',
              color: 'var(--color-ink-900)',
            }}
          >
            {t('journey.title')}
          </motion.h2>
          <motion.p
            variants={scrollReveal}
            className="max-w-xl text-base leading-relaxed text-[color:var(--color-ink-500)]"
          >
            {t('journey.subtitle')}
          </motion.p>
        </motion.div>

        {/* Timeline 6 étapes */}
        <motion.ol
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
        >
          {JOURNEY_STEPS.map((step) => (
            <motion.li
              key={step}
              variants={scrollReveal}
              className="relative flex flex-col gap-2.5"
            >
              <div className="flex items-center gap-3">
                <span
                  className="font-display text-2xl text-[color:var(--color-gold-700)] italic"
                  style={{ letterSpacing: '0.04em' }}
                  aria-hidden
                >
                  {step}
                </span>
                <span aria-hidden className="h-px flex-1 bg-[color:var(--color-border)]" />
              </div>
              <h3
                className="font-display text-xl text-[color:var(--color-ink-900)] italic"
                style={{ letterSpacing: '-0.018em' }}
              >
                {t(`journey.steps.${step}.title` as Parameters<typeof t>[0])}
              </h3>
              <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)]">
                {t(`journey.steps.${step}.detail` as Parameters<typeof t>[0])}
              </p>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
