'use client';

import { motion, useInView } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

const STAT_KEYS = ['openRate', 'rsvpSpeed', 'memory'] as const;

/**
 * Landing — Manifesto V4 enrichi.
 *
 * Absorbe les anciennes sections Stats + Comparison en un seul chapitre
 * éditorial qui raconte le « pourquoi » de Wedillybird :
 *
 * 1. Lede long-format Migra italic (la conviction)
 * 2. Diptyque "Hier / Désormais" en prose éditoriale (pas un tableau)
 * 3. Pull-quote géant climax (promesse B "Six mois après...")
 * 4. Trois stats inline (98%, 73%, 5 ans) en grand chiffre + label
 * 5. Source / méthodologie en bas de page
 *
 * Inspiration : Aesop product story + Atelier Isabey "atelier" page +
 * Mercury "Why Mercury" section éditoriale.
 *
 * Pattern : asymétrie volontaire (lede gauche large, diptyque pleine largeur,
 * pull-quote centré, stats en filet horizontal). Pas de bento, pas de cards.
 */
export function LandingManifesto() {
  const t = useTranslations('Landing.manifesto');

  return (
    <section className="paper-grain relative bg-[color:var(--color-ivory-50)] py-32 sm:py-40">
      <div className="container-page">
        {/* Eyebrow chapitre */}
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={inViewOnce}
          className="mb-12 inline-block font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase"
        >
          {t('chapter')}
        </motion.span>

        {/* Bloc 1 : Titre + lede */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20"
        >
          <motion.div variants={scrollReveal} className="flex flex-col">
            <span className="text-xs font-medium tracking-[0.24em] text-[color:var(--color-gold-700)] uppercase">
              {t('eyebrow')}
            </span>
            <h2
              className="font-display mt-5 text-balance italic"
              style={{
                fontSize: 'clamp(2.25rem, 5.5vw, 4rem)',
                lineHeight: 1.0,
                letterSpacing: '-0.025em',
                color: 'var(--color-ink-900)',
              }}
            >
              {t('title')}
            </h2>
          </motion.div>

          <motion.div variants={scrollReveal} className="flex flex-col gap-7 lg:pt-3">
            <p className="text-lg leading-relaxed text-[color:var(--color-ink-700)] sm:text-xl">
              {t('lede')}
            </p>
          </motion.div>
        </motion.div>

        {/* Diptyque Hier / Désormais — prose éditoriale, pas un tableau */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mt-28 grid gap-12 border-t border-[color:var(--color-border)] pt-16 lg:grid-cols-2 lg:gap-16"
        >
          <motion.div variants={scrollReveal} className="flex flex-col gap-5">
            <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-400)] uppercase">
              {t('before.label')}
            </span>
            <p className="text-base leading-relaxed text-[color:var(--color-ink-500)] sm:text-lg">
              {t('before.body')}
            </p>
          </motion.div>

          <motion.div
            variants={scrollReveal}
            className="flex flex-col gap-5 border-t border-[color:var(--color-blush-200)] pt-12 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12"
          >
            <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-blush-700)] uppercase">
              {t('after.label')}
            </span>
            <p className="text-base leading-relaxed text-[color:var(--color-ink-900)] sm:text-lg">
              {t('after.body')}
            </p>
          </motion.div>
        </motion.div>

        {/* Pull-quote climax — promesse "six mois après" */}
        <motion.figure
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } }}
          viewport={inViewOnce}
          className="mx-auto mt-32 max-w-4xl text-center"
        >
          <span
            aria-hidden
            className="font-display block text-6xl text-[color:var(--color-gold-500)] italic"
          >
            &ldquo;
          </span>
          <blockquote
            className="font-display mx-auto mt-2 text-balance italic"
            style={{
              fontSize: 'clamp(1.75rem, 4.5vw, 3rem)',
              lineHeight: 1.15,
              letterSpacing: '-0.022em',
              color: 'var(--color-ink-900)',
            }}
          >
            {t('pullquote')}
          </blockquote>
        </motion.figure>

        {/* Trois stats inline */}
        <motion.dl
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mt-32 grid gap-12 border-t border-[color:var(--color-border)] pt-16 sm:grid-cols-3 sm:gap-8"
        >
          {STAT_KEYS.map((key) => {
            const value = t.raw(`stats.${key}.value`) as number;
            const suffix = t(`stats.${key}.suffix`);
            return (
              <motion.div key={key} variants={scrollReveal} className="flex flex-col items-start">
                <StatTicker target={value} suffix={suffix} />
                <dt className="mt-4 text-base font-medium text-[color:var(--color-ink-900)]">
                  {t(`stats.${key}.label`)}
                </dt>
                <dd className="mt-1 font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase">
                  {t(`stats.${key}.context`)}
                </dd>
              </motion.div>
            );
          })}
        </motion.dl>

        {/* Source */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={inViewOnce}
          className="mt-12 text-center font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-400)] italic"
        >
          {t('source')}
        </motion.p>
      </div>
    </section>
  );
}

function StatTicker({ target, suffix }: { target: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15%' });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1500;
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

  const display = Number.isInteger(target) ? Math.round(value) : value.toFixed(1);

  return (
    <span
      ref={ref}
      className="tabular-nums"
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'clamp(3rem, 7vw, 5.5rem)',
        fontWeight: 200,
        lineHeight: 0.9,
        letterSpacing: '-0.04em',
        color: 'var(--color-ink-900)',
      }}
    >
      {display}
      <span style={{ fontSize: '0.55em', marginLeft: '0.05em', color: 'var(--color-blush-700)' }}>
        {suffix}
      </span>
    </span>
  );
}
