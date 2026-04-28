'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

const TESTIMONIALS = ['couple-fr', 'couple-sn', 'planner-pro'] as const;

/**
 * Landing — Témoignages V3.
 *
 * 3 cards : France (Provence), Sénégal (Dakar), Wedding planner (Bordeaux).
 * Avatars en cercle avec initiales (font-display italic) — pas d'image externe
 * pour ne jamais dépendre d'un CDN tiers (Unsplash 404 vu en avril 2026).
 * Mosaïque géographique volontaire pour signaler l'inclusivité.
 */
export function LandingTestimonials() {
  const t = useTranslations('Landing.testimonials');

  return (
    <section
      id="testimonials"
      className="border-y border-[color:var(--color-border)] bg-[color:var(--color-ivory-100)] py-28"
    >
      <div className="container-page">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mx-auto mb-14 flex max-w-3xl flex-col items-center gap-3 text-center"
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

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="grid gap-6 md:grid-cols-3"
        >
          {TESTIMONIALS.map((key) => (
            <motion.figure
              key={key}
              variants={scrollReveal}
              className="flex flex-col gap-6 rounded-3xl border border-[color:var(--color-border)] bg-white p-8 shadow-[var(--shadow-soft)]"
            >
              <span
                aria-hidden
                className="font-display text-5xl text-[color:var(--color-blush-300)] italic"
                style={{ lineHeight: 0.5 }}
              >
                &ldquo;
              </span>
              <blockquote
                className="font-display text-lg leading-snug text-pretty text-[color:var(--color-ink-900)] italic"
                style={{ letterSpacing: '-0.012em' }}
              >
                {t(`items.${key}.quote`)}
              </blockquote>
              <figcaption className="mt-auto flex items-center gap-3 border-t border-[color:var(--color-border)] pt-5">
                <span
                  aria-hidden
                  className="font-display flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--color-blush-100)] text-base text-[color:var(--color-blush-700)] italic ring-1 ring-[color:var(--color-blush-200)]"
                >
                  {t(`items.${key}.initials`)}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-[color:var(--color-ink-900)]">
                    {t(`items.${key}.name`)}
                  </span>
                  <span className="text-xs text-[color:var(--color-ink-500)]">
                    {t(`items.${key}.location`)}
                  </span>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
