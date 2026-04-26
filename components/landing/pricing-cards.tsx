'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Check, ShieldCheck, Calendar, Sparkles, Star } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';
import { PLANS } from '@/lib/payments/plans';
import { cn } from '@/lib/cn';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

interface Props {
  /** Pre-formatted prices passed from the server component (already region-aware via geoIP). */
  prices: { essential: string; premium: string };
  upsellPriceLabel: string;
}

/**
 * Landing — Pricing 2 cards V3.
 *
 * Détection régionale auto (côté server.tsx via geoIP). Pas de toggle manuel.
 * Card Premium ringed blush + scale-up desktop. Trust line en bas. Glass
 * card upsell post-mariage en dessous.
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
    <section id="pricing" className="paper-grain relative bg-[color:var(--color-surface)] py-28">
      <div className="container-page">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mx-auto mb-14 flex max-w-3xl flex-col items-center gap-3 text-center"
        >
          <motion.span
            variants={scrollReveal}
            className="text-xs font-medium tracking-[0.2em] text-[color:var(--color-champagne-700)] uppercase"
          >
            {t('pricing.eyebrow')}
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
            {t('pricing.title')}
          </motion.h2>
          <motion.p
            variants={scrollReveal}
            className="max-w-xl text-base text-[color:var(--color-ink-500)]"
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
                  'relative flex flex-col gap-6 rounded-3xl p-8 transition-[transform,box-shadow,border-color] duration-300',
                  recommended
                    ? 'border-2 border-[color:var(--color-blush-400)] bg-white shadow-[var(--shadow-blush)] [@media(hover:hover)]:hover:-translate-y-2'
                    : 'border border-[color:var(--color-border)] bg-white shadow-[var(--shadow-soft)] [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-[color:var(--color-border-strong)]',
                )}
              >
                {recommended && (
                  <span
                    className="absolute -top-3.5 right-7 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide text-white shadow-[var(--shadow-soft)]"
                    style={{
                      background:
                        'linear-gradient(135deg, oklch(72% 0.09 20) 0%, oklch(58% 0.075 80) 100%)',
                    }}
                  >
                    <Star className="h-3 w-3 fill-white" strokeWidth={2} aria-hidden />
                    {t('pricing.recommended')}
                  </span>
                )}

                <div className="flex flex-col gap-1.5">
                  <h3
                    className="font-display text-3xl italic sm:text-4xl"
                    style={{ letterSpacing: '-0.022em', lineHeight: 1.05 }}
                  >
                    {t(`pricing.${tier}.name`)}
                  </h3>
                  <p className="text-sm text-[color:var(--color-ink-500)]">
                    {t(`pricing.${tier}.description`)}
                  </p>
                </div>

                <div className="flex items-baseline gap-2">
                  <span
                    data-testid={`price-${tier}`}
                    className="font-display tabular-nums"
                    style={{
                      fontSize: 'clamp(2.75rem, 5vw, 3.75rem)',
                      fontStyle: 'italic',
                      fontWeight: 300,
                      letterSpacing: '-0.025em',
                      lineHeight: 1,
                      color: 'var(--color-ink-900)',
                    }}
                  >
                    {price}
                  </span>
                  <span className="text-sm text-[color:var(--color-ink-500)]">
                    {t('pricing.perEvent')}
                  </span>
                </div>

                <ul className="flex flex-col gap-2.5 text-sm">
                  {plan.featureKeys.map((key) => (
                    <li key={key} className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ background: 'oklch(82% 0.045 145)' }}
                      >
                        <Check
                          className="h-3 w-3 text-[color:var(--color-sage-700)]"
                          strokeWidth={3}
                          aria-hidden
                        />
                      </span>
                      <span className="leading-relaxed text-[color:var(--color-ink-700)]">
                        {tPlans(`features.${key}` as const)}
                      </span>
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

        {/* Upsell post-event */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0, transition: { duration: 0.55, delay: 0.15 } }}
          viewport={inViewOnce}
          className="mx-auto mt-10 max-w-3xl"
        >
          <div
            data-testid="upsell-note"
            className="relative overflow-hidden rounded-3xl border border-[color:var(--color-blush-200)] p-7"
            style={{
              background:
                'linear-gradient(135deg, oklch(98% 0.012 25) 0%, oklch(95% 0.022 85) 100%)',
            }}
          >
            <div className="flex items-start gap-5">
              <span
                aria-hidden
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl"
                style={{ background: 'oklch(91% 0.045 22)', color: 'var(--color-blush-700)' }}
              >
                <Sparkles className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              </span>
              <div className="flex flex-col gap-1.5">
                <p
                  className="font-display text-xl text-[color:var(--color-ink-900)] italic sm:text-2xl"
                  style={{ letterSpacing: '-0.018em' }}
                >
                  {t('pricing.upsellTitle')}
                </p>
                <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)]">
                  {t('pricing.upsellNote', { price: upsellPriceLabel })}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Trust line */}
        <motion.ul
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1, transition: { duration: 0.6, delay: 0.25 } }}
          viewport={inViewOnce}
          className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-x-7 gap-y-2 text-xs text-[color:var(--color-ink-500)]"
        >
          <li className="inline-flex items-center gap-1.5">
            <ShieldCheck
              className="h-3.5 w-3.5 text-[color:var(--color-sage-700)]"
              strokeWidth={2.25}
              aria-hidden
            />
            {t('pricing.trust.refund')}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <ShieldCheck
              className="h-3.5 w-3.5 text-[color:var(--color-sage-700)]"
              strokeWidth={2.25}
              aria-hidden
            />
            {t('pricing.trust.noSubscription')}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Calendar
              className="h-3.5 w-3.5 text-[color:var(--color-champagne-700)]"
              strokeWidth={2.25}
              aria-hidden
            />
            {t('pricing.trust.freePostpone')}
          </li>
        </motion.ul>
      </div>
    </section>
  );
}
