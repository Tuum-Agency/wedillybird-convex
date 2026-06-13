'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Payment = {
  _id: string;
  plan: 'essential' | 'premium';
  currency: 'EUR' | 'USD' | 'XOF' | 'MAD' | 'TND';
  amountMinor: number;
  provider: 'stripe' | 'mock';
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  failureReason?: string;
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
};

const CURRENCY_DIVISOR: Record<string, number> = {
  EUR: 100,
  USD: 100,
  XOF: 1,
  MAD: 100,
  TND: 1000,
};

function formatAmount(amountMinor: number, currency: string): string {
  const divisor = CURRENCY_DIVISOR[currency] ?? 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountMinor / divisor);
}

export function AdminPaymentsTable({ payments }: { payments: Payment[] }) {
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
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="succeeded">Réussi</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="failed">Échoué</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
          </SelectContent>
        </Select>
        <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
          <SelectTrigger className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les devises</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="XOF">XOF</SelectItem>
            <SelectItem value="MAD">MAD</SelectItem>
            <SelectItem value="TND">TND</SelectItem>
          </SelectContent>
        </Select>
        <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
          {filtered.length} transaction{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
              <Th>Client</Th>
              <Th>Plan</Th>
              <Th>Montant</Th>
              <Th>Provider</Th>
              <Th>Statut</Th>
              <Th>Date</Th>
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
                <td className="px-4 py-3 font-mono">{formatAmount(p.amountMinor, p.currency)}</td>
                <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
                  {p.provider}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[p.status] ?? 'neutral'}>{p.status}</Badge>
                </td>
                <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(p.createdAt))}
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
