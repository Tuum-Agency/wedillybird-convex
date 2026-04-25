'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { PLANS, formatAmount, type Currency, type PlanTier } from '@/lib/payments/plans';

interface Props {
  eventId: string;
  /** Current event plan. Undefined = unpaid draft (must purchase before publishing). */
  currentTier: PlanTier | undefined;
  currency: Currency;
}

const UPGRADE_TARGETS: Record<'unpaid' | 'essential', PlanTier[]> = {
  unpaid: ['essential', 'premium'],
  essential: ['premium'],
};

export function UpgradeCard({ eventId, currentTier, currency }: Props) {
  const t = useTranslations('Upgrade');
  const tPlans = useTranslations('Plans');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<PlanTier | null>(null);

  if (currentTier === 'premium') {
    return (
      <p className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 text-sm text-[color:var(--color-muted)]">
        {t('alreadyPremium')}
      </p>
    );
  }

  const upgrades = currentTier === 'essential' ? UPGRADE_TARGETS.essential : UPGRADE_TARGETS.unpaid;

  function handleSelect(plan: PlanTier) {
    setError(null);
    setSelecting(plan);
    startTransition(async () => {
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, plan, currency }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? 'UNKNOWN');
          setSelecting(null);
          return;
        }
        const body = (await res.json()) as { redirectUrl: string };
        window.location.assign(body.redirectUrl);
      } catch {
        setError('NETWORK');
        setSelecting(null);
      }
    });
  }

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5"
      data-testid="upgrade-card"
    >
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold">{t('title')}</h2>
        <p className="text-sm text-[color:var(--color-muted)]">{t('subtitle')}</p>
      </header>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {upgrades.map((plan) => {
          const price = PLANS[plan].prices[currency];
          return (
            <li
              key={plan}
              className="flex flex-col gap-3 rounded-lg border border-[color:var(--color-border)] p-4"
              data-testid={`upgrade-plan-${plan}`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg font-semibold">{t(`plans.${plan}`)}</span>
                <span className="font-display text-lg">{formatAmount(price, currency)}</span>
              </div>
              <p className="text-sm font-medium">
                {t('galleryRetention', { days: PLANS[plan].galleryRetentionDays })}
              </p>
              <ul className="flex flex-col gap-1.5 text-xs">
                {PLANS[plan].featureKeys.map((key) => (
                  <li key={key} className="flex items-start gap-1.5">
                    <span aria-hidden className="mt-0.5 text-[color:var(--color-accent)]">
                      ✓
                    </span>
                    <span>{tPlans(`features.${key}` as const)}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleSelect(plan)}
                disabled={pending}
                data-testid={`upgrade-cta-${plan}`}
              >
                {selecting === plan && pending ? t('redirecting') : t('selectPlan')}
              </Button>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
          {t(`errors.${error.toLowerCase()}` as const)}
        </p>
      ) : null}
    </section>
  );
}
