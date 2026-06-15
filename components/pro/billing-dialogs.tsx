'use client';

import { useEffect, type ReactNode } from 'react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Coins, AlertTriangle, X, ShieldCheck, Info, XCircle, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Dialogues de facturation (design Claude) — confirmations avant les actions
 * Stripe : acheter un crédit PAYG, résilier (via le portail Stripe). Le dialogue
 * de changement de formule vit dans `plan-cards.tsx` (il a besoin de l'état du
 * cycle). Toutes les actions réelles sont des Server Actions passées en props.
 */

export function BillingDialog({
  Icon,
  eyebrow,
  title,
  intro,
  danger,
  children,
  footer,
  onClose,
}: {
  Icon: LucideIcon;
  eyebrow: string;
  title: string;
  intro: ReactNode;
  danger?: boolean;
  children?: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  const t = useTranslations('Pro.main');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex w-full max-w-md flex-col gap-4 rounded-t-3xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-popover)] sm:rounded-3xl">
        <div className="flex items-start gap-3">
          <span
            className={
              'grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ' +
              (danger
                ? 'bg-[oklch(28%_0.05_25)] text-[oklch(84%_0.09_25)]'
                : 'bg-[color:var(--color-blush-500)]/15 text-[color:var(--color-blush-300)]')
            }
          >
            <Icon className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
              {eyebrow}
            </span>
            <h2 className="font-display text-lg text-[color:var(--color-foreground)] italic">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('billing.close')}
            className="focus-ring -mt-1 rounded-lg p-1.5 text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <p className="text-[13px] leading-relaxed text-[color:var(--color-ink-700)]">{intro}</p>
        {children}
        <div className="mt-1 flex items-center justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

/** Bloc récapitulatif (lignes label / valeur + total). */
export function RecapRow({
  label,
  value,
  total,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  total?: boolean;
  tone?: 'ok';
}) {
  return (
    <div
      className={
        'flex items-center justify-between gap-3 py-1.5 text-[13px]' +
        (total ? ' border-t border-[color:var(--color-border)] pt-2.5 font-medium' : '')
      }
    >
      <span
        className={
          total
            ? 'text-[color:var(--color-foreground)]'
            : 'text-[color:var(--color-muted-foreground)]'
        }
      >
        {label}
      </span>
      <span
        className={
          'font-mono tabular-nums ' +
          (tone === 'ok' ? 'text-[oklch(82%_0.08_150)]' : 'text-[color:var(--color-foreground)]')
        }
      >
        {value}
      </span>
    </div>
  );
}

export function RecapCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-4 py-2.5">
      {children}
    </div>
  );
}

/* ------------------------------ Acheter un crédit PAYG ------------------------------ */

export function BuyCreditButton({
  label,
  priceLabel,
  action,
}: {
  label: string;
  priceLabel: string;
  action: () => void | Promise<void>;
}) {
  const t = useTranslations('Pro.main');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="md"
        data-testid="buy-payg"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {open ? (
        <BillingDialog
          Icon={Coins}
          eyebrow="Pay-as-you-go"
          title={t('billing.buyCreditTitle')}
          intro={t.rich('billing.buyCreditIntro', {
            b: (chunks) => <b className="text-[color:var(--color-foreground)]">{chunks}</b>,
          })}
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button type="button" variant="ghost" size="md" onClick={() => setOpen(false)}>
                {t('billing.cancel')}
              </Button>
              <form action={action}>
                <Button type="submit" variant="primary" size="md" data-testid="buy-payg-confirm">
                  <Coins className="h-4 w-4" strokeWidth={1.9} aria-hidden />
                  {t('billing.pay', { price: priceLabel })}
                </Button>
              </form>
            </>
          }
        >
          <RecapCard>
            <RecapRow label={t('billing.oneEventCredit')} value={priceLabel} />
            <RecapRow label={t('billing.total')} value={priceLabel} total />
          </RecapCard>
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[color:var(--color-muted-foreground)]">
            <ShieldCheck
              className="mt-0.5 h-3 w-3 flex-shrink-0 text-[color:var(--color-sage-500)]"
              strokeWidth={1.9}
              aria-hidden
            />
            {t('billing.securePaymentNote')}
          </p>
        </BillingDialog>
      ) : null}
    </>
  );
}

/* ------------------------------ Résilier l'abonnement ------------------------------ */

export function CancelSubscriptionButton({
  planLabel,
  renewalLabel,
  action,
}: {
  planLabel: string;
  renewalLabel: string;
  action: () => void | Promise<void>;
}) {
  const t = useTranslations('Pro.main');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="cancel-subscription"
        className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm text-[color:var(--color-danger)]/80 transition-colors hover:text-[color:var(--color-danger)]"
      >
        <XCircle className="h-4 w-4" strokeWidth={1.9} aria-hidden />
        {t('billing.cancelSubscription')}
      </button>
      {open ? (
        <BillingDialog
          Icon={AlertTriangle}
          danger
          eyebrow={t('billing.cancelEyebrow')}
          title={t('billing.cancelTitle', { plan: planLabel })}
          intro={t.rich('billing.cancelIntro', {
            renewal: renewalLabel,
            b: (chunks) => <b className="text-[color:var(--color-foreground)]">{chunks}</b>,
          })}
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button type="button" variant="ghost" size="md" onClick={() => setOpen(false)}>
                {t('billing.keepSubscription')}
              </Button>
              <form action={action}>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  data-testid="cancel-confirm"
                  style={{ background: 'var(--color-danger)', color: 'oklch(98% 0.01 25)' }}
                >
                  <XCircle className="h-4 w-4" strokeWidth={2} aria-hidden />
                  {t('billing.cancelViaStripe')}
                </Button>
              </form>
            </>
          }
        >
          <RecapCard>
            <RecapRow label={t('billing.accessUntil')} value={renewalLabel} />
            <RecapRow label={t('billing.weddingsAndData')} value={t('billing.kept')} tone="ok" />
            <RecapRow label={t('billing.nextCharge')} value={t('billing.cancelled')} />
          </RecapCard>
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[color:var(--color-muted-foreground)]">
            <Info className="mt-0.5 h-3 w-3 flex-shrink-0" strokeWidth={1.9} aria-hidden />
            {t('billing.paygUnaffectedNote')}
          </p>
        </BillingDialog>
      ) : null}
    </>
  );
}
