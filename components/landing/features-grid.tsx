'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

const FEATURES = [
  { key: 'invites', emoji: '✉' },
  { key: 'rsvp', emoji: '✓' },
  { key: 'checkin', emoji: '◇' },
  { key: 'gallery', emoji: '❀' },
] as const;

/**
 * Landing — Features grid V2.
 *
 * 4 cards en mosaïque, scroll reveal stagger 60 ms, hover lift desktop only.
 * Style éditorial : titre Fraunces italic, body Geist Sans, accent terracotta
 * sur l'icône en cercle.
 */
export function LandingFeaturesGrid() {
  const t = useTranslations('Landing');

  return (
    <section
      id="features"
      className="border-y border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] py-24"
    >
      <div className="container-page">
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
            {t('features.eyebrow')}
          </motion.span>
          <motion.h2
            variants={scrollReveal}
            className="font-display max-w-2xl text-3xl text-balance italic sm:text-4xl md:text-5xl"
            style={{ letterSpacing: '-0.02em', lineHeight: 1.05 }}
          >
            {t('features.title')}
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="grid gap-5 md:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map(({ key, emoji }) => (
            <motion.article
              key={key}
              variants={scrollReveal}
              className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 transition-[transform,box-shadow,border-color] duration-300 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-[color:var(--color-primary)]/40 [@media(hover:hover)]:hover:shadow-[var(--shadow-lifted)]"
            >
              <span
                aria-hidden
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--color-primary-soft)] text-2xl text-[color:var(--color-primary)]"
              >
                {emoji}
              </span>
              <h3
                className="font-display text-2xl italic"
                style={{ letterSpacing: '-0.015em', lineHeight: 1.1 }}
              >
                {t(`features.${key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-[color:var(--color-muted-foreground)]">
                {t(`features.${key}.description`)}
              </p>
              {/* Subtile barre d'accent en bas, animée au hover */}
              <span
                aria-hidden
                className="absolute right-6 bottom-6 left-6 h-px origin-left scale-x-0 bg-gradient-to-r from-[color:var(--color-primary)] to-transparent transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-x-100"
              />
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
