'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';
import { WHITE_LABEL } from './content';
import { TierBadge } from './tier-badge';

/**
 * Marque blanche graduée en 3 niveaux (Starter → Business → Agency).
 */
export function ProsWhiteLabel() {
  const t = useTranslations('Pros');

  return (
    <section className="relative bg-[color:var(--color-background)] py-28">
      <div className="container-page">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mb-14 flex max-w-3xl flex-col gap-5"
        >
          <motion.span
            variants={scrollReveal}
            className="font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase"
          >
            {t('whiteLabel.eyebrow')}
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
            {t('whiteLabel.title')}
          </motion.h2>
          <motion.p
            variants={scrollReveal}
            className="max-w-xl text-base leading-relaxed text-[color:var(--color-ink-500)]"
          >
            {t('whiteLabel.subtitle')}
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="grid gap-5 md:grid-cols-3"
        >
          {WHITE_LABEL.map((lvl, i) => {
            const highlight = i === WHITE_LABEL.length - 1;
            return (
              <motion.article
                key={lvl.key}
                variants={scrollReveal}
                className={[
                  'flex flex-col gap-4 rounded-3xl border bg-white p-7 shadow-[var(--shadow-soft)]',
                  highlight
                    ? 'border-2 border-[color:var(--color-champagne-300)]'
                    : 'border border-[color:var(--color-border)]',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-gold-700)] uppercase">
                    {t('whiteLabel.levelLabel', { n: lvl.levelNumber })}
                  </span>
                  {lvl.tier === 'all' ? (
                    <span className="font-mono text-[9px] tracking-[0.08em] text-[color:var(--color-ink-400)] uppercase">
                      {t('whiteLabel.fromStarter')}
                    </span>
                  ) : (
                    <TierBadge tier={lvl.tier} />
                  )}
                </div>
                <h3
                  className="font-display text-2xl text-[color:var(--color-ink-900)] italic"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  {t(`whiteLabel.levels.${lvl.key}.title` as Parameters<typeof t>[0])}
                </h3>
                <ul className="mt-1 flex flex-col gap-2.5">
                  {Array.from({ length: lvl.pointCount }, (_, pi) => (
                    <li
                      key={pi}
                      className="flex items-start gap-2.5 text-sm text-[color:var(--color-ink-700)]"
                    >
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-gold-700)]"
                        strokeWidth={2}
                        aria-hidden
                      />
                      {t(`whiteLabel.levels.${lvl.key}.points.${pi}` as Parameters<typeof t>[0])}
                    </li>
                  ))}
                </ul>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
