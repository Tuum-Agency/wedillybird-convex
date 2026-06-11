'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Check, Sparkles, Star } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';
import {
  PAYG_PRO_PRICE,
  SUBSCRIPTION_TIER_ANNUAL_PRICES,
  SUBSCRIPTION_TIER_PRICES,
  type SubscriptionTier,
} from '@/lib/payments/subscriptions';
import { formatAmount, priceFontSizeClamp, type Currency } from '@/lib/payments/plans';
import { convertFromEur } from '@/lib/payments/currency';
import { useEffectiveCurrency } from '@/stores/currency-store';
import { cn } from '@/lib/cn';
import { inViewOnce, scrollReveal, scrollRevealParent } from '@/lib/motion/presets';

const PRO_FEATURE_KEYS: Record<SubscriptionTier, ReadonlyArray<string>> = {
  starter: [
    's_events',
    's_guests',
    's_quota',
    's_messages',
    's_seats',
    's_execution',
    's_crm',
    's_budget',
    's_brand',
  ],
  business: [
    'b_inherit',
    'b_quota',
    'b_storage',
    'b_messages',
    'b_seats',
    'b_crm',
    'b_docs',
    'b_budget',
    'b_portal',
  ],
  agency: [
    'a_inherit',
    'a_quota',
    'a_storage',
    'a_messages',
    'a_seats',
    'a_integrations',
    'a_analytics',
    'a_brand',
    'a_am',
  ],
};

const PAYG_FEATURE_KEYS = ['p_exec', 'p_quota', 'p_nosub'] as const;

/** Clés rendues comme intertitre « Tout X, plus : » (sans coche, en gras). */
const INHERIT_KEYS = new Set<string>(['b_inherit', 'a_inherit']);

type Billing = 'monthly' | 'annual';

type LandingPricingProsProps = {
  /**
   * Devise par défaut (dérivée de la locale côté server). Le composant lit
   * ensuite le store pour appliquer l'override utilisateur s'il en a choisi
   * un via le sélecteur footer.
   */
  defaultCurrency?: Currency;
  /**
   * Libellé de l'eyebrow de section. Défaut = numérotation de la landing
   * ("CHAPITRE 06B…") ; la page `/pros` passe un libellé autonome. Optionnel
   * pour que l'usage landing reste strictement inchangé.
   */
  eyebrow?: string;
};

/**
 * Landing — Pricing Pros section V3.
 *
 * Toggle Mensuel / Annuel (radio-style, pattern Linear).
 * 3 cards Starter / Business / Agency en grille md:grid-cols-3.
 * Card PAYG en aside séparé en dessous.
 *
 * EUR est la source de vérité. Les montants sont convertis dans la devise
 * effective (override utilisateur via le store, sinon devise par défaut de la
 * locale).
 */
export function LandingPricingPros({
  defaultCurrency = 'EUR',
  eyebrow = 'CHAPITRE 06B — FORFAITS PROS',
}: LandingPricingProsProps = {}) {
  const t = useTranslations('Landing');
  const tPlans = useTranslations('Plans');
  const currency = useEffectiveCurrency(defaultCurrency);

  const [billing, setBilling] = useState<Billing>('monthly');

  const tiers: Array<{
    tier: SubscriptionTier;
    recommended: boolean;
    ring: 'none' | 'blush' | 'gold';
  }> = [
    { tier: 'starter', recommended: false, ring: 'none' },
    { tier: 'business', recommended: true, ring: 'blush' },
    { tier: 'agency', recommended: false, ring: 'gold' },
  ];

  function getMonthlyEquivalentLabel(tier: SubscriptionTier): string {
    if (billing === 'monthly') {
      const minor = convertFromEur(SUBSCRIPTION_TIER_PRICES[tier].amountMinor, currency);
      return formatAmount(minor, currency);
    }
    const annualMinor = convertFromEur(SUBSCRIPTION_TIER_ANNUAL_PRICES[tier].amountMinor, currency);
    const monthlyEquivMinor = Math.round(annualMinor / 12);
    return formatAmount(monthlyEquivMinor, currency);
  }

  function getAnnualBilledLabel(tier: SubscriptionTier): string {
    const minor = convertFromEur(SUBSCRIPTION_TIER_ANNUAL_PRICES[tier].amountMinor, currency);
    return formatAmount(minor, currency);
  }

  const paygLabel = formatAmount(convertFromEur(PAYG_PRO_PRICE.amountMinor, currency), currency);

  return (
    <section
      id="pricing-pros"
      className="paper-grain relative bg-[color:var(--color-surface)] py-32"
    >
      <div className="container-page">
        {/* Eyebrow chapitre */}
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={inViewOnce}
          className="mb-12 inline-block font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase"
        >
          {eyebrow}
        </motion.span>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mx-auto mb-10 flex max-w-3xl flex-col items-center gap-3 text-center"
        >
          <motion.h2
            variants={scrollReveal}
            className="font-display text-balance italic"
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
            }}
          >
            {t('pricing.prosTitle')}
          </motion.h2>
          <motion.p
            variants={scrollReveal}
            className="max-w-xl text-base text-[color:var(--color-ink-500)]"
          >
            {t('pricing.prosSubtitle')}
          </motion.p>
        </motion.div>

        {/* Toggle Mensuel / Annuel */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0, transition: { duration: 0.4 } }}
          viewport={inViewOnce}
          className="mb-12 flex items-center justify-center gap-3"
        >
          <div
            role="radiogroup"
            aria-label={tPlans('pro.billing.frequencyAriaLabel')}
            className="inline-flex rounded-full border border-[color:var(--color-border)] bg-white p-1 shadow-[var(--shadow-soft)]"
          >
            <button
              role="radio"
              aria-checked={billing === 'monthly'}
              onClick={() => setBilling('monthly')}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-medium transition-all duration-200',
                billing === 'monthly'
                  ? 'bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] shadow-[var(--shadow-soft)]'
                  : 'text-[color:var(--color-ink-500)] hover:text-[color:var(--color-ink-900)]',
              )}
            >
              {tPlans('pro.billing.monthly')}
            </button>
            <button
              role="radio"
              aria-checked={billing === 'annual'}
              onClick={() => setBilling('annual')}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-medium transition-all duration-200',
                billing === 'annual'
                  ? 'bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] shadow-[var(--shadow-soft)]'
                  : 'text-[color:var(--color-ink-500)] hover:text-[color:var(--color-ink-900)]',
              )}
            >
              {tPlans('pro.billing.annual')}
            </button>
          </div>

          {/* Badge économies — n'apparaît qu'en mode annuel */}
          <motion.span
            initial={false}
            animate={billing === 'annual' ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.2 }}
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-[color:var(--color-gold-800)]"
            style={{ background: 'oklch(95% 0.045 80)' }}
            aria-live="polite"
            aria-atomic="true"
          >
            {tPlans('pro.billing.annualSavings')}
          </motion.span>
        </motion.div>

        {/* Grille 3 cards */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          variants={scrollRevealParent}
          className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3"
        >
          {tiers.map(({ tier, recommended, ring }) => (
            <motion.article
              key={tier}
              variants={scrollReveal}
              className={cn(
                'relative flex flex-col gap-6 rounded-3xl p-8 transition-[transform,box-shadow,border-color] duration-300',
                ring === 'blush'
                  ? 'group border-2 border-[color:var(--color-blush-400)] bg-white shadow-[var(--shadow-blush)] [@media(hover:hover)]:hover:-translate-y-2'
                  : ring === 'gold'
                    ? 'border-2 bg-white shadow-[var(--shadow-soft)] [@media(hover:hover)]:hover:-translate-y-1'
                    : 'border border-[color:var(--color-border)] bg-white shadow-[var(--shadow-soft)] [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-[color:var(--color-border-strong)]',
              )}
              style={ring === 'gold' ? { borderColor: 'oklch(78% 0.12 78)' } : undefined}
            >
              {/* Sparkle hover effect — Business seulement */}
              {recommended && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
                >
                  <span
                    className="absolute inset-0 -translate-x-full opacity-0 transition-all duration-700 [@media(hover:hover)]:group-hover:translate-x-full [@media(hover:hover)]:group-hover:opacity-100"
                    style={{
                      background:
                        'linear-gradient(115deg, transparent 30%, oklch(88% 0.05 80 / 35%) 48%, oklch(78% 0.075 78 / 50%) 50%, oklch(88% 0.05 80 / 35%) 52%, transparent 70%)',
                    }}
                  />
                </div>
              )}

              {/* Badge "Le plus choisi" — Business */}
              {recommended && (
                <span
                  className="absolute -top-3.5 right-7 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide text-white shadow-[var(--shadow-soft)]"
                  style={{
                    background:
                      'linear-gradient(135deg, oklch(72% 0.09 20) 0%, oklch(58% 0.075 80) 100%)',
                  }}
                >
                  <Star className="h-3 w-3 fill-white" strokeWidth={2} aria-hidden />
                  {t('pricing.prosRecommended')}
                </span>
              )}

              {/* Tier name + description */}
              <div className="flex flex-col gap-1.5">
                <h3
                  className="font-display text-3xl italic sm:text-4xl"
                  style={{ letterSpacing: '-0.022em', lineHeight: 1.05 }}
                >
                  {tPlans(`pro.tiers.${tier}` as const)}
                </h3>
                <p className="text-sm text-[color:var(--color-ink-500)]">
                  {tPlans(`pro.descriptions.${tier}` as const)}
                </p>
              </div>

              {/* Prix */}
              <div className="flex flex-col gap-0.5">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span
                    className="font-display tabular-nums"
                    style={{
                      fontSize: priceFontSizeClamp(getMonthlyEquivalentLabel(tier), 'card-compact'),
                      fontStyle: 'italic',
                      fontWeight: 300,
                      letterSpacing: '-0.025em',
                      lineHeight: 1,
                      color: 'var(--color-ink-900)',
                    }}
                  >
                    {getMonthlyEquivalentLabel(tier)}
                  </span>
                  <span className="text-sm text-[color:var(--color-ink-500)]">
                    {tPlans('pro.billing.perMonth')}
                  </span>
                </div>
                {billing === 'annual' && (
                  <p className="text-xs text-[color:var(--color-ink-400)]">
                    {tPlans('pro.billing.annualBilledAs', { amount: getAnnualBilledLabel(tier) })}
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="flex flex-col gap-2.5 text-sm">
                {PRO_FEATURE_KEYS[tier].map((key) =>
                  INHERIT_KEYS.has(key) ? (
                    <li key={key} className="pt-1 font-medium text-[color:var(--color-ink-900)]">
                      {tPlans(`pro.features.${key}` as Parameters<typeof tPlans>[0])}
                    </li>
                  ) : (
                    <li key={key} className="flex items-start gap-2.5">
                      <Check
                        aria-hidden
                        className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-gold-500)]"
                        strokeWidth={2}
                      />
                      <span className="leading-relaxed text-[color:var(--color-ink-700)]">
                        {tPlans(`pro.features.${key}` as Parameters<typeof tPlans>[0])}
                      </span>
                    </li>
                  ),
                )}
              </ul>

              {/* CTA */}
              <Link
                href={`/sign-up?plan=${tier}&billing=${billing}` as never}
                className={cn(
                  buttonVariants({
                    variant: recommended ? 'primary' : 'outline',
                    size: 'lg',
                  }),
                  'mt-auto w-full',
                )}
              >
                {t('pricing.prosCheckCta')}
              </Link>
            </motion.article>
          ))}
        </motion.div>

        {/* Card PAYG en aside */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0, transition: { duration: 0.55, delay: 0.1 } }}
          viewport={inViewOnce}
          className="mx-auto mt-8 max-w-6xl"
        >
          <div
            className="relative overflow-hidden rounded-3xl border border-[color:var(--color-border)] p-7"
            style={{
              background:
                'linear-gradient(135deg, oklch(98% 0.006 260) 0%, oklch(96% 0.012 80) 100%)',
            }}
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
              {/* Icone */}
              <span
                aria-hidden
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl"
                style={{ background: 'oklch(91% 0.045 22)', color: 'var(--color-blush-700)' }}
              >
                <Sparkles className="h-5 w-5" strokeWidth={1.5} />
              </span>

              {/* Contenu */}
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline gap-3">
                  <p
                    className="font-display text-xl text-[color:var(--color-ink-900)] italic sm:text-2xl"
                    style={{ letterSpacing: '-0.018em' }}
                  >
                    {tPlans('pro.tiers.payg')}
                  </p>
                  <span className="font-display text-lg text-[color:var(--color-ink-900)] italic">
                    {paygLabel}
                    <span className="ml-1 text-sm font-normal text-[color:var(--color-ink-500)] not-italic">
                      {tPlans('pro.billing.perEvent')}
                    </span>
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)]">
                  {tPlans('pro.descriptions.payg')}
                </p>
                {/* Features inline séparées par · */}
                <p className="mt-1 text-xs text-[color:var(--color-ink-400)]">
                  {PAYG_FEATURE_KEYS.map((key, i) => (
                    <span key={key}>
                      {i > 0 && (
                        <span aria-hidden className="mx-1.5 opacity-40">
                          ·
                        </span>
                      )}
                      {tPlans(`pro.features.${key}` as Parameters<typeof tPlans>[0])}
                    </span>
                  ))}
                </p>
              </div>

              {/* Lien texte */}
              <Link
                href="/forfaits-pros"
                className="flex-shrink-0 text-sm font-medium text-[color:var(--color-primary)] underline-offset-4 hover:underline"
              >
                Voir le détail
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Options transverses (add-ons) */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1, transition: { duration: 0.5, delay: 0.15 } }}
          viewport={inViewOnce}
          className="mx-auto mt-8 max-w-6xl text-center text-sm text-[color:var(--color-ink-500)]"
        >
          {tPlans('pro.addons')}
        </motion.p>

        {/* Dépassements — bloc complet, une ligne par type (grille v3) */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1, transition: { duration: 0.5, delay: 0.2 } }}
          viewport={inViewOnce}
          className="mx-auto mt-6 max-w-6xl"
        >
          <p className="mb-2.5 font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase">
            {tPlans('pro.overflow.title')}
          </p>
          <ul className="grid gap-x-10 gap-y-1.5 font-mono text-[10px] leading-relaxed text-[color:var(--color-ink-400)] sm:grid-cols-2">
            <li>{tPlans('pro.overflow.whatsapp')}</li>
            <li>{tPlans('pro.overflow.guests')}</li>
            <li>{tPlans('pro.overflow.storage')}</li>
            <li>{tPlans('pro.overflow.event')}</li>
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
