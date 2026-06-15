'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';
import { WEDGE } from './content';

/**
 * Le différenciateur (wedge jour J). Ces fonctions sont couple-facing → visuels
 * LIGHT éditoriaux (cohérent avec l'univers « mariage éditorial »), par contraste
 * avec les aperçus dark du back-office ailleurs sur la page.
 */
export function ProsWedge() {
  const t = useTranslations('Pros');

  return (
    <section className="paper-grain relative overflow-hidden bg-[color:var(--color-surface-warm)] py-28">
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
            {t('wedge.eyebrow')}
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
            {t('wedge.title')}
          </motion.h2>
          <motion.p
            variants={scrollReveal}
            className="max-w-xl text-base leading-relaxed text-[color:var(--color-ink-500)]"
          >
            {t('wedge.subtitle')}
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {WEDGE.map((item) => {
            const Icon = item.icon;
            return (
              <motion.article
                key={item.key}
                variants={scrollReveal}
                className="group flex flex-col gap-4 rounded-3xl border border-[color:var(--color-border)] bg-white p-7 shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-300 [@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:shadow-[var(--shadow-blush)]"
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--color-blush-50)] text-[color:var(--color-blush-700)]"
                  aria-hidden
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3
                  className="font-display text-xl text-[color:var(--color-ink-900)] italic"
                  style={{ letterSpacing: '-0.018em' }}
                >
                  {t(`wedge.items.${item.key}.title` as Parameters<typeof t>[0])}
                </h3>
                <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)]">
                  {t(`wedge.items.${item.key}.detail` as Parameters<typeof t>[0])}
                </p>
              </motion.article>
            );
          })}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1, transition: { duration: 0.6, delay: 0.15 } }}
          viewport={inViewOnce}
          className="mx-auto mt-12 max-w-2xl text-center text-sm text-[color:var(--color-ink-500)]"
        >
          {t.rich('wedge.footnote', {
            strong: (chunks) => <span className="text-[color:var(--color-ink-900)]">{chunks}</span>,
          })}
        </motion.p>
      </div>
    </section>
  );
}
