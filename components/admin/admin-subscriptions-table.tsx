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
  adminCancelSubscriptionAction,
  adminReactivateSubscriptionAction,
  adminListOrgInvoicesAction,
  type OrgInvoicesResult,
} from '@/app/[locale]/(app)/admin/actions';

type Org = {
  _id: string;
  name: string;
  slug: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  subscriptionPeriodEnd?: number;
  paygCredits?: number;
  hasStripeSubscription?: boolean;
  hasStripeCustomer?: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
  createdAt: number;
};

const STATUS_VARIANT: Record<string, 'neutral' | 'success' | 'warning' | 'destructive' | 'accent'> =
  {
    active: 'success',
    trialing: 'accent',
    past_due: 'warning',
    canceled: 'destructive',
    unpaid: 'destructive',
  };

export function AdminSubscriptionsTable({ organizations }: { organizations: Org[] }) {
  const t = useTranslations('Admin');
  const locale = useLocale();
  const [search, setSearch] = useState('');

  const filtered = organizations.filter((o) => {
    return (
      !search ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.slug.toLowerCase().includes(search.toLowerCase()) ||
      o.ownerName?.toLowerCase().includes(search.toLowerCase()) ||
      o.ownerEmail?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder={t('subscriptions.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted-foreground)] focus:ring-1 focus:ring-[color:var(--color-border-strong)] focus:outline-none"
        />
        <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
          {t('subscriptions.count', { count: filtered.length })}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
              <Th>{t('subscriptions.colOrg')}</Th>
              <Th>{t('subscriptions.colOwner')}</Th>
              <Th>{t('subscriptions.colTier')}</Th>
              <Th>{t('subscriptions.colStatus')}</Th>
              <Th>{t('subscriptions.colRenewal')}</Th>
              <Th>{t('subscriptions.colPaygCredits')}</Th>
              <Th>{t('common.colActions')}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <OrgRow key={o._id} org={o} locale={locale} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrgRow({ org: o, locale }: { org: Org; locale: string }) {
  const isCanceled = o.subscriptionStatus === 'canceled';
  const hasSub = Boolean(o.hasStripeSubscription);

  return (
    <tr className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-elevated)]/50">
      <td className="px-4 py-3">
        <div>
          <p className="font-medium">{o.name}</p>
          <p className="font-mono text-xs text-[color:var(--color-muted-foreground)]">{o.slug}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
        {o.ownerName ?? o.ownerEmail ?? '—'}
      </td>
      <td className="px-4 py-3">
        {o.subscriptionTier ? (
          <Badge variant="accent">{o.subscriptionTier}</Badge>
        ) : (
          <span className="text-[color:var(--color-muted-foreground)]">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {o.subscriptionStatus ? (
          <Badge variant={STATUS_VARIANT[o.subscriptionStatus] ?? 'neutral'}>
            {o.subscriptionStatus}
          </Badge>
        ) : (
          <span className="text-[color:var(--color-muted-foreground)]">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
        {o.subscriptionPeriodEnd
          ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
              new Date(o.subscriptionPeriodEnd),
            )
          : '—'}
      </td>
      <td className="px-4 py-3 font-mono">{o.paygCredits ?? 0}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {o.hasStripeCustomer ? <InvoicesDialog org={o} /> : null}
          {hasSub && !isCanceled ? <CancelDialog org={o} /> : null}
          {hasSub && isCanceled ? <ReactivateButton org={o} /> : null}
          {!o.hasStripeCustomer && !hasSub ? (
            <span className="text-xs text-[color:var(--color-muted-foreground)]">—</span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function CancelDialog({ org: o }: { org: Org }) {
  const t = useTranslations('Admin');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'period_end' | 'immediate'>('period_end');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await adminCancelSubscriptionAction(o._id, mode);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="rounded-md px-2 py-1 text-xs font-medium text-[color:var(--color-danger)] transition-colors hover:bg-[color:var(--color-danger)]/10">
          {t('common.cancel')}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('subscriptions.cancel.title')}</DialogTitle>
          <DialogDescription>
            {t('subscriptions.cancel.description', {
              name: o.name,
              tier: o.subscriptionTier ?? t('subscriptions.cancel.tierFallback'),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2 rounded-lg border border-[color:var(--color-border)] p-3 text-sm">
            <input
              type="radio"
              name={`cancel-mode-${o._id}`}
              checked={mode === 'period_end'}
              onChange={() => setMode('period_end')}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t('subscriptions.cancel.periodEndTitle')}</span>
              <span className="block text-xs text-[color:var(--color-muted-foreground)]">
                {t('subscriptions.cancel.periodEndDescription')}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-[color:var(--color-border)] p-3 text-sm">
            <input
              type="radio"
              name={`cancel-mode-${o._id}`}
              checked={mode === 'immediate'}
              onChange={() => setMode('immediate')}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t('subscriptions.cancel.immediateTitle')}</span>
              <span className="block text-xs text-[color:var(--color-muted-foreground)]">
                {t('subscriptions.cancel.immediateDescription')}
              </span>
            </span>
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-[color:var(--color-danger)]">{error}</p> : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" type="button" disabled={pending}>
              {t('common.back')}
            </Button>
          </DialogClose>
          <Button variant="destructive" size="sm" type="button" onClick={submit} disabled={pending}>
            {pending ? t('subscriptions.cancel.submitting') : t('subscriptions.cancel.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReactivateButton({ org: o }: { org: Org }) {
  const t = useTranslations('Admin');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reactivate() {
    setError(null);
    startTransition(async () => {
      const res = await adminReactivateSubscriptionAction(o._id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <span className="flex items-center gap-1">
      <button
        onClick={reactivate}
        disabled={pending}
        className="rounded-md px-2 py-1 text-xs font-medium text-[color:var(--color-success)] transition-colors hover:bg-[color:var(--color-success)]/10 disabled:opacity-50"
      >
        {pending ? t('subscriptions.reactivate.submitting') : t('subscriptions.reactivate.submit')}
      </button>
      {error ? <span className="text-[10px] text-[color:var(--color-danger)]">{error}</span> : null}
    </span>
  );
}

function InvoicesDialog({ org: o }: { org: Org }) {
  const t = useTranslations('Admin');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<OrgInvoicesResult | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    setOpen(true);
    if (data) return;
    startTransition(async () => {
      const res = await adminListOrgInvoicesAction(o._id);
      setData(res);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? load() : setOpen(false))}>
      <DialogTrigger asChild>
        <button className="rounded-md px-2 py-1 text-xs font-medium text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]">
          {t('subscriptions.invoices.trigger')}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('subscriptions.invoices.title', { name: o.name })}</DialogTitle>
          <DialogDescription>{t('subscriptions.invoices.description')}</DialogDescription>
        </DialogHeader>

        {pending ? (
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            {t('common.loading')}
          </p>
        ) : data && !data.ok ? (
          <p className="text-sm text-[color:var(--color-danger)]">{data.error}</p>
        ) : data && data.ok && data.invoices.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            {t('subscriptions.invoices.empty')}
          </p>
        ) : data && data.ok ? (
          <div className="flex flex-col divide-y divide-[color:var(--color-border)]">
            {data.invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-mono">{inv.id}</p>
                  <p className="text-xs text-[color:var(--color-muted-foreground)]">
                    {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                      new Date(inv.date),
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono">
                    {new Intl.NumberFormat(locale, {
                      style: 'currency',
                      currency: inv.currency,
                    }).format(inv.amountMinor / 100)}
                  </span>
                  <Badge variant={inv.status === 'paid' ? 'success' : 'neutral'}>
                    {t.has(`stripeInvoiceStatuses.${inv.status}`)
                      ? t(`stripeInvoiceStatuses.${inv.status}`)
                      : inv.status}
                  </Badge>
                  {inv.pdfUrl ? (
                    <a
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-[color:var(--color-primary)] hover:underline"
                    >
                      PDF
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" type="button">
              {t('common.close')}
            </Button>
          </DialogClose>
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
