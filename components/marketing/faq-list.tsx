'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';

const KEYS = [
  'account',
  'invitations',
  'rsvp',
  'checkin',
  'gallery',
  'pricing',
  'support',
  'guestVsInvitation',
] as const;

/**
 * FaqList V4 — accordion avec animations Motion height + chevron rotate.
 * 1 ouvert à la fois (single-expand). Cohérent avec le faq-accordion de la
 * landing — même grammaire, juste re-localisée pour la page /faq dédiée.
 */
export function FaqList() {
  const t = useTranslations('Faq');
  const [openKey, setOpenKey] = useState<(typeof KEYS)[number] | null>(KEYS[0] ?? null);

  return (
    <ul className="flex flex-col gap-3">
      {KEYS.map((key) => {
        const isOpen = openKey === key;
        return (
          <li
            key={key}
            className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white"
          >
            <button
              type="button"
              className="focus-ring flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-[color:var(--color-ivory-100)]"
              aria-expanded={isOpen}
              onClick={() => setOpenKey(isOpen ? null : key)}
            >
              <span className="text-base font-semibold text-[color:var(--color-ink-900)] sm:text-lg">
                {t(`questions.${key}.q` as const)}
              </span>
              <ChevronDown
                className={`h-4 w-4 flex-shrink-0 text-[color:var(--color-blush-700)] transition-transform duration-300 ${
                  isOpen ? 'rotate-180' : ''
                }`}
                strokeWidth={2.5}
                aria-hidden
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-6 pb-6 text-sm leading-relaxed text-[color:var(--color-ink-500)] sm:text-base">
                    {t(`questions.${key}.a` as const)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
