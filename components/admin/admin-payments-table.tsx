'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { adminRefundPaymentAction } from '@/app/[locale]/(app)/admin/actions';

type Payment = {
  _id: string;
  plan: 'essential' | 'premium';
  currency: 'EUR' | 'USD' | 'XOF' | 'MAD' | 'TND';
  amountMinor: number;
  provider: 'stripe' | 'mock';
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
  failureReason?: string;
  refundedAmountMinor?: number;
  refundedAt?: number;
  userName: string | null;
  userEmail: string | null;
  eventId: string;
  createdAt: number;
  updatedAt: number;
};

const STATUS_VARIANT: Record<string, 'neutral' | 'success' | 'warning' | 'destructive'> = {
  pending: 'warning',
  succeeded: 'success',
  failed: 'destructive',
  cancelled: 'neutral',
  refunded: 'neutral',
  partially_refunded: 'warning',
};

const CURRENCY_DIVISOR: Record<string, number> = {
  EUR: 100,
  USD: 100,
  XOF: 1,
  MAD: 100,
  TND: 1000,
};

function divisor(currency: string): number {
  return CURRENCY_DIVISOR[currency] ?? 100;
}

function formatAmount(amountMinor: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountMinor / divisor(currency));
}

export function AdminPaymentsTable({ payments }: { payments: Payment[] }) {
  const t = useTranslations('Admin');
  const locale = useLocale();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');

  const filtered = payments.filter((p) => {
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchCurrency = currencyFilter === 'all' || p.currency === currencyFilter;
    return matchStatus && matchCurrency;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('payments.statusFilterAll')}</SelectItem>
            <SelectItem value="succeeded">{t('paymentStatuses.succeeded')}</SelectItem>
            <SelectItem value="pending">{t('paymentStatuses.pending')}</SelectItem>
            <SelectItem value="failed">{t('paymentStatuses.failed')}</SelectItem>
            <SelectItem value="cancelled">{t('paymentStatuses.cancelled')}</SelectItem>
            <SelectItem value="refunded">{t('paymentStatuses.refunded')}</SelectItem>
            <SelectItem value="partially_refunded">
              {t('paymentStatuses.partially_refunded')}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
          <SelectTrigger className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('payments.currencyFilterAll')}</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="XOF">XOF</SelectItem>
            <SelectItem value="MAD">MAD</SelectItem>
            <SelectItem value="TND">TND</SelectItem>
          </SelectContent>
        </Select>
        <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
          {t('payments.count', { count: filtered.length })}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
              <Th>{t('payments.colClient')}</Th>
              <Th>{t('payments.colPlan')}</Th>
              <Th>{t('payments.colAmount')}</Th>
              <Th>{t('payments.colProvider')}</Th>
              <Th>{t('payments.colStatus')}</Th>
              <Th>{t('payments.colDate')}</Th>
              <Th>{t('common.colActions')}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <PaymentRow key={p._id} payment={p} locale={locale} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentRow({ payment: p, locale }: { payment: Payment; locale: string }) {
  const t = useTranslations('Admin');
  const refunded = p.refundedAmountMinor ?? 0;
  const remaining = p.amountMinor - refunded;
  const canRefund =
    (p.status === 'succeeded' || p.status === 'partially_refunded') && remaining > 0;
  const hasInvoice =
    p.status === 'succeeded' || p.status === 'partially_refunded' || p.status === 'refunded';

  return (
    <tr className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-elevated)]/50">
      <td className="px-4 py-3 font-medium">{p.userName ?? p.userEmail ?? '—'}</td>
      <td className="px-4 py-3">
        <Badge variant={p.plan === 'premium' ? 'primary' : 'neutral'}>{p.plan}</Badge>
      </td>
      <td className="px-4 py-3 font-mono">
        {formatAmount(p.amountMinor, p.currency, locale)}
        {refunded > 0 ? (
          <span className="ml-1 text-[10px] text-[color:var(--color-muted-foreground)]">
            (−{formatAmount(refunded, p.currency, locale)})
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">{p.provider}</td>
      <td className="px-4 py-3">
        <Badge variant={STATUS_VARIANT[p.status] ?? 'neutral'}>
          {t.has(`paymentStatuses.${p.status}`) ? t(`paymentStatuses.${p.status}`) : p.status}
        </Badge>
      </td>
      <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
        {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(p.createdAt),
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {hasInvoice ? (
            <a
              href={`/api/payments/${p._id}/invoice.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-2 py-1 text-xs font-medium text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]"
            >
              {t('payments.invoice')}
            </a>
          ) : null}
          {canRefund ? (
            <RefundDialog payment={p} remaining={remaining} />
          ) : !hasInvoice ? (
            <span className="text-xs text-[color:var(--color-muted-foreground)]">—</span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function RefundDialog({ payment: p, remaining }: { payment: Payment; remaining: number }) {
  const t = useTranslations('Admin');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const div = divisor(p.currency);
  const maxMajor = remaining / div;

  function submit() {
    setError(null);
    let amountMinor: number | undefined;
    if (partial) {
      const major = Number(amount.replace(',', '.'));
      if (!Number.isFinite(major) || major <= 0) {
        setError(t('payments.refund.errorInvalidAmount'));
        return;
      }
      amountMinor = Math.round(major * div);
      if (amountMinor > remaining) {
        setError(t('payments.refund.errorExceedsRemaining'));
        return;
      }
    }
    startTransition(async () => {
      const res = await adminRefundPaymentAction(p._id, amountMinor);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setPartial(false);
      setAmount('');
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="rounded-md px-2 py-1 text-xs font-medium text-[color:var(--color-danger)] transition-colors hover:bg-[color:var(--color-danger)]/10">
          {t('payments.refund.trigger')}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('payments.refund.title')}</DialogTitle>
          <DialogDescription>
            {t.rich('payments.refund.description', {
              client: p.userName ?? p.userEmail ?? t('payments.clientFallback'),
              plan: p.plan,
              amount: formatAmount(remaining, p.currency, locale),
              mono: (chunks) => <span className="font-mono">{chunks}</span>,
            })}{' '}
            {p.provider === 'mock'
              ? t('payments.refund.providerNoteMock')
              : t('payments.refund.providerNoteStripe')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={partial}
              onChange={(e) => setPartial(e.target.checked)}
              className="h-4 w-4 rounded border-[color:var(--color-border)] accent-[color:var(--color-primary)]"
            />
            {t('payments.refund.partialLabel')}
          </label>

          {partial ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={maxMajor.toFixed(div === 1 ? 0 : 2)}
                className="focus-ring w-32 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 font-mono text-sm text-[color:var(--color-foreground)]"
              />
              <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
                {p.currency}
              </span>
            </div>
          ) : null}

          {error ? <p className="text-sm text-[color:var(--color-danger)]">{error}</p> : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" type="button" disabled={pending}>
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button variant="destructive" size="sm" type="button" onClick={submit} disabled={pending}>
            {pending
              ? t('payments.refund.submitting')
              : partial
                ? t('payments.refund.submitPartial')
                : t('payments.refund.submitFull', {
                    amount: formatAmount(remaining, p.currency, locale),
                  })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-muted-foreground)] uppercase">
      {children}
    </th>
  );
}
