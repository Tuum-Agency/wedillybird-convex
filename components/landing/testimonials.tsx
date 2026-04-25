'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

const TESTIMONIALS = ['couple-fr', 'couple-sn', 'planner-pro'] as const;

/**
 * Landing — Témoignages V2.
 *
 * 3 cards : couple France, couple Sénégal, planner pro. Mix volontaire des
 * deux marchés pour signaler immédiatement l'inclusivité (cf. brief UX).
 * Pas de photos (assets non fournis) — initiales en cercle terracotta + nom +
 * lieu. Le user pourra ajouter des photos réelles plus tard.
 */
export function LandingTestimonials() {
  const t = useTranslations('Landing.testimonials');

  return (
    <section className="border-y border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] py-24">
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

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="grid gap-5 md:grid-cols-3"
        >
          {TESTIMONIALS.map((id) => {
            const initials = t(`items.${id}.initials`);
            return (
              <motion.figure
                key={id}
                variants={scrollReveal}
                className="flex flex-col gap-5 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-7"
              >
                <span
                  aria-hidden
                  className="font-display text-3xl text-[color:var(--color-primary)] italic"
                >
                  &ldquo;
                </span>
                <blockquote className="text-base leading-relaxed text-[color:var(--color-foreground)]">
                  {t(`items.${id}.quote`)}
                </blockquote>
                <figcaption className="mt-auto flex items-center gap-3">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--color-primary-soft)] text-sm font-semibold text-[color:var(--color-primary)]"
                    aria-hidden
                  >
                    {initials}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-[color:var(--color-foreground)]">
                      {t(`items.${id}.name`)}
                    </span>
                    <span className="text-xs text-[color:var(--color-muted-foreground)]">
                      {t(`items.${id}.location`)}
                    </span>
                  </span>
                </figcaption>
              </motion.figure>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
