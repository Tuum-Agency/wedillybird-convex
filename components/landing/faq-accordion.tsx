'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

const FAQ_KEYS = [
  'whyWhatsapp',
  'olderGuests',
  'guestLimit',
  'cancellation',
  'afterEvent',
  'africa3g',
  'branding',
  'data',
] as const;

/**
 * Landing — FAQ accordion V3.
 *
 * 8 questions/réponses, 1 seule ouverte à la fois (single-expand). Animation
 * height fluide via Motion. ARIA expanded + section landmark.
 */
export function LandingFaqAccordion() {
  const t = useTranslations('Landing.faq');
  const [openKey, setOpenKey] = useState<(typeof FAQ_KEYS)[number] | null>('whyWhatsapp');

  return (
    <section className="container-page py-28">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        variants={scrollRevealParent}
        className="mx-auto mb-12 flex max-w-3xl flex-col items-center gap-3 text-center"
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

      <motion.dl
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        variants={scrollRevealParent}
        className="mx-auto flex max-w-3xl flex-col gap-3"
      >
        {FAQ_KEYS.map((key) => {
          const isOpen = openKey === key;
          return (
            <motion.div
              key={key}
              variants={scrollReveal}
              className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white"
            >
              <dt>
                <button
                  type="button"
                  className="focus-ring flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-[color:var(--color-ivory-100)]"
                  aria-expanded={isOpen}
                  onClick={() => setOpenKey(isOpen ? null : key)}
                >
                  <span className="text-base font-semibold text-[color:var(--color-ink-900)] sm:text-lg">
                    {t(`items.${key}.q`)}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 flex-shrink-0 text-[color:var(--color-blush-700)] transition-transform duration-300 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    strokeWidth={2.5}
                    aria-hidden
                  />
                </button>
              </dt>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.dd
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-6 text-sm leading-relaxed text-[color:var(--color-ink-500)] sm:text-base">
                      {t(`items.${key}.a`)}
                    </p>
                  </motion.dd>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </motion.dl>
    </section>
  );
}
