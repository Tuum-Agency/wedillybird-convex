'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';
import { PLANS } from '@/lib/payments/plans';
import { cn } from '@/lib/cn';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

interface Props {
  /** Pre-formatted prices passed from the server component (already region-aware). */
  prices: { essential: string; premium: string };
  upsellPriceLabel: string;
}

/**
 * Landing — Pricing 2 cards V2 (animées).
 *
 * Les prix arrivent **server-side** depuis `formatRegionalPlanPrice` (cf.
 * page.tsx) — ce composant est purement visuel/animation. Pas de logique geoIP
 * client-side.
 *
 * Card Premium : ringed terracotta, badge "Recommandé" en haut-droite,
 * scale: 1.03 desktop pour mettre en avant. Card Essentiel : minimaliste.
 *
 * Bandeau upsell post-mariage en glass card en bas, séparé visuellement.
 */
export function LandingPricingCards({ prices, upsellPriceLabel }: Props) {
  const t = useTranslations('Landing');
  const tPlans = useTranslations('Plans');
  const tCommon = useTranslations('Common');

  const tiers = [
    { tier: 'essential' as const, price: prices.essential, recommended: false },
    { tier: 'premium' as const, price: prices.premium, recommended: true },
  ];

  return (
    <section id="pricing" className="container-page py-24">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        variants={scrollRevealParent}
        className="mb-14 flex flex-col items-center gap-3 text-center"
      >
        <motion.span
          variants={scrollReveal}
          className="text-xs font-medium tracking-[0.2em] text-[color:var(--color-primary)] uppercase"
        >
          {t('pricing.eyebrow')}
        </motion.span>
        <motion.h2
          variants={scrollReveal}
          className="font-display max-w-2xl text-3xl text-balance italic sm:text-4xl md:text-5xl"
          style={{ letterSpacing: '-0.02em', lineHeight: 1.05 }}
        >
          {t('pricing.title')}
        </motion.h2>
        <motion.p
          variants={scrollReveal}
          className="max-w-xl text-sm text-[color:var(--color-muted-foreground)]"
        >
          {t('pricing.subtitle')}
        </motion.p>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        variants={scrollRevealParent}
        className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2"
      >
        {tiers.map(({ tier, price, recommended }) => {
          const plan = PLANS[tier];
          return (
            <motion.article
              key={tier}
              variants={scrollReveal}
              className={cn(
                'relative flex flex-col gap-5 rounded-3xl p-8 transition-[transform,box-shadow,border-color] duration-300',
                recommended
                  ? 'border-2 border-[color:var(--color-primary)] bg-[color:var(--color-surface)] shadow-[var(--shadow-lifted)] [@media(hover:hover)]:hover:-translate-y-1.5'
                  : 'border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-[var(--shadow-soft)] [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-[color:var(--color-border-strong)]',
              )}
            >
              {recommended && (
                <span className="absolute -top-3 right-6 inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-primary)] px-3 py-1 text-xs font-semibold tracking-wide text-[color:var(--color-primary-foreground)] shadow-[var(--shadow-soft)]">
                  <span aria-hidden>★</span>
                  {t('pricing.recommended')}
                </span>
              )}

              <div className="flex flex-col gap-1">
                <h3
                  className="font-display text-3xl italic"
                  style={{ letterSpacing: '-0.02em', lineHeight: 1.05 }}
                >
                  {t(`pricing.${tier}.name`)}
                </h3>
                <p className="text-sm text-[color:var(--color-muted-foreground)]">
                  {t(`pricing.${tier}.description`)}
                </p>
              </div>

              <div className="flex items-baseline gap-2">
                <span
                  data-testid={`price-${tier}`}
                  className="font-display text-5xl font-semibold tracking-tight text-[color:var(--color-foreground)] not-italic"
                >
                  {price}
                </span>
                <span className="text-sm text-[color:var(--color-muted-foreground)]">
                  {t('pricing.perEvent')}
                </span>
              </div>

              <ul className="flex flex-col gap-2.5 text-sm">
                {plan.featureKeys.map((key) => (
                  <li key={key} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]"
                    >
                      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                        <path
                          d="M2.5 6.5L5 9L9.5 3.5"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="leading-relaxed">{tPlans(`features.${key}` as const)}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/sign-up"
                className={cn(
                  buttonVariants({
                    variant: recommended ? 'primary' : 'outline',
                    size: 'lg',
                  }),
                  'mt-auto w-full',
                )}
              >
                {tCommon('continue')}
              </Link>
            </motion.article>
          );
        })}
      </motion.div>

      {/* Upsell post-event en glass card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0, transition: { duration: 0.55, delay: 0.15 } }}
        viewport={inViewOnce}
        className="mx-auto mt-10 max-w-3xl"
      >
        <div
          data-testid="upsell-note"
          className="relative overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-gradient-to-br from-[color:var(--color-surface)] to-[color:var(--color-primary-soft)]/40 p-7 backdrop-blur"
        >
          <div className="flex items-start gap-5">
            <span
              aria-hidden
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[color:var(--color-primary)]/15 text-2xl text-[color:var(--color-primary)]"
            >
              ❀
            </span>
            <div className="flex flex-col gap-1.5">
              <p
                className="font-display text-xl text-[color:var(--color-foreground)] italic"
                style={{ letterSpacing: '-0.015em' }}
              >
                {t('pricing.upsellTitle')}
              </p>
              <p className="text-sm text-[color:var(--color-muted-foreground)]">
                {t('pricing.upsellNote', { price: upsellPriceLabel })}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
