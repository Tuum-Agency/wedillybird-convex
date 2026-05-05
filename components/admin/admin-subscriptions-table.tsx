'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';

type Org = {
  _id: string;
  name: string;
  slug: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  subscriptionPeriodEnd?: number;
  paygCredits?: number;
  ownerName: string | null;
  ownerEmail: string | null;
  createdAt: number;
};

const STATUS_VARIANT: Record<string, 'neutral' | 'success' | 'warning' | 'destructive'> = {
  active: 'success',
  trialing: 'accent' as 'success',
  past_due: 'warning',
  canceled: 'destructive',
  unpaid: 'destructive',
};

export function AdminSubscriptionsTable({ organizations }: { organizations: Org[] }) {
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
          placeholder="Rechercher une organisation…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted-foreground)] focus:ring-1 focus:ring-[color:var(--color-border-strong)] focus:outline-none"
        />
        <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
          {filtered.length} organisation{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
              <Th>Organisation</Th>
              <Th>Propriétaire</Th>
              <Th>Tier</Th>
              <Th>Statut</Th>
              <Th>Renouvellement</Th>
              <Th>Crédits PAYG</Th>
              <Th>Créée le</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr
                key={o._id}
                className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-elevated)]/50"
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">{o.name}</p>
                    <p className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
                      {o.slug}
                    </p>
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
                <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                    new Date(o.createdAt),
                  )}
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
