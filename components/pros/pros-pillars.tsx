'use client';

import { type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';
import { PILLARS } from './content';
import { TierBadge } from './tier-badge';
import { BrowserFrame, CrmMock, BudgetMock } from './previews';

const PREVIEWS: Record<string, { url: string; node: ReactNode }> = {
  crm: { url: 'studio-lumiere.wedillybird.com/crm', node: <CrmMock /> },
  budget: { url: 'studio-lumiere.wedillybird.com/mariage/budget', node: <BudgetMock /> },
};

/**
 * Section centrale : les 11 piliers fonctionnels, chacun détaillé feature par
 * feature avec son forfait. Deux piliers (CRM, budget) portent un aperçu produit
 * dark encadré. Le reste est une grille éditoriale light.
 */
export function ProsPillars() {
  const t = useTranslations('Pros');

  return (
    <section
      id="fonctionnalites"
      className="paper-grain relative bg-[color:var(--color-ivory-100)] py-28"
    >
      <div className="container-page">
        {/* En-tête de section */}
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={inViewOnce}
          className="mb-10 inline-block font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase"
        >
          {t('pillars.eyebrow')}
        </motion.span>

        <motion.header
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mb-12 flex max-w-3xl flex-col gap-5"
        >
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
            {t('pillars.title')}
          </motion.h2>
          <motion.p
            variants={scrollReveal}
            className="max-w-xl text-base leading-relaxed text-[color:var(--color-ink-500)]"
          >
            {t('pillars.subtitle')}
          </motion.p>

          {/* Légende des badges */}
          <motion.div
            variants={scrollReveal}
            className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1"
          >
            <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--color-ink-500)]">
              <Check
                className="h-3.5 w-3.5 text-[color:var(--color-gold-500)]"
                strokeWidth={2}
                aria-hidden
              />
              {t('pillars.legend.all')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--color-ink-500)]">
              <TierBadge tier="business" /> {t('pillars.legend.business')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--color-ink-500)]">
              <TierBadge tier="agency" /> {t('pillars.legend.agency')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--color-ink-500)]">
              <TierBadge tier="addon" /> {t('pillars.legend.addon')}
            </span>
          </motion.div>
        </motion.header>

        {/* Les 11 piliers */}
        <div className="flex flex-col gap-5">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            const preview = PREVIEWS[pillar.id];
            return (
              <motion.article
                key={pillar.id}
                id={`pilier-${pillar.id}`}
                initial="hidden"
                whileInView="visible"
                viewport={inViewOnce}
                variants={scrollRevealParent}
                className="scroll-mt-24 overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white shadow-[var(--shadow-soft)]"
              >
                <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
                  {/* Colonne gauche : identité du pilier */}
                  <motion.div
                    variants={scrollReveal}
                    className="flex flex-col gap-4 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-warm)] p-7 sm:p-9 lg:border-r lg:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-[color:var(--color-blush-700)] shadow-[var(--shadow-soft)]"
                        aria-hidden
                      >
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <span
                        className="font-display text-sm text-[color:var(--color-gold-700)] italic"
                        style={{ letterSpacing: '0.28em' }}
                        aria-hidden
                      >
                        {pillar.number}
                      </span>
                    </div>
                    <h3
                      className="font-display text-2xl text-balance text-[color:var(--color-ink-900)] italic sm:text-3xl"
                      style={{ letterSpacing: '-0.02em', lineHeight: 1.08 }}
                    >
                      {t(`pillars.items.${pillar.id}.name` as Parameters<typeof t>[0])}
                    </h3>
                    <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)]">
                      {t(`pillars.items.${pillar.id}.summary` as Parameters<typeof t>[0])}
                    </p>
                  </motion.div>

                  {/* Colonne droite : features détaillées */}
                  <div className="grid content-start gap-x-8 gap-y-5 p-7 sm:grid-cols-2 sm:p-9">
                    {pillar.features.map((f) => (
                      <motion.div
                        key={f.key}
                        variants={scrollReveal}
                        className="flex flex-col gap-1"
                      >
                        <div className="flex items-center gap-2">
                          {f.tier === 'all' && (
                            <Check
                              className="h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-gold-500)]"
                              strokeWidth={2}
                              aria-hidden
                            />
                          )}
                          <h4 className="text-sm font-medium text-[color:var(--color-ink-900)]">
                            {t(
                              `pillars.items.${pillar.id}.features.${f.key}.name` as Parameters<
                                typeof t
                              >[0],
                            )}
                          </h4>
                          <TierBadge tier={f.tier} />
                        </div>
                        <p className="text-[13px] leading-relaxed text-[color:var(--color-ink-500)]">
                          {t(
                            `pillars.items.${pillar.id}.features.${f.key}.detail` as Parameters<
                              typeof t
                            >[0],
                          )}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Aperçu produit dark, en bande pleine largeur (artefact encadré) */}
                {preview && (
                  <motion.div
                    variants={scrollReveal}
                    className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-warm)] p-5 sm:p-8"
                  >
                    <BrowserFrame url={preview.url} className="mx-auto max-w-3xl">
                      {preview.node}
                    </BrowserFrame>
                  </motion.div>
                )}
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
