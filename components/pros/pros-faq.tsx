'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';
import { FAQ } from './content';

/**
 * FAQ pros — objections classiques des agences (vs HoneyBook, où va l'argent,
 * données, résiliation, dépassements, débutant). Accordéon une-ouverte, animé
 * via la transition CSS `grid-template-rows` (0fr → 1fr), sans dépendance.
 */
export function ProsFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 bg-[color:var(--color-surface)] py-28">
      <div className="container-page mx-auto max-w-3xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mb-12 flex flex-col gap-4"
        >
          <motion.span
            variants={scrollReveal}
            className="font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase"
          >
            Questions fréquentes
          </motion.span>
          <motion.h2
            variants={scrollReveal}
            className="font-display text-balance italic"
            style={{
              fontSize: 'clamp(1.875rem, 4.5vw, 3rem)',
              lineHeight: 1.05,
              color: 'var(--color-ink-900)',
            }}
          >
            Ce que les agences nous demandent.
          </motion.h2>
        </motion.div>

        <dl className="flex flex-col divide-y divide-[color:var(--color-border)] border-t border-[color:var(--color-border)]">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <dt>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="focus-ring flex w-full items-center justify-between gap-4 py-5 text-left"
                  >
                    <span className="font-display text-lg text-[color:var(--color-ink-900)] italic sm:text-xl">
                      {item.q}
                    </span>
                    <Plus
                      className={[
                        'h-4 w-4 flex-shrink-0 text-[color:var(--color-ink-500)] transition-transform duration-300',
                        isOpen ? 'rotate-45' : '',
                      ].join(' ')}
                      strokeWidth={2}
                      aria-hidden
                    />
                  </button>
                </dt>
                <dd
                  className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.22,1,.36,1)]"
                  style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <p className="pb-6 text-sm leading-relaxed text-[color:var(--color-ink-500)] sm:text-base">
                      {item.a}
                    </p>
                  </div>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
