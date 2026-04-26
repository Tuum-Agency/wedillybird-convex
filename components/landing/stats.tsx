'use client';

import { motion, useInView } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

const STATS = ['openRate', 'rsvpSpeed', 'photosShared', 'memoryYears'] as const;

/**
 * Landing — Stats V3.
 *
 * 4 chiffres avec number ticker animé déclenché à l'entrée dans le viewport.
 * Tous les valeurs sont passées par i18n (contrôlées côté contenu).
 *
 * Pattern : grand chiffre Fraunces italic léger + label Geist + sublabel.
 */
export function LandingStats() {
  const t = useTranslations('Landing.stats');

  return (
    <section className="container-page py-28">
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
        <motion.p
          variants={scrollReveal}
          className="max-w-xl text-base text-[color:var(--color-ink-500)]"
        >
          {t('subtitle')}
        </motion.p>
      </motion.div>

      <motion.dl
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        variants={scrollRevealParent}
        className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4"
      >
        {STATS.map((key) => {
          const value = t.raw(`items.${key}.value`) as number;
          const suffix = t(`items.${key}.suffix`);
          return (
            <motion.div
              key={key}
              variants={scrollReveal}
              className="flex flex-col items-start gap-2 border-l-2 border-[color:var(--color-blush-200)] pl-5"
            >
              <StatTicker target={value} suffix={suffix} />
              <dt className="mt-2 text-base font-medium text-[color:var(--color-ink-900)]">
                {t(`items.${key}.label`)}
              </dt>
              <dd className="text-sm text-[color:var(--color-ink-500)]">
                {t(`items.${key}.sublabel`)}
              </dd>
            </motion.div>
          );
        })}
      </motion.dl>
    </section>
  );
}

function StatTicker({ target, suffix }: { target: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10%' });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1400;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(Math.round(target * eased * 10) / 10);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target]);

  // Format : entier si target entier, sinon 1 décimale
  const display = Number.isInteger(target) ? Math.round(value) : value.toFixed(1);

  return (
    <span
      ref={ref}
      className="font-display tabular-nums"
      style={{
        fontSize: 'clamp(3rem, 7vw, 5rem)',
        fontStyle: 'italic',
        fontWeight: 300,
        lineHeight: 0.9,
        letterSpacing: '-0.035em',
        color: 'var(--color-blush-700)',
      }}
    >
      {display}
      <span style={{ fontSize: '0.65em', marginLeft: '0.05em' }}>{suffix}</span>
    </span>
  );
}
