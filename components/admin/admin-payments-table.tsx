'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

type Payment = {
  _id: string;
  plan: 'essential' | 'premium';
  currency: 'EUR' | 'XOF' | 'MAD' | 'TND';
  amountMinor: number;
  provider: 'stripe' | 'cinetpay' | 'mock';
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)]"
        >
          <option value="all">Tous les statuts</option>
          <option value="succeeded">Réussi</option>
          <option value="pending">En attente</option>
          <option value="failed">Échoué</option>
          <option value="cancelled">Annulé</option>
        </select>
        <select
          value={currencyFilter}
          onChange={(e) => setCurrencyFilter(e.target.value)}
          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)]"
        >
          <option value="all">Toutes les devises</option>
          <option value="EUR">EUR</option>
          <option value="XOF">XOF</option>
          <option value="MAD">MAD</option>
          <option value="TND">TND</option>
        </select>
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
                  {new Intl.DateTimeFormat('fr', {
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
