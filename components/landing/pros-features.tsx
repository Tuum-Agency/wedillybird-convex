'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  Wallet,
  FileSignature,
  Store,
  Palette,
  Cable,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

/**
 * Section « Fonctionnalités principales pour les pros » — disposition BENTO.
 *
 * Tuiles de largeurs variées : 3 fonctionnalités phares en tuiles larges
 * teintées (cockpit, devis/contrats, portail couple), les 6 autres en tuiles
 * standard. L'ordre du tableau remplit exactement 3 rangées de 4 colonnes en
 * desktop (pas de cellule vide), repli 2 colonnes (sm) puis 1 colonne (mobile).
 * Sobre, sans photos, mêmes tokens que le reste de la landing. Copie i18n
 * (`Landing.prosFeatures`).
 */
const ITEMS: ReadonlyArray<{ key: string; Icon: LucideIcon; wide?: boolean }> = [
  { key: 'cockpit', Icon: LayoutDashboard, wide: true },
  { key: 'crm', Icon: Users },
  { key: 'planning', Icon: CalendarClock },
  { key: 'budget', Icon: Wallet },
  { key: 'docs', Icon: FileSignature, wide: true },
  { key: 'vendors', Icon: Store },
  { key: 'portal', Icon: Palette, wide: true },
  { key: 'integrations', Icon: Cable },
  { key: 'team', Icon: ShieldCheck },
];

export function LandingProsFeatures() {
  const t = useTranslations('Landing.prosFeatures');

  return (
    <section id="pros-features" className="bg-[color:var(--color-ivory-100)] py-28">
      <div className="container-page">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mx-auto mb-14 flex max-w-2xl flex-col items-center gap-4 text-center"
        >
          <motion.div variants={scrollReveal} className="ornament-divider" aria-hidden>
            <span className="font-display text-lg italic">✦</span>
          </motion.div>
          <motion.span
            variants={scrollReveal}
            className="font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-gold-700)] uppercase"
          >
            {t('eyebrow')}
          </motion.span>
          <motion.h2
            variants={scrollReveal}
            className="font-display text-balance italic"
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              lineHeight: 1.04,
              letterSpacing: '-0.025em',
              color: 'var(--color-ink-900)',
            }}
          >
            {t('title')}
          </motion.h2>
          <motion.p
            variants={scrollReveal}
            className="max-w-xl text-base text-[color:var(--color-ink-500)]"
          >
            {t('subtitle')}
          </motion.p>
        </motion.div>

        {/* Bento : 3 rangées de 4 colonnes en desktop (3 tuiles larges + 6 standard) */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {ITEMS.map(({ key, Icon, wide }) => (
            <motion.article
              key={key}
              variants={scrollReveal}
              className={cn(
                'flex flex-col gap-3 rounded-3xl p-6 transition-[transform,box-shadow] duration-300 sm:p-7 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-[var(--shadow-lifted)]',
                wide
                  ? 'paper-grain border border-[color:var(--color-blush-200)] shadow-[var(--shadow-soft)] lg:col-span-2'
                  : 'border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-[var(--shadow-soft)]',
              )}
              style={
                wide
                  ? {
                      background:
                        'linear-gradient(135deg, var(--color-blush-50) 0%, var(--color-champagne-50) 100%)',
                    }
                  : undefined
              }
            >
              <span
                aria-hidden
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--color-surface)] text-[color:var(--color-blush-700)] shadow-[var(--shadow-soft)]"
              >
                <Icon className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <h3
                className={cn(
                  'font-display text-[color:var(--color-ink-900)] italic',
                  wide ? 'text-xl' : 'text-lg',
                )}
                style={{ letterSpacing: '-0.018em' }}
              >
                {t(`items.${key}.name` as Parameters<typeof t>[0])}
              </h3>
              <p
                className={cn(
                  'leading-relaxed text-[color:var(--color-ink-500)]',
                  wide ? 'max-w-md text-sm' : 'text-sm',
                )}
              >
                {t(`items.${key}.desc` as Parameters<typeof t>[0])}
              </p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
