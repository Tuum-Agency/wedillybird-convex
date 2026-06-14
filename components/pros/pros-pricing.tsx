'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LandingPricingPros } from '@/components/landing/pricing-pros';
import type { Currency } from '@/lib/payments/plans';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';
import { ADDONS, CAPACITIES, OVERAGES } from './content';

const CAPACITY_TIERS = ['starter', 'business', 'agency'] as const;

/**
 * Section tarifs de la page Pros. Réutilise `LandingPricingPros` (toggle
 * mensuel/annuel, 3 forfaits + PAYG, multi-devise, traduit) puis ajoute le
 * comparatif de capacités et les options/dépassements transverses.
 */
export function ProsPricing({ defaultCurrency }: { defaultCurrency: Currency }) {
  const t = useTranslations('Pros');
  const tPlans = useTranslations('Plans');

  return (
    <div id="tarifs" className="scroll-mt-20">
      <LandingPricingPros defaultCurrency={defaultCurrency} eyebrow={t('pricing.eyebrowChapter')} />

      {/* Comparatif capacités + options */}
      <section className="bg-[color:var(--color-ivory-100)] py-24">
        <div className="container-page">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={inViewOnce}
            variants={scrollRevealParent}
            className="mb-10 flex max-w-2xl flex-col gap-3"
          >
            <motion.span
              variants={scrollReveal}
              className="font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase"
            >
              {t('pricing.eyebrow')}
            </motion.span>
            <motion.h2
              variants={scrollReveal}
              className="font-display text-balance italic"
              style={{
                fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
                lineHeight: 1.05,
                color: 'var(--color-ink-900)',
              }}
            >
              {t('pricing.title')}
            </motion.h2>
          </motion.div>

          {/* Table capacités */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0, transition: { duration: 0.5 } }}
            viewport={inViewOnce}
            className="overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white shadow-[var(--shadow-soft)]"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--color-border)]">
                    <th className="px-5 py-4 text-left font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-ink-500)] uppercase">
                      {t('pricing.capacityColumn')}
                    </th>
                    {CAPACITY_TIERS.map((tier) => (
                      <th
                        key={tier}
                        className={[
                          'font-display px-5 py-4 text-right text-base italic',
                          tier === 'business'
                            ? 'bg-[color:var(--color-blush-50)] text-[color:var(--color-blush-700)]'
                            : 'text-[color:var(--color-ink-900)]',
                        ].join(' ')}
                      >
                        {tPlans(`pro.tiers.${tier}` as const)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CAPACITIES.map((row) => (
                    <tr
                      key={row.key}
                      className="border-b border-[color:var(--color-border)] last:border-b-0"
                    >
                      <td className="px-5 py-3.5 text-left text-[color:var(--color-ink-700)]">
                        {t(`pricing.capacities.${row.key}` as Parameters<typeof t>[0])}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[color:var(--color-ink-500)] tabular-nums">
                        {row.starter}
                      </td>
                      <td className="bg-[color:var(--color-blush-50)] px-5 py-3.5 text-right font-mono text-[color:var(--color-ink-900)] tabular-nums">
                        {row.business}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[color:var(--color-ink-500)] tabular-nums">
                        {row.agencyIsKey
                          ? t(`pricing.capacityValues.${row.agency}` as Parameters<typeof t>[0])
                          : row.agency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Options + Dépassements */}
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0, transition: { duration: 0.5 } }}
              viewport={inViewOnce}
              className="rounded-3xl border border-[color:var(--color-border)] bg-white p-7 shadow-[var(--shadow-soft)]"
            >
              <h3 className="mb-5 font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-ink-500)] uppercase">
                {t('pricing.addonsTitle')}
              </h3>
              <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
                {ADDONS.map((a) => (
                  <li key={a.key} className="flex items-start justify-between gap-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-[color:var(--color-ink-900)]">
                        {t(`pricing.addons.${a.key}.label` as Parameters<typeof t>[0])}
                      </span>
                      <span className="text-xs leading-relaxed text-[color:var(--color-ink-500)]">
                        {t(`pricing.addons.${a.key}.detail` as Parameters<typeof t>[0])}
                      </span>
                    </div>
                    <span className="flex-shrink-0 font-mono text-sm text-[color:var(--color-blush-700)] tabular-nums">
                      {t(`pricing.addons.${a.key}.price` as Parameters<typeof t>[0])}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.05 } }}
              viewport={inViewOnce}
              className="rounded-3xl border border-[color:var(--color-border)] bg-white p-7 shadow-[var(--shadow-soft)]"
            >
              <h3 className="mb-5 font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-ink-500)] uppercase">
                {t('pricing.overagesTitle')}
              </h3>
              <ul className="flex flex-col divide-y divide-[color:var(--color-border)]">
                {OVERAGES.map((o) => (
                  <li key={o.key} className="flex items-start justify-between gap-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-[color:var(--color-ink-900)]">
                        {t(`pricing.overages.${o.key}.label` as Parameters<typeof t>[0])}
                      </span>
                      <span className="text-xs leading-relaxed text-[color:var(--color-ink-500)]">
                        {t(`pricing.overages.${o.key}.detail` as Parameters<typeof t>[0])}
                      </span>
                    </div>
                    <span className="flex-shrink-0 font-mono text-sm text-[color:var(--color-ink-700)] tabular-nums">
                      {t(`pricing.overages.${o.key}.price` as Parameters<typeof t>[0])}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-[color:var(--color-ink-400)]">
                {t('pricing.overagesNote')}
              </p>
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1, transition: { duration: 0.5, delay: 0.1 } }}
            viewport={inViewOnce}
            className="mt-8 text-center text-sm text-[color:var(--color-ink-500)]"
          >
            {t.rich('pricing.compareNote', {
              link: (chunks) => (
                <Link
                  href="/forfaits-pros"
                  className="font-medium text-[color:var(--color-primary)] underline-offset-4 hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </motion.p>
        </div>
      </section>
    </div>
  );
}
