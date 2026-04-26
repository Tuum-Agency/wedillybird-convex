'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

const STEPS = ['create', 'invite', 'celebrate'] as const;

/**
 * Landing — "Comment ça marche" V3.
 *
 * 3 étapes en colonnes avec numéros calligraphiés Fraunces (style éditorial)
 * et tracé connecteur gradient gold entre les badges. Reveal scroll stagger.
 */
export function LandingHowItWorks() {
  const t = useTranslations('Landing.how');

  return (
    <section className="border-y border-[color:var(--color-border)] bg-[color:var(--color-ivory-100)] py-28">
      <div className="container-page">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mx-auto mb-16 flex max-w-3xl flex-col items-center gap-3 text-center"
        >
          <motion.span
            variants={scrollReveal}
            className="text-xs font-medium tracking-[0.2em] text-[color:var(--color-champagne-700)] uppercase"
          >
            {t('eyebrow')}
          </motion.span>
          <motion.h2
            variants={scrollReveal}
            className="font-display text-balance italic"
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
            }}
          >
            {t('title')}
          </motion.h2>
        </motion.div>

        <motion.ol
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="relative mx-auto grid max-w-5xl gap-12 md:grid-cols-3 md:gap-8"
        >
          {/* Connector ornemental gold desktop */}
          <span
            aria-hidden
            className="absolute top-9 right-[16%] left-[16%] hidden h-px md:block"
            style={{
              background:
                'linear-gradient(to right, transparent, oklch(78% 0.075 78) 20%, oklch(78% 0.075 78) 80%, transparent)',
            }}
          />

          {STEPS.map((step, idx) => (
            <motion.li
              key={step}
              variants={scrollReveal}
              className="relative flex flex-col items-center gap-5 text-center"
            >
              <span
                className="relative flex h-18 w-18 items-center justify-center rounded-full bg-white shadow-[var(--shadow-soft)]"
                style={{
                  width: '4.5rem',
                  height: '4.5rem',
                  border: '1px solid oklch(88% 0.05 80)',
                }}
              >
                <span
                  aria-hidden
                  className="absolute inset-1 rounded-full"
                  style={{
                    background:
                      'linear-gradient(135deg, oklch(96% 0.022 85) 0%, oklch(92% 0.035 80) 100%)',
                  }}
                />
                <span
                  className="font-display relative text-3xl italic"
                  style={{
                    color: 'var(--color-champagne-700)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {idx + 1}
                </span>
              </span>
              <h3
                className="font-display text-2xl italic"
                style={{ letterSpacing: '-0.018em', lineHeight: 1.1 }}
              >
                {t(`steps.${step}.title`)}
              </h3>
              <p className="max-w-xs text-sm leading-relaxed text-[color:var(--color-ink-500)]">
                {t(`steps.${step}.description`)}
              </p>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
