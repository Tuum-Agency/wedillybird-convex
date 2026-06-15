'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';

type Payment = {
  _id: string;
  plan: 'essential' | 'premium';
  currency: 'EUR' | 'USD' | 'XOF' | 'MAD' | 'TND';
  amountMinor: number;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
  refundedAmountMinor?: number;
  userName: string | null;
  userEmail: string | null;
  createdAt: number;
};

const CURRENCY_DIVISOR: Record<string, number> = {
  EUR: 100,
  USD: 100,
  XOF: 1,
  MAD: 100,
  TND: 1000,
};

function formatAmount(amountMinor: number, currency: string, locale: string): string {
  const divisor = CURRENCY_DIVISOR[currency] ?? 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountMinor / divisor);
}

const STATUS_VARIANT: Record<string, 'neutral' | 'success' | 'warning'> = {
  succeeded: 'success',
  refunded: 'neutral',
  partially_refunded: 'warning',
};

/**
 * Factures one-shot plateforme (Essentiel / Premium). Chaque paiement encaissé
 * a une facture PDF générée à la volée par `/api/payments/{id}/invoice.pdf`.
 * Les factures d'abonnement Stripe sont consultables par organisation depuis
 * la section Abonnements (bouton « Factures »).
 */
export function AdminInvoicesTable({ payments }: { payments: Payment[] }) {
  const t = useTranslations('Admin');
  const locale = useLocale();
  const [search, setSearch] = useState('');

  // Seuls les paiements encaissés (et leurs avatars remboursés) ont une facture.
  const invoiced = payments.filter(
    (p) => p.status === 'succeeded' || p.status === 'refunded' || p.status === 'partially_refunded',
  );

  const filtered = invoiced.filter(
    (p) =>
      !search ||
      p.userName?.toLowerCase().includes(search.toLowerCase()) ||
      p.userEmail?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder={t('invoices.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted-foreground)] focus:ring-1 focus:ring-[color:var(--color-border-strong)] focus:outline-none"
        />
        <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
          {t('invoices.count', { count: filtered.length })}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
              <Th>{t('invoices.colClient')}</Th>
              <Th>{t('invoices.colPlan')}</Th>
              <Th>{t('invoices.colAmount')}</Th>
              <Th>{t('invoices.colStatus')}</Th>
              <Th>{t('invoices.colDate')}</Th>
              <Th>{t('invoices.colInvoice')}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={p._id}
                className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-elevated)]/50"
              >
                <td className="px-4 py-3 font-medium">{p.userName ?? p.userEmail ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant={p.plan === 'premium' ? 'primary' : 'neutral'}>{p.plan}</Badge>
                </td>
                <td className="px-4 py-3 font-mono">
                  {formatAmount(p.amountMinor, p.currency, locale)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[p.status] ?? 'neutral'}>
                    {t.has(`invoiceStatuses.${p.status}`)
                      ? t(`invoiceStatuses.${p.status}`)
                      : p.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                    new Date(p.createdAt),
                  )}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`/api/payments/${p._id}/invoice.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md px-2 py-1 text-xs font-medium text-[color:var(--color-primary)] transition-colors hover:bg-[color:var(--color-surface-elevated)]"
                  >
                    {t('invoices.downloadPdf')}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-muted-foreground)] uppercase">
      {children}
    </th>
  );
}
