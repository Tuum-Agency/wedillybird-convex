'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Sparkles, RefreshCw, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BillingDialog, RecapCard, RecapRow } from '@/components/pro/billing-dialogs';
import type { SubscriptionTier } from '@/lib/payments/subscriptions';

export interface PlanCardData {
  tier: SubscriptionTier;
  label: string;
  descriptionKey: string;
  featureKeys: readonly string[];
  monthlyMinor: number;
  annualMinor: number;
  isCurrent: boolean;
  isMid: boolean;
}

/** Quotas par forfait (récap du dialogue de changement). */
export type TierMeta = Record<
  SubscriptionTier,
  { events: number; messages: number; storageGo: number }
>;

const TIER_RANK: Record<SubscriptionTier, number> = { starter: 0, business: 1, agency: 2 };

function formatPrice(minor: number, locale: string): string {
  return `${(minor / 100).toLocaleString(locale, { minimumFractionDigits: 0 })} €`;
}

function fmtNum(n: number): string {
  return n.toLocaleString('fr-FR');
}

/**
 * Grille des forfaits Pro avec bascule mensuel / annuel (−20 %). Les libellés
 * de forfait/features restent i18n ; la bascule et le suffixe de période sont
 * en FR (back-office). Le formulaire de souscription porte `tier` + `billing`.
 */
export function PlanCards({
  plans,
  hasActive,
  hasCurrentTier,
  locale,
  subscribeAction,
  currentTier = null,
  tierMeta,
}: {
  plans: ReadonlyArray<PlanCardData>;
  hasActive: boolean;
  hasCurrentTier: boolean;
  locale: string;
  subscribeAction: (formData: FormData) => void | Promise<void>;
  currentTier?: SubscriptionTier | null;
  tierMeta?: TierMeta;
}) {
  const tBilling = useTranslations('Billing');
  const tPlans = useTranslations('Plans');
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [confirm, setConfirm] = useState<PlanCardData | null>(null);

  const current = currentTier ? (plans.find((p) => p.tier === currentTier) ?? null) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Bascule mensuel / annuel */}
      <div className="flex items-center justify-center">
        <div
          className="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1"
          role="group"
          aria-label="Période de facturation"
        >
          {(['monthly', 'annual'] as const).map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={billing === b}
              onClick={() => setBilling(b)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-colors ${
                billing === b
                  ? 'bg-[color:var(--color-surface-elevated)] font-medium text-[color:var(--color-foreground)]'
                  : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]'
              }`}
            >
              {b === 'monthly' ? 'Mensuel' : 'Annuel'}
              {b === 'annual' ? (
                <span className="rounded-full bg-[color:var(--color-sage-500)]/15 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.08em] text-[color:var(--color-sage-500)] uppercase">
                  −20 %
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3" data-testid="tier-grid">
        {plans.map((plan) => {
          const amount = billing === 'annual' ? plan.annualMinor : plan.monthlyMinor;
          return (
            <article
              key={plan.tier}
              data-testid={`tier-card-${plan.tier}`}
              data-current={plan.isCurrent ? 'true' : undefined}
              className={`relative flex flex-col gap-5 overflow-hidden rounded-3xl border p-7 transition-[transform,border-color] duration-300 ${
                plan.isCurrent
                  ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-surface)] shadow-[var(--shadow-blush)]'
                  : plan.isMid
                    ? 'border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] [@media(hover:hover)]:hover:-translate-y-1'
                    : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] [@media(hover:hover)]:hover:-translate-y-0.5'
              }`}
            >
              {plan.isCurrent ? (
                <span className="absolute top-5 right-5 inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-blush-400)] px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] text-[oklch(15%_0.012_28)] uppercase">
                  <Sparkles className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  {tBilling('currentPlanBadge')}
                </span>
              ) : plan.isMid ? (
                <span className="absolute top-5 right-5 inline-flex items-center gap-1.5 rounded-full bg-[oklch(28%_0.05_80)] px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] text-[oklch(85%_0.05_80)] uppercase">
                  <Sparkles className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  {tBilling('recommendedBadge')}
                </span>
              ) : null}

              <header className="flex flex-col gap-1.5">
                <h2
                  className="font-display italic"
                  style={{
                    fontSize: 'clamp(1.25rem, 1.8vw, 1.5rem)',
                    letterSpacing: '-0.018em',
                    color: 'var(--color-foreground)',
                  }}
                >
                  {plan.label}
                </h2>
                <p className="text-sm text-[color:var(--color-muted-foreground)]">
                  {tPlans(
                    `pro.descriptions.${plan.descriptionKey}` as Parameters<typeof tPlans>[0],
                  )}
                </p>
              </header>

              <p className="flex items-baseline gap-2">
                <span
                  className="font-display tabular-nums"
                  style={{
                    fontSize: 'clamp(2.25rem, 4vw, 2.75rem)',
                    fontStyle: 'italic',
                    fontWeight: 300,
                    letterSpacing: '-0.025em',
                    lineHeight: 1,
                    color: 'var(--color-foreground)',
                  }}
                >
                  {formatPrice(amount, locale)}
                </span>
                <span className="text-sm text-[color:var(--color-muted-foreground)]">
                  {billing === 'annual' ? '/an' : tBilling('perMonth')}
                </span>
              </p>

              <ul className="flex flex-col gap-2 text-sm">
                {plan.featureKeys.map((key) => (
                  <li
                    key={key}
                    className="flex items-start gap-2.5 text-[color:var(--color-ink-700)]"
                  >
                    <span
                      aria-hidden
                      className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--color-blush-400)]/15 text-[color:var(--color-blush-400)]"
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    <span className="leading-relaxed">
                      {tPlans(`pro.features.${key}` as Parameters<typeof tPlans>[0])}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                <Button
                  type="button"
                  variant={plan.isMid && !plan.isCurrent ? 'primary' : 'outline'}
                  size="md"
                  className="w-full"
                  disabled={plan.isCurrent && hasActive}
                  data-testid={`subscribe-${plan.tier}`}
                  onClick={() => setConfirm(plan)}
                >
                  {plan.isCurrent && hasActive
                    ? tBilling('currentPlanButton')
                    : hasCurrentTier
                      ? tBilling('changePlan')
                      : tBilling('subscribe')}
                </Button>
              </div>
            </article>
          );
        })}
      </section>

      {confirm ? (
        <ChangePlanDialog
          target={confirm}
          current={current}
          billing={billing}
          locale={locale}
          tierMeta={tierMeta}
          subscribeAction={subscribeAction}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}

function ChangePlanDialog({
  target,
  current,
  billing,
  locale,
  tierMeta,
  subscribeAction,
  onClose,
}: {
  target: PlanCardData;
  current: PlanCardData | null;
  billing: 'monthly' | 'annual';
  locale: string;
  tierMeta?: TierMeta;
  subscribeAction: (formData: FormData) => void | Promise<void>;
  onClose: () => void;
}) {
  const priceOf = (p: PlanCardData) => (billing === 'annual' ? p.annualMinor : p.monthlyMinor);
  const newPrice = priceOf(target);
  const curPrice = current ? priceOf(current) : 0;
  const samePlan = current?.tier === target.tier;
  const isUp = current ? TIER_RANK[target.tier] > TIER_RANK[current.tier] : true;
  const cycleSuffix = billing === 'annual' ? '/an' : '/mois';

  const eyebrow = !current
    ? 'Souscrire'
    : samePlan
      ? 'Changer de cycle'
      : isUp
        ? 'Mettre à niveau'
        : 'Rétrograder';
  const cta = !current
    ? `Souscrire ${target.label}`
    : samePlan
      ? billing === 'annual'
        ? 'Passer en annuel'
        : 'Passer en mensuel'
      : isUp
        ? `Passer à ${target.label}`
        : `Rétrograder vers ${target.label}`;
  const intro = !current ? (
    <>
      Vous souscrivez au forfait{' '}
      <b className="text-[color:var(--color-foreground)]">{target.label}</b>. Le paiement et la
      facturation sont gérés par Stripe.
    </>
  ) : samePlan ? (
    <>
      Vous passez votre forfait{' '}
      <b className="text-[color:var(--color-foreground)]">{target.label}</b> en facturation{' '}
      {billing === 'annual' ? 'annuelle (−20 %)' : 'mensuelle'}.
    </>
  ) : isUp ? (
    <>
      Vous passez de <b className="text-[color:var(--color-foreground)]">{current.label}</b> à{' '}
      <b className="text-[color:var(--color-foreground)]">{target.label}</b>. Le nouveau forfait est
      actif immédiatement ; la différence est calculée au prorata par Stripe.
    </>
  ) : (
    <>
      Vous rétrogradez de <b className="text-[color:var(--color-foreground)]">{current.label}</b> à{' '}
      <b className="text-[color:var(--color-foreground)]">{target.label}</b>. Le changement prend
      effet à la prochaine échéance.
    </>
  );

  return (
    <BillingDialog
      Icon={isUp ? ArrowUpRight : RefreshCw}
      eyebrow={eyebrow}
      title={`${target.label} · ${formatPrice(newPrice, locale)}${cycleSuffix}`}
      intro={intro}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            Annuler
          </Button>
          <form action={subscribeAction}>
            <input type="hidden" name="tier" value={target.tier} />
            <input type="hidden" name="billing" value={billing} />
            <Button type="submit" variant="primary" size="md" data-testid="confirm-change-plan">
              {isUp ? (
                <ArrowUpRight className="h-4 w-4" strokeWidth={2} aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />
              )}
              {cta}
            </Button>
          </form>
        </>
      }
    >
      <RecapCard>
        {current ? (
          <RecapRow
            label={`Forfait actuel · ${current.label}`}
            value={`${formatPrice(curPrice, locale)}${cycleSuffix}`}
          />
        ) : null}
        <RecapRow
          label={`Nouveau forfait · ${target.label}`}
          value={`${formatPrice(newPrice, locale)}${cycleSuffix}`}
        />
        <RecapRow
          label={current ? 'Dès la prochaine échéance' : 'À régler via Stripe'}
          value={`${formatPrice(newPrice, locale)}${cycleSuffix}`}
          total
        />
      </RecapCard>
      {tierMeta && current && !samePlan ? (
        <RecapCard>
          <RecapRow
            label="Événements actifs"
            value={`${fmtNum(tierMeta[current.tier].events)} → ${fmtNum(tierMeta[target.tier].events)}`}
          />
          <RecapRow
            label="Messages/mois inclus"
            value={`${fmtNum(tierMeta[current.tier].messages)} → ${fmtNum(tierMeta[target.tier].messages)}`}
          />
          <RecapRow
            label="Stockage"
            value={`${fmtNum(tierMeta[current.tier].storageGo)} → ${fmtNum(tierMeta[target.tier].storageGo)} Go`}
          />
        </RecapCard>
      ) : null}
    </BillingDialog>
  );
}
