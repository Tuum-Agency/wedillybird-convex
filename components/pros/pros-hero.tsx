'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { EASE_OUT_QUINT } from '@/lib/motion/presets';
import { BrowserFrame, CockpitMock } from './previews';

const CHIP_KEYS = ['scale', 'rsvp', 'whiteLabel', 'payments'] as const;

/**
 * Hero de la page Pros. Chrome light éditorial ; à droite, l'aperçu cockpit dark
 * encadré (artefact) qui montre l'outil « Linear-grade » que l'agence utilisera.
 */
export function ProsHero() {
  const t = useTranslations('Pros');

  return (
    <section className="paper-grain relative overflow-hidden bg-[color:var(--color-surface)] pt-16 pb-24 sm:pt-24">
      {/* Halo blush en fond, côté produit */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-10 right-0 h-[36rem] w-[36rem] rounded-full opacity-60 blur-3xl"
        style={{
          background: 'radial-gradient(closest-side, oklch(91% 0.045 22 / 70%), transparent)',
        }}
      />
      <div className="container-page relative">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Texte */}
          <div className="flex flex-col gap-6 lg:col-span-5">
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT_QUINT }}
              className="font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase"
            >
              {t('hero.eyebrow')}
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT_QUINT, delay: 0.05 }}
              className="font-display text-balance italic"
              style={{
                fontSize: 'clamp(2.5rem, 6vw, 4.25rem)',
                lineHeight: 1.0,
                letterSpacing: '-0.03em',
                color: 'var(--color-ink-900)',
              }}
            >
              {t('hero.title')}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT_QUINT, delay: 0.12 }}
              className="max-w-md text-base leading-relaxed text-[color:var(--color-ink-500)] sm:text-lg"
            >
              {t('hero.subtitle')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT_QUINT, delay: 0.18 }}
              className="flex flex-wrap items-center gap-3"
            >
              <Link
                href={'/sign-up?plan=business&billing=monthly' as never}
                className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'group')}
              >
                {t('hero.ctaPrimary')}
                <ArrowRight
                  className="ml-0.5 h-4 w-4 transition-transform [@media(hover:hover)]:group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <Link
                href={'#tarifs' as never}
                className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
              >
                {t('hero.ctaSecondary')}
              </Link>
            </motion.div>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-2 pt-2"
            >
              {CHIP_KEYS.map((chip) => (
                <li
                  key={chip}
                  className="rounded-full border border-[color:var(--color-border)] bg-white/70 px-3 py-1 text-xs text-[color:var(--color-ink-500)]"
                >
                  {t(`hero.chips.${chip}` as Parameters<typeof t>[0])}
                </li>
              ))}
            </motion.ul>
          </div>

          {/* Aperçu produit */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: EASE_OUT_QUINT, delay: 0.2 }}
            className="lg:col-span-7"
          >
            <BrowserFrame url="studio-lumiere.wedillybird.com/cockpit">
              <CockpitMock />
            </BrowserFrame>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
