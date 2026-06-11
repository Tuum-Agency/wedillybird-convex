'use client';

import { motion } from 'motion/react';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';
import { JOURNEY } from './content';

/**
 * Constat → promesse : le parcours « de A à Z » en 6 étapes. Pose le récit de
 * valeur avant le détail des 11 piliers.
 */
export function ProsJourney() {
  return (
    <section className="relative bg-[color:var(--color-background)] py-28">
      <div className="container-page">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mb-16 flex max-w-3xl flex-col gap-5"
        >
          <motion.span
            variants={scrollReveal}
            className="font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase"
          >
            Le constat
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
            Vos mariages vivent dans dix outils. Réunissez-les.
          </motion.h2>
          <motion.p
            variants={scrollReveal}
            className="max-w-xl text-base leading-relaxed text-[color:var(--color-ink-500)]"
          >
            CRM ici, devis là, WhatsApp pour les invités, un Drive pour les photos. Wedillybird
            tient le mariage entier, du premier message au dernier cliché.
          </motion.p>
        </motion.div>

        {/* Timeline 6 étapes */}
        <motion.ol
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
        >
          {JOURNEY.map((s) => (
            <motion.li
              key={s.step}
              variants={scrollReveal}
              className="relative flex flex-col gap-2.5"
            >
              <div className="flex items-center gap-3">
                <span
                  className="font-display text-2xl text-[color:var(--color-gold-700)] italic"
                  style={{ letterSpacing: '0.04em' }}
                  aria-hidden
                >
                  {s.step}
                </span>
                <span aria-hidden className="h-px flex-1 bg-[color:var(--color-border)]" />
              </div>
              <h3
                className="font-display text-xl text-[color:var(--color-ink-900)] italic"
                style={{ letterSpacing: '-0.018em' }}
              >
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)]">
                {s.detail}
              </p>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
