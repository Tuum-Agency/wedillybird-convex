'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

const ROWS = ['open', 'rsvp', 'edit', 'photos', 'checkin', 'memory'] as const;

/**
 * Landing — Comparatif PDF/mail vs Wedillybird.
 *
 * Tableau split visuel : colonne gauche grise/atone (PDF), colonne droite
 * blush/saturée (Wedillybird). 6 lignes alignées par metric. Reveal scroll.
 *
 * Inspiration : Linear "Issues vs Tasks" comparison, Notion vs Coda landings.
 */
export function LandingComparison() {
  const t = useTranslations('Landing.comparison');

  return (
    <section className="border-y border-[color:var(--color-border)] bg-[color:var(--color-ivory-100)] py-28">
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
            className="text-xs font-medium tracking-[0.2em] text-[color:var(--color-champagne-700)] uppercase"
          >
            {t('eyebrow')}
          </motion.span>
          <motion.h2
            variants={scrollReveal}
            className="font-display max-w-3xl text-balance italic"
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
            className="max-w-2xl text-base text-[color:var(--color-ink-500)]"
          >
            {t('subtitle')}
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mx-auto grid max-w-5xl gap-3 md:grid-cols-2 md:gap-0"
        >
          {/* Colonne PDF — atone */}
          <motion.div
            variants={scrollReveal}
            className="flex flex-col overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white md:rounded-r-none md:border-r-0"
          >
            <div className="border-b border-[color:var(--color-border)] bg-[oklch(96%_0.005_85)] px-7 py-5">
              <span className="text-sm font-semibold tracking-wide text-[color:var(--color-ink-500)]">
                {t('leftLabel')}
              </span>
            </div>
            <ul className="flex flex-1 flex-col">
              {ROWS.map((row, idx) => (
                <li
                  key={row}
                  className="flex items-start gap-3 border-b border-[color:var(--color-border)] px-7 py-5 last:border-b-0"
                  style={idx % 2 === 1 ? { background: 'oklch(98% 0.005 85)' } : undefined}
                >
                  <X
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--color-ink-300)]"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium tracking-wide text-[color:var(--color-ink-300)] uppercase">
                      {t(`rows.${row}.metric`)}
                    </span>
                    <span className="text-sm text-[color:var(--color-ink-500)]">
                      {t(`rows.${row}.left`)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Colonne Wedillybird — saturée */}
          <motion.div
            variants={scrollReveal}
            className="relative flex flex-col overflow-hidden rounded-3xl border-2 border-[color:var(--color-blush-300)] bg-white shadow-[var(--shadow-blush)] md:scale-[1.02] md:rounded-l-none"
          >
            <div
              className="border-b border-[color:var(--color-blush-200)] px-7 py-5"
              style={{
                background:
                  'linear-gradient(135deg, oklch(95% 0.025 22) 0%, oklch(92% 0.035 80) 100%)',
              }}
            >
              <span
                className="font-display text-base italic"
                style={{ color: 'var(--color-blush-800)', letterSpacing: '-0.015em' }}
              >
                {t('rightLabel')}
              </span>
            </div>
            <ul className="flex flex-1 flex-col">
              {ROWS.map((row, idx) => (
                <li
                  key={row}
                  className="flex items-start gap-3 border-b border-[color:var(--color-blush-100)] px-7 py-5 last:border-b-0"
                  style={idx % 2 === 1 ? { background: 'oklch(98% 0.012 25)' } : undefined}
                >
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'oklch(82% 0.045 145)' }}
                  >
                    <Check
                      className="h-3 w-3 text-[color:var(--color-sage-700)]"
                      strokeWidth={3}
                      aria-hidden
                    />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium tracking-wide text-[color:var(--color-blush-700)] uppercase">
                      {t(`rows.${row}.metric`)}
                    </span>
                    <span className="text-sm font-medium text-[color:var(--color-ink-900)]">
                      {t(`rows.${row}.right`)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
