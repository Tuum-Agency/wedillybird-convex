'use client';

import { motion, useInView } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

/**
 * Landing — Manifesto V3.
 *
 * Section éditoriale : statement long format avec une stat géante (96 %) qui
 * tick depuis 0 quand elle entre dans le viewport. Texte en deux paragraphes,
 * narrative-driven, contextualise pourquoi WhatsApp.
 *
 * Inspiration : Aesop product story pages, Le Labo "About".
 */
export function LandingManifesto() {
  const t = useTranslations('Landing.manifesto');

  return (
    <section className="container-page paper-grain relative py-28 sm:py-32">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        variants={scrollRevealParent}
        className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20"
      >
        {/* Left : Eyebrow + titre + stat géante */}
        <div className="flex flex-col">
          <motion.span
            variants={scrollReveal}
            className="mb-5 text-xs font-medium tracking-[0.2em] text-[color:var(--color-champagne-700)] uppercase"
          >
            {t('eyebrow')}
          </motion.span>

          <motion.h2
            variants={scrollReveal}
            className="font-display text-balance italic"
            style={{
              fontSize: 'clamp(2.2rem, 5.5vw, 4rem)',
              lineHeight: 1.02,
              letterSpacing: '-0.025em',
              color: 'var(--color-ink-900)',
            }}
          >
            {t('title')}
          </motion.h2>

          {/* Stat géante */}
          <motion.div variants={scrollReveal} className="mt-12 flex flex-col">
            <ManifestoCounter target={96} suffix=" %" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[color:var(--color-ink-500)]">
              {t('statLabel')}
            </p>
            <p className="mt-2 text-xs text-[color:var(--color-ink-300)] italic">
              {t('statSource')}
            </p>
          </motion.div>
        </div>

        {/* Right : corps de texte éditorial */}
        <motion.div variants={scrollReveal} className="flex flex-col gap-7 lg:pt-2">
          <span aria-hidden className="ornament-divider mr-auto" />
          <p className="text-lg leading-relaxed text-[color:var(--color-ink-700)] sm:text-xl">
            {t('body1')}
          </p>
          <p className="text-lg leading-relaxed text-[color:var(--color-ink-700)] sm:text-xl">
            {t('body2')}
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}

/**
 * Counter qui tick de 0 → target en 1.6s avec easing out, déclenché à
 * l'entrée dans le viewport. Respecte prefers-reduced-motion via Motion natif.
 */
function ManifestoCounter({ target, suffix }: { target: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20%' });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1600;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target]);

  return (
    <span
      ref={ref}
      className="font-display tabular-nums"
      style={{
        fontSize: 'clamp(5rem, 14vw, 9rem)',
        fontStyle: 'italic',
        fontWeight: 300,
        lineHeight: 0.9,
        letterSpacing: '-0.04em',
        color: 'var(--color-blush-700)',
      }}
    >
      {value}
      {suffix}
    </span>
  );
}
